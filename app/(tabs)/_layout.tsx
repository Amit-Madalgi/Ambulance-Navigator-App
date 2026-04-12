import { Tabs } from 'expo-router';
import { useColorScheme } from 'nativewind';

export default function TabLayout() {
  const { colorScheme } = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colorScheme === 'dark' ? '#1A1A24' : '#FFFFFF',
          borderTopColor: colorScheme === 'dark' ? '#3E0C0C' : '#E3EDF2',
        },
        tabBarActiveTintColor: '#D62828',
        tabBarInactiveTintColor: colorScheme === 'dark' ? '#6C757D' : '#A1C3D2',
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
