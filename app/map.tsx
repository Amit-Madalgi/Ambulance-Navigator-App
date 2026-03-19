import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MapContent from '@/components/MapContent';

export default function MapScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ lat: string; lng: string }>();

  return (
    <MapContent
      destinationLat={parseFloat(params.lat || '0')}
      destinationLng={parseFloat(params.lng || '0')}
      onBack={() => router.back()}
    />
  );
}
