import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Coffee, Play, Square, Clock, History } from 'lucide-react-native';
import { format } from 'date-fns';

import { useShiftSession } from '../../hooks/useShiftSession';
import { useShiftBreaks } from '../../hooks/useShiftBreaks';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { COLORS, GRADIENT_COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../../theme';

export default function ShiftBreakScreen() {
    const insets = useSafeAreaInsets();
    const { currentSession } = useShiftSession();
    const { isOnBreak, breaks, activeBreak, startBreak, endBreak, totalBreakMinutes } = useShiftBreaks(currentSession?.id);
    const [timer, setTimer] = useState(0);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isOnBreak && activeBreak) {
            // Calculate initial elapsed time
            const start = new Date(activeBreak.breakStart).getTime();
            const now = new Date().getTime();
            setTimer(Math.floor((now - start) / 1000));

            interval = setInterval(() => {
                const start = new Date(activeBreak.breakStart).getTime();
                const now = new Date().getTime();
                setTimer(Math.floor((now - start) / 1000));
            }, 1000);
        } else {
            setTimer(0);
        }
        return () => clearInterval(interval);
    }, [isOnBreak, activeBreak]);

    const formatTimer = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleStartBreak = async () => {
        await startBreak();
    };

    const handleEndBreak = async () => {
        await endBreak();
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

    return (
        <LinearGradient colors={GRADIENT_COLORS.background as [string, string, ...string[]]} style={styles.container}>
            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}>
                {/* Header */}
                <View style={[styles.header, { marginTop: insets.top + SPACING.md }]}>
                    <Text style={styles.title}>Break Control</Text>
                    <Text style={styles.subtitle}>Manage your rest periods</Text>
                </View>

                {/* Main Timer Card */}
                <GlassCard style={[styles.mainCard, isOnBreak ? styles.activeCard : null]}>
                    <View style={styles.iconContainer}>
                        <View style={[styles.iconCircle, isOnBreak ? styles.activeIconCircle : null]}>
                            <Coffee size={40} color={isOnBreak ? COLORS.warning[500] : COLORS.neutral[500]} />
                        </View>
                    </View>

                    <Text style={[styles.timer, isOnBreak ? styles.activeTimer : null]}>
                        {isOnBreak ? formatTimer(timer) : '00:00'}
                    </Text>

                    <View style={[styles.statusBadge, isOnBreak ? styles.activeBadge : styles.inactiveBadge]}>
                        <Text style={[styles.statusText, isOnBreak ? styles.activeStatusText : styles.inactiveStatusText]}>
                            {isOnBreak ? 'ON BREAK' : 'WORKING'}
                        </Text>
                    </View>

                    <View style={styles.actionButtonContainer}>
                        {isOnBreak ? (
                            <Button
                                title="End Break"
                                onPress={handleEndBreak}
                                variant="danger"
                                icon={<Square size={20} color="white" />}
                                style={styles.actionButton}
                            />
                        ) : (
                            <Button
                                title="Start Break"
                                onPress={handleStartBreak}
                                style={[styles.actionButton, { backgroundColor: COLORS.warning[500] }]}
                                icon={<Play size={20} color="white" />}
                            />
                        )}
                    </View>
                </GlassCard>

                {/* History Section */}
                <View style={styles.historySection}>
                    <View style={styles.historyHeader}>
                        <History size={16} color={COLORS.neutral[500]} />
                        <Text style={styles.historyTitle}>TODAY'S BREAKS</Text>
                    </View>

                    <GlassCard style={styles.historyCard}>
                        {breaks.length === 0 ? (
                            <Text style={styles.emptyText}>No breaks taken today</Text>
                        ) : (
                            breaks.map((b, index) => (
                                <View key={b.id} style={[
                                    styles.historyItem,
                                    index !== breaks.length - 1 && styles.historyItemBorder
                                ]}>
                                    <View style={styles.historyLeft}>
                                        <View style={styles.historyIcon}>
                                            <Clock size={14} color={COLORS.neutral[500]} />
                                        </View>
                                        <Text style={styles.historyTime}>
                                            {format(new Date(b.breakStart), 'h:mm a')}
                                            {b.breakEnd && ` - ${format(new Date(b.breakEnd), 'h:mm a')}`}
                                        </Text>
                                    </View>
                                    <View style={styles.historyRight}>
                                        <View style={styles.durationBadge}>
                                            <Text style={styles.durationText}>
                                                {Math.round(b.durationMinutes || 0)}m
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            ))
                        )}
                    </GlassCard>

                    <View style={styles.totalContainer}>
                        <Text style={styles.totalLabel}>Total Break Time:</Text>
                        <Text style={styles.totalValue}>{Math.round(totalBreakMinutes)} mins</Text>
                    </View>
                </View>
            </ScrollView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
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
    mainCard: {
        padding: SPACING.xl,
        alignItems: 'center',
        marginBottom: SPACING.xl,
    },
    activeCard: {
        borderColor: COLORS.warning[400],
        borderWidth: 1,
    },
    iconContainer: {
        marginBottom: SPACING.lg,
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: COLORS.neutral[100],
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.neutral[200],
    },
    activeIconCircle: {
        backgroundColor: COLORS.warning[50],
        borderColor: COLORS.warning[200],
    },
    timer: {
        fontSize: 48,
        fontWeight: '700',
        color: COLORS.neutral[300],
        fontVariant: ['tabular-nums'],
        marginBottom: SPACING.md,
    },
    activeTimer: {
        color: COLORS.warning[500],
    },
    statusBadge: {
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.round,
        backgroundColor: COLORS.neutral[200],
        marginBottom: SPACING.xl,
    },
    activeBadge: {
        backgroundColor: COLORS.warning[100],
    },
    inactiveBadge: {
        backgroundColor: COLORS.neutral[100],
        borderWidth: 1,
        borderColor: COLORS.neutral[200],
    },
    statusText: {
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 1,
    },
    activeStatusText: {
        color: COLORS.warning[700],
    },
    inactiveStatusText: {
        color: COLORS.neutral[500],
    },
    actionButtonContainer: {
        width: '100%',
    },
    actionButton: {
        width: '100%',
        height: 56,
    },
    historySection: {
        marginTop: SPACING.md,
    },
    historyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        marginBottom: SPACING.sm,
        paddingLeft: SPACING.xs,
    },
    historyTitle: {
        ...TYPOGRAPHY.label,
        color: COLORS.neutral[500],
    },
    historyCard: {
        padding: 0,
        overflow: 'hidden',
    },
    emptyText: {
        textAlign: 'center',
        padding: SPACING.lg,
        color: COLORS.neutral[400],
        fontStyle: 'italic',
    },
    historyItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.md,
        backgroundColor: 'rgba(255,255,255,0.4)',
    },
    historyItemBorder: {
        borderBottomWidth: 1,
        borderBottomColor: COLORS.neutral[200],
    },
    historyLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    historyIcon: {
        padding: 6,
        backgroundColor: COLORS.neutral[100],
        borderRadius: BORDER_RADIUS.sm,
    },
    historyTime: {
        ...TYPOGRAPHY.body,
        color: COLORS.neutral[800],
    },
    historyRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    durationBadge: {
        backgroundColor: COLORS.neutral[100],
        paddingHorizontal: SPACING.sm,
        paddingVertical: 2,
        borderRadius: BORDER_RADIUS.sm,
        borderWidth: 1,
        borderColor: COLORS.neutral[200],
    },
    durationText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.neutral[600],
    },
    totalContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.sm,
        marginTop: SPACING.sm,
    },
    totalLabel: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[500],
    },
    totalValue: {
        ...TYPOGRAPHY.captionBold,
        color: COLORS.warning[600],
    },
    errorText: {
        textAlign: 'center',
        color: COLORS.neutral[500],
    },
});
