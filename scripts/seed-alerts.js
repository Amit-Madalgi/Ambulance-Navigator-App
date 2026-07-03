/**
 * Seed script: Push multiple pre-stored alert entries to Firebase Realtime Database.
 * Run with: node scripts/seed-alerts.js
 */

const { initializeApp } = require("firebase/app");
const { getDatabase, ref, push } = require("firebase/database");

const firebaseConfig = {
  apiKey: "AIzaSyDVPGwdzVXFFQSUlJC_11rEW_OQrBqnK5w",
  authDomain: "emergency-response-syste-ba2ce.firebaseapp.com",
  databaseURL: "https://emergency-response-syste-ba2ce-default-rtdb.firebaseio.com",
  projectId: "emergency-response-syste-ba2ce",
  storageBucket: "emergency-response-syste-ba2ce.firebasestorage.app",
  messagingSenderId: "349489495972",
  appId: "1:349489495972:web:a48056a37cc9601a2acb31",
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Pre-stored alerts at different locations
const alerts = [
  {
    accelMagG: 2.34,
    deviceId: "ESP32-ACCIDENT-02",
    event: "accident",
    gpsValid: 1,
    gyroMagDps: 31.5,
    heartRate: 0,
    lat: 12.9716,   // MG Road, Bengaluru
    lng: 77.5946,
    spo2: 0,
    timestampMs: Date.now() - 60000, // 1 minute ago
  },
  {
    accelMagG: 1.89,
    deviceId: "ESP32-ACCIDENT-03",
    event: "accident",
    gpsValid: 1,
    gyroMagDps: 18.2,
    heartRate: 0,
    lat: 12.9352,   // Koramangala, Bengaluru
    lng: 77.6245,
    spo2: 0,
    timestampMs: Date.now() - 120000, // 2 minutes ago
  },
  {
    accelMagG: 3.12,
    deviceId: "ESP32-ACCIDENT-04",
    event: "accident",
    gpsValid: 1,
    gyroMagDps: 45.8,
    heartRate: 0,
    lat: 12.8456,   // Electronic City, Bengaluru
    lng: 77.6603,
    spo2: 0,
    timestampMs: Date.now() - 90000, // 1.5 minutes ago
  },
  {
    accelMagG: 1.45,
    deviceId: "ESP32-ACCIDENT-05",
    event: "accident",
    gpsValid: 1,
    gyroMagDps: 12.3,
    heartRate: 0,
    lat: 13.0358,   // Hebbal, Bengaluru
    lng: 77.5970,
    spo2: 0,
    timestampMs: Date.now() - 30000, // 30 seconds ago
  },
  {
    accelMagG: 2.78,
    deviceId: "ESP32-ACCIDENT-06",
    event: "accident",
    gpsValid: 1,
    gyroMagDps: 38.1,
    heartRate: 0,
    lat: 12.9719,   // Indiranagar, Bengaluru
    lng: 77.6412,
    spo2: 0,
    timestampMs: Date.now() - 45000, // 45 seconds ago
  },
];

async function seedAlerts() {
  const alertsRef = ref(database, "alerts");

  console.log("Seeding alerts to Firebase...\n");

  for (const alert of alerts) {
    const newRef = await push(alertsRef, alert);
    console.log(`✅ Pushed alert: ${alert.deviceId} @ (${alert.lat}, ${alert.lng}) → key: ${newRef.key}`);
  }

  console.log(`\n🎉 Done! ${alerts.length} alerts seeded.`);
  process.exit(0);
}

seedAlerts().catch((err) => {
  console.error("❌ Error seeding alerts:", err);
  process.exit(1);
});
