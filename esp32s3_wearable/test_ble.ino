/*
 * ============================================================
 * BLE TEST - XIAO ESP32-S3
 * ============================================================
 * 
 * Tests BLE connectivity from XIAO ESP32-S3.
 * Sends simulated vitals (BPM, SpO2) every 2 seconds.
 * 
 * HOW TO TEST:
 *   1. Upload this sketch to XIAO ESP32-S3
 *   2. Open Serial Monitor at 115200 baud
 *   3. On your phone, install "Serial Bluetooth Terminal" from Play Store
 *   4. Open the app → Menu (☰) → Devices → BLE tab
 *   5. Scan and find "HealthMonitor_ESP32" 
 *   6. Tap it to connect
 *   7. You should see vitals data streaming in the terminal
 * 
 * BLE Service:   Custom UUID for Health Monitor
 * Characteristic: Sends vitals as text "BPM:72,SpO2:98"
 *                 Also supports NOTIFY so data pushes automatically
 * 
 * Board: XIAO_ESP32S3 (any board package version)
 * Tools -> USB CDC On Boot: ENABLED
 * Serial Monitor: 115200 baud
 * No external libraries needed - uses built-in BLE
 * ============================================================
 */

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// ========================
// BLE UUIDs
// ========================
// Custom UUIDs for our Health Monitor service
#define SERVICE_UUID        "12345678-1234-5678-1234-56789abcdef0"
#define VITALS_CHAR_UUID    "12345678-1234-5678-1234-56789abcdef1"  // Sends vitals data
#define COMMAND_CHAR_UUID   "12345678-1234-5678-1234-56789abcdef2"  // Receives commands from phone

// ========================
// BLE OBJECTS
// ========================
BLEServer*         pServer = NULL;
BLECharacteristic* pVitalsCharacteristic = NULL;
BLECharacteristic* pCommandCharacteristic = NULL;
BLEAdvertising*    pAdvertising = NULL;

// ========================
// STATE
// ========================
bool deviceConnected = false;
bool oldDeviceConnected = false;
unsigned long lastSendTime = 0;
int messageCount = 0;

// Simulated vitals (will be replaced with real MAX30102 data later)
int simBPM = 72;
int simSpO2 = 97;

// ========================
// BLE SERVER CALLBACKS
// ========================
class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    deviceConnected = true;
    Serial.println();
    Serial.println("========================================");
    Serial.println("  PHONE CONNECTED via BLE!");
    Serial.println("========================================");
    Serial.println();
  }

  void onDisconnect(BLEServer* pServer) {
    deviceConnected = false;
    Serial.println();
    Serial.println("========================================");
    Serial.println("  PHONE DISCONNECTED");
    Serial.println("  Restarting advertising...");
    Serial.println("========================================");
    Serial.println();
  }
};

// ========================
// COMMAND CHARACTERISTIC CALLBACK
// ========================
// This handles data SENT FROM the phone TO the ESP32
class CommandCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* pCharacteristic) {
    String value = pCharacteristic->getValue().c_str();
    
    if (value.length() > 0) {
      Serial.print("Received from phone: ");
      Serial.println(value);
      
      // Example commands the phone app could send:
      if (value == "STATUS") {
        // Send back a status message
        String status = "OK:Connected,Uptime:" + String(millis() / 1000) + "s";
        pVitalsCharacteristic->setValue(status.c_str());
        pVitalsCharacteristic->notify();
        Serial.println("  -> Sent status response");
      }
      else if (value == "PING") {
        pVitalsCharacteristic->setValue("PONG");
        pVitalsCharacteristic->notify();
        Serial.println("  -> Sent PONG");
      }
      else {
        // Echo back anything else
        String echo = "ECHO:" + value;
        pVitalsCharacteristic->setValue(echo.c_str());
        pVitalsCharacteristic->notify();
        Serial.println("  -> Echoed back");
      }
    }
  }
};

// ========================
// SETUP
// ========================
void setup() {
  Serial.begin(115200);
  while (!Serial) { delay(10); }
  delay(3000);
  
  Serial.println();
  Serial.println("=============================================");
  Serial.println("  BLE TEST - XIAO ESP32-S3");
  Serial.println("  Health Monitor Bluetooth Test");
  Serial.println("=============================================");
  Serial.println();
  
  // ---- Initialize BLE ----
  Serial.println("Initializing BLE...");
  BLEDevice::init("HealthMonitor_ESP32");
  
  // Create BLE Server
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());
  Serial.println("  BLE Server created");
  
  // Create BLE Service
  BLEService* pService = pServer->createService(SERVICE_UUID);
  Serial.println("  BLE Service created");
  
  // ---- Create VITALS Characteristic (ESP32 -> Phone) ----
  // Properties: READ + NOTIFY
  // Phone can read current value, and gets auto-notified of changes
  pVitalsCharacteristic = pService->createCharacteristic(
    VITALS_CHAR_UUID,
    BLECharacteristic::PROPERTY_READ   |
    BLECharacteristic::PROPERTY_NOTIFY
  );
  
  // Add Client Characteristic Configuration Descriptor (required for NOTIFY)
  pVitalsCharacteristic->addDescriptor(new BLE2902());
  pVitalsCharacteristic->setValue("Waiting for connection...");
  Serial.println("  Vitals characteristic created (READ + NOTIFY)");
  
  // ---- Create COMMAND Characteristic (Phone -> ESP32) ----
  // Properties: WRITE
  // Phone can send commands/data to ESP32
  pCommandCharacteristic = pService->createCharacteristic(
    COMMAND_CHAR_UUID,
    BLECharacteristic::PROPERTY_WRITE
  );
  pCommandCharacteristic->setCallbacks(new CommandCallbacks());
  Serial.println("  Command characteristic created (WRITE)");
  
  // ---- Start Service ----
  pService->start();
  Serial.println("  BLE Service started");
  
  // ---- Start Advertising ----
  pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  
  // These settings help with iPhone compatibility
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);
  
  BLEDevice::startAdvertising();
  
  Serial.println();
  Serial.println("=============================================");
  Serial.println("  BLE READY! Device name: HealthMonitor_ESP32");
  Serial.println("=============================================");
  Serial.println();
  Serial.println("INSTRUCTIONS:");
  Serial.println("  1. Open 'Serial Bluetooth Terminal' app on phone");
  Serial.println("  2. Go to Menu -> Devices -> BLE tab");
  Serial.println("  3. Tap SCAN");
  Serial.println("  4. Find 'HealthMonitor_ESP32' and tap to connect");
  Serial.println("  5. You should see vitals data appearing!");
  Serial.println();
  Serial.println("COMMANDS you can type in the app:");
  Serial.println("  PING   -> responds with PONG");
  Serial.println("  STATUS -> responds with device status");
  Serial.println("  (anything else gets echoed back)");
  Serial.println();
  Serial.println("Waiting for BLE connection...");
}

// ========================
// MAIN LOOP
// ========================
void loop() {
  // ---- When connected: Send vitals every 2 seconds ----
  if (deviceConnected) {
    if (millis() - lastSendTime >= 2000) {
      lastSendTime = millis();
      messageCount++;
      
      // Simulate slight variation in vitals
      simBPM = 70 + random(-5, 6);    // 65-75 BPM range
      simSpO2 = 97 + random(-1, 2);   // 96-98 SpO2 range
      
      // Format: "BPM:72,SpO2:98"
      // This format is easy to parse in MIT App Inventor later
      String vitalsData = "BPM:" + String(simBPM) + ",SpO2:" + String(simSpO2);
      
      // Send via BLE notification
      pVitalsCharacteristic->setValue(vitalsData.c_str());
      pVitalsCharacteristic->notify();
      
      // Also print to Serial Monitor
      Serial.print("[#");
      Serial.print(messageCount);
      Serial.print("] Sent via BLE -> ");
      Serial.println(vitalsData);
    }
  }
  
  // ---- Handle reconnection ----
  // If device was connected but now disconnected, restart advertising
  if (!deviceConnected && oldDeviceConnected) {
    delay(500);  // Give BLE stack time to get ready
    pServer->startAdvertising();
    Serial.println("Advertising restarted, waiting for connection...");
    oldDeviceConnected = deviceConnected;
  }
  
  // If device just connected
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
  }
  
  delay(10);  // Small delay to prevent watchdog issues
}
