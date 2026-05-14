/*
 * ============================================
 * MAX30102 WRIST MODE - IMPROVED ACCURACY
 * ============================================
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
 * ============================================
 */

#include <Wire.h>
#include "MAX30105.h"
#include "spo2_algorithm.h"

MAX30105 particleSensor;

#define SDA_PIN  8
#define SCL_PIN  9

// SpO2 algorithm buffers
#define BUFFER_LENGTH 100
uint32_t irBuffer[BUFFER_LENGTH];
uint32_t redBuffer[BUFFER_LENGTH];
int32_t spo2Value;
int8_t  validSPO2;
int32_t heartRateValue;
int8_t  validHeartRate;

void setup() {
  Serial.begin(115200);
  while (!Serial) { delay(10); }
  delay(3000);
  
  Serial.println();
  Serial.println("=========================================");
  Serial.println("  MAX30102 WRIST MODE - ACCURATE VERSION");
  Serial.println("=========================================");
  Serial.println();
  
  Wire.begin(SDA_PIN, SCL_PIN);
  delay(500);
  
  // Scan for sensor
  Serial.println("Scanning I2C bus...");
  bool found = false;
  while (!found) {
    for (byte addr = 1; addr < 127; addr++) {
      Wire.beginTransmission(addr);
      if (Wire.endTransmission() == 0 && addr == 0x57) {
        Serial.println("  MAX30102 found!");
        found = true;
      }
    }
    if (!found) {
      Serial.println("  Not found, retrying in 3s...");
      delay(3000);
    }
  }
  
  // Initialize sensor
  Serial.print("Initializing... ");
  while (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("retrying...");
    delay(2000);
  }
  Serial.println("OK!");
  
  // ============================================
  // WRIST-OPTIMIZED SETTINGS
  // ============================================
  byte ledBrightness = 0x1F;  // Low power (your sensor saturates easily)
  byte sampleAverage = 4;     // Average 4 samples
  byte ledMode = 2;           // Red + IR
  int sampleRate = 100;       // 100 samples/sec
  int pulseWidth = 411;       // Max resolution
  
  particleSensor.setup(ledBrightness, sampleAverage, ledMode, sampleRate, pulseWidth);
  
  Serial.println();
  Serial.println("=========================================");
  Serial.println("  READY! Strap sensor to wrist.");
  Serial.println("  Keep still. Takes 5-10 sec per reading.");
  Serial.println("=========================================");
  Serial.println();
}

void loop() {
  // ============================================
  // STEP 1: Collect 100 samples (takes ~4 sec)
  // ============================================
  Serial.println("Collecting samples... keep wrist still");
  
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
    Serial.println("Not on wrist! Strap sensor to skin.");
    Serial.println();
    delay(1000);
    return;
  }
  
  // ============================================
  // STEP 2: Calculate BPM and SpO2 using the
  //         SparkFun algorithm (much more accurate
  //         than checkForBeat for wrist)
  // ============================================
  maxim_heart_rate_and_oxygen_saturation(
    irBuffer, BUFFER_LENGTH,
    redBuffer,
    &spo2Value, &validSPO2,
    &heartRateValue, &validHeartRate
  );
  
  // ============================================
  // STEP 3: Display results
  // ============================================
  Serial.print("IR_avg=");
  Serial.print(avgIR);
  
  if (validHeartRate == 1 && heartRateValue > 40 && heartRateValue < 180) {
    Serial.print(" | BPM=");
    Serial.print(heartRateValue);
    Serial.print(" ✅");
  } else {
    Serial.print(" | BPM=--- (no valid beat detected)");
  }
  
  if (validSPO2 == 1 && spo2Value > 0 && spo2Value <= 100) {
    Serial.print(" | SpO2=");
    Serial.print(spo2Value);
    Serial.print("% ✅");
  } else {
    Serial.print(" | SpO2=--- (calculating...)");
  }
  
  // Signal quality
  Serial.print(" | Signal: ");
  if (avgIR > 100000) {
    Serial.print("SATURATED-reduce brightness");
  } else if (avgIR > 30000) {
    Serial.print("STRONG");
  } else if (avgIR > 10000) {
    Serial.print("OK");
  } else {
    Serial.print("WEAK-press tighter");
  }
  
  Serial.println();
  Serial.println();
  
  // Small pause before next reading cycle
  delay(500);
}
