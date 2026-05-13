import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    TextInput as RNTextInput,
    Image,
    Dimensions,
    Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocationStore } from '../../store/useLocationStore';
import { startLocationTracking } from '../../services/locationService';
import { supabase } from '../../services/supabase';
import { GlassCard, StatusBadge } from '../../components/ui';
import CameraComponent from '../../components/CameraComponent';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../../theme';
import { MapPin, Check, Clock, Camera, BookOpen, Eye, AlertTriangle } from 'lucide-react-native';
import { format } from 'date-fns';
import { getDailyKural } from '../../constants/thirukurals';

const BG_GRADIENT: [string, string, ...string[]] = ['#e0e7ff', '#f0f9ff', '#f8fafc'];
const SELFIE_PREVIEW_CACHE_KEY = 'selfie-preview-cache';
const SELFIE_BUCKET = 'employee-selfies';

type SelfieType = 'morning_login' | 'afternoon_break' | 'evening_break';
type LocationZone = 'back_office' | 'head_office' | 'site' | 'other';

const { width } = Dimensions.get('window');

const LOCATION_OPTIONS: { value: LocationZone; label: string; icon: string }[] = [
    { value: 'back_office', label: 'Back Office', icon: '🏢' },
    { value: 'head_office', label: 'Head Office', icon: '🏛️' },
    { value: 'site', label: 'Project Site', icon: '🏗️' },
    { value: 'other', label: 'Other', icon: '📍' },
];

// Morning selfie: open 9:30 AM to 10:14:59 AM (on-time), open after with late flag
// Afternoon: 2:30 PM, Evening: 5:40 PM
const MORNING_OPEN_MINUTES = 9 * 60 + 30;   // 9:30 AM
const MORNING_LATE_MINUTES = 10 * 60 + 15;  // 10:15 AM (after this = late)

const SELFIE_WINDOWS: Record<SelfieType, { label: string; openAt: string; openMinutes: number; closeAt?: string }> = {
    morning_login: { label: 'Morning Selfie', openAt: '9:30 AM', openMinutes: MORNING_OPEN_MINUTES, closeAt: '10:14 AM' },
    afternoon_break: { label: 'Lunch Selfie', openAt: '2:30 PM', openMinutes: 14 * 60 + 30 },
    evening_break: { label: 'Evening Selfie', openAt: '5:40 PM', openMinutes: 17 * 60 + 40 },
};

export default function HomeScreen() {
    const { isOnDuty, setIsOnDuty } = useLocationStore();
    const [loading, setLoading] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [userName, setUserName] = useState('');

    const [locationZone, setLocationZone] = useState<LocationZone | ''>('');
    const [otherReason, setOtherReason] = useState('');
    const [dayStartData, setDayStartData] = useState<any>(null);

    const [showCamera, setShowCamera] = useState(false);
    const [activeSelfieType, setActiveSelfieType] = useState<SelfieType>('morning_login');
    const [selfieStatus, setSelfieStatus] = useState<Record<SelfieType, { captured: boolean; time?: string; uri?: string; isLate?: boolean; geofence?: string | null }>>({
        morning_login: { captured: false },
        afternoon_break: { captured: false },
        evening_break: { captured: false },
    });
    const [viewingImage, setViewingImage] = useState<{ uri: string; label: string; time?: string; geofence?: string | null } | null>(null);

    const resolveSelfieDisplayUrl = async (userId: string, selfieUrl?: string): Promise<string | undefined> => {
        if (!selfieUrl) return undefined;
        if (selfieUrl.startsWith('http://') || selfieUrl.startsWith('https://')) return selfieUrl;

        // Legacy rows might only store a filename (e.g. morning_login.jpg).
        const normalizedPath = selfieUrl.includes('/')
            ? selfieUrl
            : `${userId}/${format(new Date(), 'yyyy-MM-dd')}/${selfieUrl}`;

        try {
            const signed = await supabase.storage.from(SELFIE_BUCKET).createSignedUrl(normalizedPath, 60 * 60 * 24);
            if (!signed.error && signed.data?.signedUrl) return signed.data.signedUrl;
        } catch {
            // fallback to original value
        }
        return selfieUrl;
    };

    const uploadSelfieToStorage = async (localUri: string, storagePath: string): Promise<string> => {
        const base64 = await FileSystem.readAsStringAsync(localUri, {
            encoding: 'base64' as any,
        });
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
        }

        const upload = await supabase.storage
            .from(SELFIE_BUCKET)
            .upload(storagePath, bytes.buffer, {
                upsert: true,
                contentType: 'image/jpeg',
            });

        if (upload.error) throw upload.error;
        return storagePath;
    };

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        checkDayStatus();
        fetchUserInfo();
    }, []);

    const fetchUserInfo = async () => {
        try {
            const userResult = await supabase.auth.getUser();
            const user = userResult?.data?.user;
            if (!user) return;

            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', user.id)
                .maybeSingle();

            if (profile?.full_name) {
                const firstName = String(profile.full_name).split(' ')[0] || '';
                setUserName(firstName);
            }
        } catch (error) {
            console.warn('Error fetching profile:', error);
        }
    };

    const checkDayStatus = async () => {
        setLoading(true);
        try {
            const userResult = await supabase.auth.getUser();
            const user = userResult?.data?.user;
            if (!user) return;

            const today = format(new Date(), 'yyyy-MM-dd');
            const persistedRaw = await AsyncStorage.getItem(SELFIE_PREVIEW_CACHE_KEY);
            const persisted = persistedRaw ? JSON.parse(persistedRaw) : {};
            const todayCache = persisted?.[today] || {};

            const { data: startData } = await supabase
                .from('day_starts')
                .select('*')
                .eq('user_id', user.id)
                .eq('date', today)
                .maybeSingle();

            if (startData) {
                setDayStartData(startData);
                setIsOnDuty(true);
                setLocationZone(startData.location_zone as LocationZone);
                if (startData.location_zone_other) setOtherReason(startData.location_zone_other);
            }

            const { data: selfieData } = await supabase
                .from('selfie_records')
                .select('selfie_type, captured_at, selfie_url, geofence_name, is_late')
                .eq('user_id', user.id)
                .eq('date', today);

            if (selfieData) {
                const next = { ...selfieStatus };
                for (const record of selfieData as any[]) {
                    const type = record?.selfie_type as SelfieType;
                    if (type && next[type]) {
                        const persistedUri = todayCache?.[type];
                        const backendUri = await resolveSelfieDisplayUrl(user.id, typeof record?.selfie_url === 'string' ? record.selfie_url : undefined);
                        next[type] = {
                            captured: true,
                            time: record.captured_at,
                            uri: persistedUri || backendUri,
                            geofence: record?.geofence_name ?? null,
                            isLate: Boolean(record?.is_late),
                        };
                    }
                }
                setSelfieStatus(next);
            }
        } catch (error) {
            console.error('Error checking home status:', error);
        } finally {
            setLoading(false);
        }
    };

    const getCurrentMinutes = () => currentTime.getHours() * 60 + currentTime.getMinutes();

    const isMorningLate = () => getCurrentMinutes() >= MORNING_LATE_MINUTES;

    const canCaptureSelfie = (type: SelfieType) => {
        if (type === 'morning_login') {
            return getCurrentMinutes() >= MORNING_OPEN_MINUTES;
        }
        return getCurrentMinutes() >= SELFIE_WINDOWS[type].openMinutes;
    };

    const handleOpenSelfie = (type: SelfieType) => {
        if (!canCaptureSelfie(type)) {
            Alert.alert('Not Open Yet', `${SELFIE_WINDOWS[type].label} opens at ${SELFIE_WINDOWS[type].openAt}.`);
            return;
        }
        if (type === 'morning_login' && isMorningLate()) {
            Alert.alert(
                'Late Attendance',
                `You are capturing morning selfie after 10:15 AM.\nThis will be marked as LATE attendance.`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Proceed (Late)', onPress: () => { setActiveSelfieType(type); setShowCamera(true); } },
                ]
            );
            return;
        }
        setActiveSelfieType(type);
        setShowCamera(true);
    };

    const getAutoLocation = async (): Promise<{ lat: number; lon: number; geofenceName: string | null }> => {
        try {
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const { latitude, longitude } = loc.coords;

            // Check geofences
            const { data: geofences } = await supabase
                .from('geofences')
                .select('id, name, latitude, longitude, radius_meters')
                .eq('is_active', true);

            let geofenceName: string | null = null;
            if (geofences && geofences.length > 0) {
                for (const fence of geofences) {
                    const R = 6371e3;
                    const φ1 = (latitude * Math.PI) / 180;
                    const φ2 = (fence.latitude * Math.PI) / 180;
                    const Δφ = ((fence.latitude - latitude) * Math.PI) / 180;
                    const Δλ = ((fence.longitude - longitude) * Math.PI) / 180;
                    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
                    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                    if (dist <= fence.radius_meters) {
                        geofenceName = fence.name;
                        break;
                    }
                }
            }
            return { lat: latitude, lon: longitude, geofenceName };
        } catch {
            return { lat: 0, lon: 0, geofenceName: null };
        }
    };

    const onSelfieCapture = async (uri: string) => {
        setShowCamera(false);
        setLoading(true);
        try {
            const userResult = await supabase.auth.getUser();
            const user = userResult?.data?.user;
            if (!user) throw new Error('User not logged in');

            const now = new Date();
            const isLate = activeSelfieType === 'morning_login' && isMorningLate();
            const { lat, lon, geofenceName } = await getAutoLocation();

            const fileName = `${user.id}/${format(now, 'yyyy-MM-dd')}/${activeSelfieType}.jpg`;
            let storedSelfiePath = fileName;
            try {
                storedSelfiePath = await uploadSelfieToStorage(uri, fileName);
            } catch (uploadError) {
                console.warn('Selfie storage upload failed, saving record with fallback path:', uploadError);
            }

            const result = await supabase.from('selfie_records').upsert(
                {
                    user_id: user.id,
                    date: format(now, 'yyyy-MM-dd'),
                    selfie_type: activeSelfieType,
                    captured_at: now.toISOString(),
                    selfie_url: storedSelfiePath,
                    is_late: isLate,
                    latitude: lat || null,
                    longitude: lon || null,
                    geofence_name: geofenceName,
                },
                { onConflict: 'user_id,date,selfie_type' }
            );

            if (result.error && result.error.code !== '42P01') throw result.error;

            const uploadedPreviewUrl = await resolveSelfieDisplayUrl(user.id, storedSelfiePath);

            const cacheRaw = await AsyncStorage.getItem(SELFIE_PREVIEW_CACHE_KEY);
            const cache = cacheRaw ? JSON.parse(cacheRaw) : {};
            const todayKey = format(now, 'yyyy-MM-dd');
            cache[todayKey] = {
                ...(cache[todayKey] || {}),
                [activeSelfieType]: uploadedPreviewUrl || uri,
            };
            await AsyncStorage.setItem(SELFIE_PREVIEW_CACHE_KEY, JSON.stringify(cache));

            setSelfieStatus((prev) => ({
                ...prev,
                [activeSelfieType]: { captured: true, time: now.toISOString(), uri: uploadedPreviewUrl || uri, isLate, geofence: geofenceName },
            }));

            const lateMsg = isLate ? '\n⚠️ Marked as Late Attendance' : '';
            const geoMsg = geofenceName ? `\n📍 Location: ${geofenceName}` : '\n📍 Location auto-captured';
            Alert.alert('Selfie Submitted', `Attendance recorded.${lateMsg}${geoMsg}`);
        } catch (error: any) {
            if (error?.code === '42P01') {
                const isLate = activeSelfieType === 'morning_login' && isMorningLate();
                const now = new Date();
                const cacheRaw = await AsyncStorage.getItem(SELFIE_PREVIEW_CACHE_KEY);
                const cache = cacheRaw ? JSON.parse(cacheRaw) : {};
                const todayKey = format(now, 'yyyy-MM-dd');
                cache[todayKey] = {
                    ...(cache[todayKey] || {}),
                    [activeSelfieType]: uri,
                };
                await AsyncStorage.setItem(SELFIE_PREVIEW_CACHE_KEY, JSON.stringify(cache));

                setSelfieStatus((prev) => ({
                    ...prev,
                    [activeSelfieType]: { captured: true, time: now.toISOString(), uri, isLate, geofence: null },
                }));
                Alert.alert('Demo Mode', 'Selfie captured locally.');
            } else {
                Alert.alert('Error', error?.message || 'Failed to save selfie');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleStartDay = async () => {
        if (dayStartData) {
            Alert.alert('Already Started', 'Your day has already been started.');
            return;
        }

        if (!locationZone) {
            Alert.alert('Required', 'Please select a work location.');
            return;
        }
        if (locationZone === 'other' && otherReason.trim() === '') {
            Alert.alert('Required', 'Please specify the reason for "Other" location.');
            return;
        }

        setLoading(true);
        try {
            const userResult = await supabase.auth.getUser();
            const user = userResult?.data?.user;
            if (!user) throw new Error('No user');

            await startLocationTracking();
            setIsOnDuty(true);

            const timeInMins = new Date().getHours() * 60 + new Date().getMinutes();
            let status = 'on_time';
            if (timeInMins > 615) status = 'late';
            if (timeInMins > 660) status = 'severe_late';

            const result = await supabase
                .from('day_starts')
                .upsert(
                    {
                        user_id: user.id,
                        date: format(new Date(), 'yyyy-MM-dd'),
                        location_zone: locationZone,
                        location_zone_other: otherReason || null,
                        login_status: status,
                        location_verified: true,
                        day_plan: 'Started via Mobile',
                        submitted_at: new Date().toISOString(),
                    },
                    { onConflict: 'user_id,date' }
                )
                .select()
                .single();

            if (result.error) throw result.error;

            setDayStartData(result.data);
            Alert.alert('Day Started', 'Your attendance has been marked.');
        } catch (error: any) {
            if (error?.code === '42P01') {
                setDayStartData({ location_zone: locationZone });
                Alert.alert('Demo Mode', 'Day started locally.');
            } else {
                Alert.alert('Error', error?.message || 'An error occurred');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <LinearGradient colors={BG_GRADIENT} style={styles.background} />

            {showCamera ? (
                <Modal animationType="slide" transparent={false} visible>
                    <CameraComponent onCapture={onSelfieCapture} onCancel={() => setShowCamera(false)} />
                </Modal>
            ) : null}

            {/* View Submitted Image Modal */}
            {viewingImage ? (
                <Modal animationType="fade" transparent visible>
                    <View style={styles.imageModalOverlay}>
                        <View style={styles.imageModalContainer}>
                            <View style={styles.imageModalHeader}>
                                <Text style={styles.imageModalTitle}>{viewingImage.label}</Text>
                                {viewingImage.time ? (
                                    <Text style={styles.imageModalTime}>
                                        {format(new Date(viewingImage.time), 'hh:mm:ss a')}
                                    </Text>
                                ) : null}
                                {viewingImage.geofence ? (
                                    <View style={styles.imageModalGeo}>
                                        <MapPin size={12} color={COLORS.success[600]} />
                                        <Text style={styles.imageModalGeoText}>{viewingImage.geofence}</Text>
                                    </View>
                                ) : null}
                            </View>
                            <Image source={{ uri: viewingImage.uri }} style={styles.imageModalImg} resizeMode="cover" />
                            <TouchableOpacity style={styles.imageModalClose} onPress={() => setViewingImage(null)}>
                                <Text style={styles.imageModalCloseText}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            ) : null}

            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <View>
                        <Text style={styles.greeting}>
                            Good {currentTime.getHours() < 12 ? 'Morning' : currentTime.getHours() < 17 ? 'Afternoon' : 'Evening'}
                            {userName ? `, ${userName}` : ''}
                        </Text>
                        <Text style={styles.date}>{format(currentTime, 'EEEE, dd MMMM')}</Text>
                    </View>
                    <StatusBadge status={isOnDuty ? 'on_duty' : 'off_duty'} size="md" />
                </View>

                <View style={styles.clockContainer}>
                    <Text style={styles.clock}>{format(currentTime, 'hh:mm')}</Text>
                    <Text style={styles.clockSeconds}>{format(currentTime, 'ss a')}</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                {/* Thirukural Card — 4+3 word format */}
                {(() => {
                    const kural = getDailyKural();
                    const lines = kural.tamil.split('\n');
                    return (
                        <GlassCard style={styles.kuralCard}>
                            <LinearGradient colors={['#ede9fe', '#dbeafe']} style={styles.kuralGradient} />
                            <View style={styles.kuralHeader}>
                                <View style={styles.kuralIconBox}>
                                    <BookOpen size={18} color="#7c3aed" />
                                </View>
                                <View>
                                    <Text style={styles.kuralChapterText}>{kural.chapter}</Text>
                                    <Text style={styles.kuralMeta}>குறள் #{kural.number}</Text>
                                </View>
                            </View>
                            <View style={styles.kuralBody}>
                                {lines.map((line, i) => {
                                    const words = line.trim().split(' ');
                                    // First line: show 4 words bold + remaining words normal
                                    // Second line: show 3 words bold + remaining normal
                                    const breakAt = i === 0 ? 4 : 3;
                                    const boldPart = words.slice(0, breakAt).join(' ');
                                    const restPart = words.slice(breakAt).join(' ');
                                    return (
                                        <View key={i} style={styles.kuralLineRow}>
                                            <Text style={styles.kuralLineBold}>{boldPart} </Text>
                                            {restPart ? <Text style={styles.kuralLineRest}>{restPart}</Text> : null}
                                        </View>
                                    );
                                })}
                            </View>
                            <View style={styles.kuralDivider} />
                            <Text style={styles.kuralMeaning}>{kural.meaning}</Text>
                        </GlassCard>
                    );
                })()}

                {!dayStartData ? (
                    <GlassCard style={styles.card}>
                        <View style={styles.cardHeader}>
                            <MapPin size={20} color={COLORS.primary[600]} />
                            <Text style={styles.cardTitle}>Work Location</Text>
                        </View>
                        <View style={styles.locationGrid}>
                            {LOCATION_OPTIONS.map((option) => (
                                <TouchableOpacity
                                    key={option.value}
                                    style={[styles.locationOption, locationZone === option.value ? styles.locationOptionSelected : null]}
                                    onPress={() => setLocationZone(option.value)}
                                >
                                    <Text style={styles.locationIcon}>{option.icon}</Text>
                                    <Text style={[styles.locationLabel, locationZone === option.value ? styles.locationLabelSelected : null]}>
                                        {option.label}
                                    </Text>
                                    {locationZone === option.value ? (
                                        <View style={styles.checkIcon}>
                                            <Check size={14} color="#fff" />
                                        </View>
                                    ) : null}
                                </TouchableOpacity>
                            ))}
                        </View>
                        {locationZone === 'other' ? (
                            <RNTextInput
                                style={styles.otherInput}
                                placeholder="Specify location reason..."
                                placeholderTextColor={COLORS.neutral[400]}
                                value={otherReason}
                                onChangeText={setOtherReason}
                            />
                        ) : null}
                    </GlassCard>
                ) : null}

                <GlassCard style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Clock size={20} color={COLORS.primary[600]} />
                        <Text style={styles.cardTitle}>Attendance Windows</Text>
                    </View>

                    <View style={styles.windowList}>
                        {(Object.keys(SELFIE_WINDOWS) as SelfieType[]).map((type) => {
                            const cfg = SELFIE_WINDOWS[type];
                            const status = selfieStatus[type];
                            const captured = status.captured;
                            const open = canCaptureSelfie(type);
                            const isLate = status.isLate;

                            return (
                                <View key={type} style={[styles.windowItem, captured ? styles.windowItemDone : null]}>
                                    <View style={styles.windowInfo}>
                                        <View style={styles.windowLabelRow}>
                                            <Text style={styles.windowLabel}>{cfg.label}</Text>
                                            {isLate ? (
                                                <View style={styles.lateBadge}>
                                                    <AlertTriangle size={10} color="#b45309" />
                                                    <Text style={styles.lateBadgeText}>Late</Text>
                                                </View>
                                            ) : null}
                                            {captured && !isLate ? (
                                                <View style={styles.onTimeBadge}>
                                                    <Check size={10} color="#047857" />
                                                    <Text style={styles.onTimeBadgeText}>On Time</Text>
                                                </View>
                                            ) : null}
                                        </View>
                                        <Text style={styles.windowValue}>
                                            {type === 'morning_login'
                                                ? `9:30 AM – 10:14 AM`
                                                : `Opens at ${cfg.openAt}`}
                                        </Text>
                                        {captured && status.time ? (
                                            <Text style={styles.windowCapturedTime}>
                                                Captured {format(new Date(status.time), 'hh:mm:ss a')}
                                            </Text>
                                        ) : null}
                                        {captured && status.geofence ? (
                                            <View style={styles.windowGeoRow}>
                                                <MapPin size={11} color={COLORS.success[600]} />
                                                <Text style={styles.windowGeoText}>{status.geofence}</Text>
                                            </View>
                                        ) : null}
                                    </View>

                                    <View style={styles.windowActions}>
                                        {captured ? (
                                            <>
                                                <View style={styles.selfieStatusDot} />
                                                {status.uri ? (
                                                    <TouchableOpacity
                                                        style={styles.viewBtn}
                                                        onPress={() => setViewingImage({
                                                            uri: status.uri!,
                                                            label: cfg.label,
                                                            time: status.time,
                                                            geofence: status.geofence,
                                                        })}
                                                    >
                                                        <Eye size={14} color={COLORS.primary[700]} />
                                                        <Text style={styles.viewBtnText}>View</Text>
                                                    </TouchableOpacity>
                                                ) : null}
                                            </>
                                        ) : (
                                            <TouchableOpacity
                                                style={[styles.selfieBtn, !open ? styles.selfieBtnDisabled : null]}
                                                onPress={() => handleOpenSelfie(type)}
                                                disabled={!open}
                                                activeOpacity={0.8}
                                            >
                                                <Camera size={14} color={open ? COLORS.primary[700] : COLORS.neutral[400]} />
                                                <Text style={[styles.selfieBtnText, !open ? styles.selfieBtnTextDisabled : null]}>
                                                    {open ? 'Capture' : 'Not Open'}
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                </GlassCard>

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    background: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },

    header: {
        paddingTop: 60,
        paddingHorizontal: SPACING.xl,
        paddingBottom: SPACING.lg,
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.neutral[200],
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    greeting: {
        ...TYPOGRAPHY.h3,
    },
    date: {
        ...TYPOGRAPHY.caption,
        marginTop: 4,
    },
    clockContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginTop: SPACING.lg,
    },
    clock: {
        ...TYPOGRAPHY.time,
    },
    clockSeconds: {
        fontSize: 24,
        fontWeight: '300',
        color: COLORS.neutral[500],
        marginLeft: 4,
    },

    content: {
        padding: SPACING.xl,
        paddingBottom: 100,
    },

    card: {
        marginBottom: SPACING.lg,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.lg,
        gap: SPACING.sm,
    },
    cardTitle: {
        ...TYPOGRAPHY.h4,
        flex: 1,
    },

    locationGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
    },
    locationOption: {
        width: (width - SPACING.xl * 2 - SPACING.lg * 2 - SPACING.sm) / 2,
        padding: SPACING.lg,
        borderRadius: BORDER_RADIUS.lg,
        backgroundColor: COLORS.neutral[50],
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
        position: 'relative',
    },
    locationOptionSelected: {
        backgroundColor: COLORS.primary[50],
        borderColor: COLORS.primary[500],
    },
    locationIcon: {
        fontSize: 28,
        marginBottom: SPACING.sm,
    },
    locationLabel: {
        ...TYPOGRAPHY.captionBold,
        color: COLORS.neutral[600],
    },
    locationLabelSelected: {
        color: COLORS.primary[700],
    },
    checkIcon: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: COLORS.primary[500],
        alignItems: 'center',
        justifyContent: 'center',
    },
    otherInput: {
        marginTop: SPACING.md,
        backgroundColor: COLORS.neutral[50],
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.lg,
        fontSize: 16,
        color: COLORS.neutral[800],
        borderWidth: 1,
        borderColor: COLORS.neutral[200],
    },

    // Attendance windows
    windowList: {
        gap: SPACING.md,
    },
    windowItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        backgroundColor: COLORS.neutral[50],
        borderWidth: 1,
        borderColor: COLORS.neutral[100],
    },
    windowItemDone: {
        backgroundColor: COLORS.success[50],
        borderColor: COLORS.success[200],
    },
    windowInfo: {
        flex: 1,
        paddingRight: SPACING.sm,
    },
    windowLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        flexWrap: 'wrap',
        marginBottom: 2,
    },
    windowLabel: {
        ...TYPOGRAPHY.captionBold,
        color: COLORS.neutral[800],
        fontSize: 14,
    },
    windowValue: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[500],
        marginBottom: 2,
    },
    windowCapturedTime: {
        fontSize: 11,
        color: COLORS.success[700],
        fontWeight: '600',
        marginTop: 2,
    },
    windowGeoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        marginTop: 2,
    },
    windowGeoText: {
        fontSize: 11,
        color: COLORS.success[600],
    },
    windowActions: {
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: SPACING.xs,
    },
    selfieStatusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: COLORS.success[500],
        marginBottom: 4,
    },
    selfieBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        backgroundColor: COLORS.primary[50],
        borderWidth: 1.5,
        borderColor: COLORS.primary[300],
        borderRadius: BORDER_RADIUS.md,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
    },
    selfieBtnDisabled: {
        backgroundColor: COLORS.neutral[50],
        borderColor: COLORS.neutral[200],
    },
    selfieBtnText: {
        ...TYPOGRAPHY.captionBold,
        color: COLORS.primary[700],
        fontSize: 13,
    },
    selfieBtnTextDisabled: {
        color: COLORS.neutral[400],
    },
    viewBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: COLORS.primary[50],
        borderWidth: 1,
        borderColor: COLORS.primary[200],
        borderRadius: BORDER_RADIUS.sm,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4,
        marginTop: 4,
    },
    viewBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.primary[700],
    },

    // Late / OnTime badges
    lateBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: '#fef3c7',
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    lateBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#b45309',
    },
    onTimeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: COLORS.success[50],
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    onTimeBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#047857',
    },

    // Thirukural card
    kuralCard: {
        marginBottom: SPACING.lg,
        overflow: 'hidden',
        padding: 0,
    },
    kuralGradient: {
        position: 'absolute',
        left: 0, right: 0, top: 0, bottom: 0,
    },
    kuralHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        paddingHorizontal: SPACING.lg,
        paddingTop: SPACING.lg,
        paddingBottom: SPACING.sm,
    },
    kuralIconBox: {
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: '#ede9fe',
        alignItems: 'center',
        justifyContent: 'center',
    },
    kuralChapterText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#7c3aed',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    kuralMeta: {
        fontSize: 12,
        fontWeight: '700',
        color: '#4c1d95',
    },
    kuralBody: {
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm,
        gap: 6,
    },
    kuralLineRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'baseline',
    },
    kuralLineBold: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1e1b4b',
        lineHeight: 26,
    },
    kuralLineRest: {
        fontSize: 16,
        fontWeight: '500',
        color: '#3730a3',
        lineHeight: 26,
    },
    kuralDivider: {
        height: 1,
        backgroundColor: 'rgba(99,102,241,0.2)',
        marginHorizontal: SPACING.lg,
        marginVertical: SPACING.sm,
    },
    kuralMeaning: {
        fontSize: 13,
        lineHeight: 20,
        color: '#4338ca',
        fontStyle: 'italic',
        paddingHorizontal: SPACING.lg,
        paddingBottom: SPACING.lg,
    },

    // View Image Modal
    imageModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.xl,
    },
    imageModalContainer: {
        width: '100%',
        backgroundColor: '#fff',
        borderRadius: BORDER_RADIUS.xl,
        overflow: 'hidden',
    },
    imageModalHeader: {
        padding: SPACING.lg,
        backgroundColor: COLORS.primary[700],
    },
    imageModalTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 2,
    },
    imageModalTime: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.8)',
    },
    imageModalGeo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
    },
    imageModalGeoText: {
        fontSize: 12,
        color: '#a7f3d0',
    },
    imageModalImg: {
        width: '100%',
        height: 360,
        backgroundColor: '#000',
    },
    imageModalClose: {
        padding: SPACING.lg,
        alignItems: 'center',
        backgroundColor: COLORS.neutral[50],
    },
    imageModalCloseText: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.primary[700],
    },
});
