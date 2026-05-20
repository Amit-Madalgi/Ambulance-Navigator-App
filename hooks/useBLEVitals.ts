import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, PermissionsAndroid } from "react-native";
import { BleManager, Device, Subscription } from "react-native-ble-plx";
import { database } from "@/firebaseConfig";
import { ref, update } from "firebase/database";

// Nordic UART Service UUIDs (must match ESP32 sketch)
const NUS_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const NUS_TX_CHAR_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"; // ESP32 -> Phone (NOTIFY)

const DEVICE_NAME = "HealthMonitor_ESP32";
const SCAN_TIMEOUT_MS = 15000;

type Vitals = {
  hr: number;
  spo2: number;
};

type BLEVitalsState = {
  vitals: Vitals;
  isScanning: boolean;
  isConnected: boolean;
  deviceName: string | null;
  error: string | null;
  activeCrashId: string | null;
};

/**
 * Hook to manage BLE connection with HealthMonitor_ESP32 wearable.
 *
 * - Scans for the device by name
 * - Connects and subscribes to vitals NOTIFY characteristic
 * - Parses "HR=78.4,SpO2=97.2" format
 * - Posts vitals to Firebase under alerts/<crashId>/patient_vitals/
 */
export function useBLEVitals() {
  const managerRef = useRef<BleManager | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const subscriptionRef = useRef<Subscription | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [state, setState] = useState<BLEVitalsState>({
    vitals: { hr: 0, spo2: 0 },
    isScanning: false,
    isConnected: false,
    deviceName: null,
    error: null,
    activeCrashId: null,
  });

  // Initialize BLE manager once (native only — BLE not available on web)
  useEffect(() => {
    if (Platform.OS === "web") return;

    managerRef.current = new BleManager();

    return () => {
      // Cleanup on unmount
      subscriptionRef.current?.remove();
      deviceRef.current?.cancelConnection().catch(() => {});
      managerRef.current?.destroy();
    };
  }, []);

  // Request Android BLE permissions
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === "web") return false;

    if (Platform.OS === "android") {
      const apiLevel =
        typeof Platform.Version === "number" ? Platform.Version : 0;

      if (apiLevel >= 31) {
        // Android 12+
        const results = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);

        return Object.values(results).every(
          (r) => r === PermissionsAndroid.RESULTS.GRANTED,
        );
      } else {
        // Android < 12
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        return result === PermissionsAndroid.RESULTS.GRANTED;
      }
    }

    return true; // iOS doesn't need runtime permissions for BLE
  }, []);

  // Parse "HR=78.4,SpO2=97.2" from ESP32
  const parseVitals = useCallback((raw: string): Vitals | null => {
    try {
      const hrMatch = raw.match(/HR=([\d.]+)/);
      const spo2Match = raw.match(/SpO2=([\d.]+)/);

      if (hrMatch && spo2Match) {
        return {
          hr: parseFloat(hrMatch[1]),
          spo2: parseFloat(spo2Match[1]),
        };
      }
    } catch (e) {
      console.warn("Failed to parse vitals:", raw);
    }
    return null;
  }, []);

  // Post vitals to Firebase
  const postToFirebase = useCallback(
    async (vitals: Vitals, crashId: string) => {
      try {
        await update(ref(database, `alerts/${crashId}/patient_vitals`), {
          hr: vitals.hr,
          spo2: vitals.spo2,
          timestamp: Date.now(),
        });
      } catch (e) {
        console.warn("Firebase vitals update failed:", e);
      }
    },
    [],
  );

  // Set the active crash ID to bind vitals to
  const setActiveCrashId = useCallback((crashId: string | null) => {
    setState((prev) => ({ ...prev, activeCrashId: crashId }));
  }, []);

  // Start scanning for the wearable device
  const startScan = useCallback(async () => {
    const manager = managerRef.current;
    if (!manager) return;

    // Check permissions
    const granted = await requestPermissions();
    if (!granted) {
      setState((prev) => ({
        ...prev,
        error: "Bluetooth permissions not granted",
      }));
      return;
    }

    // Check BLE state
    const bleState = await manager.state();
    if (bleState !== "PoweredOn") {
      setState((prev) => ({
        ...prev,
        error: "Bluetooth is not turned on",
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      isScanning: true,
      error: null,
    }));

    // Stop any previous scan
    manager.stopDeviceScan();

    // Set scan timeout
    scanTimeoutRef.current = setTimeout(() => {
      manager.stopDeviceScan();
      setState((prev) => {
        if (prev.isScanning && !prev.isConnected) {
          return {
            ...prev,
            isScanning: false,
            error: "Device not found. Make sure HealthMonitor_ESP32 is powered on.",
          };
        }
        return prev;
      });
    }, SCAN_TIMEOUT_MS);

    // Start scanning
    manager.startDeviceScan(null, null, async (error, device) => {
      if (error) {
        console.error("Scan error:", error);
        setState((prev) => ({
          ...prev,
          isScanning: false,
          error: `Scan error: ${error.message}`,
        }));
        return;
      }

      if (device?.name === DEVICE_NAME || device?.localName === DEVICE_NAME) {
        // Found the device — stop scanning and connect
        manager.stopDeviceScan();
        if (scanTimeoutRef.current) {
          clearTimeout(scanTimeoutRef.current);
        }

        setState((prev) => ({
          ...prev,
          isScanning: false,
          deviceName: device.name || device.localName || DEVICE_NAME,
        }));

        connectToDevice(device);
      }
    });
  }, [requestPermissions]);

  // Connect to discovered device
  const connectToDevice = useCallback(
    async (device: Device) => {
      try {
        const connected = await device.connect({ timeout: 10000 });
        const discovered =
          await connected.discoverAllServicesAndCharacteristics();
        deviceRef.current = discovered;

        setState((prev) => ({
          ...prev,
          isConnected: true,
          error: null,
        }));

        // Subscribe to NUS TX characteristic (vitals notifications)
        subscriptionRef.current = discovered.monitorCharacteristicForService(
          NUS_SERVICE_UUID,
          NUS_TX_CHAR_UUID,
          (error, characteristic) => {
            if (error) {
              console.error("Notification error:", error);
              // Device likely disconnected
              handleDisconnect();
              return;
            }

            if (characteristic?.value) {
              // BLE data comes as base64
              const raw = atob(characteristic.value);
              const vitals = parseVitals(raw);

              if (vitals) {
                setState((prev) => {
                  // Post to Firebase if there's an active crash
                  if (prev.activeCrashId) {
                    postToFirebase(vitals, prev.activeCrashId);
                  }

                  return {
                    ...prev,
                    vitals,
                  };
                });
              }
            }
          },
        );

        // Monitor disconnection
        discovered.onDisconnected(() => {
          handleDisconnect();
        });
      } catch (e: any) {
        console.error("Connection failed:", e);
        setState((prev) => ({
          ...prev,
          isConnected: false,
          error: `Connection failed: ${e.message || "Unknown error"}`,
        }));
      }
    },
    [parseVitals, postToFirebase],
  );

  // Handle device disconnection
  const handleDisconnect = useCallback(() => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    deviceRef.current = null;

    setState((prev) => ({
      ...prev,
      isConnected: false,
      vitals: { hr: 0, spo2: 0 },
      error: "Device disconnected",
    }));
  }, []);

  // Manually disconnect
  const disconnect = useCallback(async () => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;

    if (deviceRef.current) {
      try {
        await deviceRef.current.cancelConnection();
      } catch (e) {
        // Already disconnected
      }
      deviceRef.current = null;
    }

    // Stop scanning if active
    managerRef.current?.stopDeviceScan();
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }

    setState((prev) => ({
      ...prev,
      isConnected: false,
      isScanning: false,
      vitals: { hr: 0, spo2: 0 },
      error: null,
    }));
  }, []);

  return {
    ...state,
    startScan,
    disconnect,
    setActiveCrashId,
  };
}
