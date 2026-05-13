import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    TouchableOpacity,
} from 'react-native';
import { supabase } from '../../services/supabase';
import { AppScreen, GlassCard } from '../../components/ui';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../theme';
import { AlertTriangle, Calendar, Clock } from 'lucide-react-native';
import { format } from 'date-fns';

interface LOPSummary {
    total_days: number;
    total_entries: number;
    pending_reversals: number;
    reversed_count: number;
}

interface LOPEntry {
    id: string;
    date: string;
    reason: string;
    hours_lost: number;
    status: string;
    reversal_status: string | null;
}

export default function LOPScreen({ navigation }: any) {
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<LOPSummary>({
        total_days: 0,
        total_entries: 0,
        pending_reversals: 0,
        reversed_count: 0,
    });
    const [entries, setEntries] = useState<LOPEntry[]>([]);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchLOPData();
    }, []);

    const fetchLOPData = async () => {
        setLoading(true);
        try {
            const userResult = await supabase.auth.getUser();
            const user = userResult?.data?.user;
            if (!user) {
                setError('User not authenticated');
                return;
            }

            const { data: lopData, error: lopError } = await supabase
                .from('lop_entries')
                .select('*')
                .eq('employee_id', user.id)
                .order('date', { ascending: false })
                .limit(50);

            if (lopError) {
                console.error('LOP fetch error:', lopError);
                setError('Failed to load LOP data');
                return;
            }

            if (lopData) {
                setEntries(lopData);

                // Calculate summary
                const totalHours = lopData.reduce((sum, entry) => sum + (entry.hours_lost || 0), 0);
                const totalDays = Math.ceil(totalHours / 8);
                const pendingReversals = lopData.filter(e => e.reversal_status === 'pending').length;
                const reversedCount = lopData.filter(e => e.reversal_status === 'approved').length;

                setSummary({
                    total_days: totalDays,
                    total_entries: lopData.length,
                    pending_reversals: pendingReversals,
                    reversed_count: reversedCount,
                });
            }

            setError('');
        } catch (err) {
            console.error('Error fetching LOP data:', err);
            setError('Unable to load LOP data');
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'approved': return COLORS.success[500];
            case 'rejected': return COLORS.error[500];
            case 'pending': return COLORS.warning[500];
            default: return COLORS.neutral[500];
        }
    };

    const getReversalStatusText = (status: string | null) => {
        switch (status) {
            case 'approved': return 'Reversed';
            case 'rejected': return 'Reversal Rejected';
            case 'pending': return 'Reversal Pending';
            default: return 'Active';
        }
    };

    if (loading) {
        return (
            <AppScreen>
                <View style={styles.loaderContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary[600]} />
                    <Text style={styles.loaderText}>Loading LOP data...</Text>
                </View>
            </AppScreen>
        );
    }

    return (
        <AppScreen>
            <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
                {/* Summary Cards */}
                <View style={styles.summaryContainer}>
                    <GlassCard style={styles.summaryCard}>
                        <View style={styles.summaryHeader}>
                            <AlertTriangle size={20} color={COLORS.error[500]} />
                            <Text style={styles.summaryTitle}>Total LOP Days</Text>
                        </View>
                        <Text style={styles.summaryValue}>{summary.total_days}</Text>
                    </GlassCard>

                    <GlassCard style={styles.summaryCard}>
                        <View style={styles.summaryHeader}>
                            <Calendar size={20} color={COLORS.primary[500]} />
                            <Text style={styles.summaryTitle}>Total Entries</Text>
                        </View>
                        <Text style={styles.summaryValue}>{summary.total_entries}</Text>
                    </GlassCard>

                    <GlassCard style={styles.summaryCard}>
                        <View style={styles.summaryHeader}>
                            <Clock size={20} color={COLORS.warning[500]} />
                            <Text style={styles.summaryTitle}>Pending Reversals</Text>
                        </View>
                        <Text style={styles.summaryValue}>{summary.pending_reversals}</Text>
                    </GlassCard>
                </View>

                {/* Great job message if no LOP */}
                {summary.total_entries === 0 && (
                    <GlassCard style={styles.noLOPContainer}>
                        <Text style={styles.noLOPTitle}>Great job! 🎉</Text>
                        <Text style={styles.noLOPText}>
                            You have no loss of pay records. Keep up the excellent work!
                        </Text>
                    </GlassCard>
                )}

                {/* LOP Entries */}
                {entries.length > 0 && (
                    <View style={styles.entriesContainer}>
                        <Text style={styles.sectionTitle}>LOP History</Text>
                        {entries.map((entry) => (
                            <GlassCard key={entry.id} style={styles.entryCard}>
                                <View style={styles.entryHeader}>
                                    <Text style={styles.entryDate}>
                                        {format(new Date(entry.date), 'MMM dd, yyyy')}
                                    </Text>
                                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(entry.reversal_status || 'active') }]}>
                                        <Text style={styles.statusText}>
                                            {getReversalStatusText(entry.reversal_status)}
                                        </Text>
                                    </View>
                                </View>

                                <Text style={styles.entryReason}>{entry.reason}</Text>

                                <View style={styles.entryDetails}>
                                    <Text style={styles.hoursLost}>
                                        Hours Lost: {entry.hours_lost}
                                    </Text>
                                    <Text style={styles.status}>
                                        Status: {entry.status}
                                    </Text>
                                </View>

                                {entry.reversal_status === 'pending' && (
                                    <TouchableOpacity
                                        style={styles.reversalButton}
                                        onPress={() => navigation.navigate('LOPReversal')}
                                    >
                                        <Text style={styles.reversalButtonText}>Request Reversal</Text>
                                    </TouchableOpacity>
                                )}
                            </GlassCard>
                        ))}
                    </View>
                )}

                {error && (
                    <GlassCard style={styles.errorContainer}>
                        <Text style={styles.errorText}>{error}</Text>
                        <TouchableOpacity style={styles.retryButton} onPress={fetchLOPData}>
                            <Text style={styles.retryText}>Retry</Text>
                        </TouchableOpacity>
                    </GlassCard>
                )}
            </ScrollView>
        </AppScreen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: SPACING.md,
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loaderText: {
        ...TYPOGRAPHY.body,
        color: COLORS.neutral[600],
        marginTop: SPACING.sm,
    },
    summaryContainer: {
        flexDirection: 'row',
        gap: SPACING.sm,
        marginBottom: SPACING.lg,
    },
    summaryCard: {
        flex: 1,
        padding: SPACING.md,
        alignItems: 'center',
    },
    summaryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        marginBottom: SPACING.xs,
    },
    summaryTitle: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[600],
        fontWeight: '500',
    },
    summaryValue: {
        ...TYPOGRAPHY.h2,
        color: COLORS.neutral[900],
        fontWeight: '700',
    },
    noLOPContainer: {
        padding: SPACING.xl,
        alignItems: 'center',
        marginBottom: SPACING.lg,
    },
    noLOPTitle: {
        ...TYPOGRAPHY.h3,
        color: COLORS.success[600],
        fontWeight: '700',
        marginBottom: SPACING.sm,
    },
    noLOPText: {
        ...TYPOGRAPHY.body,
        color: COLORS.neutral[600],
        textAlign: 'center',
        lineHeight: 24,
    },
    entriesContainer: {
        marginBottom: SPACING.lg,
    },
    sectionTitle: {
        ...TYPOGRAPHY.h4,
        color: COLORS.neutral[900],
        fontWeight: '600',
        marginBottom: SPACING.md,
    },
    entryCard: {
        padding: SPACING.md,
        marginBottom: SPACING.sm,
    },
    entryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.xs,
    },
    entryDate: {
        ...TYPOGRAPHY.body,
        fontWeight: '600',
        color: COLORS.neutral[900],
    },
    statusBadge: {
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.sm,
    },
    statusText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[50],
        fontWeight: '500',
    },
    entryReason: {
        ...TYPOGRAPHY.body,
        color: COLORS.neutral[700],
        marginBottom: SPACING.sm,
    },
    entryDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: SPACING.sm,
    },
    hoursLost: {
        ...TYPOGRAPHY.caption,
        color: COLORS.error[600],
        fontWeight: '500',
    },
    status: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[600],
    },
    reversalButton: {
        backgroundColor: COLORS.primary[500],
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
        borderRadius: BORDER_RADIUS.sm,
        alignItems: 'center',
    },
    reversalButtonText: {
        ...TYPOGRAPHY.bodyBold,
        color: COLORS.neutral[50],
        fontWeight: '600',
    },
    errorContainer: {
        padding: SPACING.md,
        alignItems: 'center',
    },
    errorText: {
        ...TYPOGRAPHY.body,
        color: COLORS.error[600],
        marginBottom: SPACING.sm,
    },
    retryButton: {
        backgroundColor: COLORS.primary[500],
        paddingVertical: SPACING.xs,
        paddingHorizontal: SPACING.md,
        borderRadius: BORDER_RADIUS.sm,
    },
    retryText: {
        ...TYPOGRAPHY.bodyBold,
        color: COLORS.neutral[50],
    },
});