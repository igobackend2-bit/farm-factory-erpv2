import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    TextInput,
    ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';
import { GlassCard, Button } from '../../components/ui';
import WorkFlowTabs from '../../components/ui/WorkFlowTabs';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../../theme';
import { format } from 'date-fns';
import {
    FileText,
    CheckCircle2,
    XCircle,
    Clock,
    AlertCircle,
    ChevronLeft,
    Link2,
    Plus,
    Minus,
} from 'lucide-react-native';

// Android-safe gradient
const BG_GRADIENT: readonly [string, string, string] = ['#e0e7ff', '#f0f9ff', '#f8fafc'] as const;
const HEADER_GRADIENT: readonly [string, string] = ['#6366f1', '#4f46e5'] as const;

interface DayPlanTask {
    task: string;
    completed: boolean;
}

interface EvidenceLinkInput {
    id: string;
    url: string;
}

export default function EODReportScreen({ navigation }: any) {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [dayPlanTasks, setDayPlanTasks] = useState<DayPlanTask[]>([]);
    const [completedWork, setCompletedWork] = useState('');
    const [pendingItems, setPendingItems] = useState('');
    const [completionPercentage, setCompletionPercentage] = useState(100);
    const [evidenceLinks, setEvidenceLinks] = useState<EvidenceLinkInput[]>([
        { id: 'evidence-initial', url: '' },
    ]);
    const [existingReport, setExistingReport] = useState<any>(null);
    const [isTimeAllowed, setIsTimeAllowed] = useState(false);

    useEffect(() => {
        fetchData();
        checkTimeAllowed();
        const interval = setInterval(checkTimeAllowed, 60000);
        return () => clearInterval(interval);
    }, []);

    const checkTimeAllowed = () => {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const totalMinutes = hours * 60 + minutes;
        // EOD opens at 7:20 PM (19:20)
        const allowed = totalMinutes >= 1160; // 19 * 60 + 20 = 1160
        setIsTimeAllowed(allowed);
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const userResult = await supabase.auth.getUser();
            const user = userResult?.data?.user;
            const userExists = user !== null && user !== undefined;
            if (userExists === false) return;

            const today = format(new Date(), 'yyyy-MM-dd');

            // Fetch day plan
            const { data: planData } = await supabase
                .from('day_plans')
                .select('tasks')
                .eq('user_id', user.id)
                .eq('date', today)
                .maybeSingle();

            const hasPlanData = planData !== null && planData !== undefined;
            if (hasPlanData === true) {
                const taskArray = planData.tasks ?? [];
                const formattedTasks = taskArray.map((task: string) => ({
                    task: task,
                    completed: true,
                }));
                setDayPlanTasks(formattedTasks);
            }

            // Fetch existing EOD report
            const { data: eodData } = await supabase
                .from('eod_reports')
                .select('*')
                .eq('user_id', user.id)
                .eq('date', today)
                .maybeSingle();

            const hasEodData = eodData !== null && eodData !== undefined;
            if (hasEodData === true) {
                setExistingReport(eodData);
                setCompletedWork(eodData.completed_work ?? '');
                setPendingItems(eodData.pending_items ?? '');
                setCompletionPercentage(eodData.completion_percentage ?? 100);
            }
        } catch (error) {
            console.error('Error fetching EOD data:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleTaskCompletion = (index: number) => {
        const isLocked = existingReport !== null && existingReport !== undefined;
        if (isLocked === true) return;

        const newTasks = [...dayPlanTasks];
        newTasks[index] = {
            ...newTasks[index],
            completed: newTasks[index].completed === false,
        };
        setDayPlanTasks(newTasks);

        // Calculate completion percentage
        const completed = newTasks.filter((t) => t.completed === true).length;
        const total = newTasks.length;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 100;
        setCompletionPercentage(percentage);
    };

    const addEvidenceLink = () => {
        if (evidenceLinks.length < 5) {
            setEvidenceLinks([
                ...evidenceLinks,
                {
                    id: `evidence-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
                    url: '',
                },
            ]);
        }
    };

    const removeEvidenceLink = (index: number) => {
        if (evidenceLinks.length > 1) {
            const newLinks = evidenceLinks.filter((_, i) => i !== index);
            setEvidenceLinks(newLinks);
        }
    };

    const updateEvidenceLink = (index: number, value: string) => {
        const newLinks = [...evidenceLinks];
        newLinks[index] = { ...newLinks[index], url: value };
        setEvidenceLinks(newLinks);
    };

    const handleSubmit = async () => {
        const workTrimmed = completedWork !== null && completedWork !== undefined ? completedWork.trim() : '';
        if (workTrimmed === '') {
            Alert.alert('Required', 'Please describe work completed today.');
            return;
        }

        setSubmitting(true);
        try {
            const userResult = await supabase.auth.getUser();
            const user = userResult?.data?.user;
            const userExists = user !== null && user !== undefined;
            if (userExists === false) throw new Error('Not logged in');

            const today = format(new Date(), 'yyyy-MM-dd');

            // Get day plan for planned_work reference
            const { data: planData } = await supabase
                .from('day_plans')
                .select('tasks, expected_output')
                .eq('user_id', user.id)
                .eq('date', today)
                .maybeSingle();

            const hasPlanData = planData !== null && planData !== undefined;
            const plannedWork = hasPlanData === true 
                ? (planData.tasks ?? []).join('\n') 
                : 'No day plan submitted';

            const reportData = {
                user_id: user.id,
                date: today,
                planned_work: plannedWork,
                completed_work: workTrimmed,
                pending_items: pendingItems !== null && pendingItems !== undefined ? pendingItems.trim() : null,
                completion_percentage: completionPercentage,
                submitted_at: new Date().toISOString(),
            };

            const hasReport = existingReport !== null && existingReport !== undefined;
            if (hasReport === true) {
                const { error } = await supabase
                    .from('eod_reports')
                    .update(reportData)
                    .eq('id', existingReport.id);

                const hasError = error !== null && error !== undefined;
                if (hasError === true) throw error;
            } else {
                const { data, error } = await supabase
                    .from('eod_reports')
                    .insert(reportData)
                    .select()
                    .single();

                const hasError = error !== null && error !== undefined;
                if (hasError === true) throw error;

                const hasData = data !== null && data !== undefined;
                if (hasData === true) {
                    setExistingReport(data);
                }
            }

            Alert.alert('Success', 'EOD Report submitted successfully!');
        } catch (error: any) {
            console.error('EOD submit error:', error);
            const errorMessage = error?.message ?? 'Failed to submit EOD report';
            Alert.alert('Error', errorMessage);
        } finally {
            setSubmitting(false);
        }
    };

    const isLocked = existingReport !== null && existingReport !== undefined;

    if (loading === true) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary[500]} />
                <Text style={styles.loadingText}>Loading EOD report...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <LinearGradient colors={BG_GRADIENT} style={styles.background} />

            {/* Header */}
            <View style={styles.header}>
                <LinearGradient colors={HEADER_GRADIENT} style={styles.headerGradient}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <ChevronLeft size={24} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.headerContent}>
                        <FileText size={24} color="#fff" />
                        <Text style={styles.headerTitle}>EOD Report</Text>
                    </View>
                    <Text style={styles.headerDate}>{format(new Date(), 'EEEE, dd MMMM yyyy')}</Text>
                </LinearGradient>
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <WorkFlowTabs navigation={navigation} active="EODReport" />

                {/* Time Gate Notice */}
                {isTimeAllowed === false ? (
                    <GlassCard style={styles.warningCard}>
                        <View style={styles.warningHeader}>
                            <Clock size={24} color={COLORS.warning[600]} />
                            <Text style={styles.warningTitle}>Not Available Yet</Text>
                        </View>
                        <Text style={styles.warningText}>
                            EOD Report submission opens at 7:20 PM. You can review your tasks below.
                        </Text>
                    </GlassCard>
                ) : null}

                {/* Completion Stats */}
                <GlassCard style={styles.card}>
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{completionPercentage}%</Text>
                            <Text style={styles.statLabel}>Completion</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>
                                {dayPlanTasks.filter((t) => t.completed === true).length}/{dayPlanTasks.length}
                            </Text>
                            <Text style={styles.statLabel}>Tasks Done</Text>
                        </View>
                    </View>
                </GlassCard>

                {/* Day Plan Tasks */}
                <GlassCard style={styles.card}>
                    <Text style={styles.cardTitle}>Plan vs Done</Text>
                    {dayPlanTasks.length === 0 ? (
                        <View style={styles.emptyState}>
                            <AlertCircle size={32} color={COLORS.neutral[400]} />
                            <Text style={styles.emptyText}>No day plan submitted</Text>
                        </View>
                    ) : (
                        dayPlanTasks.map((item, index) => (
                            <TouchableOpacity
                                key={index}
                                style={styles.taskRow}
                                onPress={() => toggleTaskCompletion(index)}
                                disabled={isLocked === true}
                            >
                                {item.completed === true ? (
                                    <CheckCircle2 size={22} color={COLORS.success[500]} />
                                ) : (
                                    <XCircle size={22} color={COLORS.error[400]} />
                                )}
                                <Text
                                    style={[
                                        styles.taskText,
                                        item.completed === false ? styles.taskTextIncomplete : null,
                                    ]}
                                >
                                    {item.task}
                                </Text>
                            </TouchableOpacity>
                        ))
                    )}
                </GlassCard>

                {/* Work Summary */}
                <GlassCard style={styles.card}>
                    <Text style={styles.cardTitle}>Work Summary</Text>
                    {isLocked === true ? (
                        <Text style={styles.displayText}>{completedWork}</Text>
                    ) : (
                        <TextInput
                            style={styles.textArea}
                            value={completedWork}
                            onChangeText={setCompletedWork}
                            placeholder="Describe what you accomplished today..."
                            placeholderTextColor={COLORS.neutral[400]}
                            multiline={true}
                            numberOfLines={4}
                            editable={isTimeAllowed === true}
                        />
                    )}
                </GlassCard>

                {/* Pending Items */}
                <GlassCard style={styles.card}>
                    <Text style={styles.cardTitle}>Pending / Spillover</Text>
                    {isLocked === true ? (
                        <Text style={styles.displayText}>
                            {pendingItems !== null && pendingItems !== undefined && pendingItems !== '' ? pendingItems : 'None'}
                        </Text>
                    ) : (
                        <TextInput
                            style={styles.textArea}
                            value={pendingItems}
                            onChangeText={setPendingItems}
                            placeholder="Any items pending for tomorrow?"
                            placeholderTextColor={COLORS.neutral[400]}
                            multiline={true}
                            numberOfLines={2}
                            editable={isTimeAllowed === true}
                        />
                    )}
                </GlassCard>

                {/* Evidence Links */}
                <GlassCard style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={styles.cardTitleRow}>
                            <Link2 size={18} color={COLORS.primary[600]} />
                            <Text style={styles.cardTitle}>Evidence Links</Text>
                        </View>
                        {isLocked === false && evidenceLinks.length < 5 ? (
                            <TouchableOpacity style={styles.addButton} onPress={addEvidenceLink}>
                                <Plus size={18} color={COLORS.primary[500]} />
                            </TouchableOpacity>
                        ) : null}
                    </View>

                    {evidenceLinks.map((link, index) => (
                        <View key={link.id} style={styles.linkRow}>
                            <TextInput
                                style={styles.linkInput}
                                value={link.url}
                                onChangeText={(value) => updateEvidenceLink(index, value)}
                                placeholder="Paste Google Drive / Screenshot URL"
                                placeholderTextColor={COLORS.neutral[400]}
                                editable={isLocked === false && isTimeAllowed === true}
                            />
                            {isLocked === false && evidenceLinks.length > 1 ? (
                                <TouchableOpacity
                                    style={styles.removeButton}
                                    onPress={() => removeEvidenceLink(index)}
                                >
                                    <Minus size={16} color={COLORS.error[500]} />
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    ))}
                </GlassCard>

                {/* Submit Button */}
                {isLocked === false && isTimeAllowed === true ? (
                    <Button
                        onPress={handleSubmit}
                        loading={submitting === true}
                        disabled={submitting === true}
                        style={styles.submitButton}
                    >
                        Submit EOD Report
                    </Button>
                ) : null}

                {isLocked === true ? (
                    <GlassCard style={styles.successCard}>
                        <CheckCircle2 size={24} color={COLORS.success[500]} />
                        <Text style={styles.successText}>EOD Report Submitted</Text>
                        <Text style={styles.successSubtext}>
                            Submitted at {format(new Date(existingReport.submitted_at), 'hh:mm a')}
                        </Text>
                    </GlassCard>
                ) : null}

                <View style={styles.bottomSpacer} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    background: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },

    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background.primary,
    },
    loadingText: {
        ...TYPOGRAPHY.caption,
        marginTop: SPACING.md,
    },

    header: {},
    headerGradient: {
        paddingTop: 60,
        paddingBottom: SPACING.xl,
        paddingHorizontal: SPACING.xl,
    },
    backButton: {
        position: 'absolute',
        top: 56,
        left: SPACING.md,
        padding: SPACING.sm,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        marginBottom: SPACING.sm,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
    },
    headerDate: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
    },

    content: {
        padding: SPACING.xl,
        paddingBottom: 120,
    },

    warningCard: {
        marginBottom: SPACING.lg,
        backgroundColor: COLORS.warning[50],
        borderColor: COLORS.warning[200],
        borderWidth: 1,
    },
    warningHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    warningTitle: {
        ...TYPOGRAPHY.bodyBold,
        color: COLORS.warning[700],
    },
    warningText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.warning[600],
        marginTop: SPACING.sm,
    },

    card: {
        marginBottom: SPACING.lg,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    cardTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    cardTitle: {
        ...TYPOGRAPHY.bodyBold,
        color: COLORS.neutral[800],
    },
    addButton: {
        padding: SPACING.sm,
        backgroundColor: COLORS.primary[50],
        borderRadius: BORDER_RADIUS.md,
    },

    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 28,
        fontWeight: '700',
        color: COLORS.primary[600],
    },
    statLabel: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[500],
        marginTop: SPACING.xs,
    },
    statDivider: {
        width: 1,
        height: 40,
        backgroundColor: COLORS.neutral[200],
    },

    taskRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.neutral[100],
        gap: SPACING.md,
    },
    taskText: {
        ...TYPOGRAPHY.body,
        color: COLORS.neutral[800],
        flex: 1,
    },
    taskTextIncomplete: {
        color: COLORS.neutral[400],
        textDecorationLine: 'line-through',
    },

    emptyState: {
        alignItems: 'center',
        paddingVertical: SPACING.xl,
    },
    emptyText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[400],
        marginTop: SPACING.sm,
    },

    textArea: {
        backgroundColor: COLORS.neutral[50],
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        ...TYPOGRAPHY.body,
        color: COLORS.neutral[800],
        borderWidth: 1,
        borderColor: COLORS.neutral[200],
        minHeight: 100,
        textAlignVertical: 'top',
    },
    displayText: {
        ...TYPOGRAPHY.body,
        color: COLORS.neutral[700],
        padding: SPACING.md,
        backgroundColor: COLORS.neutral[50],
        borderRadius: BORDER_RADIUS.md,
    },

    linkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    linkInput: {
        flex: 1,
        backgroundColor: COLORS.neutral[50],
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[800],
        borderWidth: 1,
        borderColor: COLORS.neutral[200],
    },
    removeButton: {
        padding: SPACING.md,
        marginLeft: SPACING.sm,
    },

    submitButton: {
        marginTop: SPACING.md,
    },

    successCard: {
        alignItems: 'center',
        backgroundColor: COLORS.success[50],
        borderColor: COLORS.success[200],
        borderWidth: 1,
        marginTop: SPACING.lg,
    },
    successText: {
        ...TYPOGRAPHY.bodyBold,
        color: COLORS.success[700],
        marginTop: SPACING.sm,
    },
    successSubtext: {
        ...TYPOGRAPHY.caption,
        color: COLORS.success[600],
        marginTop: SPACING.xs,
    },

    bottomSpacer: {
        height: 40,
    },
});
