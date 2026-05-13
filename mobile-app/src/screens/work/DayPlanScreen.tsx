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
    ClipboardList,
    Plus,
    Minus,
    Lock,
    CheckCircle2,
    ChevronLeft,
} from 'lucide-react-native';

const BG_GRADIENT: readonly [string, string, string] = ['#e0e7ff', '#f0f9ff', '#f8fafc'] as const;
const HEADER_GRADIENT: readonly [string, string] = ['#3b82f6', '#1d4ed8'] as const;

interface DayPlan {
    id: string;
    tasks: string[];
    submitted_at: string;
}

interface DayPlanTaskInput {
    id: string;
    text: string;
}

export default function DayPlanScreen({ navigation }: any) {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [dayPlan, setDayPlan] = useState<DayPlan | null>(null);
    const [tasks, setTasks] = useState<DayPlanTaskInput[]>([{ id: 'task-initial', text: '' }]);

    const createTaskItem = (text = ''): DayPlanTaskInput => ({
        id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        text,
    });

    useEffect(() => {
        fetchDayPlan();
    }, []);

    const fetchDayPlan = async () => {
        setLoading(true);
        try {
            const userResult = await supabase.auth.getUser();
            const user = userResult?.data?.user;
            if (!user) return;

            const today = format(new Date(), 'yyyy-MM-dd');
            const { data, error } = await supabase
                .from('day_plans')
                .select('*')
                .eq('user_id', user.id)
                .eq('date', today)
                .maybeSingle();

            if (error) {
                console.warn('Day plan fetch error:', error);
            }

            if (data) {
                setDayPlan(data);
                const taskArray = data.tasks ?? [];
                setTasks(taskArray.length > 0 ? taskArray.map((task: string) => createTaskItem(task)) : [createTaskItem('')]);
            }
        } catch (error) {
            console.error('Error fetching day plan:', error);
        } finally {
            setLoading(false);
        }
    };

    const addTask = () => {
        if (tasks.length < 10) {
            setTasks([...tasks, createTaskItem('')]);
        }
    };

    const removeTask = (index: number) => {
        if (tasks.length > 1) {
            setTasks(tasks.filter((_, i) => i !== index));
        }
    };

    const updateTask = (index: number, value: string) => {
        const newTasks = [...tasks];
        newTasks[index] = { ...newTasks[index], text: value };
        setTasks(newTasks);
    };

    const handleSubmit = async () => {
        const validTasks = tasks.map((t) => t.text).filter((t) => t.trim() !== '');

        if (validTasks.length === 0) {
            Alert.alert('Required', 'Please add at least one task.');
            return;
        }

        setSubmitting(true);
        try {
            const userResult = await supabase.auth.getUser();
            const user = userResult?.data?.user;
            if (!user) throw new Error('Not logged in');

            const today = format(new Date(), 'yyyy-MM-dd');
            const planData = {
                user_id: user.id,
                date: today,
                tasks: validTasks,
                expected_output: '',
                dependency: null,
                is_project_work: true,
                submitted_at: new Date().toISOString(),
            };

            if (dayPlan) {
                const { error } = await supabase
                    .from('day_plans')
                    .update(planData)
                    .eq('id', dayPlan.id);
                if (error) throw error;
            } else {
                const { data, error } = await supabase
                    .from('day_plans')
                    .insert(planData)
                    .select()
                    .single();
                if (error) throw error;
                if (data) setDayPlan(data);
            }

            Alert.alert('Success', 'Day Plan submitted successfully!');
        } catch (error: any) {
            console.error('Day plan submit error:', error);
            Alert.alert('Error', error?.message ?? 'Failed to submit day plan');
        } finally {
            setSubmitting(false);
        }
    };

    const isPlanLocked = Boolean(dayPlan);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary[500]} />
                <Text style={styles.loadingText}>Loading day plan...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <LinearGradient colors={BG_GRADIENT} style={styles.background} />

            <View style={styles.header}>
                <LinearGradient colors={HEADER_GRADIENT} style={styles.headerGradient}>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <ChevronLeft size={24} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.headerContent}>
                        <ClipboardList size={24} color="#fff" />
                        <Text style={styles.headerTitle}>Day Plan</Text>
                    </View>
                    <Text style={styles.headerDate}>{format(new Date(), 'EEEE, dd MMMM yyyy')}</Text>
                    {isPlanLocked ? (
                        <View style={styles.lockedBadge}>
                            <Lock size={14} color="#fff" />
                            <Text style={styles.lockedText}>Plan Submitted</Text>
                        </View>
                    ) : null}
                </LinearGradient>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <WorkFlowTabs navigation={navigation} active="DayPlan" />

                {isPlanLocked ? (
                    <GlassCard style={styles.statusCard}>
                        <View style={styles.statusHeader}>
                            <CheckCircle2 size={24} color={COLORS.success[500]} />
                            <Text style={styles.statusTitle}>Plan Submitted</Text>
                        </View>
                        <Text style={styles.statusSubtitle}>
                            Submitted at {format(new Date(dayPlan?.submitted_at ?? new Date().toISOString()), 'hh:mm a')}
                        </Text>
                    </GlassCard>
                ) : null}

                <GlassCard style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle}>Today's Tasks</Text>
                        {!isPlanLocked ? (
                            <TouchableOpacity style={styles.addButton} onPress={addTask} disabled={tasks.length >= 10}>
                                <Plus size={20} color={COLORS.primary[500]} />
                            </TouchableOpacity>
                        ) : null}
                    </View>

                    {tasks.map((task, index) => (
                        <View key={task.id} style={styles.taskRow}>
                            <Text style={styles.taskNumber}>{index + 1}.</Text>
                            {isPlanLocked ? (
                                <View style={styles.taskDisplay}>
                                    <Text style={styles.taskText}>{task.text}</Text>
                                    <CheckCircle2 size={18} color={COLORS.success[400]} />
                                </View>
                            ) : (
                                <View style={styles.taskInputContainer}>
                                    <TextInput
                                        style={styles.taskInput}
                                        value={task.text}
                                        onChangeText={(value) => updateTask(index, value)}
                                        placeholder={`Task ${index + 1}`}
                                        placeholderTextColor={COLORS.neutral[400]}
                                        multiline
                                    />
                                    {tasks.length > 1 ? (
                                        <TouchableOpacity style={styles.removeButton} onPress={() => removeTask(index)}>
                                            <Minus size={16} color={COLORS.error[500]} />
                                        </TouchableOpacity>
                                    ) : null}
                                </View>
                            )}
                        </View>
                    ))}
                </GlassCard>

                {!isPlanLocked ? (
                    <Button
                        onPress={handleSubmit}
                        loading={submitting}
                        disabled={submitting}
                        style={styles.submitButton}
                    >
                        Submit Day Plan
                    </Button>
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
    lockedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.round,
        alignSelf: 'flex-start',
        marginTop: SPACING.md,
        gap: SPACING.xs,
    },
    lockedText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#fff',
    },

    content: {
        padding: SPACING.xl,
        paddingBottom: 120,
    },

    statusCard: {
        marginBottom: SPACING.lg,
        backgroundColor: COLORS.success[50],
        borderColor: COLORS.success[200],
        borderWidth: 1,
    },
    statusHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    statusTitle: {
        ...TYPOGRAPHY.bodyBold,
        color: COLORS.success[700],
    },
    statusSubtitle: {
        ...TYPOGRAPHY.caption,
        color: COLORS.success[600],
        marginTop: SPACING.xs,
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
    cardTitle: {
        ...TYPOGRAPHY.bodyBold,
        color: COLORS.neutral[800],
    },
    addButton: {
        padding: SPACING.sm,
        backgroundColor: COLORS.primary[50],
        borderRadius: BORDER_RADIUS.md,
    },

    taskRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: SPACING.md,
    },
    taskNumber: {
        ...TYPOGRAPHY.bodyBold,
        color: COLORS.primary[600],
        width: 24,
        marginTop: SPACING.sm,
    },
    taskInputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    taskInput: {
        flex: 1,
        backgroundColor: COLORS.neutral[50],
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        ...TYPOGRAPHY.body,
        color: COLORS.neutral[800],
        borderWidth: 1,
        borderColor: COLORS.neutral[200],
        minHeight: 48,
    },
    removeButton: {
        padding: SPACING.md,
        marginLeft: SPACING.sm,
    },
    taskDisplay: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.neutral[50],
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.neutral[200],
    },
    taskText: {
        ...TYPOGRAPHY.body,
        color: COLORS.neutral[800],
        flex: 1,
    },

    submitButton: {
        marginTop: SPACING.md,
    },

    bottomSpacer: {
        height: 40,
    },
});
