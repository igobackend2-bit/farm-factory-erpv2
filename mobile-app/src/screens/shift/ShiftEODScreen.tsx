import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FileText, Send, CheckCircle2 } from 'lucide-react-native';

import { useShiftSession } from '../../hooks/useShiftSession';
import { useShiftEOD } from '../../hooks/useShiftEOD';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { COLORS, GRADIENT_COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../../theme';

export default function ShiftEODScreen() {
    const insets = useSafeAreaInsets();
    const { currentSession } = useShiftSession();
    const { eodSummary, loading, isSubmitting, submitEOD } = useShiftEOD(currentSession?.id);
    const [summary, setSummary] = useState('');

    useEffect(() => {
        if (eodSummary) {
            setSummary(eodSummary.summary || '');
        }
    }, [eodSummary]);

    const handleSubmit = async () => {
        if (!summary.trim()) return;
        await submitEOD(summary);
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={COLORS.primary[500]} />
            </View>
        );
    }

    if (!currentSession) {
        return (
            <LinearGradient colors={GRADIENT_COLORS.background as [string, string, ...string[]]} style={styles.container}>
                <View style={[styles.content, { paddingTop: insets.top + SPACING.xl }]}>
                    <Text style={styles.errorText}>No active shift session.</Text>
                </View>
            </LinearGradient>
        );
    }

    const isSubmitted = !!eodSummary;

    return (
        <LinearGradient colors={GRADIENT_COLORS.background as [string, string, ...string[]]} style={styles.container}>
            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}>
                {/* Header */}
                <View style={[styles.header, { marginTop: insets.top + SPACING.md }]}>
                    <Text style={styles.title}>End of Day</Text>
                    <Text style={styles.subtitle}>Review your day and submit final report</Text>
                </View>

                {/* Main Card */}
                <GlassCard style={[styles.card, isSubmitted ? styles.cardSubmitted : null]}>
                    <View style={[styles.cardHeader, isSubmitted ? styles.headerSubmitted : styles.headerDefault]}>
                        <View style={[styles.iconBox, isSubmitted ? styles.iconSubmitted : styles.iconDefault]}>
                            <FileText size={20} color={isSubmitted ? COLORS.success[500] : COLORS.primary[500]} />
                        </View>
                        <View>
                            <Text style={styles.cardTitle}>Daily Summary</Text>
                            <Text style={styles.cardSubtitle}>Key achievements and blockers</Text>
                        </View>
                    </View>

                    <View style={styles.cardBody}>
                        <TextInput
                            style={styles.input}
                            value={summary}
                            onChangeText={setSummary}
                            placeholder="What did you focus on today? Any challenges?"
                            placeholderTextColor={COLORS.neutral[400]}
                            multiline
                            textAlignVertical="top"
                            editable={!isSubmitted}
                        />

                        {isSubmitted ? (
                            <View style={styles.successBox}>
                                <CheckCircle2 size={24} color={COLORS.success[600]} />
                                <Text style={styles.successText}>Summary Submitted</Text>
                            </View>
                        ) : (
                            <Button
                                title="Submit Final Report"
                                onPress={handleSubmit}
                                loading={isSubmitting}
                                disabled={!summary.trim()}
                                style={styles.submitBtn}
                                icon={<Send size={20} color="white" />}
                            />
                        )}
                    </View>
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
        padding: 0,
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.7)',
        borderColor: COLORS.primary[200],
        borderWidth: 1,
    },
    cardSubmitted: {
        borderColor: COLORS.success[200],
        backgroundColor: 'rgba(240, 253, 244, 0.5)',
    },
    cardHeader: {
        padding: SPACING.lg,
        borderBottomWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
    },
    headerDefault: {
        backgroundColor: 'rgba(59, 130, 246, 0.05)',
        borderBottomColor: 'rgba(59, 130, 246, 0.1)',
    },
    headerSubmitted: {
        backgroundColor: 'rgba(34, 197, 94, 0.05)',
        borderBottomColor: 'rgba(34, 197, 94, 0.1)',
    },
    iconBox: {
        padding: SPACING.xs,
        borderRadius: BORDER_RADIUS.sm,
    },
    iconDefault: {
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
    },
    iconSubmitted: {
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
    },
    cardTitle: {
        ...TYPOGRAPHY.h4,
        color: COLORS.neutral[900],
    },
    cardSubtitle: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[500],
    },
    cardBody: {
        padding: SPACING.lg,
    },
    input: {
        minHeight: 200,
        backgroundColor: COLORS.glass.white,
        borderWidth: 1,
        borderColor: COLORS.neutral[200],
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        fontSize: 16,
        color: COLORS.neutral[900],
        marginBottom: SPACING.lg,
    },
    submitBtn: {
        height: 56,
    },
    successBox: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.lg,
        backgroundColor: COLORS.success[50],
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.success[200],
        gap: SPACING.sm,
    },
    successText: {
        ...TYPOGRAPHY.bodyBold,
        color: COLORS.success[700],
    },
    errorText: {
        textAlign: 'center',
        color: COLORS.neutral[500],
    },
});
