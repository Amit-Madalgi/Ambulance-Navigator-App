import { View } from "react-native";
import { Stack } from "expo-router";
import "@/global.css";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";

export default function RootLayout() {
  return (
    <GluestackUIProvider mode="light">
      <View
        style={{ flex: 1 }}
        className="bg-background-light"
      >
        <Stack screenOptions={{ headerShown: false }} />
      </View>
    </GluestackUIProvider>
  );
}
