/*
 * ============================================================
 * WEARABLE HEALTH MONITOR - FIREBASE INTEGRATION
 * ============================================================
 * 
 * Reads BPM and SpO2 from MAX30102 on wrist.
 * ONLY uploads to Firebase when an accident is detected.
 * Dynamically finds the ACTIVE crash ID and binds vitals to it.
 * Each crash gets its own vitals - no shared data between crashes.
 * 
 * Board: ESP32S3 Dev Module
 * Tools -> USB CDC On Boot: ENABLED
 * Serial Monitor: 115200 baud
 * 
 * Wiring:
 *   MAX30102 VIN  -> 3.3V
 *   MAX30102 GND  -> GND
 *   MAX30102 SDA  -> GPIO8
 *   MAX30102 SCL  -> GPIO9
 * 
 * Libraries Required (Arduino Library Manager):
 *   1. SparkFun MAX3010x Pulse and Proximity Sensor Library
 *   2. Firebase Arduino Client Library for ESP32 (by Mobizt)
 * ============================================================
 */

#include <WiFi.h>
#include <Wire.h>
#include <Firebase_ESP_Client.h>
#include "MAX30105.h"
#include "spo2_algorithm.h"

// Provide token generation info
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

// ========================
// CONFIGURATION - EDIT THESE
// ========================
#define WIFI_SSID       "realme13Pro5G"        // <-- Change this
#define WIFI_PASSWORD   "x8gsiit5"     // <-- Change this

// Firebase credentials (from your project)
#define FIREBASE_API_KEY    "AIzaSyDVPGwdzVXFFQSUlJC_11rEW_OQrBqnK5w"
#define FIREBASE_DB_URL     "https://emergency-response-syste-ba2ce-default-rtdb.firebaseio.com"

// ========================
// I2C PINS
// ========================
#define SDA_PIN  8
#define SCL_PIN  9

// ========================
// TIMING
// ========================
#define CHECK_ACCIDENT_INTERVAL  5000   // Check Firebase every 5 sec
#define VITALS_UPLOAD_INTERVAL   3000   // Upload vitals every 3 sec during accident

// ========================
// OBJECTS
// ========================
MAX30105 particleSensor;
FirebaseData fbdo;
FirebaseData streamData;
FirebaseAuth auth;
FirebaseConfig config;

// ========================
// SENSOR BUFFERS
// ========================
#define BUFFER_LENGTH 100
uint32_t irBuffer[BUFFER_LENGTH];
uint32_t redBuffer[BUFFER_LENGTH];
int32_t spo2Value;
int8_t  validSPO2;
int32_t heartRateValue;
int8_t  validHeartRate;

// ========================
// STATE
// ========================
int currentBPM = 0;
int currentSpO2 = 0;
bool accidentActive = false;
String activeCrashId = "";          // Dynamic crash ID (e.g., "crash_001", "crash_002")
unsigned long lastAccidentCheck = 0;
unsigned long lastVitalsUpload = 0;
bool wifiConnected = false;
bool firebaseReady = false;

// ========================
// SETUP
// ========================
void setup() {
  Serial.begin(115200);
  while (!Serial) { delay(10); }
  delay(3000);
  
  Serial.println();
  Serial.println("=============================================");
  Serial.println("  WEARABLE HEALTH MONITOR + FIREBASE");
  Serial.println("  Posts vitals ONLY on accident detection");
  Serial.println("=============================================");
  Serial.println();
  
  // ---- Initialize Sensor ----
  initSensor();
  
  // ---- Connect WiFi ----
  connectWiFi();
  
  // ---- Initialize Firebase ----
  setupFirebase();
  
  Serial.println();
  Serial.println("=============================================");
  Serial.println("  SYSTEM READY!");
  Serial.println("  Monitoring vitals on wrist...");
  Serial.println("  Will upload when accident is detected.");
  Serial.println("=============================================");
  Serial.println();
}

// ========================
// MAIN LOOP
// ========================
void loop() {
  // ---- STEP 1: Always read sensor (keep vitals fresh) ----
  readVitals();
  
  // ---- STEP 2: Periodically check if accident happened ----
  if (millis() - lastAccidentCheck >= CHECK_ACCIDENT_INTERVAL) {
    lastAccidentCheck = millis();
    checkForAccident();
  }
  
  // ---- STEP 3: If accident is active, upload vitals ----
  if (accidentActive) {
    if (millis() - lastVitalsUpload >= VITALS_UPLOAD_INTERVAL) {
      lastVitalsUpload = millis();
      uploadVitals();
    }
  }
}

// ========================
// SENSOR INITIALIZATION
// ========================
void initSensor() {
  Wire.begin(SDA_PIN, SCL_PIN);
  delay(500);
  
  Serial.println("Scanning for MAX30102...");
  bool found = false;
  int retries = 0;
  
  while (!found && retries < 10) {
    for (byte addr = 1; addr < 127; addr++) {
      Wire.beginTransmission(addr);
      if (Wire.endTransmission() == 0 && addr == 0x57) {
        Serial.println("  MAX30102 found!");
        found = true;
      }
    }
    if (!found) {
      Serial.println("  Not found, retrying...");
      delay(2000);
      retries++;
    }
  }
  
  if (!found) {
    Serial.println("  MAX30102 NOT FOUND! Check wiring.");
    Serial.println("  Continuing without sensor...");
    return;
  }
  
  Serial.print("Initializing MAX30102... ");
  while (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("retrying...");
    delay(2000);
  }
  Serial.println("OK!");
  
  // Same settings that worked in your test
  byte ledBrightness = 0x1F;  // Calibrated for your wrist
  byte sampleAverage = 4;
  byte ledMode = 2;           // Red + IR
  int sampleRate = 100;
  int pulseWidth = 411;
  
  particleSensor.setup(ledBrightness, sampleAverage, ledMode, sampleRate, pulseWidth);
  Serial.println("Sensor configured for wrist mode!");
}

// ========================
// READ VITALS FROM SENSOR
// ========================
void readVitals() {
  // Collect 100 samples
  for (int i = 0; i < BUFFER_LENGTH; i++) {
    while (particleSensor.available() == false) {
      particleSensor.check();
    }
    redBuffer[i] = particleSensor.getRed();
    irBuffer[i] = particleSensor.getIR();
    particleSensor.nextSample();
  }
  
  // Check if sensor is on skin
  long avgIR = 0;
  for (int i = 0; i < BUFFER_LENGTH; i++) {
    avgIR += irBuffer[i];
  }
  avgIR /= BUFFER_LENGTH;
  
  if (avgIR < 5000) {
    currentBPM = 0;
    currentSpO2 = 0;
    Serial.println("Sensor not on wrist");
    return;
  }
  
  // Calculate BPM and SpO2
  maxim_heart_rate_and_oxygen_saturation(
    irBuffer, BUFFER_LENGTH,
    redBuffer,
    &spo2Value, &validSPO2,
    &heartRateValue, &validHeartRate
  );
  
  // Update current values only if valid
  if (validHeartRate == 1 && heartRateValue > 40 && heartRateValue < 180) {
    currentBPM = heartRateValue;
  }
  
  if (validSPO2 == 1 && spo2Value > 0 && spo2Value <= 100) {
    currentSpO2 = spo2Value;
  }
  
  // Print status
  Serial.print("Vitals: BPM=");
  Serial.print(currentBPM);
  Serial.print(" | SpO2=");
  Serial.print(currentSpO2);
  Serial.print("% | Accident: ");
  Serial.println(accidentActive ? "YES - UPLOADING" : "No - monitoring");
}

// ========================
// CHECK FIREBASE FOR ACCIDENT
// ========================
void checkForAccident() {
  if (!firebaseReady || WiFi.status() != WL_CONNECTED) {
    if (WiFi.status() != WL_CONNECTED) {
      connectWiFi();
    }
    return;
  }
  
  // Read all alerts as raw JSON string
  if (Firebase.RTDB.getString(&fbdo, "alerts")) {
    String payload = fbdo.payload();
    
    // Extract crash keys from the JSON string
    // Keys look like: "crash_001", "crash_002", etc.
    String foundCrashId = "";
    int searchStart = 0;
    
    while (searchStart < (int)payload.length()) {
      // Find next "crash_" key in the JSON
      int keyStart = payload.indexOf("\"crash_", searchStart);
      if (keyStart == -1) break;
      
      keyStart++;  // Skip opening quote
      int keyEnd = payload.indexOf("\"", keyStart);
      if (keyEnd == -1) break;
      
      String crashId = payload.substring(keyStart, keyEnd);
      searchStart = keyEnd + 1;
      
      // Check this crash's status
      String statusPath = "alerts/" + crashId + "/status";
      if (Firebase.RTDB.getString(&fbdo, statusPath.c_str())) {
        if (fbdo.stringData() == "ACTIVE") {
          foundCrashId = crashId;
          break;  // Found the active crash
        }
      }
    }
    
    if (foundCrashId.length() > 0) {
      // Active crash found
      if (!accidentActive || activeCrashId != foundCrashId) {
        Serial.println();
        Serial.println("!!! ACCIDENT DETECTED !!!");
        Serial.print("!!! Crash ID: ");
        Serial.print(foundCrashId);
        Serial.println(" !!!");
        Serial.println("!!! Starting vitals upload !!!");
        Serial.println();
        activeCrashId = foundCrashId;
        accidentActive = true;
        uploadVitals();  // Upload immediately
      }
    } else {
      // No active crash
      if (accidentActive) {
        Serial.println();
        Serial.print("Crash ");
        Serial.print(activeCrashId);
        Serial.println(" cleared. Stopping uploads.");
        Serial.println();
      }
      accidentActive = false;
      activeCrashId = "";
    }
  } else {
    Serial.print("Firebase read error: ");
    Serial.println(fbdo.errorReason().c_str());
  }
}

// ========================
// UPLOAD VITALS TO FIREBASE
// ========================
void uploadVitals() {
  if (currentBPM == 0 && currentSpO2 == 0) {
    Serial.println("No valid vitals to upload (sensor not on wrist?)");
    return;
  }
  
  if (!firebaseReady || WiFi.status() != WL_CONNECTED) {
    Serial.println("Not connected, skipping upload");
    return;
  }
  
  if (activeCrashId.length() == 0) {
    Serial.println("No active crash ID, skipping upload");
    return;
  }
  
  Serial.print("Uploading vitals to alerts/");
  Serial.print(activeCrashId);
  Serial.println("/patient_vitals...");
  
  // Build path dynamically: alerts/<crashId>/patient_vitals/
  String bpmPath = "alerts/" + activeCrashId + "/patient_vitals/bpm";
  String spo2Path = "alerts/" + activeCrashId + "/patient_vitals/spo2";
  
  bool bpmOK = Firebase.RTDB.setInt(&fbdo, bpmPath.c_str(), currentBPM);
  bool spo2OK = Firebase.RTDB.setInt(&fbdo, spo2Path.c_str(), currentSpO2);
  
  if (bpmOK && spo2OK) {
    Serial.print("  Uploaded to ");
    Serial.print(activeCrashId);
    Serial.print(": BPM=");
    Serial.print(currentBPM);
    Serial.print(", SpO2=");
    Serial.print(currentSpO2);
    Serial.println("%");
  } else {
    Serial.print("  Upload failed: ");
    Serial.println(fbdo.errorReason().c_str());
  }
}

// ========================
// WIFI CONNECTION
// ========================
void connectWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.println();
    Serial.print("WiFi connected! IP: ");
    Serial.println(WiFi.localIP());
  } else {
    wifiConnected = false;
    Serial.println();
    Serial.println("WiFi failed! Will retry later.");
  }
}

// ========================
// FIREBASE SETUP
// ========================
void setupFirebase() {
  Serial.println("Setting up Firebase...");
  
  config.api_key = FIREBASE_API_KEY;
  config.database_url = FIREBASE_DB_URL;
  
  // Anonymous sign-in
  Firebase.signUp(&config, &auth, "", "");
  
  config.token_status_callback = tokenStatusCallback;
  
  Firebase.begin(&config, &auth);
  Firebase.reconnectNetwork(true);
  
  // Wait for Firebase to be ready
  int retries = 0;
  while (!Firebase.ready() && retries < 10) {
    delay(1000);
    retries++;
  }
  
  if (Firebase.ready()) {
    firebaseReady = true;
    Serial.println("Firebase connected!");
  } else {
    firebaseReady = false;
    Serial.println("Firebase not ready, will retry.");
  }
}
