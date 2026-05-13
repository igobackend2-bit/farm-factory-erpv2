import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Clock, CheckCircle2, Plus, History, Loader2, Save } from 'lucide-react-native';
import { format } from 'date-fns';

import { useShiftSession } from '../../hooks/useShiftSession';
import { useShiftHourlySlots } from '../../hooks/useShiftHourlySlots';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { COLORS, GRADIENT_COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../../theme';

export default function ShiftHourlyScreen() {
    const insets = useSafeAreaInsets();
    const { currentSession } = useShiftSession();
    const { slots, currentSlot, submitPlan, submitReport, createNextSlot, isLoading, isSubmitting } = useShiftHourlySlots(currentSession?.id);

    const [newPlan, setNewPlan] = useState('');
    const [report, setReport] = useState('');
    const [showReportForm, setShowReportForm] = useState(false);
    const [showEditPlan, setShowEditPlan] = useState(false);

    useEffect(() => {
        setNewPlan('');
        setReport('');
        setShowReportForm(false);
        setShowEditPlan(false);
    }, [currentSlot?.id]);

    const handleStartHour = async () => {
        // Generic submit of plan (either generic next slot or update current pending)
        if (!newPlan.trim()) return;

        if (currentSlot && currentSlot.status === 'pending') {
            await submitPlan(currentSlot.id, newPlan);
        } else if (!currentSlot) {
            await createNextSlot(newPlan);
        }
    };

    const handleUpdateActivePlan = async () => {
        if (!newPlan.trim() || !currentSlot) return;
        const result = await submitPlan(currentSlot.id, newPlan);
        if (result.success) {
            setShowEditPlan(false);
            setNewPlan('');
        }
    };

    const handleCompleteSlot = async () => {
        if (!report.trim() || !currentSlot) return;
        const result = await submitReport(currentSlot.id, report);
        if (result.success) {
            setShowReportForm(false);
            setReport('');
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

    const isPlanActive = currentSlot && currentSlot.status === 'plan_submitted';

    return (
        <LinearGradient colors={GRADIENT_COLORS.background as [string, string, ...string[]]} style={styles.container}>
            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}>
                {/* Header */}
                <View style={[styles.header, { marginTop: insets.top + SPACING.md }]}>
                    <View>
                        <Text style={styles.title}>Hourly Plan</Text>
                        <Text style={styles.subtitle}>Track your work hour by hour</Text>
                    </View>
                    <View style={styles.dateBadge}>
                        <Text style={styles.dateText}>Shift: {format(new Date(), 'MMM d')}</Text>
                    </View>
                </View>

                {/* Active Action Card */}
                <GlassCard style={styles.actionCard}>
                    <View style={styles.cardHeader}>
                        <Clock size={20} color={COLORS.primary[500]} />
                        <Text style={styles.cardTitle}>
                            {isPlanActive ? 'Current Activity' : 'Plan Next Hour'}
                        </Text>
                    </View>

                    <View style={styles.cardBody}>
                        {isPlanActive ? (
                            <View>
                                {showEditPlan ? (
                                    <View>
                                        <TextInput
                                            style={styles.input}
                                            value={newPlan}
                                            onChangeText={setNewPlan}
                                            placeholder="Update your plan..."
                                            placeholderTextColor={COLORS.neutral[400]}
                                        />
                                        <View style={styles.buttonRow}>
                                            <Button
                                                title="Save Plan"
                                                onPress={handleUpdateActivePlan}
                                                loading={isSubmitting}
                                                size="sm"
                                                style={styles.flexBtn}
                                            />
                                            <Button
                                                title="Cancel"
                                                variant="outline"
                                                onPress={() => setShowEditPlan(false)}
                                                size="sm"
                                                style={styles.flexBtn}
                                            />
                                        </View>
                                    </View>
                                ) : (
                                    <View style={styles.activePlanContainer}>
                                        <Text style={styles.timeLabel}>
                                            {format(new Date(currentSlot.slotStart), 'h:mm a')} - Now
                                        </Text>
                                        <Text style={styles.planText}>{currentSlot.plan}</Text>
                                        <TouchableOpacity
                                            style={styles.editButton}
                                            onPress={() => { setNewPlan(currentSlot.plan || ''); setShowEditPlan(true); }}
                                        >
                                            <Text style={styles.editButtonText}>Edit</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {showReportForm ? (
                                    <View style={styles.reportForm}>
                                        <Text style={styles.reportLabel}>What did you accomplish?</Text>
                                        <TextInput
                                            style={[styles.input, styles.reportInput]}
                                            value={report}
                                            onChangeText={setReport}
                                            placeholder="Report progress..."
                                            placeholderTextColor={COLORS.neutral[400]}
                                            multiline
                                        />
                                        <View style={styles.buttonRow}>
                                            <Button
                                                title="Submit & Close Hour"
                                                onPress={handleCompleteSlot}
                                                loading={isSubmitting}
                                                size="sm"
                                                style={styles.flexBtn}
                                                icon={<CheckCircle2 size={16} color="white" />}
                                            />
                                            <Button
                                                title="Cancel"
                                                variant="outline"
                                                onPress={() => setShowReportForm(false)}
                                                size="sm"
                                                style={styles.flexBtn}
                                            />
                                        </View>
                                    </View>
                                ) : (
                                    <Button
                                        title="Complete Hour & Add Report"
                                        onPress={() => setShowReportForm(true)}
                                        style={styles.completeBtn}
                                        icon={<CheckCircle2 size={18} color="white" />}
                                    />
                                )}
                            </View>
                        ) : (
                            <View>
                                <TextInput
                                    style={styles.input}
                                    placeholder="What will you be working on?"
                                    value={newPlan}
                                    onChangeText={setNewPlan}
                                    placeholderTextColor={COLORS.neutral[400]}
                                />
                                <Button
                                    title="Start Hour"
                                    onPress={handleStartHour}
                                    loading={isSubmitting}
                                    disabled={!newPlan.trim()}
                                    icon={<Plus size={20} color="white" />}
                                />
                            </View>
                        )}
                    </View>
                </GlassCard>

                {/* Timeline */}
                <View style={styles.timelineSection}>
                    <View style={styles.timelineHeader}>
                        <History size={18} color={COLORS.neutral[800]} />
                        <Text style={styles.timelineTitle}>Timeline</Text>
                    </View>

                    {slots.length === 0 ? (
                        <View style={styles.emptyTimeline}>
                            <Text style={styles.emptyText}>No slots recorded.</Text>
                        </View>
                    ) : (
                        <View style={styles.timelineList}>
                            {slots.map((slot, index) => (
                                <View key={slot.id} style={styles.timelineItem}>
                                    {/* Timeline Line */}
                                    {index !== slots.length - 1 && <View style={styles.timelineLine} />}

                                    {/* Status Dot */}
                                    <View style={[
                                        styles.statusDot,
                                        slot.status === 'report_submitted' ? styles.dotCompleted :
                                            slot.status === 'missed' ? styles.dotMissed :
                                                slot.status === 'plan_submitted' ? styles.dotActive : styles.dotPending
                                    ]} />

                                    <View style={styles.timelineContent}>
                                        <View style={styles.timelineMeta}>
                                            <Text style={styles.timelineTime}>
                                                {format(new Date(slot.slotStart), 'h:mm a')}
                                                {slot.slotEnd && ` - ${format(new Date(slot.slotEnd), 'h:mm a')}`}
                                            </Text>
                                            <View style={[
                                                styles.statusBadge,
                                                slot.status === 'report_submitted' ? styles.badgeCompleted : styles.badgeDefault
                                            ]}>
                                                <Text style={[
                                                    styles.statusBadgeText,
                                                    slot.status === 'report_submitted' ? styles.badgeTextCompleted : styles.badgeTextDefault
                                                ]}>
                                                    {slot.status === 'report_submitted' ? 'Completed' : slot.status.replace('_', ' ')}
                                                </Text>
                                            </View>
                                        </View>

                                        <GlassCard style={styles.timelineCard}>
                                            <View style={styles.timelineRow}>
                                                <Text style={styles.label}>PLAN:</Text>
                                                <Text style={styles.value}>{slot.plan}</Text>
                                            </View>
                                            {slot.report && (
                                                <View style={[styles.timelineRow, styles.reportRow]}>
                                                    <Text style={[styles.label, styles.doneLabel]}>DONE:</Text>
                                                    <Text style={styles.value}>{slot.report}</Text>
                                                </View>
                                            )}
                                        </GlassCard>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
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
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.lg,
    },
    title: {
        ...TYPOGRAPHY.h2,
        color: COLORS.neutral[900],
    },
    subtitle: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[500],
    },
    dateBadge: {
        backgroundColor: COLORS.neutral[200],
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.round,
    },
    dateText: {
        ...TYPOGRAPHY.captionBold,
        color: COLORS.neutral[700],
    },
    actionCard: {
        padding: SPACING.md,
        backgroundColor: 'rgba(59, 130, 246, 0.05)',
        borderColor: 'rgba(59, 130, 246, 0.2)',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        marginBottom: SPACING.md,
    },
    cardTitle: {
        ...TYPOGRAPHY.h4,
        color: COLORS.primary[700],
    },
    cardBody: {
        gap: SPACING.md,
    },
    input: {
        backgroundColor: COLORS.glass.white,
        borderWidth: 1,
        borderColor: COLORS.neutral[200],
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        fontSize: 16,
        color: COLORS.neutral[900],
        marginBottom: SPACING.md,
    },
    activePlanContainer: {
        padding: SPACING.md,
        backgroundColor: COLORS.glass.white,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.neutral[200],
        position: 'relative',
    },
    timeLabel: {
        ...TYPOGRAPHY.label,
        color: COLORS.neutral[500],
        marginBottom: SPACING.xs,
    },
    planText: {
        ...TYPOGRAPHY.bodyBold,
        fontSize: 18,
        color: COLORS.neutral[900],
    },
    editButton: {
        position: 'absolute',
        top: SPACING.sm,
        right: SPACING.sm,
        padding: SPACING.xs,
    },
    editButtonText: {
        ...TYPOGRAPHY.captionBold,
        color: COLORS.primary[600],
    },
    reportForm: {
        marginTop: SPACING.md,
        paddingTop: SPACING.md,
        borderTopWidth: 1,
        borderTopColor: COLORS.neutral[200],
        borderStyle: 'dashed',
    },
    reportLabel: {
        ...TYPOGRAPHY.captionBold,
        marginBottom: SPACING.sm,
    },
    reportInput: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    buttonRow: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    flexBtn: {
        flex: 1,
    },
    completeBtn: {
        marginTop: SPACING.sm,
    },
    timelineSection: {
        marginTop: SPACING.xxl,
    },
    timelineHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        marginBottom: SPACING.md,
    },
    timelineTitle: {
        ...TYPOGRAPHY.h3,
    },
    emptyTimeline: {
        padding: SPACING.xl,
        borderWidth: 2,
        borderColor: COLORS.neutral[200],
        borderStyle: 'dashed',
        borderRadius: BORDER_RADIUS.lg,
        alignItems: 'center',
    },
    emptyText: {
        color: COLORS.neutral[400],
    },
    timelineList: {
        paddingLeft: SPACING.md,
    },
    timelineItem: {
        marginBottom: SPACING.xl,
        position: 'relative',
        paddingLeft: SPACING.lg,
    },
    timelineLine: {
        position: 'absolute',
        left: 5, // half of dot width (10/2)
        top: 20,
        bottom: -20,
        width: 2,
        backgroundColor: COLORS.neutral[200],
    },
    statusDot: {
        position: 'absolute',
        left: 0,
        top: 4,
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
        zIndex: 1,
    },
    dotCompleted: {
        backgroundColor: COLORS.success[500],
        borderColor: COLORS.success[600],
    },
    dotMissed: {
        backgroundColor: COLORS.error[500],
        borderColor: COLORS.error[600],
    },
    dotActive: {
        backgroundColor: COLORS.primary[500],
        borderColor: COLORS.primary[600],
    },
    dotPending: {
        backgroundColor: COLORS.neutral[300],
        borderColor: COLORS.neutral[400],
    },
    timelineContent: {
        gap: SPACING.xs,
    },
    timelineMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
    },
    timelineTime: {
        fontFamily: 'monospace',
        fontSize: 12,
        color: COLORS.neutral[500],
    },
    statusBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        backgroundColor: COLORS.neutral[100],
    },
    badgeCompleted: {
        backgroundColor: COLORS.success[100],
    },
    badgeDefault: {
        backgroundColor: COLORS.neutral[100],
    },
    statusBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    badgeTextCompleted: {
        color: COLORS.success[700],
    },
    badgeTextDefault: {
        color: COLORS.neutral[600],
    },
    timelineCard: {
        padding: SPACING.md,
        backgroundColor: COLORS.glass.white,
    },
    timelineRow: {
        marginBottom: 4,
    },
    reportRow: {
        marginTop: SPACING.xs,
        paddingTop: SPACING.xs,
        borderTopWidth: 1,
        borderTopColor: COLORS.neutral[200],
        borderStyle: 'dashed',
    },
    label: {
        ...TYPOGRAPHY.label,
        fontSize: 10,
        color: COLORS.primary[600],
        marginBottom: 2,
    },
    doneLabel: {
        color: COLORS.success[600],
    },
    value: {
        ...TYPOGRAPHY.body,
        fontSize: 14,
        color: COLORS.neutral[800],
    },
    errorText: {
        textAlign: 'center',
        color: COLORS.neutral[500],
    },
});
