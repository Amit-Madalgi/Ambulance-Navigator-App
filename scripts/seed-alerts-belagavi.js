/**
 * Seed script: Push pre-stored alert entries for Belagavi city.
 * Run with: node scripts/seed-alerts-belagavi.js
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

const alerts = [
  {
    accelMagG: 2.15,
    deviceId: "ESP32-ACCIDENT-07",
    event: "accident",
    gpsValid: 1,
    gyroMagDps: 27.4,
    // heartRate: 0,
    lat: 15.8497,   // Belagavi Fort area
    lng: 74.4977,
    //spo2: 0,
    timestampMs: Date.now(),
  },
  {
    accelMagG: 1.92,
    deviceId: "ESP32-ACCIDENT-08",
    event: "accident",
    gpsValid: 1,
    gyroMagDps: 19.6,
    //heartRate: 0,
    lat: 15.8281,   // Tilakwadi, Belagavi
    lng: 74.5042,
    //spo2: 0,
    timestampMs: Date.now(),
  },
  {
    accelMagG: 3.45,
    deviceId: "ESP32-ACCIDENT-09",
    event: "accident",
    gpsValid: 1,
    gyroMagDps: 52.1,
    //heartRate: 0,
    lat: 15.8672,   // Vadgaon, Belagavi
    lng: 74.5083,
    //spo2: 0,
    timestampMs: Date.now(),
  },
  {
    accelMagG: 1.68,
    deviceId: "ESP32-ACCIDENT-10",
    event: "accident",
    gpsValid: 1,
    gyroMagDps: 14.8,
    //heartRate: 0,
    lat: 15.8143,   // Shahapur, Belagavi
    lng: 74.4892,
    //spo2: 0,
    timestampMs: Date.now(),
  },
  {
    accelMagG: 2.56,
    deviceId: "ESP32-ACCIDENT-11",
    event: "accident",
    gpsValid: 1,
    gyroMagDps: 33.7,
    //heartRate: 0,
    lat: 15.8392,   // College Road / KLE area, Belagavi
    lng: 74.5218,
    //spo2: 0,
    timestampMs: Date.now(),
  },
];

async function seedAlerts() {
  const alertsRef = ref(database, "alerts");
  console.log("Seeding Belagavi alerts to Firebase...\n");

  for (const alert of alerts) {
    const newRef = await push(alertsRef, alert);
    console.log(`✅ Pushed: ${alert.deviceId} @ (${alert.lat}, ${alert.lng}) → key: ${newRef.key}`);
  }

  console.log(`\n🎉 Done! ${alerts.length} Belagavi alerts seeded.`);
  process.exit(0);
}

seedAlerts().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
