import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    TextInput,
    ActivityIndicator,
    Modal,
    Platform,
    Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker, PROVIDER_DEFAULT } from '../../components/ui/MapView';
import * as Location from 'expo-location';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../../services/supabase';
import { getCurrentLocation } from '../../services/locationService';
import { GlassCard, Button } from '../../components/ui';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../theme';
import { ChevronLeft, MapPin, Calendar, Truck, DollarSign, Navigation, Search } from 'lucide-react-native';
import { format } from 'date-fns';

// Android-safe gradient
const BG_GRADIENT: [string, string, ...string[]] = ['#e0e7ff', '#f0f9ff', '#f8fafc'];
const HEADER_GRADIENT: [string, string, ...string[]] = ['#2563eb', '#1e40af'];

const { width, height } = Dimensions.get('window');

type TravelType = 'Local' | 'Outstation';
type TransportMode = 'Bike' | 'Car' | 'Bus' | 'Train' | 'Flight';

export default function TravelApprovalScreen({ navigation }: any) {
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Config Data
    const [rates, setRates] = useState<Record<string, number>>({});

    // Form State
    const [purpose, setPurpose] = useState('');
    const [travelType, setTravelType] = useState<TravelType>('Local');
    const [transportMode, setTransportMode] = useState<TransportMode>('Bike');
    const [travelDate, setTravelDate] = useState(new Date());
    const [returnDate, setReturnDate] = useState(new Date());

    // Location State
    const [fromLocation, setFromLocation] = useState('');
    const [fromCoords, setFromCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [toLocation, setToLocation] = useState('');
    const [toCoords, setToCoords] = useState<{ lat: number; lng: number } | null>(null);

    // Calculations
    const [distance, setDistance] = useState(0);
    const [cost, setCost] = useState(0);

    // Map Picker State
    const [showMap, setShowMap] = useState(false);
    const [mapRegion, setMapRegion] = useState({
        latitude: 12.9716, // Default Bangalore
        longitude: 77.5946,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
    });
    const [pickedLocation, setPickedLocation] = useState<{ lat: number; lng: number } | null>(null);

    // Date Picker Visibility
    const [showTravelDate, setShowTravelDate] = useState(false);
    const [showReturnDate, setShowReturnDate] = useState(false);

    const isWeb = Platform.OS === 'web';

    useEffect(() => {
        fetchRates();
        // pre-fill from location if possible? No, wait for user action
    }, []);

    // Recalculate cost when distance or mode changes
    useEffect(() => {
        calculateCost();
    }, [distance, transportMode, rates]);

    // Recalculate distance when coords change
    useEffect(() => {
        if (fromCoords && toCoords) {
            const dist = calculateHaversineDistance(
                fromCoords.lat,
                fromCoords.lng,
                toCoords.lat,
                toCoords.lng
            );
            setDistance(parseFloat(dist.toFixed(2)));
        }
    }, [fromCoords, toCoords]);

    const fetchRates = async () => {
        try {
            const { data } = await supabase
                .from('travel_rate_config')
                .select('transport_mode, rate_per_km')
                .eq('is_active', true);

            if (data) {
                const rateMap: Record<string, number> = {};
                data.forEach((r: any) => {
                    rateMap[r.transport_mode] = r.rate_per_km;
                });
                setRates(rateMap);
            }
        } catch (error) {
            console.error('Error fetching rates:', error);
        }
    };

    const calculateHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371; // km
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    const calculateCost = () => {
        const rate = rates[transportMode] || 0;
        const estimated = distance * rate;
        // Logic: if not Bike/Car, maybe fixed cost? 
        // Assuming rate_per_km applies primarily to Bike/Car. 
        // If Bus/Train, user might need to input estimate manually? 
        // For now, use rate * distance logic as base.
        setCost(Math.round(estimated));
    };

    const handleGetCurrentLocation = async () => {
        setLoading(true);
        try {
            const location = await getCurrentLocation();
            if (location) {
                setFromCoords({ lat: location.latitude, lng: location.longitude });

                // Set map region to current location
                setMapRegion({
                    latitude: location.latitude,
                    longitude: location.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                });

                // Reverse Geocode
                const address = await Location.reverseGeocodeAsync({
                    latitude: location.latitude,
                    longitude: location.longitude,
                });

                if (address && address.length > 0) {
                    const addr = address[0];
                    const fullAddr = `${addr.name || ''} ${addr.street || ''}, ${addr.city || ''}`.trim();
                    setFromLocation(fullAddr || 'Current Location');
                } else {
                    setFromLocation(`${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`);
                }
            } else {
                Alert.alert('Error', 'Could not fetch location. Please enable permissions.');
            }
        } catch (error) {
            console.error('GPS Error:', error);
            Alert.alert('Error', 'Failed to get current location.');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenMap = () => {
        if (isWeb) {
            Alert.alert('Map Picker Unavailable', 'Use destination text and tap "Use Destination" to resolve location.');
            return;
        }
        setShowMap(true);
    };

    const handleResolveDestination = async () => {
        const destination = toLocation.trim();
        if (destination === '') {
            Alert.alert('Required', 'Enter destination text first.');
            return;
        }

        try {
            const geocoded = await Location.geocodeAsync(destination);
            if (!geocoded?.length) {
                Alert.alert('Not found', 'Unable to resolve this destination. Please refine the text.');
                return;
            }

            const first = geocoded[0];
            setToCoords({ lat: first.latitude, lng: first.longitude });
            setMapRegion((prev) => ({
                ...prev,
                latitude: first.latitude,
                longitude: first.longitude,
            }));
            Alert.alert('Resolved', 'Destination coordinates updated.');
        } catch (error) {
            Alert.alert('Error', 'Failed to resolve destination location.');
        }
    };

    const handleConfirmMapPick = async () => {
        if (pickedLocation) {
            setToCoords(pickedLocation);
            setShowMap(false);

            // Reverse Geocode suggested
            try {
                const address = await Location.reverseGeocodeAsync({
                    latitude: pickedLocation.lat,
                    longitude: pickedLocation.lng,
                });
                if (address && address.length > 0) {
                    const addr = address[0];
                    const fullAddr = `${addr.name || ''} ${addr.street || ''}, ${addr.city || ''}`.trim();
                    setToLocation(fullAddr || 'Pinned Location');
                } else {
                    setToLocation(`${pickedLocation.lat.toFixed(4)}, ${pickedLocation.lng.toFixed(4)}`);
                }
            } catch (e) {
                setToLocation('Pinned Location');
            }
        }
    };

    const handleSubmit = async () => {
        if (!purpose.trim()) {
            Alert.alert('Required', 'Please enter Purpose.');
            return;
        }
        if (!fromLocation || !toLocation) {
            Alert.alert('Required', 'Please specify From and To locations.');
            return;
        }

        setSubmitting(true);
        try {
            const userResult = await supabase.auth.getUser();
            const user = userResult?.data?.user;
            if (!user) throw new Error('No user');

            const payload = {
                employee_id: user.id,
                purpose: purpose.trim(),
                travel_type: travelType,
                transport_mode: transportMode,
                from_location: fromLocation,
                from_lat: fromCoords?.lat || null,
                from_lng: fromCoords?.lng || null,
                to_location: toLocation,
                to_lat: toCoords?.lat || null,
                to_lng: toCoords?.lng || null,
                travel_date: format(travelDate, 'yyyy-MM-dd'),
                expected_return: travelType === 'Outstation' ? returnDate.toISOString() : null,
                estimated_distance_km: distance,
                estimated_cost: cost,
                is_within_city: travelType === 'Local',
                status: 'Pending',
            };

            const { error } = await supabase
                .from('travel_requests')
                .insert(payload);

            if (error) throw error;

            Alert.alert('Success', 'Travel Request Submitted!', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);

        } catch (error: any) {
            console.error('Submit Travel Error:', error);
            Alert.alert('Error', error.message || 'Failed to submit.');
        } finally {
            setSubmitting(false);
        }
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
                    <Text style={styles.headerTitle}>New Travel Request</Text>
                    <View style={{ width: 40 }} />
                </LinearGradient>
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                {/* Travel Details */}
                <GlassCard style={styles.card}>
                    <Text style={styles.label}>Travel Type</Text>
                    <View style={styles.toggleContainer}>
                        {(['Local', 'Outstation'] as TravelType[]).map((type) => (
                            <TouchableOpacity
                                key={type}
                                style={[styles.toggleButton, travelType === type ? styles.toggleButtonActive : null]}
                                onPress={() => setTravelType(type)}
                            >
                                <Text style={[styles.toggleText, travelType === type ? styles.toggleTextActive : null]}>
                                    {type}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={[styles.label, { marginTop: SPACING.lg }]}>Purpose</Text>
                    <TextInput
                        style={styles.input}
                        value={purpose}
                        onChangeText={setPurpose}
                        placeholder="Client Meeting, Site Visit..."
                        placeholderTextColor={COLORS.neutral[400]}
                    />
                </GlassCard>

                {/* Locations */}
                <GlassCard style={styles.card}>
                    <View style={styles.locationSection}>
                        <Text style={styles.label}>From</Text>
                        <View style={styles.locationInputRow}>
                            <TextInput
                                style={[styles.input, { flex: 1 }]}
                                value={fromLocation}
                                onChangeText={setFromLocation}
                                placeholder="Start Location"
                            />
                            <TouchableOpacity style={styles.iconButton} onPress={handleGetCurrentLocation}>
                                <Navigation size={20} color={COLORS.primary[500]} />
                            </TouchableOpacity>
                        </View>

                        <Text style={[styles.label, { marginTop: SPACING.md }]}>To</Text>
                        <View style={styles.locationInputRow}>
                            <TextInput
                                style={[styles.input, { flex: 1 }]}
                                value={toLocation}
                                onChangeText={setToLocation}
                                placeholder="Destination"
                            />
                            <TouchableOpacity style={styles.iconButton} onPress={handleOpenMap}>
                                <MapPin size={20} color={COLORS.primary[500]} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.iconButton} onPress={handleResolveDestination}>
                                <Search size={20} color={COLORS.primary[500]} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {distance > 0 && (
                        <View style={styles.statsRow}>
                            <View style={styles.statBadge}>
                                <Truck size={14} color={COLORS.primary[600]} />
                                <Text style={styles.statText}>{distance} km</Text>
                            </View>
                            <View style={[styles.statBadge, { backgroundColor: COLORS.success[50] }]}>
                                <DollarSign size={14} color={COLORS.success[600]} />
                                <Text style={[styles.statText, { color: COLORS.success[700] }]}>
                                    Est. ₹{cost}
                                </Text>
                            </View>
                        </View>
                    )}
                </GlassCard>

                {/* Mode & Date */}
                <GlassCard style={styles.card}>
                    <Text style={styles.label}>Transport Mode</Text>
                    <View style={styles.pickerContainer}>
                        <Picker
                            selectedValue={transportMode}
                            onValueChange={(val) => setTransportMode(val)}
                            style={Platform.OS === 'android' ? styles.pickerAndroid : undefined}
                        >
                            <Picker.Item label="Bike (₹4/km)" value="Bike" />
                            <Picker.Item label="Car (₹10/km)" value="Car" />
                            <Picker.Item label="Bus" value="Bus" />
                            <Picker.Item label="Train" value="Train" />
                            <Picker.Item label="Flight" value="Flight" />
                        </Picker>
                    </View>

                    <Text style={[styles.label, { marginTop: SPACING.lg }]}>Date</Text>
                    <TouchableOpacity style={styles.dateButton} onPress={() => setShowTravelDate(true)}>
                        <Calendar size={18} color={COLORS.neutral[500]} />
                        <Text style={styles.dateText}>{format(travelDate, 'dd MMM yyyy')}</Text>
                    </TouchableOpacity>
                    {(showTravelDate || Platform.OS === 'ios') && (
                        <DateTimePicker
                            value={travelDate}
                            mode="date"
                            display="default"
                            onChange={(e, d) => {
                                setShowTravelDate(false);
                                if (d) setTravelDate(d);
                            }}
                            style={Platform.OS === 'ios' ? { alignSelf: 'flex-start' } : undefined}
                        />
                    )}

                    {travelType === 'Outstation' && (
                        <>
                            <Text style={[styles.label, { marginTop: SPACING.lg }]}>Expected Return</Text>
                            <TouchableOpacity style={styles.dateButton} onPress={() => setShowReturnDate(true)}>
                                <Calendar size={18} color={COLORS.neutral[500]} />
                                <Text style={styles.dateText}>{format(returnDate, 'dd MMM yyyy')}</Text>
                            </TouchableOpacity>
                            {(showReturnDate || Platform.OS === 'ios') && (
                                <DateTimePicker
                                    value={returnDate}
                                    mode="date"
                                    minimumDate={travelDate}
                                    display="default"
                                    onChange={(e, d) => {
                                        setShowReturnDate(false);
                                        if (d) setReturnDate(d);
                                    }}
                                    style={Platform.OS === 'ios' ? { alignSelf: 'flex-start' } : undefined}
                                />
                            )}
                        </>
                    )}
                </GlassCard>

                <Button
                    title="Submit Request"
                    onPress={handleSubmit}
                    loading={submitting}
                    disabled={submitting || loading}
                    size="lg"
                    style={{ marginTop: SPACING.md, marginBottom: 40 }}
                />

            </ScrollView>

            {/* Map Modal */}
            <Modal visible={showMap} animationType="slide">
                <View style={styles.mapContainer}>
                    <MapView
                        provider={PROVIDER_DEFAULT}
                        style={styles.map}
                        region={mapRegion}
                        onRegionChangeComplete={setMapRegion}
                        onPress={(e) => {
                            setPickedLocation({
                                lat: e.nativeEvent.coordinate.latitude,
                                lng: e.nativeEvent.coordinate.longitude,
                            });
                        }}
                    >
                        {pickedLocation && (
                            <Marker
                                coordinate={{ latitude: pickedLocation.lat, longitude: pickedLocation.lng }}
                                title="Selected Location"
                            />
                        )}
                        {fromCoords && (
                            <Marker
                                coordinate={{ latitude: fromCoords.lat, longitude: fromCoords.lng }}
                                pinColor="blue"
                                title="Start Point"
                            />
                        )}
                    </MapView>

                    <View style={styles.mapOverlay}>
                        <Text style={styles.mapInstruction}>Tap on map to select destination</Text>
                        <View style={styles.mapButtons}>
                            <Button
                                title="Cancel"
                                onPress={() => setShowMap(false)}
                                variant="secondary"
                                style={{ flex: 1, marginRight: SPACING.md }}
                            />
                            <Button
                                title="Confirm Location"
                                onPress={handleConfirmMapPick}
                                disabled={!pickedLocation}
                                style={{ flex: 1 }}
                            />
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    background: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },

    header: {
        height: Platform.OS === 'ios' ? 110 : 90,
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
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 4,
    },

    content: {
        padding: SPACING.lg,
        paddingTop: SPACING.xl,
    },

    card: { marginBottom: SPACING.lg },
    label: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.neutral[700],
        marginBottom: SPACING.xs,
    },

    toggleContainer: {
        flexDirection: 'row',
        backgroundColor: COLORS.neutral[100],
        borderRadius: BORDER_RADIUS.md,
        padding: 4,
    },
    toggleButton: {
        flex: 1,
        paddingVertical: SPACING.md,
        alignItems: 'center',
        borderRadius: BORDER_RADIUS.sm,
    },
    toggleButtonActive: {
        backgroundColor: '#fff',
        ...SHADOWS.sm,
    },
    toggleText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.neutral[500],
    },
    toggleTextActive: {
        color: COLORS.primary[600],
    },

    input: {
        backgroundColor: COLORS.neutral[50],
        borderWidth: 1,
        borderColor: COLORS.neutral[200],
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        fontSize: 16,
        color: COLORS.neutral[800],
    },

    locationSection: {
        gap: SPACING.sm,
    },
    locationInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    iconButton: {
        width: 48,
        height: 48,
        borderRadius: BORDER_RADIUS.md,
        backgroundColor: COLORS.primary[50],
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.primary[100],
    },

    statsRow: {
        flexDirection: 'row',
        marginTop: SPACING.lg,
        gap: SPACING.md,
    },
    statBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary[50],
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.round,
        gap: 6,
    },
    statText: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.primary[700],
    },

    pickerContainer: {
        borderWidth: 1,
        borderColor: COLORS.neutral[200],
        borderRadius: BORDER_RADIUS.md,
        backgroundColor: COLORS.neutral[50],
        overflow: 'hidden',
    },
    pickerAndroid: {
        height: 50,
        color: COLORS.neutral[900],
    },

    dateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.neutral[50],
        borderWidth: 1,
        borderColor: COLORS.neutral[200],
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        gap: SPACING.sm,
    },
    dateText: {
        fontSize: 16,
        color: COLORS.neutral[800],
    },

    mapContainer: {
        flex: 1,
        backgroundColor: '#fff',
    },
    map: {
        flex: 1,
    },
    mapOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        padding: SPACING.xl,
        borderTopLeftRadius: BORDER_RADIUS.xl,
        borderTopRightRadius: BORDER_RADIUS.xl,
        ...SHADOWS.lg,
    },
    mapInstruction: {
        textAlign: 'center',
        fontSize: 14,
        color: COLORS.neutral[600],
        marginBottom: SPACING.lg,
    },
    mapButtons: {
        flexDirection: 'row',
    },
});
