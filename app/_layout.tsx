import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import "@/global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { useNotifications } from "@/hooks/useNotifications";
import { BLEProvider } from "@/hooks/useBLEVitals";

export default function RootLayout() {
  useNotifications();

  return (
    <BLEProvider>
      <GluestackUIProvider mode="light">
        <StatusBar style="dark" />
        <View style={{ flex: 1 }} className="bg-background-light">
          <Stack screenOptions={{ headerShown: false }} />
        </View>
      </GluestackUIProvider>
    </BLEProvider>
  );
}

