import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { database } from '@/firebaseConfig';
import { ref, onValue } from 'firebase/database';
import { Platform } from 'react-native';
import * as Location from 'expo-location';

// Configure how notifications behave when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Resolve lat/lng to a human-readable area name
async function getLocationName(lat: number, lng: number): Promise<string> {
  // 1. Try native geocoder
  try {
    const response = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (response && response.length > 0) {
      const place = response[0];
      const name = [place.name, place.street, place.subregion || place.city, place.region]
        .filter(Boolean)
        .join(', ');
      if (name) return name;
    }
  } catch (_) {}

  // 2. Try Nominatim
  try {
    const osmUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`;
    const response = await fetch(osmUrl, {
      headers: { 'User-Agent': 'AmbulanceNavigatorApp/1.0' },
    });
    const data = await response.json();
    if (data && data.display_name) {
      const parts = data.display_name.split(',');
      return parts.slice(0, 3).join(',').trim();
    }
  } catch (_) {}

  // 3. Fallback to raw coordinates
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

export function useNotifications() {
  const previousAlertIds = useRef<Set<string>>(new Set());
  const isFirstLoad = useRef(true);

  useEffect(() => {
    let unsubscribeFirebase: (() => void) | null = null;

    async function init() {
      if (Platform.OS === 'web') return;

      // Step 1: Ask for permissions FIRST
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Notification permission not granted!');
        return;
      }

      // Step 2: Create the Android notification channel BEFORE any notifications are sent
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('emergency-alerts', {
          name: 'Emergency Alerts',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 500, 250, 500],
          lightColor: '#FF231F7C',
          sound: 'default',
        });
      }

      // Step 3: NOW start listening to Firebase (channel is guaranteed to exist)
      const alertsRef = ref(database, 'alerts');
      unsubscribeFirebase = onValue(alertsRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        const currentIds = Object.keys(data);

        // On the very first load, just record what already exists so we don't spam
        if (isFirstLoad.current) {
          currentIds.forEach(id => previousAlertIds.current.add(id));
          isFirstLoad.current = false;
          return;
        }

        // Find IDs we have never seen before
        const trulyNewAlerts = currentIds.filter(id => {
          if (!previousAlertIds.current.has(id)) {
            previousAlertIds.current.add(id);
            return true;
          }
          return false;
        });

        trulyNewAlerts.forEach(async (id) => {
          const alert = data[id];

          // Resolve the location name before sending the notification
          let locationName = 'Unknown location';
          if (alert.lat && alert.lng) {
            locationName = await getLocationName(alert.lat, alert.lng);
          }

          // Fire the system notification
          Notifications.scheduleNotificationAsync({
            content: {
              title: '🚨 EMERGENCY ALERT!',
              body: `${(alert.event || 'ACCIDENT').toUpperCase()} near ${locationName}`,
              sound: 'default',
              priority: Notifications.AndroidNotificationPriority.MAX,
              channelId: 'emergency-alerts',
              data: { url: `/map?lat=${alert.lat}&lng=${alert.lng}&id=${id}` },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
              seconds: 1,
              repeats: false,
            },
          });
        });
      });
    }

    init();

    return () => {
      if (unsubscribeFirebase) unsubscribeFirebase();
    };
  }, []);
}
