# 🩺 Wearable Health Monitor - XIAO ESP32S3 + MAX30102

## Wiring Diagram

```
MAX30102          XIAO ESP32S3
────────          ─────────────
VIN  ──────────>  3.3V
GND  ──────────>  GND
SDA  ──────────>  GPIO5 (D4)
SCL  ──────────>  GPIO6 (D5)


LiPo Battery ──> TP4056 ──> XIAO ESP32S3 (BAT+ / BAT-)
```

## Arduino IDE Setup (Step by Step)

### Step 1: Install ESP32 Board Support
1. Open Arduino IDE
2. Go to **File → Preferences**
3. In "Additional Board Manager URLs" paste:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
4. Go to **Tools → Board → Boards Manager**
5. Search **"esp32"** and install **"esp32 by Espressif Systems"**

### Step 2: Select Board
1. Go to **Tools → Board → ESP32 Arduino**
2. Select **"XIAO_ESP32S3"**
3. Connect XIAO ESP32S3 via USB-C
4. Go to **Tools → Port** and select the COM port that appears

### Step 3: Install Libraries
Go to **Sketch → Include Library → Manage Libraries** and install:

| Library Name | Author |
|-------------|--------|
| **SparkFun MAX3010x Pulse and Proximity Sensor Library** | SparkFun |
| **Firebase Arduino Client Library for ESP32 and ESP8266** | Mobizt |

### Step 4: Edit WiFi Credentials
Open `wearable_health_monitor.ino` and change:
```c
#define WIFI_SSID       "YOUR_WIFI_NAME"
#define WIFI_PASSWORD   "YOUR_WIFI_PASSWORD"
```

### Step 5: Upload
1. Click the **Upload** button (→ arrow)
2. Open **Serial Monitor** (Tools → Serial Monitor, set 115200 baud)
3. Place finger on MAX30102 sensor
4. You should see BPM and SpO2 readings

## Firebase Data Structure

The code writes to these paths:

```
Firebase Realtime Database
│
├── alerts/
│   └── crash_001/
│       └── patient_vitals/
│           ├── bpm: 75          ← Updated by wearable
│           └── spo2: 98         ← Updated by wearable
│
└── wearable/
    └── latest/
        ├── bpm: 75
        ├── spo2: 98
        ├── timestamp: 1714060800
        ├── device: "XIAO_ESP32S3"
        └── finger_detected: true
```

## Firebase Rules

Make sure your Firebase Realtime Database rules allow writing.
For testing, you can use (NOT for production):

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "MAX30102 not found" | Check wiring: SDA→GPIO5, SCL→GPIO6, VIN→3.3V |
| BPM shows 0 | Place finger firmly on sensor, don't press too hard |
| SpO2 shows 0 | Wait 10-15 seconds for algorithm to calculate |
| WiFi not connecting | Check SSID and password, make sure 2.4GHz WiFi |
| Firebase upload fails | Check API key and database URL, check rules |
| COM port not showing | Install USB driver for ESP32S3 (CP2102 or CH340) |
