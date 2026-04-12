import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';
import { Heading } from '@/components/ui/heading';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

type MapContentProps = {
  destinationLat: number;
  destinationLng: number;
  onBack: () => void;
};

export default function MapContent({ destinationLat, destinationLng, onBack }: MapContentProps) {
  // Show embedded map with the accident location and nearby hospitals
  const mapSrc = `https://maps.google.com/maps?q=hospital+emergency+near+${destinationLat},${destinationLng}&t=&z=14&ie=UTF8&iwloc=&output=embed`;

  const openFullRoute = () => {
    // Open Google Maps with directions from accident to nearest hospital
    // Using the same "hospital near" search so the result is consistent
    window.open(
      `https://www.google.com/maps/search/hospital+emergency+near+${destinationLat},${destinationLng}`,
      '_blank'
    );
  };

  const openNavigation = () => {
    // Open navigation from accident location to nearest hospital
    window.open(
      `https://www.google.com/maps/dir/${destinationLat},${destinationLng}/hospital+emergency+near+${destinationLat},${destinationLng}`,
      '_blank'
    );
  };

  return (
    <View style={styles.container}>
      <iframe
        width="100%"
        height="100%"
        style={{ border: 0, position: 'absolute', top: 0, left: 0, bottom: 0, right: 0 }}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        src={mapSrc}
        allow="fullscreen"
      />

      {/* Back Button */}
      <TouchableOpacity style={styles.floatingBackBtn} onPress={onBack} activeOpacity={0.8}>
        <Text style={{ color: '#fff', fontWeight: 'bold' }}>{'\u2190'} Back to Alerts</Text>
      </TouchableOpacity>

      {/* Info Card */}
      <View style={styles.infoCard}>
        <Heading size="sm" style={{ color: '#D62828', marginBottom: 4 }}>
          {'\u{1F6A8}'} Emergency Navigation
        </Heading>
        <View style={styles.routeChain}>
          <View style={styles.stopItem}>
            <View style={[styles.dot, { backgroundColor: '#D62828' }]} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', fontSize: 12, color: '#333' }}>Accident Location</Text>
              <Text style={{ fontSize: 10, color: '#888' }}>{destinationLat.toFixed(4)}, {destinationLng.toFixed(4)}</Text>
            </View>
          </View>
          <View style={styles.lineConnector} />
          <View style={styles.stopItem}>
            <View style={[styles.dot, { backgroundColor: '#4CAF50' }]} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', fontSize: 12, color: '#333' }}>Nearest Hospital</Text>
              <Text style={{ fontSize: 10, color: '#888' }}>Tap below to view hospitals nearby</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.btnRow}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#4CAF50' }]} onPress={openFullRoute} activeOpacity={0.8}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>
              {'\u{1F3E5}'} View Hospitals
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#D62828' }]} onPress={openNavigation} activeOpacity={0.8}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>
              {'\u{1F9ED}'} Navigate to Hospital
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', height: '100%', position: 'relative', backgroundColor: '#e5e5e5' },
  floatingBackBtn: {
    position: 'absolute', top: 24, left: 24, backgroundColor: '#D62828',
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, zIndex: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5,
  },
  infoCard: {
    position: 'absolute', bottom: 24, left: 24, right: 24, backgroundColor: '#fff',
    borderRadius: 16, padding: 16, zIndex: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 10,
  },
  routeChain: { marginVertical: 8, gap: 4 },
  stopItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  lineConnector: { width: 2, height: 16, backgroundColor: '#ddd', marginLeft: 5 },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
});
