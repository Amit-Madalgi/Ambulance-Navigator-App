import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';

type MapContentProps = {
  destinationLat: number;
  destinationLng: number;
  onBack: () => void;
};

export default function MapContent({ destinationLat, destinationLng, onBack }: MapContentProps) {
  return (
    <View style={styles.container}>
      <iframe 
        width="100%" 
        height="100%" 
        style={{ border: 0, position: 'absolute', top: 0, left: 0, bottom: 0, right: 0 }}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        src={`https://maps.google.com/maps?q=${destinationLat},${destinationLng}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
      />
      
      {/* Floating Back Button */}
      <TouchableOpacity 
        style={styles.floatingBackBtn} 
        onPress={onBack}
        activeOpacity={0.8}
      >
        <Text style={{ color: '#fff', fontWeight: 'bold' }}>← Back to Alerts</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: '#e5e5e5',
  },
  floatingBackBtn: {
    position: 'absolute',
    top: 24,
    left: 24,
    backgroundColor: '#D62828',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
});
