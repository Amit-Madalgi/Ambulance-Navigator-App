import { useEffect } from "react";
import { View } from "react-native";
import { useColorScheme } from "nativewind";
import { Slot } from "expo-router";
import * as Notifications from 'expo-notifications';
import "@/global.css";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  const { colorScheme } = useColorScheme();

  return (
    <GluestackUIProvider mode={colorScheme ?? "light"}>
      <View 
        style={{ flex: 1 }}
        className={`bg-background-light dark:bg-background-dark ${colorScheme === 'dark' ? 'dark' : ''}`}
      >
        <Slot />
      </View>
    </GluestackUIProvider>
  );
}
