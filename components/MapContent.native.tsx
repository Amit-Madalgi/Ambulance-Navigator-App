import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, TouchableOpacity, Linking, Platform } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import * as Location from 'expo-location';
import { Text } from '@/components/ui/text';
import { Heading } from '@/components/ui/heading';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

type Coords = {
  latitude: number;
  longitude: number;
};

type MapContentProps = {
  destinationLat: number;
  destinationLng: number;
  onBack: () => void;
};

export default function MapContent({ destinationLat, destinationLng, onBack }: MapContentProps) {
  const mapRef = useRef<MapView>(null);

  const destination: Coords = {
    latitude: destinationLat,
    longitude: destinationLng,
  };

  const [userLocation, setUserLocation] = useState<Coords | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission denied');
        setLoading(false);
        return;
      }

      try {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        const coords: Coords = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        setUserLocation(coords);
      } catch (err) {
        setLocationError('Failed to get your location');
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (userLocation && mapRef.current) {
      mapRef.current.fitToCoordinates([userLocation, destination], {
        edgePadding: { top: 100, right: 60, bottom: 200, left: 60 },
        animated: true,
      });
    }
  }, [userLocation]);

  const openExternalMaps = () => {
    const { latitude, longitude } = destination;
    const url = Platform.select({
      ios: `comgooglemaps://?daddr=${latitude},${longitude}&directionsmode=driving`,
      android: `google.navigation:q=${latitude},${longitude}&mode=d`,
    });
    const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;

    if (url) {
      Linking.canOpenURL(url).then((supported) => {
        Linking.openURL(supported ? url : webUrl);
      });
    } else {
      Linking.openURL(webUrl);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#D62828" />
        <Text style={{ marginTop: 12, color: '#666' }}>Getting your location...</Text>
      </View>
    );
  }

  if (locationError) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: '#D62828', fontSize: 16, marginBottom: 12 }}>{locationError}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={{
          latitude: destination.latitude,
          longitude: destination.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation
        showsMyLocationButton
      >
        <Marker
          coordinate={destination}
          title="Emergency Location"
          description={`${destination.latitude.toFixed(4)}, ${destination.longitude.toFixed(4)}`}
          pinColor="#D62828"
        />

        {userLocation && (
          <Marker
            coordinate={userLocation}
            title="Your Location"
            pinColor="#2196F3"
          />
        )}

        {userLocation && GOOGLE_MAPS_API_KEY ? (
          <MapViewDirections
            origin={userLocation}
            destination={destination}
            apikey={GOOGLE_MAPS_API_KEY}
            mode="DRIVING"
            strokeWidth={5}
            strokeColor="#D62828"
            optimizeWaypoints
            onReady={(result: any) => {
              setRouteInfo({
                distance: result.distance,
                duration: result.duration,
              });
              mapRef.current?.fitToCoordinates(result.coordinates, {
                edgePadding: { top: 100, right: 60, bottom: 200, left: 60 },
                animated: true,
              });
            }}
            onError={(err: any) => {
              console.warn('Directions error:', err);
            }}
          />
        ) : null}
      </MapView>

      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>← Back</Text>
        </TouchableOpacity>
        <Heading size="md" style={{ color: '#fff' }}>Navigation</Heading>
      </View>

      {/* Bottom Info Card */}
      <View style={styles.bottomCard}>
        <Heading size="lg" style={{ color: '#D62828', marginBottom: 4 }}>
          🚨 Emergency Location
        </Heading>
        <Text style={{ color: '#666', marginBottom: 8 }}>
          {destination.latitude.toFixed(5)}, {destination.longitude.toFixed(5)}
        </Text>

        {routeInfo && (
          <View style={styles.routeInfoRow}>
            <View style={styles.routeInfoItem}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#1a1a2e' }}>
                {routeInfo.distance.toFixed(1)} km
              </Text>
              <Text style={{ color: '#888', fontSize: 12 }}>Distance</Text>
            </View>
            <View style={styles.routeInfoDivider} />
            <View style={styles.routeInfoItem}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#1a1a2e' }}>
                {Math.ceil(routeInfo.duration)} min
              </Text>
              <Text style={{ color: '#888', fontSize: 12 }}>ETA</Text>
            </View>
          </View>
        )}

        {!GOOGLE_MAPS_API_KEY && (
          <Text style={{ color: '#D62828', fontSize: 12, marginBottom: 8 }}>
            ⚠ Add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in .env for route directions
          </Text>
        )}

        <TouchableOpacity style={styles.navigateBtn} onPress={openExternalMaps}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
            🧭 Start Turn-by-Turn Navigation
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(26, 26, 46, 0.85)',
  },
  backBtn: {
    backgroundColor: '#D62828',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  routeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    backgroundColor: '#f0f4f8',
    borderRadius: 12,
    paddingVertical: 12,
  },
  routeInfoItem: {
    alignItems: 'center',
    flex: 1,
  },
  routeInfoDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#ddd',
  },
  navigateBtn: {
    backgroundColor: '#D62828',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
});
