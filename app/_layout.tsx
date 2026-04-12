import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import "@/global.css";
import { Stack } from "expo-router";
import { View } from "react-native";

export default function RootLayout() {
  return (
    <GluestackUIProvider mode="light">
      <View style={{ flex: 1 }} className="bg-background-light">
        <Stack screenOptions={{ headerShown: false }} />
      </View>
    </GluestackUIProvider>
  );
}
