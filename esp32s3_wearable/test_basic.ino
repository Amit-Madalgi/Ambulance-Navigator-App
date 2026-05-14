/*
 * BARE MINIMUM TEST - XIAO ESP32-S3
 * 
 * Tests if the board can even run code without crashing.
 * No WiFi, no BLE, no sensors - just Serial output + LED blink.
 * 
 * If this ALSO crashes -> hardware/bootloader issue
 * If this WORKS -> the crash is caused by WiFi/BLE stack
 * 
 * Settings:
 *   Board:            XIAO_ESP32S3
 *   USB CDC On Boot:  Enabled
 *   Core Debug Level: Verbose  <-- CHANGE THIS to see crash details
 *   Erase All Flash:  Enabled
 */

#define LED_PIN 21  // Built-in LED on XIAO ESP32S3

void setup() {
  Serial.begin(115200);
  delay(3000);
  
  pinMode(LED_PIN, OUTPUT);
  
  Serial.println();
  Serial.println("===========================");
  Serial.println("  BASIC TEST - NO WIRELESS");
  Serial.println("  If you see this, board is OK!");
  Serial.println("===========================");
  Serial.println();
}

void loop() {
  Serial.print("Running... uptime: ");
  Serial.print(millis() / 1000);
  Serial.println(" seconds");
  
  // Blink LED
  digitalWrite(LED_PIN, HIGH);
  delay(500);
  digitalWrite(LED_PIN, LOW);
  delay(500);
}
