import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { Toast, ToastTitle, useToast } from "@/components/ui/toast";
import { VStack } from "@/components/ui/vstack";
import { auth, database } from "@/firebaseConfig";
import { useBLEVitals } from "@/hooks/useBLEVitals";
import { CommonActions, useNavigation } from "@react-navigation/native";
import { router } from "expo-router";
import { signOut } from "firebase/auth";
import { onValue, ref, remove, update } from "firebase/database";
import React, { useEffect, useRef, useState } from "react";
import { Platform, ScrollView, View } from "react-native";
import * as Location from "expo-location";


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
  const previousAlertIds = useRef<Set<string>>(new Set());
  const navigation = useNavigation();

  // BLE wearable connection
  const ble = useBLEVitals();

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

        // Check for new alerts and show in-app notification
        const currentAlertIds = new Set(alertsList.map((a) => a.id));
        if (previousAlertIds.current.size > 0) {
          const newAlerts = alertsList.filter(
            (a) => !previousAlertIds.current.has(a.id),
          );
          newAlerts.forEach((newAlert) => {
            toast.show({
              placement: "top",
              duration: 6000,
              render: ({ id }) => (
                <Toast
                  nativeID={id}
                  action="error"
                  variant="solid"
                  className="mt-12"
                >
                  <ToastTitle>
                    {"\u{1F6A8}"} NEW: {newAlert.event.toUpperCase()} —{" "}
                    {newAlert.deviceId}
                  </ToastTitle>
                </Toast>
              ),
            });
          });
        }
        previousAlertIds.current = currentAlertIds;
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

  return (
    <View style={{ flex: 1 }} className="bg-background-light pt-12 px-4">
      <View className="flex-row justify-between items-center mb-6">
        <Heading size="2xl" className="text-secondary-800">
          Live Alerts
        </Heading>
        <Button size="sm" variant="outline" onPress={handleLogout}>
          <ButtonText>Logout</ButtonText>
        </Button>
      </View>

      {alerts.length === 0 ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-secondary-500">
            No active alerts right now.
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <VStack space="md" className="pb-8">
            {alerts.map((alert) => {
              const isAccepted = alert.status === "accepted";
              return (
                <View
                  key={alert.id}
                  className={`bg-white rounded-xl p-4 shadow-soft-1 border border-outline-100 ${isAccepted ? "opacity-60" : ""}`}
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
                    <Text size="xs" className="text-secondary-400">
                      {new Date(alert.timestampMs).toLocaleTimeString()}
                    </Text>
                  </View>

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
