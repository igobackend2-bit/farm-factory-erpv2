import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { supabase } from '../../services/supabase';
import { getCurrentLocation } from '../../services/locationService';
import { GlassCard, Button } from '../../components/ui';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../../theme';
import { ChevronLeft, MapPin, Clock, Truck, StopCircle, Navigation } from 'lucide-react-native';
import { format, differenceInMinutes } from 'date-fns';

const BG_GRADIENT: [string, string, ...string[]] = ['#e0e7ff', '#f0f9ff', '#f8fafc'];
const HEADER_GRADIENT: [string, string, ...string[]] = ['#10b981', '#059669'];

interface TravelRequest {
    id: string;
    purpose: string;
    from_location: string;
    to_location: string;
    from_lat: number;
    from_lng: number;
    to_lat: number;
    to_lng: number;
    estimated_distance_km: number;
    trip_started_at: string;
    trip_ended_at?: string;
}

export default function ActiveTripScreen({ route, navigation }: any) {
    const { requestId } = route.params;

    const [loading, setLoading] = useState(true);
    const [trip, setTrip] = useState<TravelRequest | null>(null);
    const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [actualDistance, setActualDistance] = useState(0);
    const [ending, setEnding] = useState(false);

    useEffect(() => {
        fetchTrip();
        startLocationTracking();

        const timer = setInterval(() => {
            if (trip?.trip_started_at) {
                const minutes = differenceInMinutes(new Date(), new Date(trip.trip_started_at));
                setElapsedTime(minutes);
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [trip?.trip_started_at]);

    const fetchTrip = async () => {
        try {
            const { data, error } = await supabase
                .from('travel_requests')
                .select('*')
                .eq('id', requestId)
                .single();

            if (error) throw error;

            const hasData = data !== null && data !== undefined;
            if (hasData === true) {
                setTrip(data);
            }
        } catch (error) {
            console.error('Error fetching trip:', error);
            Alert.alert('Error', 'Failed to load trip details.');
        } finally {
            setLoading(false);
        }
    };

    const startLocationTracking = async () => {
        const location = await getCurrentLocation();
        if (location) {
            setCurrentLocation({ lat: location.latitude, lng: location.longitude });

            // Update distance (simple straight-line calculation for now)
            if (trip && trip.from_lat && trip.from_lng) {
                const dist = calculateDistance(
                    trip.from_lat,
                    trip.from_lng,
                    location.latitude,
                    location.longitude
                );
                setActualDistance(dist);
            }
        }

        // Poll location every 30 seconds
        const interval = setInterval(async () => {
            const loc = await getCurrentLocation();
            if (loc) {
                setCurrentLocation({ lat: loc.latitude, lng: loc.longitude });

                if (trip && trip.from_lat && trip.from_lng) {
                    const dist = calculateDistance(
                        trip.from_lat,
                        trip.from_lng,
                        loc.latitude,
                        loc.longitude
                    );
                    setActualDistance(dist);
                }
            }
        }, 30000);

        return () => clearInterval(interval);
    };

    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371;
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return parseFloat((R * c).toFixed(2));
    };

    const handleEndTrip = async () => {
        Alert.alert(
            'End Trip?',
            'Are you sure you want to end this trip?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'End Trip',
                    style: 'destructive',
                    onPress: async () => {
                        setEnding(true);
                        try {
                            const location = await getCurrentLocation();

                            const { error } = await supabase
                                .from('travel_requests')
                                .update({
                                    trip_ended_at: new Date().toISOString(),
                                    actual_distance_km: actualDistance,
                                    return_location: `${location?.latitude.toFixed(4)}, ${location?.longitude.toFixed(4)}`,
                                    return_lat: location?.latitude || null,
                                    return_lng: location?.longitude || null,
                                    status: 'Completed'
                                })
                                .eq('id', requestId);

                            if (error) throw error;

                            Alert.alert('Success', 'Trip ended successfully!', [
                                { text: 'OK', onPress: () => navigation.goBack() }
                            ]);
                        } catch (error: any) {
                            Alert.alert('Error', error.message || 'Failed to end trip.');
                        } finally {
                            setEnding(false);
                        }
                    }
                }
            ]
        );
    };

    if (loading || !trip) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.success[500]} />
            </View>
        );
    }

    const formatTime = (minutes: number) => {
        const hrs = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
    };

    return (
        <View style={styles.container}>
            <LinearGradient colors={BG_GRADIENT} style={styles.background} />

            {/* Header */}
            <View style={styles.header}>
                <LinearGradient colors={HEADER_GRADIENT} style={styles.headerGradient}>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <ChevronLeft size={24} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerTitle}>Trip in Progress</Text>
                        <Text style={styles.headerSubtitle}>{trip.purpose}</Text>
                    </View>
                    <View style={{ width: 40 }} />
                </LinearGradient>
            </View>

            {/* Map */}
            <View style={styles.mapContainer}>
                {currentLocation && (
                    <MapView
                        style={styles.map}
                        initialRegion={{
                            latitude: currentLocation.lat,
                            longitude: currentLocation.lng,
                            latitudeDelta: 0.05,
                            longitudeDelta: 0.05,
                        }}
                        showsUserLocation={true}
                        followsUserLocation={true}
                    >
                        <Marker
                            coordinate={{ latitude: trip.from_lat, longitude: trip.from_lng }}
                            pinColor="green"
                            title="Start"
                        />
                        <Marker
                            coordinate={{ latitude: trip.to_lat, longitude: trip.to_lng }}
                            pinColor="red"
                            title="Destination"
                        />
                        {currentLocation && (
                            <Polyline
                                coordinates={[
                                    { latitude: trip.from_lat, longitude: trip.from_lng },
                                    { latitude: currentLocation.lat, longitude: currentLocation.lng },
                                ]}
                                strokeColor={COLORS.primary[500]}
                                strokeWidth={3}
                            />
                        )}
                    </MapView>
                )}
            </View>

            {/* Stats Panel */}
            <View style={styles.bottomPanel}>
                <GlassCard style={styles.statsCard}>
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Clock size={20} color={COLORS.primary[600]} />
                            <Text style={styles.statLabel}>Duration</Text>
                            <Text style={styles.statValue}>{formatTime(elapsedTime)}</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Truck size={20} color={COLORS.success[600]} />
                            <Text style={styles.statLabel}>Distance</Text>
                            <Text style={styles.statValue}>{actualDistance} km</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <MapPin size={20} color={COLORS.warning[600]} />
                            <Text style={styles.statLabel}>Est. Remaining</Text>
                            <Text style={styles.statValue}>
                                {Math.max(0, trip.estimated_distance_km - actualDistance).toFixed(1)} km
                            </Text>
                        </View>
                    </View>
                </GlassCard>

                <Button
                    title="End Trip"
                    onPress={handleEndTrip}
                    loading={ending}
                    disabled={ending}
                    icon={<StopCircle size={20} color="#fff" />}
                    size="lg"
                    style={styles.endButton}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    background: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },

    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    header: {
        height: Platform.OS === 'ios' ? 110 : 90,
        zIndex: 10,
    },
    headerGradient: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.lg,
        paddingBottom: SPACING.lg,
    },
    backButton: { padding: SPACING.sm },
    headerTitleContainer: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
    },
    headerSubtitle: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 2,
    },

    mapContainer: {
        flex: 1,
    },
    map: {
        flex: 1,
    },

    bottomPanel: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: SPACING.lg,
        paddingBottom: Platform.OS === 'ios' ? 40 : SPACING.lg,
    },
    statsCard: {
        marginBottom: SPACING.md,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
        gap: 4,
    },
    statDivider: {
        width: 1,
        height: 48,
        backgroundColor: COLORS.neutral[200],
    },
    statLabel: {
        fontSize: 11,
        color: COLORS.neutral[500],
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    statValue: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.neutral[800],
    },

    endButton: {
        marginTop: SPACING.sm,
        backgroundColor: COLORS.error[500],
    },
});
