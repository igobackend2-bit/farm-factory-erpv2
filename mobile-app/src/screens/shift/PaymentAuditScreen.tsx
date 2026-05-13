import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IndianRupee, Clock, CheckCircle, XCircle, FileText, Building2 } from 'lucide-react-native';
import { format } from 'date-fns';

import { useMobilePaymentRequests, PaymentRequest } from '../../hooks/useMobilePaymentRequests';
import { useShiftUserStatus } from '../../hooks/useShiftUserStatus';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { COLORS, GRADIENT_COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../../theme';

export default function PaymentAuditScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const { userRole } = useShiftUserStatus();
    const { requests, isLoading, isActioning, approveRequest, rejectRequest, fetchRequests } = useMobilePaymentRequests();
    const [processingId, setProcessingId] = useState<string | null>(null);

    const handleApprove = async (id: string) => {
        setProcessingId(id);
        const result = await approveRequest(id);
        setProcessingId(null);
        if (result.success) {
            Alert.alert('Success', 'Payment processed successfully');
        } else {
            Alert.alert('Error', result.error || 'Failed to process');
        }
    };

    const handleReject = (id: string) => {
        Alert.prompt(
            'Reject Payment',
            'Please provide a reason for rejection:',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reject',
                    style: 'destructive',
                    onPress: async (reason) => {
                        if (!reason) return;
                        setProcessingId(id);
                        const result = await rejectRequest(id, reason);
                        setProcessingId(null);
                        if (result.success) {
                            Alert.alert('Rejected', 'Payment rejected successfully');
                        } else {
                            Alert.alert('Error', result.error || 'Failed to reject');
                        }
                    }
                }
            ],
            'plain-text'
        );
    };

    const getUrgencyColor = (urgency: string) => {
        switch (urgency) {
            case 'emergency': return COLORS.error[500];
            case 'important': return COLORS.warning[500];
            default: return COLORS.success[500];
        }
    };

    const subtitle = userRole === 'accounts' ? 'Accounts Execution' : 'Director Approval Pending';

    return (
        <LinearGradient colors={GRADIENT_COLORS.background as [string, string, ...string[]]} style={styles.container}>
            <View style={[styles.header, { marginTop: insets.top }]}>
                <View>
                    <Text style={styles.headerTitle}>Payment Board</Text>
                    <Text style={styles.headerSubtitle}>{subtitle}</Text>
                </View>
                <TouchableOpacity onPress={fetchRequests} disabled={isLoading}>
                    <StatusBadge status="live" size="sm" />
                </TouchableOpacity>
            </View>

            {isLoading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={COLORS.primary[500]} />
                </View>
            ) : requests.length === 0 ? (
                <View style={styles.center}>
                    <FileText size={48} color={COLORS.neutral[300]} />
                    <Text style={styles.emptyText}>No pending audits</Text>
                    <Button title="Refresh" onPress={fetchRequests} variant="outline" style={{ marginTop: 20 }} />
                </View>
            ) : (
                <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}>
                    {requests.map((request) => (
                        <GlassCard key={request.id} style={styles.card}>
                            <View style={styles.cardHeader}>
                                <View style={styles.vendorContainer}>
                                    <Building2 size={16} color={COLORS.neutral[500]} />
                                    <Text style={styles.vendorName}>{request.vendor_name}</Text>
                                </View>
                                {/* Map urgency to StatusBadge allowed types */}
                                <StatusBadge
                                    status={
                                        request.urgency === 'emergency' ? 'severe_late' :
                                            request.urgency === 'important' ? 'late' :
                                                'on_time'
                                    }
                                />
                            </View>

                            <Text style={styles.purpose}>{request.purpose}</Text>

                            <View style={styles.detailsRow}>
                                <View>
                                    <Text style={styles.label}>Amount</Text>
                                    <View style={styles.amountContainer}>
                                        <IndianRupee size={16} color={COLORS.neutral[900]} />
                                        <Text style={styles.amount}>{request.amount.toLocaleString('en-IN')}</Text>
                                    </View>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={styles.label}>Cut-off</Text>
                                    <View style={styles.dateContainer}>
                                        <Clock size={14} color={COLORS.warning[500]} />
                                        <Text style={styles.date}>
                                            {format(new Date(request.cutoff_date), 'dd MMM')}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {request.requester && (
                                <View style={styles.requesterRow}>
                                    <Text style={styles.requesterText}>
                                        Requested by: {request.requester.name} ({request.requester.department})
                                    </Text>
                                </View>
                            )}

                            <View style={styles.actions}>
                                <Button
                                    title="Reject"
                                    onPress={() => handleReject(request.id)}
                                    variant="outline"
                                    style={[styles.actionBtn, { borderColor: COLORS.error[500] }]}
                                    textStyle={{ color: COLORS.error[500] }}
                                    icon={<XCircle size={18} color={COLORS.error[500]} />}
                                    loading={processingId === request.id && isActioning}
                                    disabled={isActioning}
                                />
                                <Button
                                    title="Approve"
                                    onPress={() => handleApprove(request.id)}
                                    style={[styles.actionBtn, { backgroundColor: COLORS.success[500] }]}
                                    icon={<CheckCircle size={18} color="white" />}
                                    loading={processingId === request.id && isActioning}
                                    disabled={isActioning}
                                />
                            </View>
                        </GlassCard>
                    ))}
                </ScrollView>
            )}
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerTitle: { ...TYPOGRAPHY.h2, color: COLORS.neutral[900] },
    headerSubtitle: { ...TYPOGRAPHY.caption, color: COLORS.neutral[500] },
    content: { padding: SPACING.md },
    emptyText: { ...TYPOGRAPHY.body, color: COLORS.neutral[400], marginTop: SPACING.md },

    card: { marginBottom: SPACING.md, padding: SPACING.md },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    vendorContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    vendorName: { ...TYPOGRAPHY.captionBold, color: COLORS.neutral[600] },

    purpose: { ...TYPOGRAPHY.h4, color: COLORS.neutral[900], marginBottom: SPACING.md },

    detailsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: SPACING.md,
        backgroundColor: COLORS.neutral[50], // slight background for details
        padding: SPACING.sm,
        borderRadius: BORDER_RADIUS.sm
    },
    label: { ...TYPOGRAPHY.caption, color: COLORS.neutral[500], marginBottom: 2 },
    amountContainer: { flexDirection: 'row', alignItems: 'center' },
    amount: { fontSize: 18, fontWeight: '700', color: COLORS.neutral[900] },
    dateContainer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    date: { ...TYPOGRAPHY.bodyBold, color: COLORS.warning[500] },

    requesterRow: {
        marginBottom: SPACING.md,
    },
    requesterText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[400],
        fontStyle: 'italic'
    },

    actions: {
        flexDirection: 'row',
        gap: SPACING.md,
    },
    actionBtn: {
        flex: 1,
    }
});
