import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { Toast, ToastTitle, useToast } from "@/components/ui/toast";
import { VStack } from "@/components/ui/vstack";
import { auth, database } from "@/firebaseConfig";
import { useBLE } from "@/hooks/useBLEVitals";
import { CommonActions, useNavigation } from "@react-navigation/native";
import { router } from "expo-router";
import { signOut } from "firebase/auth";
import { onValue, ref, remove, update } from "firebase/database";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, ScrollView, View } from "react-native";
import * as Location from "expo-location";

// Alerts auto-expire after 5 minutes if not accepted
const ALERT_EXPIRY_MS = 5 * 60 * 1000;


type Alert = {
  id: string;
  accelMagG: number;
  deviceId: string;
  event: string;
  gpsValid: number;
  gyroMagDps: number;
  heartRate: number;
  lat: number;
  lng: number;
  spo2: number;
  timestampMs: number;
  status?: string;
  patient_vitals?: {
    hr: number;
    spo2: number;
    timestamp: number;
  };
};

function getPredefinedMockLocation(lat: number, lng: number): string {
  const knownLocations = [
    { name: "Columbia University Medical Center, NY", lat: 40.8424, lng: -73.9430 },
    { name: "Central Park, NY", lat: 40.7851, lng: -73.9683 },
    { name: "Times Square, NY", lat: 40.7588, lng: -73.9851 },
    { name: "Stanford University, CA", lat: 37.4275, lng: -122.1697 },
    { name: "Golden Gate Bridge, CA", lat: 37.8199, lng: -122.4783 },
    { name: "Kempegowda International Airport, Bengaluru", lat: 13.1986, lng: 77.7066 },
    { name: "MG Road, Bengaluru", lat: 12.9754, lng: 77.6068 },
    { name: "Indiranagar, Bengaluru", lat: 12.9719, lng: 77.6412 },
    { name: "Electronic City, Bengaluru", lat: 12.8452, lng: 77.6602 },
  ];

  let minDistance = Infinity;
  let nearest = "Unknown Landmark";

  knownLocations.forEach((loc) => {
    const d = Math.sqrt(Math.pow(loc.lat - lat, 2) + Math.pow(loc.lng - lng, 2));
    if (d < minDistance) {
      minDistance = d;
      nearest = loc.name;
    }
  });

  if (minDistance > 1.5) {
    return `Area near ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
  return nearest;
}

export default function HomeScreen() {
  const toast = useToast();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [now, setNow] = useState(Date.now());
  const previousAlertIds = useRef<Set<string>>(new Set());
  const preExistingAlertIds = useRef<Set<string>>(new Set());
  const isFirstLoad = useRef(true);
  const navigation = useNavigation();

  // BLE wearable connection (auto-started by BLEProvider at the root level)
  const ble = useBLE();

  // Nearest Location Name Cache
  const [locationNames, setLocationNames] = useState<Record<string, string>>({});

  useEffect(() => {
    alerts.forEach(async (alert) => {
      if (alert.gpsValid && !locationNames[alert.id]) {
        // 1. Try Native Geocoder (expo-location)
        try {
          const response = await Location.reverseGeocodeAsync({
            latitude: alert.lat,
            longitude: alert.lng,
          });
          if (response && response.length > 0) {
            const place = response[0];
            const name = [
              place.name,
              place.street,
              place.subregion || place.city,
              place.region,
            ]
              .filter(Boolean)
              .join(", ");
            if (name) {
              setLocationNames((prev) => ({ ...prev, [alert.id]: name }));
              return;
            }
          }
        } catch (err) {
          console.warn("Failed to reverse geocode using expo-location:", err);
        }

        // 2. Try Nominatim (Web-friendly & Native-friendly free API)
        try {
          const osmUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${alert.lat}&lon=${alert.lng}&zoom=18&addressdetails=1`;
          const response = await fetch(osmUrl, {
            headers: {
              "User-Agent": "AmbulanceNavigatorApp/1.0",
            },
          });
          const data = await response.json();
          if (data && data.display_name) {
            const parts = data.display_name.split(",");
            const shortName = parts.slice(0, 3).join(",").trim();
            setLocationNames((prev) => ({ ...prev, [alert.id]: shortName }));
            return;
          }
        } catch (err) {
          console.warn("Failed to reverse geocode using Nominatim:", err);
        }

        // 3. Fallback to predefined closest mock landmark
        const mockLocation = getPredefinedMockLocation(alert.lat, alert.lng);
        setLocationNames((prev) => ({ ...prev, [alert.id]: mockLocation }));
      }
    });
  }, [alerts, locationNames]);

  // Tick every second for live countdown / elapsed time
  useEffect(() => {
    const ticker = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(ticker);
  }, []);

  useEffect(() => {
    const alertsRef = ref(database, "alerts");
    const unsubscribe = onValue(alertsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const alertsList: Alert[] = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));
        // Sort by newest first
        alertsList.sort((a, b) => b.timestampMs - a.timestampMs);
        setAlerts(alertsList);

        if (isFirstLoad.current) {
          // First load — record all existing alert IDs so they are exempt from timer
          preExistingAlertIds.current = new Set(alertsList.map((a) => a.id));
          isFirstLoad.current = false;
        } else {
          // Auto-disable expired NEW alerts only (skip pre-existing ones)
          const currentTime = Date.now();
          alertsList.forEach((alert) => {
            if (
              !preExistingAlertIds.current.has(alert.id) &&
              alert.status !== "accepted" &&
              alert.status !== "expired" &&
              (currentTime - alert.timestampMs) >= ALERT_EXPIRY_MS
            ) {
              update(ref(database, `alerts/${alert.id}`), { status: "expired" }).catch(console.error);
            }
          });
        }

        // (System-level notifications are now handled globally by useNotifications)
      } else {
        setAlerts([]);
        previousAlertIds.current = new Set();
      }
    });

    return () => unsubscribe();
  }, [toast]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      if (Platform.OS === "web") {
        window.location.href = "/";
      } else {
        // Get the parent Stack navigator and reset it to the login screen
        const parent = navigation.getParent();
        if (parent) {
          parent.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: "index" }],
            }),
          );
        } else {
          // Fallback
          router.replace("/");
        }
      }
    } catch (error: any) {
      console.error("Logout error:", error);
      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast nativeID={id} action="error" variant="solid" className="mt-12">
            <ToastTitle>{error.message || "Failed to logout"}</ToastTitle>
          </Toast>
        ),
      });
    }
  };

  const handleAccept = async (alert: Alert) => {
    try {
      await update(ref(database, `alerts/${alert.id}`), {
        status: "accepted",
      });

      // Bind wearable vitals to this crash ID
      ble.setActiveCrashId(alert.id);

      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast
            nativeID={id}
            action="success"
            variant="solid"
            className="mt-12"
          >
            <ToastTitle>Alert Accepted — Opening Navigation</ToastTitle>
          </Toast>
        ),
      });

      // Navigate to in-app map screen with the alert coordinates and ID
      router.push(`/map?lat=${alert.lat}&lng=${alert.lng}&id=${alert.id}`);
    } catch (error) {
      console.error(error);
      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast nativeID={id} action="error" variant="solid" className="mt-12">
            <ToastTitle>Failed to accept alert</ToastTitle>
          </Toast>
        ),
      });
    }
  };

  const handleDecline = async (alertId: string) => {
    try {
      await remove(ref(database, `alerts/${alertId}`));
      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast nativeID={id} action="info" variant="solid" className="mt-12">
            <ToastTitle>Alert Declined &amp; Removed</ToastTitle>
          </Toast>
        ),
      });
    } catch (error) {
      console.error(error);
    }
  };

  // Format helpers for timer display
  const formatElapsed = useCallback((timestampMs: number) => {
    const diffSec = Math.max(0, Math.floor((now - timestampMs) / 1000));
    if (diffSec < 60) return `${diffSec}s ago`;
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    return `${mins}m ${secs}s ago`;
  }, [now]);

  const formatCountdown = useCallback((timestampMs: number) => {
    const remainMs = Math.max(0, ALERT_EXPIRY_MS - (now - timestampMs));
    const mins = Math.floor(remainMs / 60000);
    const secs = Math.floor((remainMs % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, [now]);

  const getCountdownUrgency = useCallback((timestampMs: number) => {
    const remainMs = ALERT_EXPIRY_MS - (now - timestampMs);
    if (remainMs <= 60000) return "critical"; // last 1 min
    if (remainMs <= 120000) return "warning"; // last 2 min
    return "normal";
  }, [now]);

  // Show all alerts — expired ones are displayed as disabled instead of being hidden
  const activeAlerts = alerts;

  return (
    <View style={{ flex: 1 }} className="bg-background-light pt-12 px-4">
      <View className="mb-6">
        <View className="flex-row justify-between items-center">
          <Heading size="2xl" className="text-secondary-800 flex-shrink">
            Live Alerts
          </Heading>
          <Button size="sm" variant="outline" onPress={handleLogout}>
            <ButtonText>Logout</ButtonText>
          </Button>
        </View>
        <View className="flex-row items-center mt-2">
          <View className={`px-2 py-1 rounded-md ${ble.isConnected ? 'bg-success-100 border border-success-200' : (ble.isScanning ? 'bg-warning-100 border border-warning-200' : 'bg-error-100 border border-error-200')}`}>
            <Text className={`text-[10px] font-bold uppercase tracking-wider ${ble.isConnected ? 'text-success-700' : (ble.isScanning ? 'text-warning-700' : 'text-error-700')}`}>
              {ble.isConnected ? "🟢 Watch Connected" : (ble.isScanning ? "🟡 Scanning Watch..." : "🔴 Watch Offline")}
            </Text>
          </View>
        </View>
      </View>

      {activeAlerts.length === 0 ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-secondary-500">
            No active alerts right now.
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <VStack space="md" className="pb-8">
            {activeAlerts.map((alert) => {
              const isAccepted = alert.status === "accepted";
              const isExpired = alert.status === "expired";
              const isPreExisting = preExistingAlertIds.current.has(alert.id);
              const hasTimer = !isAccepted && !isExpired && !isPreExisting;
              const urgency = hasTimer ? getCountdownUrgency(alert.timestampMs) : "normal";
              return (
                <View
                  key={alert.id}
                  className={`bg-white rounded-xl p-4 shadow-soft-1 border ${isAccepted || isExpired ? "border-outline-100 opacity-60" : urgency === "critical" ? "border-error-300" : "border-outline-100"}`}
                >
                  <View className="flex-row justify-between items-start mb-2">
                    <VStack>
                      <Heading
                        size="md"
                        className="text-error-600 uppercase tracking-widest"
                      >
                        {alert.event}
                      </Heading>
                      <Text size="sm" className="text-secondary-500 font-bold">
                        {alert.deviceId}
                      </Text>
                    </VStack>
                    <VStack className="items-end">
                      <Text size="xs" className="text-secondary-400">
                        {new Date(alert.timestampMs).toLocaleTimeString()}
                      </Text>
                      <Text size="xs" className="text-secondary-500 font-medium mt-0.5">
                        {"⏱ "}{formatElapsed(alert.timestampMs)}
                      </Text>
                    </VStack>
                  </View>

                  {/* Countdown timer — only for pending alerts */}
                  {hasTimer && (
                    <View className={`flex-row items-center justify-between px-3 py-2 rounded-lg mb-2 ${urgency === "critical" ? "bg-error-50 border border-error-200" : urgency === "warning" ? "bg-warning-50 border border-warning-200" : "bg-secondary-50 border border-outline-100"}`}>
                      <Text className={`text-[10px] font-bold uppercase tracking-wider ${urgency === "critical" ? "text-error-600" : urgency === "warning" ? "text-warning-700" : "text-secondary-500"}`}>
                        {urgency === "critical" ? "⚠ Expiring Soon" : "Expires In"}
                      </Text>
                      <Text className={`text-sm font-black tabular-nums ${urgency === "critical" ? "text-error-600" : urgency === "warning" ? "text-warning-700" : "text-secondary-700"}`}>
                        {formatCountdown(alert.timestampMs)}
                      </Text>
                    </View>
                  )}

                  <View className="flex-row gap-3 my-3 flex-wrap">
                    {/* BPM and SpO2 are commented out per instructions
                    <View className="bg-error-50 px-3 py-1.5 rounded-md">
                      <Text size="sm" className="text-error-700 font-medium">
                        BPM: {alert.patient_vitals?.hr ?? alert.heartRate}
                      </Text>
                    </View>
                    <View className="bg-info-50 px-3 py-1.5 rounded-md">
                      <Text size="sm" className="text-info-700 font-medium">
                        SpO2: {alert.patient_vitals?.spo2 ?? alert.spo2}%
                      </Text>
                    </View>
                    */}
                    <View className="bg-success-50 px-3 py-1.5 rounded-md">
                      <Text size="sm" className="text-success-700 font-medium">
                        GPS:{" "}
                        {alert.gpsValid
                          ? `${alert.lat.toFixed(4)}, ${alert.lng.toFixed(4)}`
                          : "Invalid"}
                      </Text>
                    </View>
                  </View>

                  {alert.gpsValid && (
                    <View className="mt-1 bg-secondary-50 p-3 rounded-lg border border-outline-100 flex-row items-center gap-2">
                      <Text size="xs" className="text-secondary-600 font-semibold uppercase tracking-wider">
                        Near:
                      </Text>
                      <Text size="sm" className="text-secondary-800 font-medium flex-1">
                        {locationNames[alert.id] || "Resolving location..."}
                      </Text>
                    </View>
                  )}

                  <View className="flex-row gap-2 mt-2 pt-3 border-t border-outline-100 justify-end">
                    {isAccepted ? (
                      <Text className="text-secondary-500 font-medium mr-2 mt-2">
                        Accepted
                      </Text>
                    ) : isExpired ? (
                      <Text className="text-error-400 font-medium mr-2 mt-2">
                        Expired
                      </Text>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          action="secondary"
                          onPress={() => handleDecline(alert.id)}
                        >
                          <ButtonText>Decline</ButtonText>
                        </Button>
                        <Button
                          size="sm"
                          action="positive"
                          onPress={() => handleAccept(alert)}
                        >
                          <ButtonText>Accept</ButtonText>
                        </Button>
                      </>
                    )}
                  </View>
                </View>
              );
            })}
          </VStack>
        </ScrollView>
      )}
    </View>
  );
}
