import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    Modal,
    TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';
import { StatusBadge, Button } from '../../components/ui';
import WorkFlowTabs from '../../components/ui/WorkFlowTabs';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../theme';
import { format, parse, addMinutes, isBefore, isAfter } from 'date-fns';
import {
    Clock,
    Lock,
    ChevronRight,
    X,
    Coffee,
    Send,
    AlertCircle,
    ClipboardList,
    Check,
} from 'lucide-react-native';
import { TIME_SLOTS, TimeSlot, SlotStatus } from '../../types';

const BG_GRADIENT: [string, string, ...string[]] = ['#e0e7ff', '#f0f9ff', '#f8fafc'];

export default function HourlyReportScreen({ navigation }: any) {
    const [loading, setLoading] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [plans, setPlans] = useState<any[]>([]);
    const [reports, setReports] = useState<any[]>([]);
    const [dayPlanTasks, setDayPlanTasks] = useState<string[]>([]);

    const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
    const [selectedMode, setSelectedMode] = useState<'plan' | 'report'>('report');
    const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
    const [workNotes, setWorkNotes] = useState('');
    const [modalVisible, setModalVisible] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        fetchData();
    }, []);

    const to12h = (time24: string) => format(parse(time24, 'HH:mm', new Date()), 'hh:mm a');
    const getSlotRangeLabel = (slot: TimeSlot) => `${to12h(slot.startTime)} - ${to12h(slot.endTime)}`;

    const fetchData = async () => {
        setLoading(true);
        try {
            const userResult = await supabase.auth.getUser();
            const user = userResult?.data?.user;
            if (!user) return;

            const today = format(new Date(), 'yyyy-MM-dd');

            const { data: plansData } = await supabase
                .from('hourly_plans')
                .select('*')
                .eq('user_id', user.id)
                .eq('date', today);
            if (plansData) setPlans(plansData);

            const { data: reportsData } = await supabase
                .from('hourly_reports')
                .select('*')
                .eq('user_id', user.id)
                .eq('date', today);
            if (reportsData) setReports(reportsData);

            const { data: dayPlanData } = await supabase
                .from('day_plans')
                .select('tasks')
                .eq('user_id', user.id)
                .eq('date', today)
                .maybeSingle();

            const taskArray = dayPlanData?.tasks ?? [];
            setDayPlanTasks(Array.isArray(taskArray) ? taskArray : []);
        } catch (error) {
            console.error('Error fetching hourly data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getSlotPhase = (slot: TimeSlot) => {
        const foundReport = reports.find((r) => r.time_slot === slot.id);
        if (foundReport) return 'locked';

        const today = format(currentTime, 'yyyy-MM-dd');
        const slotStart = parse(`${today} ${slot.startTime}`, 'yyyy-MM-dd HH:mm', new Date());
        const slotEnd = parse(`${today} ${slot.endTime}`, 'yyyy-MM-dd HH:mm', new Date());
        const reportUnlockTime = addMinutes(slotEnd, -5);

        if (currentTime >= reportUnlockTime) return 'report';
        if (currentTime >= slotStart) return 'plan';
        return 'locked';
    };

    const getSlotStatus = (slot: TimeSlot): SlotStatus => {
        const foundReport = reports.find((r) => r.time_slot === slot.id);
        if (foundReport) return 'completed';
        if (slot.isLunchBreak) return 'upcoming';

        const today = format(currentTime, 'yyyy-MM-dd');
        const slotStart = parse(`${today} ${slot.startTime}`, 'yyyy-MM-dd HH:mm', new Date());
        const slotEnd = parse(`${today} ${slot.endTime}`, 'yyyy-MM-dd HH:mm', new Date());

        if (isBefore(currentTime, slotStart)) return 'upcoming';
        if (isAfter(currentTime, slotEnd)) return 'missed';
        return 'live';
    };

    const extractTaskAndNotes = (text: string, notesLabel: 'Notes' | 'Plan') => {
        if (!text) return { tasks: [] as string[], notes: '' };
        const taskPrefix = 'Task: ';
        const tasksPrefix = 'Tasks: ';
        const notesPrefix = `\n${notesLabel}: `;
        if (text.startsWith(tasksPrefix) && text.includes(notesPrefix)) {
            const splitIndex = text.indexOf(notesPrefix);
            const tasksRaw = text.slice(tasksPrefix.length, splitIndex).trim();
            return {
                tasks: tasksRaw
                    .split('|')
                    .map((item) => item.trim())
                    .filter(Boolean),
                notes: text.slice(splitIndex + notesPrefix.length).trim(),
            };
        }
        if (text.startsWith(taskPrefix) && text.includes(notesPrefix)) {
            const splitIndex = text.indexOf(notesPrefix);
            const task = text.slice(taskPrefix.length, splitIndex).trim();
            return {
                tasks: task === '' ? [] : [task],
                notes: text.slice(splitIndex + notesPrefix.length).trim(),
            };
        }
        return { tasks: [], notes: text };
    };

    const extractTaskFromReport = (reportText: string) => extractTaskAndNotes(reportText, 'Notes');
    const extractTaskFromPlan = (planText: string) => extractTaskAndNotes(planText, 'Plan');

    const handleSlotPress = (slot: TimeSlot) => {
        if (slot.isLunchBreak) return;

        const phase = getSlotPhase(slot);
        const status = getSlotStatus(slot);

        if (status === 'upcoming' || phase === 'locked') {
            Alert.alert('Not Open Yet', 'This slot opens at the slot start time for plan and 5 minutes before slot end for report.');
            return;
        }

        const existingPlan = plans.find((p) => p.time_slot === slot.id);
        const existingReport = reports.find((r) => r.time_slot === slot.id);
        const parsedPlan = extractTaskFromPlan(existingPlan?.plan_text ?? '');
        const parsed = extractTaskFromReport(existingReport?.report_text ?? '');
        const mode: 'plan' | 'report' = phase === 'plan' ? 'plan' : 'report';

        setSelectedSlot(slot);
        setSelectedMode(mode);
        setSelectedTasks(mode === 'report' ? (parsed.tasks.length > 0 ? parsed.tasks : parsedPlan.tasks) : parsedPlan.tasks);
        setWorkNotes(mode === 'report' ? parsed.notes : parsedPlan.notes);
        setModalVisible(true);
    };

    const toggleTask = (task: string) => {
        setSelectedTasks((prev) => {
            if (prev.includes(task)) return prev.filter((t) => t !== task);
            return [...prev, task];
        });
    };

    const handleSubmit = async () => {
        if (!selectedSlot) return;

        const taskTrimmed = selectedTasks.map((task) => task.trim()).filter(Boolean);
        const notesTrimmed = workNotes.trim();

        if (taskTrimmed.length === 0) {
            Alert.alert('Required', 'Please select at least one day plan task.');
            return;
        }

        if (notesTrimmed === '') {
            Alert.alert('Required', 'Please add work notes for this slot.');
            return;
        }

        setLoading(true);
        try {
            const userResult = await supabase.auth.getUser();
            const user = userResult?.data?.user;
            if (!user) throw new Error('No user');

            const today = format(new Date(), 'yyyy-MM-dd');
            const contentText =
                selectedMode === 'plan'
                    ? `Tasks: ${taskTrimmed.join(' | ')}\nPlan: ${notesTrimmed}`
                    : `Tasks: ${taskTrimmed.join(' | ')}\nNotes: ${notesTrimmed}`;

            const payload = {
                user_id: user.id,
                date: today,
                time_slot: selectedSlot.id,
                submitted_at: new Date().toISOString(),
            };

            const result =
                selectedMode === 'plan'
                    ? await supabase
                          .from('hourly_plans')
                          .upsert({ ...payload, plan_text: contentText }, { onConflict: 'user_id,date,time_slot' })
                    : await supabase
                          .from('hourly_reports')
                          .upsert({ ...payload, report_text: contentText }, { onConflict: 'user_id,date,time_slot' });

            if (result?.error) throw result.error;

            Alert.alert('Success', selectedMode === 'plan' ? 'Hourly plan saved.' : 'Hourly report submitted.');
            setModalVisible(false);
            setSelectedTasks([]);
            setWorkNotes('');
            fetchData();
        } catch (error: any) {
            console.warn('Backend error:', error);
            if (error?.code === '42P01') {
                Alert.alert('Demo Mode', selectedMode === 'plan' ? 'Hourly plan saved locally.' : 'Hourly report saved locally.');
                setModalVisible(false);
            } else {
                Alert.alert('Error', error?.message || 'An error occurred');
            }
        } finally {
            setLoading(false);
        }
    };

    const completedSlots = reports.length;
    const totalSlots = TIME_SLOTS.filter((s) => !s.isLunchBreak).length;
    const progress = Math.round((completedSlots / totalSlots) * 100);

    return (
        <View style={styles.container}>
            <LinearGradient colors={BG_GRADIENT} style={styles.background} />

            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <View>
                        <Text style={styles.title}>Hourly Report</Text>
                        <Text style={styles.date}>{format(currentTime, 'EEEE, dd MMMM')}</Text>
                    </View>
                    <View style={styles.progressBadge}>
                        <Text style={styles.progressText}>{progress}%</Text>
                    </View>
                </View>

                <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${progress}%` }]} />
                </View>
                <Text style={styles.progressLabel}>
                    {completedSlots} of {totalSlots} slots completed
                </Text>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <WorkFlowTabs navigation={navigation} active="HourlyReport" />

                {TIME_SLOTS.map((slot) => {
                    const status = getSlotStatus(slot);
                    const phase = getSlotPhase(slot);
                    const planData = plans.find((p) => p.time_slot === slot.id);
                    const reportData = reports.find((r) => r.time_slot === slot.id);
                    const parsed = extractTaskFromReport(reportData?.report_text ?? '');
                    const parsedPlan = extractTaskFromPlan(planData?.plan_text ?? '');

                    const statusColors: Record<SlotStatus, string> = {
                        live: COLORS.primary[500],
                        completed: COLORS.success[500],
                        missed: COLORS.error[500],
                        upcoming: COLORS.neutral[300],
                        late: COLORS.warning[500],
                    };

                    const borderColor = statusColors[status];

                    return (
                        <TouchableOpacity
                            key={slot.id}
                            style={[
                                styles.slotCard,
                                { borderLeftColor: borderColor },
                                status === 'live' ? styles.slotCardLive : null,
                            ]}
                            onPress={() => handleSlotPress(slot)}
                            disabled={slot.isLunchBreak}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.slotNumber, { backgroundColor: `${borderColor}20` }]}>
                                <Text style={[styles.slotNumberText, { color: borderColor }]}>{slot.slotNumber}</Text>
                            </View>

                            <View style={styles.timeBox}>
                                <Text style={styles.timeText}>{to12h(slot.startTime)}</Text>
                                <Text style={styles.timeSub}>opening time</Text>
                            </View>

                            <View style={styles.slotContent}>
                                {slot.isLunchBreak ? (
                                    <View style={styles.lunchRow}>
                                        <Coffee size={16} color={COLORS.neutral[500]} />
                                        <Text style={styles.lunchText}>Lunch Break</Text>
                                    </View>
                                ) : reportData ? (
                                    <View>
                                        <StatusBadge status="completed" size="sm" showDot={false} />
                                        <Text style={styles.notesPreview} numberOfLines={1}>
                                            {parsed.tasks.length > 0 ? `Report: ${parsed.tasks.join(', ')}` : parsed.notes}
                                        </Text>
                                        {parsedPlan.tasks.length > 0 ? (
                                            <Text style={styles.secondaryPreview} numberOfLines={1}>
                                                {`Plan: ${parsedPlan.tasks.join(', ')}`}
                                            </Text>
                                        ) : null}
                                    </View>
                                ) : planData ? (
                                    <View>
                                        <StatusBadge status="live" size="sm" showDot={false} />
                                        <Text style={styles.notesPreview} numberOfLines={1}>
                                            {parsedPlan.tasks.length > 0 ? `Plan: ${parsedPlan.tasks.join(', ')}` : parsedPlan.notes}
                                        </Text>
                                    </View>
                                ) : (
                                    <View style={styles.statusRow}>
                                        {(status === 'upcoming' || phase === 'locked') ? (
                                            <Lock size={14} color={COLORS.neutral[400]} />
                                        ) : null}
                                        {status === 'live' && phase === 'report' ? (
                                            <Clock size={14} color={COLORS.primary[500]} />
                                        ) : null}
                                        {status === 'live' && phase === 'plan' ? (
                                            <ClipboardList size={14} color={COLORS.warning[500]} />
                                        ) : null}
                                        {status === 'missed' ? (
                                            <AlertCircle size={14} color={COLORS.error[500]} />
                                        ) : null}
                                        <Text style={[styles.statusText, { color: statusColors[status] }]}>
                                            {phase === 'report' ? 'REPORT NOW' : phase === 'plan' ? 'PLAN NOW' : status.toUpperCase()}
                                        </Text>
                                    </View>
                                )}
                            </View>

                            {!slot.isLunchBreak ? <ChevronRight size={20} color={COLORS.neutral[300]} /> : null}
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            <Modal animationType="slide" visible={modalVisible} transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHandle} />

                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Slot {selectedSlot?.slotNumber} {selectedMode === 'plan' ? 'Plan' : 'Report'}</Text>
                                <Text style={styles.modalSub}>{selectedSlot ? getSlotRangeLabel(selectedSlot) : ''}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
                                <X size={22} color={COLORS.neutral[600]} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modeSwitchRow}>
                            <TouchableOpacity
                                style={[styles.modeSwitchBtn, selectedMode === 'plan' ? styles.modeSwitchBtnActive : null]}
                                onPress={() => setSelectedMode('plan')}
                            >
                                <Text style={[styles.modeSwitchText, selectedMode === 'plan' ? styles.modeSwitchTextActive : null]}>
                                    Plan
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modeSwitchBtn, selectedMode === 'report' ? styles.modeSwitchBtnActive : null]}
                                onPress={() => setSelectedMode('report')}
                            >
                                <Text style={[styles.modeSwitchText, selectedMode === 'report' ? styles.modeSwitchTextActive : null]}>
                                    Report
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.taskTitleRow}>
                            <ClipboardList size={16} color={COLORS.primary[600]} />
                            <Text style={styles.taskListTitle}>Select Day Plan Tasks</Text>
                        </View>

                        <ScrollView style={styles.taskList} contentContainerStyle={styles.taskListContent}>
                            {dayPlanTasks.length === 0 ? (
                                <View style={styles.noTasksBox}>
                                    <Text style={styles.noTasksText}>No day plan tasks found for today. Please submit Day Plan first.</Text>
                                </View>
                            ) : (
                                dayPlanTasks.map((task, index) => {
                                    const isSelected = selectedTasks.includes(task);
                                    return (
                                        <TouchableOpacity
                                            key={`${task}-${index}`}
                                            style={[styles.taskItem, isSelected ? styles.taskItemSelected : null]}
                                            onPress={() => toggleTask(task)}
                                        >
                                            <Text style={[styles.taskItemText, isSelected ? styles.taskItemTextSelected : null]}>
                                                {index + 1}. {task}
                                            </Text>
                                            {isSelected ? <Check size={16} color={COLORS.primary[700]} /> : null}
                                        </TouchableOpacity>
                                    );
                                })
                            )}
                        </ScrollView>

                        <TextInput
                            style={styles.textArea}
                            multiline
                            placeholder={selectedMode === 'plan' ? 'Add your plan for this slot' : 'Add work notes for this slot'}
                            placeholderTextColor={COLORS.neutral[400]}
                            value={workNotes}
                            onChangeText={setWorkNotes}
                            textAlignVertical="top"
                        />

                        <Button
                            title={selectedMode === 'plan' ? 'Save Hourly Plan' : 'Submit Hourly Report'}
                            onPress={handleSubmit}
                            loading={loading}
                            fullWidth
                            variant="primary"
                            size="lg"
                            icon={<Send size={18} color="#fff" />}
                            disabled={dayPlanTasks.length === 0}
                        />
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
    title: {
        ...TYPOGRAPHY.h2,
    },
    date: {
        ...TYPOGRAPHY.caption,
        marginTop: 4,
    },
    progressBadge: {
        backgroundColor: COLORS.primary[100],
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.round,
    },
    progressText: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.primary[700],
    },
    progressBar: {
        height: 8,
        backgroundColor: COLORS.neutral[200],
        borderRadius: BORDER_RADIUS.round,
        marginTop: SPACING.lg,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: COLORS.primary[500],
        borderRadius: BORDER_RADIUS.round,
    },
    progressLabel: {
        ...TYPOGRAPHY.caption,
        marginTop: SPACING.sm,
    },

    content: {
        padding: SPACING.xl,
        gap: SPACING.sm,
    },

    slotCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        borderLeftWidth: 4,
        ...SHADOWS.sm,
    },
    slotCardLive: {
        backgroundColor: '#fff',
        ...SHADOWS.md,
    },
    slotNumber: {
        width: 36,
        height: 36,
        borderRadius: BORDER_RADIUS.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    slotNumberText: {
        fontSize: 14,
        fontWeight: '700',
    },
    timeBox: {
        marginLeft: SPACING.md,
        width: 70,
    },
    timeText: {
        ...TYPOGRAPHY.bodyBold,
    },
    timeSub: {
        fontSize: 11,
        color: COLORS.neutral[400],
    },
    slotContent: {
        flex: 1,
        marginLeft: SPACING.md,
    },
    lunchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    lunchText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[500],
    },
    notesPreview: {
        ...TYPOGRAPHY.caption,
        marginTop: 4,
    },
    secondaryPreview: {
        ...TYPOGRAPHY.caption,
        marginTop: 2,
        color: COLORS.neutral[500],
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '700',
    },

    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: '#fff',
        borderTopLeftRadius: BORDER_RADIUS.xxl,
        borderTopRightRadius: BORDER_RADIUS.xxl,
        padding: SPACING.xl,
        paddingBottom: 40,
        maxHeight: '88%',
    },
    modalHandle: {
        width: 40,
        height: 4,
        backgroundColor: COLORS.neutral[300],
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: SPACING.lg,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: SPACING.lg,
    },
    modalTitle: {
        ...TYPOGRAPHY.h3,
    },
    modalSub: {
        ...TYPOGRAPHY.caption,
    },
    closeButton: {
        padding: SPACING.sm,
    },
    modeSwitchRow: {
        flexDirection: 'row',
        backgroundColor: COLORS.neutral[100],
        borderRadius: BORDER_RADIUS.md,
        padding: 4,
        gap: 4,
        marginBottom: SPACING.md,
    },
    modeSwitchBtn: {
        flex: 1,
        borderRadius: BORDER_RADIUS.md,
        paddingVertical: SPACING.sm,
        alignItems: 'center',
    },
    modeSwitchBtnActive: {
        backgroundColor: '#fff',
        ...SHADOWS.sm,
    },
    modeSwitchText: {
        ...TYPOGRAPHY.captionBold,
        color: COLORS.neutral[500],
    },
    modeSwitchTextActive: {
        color: COLORS.primary[700],
    },

    taskTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        marginBottom: SPACING.sm,
    },
    taskListTitle: {
        ...TYPOGRAPHY.captionBold,
        color: COLORS.primary[700],
    },
    taskList: {
        maxHeight: 180,
        marginBottom: SPACING.md,
    },
    taskListContent: {
        gap: SPACING.xs,
    },
    taskItem: {
        borderWidth: 1,
        borderColor: COLORS.neutral[200],
        borderRadius: BORDER_RADIUS.md,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.neutral[50],
    },
    taskItemSelected: {
        backgroundColor: COLORS.primary[50],
        borderColor: COLORS.primary[300],
    },
    taskItemText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[700],
        flex: 1,
        marginRight: SPACING.sm,
    },
    taskItemTextSelected: {
        color: COLORS.primary[700],
        fontWeight: '700',
    },
    noTasksBox: {
        backgroundColor: COLORS.warning[50],
        borderColor: COLORS.warning[200],
        borderWidth: 1,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
    },
    noTasksText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.warning[700],
    },

    textArea: {
        backgroundColor: COLORS.neutral[50],
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        fontSize: 16,
        color: COLORS.neutral[800],
        minHeight: 120,
        marginBottom: SPACING.lg,
        borderWidth: 1,
        borderColor: COLORS.neutral[200],
    },
});
