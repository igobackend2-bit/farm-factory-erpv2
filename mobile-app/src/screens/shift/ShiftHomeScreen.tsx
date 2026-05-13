import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Modal, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, MapPin, Clock, Zap, Coffee, LogOut, CheckCircle2, Play, IndianRupee, CreditCard, Quote, BookOpen } from 'lucide-react-native';
import { format } from 'date-fns';

import { useShiftUserStatus } from '../../hooks/useShiftUserStatus';
import { useShiftSession } from '../../hooks/useShiftSession';
import { getCurrentLocation, startLocationTracking } from '../../services/locationService';
import CameraComponent from '../../components/CameraComponent';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { COLORS, GRADIENT_COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../../theme';
import { getDailyKural } from '../../constants/thirukurals';

// Reusing location logic from Home
const LOCATION_OPTIONS = [
    { value: 'back_office', label: 'Back Office', icon: '🏢' },
    { value: 'head_office', label: 'Head Office', icon: '🏛️' },
    { value: 'site', label: 'Project Site', icon: '🏗️' },
    { value: 'other', label: 'Other', icon: '📍' },
];

export default function ShiftHomeScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const { refetch: refetchUserStatus, userRole } = useShiftUserStatus(); // Just to ensure we stay updated
    const { currentSession, todayStats, isLoading, startShift, isStarting } = useShiftSession();

    // Login State
    const [locationZone, setLocationZone] = useState('');
    const [otherReason, setOtherReason] = useState('');
    const [dayPlan, setDayPlan] = useState('');
    const [showCamera, setShowCamera] = useState(false);
    const [locationBusy, setLocationBusy] = useState(false);

    // Dashboard Timer State
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const handleLogin = async (selfieUrl: string) => {
        setShowCamera(false);

        setLocationBusy(true);
        const location = await getCurrentLocation();
        setLocationBusy(false);

        if (!location) {
            Alert.alert('Location Required', 'Please enable location and try again.');
            return;
        }

        await startLocationTracking();

        const result = await startShift(selfieUrl, dayPlan, {
            lat: location.latitude,
            lng: location.longitude,
        });
        if (result.success) {
            Alert.alert('Success', 'Shift started successfully!');
        } else {
            Alert.alert('Error', result.error || 'Failed to start shift');
        }
    };

    const handleCameraOpen = () => {
        if (!locationZone) {
            Alert.alert('Required', 'Please select a location.');
            return;
        }
        if (locationZone === 'other' && !otherReason.trim()) {
            Alert.alert('Required', 'Please specify other location.');
            return;
        }
        if (!dayPlan.trim()) {
            Alert.alert('Required', 'Please enter your day plan.');
            return;
        }
        setShowCamera(true);
    };

    if (isLoading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={COLORS.primary[500]} />
            </View>
        );
    }

    // --- RENDER LOGIN VIEW ---
    if (!currentSession) {
        return (
            <LinearGradient colors={GRADIENT_COLORS.background as [string, string, ...string[]]} style={styles.container}>
                <View style={styles.loginHeader}>
                    <Text style={styles.loginTitle}>Shift Workspace</Text>
                    <Text style={styles.loginSubtitle}>Complete the checklist to start your shift</Text>
                </View>

                <Modal animationType="slide" transparent={false} visible={showCamera}>
                    <CameraComponent onCapture={handleLogin} onCancel={() => setShowCamera(false)} />
                </Modal>

                <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}>
                    <GlassCard style={styles.flowCard}>
                        <Text style={styles.flowTitle}>Today Flow</Text>
                        <View style={styles.flowSteps}>
                            <Text style={styles.flowStep}>1. Select location</Text>
                            <Text style={styles.flowStep}>2. Add day plan</Text>
                            <Text style={styles.flowStep}>3. Capture selfie</Text>
                            <Text style={styles.flowStep}>4. Start shift</Text>
                        </View>
                    </GlassCard>

                    {/* Location Selection */}
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
                                    {locationZone === option.value && (
                                        <View style={styles.checkIcon}>
                                            <CheckCircle2 size={14} color="#fff" />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                        {locationZone === 'other' && (
                            <TextInput
                                style={styles.input}
                                placeholder="Specify location..."
                                value={otherReason}
                                onChangeText={setOtherReason}
                            />
                        )}
                    </GlassCard>

                    {/* Pro Max Protocol & Wisdom Section */}
                    <View style={{ marginBottom: SPACING.lg, gap: 12 }}>
                        {/* Horizontal Comparison Protocol */}
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <GlassCard style={{ flex: 1, padding: 16 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                    <Clock size={14} color={COLORS.primary[500]} />
                                    <Text style={{ marginLeft: 6, fontSize: 10, fontWeight: '800', color: COLORS.neutral[500], letterSpacing: 1 }}>IDEAL</Text>
                                </View>
                                <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.neutral[900] }}>10:00 AM</Text>
                                <View style={{ height: 2, width: 20, backgroundColor: COLORS.primary[500], marginTop: 4 }} />
                            </GlassCard>

                            <GlassCard style={{ flex: 1, padding: 16 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                    <Zap size={14} color={COLORS.warning[500]} />
                                    <Text style={{ marginLeft: 6, fontSize: 10, fontWeight: '800', color: COLORS.neutral[500], letterSpacing: 1 }}>GRACE</Text>
                                </View>
                                <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.warning[600] }}>10:14:59</Text>
                                <View style={{ height: 2, width: 20, backgroundColor: COLORS.warning[500], marginTop: 4 }} />
                            </GlassCard>
                        </View>

                        {/* Wisdom Card */}
                        <GlassCard style={{ padding: 20, backgroundColor: COLORS.neutral[900], overflow: 'hidden' }}>
                            <View style={{ position: 'absolute', top: -10, right: -10, opacity: 0.1 }}>
                                <Quote size={80} color="#fff" />
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                                <BookOpen size={14} color="#fff" />
                                <Text style={{ marginLeft: 6, fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1 }}>
                                    WISDOM SYNC
                                </Text>
                            </View>

                            <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff', textAlign: 'center', lineHeight: 24, marginBottom: 8, fontStyle: 'italic' }}>
                                "{getDailyKural().tamil}"
                            </Text>
                        </GlassCard>
                    </View>

                    {/* Day Plan */}
                    <GlassCard style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Clock size={20} color={COLORS.primary[600]} />
                            <Text style={styles.cardTitle}>Day Plan</Text>
                        </View>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            placeholder="What do you plan to achieve today?"
                            value={dayPlan}
                            onChangeText={setDayPlan}
                            multiline
                            textAlignVertical="top"
                        />
                    </GlassCard>

                    <Button
                        title="Capture Selfie and Start"
                        onPress={handleCameraOpen}
                        loading={isStarting || locationBusy}
                        disabled={locationBusy}
                        style={styles.mainBtn}
                        icon={<Camera size={20} color="white" />}
                    />
                </ScrollView>
            </LinearGradient>
        );
    }

    // --- RENDER DASHBOARD VIEW ---
    const progressColor = todayStats?.isOvertime ? COLORS.warning[500] : COLORS.primary[500];
    const workingHours = todayStats?.hoursWorked?.toFixed(1) || '0.0';

    return (
        <LinearGradient colors={GRADIENT_COLORS.background as [string, string, ...string[]]} style={styles.container}>
            <View style={[styles.header, { marginTop: insets.top }]}>
                <View>
                    <Text style={styles.greeting}>Shift Dashboard</Text>
                    <Text style={styles.date}>{format(currentTime, 'EEEE, MMM d')}</Text>
                </View>
                <StatusBadge status="live" />
            </View>

            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 100 }]}>
                {/* Main Stats Card */}
                <GlassCard style={styles.statsCard}>
                    <View style={styles.statsRow}>
                        <View style={styles.timerContainer}>
                            <Text style={styles.timerLabel}>NET HOURS</Text>
                            <Text style={[styles.timerValue, { color: progressColor }]}>{workingHours}</Text>
                            <Text style={styles.timerSub}>/ {currentSession.targetHours} hrs</Text>
                        </View>
                        <View style={styles.progressContainer}>
                            <View style={styles.progressBarBg}>
                                <View style={[styles.progressBarFill, { width: `${todayStats?.progressPercent || 0}%`, backgroundColor: progressColor }]} />
                            </View>
                            <Text style={styles.progressText}>
                                {todayStats?.progressPercent ? Math.round(todayStats.progressPercent) : 0}% of target
                            </Text>
                        </View>
                    </View>
                </GlassCard>

                {/* Navigation Grid */}
                <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
                <View style={styles.navGrid}>
                    <TouchableOpacity
                        style={styles.navItem}
                        onPress={() => navigation.navigate('ShiftHourly')}
                    >
                        <View style={[styles.navIcon, { backgroundColor: COLORS.primary[100] }]}>
                            <Zap size={24} color={COLORS.primary[600]} />
                        </View>
                        <Text style={styles.navLabel}>Hourly Plan Report</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.navItem}
                        onPress={() => navigation.navigate('ShiftBreak')}
                    >
                        <View style={[styles.navIcon, { backgroundColor: COLORS.warning[100] }]}>
                            <Coffee size={24} color={COLORS.warning[600]} />
                        </View>
                        <Text style={styles.navLabel}>Break Tracker</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.navItem}
                        onPress={() => navigation.navigate('ShiftEOD')}
                    >
                        <View style={[styles.navIcon, { backgroundColor: COLORS.success[100] }]}>
                            <CheckCircle2 size={24} color={COLORS.success[600]} />
                        </View>
                        <Text style={styles.navLabel}>EOD Report</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.navItem}
                        onPress={() => navigation.navigate('ShiftLogout')}
                    >
                        <View style={[styles.navIcon, { backgroundColor: COLORS.error[100] }]}>
                            <LogOut size={24} color={COLORS.error[600]} />
                        </View>
                        <Text style={styles.navLabel}>Close Shift</Text>
                    </TouchableOpacity>

                    {(userRole === 'director' || userRole === 'accounts') && (
                        <TouchableOpacity
                            style={styles.navItem}
                            onPress={() => navigation.navigate('PaymentAudit')}
                        >
                            <View style={[styles.navIcon, { backgroundColor: COLORS.primary[100] }]}>
                                <IndianRupee size={24} color={COLORS.primary[600]} />
                            </View>
                            <Text style={styles.navLabel}>Payment Audit</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={styles.navItem}
                        onPress={() => navigation.navigate('ShiftPaymentRequest')}
                    >
                        <View style={[styles.navIcon, { backgroundColor: COLORS.primary[100] }]}>
                            <CreditCard size={24} color={COLORS.primary[600]} />
                        </View>
                            <Text style={styles.navLabel}>Payment Request</Text>
                    </TouchableOpacity>
                </View>

                {todayStats?.isOvertime && (
                    <View style={styles.overtimeAlert}>
                        <Text style={styles.overtimeText}>You have met your target hours!</Text>
                    </View>
                )}
            </ScrollView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { padding: SPACING.lg },

    // Login Styles
    loginHeader: {
        paddingTop: 80,
        paddingBottom: SPACING.lg,
        paddingHorizontal: SPACING.xl,
    },
    loginTitle: { ...TYPOGRAPHY.h1, color: COLORS.neutral[900] },
    loginSubtitle: { ...TYPOGRAPHY.body, color: COLORS.neutral[500] },

    flowCard: {
        marginBottom: SPACING.lg,
    },
    flowTitle: {
        ...TYPOGRAPHY.label,
        marginBottom: SPACING.sm,
    },
    flowSteps: {
        gap: SPACING.xs,
    },
    flowStep: {
        ...TYPOGRAPHY.captionBold,
        color: COLORS.neutral[700],
    },

    card: { marginBottom: SPACING.lg },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
    cardTitle: { ...TYPOGRAPHY.h4, color: COLORS.neutral[900] },

    locationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    locationOption: {
        width: '48%',
        padding: SPACING.md,
        backgroundColor: COLORS.neutral[50],
        borderRadius: BORDER_RADIUS.md,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    locationOptionSelected: { backgroundColor: COLORS.primary[50], borderColor: COLORS.primary[500] },
    locationIcon: { fontSize: 24, marginBottom: SPACING.xs },
    locationLabel: { ...TYPOGRAPHY.captionBold, color: COLORS.neutral[600] },
    locationLabelSelected: { color: COLORS.primary[700] },
    checkIcon: { position: 'absolute', top: 5, right: 5 },

    input: {
        backgroundColor: COLORS.glass.white,
        borderWidth: 1,
        borderColor: COLORS.neutral[200],
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        fontSize: 16,
    },
    textArea: { minHeight: 100 },
    mainBtn: { height: 56, marginTop: SPACING.sm },

    // Dashboard Styles
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        backgroundColor: 'rgba(255,255,255,0.8)',
    },
    greeting: { ...TYPOGRAPHY.h3 },
    date: { ...TYPOGRAPHY.caption },

    statsCard: { marginBottom: SPACING.xxl },
    statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    timerContainer: { flex: 1 },
    timerLabel: { ...TYPOGRAPHY.label, marginBottom: 4 },
    timerValue: { fontSize: 42, fontWeight: '700' },
    timerSub: { ...TYPOGRAPHY.caption, color: COLORS.neutral[500] },

    progressContainer: { flex: 1, paddingLeft: SPACING.lg },
    progressBarBg: { height: 8, backgroundColor: COLORS.neutral[200], borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
    progressBarFill: { height: '100%', borderRadius: 4 },
    progressText: { ...TYPOGRAPHY.captionBold, textAlign: 'right', color: COLORS.neutral[600] },

    sectionTitle: { ...TYPOGRAPHY.label, marginLeft: SPACING.xs, marginBottom: SPACING.md },
    navGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
    navItem: {
        width: '47%',
        backgroundColor: COLORS.glass.white,
        padding: SPACING.lg,
        borderRadius: BORDER_RADIUS.lg,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    navIcon: { padding: SPACING.md, borderRadius: BORDER_RADIUS.round, marginBottom: SPACING.md },
    navLabel: { ...TYPOGRAPHY.bodyBold, color: COLORS.neutral[800] },

    overtimeAlert: {
        marginTop: SPACING.xl,
        padding: SPACING.md,
        backgroundColor: COLORS.warning[100],
        borderRadius: BORDER_RADIUS.md,
        alignItems: 'center',
    },
    overtimeText: { ...TYPOGRAPHY.captionBold, color: COLORS.warning[700] },
});
