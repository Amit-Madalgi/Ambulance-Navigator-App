import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Stack, router, useSegments } from "expo-router";
import "@/global.css";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { auth } from "@/firebaseConfig";
import { onAuthStateChanged, User } from "firebase/auth";

function useProtectedRoute(user: User | null, initializing: boolean) {
  const segments = useSegments();

  useEffect(() => {
    if (initializing) return;

    const inAuthGroup = segments[0] === "(tabs)";

    // Use setTimeout to ensure navigation happens after the navigator is mounted
    if (!user && inAuthGroup) {
      setTimeout(() => {
        router.replace("/");
      }, 0);
    }
  }, [user, segments, initializing]);
}

export default function RootLayout() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (initializing) setInitializing(false);
    });
    return unsubscribe;
  }, []);

  useProtectedRoute(user, initializing);

  if (initializing) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8F9FA" }}>
        <ActivityIndicator size="large" color="#D62828" />
      </View>
    );
  }

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
