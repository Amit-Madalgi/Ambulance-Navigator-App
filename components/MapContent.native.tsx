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

type HospitalInfo = {
  name: string;
  coords: Coords;
  vicinity: string;
};

type MapContentProps = {
  destinationLat: number;
  destinationLng: number;
  onBack: () => void;
};

async function findNearestHospital(lat: number, lng: number): Promise<HospitalInfo | null> {
  if (!GOOGLE_MAPS_API_KEY) return null;
  
  try {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&rankby=distance&type=hospital&keyword=hospital+emergency&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const hospital = data.results[0];
      return {
        name: hospital.name,
        coords: {
          latitude: hospital.geometry.location.lat,
          longitude: hospital.geometry.location.lng,
        },
        vicinity: hospital.vicinity || '',
      };
    }
  } catch (error) {
    console.warn('Failed to find nearby hospital:', error);
  }
  return null;
}

export default function MapContent({ destinationLat, destinationLng, onBack }: MapContentProps) {
  const mapRef = useRef<MapView>(null);

  const accidentLocation: Coords = {
    latitude: destinationLat,
    longitude: destinationLng,
  };

  const [userLocation, setUserLocation] = useState<Coords | null>(null);
  const [hospital, setHospital] = useState<HospitalInfo | null>(null);
  const [leg1Info, setLeg1Info] = useState<{ distance: number; duration: number } | null>(null);
  const [leg2Info, setLeg2Info] = useState<{ distance: number; duration: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'accident' | 'hospital'>('accident');

  useEffect(() => {
    (async () => {
      // Get user location
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

      // Find nearest hospital to accident location
      const nearestHospital = await findNearestHospital(destinationLat, destinationLng);
      if (nearestHospital) {
        setHospital(nearestHospital);
      }

      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    const pointsToFit: Coords[] = [accidentLocation];
    if (userLocation) pointsToFit.push(userLocation);
    if (hospital) pointsToFit.push(hospital.coords);

    if (pointsToFit.length > 1) {
      mapRef.current.fitToCoordinates(pointsToFit, {
        edgePadding: { top: 120, right: 60, bottom: 280, left: 60 },
        animated: true,
      });
    }
  }, [userLocation, hospital]);

  const openExternalMaps = () => {
    // Navigate: current location → accident → hospital
    if (hospital && userLocation) {
      // Full route: Device → Accident (stop 1) → Hospital (final destination)
      const originLat = userLocation.latitude;
      const originLng = userLocation.longitude;
      const waypointLat = accidentLocation.latitude;
      const waypointLng = accidentLocation.longitude;
      const destLat = hospital.coords.latitude;
      const destLng = hospital.coords.longitude;
      
      // Use universal Google Maps URL that works on both iOS and Android
      const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&waypoints=${waypointLat},${waypointLng}&destination=${destLat},${destLng}&travelmode=driving`;
      
      Linking.openURL(mapsUrl);
    } else {
      // Fallback: navigate to accident location only
      const { latitude, longitude } = accidentLocation;
      
      if (userLocation) {
        const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.latitude},${userLocation.longitude}&destination=${latitude},${longitude}&travelmode=driving`;
        Linking.openURL(mapsUrl);
      } else {
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
      }
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#D62828" />
        <Text style={{ marginTop: 12, color: '#666' }}>Getting your location & finding nearby hospital...</Text>
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

  const totalDistance = (leg1Info?.distance || 0) + (leg2Info?.distance || 0);
  const totalDuration = (leg1Info?.duration || 0) + (leg2Info?.duration || 0);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={{
          latitude: accidentLocation.latitude,
          longitude: accidentLocation.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation
        showsMyLocationButton
      >
        {/* Accident Location Marker */}
        <Marker
          coordinate={accidentLocation}
          title="Accident Location"
          description={`${accidentLocation.latitude.toFixed(4)}, ${accidentLocation.longitude.toFixed(4)}`}
          pinColor="#D62828"
        />

        {/* Ambulance Location Marker */}
        {userLocation && (
          <Marker
            coordinate={userLocation}
            title="Your Location"
            pinColor="#2196F3"
          />
        )}

        {/* Hospital Marker */}
        {hospital && (
          <Marker
            coordinate={hospital.coords}
            title={hospital.name}
            description={hospital.vicinity}
            pinColor="#4CAF50"
          />
        )}

        {/* Route Leg 1: Ambulance → Accident */}
        {userLocation && GOOGLE_MAPS_API_KEY ? (
          <MapViewDirections
            origin={userLocation}
            destination={accidentLocation}
            apikey={GOOGLE_MAPS_API_KEY}
            mode="DRIVING"
            strokeWidth={5}
            strokeColor="#D62828"
            optimizeWaypoints
            onReady={(result: any) => {
              setLeg1Info({
                distance: result.distance,
                duration: result.duration,
              });
            }}
            onError={(err: any) => {
              console.warn('Directions Leg 1 error:', err);
            }}
          />
        ) : null}

        {/* Route Leg 2: Accident → Nearest Hospital */}
        {hospital && GOOGLE_MAPS_API_KEY ? (
          <MapViewDirections
            origin={accidentLocation}
            destination={hospital.coords}
            apikey={GOOGLE_MAPS_API_KEY}
            mode="DRIVING"
            strokeWidth={5}
            strokeColor="#4CAF50"
            lineDashPattern={[0]}
            optimizeWaypoints
            onReady={(result: any) => {
              setLeg2Info({
                distance: result.distance,
                duration: result.duration,
              });
              // Fit all coordinates
              if (userLocation && mapRef.current) {
                const allCoords = [userLocation, accidentLocation, hospital.coords];
                mapRef.current.fitToCoordinates(allCoords, {
                  edgePadding: { top: 120, right: 60, bottom: 300, left: 60 },
                  animated: true,
                });
              }
            }}
            onError={(err: any) => {
              console.warn('Directions Leg 2 error:', err);
            }}
          />
        ) : null}
      </MapView>

      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{'\u2190'} Back</Text>
        </TouchableOpacity>
        <Heading size="md" style={{ color: '#fff', flex: 1, textAlign: 'center' }}>Navigation</Heading>
        <View style={{ width: 60 }} />
      </View>

      {/* Route Legend */}
      <View style={styles.legendBar}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#D62828' }]} />
          <Text style={styles.legendText}>To Accident</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
          <Text style={styles.legendText}>To Hospital</Text>
        </View>
      </View>

      {/* Bottom Info Card */}
      <View style={styles.bottomCard}>
        {/* Tab Switcher */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'accident' && styles.tabActive]}
            onPress={() => setActiveTab('accident')}
          >
            <Text style={[styles.tabText, activeTab === 'accident' && styles.tabTextActive]}>
              {'\u{1F6A8}'} Accident
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'hospital' && styles.tabActiveGreen]}
            onPress={() => setActiveTab('hospital')}
          >
            <Text style={[styles.tabText, activeTab === 'hospital' && styles.tabTextActive]}>
              {'\u{1F3E5}'} Hospital
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'accident' ? (
          <>
            <Heading size="md" style={{ color: '#D62828', marginBottom: 2, marginTop: 8 }}>
              Emergency Location
            </Heading>
            <Text style={{ color: '#666', marginBottom: 8, fontSize: 13 }}>
              {accidentLocation.latitude.toFixed(5)}, {accidentLocation.longitude.toFixed(5)}
            </Text>
            {leg1Info && (
              <View style={styles.routeInfoRow}>
                <View style={styles.routeInfoItem}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: '#D62828' }}>
                    {leg1Info.distance.toFixed(1)} km
                  </Text>
                  <Text style={{ color: '#888', fontSize: 11 }}>Distance</Text>
                </View>
                <View style={styles.routeInfoDivider} />
                <View style={styles.routeInfoItem}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: '#D62828' }}>
                    {Math.ceil(leg1Info.duration)} min
                  </Text>
                  <Text style={{ color: '#888', fontSize: 11 }}>ETA</Text>
                </View>
              </View>
            )}
          </>
        ) : (
          <>
            <Heading size="md" style={{ color: '#4CAF50', marginBottom: 2, marginTop: 8 }}>
              {hospital?.name || 'Searching...'}
            </Heading>
            <Text style={{ color: '#666', marginBottom: 8, fontSize: 13 }}>
              {hospital?.vicinity || 'Finding nearest hospital...'}
            </Text>
            {leg2Info && (
              <View style={[styles.routeInfoRow, { backgroundColor: '#f0f8f0' }]}>
                <View style={styles.routeInfoItem}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: '#4CAF50' }}>
                    {leg2Info.distance.toFixed(1)} km
                  </Text>
                  <Text style={{ color: '#888', fontSize: 11 }}>From Accident</Text>
                </View>
                <View style={styles.routeInfoDivider} />
                <View style={styles.routeInfoItem}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: '#4CAF50' }}>
                    {Math.ceil(leg2Info.duration)} min
                  </Text>
                  <Text style={{ color: '#888', fontSize: 11 }}>ETA</Text>
                </View>
              </View>
            )}
          </>
        )}

        {/* Total Route Summary */}
        {leg1Info && leg2Info && (
          <View style={styles.totalRow}>
            <Text style={{ color: '#555', fontWeight: '600', fontSize: 13 }}>
              Total: {totalDistance.toFixed(1)} km  {'\u2022'}  {Math.ceil(totalDuration)} min
            </Text>
          </View>
        )}

        {!GOOGLE_MAPS_API_KEY && (
          <Text style={{ color: '#D62828', fontSize: 12, marginBottom: 8 }}>
            {'\u26A0'} Add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in .env for route directions
          </Text>
        )}

        <TouchableOpacity style={styles.navigateBtn} onPress={openExternalMaps}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
            {'\u{1F9ED}'} Start Full Route Navigation
          </Text>
          {hospital && (
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 }}>
              You {'\u2192'} Accident {'\u2192'} {hospital.name}
            </Text>
          )}
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
  legendBar: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  tabActive: {
    backgroundColor: '#D62828',
  },
  tabActiveGreen: {
    backgroundColor: '#4CAF50',
  },
  tabText: {
    fontWeight: '700',
    fontSize: 13,
    color: '#666',
  },
  tabTextActive: {
    color: '#fff',
  },
  routeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    backgroundColor: '#f0f4f8',
    borderRadius: 12,
    paddingVertical: 10,
  },
  routeInfoItem: {
    alignItems: 'center',
    flex: 1,
  },
  routeInfoDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#ddd',
  },
  totalRow: {
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 6,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
  },
  navigateBtn: {
    backgroundColor: '#D62828',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
});
