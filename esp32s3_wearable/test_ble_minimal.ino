/*
 * MINIMAL BLE TEST - XIAO ESP32-S3
 * 
 * Bare minimum BLE sketch to verify Bluetooth works.
 * If this crashes too, it's a partition/board config issue.
 * 
 * Arduino IDE Settings:
 *   Board:              XIAO_ESP32S3
 *   USB CDC On Boot:    Enabled
 *   Partition Scheme:   No OTA (2MB APP/2MB SPIFFS)
 *   Erase All Flash:    Enabled (for first upload)
 *   Port:               Your COM port
 */

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

#define SERVICE_UUID        "181A"  // Environmental Sensing (standard UUID, smaller)
#define CHARACTERISTIC_UUID "2A6E"  // Temperature (standard UUID)

BLEServer* pServer = NULL;
BLECharacteristic* pCharacteristic = NULL;
bool connected = false;
int counter = 0;

class MyCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* s)    { connected = true;  Serial.println(">>> CONNECTED!"); }
  void onDisconnect(BLEServer* s) { connected = false; Serial.println(">>> DISCONNECTED"); }
};

void setup() {
  Serial.begin(115200);
  delay(3000);
  
  Serial.println("=== MINIMAL BLE TEST ===");
  Serial.println("Starting BLE...");
  
  BLEDevice::init("ESP32_BLE_Test");
  Serial.println("BLE init OK");
  
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyCallbacks());
  Serial.println("Server created OK");
  
  BLEService* pService = pServer->createService(SERVICE_UUID);
  Serial.println("Service created OK");
  
  pCharacteristic = pService->createCharacteristic(
    CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );
  pCharacteristic->addDescriptor(new BLE2902());
  Serial.println("Characteristic created OK");
  
  pService->start();
  Serial.println("Service started OK");
  
  BLEDevice::getAdvertising()->addServiceUUID(SERVICE_UUID);
  BLEDevice::startAdvertising();
  
  Serial.println();
  Serial.println("===========================");
  Serial.println("BLE READY: ESP32_BLE_Test");
  Serial.println("===========================");
  Serial.println("Open Serial Bluetooth Terminal app");
  Serial.println("Go to Devices -> BLE -> Scan");
  Serial.println("Connect to 'ESP32_BLE_Test'");
}

void loop() {
  if (connected) {
    counter++;
    String msg = "BPM:72,SpO2:98,#" + String(counter);
    pCharacteristic->setValue(msg.c_str());
    pCharacteristic->notify();
    Serial.println("Sent: " + msg);
  }
  
  // Restart advertising after disconnect
  if (!connected) {
    delay(500);
    pServer->startAdvertising();
  }
  
  delay(2000);
}
