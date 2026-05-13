import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Modal, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LogOut, Camera, CheckCircle2, AlertTriangle } from 'lucide-react-native';

import { useShiftSession } from '../../hooks/useShiftSession';
import { useShiftEOD } from '../../hooks/useShiftEOD';
import { getCurrentLocation, stopLocationTracking } from '../../services/locationService';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import CameraComponent from '../../components/CameraComponent';
import { COLORS, GRADIENT_COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../../theme';

export default function ShiftLogoutScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const { currentSession, endShift, isEnding } = useShiftSession();
    const { eodSummary, loading: eodLoading } = useShiftEOD(currentSession?.id);
    const [showCamera, setShowCamera] = useState(false);
    const [locationBusy, setLocationBusy] = useState(false);

    const handleLogout = async (selfieUrl: string) => {
        setShowCamera(false);

        setLocationBusy(true);
        const location = await getCurrentLocation();
        setLocationBusy(false);

        if (!location) {
            Alert.alert('Location Required', 'Please enable location and try again.');
            return;
        }

        const result = await endShift(selfieUrl, {
            lat: location.latitude,
            lng: location.longitude,
        });
        if (result.success) {
            await stopLocationTracking();
            const successMessage = result.hasLop
                ? `Shift ended. LOP calculated for ${result.lopHours} hour(s) due to working below 9 hours.`
                : 'Shift ended successfully.';
            Alert.alert('Success', successMessage, [
                { text: 'OK', onPress: () => navigation.navigate('ShiftHome') }
            ]);
        } else {
            Alert.alert('Error', result.error || 'Failed to end shift');
        }
    };

    if (!currentSession) {
        return (
            <LinearGradient colors={GRADIENT_COLORS.background as [string, string, ...string[]]} style={styles.container}>
                <View style={[styles.content, { paddingTop: insets.top + SPACING.xl }]}>
                    <Text style={styles.errorText}>No active shift session.</Text>
                </View>
            </LinearGradient>
        );
    }

    if (eodLoading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={COLORS.primary[500]} />
            </View>
        );
    }

    const hasEOD = !!eodSummary;
    const now = new Date();
    const shiftStart = new Date(currentSession.shiftStart);
    const workedMinutes = Math.max(0, Math.round((now.getTime() - shiftStart.getTime()) / (1000 * 60)) - currentSession.totalBreakMinutes);
    const workedHours = workedMinutes / 60;
    const projectedLopHours = Math.max(0, Number((9 - workedHours).toFixed(2)));

    return (
        <LinearGradient colors={GRADIENT_COLORS.background as [string, string, ...string[]]} style={styles.container}>
            <Modal animationType="slide" transparent={false} visible={showCamera}>
                <CameraComponent onCapture={handleLogout} onCancel={() => setShowCamera(false)} />
            </Modal>

            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}>
                {/* Header */}
                <View style={[styles.header, { marginTop: insets.top + SPACING.md }]}>
                    <Text style={styles.title}>End Shift</Text>
                    <Text style={styles.subtitle}>Complete your day and log out</Text>
                </View>

                {/* EOD Status Card */}
                <GlassCard style={[styles.card, hasEOD ? styles.cardSuccess : styles.cardWarning]}>
                    <View style={styles.cardHeader}>
                        {hasEOD ? (
                            <CheckCircle2 size={24} color={COLORS.success[600]} />
                        ) : (
                            <AlertTriangle size={24} color={COLORS.warning[600]} />
                        )}
                        <Text style={styles.cardTitle}>
                            {hasEOD ? 'EOD Report Submitted' : 'EOD Report Missing'}
                        </Text>
                    </View>
                    <Text style={styles.cardText}>
                        {hasEOD
                            ? 'You have submitted your daily summary. You are ready to log out.'
                            : 'You must submit your End of Day report before ending your shift.'}
                    </Text>
                    {!hasEOD && (
                        <Button
                            title="Go to EOD Report"
                            onPress={() => navigation.navigate('ShiftEOD')}
                            style={styles.actionBtn}
                        />
                    )}
                </GlassCard>

                <GlassCard style={styles.hoursCard}>
                    <Text style={styles.hoursTitle}>Work Hours Check</Text>
                    <Text style={styles.hoursValue}>{workedHours.toFixed(2)} hours logged</Text>
                    <Text style={styles.hoursHint}>Minimum for no LOP: 9.00 hours</Text>
                    {projectedLopHours > 0 ? (
                        <Text style={styles.hoursWarning}>If you logout now, projected LOP is {projectedLopHours} hour(s).</Text>
                    ) : (
                        <Text style={styles.hoursGood}>You have completed minimum required hours.</Text>
                    )}
                </GlassCard>

                {/* Logout Action */}
                <GlassCard style={styles.logoutCard}>
                    <View style={styles.logoutHeader}>
                        <LogOut size={32} color={COLORS.error[500]} />
                        <Text style={styles.logoutTitle}>Ready to leave?</Text>
                    </View>
                    <Text style={styles.logoutText}>
                        Take a selfie to verify your logout time and location.
                    </Text>

                    <Button
                        title="Capture Selfie & End Shift"
                        onPress={() => setShowCamera(true)}
                        disabled={!hasEOD || isEnding || locationBusy}
                        loading={isEnding || locationBusy}
                        variant="danger"
                        style={styles.logoutBtn}
                        icon={<Camera size={20} color="white" />}
                    />
                </GlassCard>
            </ScrollView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        padding: SPACING.lg,
    },
    header: {
        marginBottom: SPACING.xl,
    },
    title: {
        ...TYPOGRAPHY.h1,
        color: COLORS.neutral[900],
    },
    subtitle: {
        ...TYPOGRAPHY.body,
        color: COLORS.neutral[500],
        marginTop: SPACING.xs,
    },
    card: {
        padding: SPACING.lg,
        marginBottom: SPACING.xl,
        borderWidth: 1,
    },
    cardSuccess: {
        borderColor: COLORS.success[200],
        backgroundColor: 'rgba(240, 253, 244, 0.6)',
    },
    cardWarning: {
        borderColor: COLORS.warning[200],
        backgroundColor: 'rgba(255, 251, 235, 0.6)',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        marginBottom: SPACING.sm,
    },
    cardTitle: {
        ...TYPOGRAPHY.h4,
        color: COLORS.neutral[900],
    },
    cardText: {
        ...TYPOGRAPHY.body,
        color: COLORS.neutral[700],
        marginBottom: SPACING.md,
    },
    actionBtn: {
        marginTop: SPACING.xs,
    },
    hoursCard: {
        padding: SPACING.lg,
        marginBottom: SPACING.xl,
    },
    hoursTitle: {
        ...TYPOGRAPHY.h4,
        color: COLORS.neutral[900],
        marginBottom: SPACING.xs,
    },
    hoursValue: {
        ...TYPOGRAPHY.h3,
        color: COLORS.primary[700],
    },
    hoursHint: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[500],
        marginTop: SPACING.xs,
    },
    hoursWarning: {
        ...TYPOGRAPHY.body,
        color: COLORS.warning[700],
        marginTop: SPACING.sm,
    },
    hoursGood: {
        ...TYPOGRAPHY.body,
        color: COLORS.success[700],
        marginTop: SPACING.sm,
    },
    logoutCard: {
        padding: SPACING.xl,
        alignItems: 'center',
        gap: SPACING.md,
    },
    logoutHeader: {
        alignItems: 'center',
        gap: SPACING.sm,
    },
    logoutTitle: {
        ...TYPOGRAPHY.h3,
        color: COLORS.neutral[900],
    },
    logoutText: {
        textAlign: 'center',
        color: COLORS.neutral[600],
        marginBottom: SPACING.sm,
    },
    logoutBtn: {
        width: '100%',
        height: 56,
    },
    errorText: {
        textAlign: 'center',
        color: COLORS.neutral[500],
    },
});
