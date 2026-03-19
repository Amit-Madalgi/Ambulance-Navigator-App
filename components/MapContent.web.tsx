import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';
import { Heading } from '@/components/ui/heading';

type MapContentProps = {
  destinationLat: number;
  destinationLng: number;
  onBack: () => void;
};

export default function MapContent({ destinationLat, destinationLng, onBack }: MapContentProps) {
  return (
    <View style={styles.container}>
      <Heading size="lg" style={{ marginBottom: 12 }}>Maps Not Available on Web</Heading>
      <Text style={{ color: '#666', marginBottom: 20, textAlign: 'center' }}>
        Please open this app on a mobile device to use the map navigation feature.
      </Text>
      <Text style={{ color: '#888', marginBottom: 20 }}>
        Destination: {destinationLat.toFixed(5)}, {destinationLng.toFixed(5)}
      </Text>
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f8f9fa',
  },
  backBtn: {
    backgroundColor: '#D62828',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
});
