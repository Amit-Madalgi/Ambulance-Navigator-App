import React, { useEffect, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { useRouter } from "expo-router";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { Button, ButtonText } from "@/components/ui/button";
import { VStack } from "@/components/ui/vstack";
import { useToast, Toast, ToastTitle } from "@/components/ui/toast";
import { auth, database } from "@/firebaseConfig";
import { signOut } from "firebase/auth";
import { ref, onValue, remove } from "firebase/database";
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

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
};

export default function HomeScreen() {
  const router = useRouter();
  const toast = useToast();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [previousAlertIds, setPreviousAlertIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Request notification permissions
    async function requestPermissions() {
      if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') {
          console.log('Failed to get push token for push notification!');
        }
      }
    }
    requestPermissions();

    const alertsRef = ref(database, 'alerts');
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

        // Check for new alerts to trigger notification
        const currentAlertIds = new Set(alertsList.map(a => a.id));
        setPreviousAlertIds(prevIds => {
          if (prevIds.size > 0) { // Don't notify on initial load
            const newAlerts = alertsList.filter(a => !prevIds.has(a.id));
            newAlerts.forEach(newAlert => {
              Notifications.scheduleNotificationAsync({
                content: {
                  title: `🚨 Emergency: ${newAlert.event.toUpperCase()}`,
                  body: `Device ${newAlert.deviceId} just sent an alert.`,
                  sound: true,
                },
                trigger: null, // trigger immediately
              });
            });
          }
          return currentAlertIds;
        });

      } else {
        setAlerts([]);
        setPreviousAlertIds(new Set());
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace("/");
    } catch (error: any) {
      toast.show({
        placement: "top",
        render: ({ id }) => <Toast nativeID={id} action="error" variant="solid" className="mt-12"><ToastTitle>{error.message || "Failed to logout"}</ToastTitle></Toast>
      });
    }
  };

  const handleAccept = async (alertId: string) => {
    try {
      await remove(ref(database, `alerts/${alertId}`));
      toast.show({
        placement: "top",
        render: ({ id }) => <Toast nativeID={id} action="success" variant="solid" className="mt-12"><ToastTitle>Alert Accepted & Removed</ToastTitle></Toast>
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleDecline = async (alertId: string) => {
    try {
      await remove(ref(database, `alerts/${alertId}`));
      toast.show({
        placement: "top",
        render: ({ id }) => <Toast nativeID={id} action="info" variant="solid" className="mt-12"><ToastTitle>Alert Declined & Removed</ToastTitle></Toast>
      });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <View style={{ flex: 1 }} className="bg-background-light dark:bg-background-dark pt-12 px-4">
      <View className="flex-row justify-between items-center mb-6">
        <Heading size="2xl" className="text-secondary-800 dark:text-typography-100">Live Alerts</Heading>
        <Button size="sm" variant="outline" onPress={handleLogout}>
          <ButtonText>Logout</ButtonText>
        </Button>
      </View>

      {alerts.length === 0 ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-secondary-500">No active alerts right now.</Text>
        </View>
      ) : (
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <VStack space="md" className="pb-8">
            {alerts.map((alert) => (
              <View 
                key={alert.id}
                className="bg-white dark:bg-background-800 rounded-xl p-4 shadow-soft-1 border border-outline-100 dark:border-outline-800"
              >
                <View className="flex-row justify-between items-start mb-2">
                  <VStack>
                    <Heading size="md" className="text-error-600 uppercase tracking-widest">{alert.event}</Heading>
                    <Text size="sm" className="text-secondary-500 font-bold">{alert.deviceId}</Text>
                  </VStack>
                  <Text size="xs" className="text-secondary-400">
                    {new Date(alert.timestampMs).toLocaleTimeString()}
                  </Text>
                </View>

                <View className="flex-row gap-3 my-3 flex-wrap">
                  <View className="bg-error-50 dark:bg-error-900/30 px-3 py-1.5 rounded-md">
                    <Text size="sm" className="text-error-700 dark:text-error-300 font-medium">BPM: {alert.heartRate}</Text>
                  </View>
                  <View className="bg-info-50 dark:bg-info-900/30 px-3 py-1.5 rounded-md">
                    <Text size="sm" className="text-info-700 dark:text-info-300 font-medium">SpO2: {alert.spo2}%</Text>
                  </View>
                  <View className="bg-success-50 dark:bg-success-900/30 px-3 py-1.5 rounded-md">
                    <Text size="sm" className="text-success-700 dark:text-success-300 font-medium">
                      GPS: {alert.gpsValid ? `${alert.lat.toFixed(4)}, ${alert.lng.toFixed(4)}` : "Invalid"}
                    </Text>
                  </View>
                </View>

                <View className="flex-row gap-2 mt-2 pt-3 border-t border-outline-100 dark:border-outline-800 justify-end">
                  <Button size="sm" variant="outline" action="secondary" onPress={() => handleDecline(alert.id)}>
                    <ButtonText>Decline</ButtonText>
                  </Button>
                  <Button size="sm" action="positive" onPress={() => handleAccept(alert.id)}>
                    <ButtonText>Accept</ButtonText>
                  </Button>
                </View>
              </View>
            ))}
          </VStack>
        </ScrollView>
      )}
    </View>
  );
}
