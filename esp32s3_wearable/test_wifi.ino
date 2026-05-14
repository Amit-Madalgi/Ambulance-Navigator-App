#include <WiFi.h>

const char* ssid = "realme 13 Pro 5G";
const char* password = "x8gsiit5";

void setup() {
  Serial.begin(115200);
  delay(3000);
  Serial.println("Connecting...");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.println("Connected!");
  Serial.println(WiFi.localIP());
}

void loop() {
}
