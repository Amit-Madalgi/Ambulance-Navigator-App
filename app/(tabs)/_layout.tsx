import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E3EDF2',
        },
        tabBarActiveTintColor: '#D62828',
        tabBarInactiveTintColor: '#A1C3D2',
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Live Alerts',
          tabBarIcon: () => null,
        }}
      />
    </Tabs>
  );
}
