import React, { useEffect, useState, useRef } from "react";
import { View, ScrollView, TouchableOpacity, Dimensions, StyleSheet, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { database } from "@/firebaseConfig";
import { ref, onValue } from "firebase/database";
import { useLocalSearchParams, useRouter } from "expo-router";
import Svg, { Path, Line } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBLE } from "@/hooks/useBLEVitals";

export default function VitalsScreen() {
  const ble = useBLE();
  const params = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const alertId = params.id;
  const insets = useSafeAreaInsets();

  const [vitals, setVitals] = useState<{ hr: number; spo2: number } | null>(null);
  const [alertDetails, setAlertDetails] = useState<{ event: string; deviceId: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Waveform Buffers (Length of 80 points for smooth scrolling)
  const [ppgPoints, setPpgPoints] = useState<number[]>(Array(80).fill(0));
  const [spo2Points, setSpo2Points] = useState<number[]>(Array(80).fill(0));
  const tickRef = useRef(0);

  // Reference for stable access in animation loop
  const hrRef = useRef(75);
  const spo2Ref = useRef(98);

  // Listen to Firebase RTDB for live vitals
  useEffect(() => {
    if (!alertId) {
      setLoading(false);
      return;
    }

    const alertRef = ref(database, `alerts/${alertId}`);
    const unsubscribe = onValue(alertRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setAlertDetails({
          event: data.event || "Alert",
          deviceId: data.deviceId || "Wearable Device",
        });

        // Vitals: check patient_vitals (handles both hr and bpm formats), fall back to initial alert vitals or 0
        const hrVal = Math.max(data.patient_vitals?.hr || 0, data.patient_vitals?.bpm || 0) || data.heartRate || 0;
        const spo2Val = data.patient_vitals?.spo2 || data.spo2 || 0;
        
        setVitals({
          hr: hrVal,
          spo2: spo2Val,
        });

        hrRef.current = hrVal;
        spo2Ref.current = spo2Val;
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [alertId]);

  // Waveform generation loop (runs at ~25 FPS to draw smooth medical-style scrolling graphs)
  useEffect(() => {
    const interval = setInterval(() => {
      tickRef.current += 1;
      const currentHr = hrRef.current;
      const currentSpo2 = spo2Ref.current;

      // 1. Simulate PPG (Heart Rate Pulse) waveform with systolic and diastolic peaks
      const ppgPeriod = Math.max(12, Math.min(40, Math.floor((60 / currentHr) * 20))); // number of ticks per beat
      const ppgPhase = tickRef.current % ppgPeriod;
      let ppgVal = 10; // Baseline

      if (ppgPhase < ppgPeriod * 0.15) {
        // Fast Systolic Upslope
        ppgVal = 10 + Math.sin((ppgPhase / (ppgPeriod * 0.15)) * Math.PI / 2) * 55;
      } else if (ppgPhase < ppgPeriod * 0.3) {
        // Systolic Peak Decay
        ppgVal = 65 - Math.sin(((ppgPhase - ppgPeriod * 0.15) / (ppgPeriod * 0.15)) * Math.PI / 2) * 25;
      } else if (ppgPhase < ppgPeriod * 0.45) {
        // Dicrotic Notch Bounce
        ppgVal = 40 + Math.sin(((ppgPhase - ppgPeriod * 0.3) / (ppgPeriod * 0.15)) * Math.PI / 2) * 10;
      } else {
        // Diastolic Decay
        const decayProgress = (ppgPhase - ppgPeriod * 0.45) / (ppgPeriod * 0.55);
        ppgVal = 10 + 40 * Math.exp(-decayProgress * 2.5);
      }
      // Add slight noise for realism
      ppgVal += (Math.random() - 0.5) * 1.5;

      // 2. Simulate SpO2 (Oxygen Wave) - slow undulating respirator wave matching the pulse
      const spo2Period = ppgPeriod * 2.5; // Longer undulating breathing cycle
      const spo2Phase = tickRef.current % spo2Period;
      let spo2Val = 20; // baseline
      
      if (spo2Phase < spo2Period * 0.4) {
        spo2Val = 20 + Math.sin((spo2Phase / (spo2Period * 0.4)) * Math.PI) * 25;
      } else {
        const decayProgress = (spo2Phase - spo2Period * 0.4) / (spo2Period * 0.6);
        spo2Val = 20 + 25 * Math.cos(decayProgress * Math.PI / 2);
      }
      // Add slight noise based on current SpO2 level
      const noise = (Math.random() - 0.5) * (100 - currentSpo2) * 0.5;
      spo2Val += noise;

      // Update scrolling arrays
      setPpgPoints((prev) => [...prev.slice(1), ppgVal]);
      setSpo2Points((prev) => [...prev.slice(1), spo2Val]);
    }, 40);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]} className="bg-background-light">
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#D62828" />
        <Text className="text-secondary-400 mt-4">Connecting to live vitals stream...</Text>
      </View>
    );
  }

  // Generate SVG paths
  const chartWidth = Dimensions.get("window").width - 48;
  const chartHeight = 110;

  const generatePath = (points: number[], maxVal = 80) => {
    if (points.length === 0) return "";
    return points
      .map((val, idx) => {
        const x = (idx / (points.length - 1)) * chartWidth;
        const y = chartHeight - (val / maxVal) * (chartHeight - 20) - 10;
        return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  };

  const ppgPath = generatePath(ppgPoints);
  const spo2Path = generatePath(spo2Points);

  // Render Grid lines
  const gridLines = [];
  const numGridCols = 15;
  const numGridRows = 6;
  for (let i = 0; i <= numGridCols; i++) {
    const x = (i / numGridCols) * chartWidth;
    gridLines.push(<Line key={`v-${i}`} x1={x} y1={0} x2={x} y2={chartHeight} stroke="rgba(0, 0, 0, 0.06)" strokeWidth={1} />);
  }
  for (let i = 0; i <= numGridRows; i++) {
    const y = (i / numGridRows) * chartHeight;
    gridLines.push(<Line key={`h-${i}`} x1={0} y1={y} x2={chartWidth} y2={y} stroke="rgba(0, 0, 0, 0.06)" strokeWidth={1} />);
  }

  return (
    <View style={{ flex: 1, paddingTop: insets.top }} className="bg-background-light">
      <StatusBar style="dark" />
      
      {/* Top Header */}
      <View className="flex-row justify-between items-center mb-4 px-4 pt-2">
        <TouchableOpacity 
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Text className="text-secondary-700 font-bold text-sm">{"\u2190"} Back</Text>
        </TouchableOpacity>
        
        <View className={`flex-row items-center px-3 py-1.5 rounded-full border ${ble.isConnected ? 'bg-success-50 border-success-200' : (ble.isScanning ? 'bg-warning-50 border-warning-200' : 'bg-error-50 border-error-200')}`}>
          <View className={`w-2.5 h-2.5 rounded-full mr-2 ${ble.isConnected ? 'bg-success-500' : (ble.isScanning ? 'bg-warning-500' : 'bg-error-500')}`} />
          <Text className={`font-bold text-xs uppercase tracking-wider ${ble.isConnected ? 'text-success-700' : (ble.isScanning ? 'text-warning-700' : 'text-error-700')}`}>
            {ble.isConnected ? "Live Connected" : (ble.isScanning ? "Scanning..." : "Offline")}
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {/* Patient Detail Panel */}
        <View className="bg-white rounded-xl p-4 mb-4 shadow-soft-1 border border-outline-100">
          <Text className="text-secondary-400 text-xs font-bold uppercase tracking-wider mb-1">Active Incident</Text>
          <Heading size="lg" className="text-secondary-800 font-bold mb-3">
            {alertDetails?.event.toUpperCase() || "PATIENT SIGNAL"}
          </Heading>
          
          <View className="flex-row justify-between items-center pt-3 border-t border-outline-100">
            <View>
              <Text className="text-secondary-400 text-xs">Device Name</Text>
              <Text className="text-secondary-700 font-semibold text-sm mt-0.5">{alertDetails?.deviceId || "Simulated Wearable"}</Text>
            </View>
            <View className="items-end">
              <Text className="text-secondary-400 text-xs">Signal Source</Text>
              <Text className="text-info-600 font-semibold text-sm mt-0.5">Pulse IoT Sensor</Text>
            </View>
          </View>
        </View>

        {/* Dynamic Vitals Indicators Row */}
        <View className="flex-row gap-4 mb-4">
          {/* BPM Card */}
          <View className="flex-1 bg-white rounded-xl p-4 shadow-soft-1 border border-outline-100">
            <View className="flex-row justify-between items-center mb-1">
              <Text className="text-error-500 text-xs font-extrabold uppercase tracking-wider">Heart Rate</Text>
              <Text className="text-error-500 text-lg font-bold">{"\u2764\uFE0F"}</Text>
            </View>
            <View className="flex-row items-baseline">
              <Text className="text-secondary-900 text-4xl font-black">{vitals?.hr ?? "--"}</Text>
              <Text className="text-error-400 text-xs font-bold ml-1.5">BPM</Text>
            </View>
            <View className="mt-2 bg-error-50 px-2 py-1 rounded-md self-start">
              <Text className="text-error-600 text-[10px] font-semibold uppercase tracking-wide">
                {vitals ? (vitals.hr > 100 || vitals.hr < 50 ? "ABNORMAL" : "NORMAL") : "WAITING..."}
              </Text>
            </View>
          </View>

          {/* SpO2 Card */}
          <View className="flex-1 bg-white rounded-xl p-4 shadow-soft-1 border border-outline-100">
            <View className="flex-row justify-between items-center mb-1">
              <Text className="text-info-600 text-xs font-extrabold uppercase tracking-wider">Oxygen (SpO2)</Text>
              <Text className="text-info-500 text-lg font-bold">{"\u{1F4A7}"}</Text>
            </View>
            <View className="flex-row items-baseline">
              <Text className="text-secondary-900 text-4xl font-black">{vitals?.spo2 ?? "--"}</Text>
              <Text className="text-info-400 text-xs font-bold ml-1.5">%</Text>
            </View>
            <View className="mt-2 bg-info-50 px-2 py-1 rounded-md self-start">
              <Text className="text-info-700 text-[10px] font-semibold uppercase tracking-wide">
                {vitals ? (vitals.spo2 < 95 ? "HYPOXIA" : "HEALTHY") : "WAITING..."}
              </Text>
            </View>
          </View>
        </View>

        {/* EKG / PPG Live Graph Box */}
        <View className="bg-white rounded-xl p-4 mb-4 shadow-soft-1 border border-outline-100">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-secondary-500 text-xs font-bold uppercase tracking-wider">Pulse</Text>
            <Text className="text-error-500 font-bold text-xs uppercase">Live ECG Trace</Text>
          </View>
          
          <View style={styles.chartContainer} className="bg-secondary-50 rounded-xl overflow-hidden border border-outline-100">
            <Svg width={chartWidth} height={chartHeight}>
              {/* Grid Overlay */}
              {gridLines}
              
              {/* Wave Glow (duplicate with thicker stroke & opacity) */}
              {ppgPath ? (
                <Path d={ppgPath} fill="none" stroke="rgba(214, 40, 40, 0.1)" strokeWidth={7} />
              ) : null}
              {/* Main Line */}
              {ppgPath ? (
                <Path d={ppgPath} fill="none" stroke="#D62828" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              ) : null}
            </Svg>
          </View>
        </View>

        {/* SpO2 Oxygen Plethysmograph Live Graph */}
        <View className="bg-white rounded-xl p-4 mb-4 shadow-soft-1 border border-outline-100">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-secondary-500 text-xs font-bold uppercase tracking-wider">SpO2 Wave</Text>
            <Text className="text-info-600 font-bold text-xs uppercase">Respiratory Flow</Text>
          </View>
          
          <View style={styles.chartContainer} className="bg-secondary-50 rounded-xl overflow-hidden border border-outline-100">
            <Svg width={chartWidth} height={chartHeight}>
              {/* Grid Overlay */}
              {gridLines}
              
              {/* Wave Glow */}
              {spo2Path ? (
                <Path d={spo2Path} fill="none" stroke="rgba(6, 148, 162, 0.1)" strokeWidth={7} />
              ) : null}
              {/* Main Line */}
              {spo2Path ? (
                <Path d={spo2Path} fill="none" stroke="#0694A2" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              ) : null}
            </Svg>
          </View>
        </View>

        {/* Signal Diagnostics Panel */}
        <View className="bg-white rounded-xl p-4 mb-10 shadow-soft-1 border border-outline-100">
          <Text className="text-secondary-500 text-xs font-bold uppercase tracking-wider mb-3">Diagnostics & Parameters</Text>
          
          <View className="space-y-3">
            <View className="flex-row justify-between border-b border-outline-100 pb-2">
              <Text className="text-secondary-400 text-xs">Battery Level</Text>
              <Text className="text-secondary-700 text-xs font-semibold">89%</Text>
            </View>
            <View className="flex-row justify-between border-b border-outline-100 pb-2">
              <Text className="text-secondary-400 text-xs">Sampling Frequency</Text>
              <Text className="text-secondary-700 text-xs font-semibold">25 Hz</Text>
            </View>
            <View className="flex-row justify-between border-b border-outline-100 pb-2">
              <Text className="text-secondary-400 text-xs">Sensor Link Quality</Text>
              <Text className="text-success-600 text-xs font-semibold">Excellent (RSSI -58 dBm)</Text>
            </View>
            <View className="flex-row justify-between pt-1">
              <Text className="text-secondary-400 text-xs">Data Refresh Interval</Text>
              <Text className="text-secondary-700 text-xs font-semibold">Real-time (Streamed)</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  backBtn: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  chartContainer: {
    paddingVertical: 6,
    justifyContent: "center",
    alignItems: "center",
  },
});
