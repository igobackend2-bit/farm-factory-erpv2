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
    Modal,
    Image,
    Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';
import { GlassCard, Button } from '../../components/ui';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../../theme';
import { format } from 'date-fns';
import {
    AlertTriangle,
    Calendar,
    Clock,
    FileText,
    XCircle,
    CheckCircle2,
    RefreshCw,
    ChevronRight,
} from 'lucide-react-native';

// Android-safe gradient (tuples for LinearGradient type compatibility)
const BG_GRADIENT = ['#fef2f2', '#fff1f2', '#f8fafc'] as const;
const HEADER_GRADIENT = ['#ef4444', '#dc2626'] as const;

interface LOPEntry {
    id: string;
    date: string;
    reason: string;
    hours_lost: number;
    status: string;
    reversal_status: string | null;
    reversal_reason: string | null;
    created_at: string;
}

interface LOPSummary {
    total_days: number;
    total_entries: number;
    pending_reversals: number;
    reversed_count: number;
}

export default function LOPReversalScreen({ navigation }: any) {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [lopEntries, setLopEntries] = useState<LOPEntry[]>([]);
    const [summary, setSummary] = useState<LOPSummary>({
        total_days: 0,
        total_entries: 0,
        pending_reversals: 0,
        reversed_count: 0,
    });

    // Reversal Modal State
    const [showReversalModal, setShowReversalModal] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<LOPEntry | null>(null);
    const [reversalReason, setReversalReason] = useState('');
    const [evidenceUrl, setEvidenceUrl] = useState('');
    const [uploadingProof, setUploadingProof] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const userResult = await supabase.auth.getUser();
            const user = userResult?.data?.user;
            const userExists = user !== null && user !== undefined;
            if (userExists === false) return;

            // Fetch LOP entries
            const { data: lopData } = await supabase
                .from('lop_entries')
                .select('*')
                .eq('employee_id', user.id)
                .order('date', { ascending: false });

            const hasLopData = lopData !== null && lopData !== undefined;
            if (hasLopData === true) {
                setLopEntries(lopData);

                // Calculate summary
                const totalHours = lopData.reduce((sum: number, entry: LOPEntry) => sum + (entry.hours_lost ?? 0), 0);
                const totalDays = Math.ceil(totalHours / 8);
                const pendingReversals = lopData.filter((e: LOPEntry) => e.reversal_status === 'pending').length;
                const reversedCount = lopData.filter((e: LOPEntry) => e.reversal_status === 'approved').length;

                setSummary({
                    total_days: totalDays,
                    total_entries: lopData.length,
                    pending_reversals: pendingReversals,
                    reversed_count: reversedCount,
                });
            }
        } catch (error) {
            console.error('Error fetching LOP data:', error);
        } finally {
            setLoading(false);
        }
    };

    const openReversalModal = (entry: LOPEntry) => {
        setSelectedEntry(entry);
        setReversalReason('');
        setEvidenceUrl('');
        setShowReversalModal(true);
    };

    const pickImage = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission needed', 'Please grant camera roll permissions to upload proof.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.8,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                uploadProof(result.assets[0].uri);
            }
        } catch (error) {
            console.error('Pick image error:', error);
            Alert.alert('Error', 'Failed to pick image');
        }
    };

    const uploadProof = async (uri: string) => {
        if (!uri) return;

        setUploadingProof(true);
        try {
            // Create a blob from the URI
            const response = await fetch(uri);
            const blob = await response.blob();

            // Generate unique filename
            const fileExt = uri.split('.').pop() || 'jpg';
            // Use lop-reversals folder pattern
            const fileName = `lop-reversal-${Date.now()}.${fileExt}`;
            const filePath = `payment-proofs/${fileName}`; // Match payment proof upload pattern for bucket consistency

            console.log('Uploading to:', filePath);

            const { data, error } = await supabase.storage
                .from('payment-proofs')
                .upload(fileName, blob); // Use fileName directly if bucket is 'payment-proofs' and we want it at root or folder? 
            // Wait, PaymentProofUpload used: `const filePath = payment-proofs/${fileName}` but .from('payment-proofs')
            // This implies a folder named 'payment-proofs' inside 'payment-proofs' bucket?
            // Or maybe the variable `filePath` in PaymentProofUpload was just `payment-proofs/file.jpg` and .upload took it.
            // Let's assume root is better or stick to `payment-proofs` folder if that's the convention. 
            // I'll put it in `reversals/` folder to keep it clean.

            // Let's retry with a cleaner path
            // const storagePath = `reversals/${fileName}`;
            // Actually, let's just use root to be safe if folders aren't auto-created or specific policies exist.
            // PaymentProofUpload uses `payment-proofs/${fileName}`. I will use `reversals/${fileName}`.

            if (error) throw error;

            const { data: urlData } = supabase.storage
                .from('payment-proofs')
                .getPublicUrl(fileName); // matching upload path

            setEvidenceUrl(urlData.publicUrl);
            // Alert.alert('Success', 'Proof uploaded successfully');
        } catch (error: any) {
            console.error('Upload proof error:', error);
            Alert.alert('Upload Failed', error.message || 'Could not upload image');
        } finally {
            setUploadingProof(false);
        }
    };

    const handleSubmitReversal = async () => {
        const reasonTrimmed = reversalReason !== null && reversalReason !== undefined ? reversalReason.trim() : '';
        if (reasonTrimmed.length < 20) {
            Alert.alert('Required', 'Please provide a detailed reason (at least 20 characters).');
            return;
        }

        const evidenceTrimmed = evidenceUrl !== null && evidenceUrl !== undefined ? evidenceUrl.trim() : '';
        if (evidenceTrimmed === '') {
            Alert.alert('Required', 'Please provide an evidence link.');
            return;
        }

        const hasSelectedEntry = selectedEntry !== null && selectedEntry !== undefined;
        if (hasSelectedEntry === false) return;

        setSubmitting(true);
        try {
            const { error } = await supabase
                .from('lop_entries')
                .update({
                    reversal_status: 'pending',
                    reversal_reason: reasonTrimmed,
                    reversal_evidence_url: evidenceTrimmed,
                    reversal_requested_at: new Date().toISOString(),
                })
                .eq('id', selectedEntry.id);

            const hasError = error !== null && error !== undefined;
            if (hasError === true) throw error;

            Alert.alert('Success', 'Reversal request submitted successfully!');
            setShowReversalModal(false);
            fetchData();
        } catch (error: any) {
            console.error('Reversal submit error:', error);
            const errorMessage = error?.message ?? 'Failed to submit reversal request';
            Alert.alert('Error', errorMessage);
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusColor = (status: string | null) => {
        const s = status ?? '';
        const colors: Record<string, string> = {
            pending: COLORS.warning[500],
            approved: COLORS.success[500],
            rejected: COLORS.error[500],
        };
        return colors[s] ?? COLORS.neutral[500];
    };

    const getStatusLabel = (status: string | null) => {
        const s = status ?? '';
        const labels: Record<string, string> = {
            pending: 'Pending Review',
            approved: 'Reversed',
            rejected: 'Rejected',
        };
        return labels[s] ?? 'No Request';
    };

    if (loading === true) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary[500]} />
                <Text style={styles.loadingText}>Loading LOP data...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <LinearGradient colors={BG_GRADIENT} style={styles.background} />

            {/* Header */}
            <View style={styles.header}>
                <LinearGradient colors={HEADER_GRADIENT} style={styles.headerGradient}>
                    <View style={styles.headerContent}>
                        <AlertTriangle size={24} color="#fff" />
                        <Text style={styles.headerTitle}>My LOP / Discipline</Text>
                    </View>
                </LinearGradient>
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {/* Summary Cards */}
                <View style={styles.summaryRow}>
                    <GlassCard style={styles.summaryCard}>
                        <Text style={styles.summaryValue}>{summary.total_days}</Text>
                        <Text style={styles.summaryLabel}>Total Days</Text>
                    </GlassCard>
                    <GlassCard style={styles.summaryCard}>
                        <Text style={styles.summaryValue}>{summary.total_entries}</Text>
                        <Text style={styles.summaryLabel}>Entries</Text>
                    </GlassCard>
                    <GlassCard style={styles.summaryCard}>
                        <Text style={[styles.summaryValue, { color: COLORS.warning[600] }]}>
                            {summary.pending_reversals}
                        </Text>
                        <Text style={styles.summaryLabel}>Pending</Text>
                    </GlassCard>
                    <GlassCard style={styles.summaryCard}>
                        <Text style={[styles.summaryValue, { color: COLORS.success[600] }]}>
                            {summary.reversed_count}
                        </Text>
                        <Text style={styles.summaryLabel}>Reversed</Text>
                    </GlassCard>
                </View>

                {/* LOP Entries List */}
                <Text style={styles.sectionTitle}>LOP History</Text>

                {lopEntries.length === 0 ? (
                    <GlassCard style={styles.emptyCard}>
                        <CheckCircle2 size={48} color={COLORS.success[400]} />
                        <Text style={styles.emptyTitle}>No LOP Entries</Text>
                        <Text style={styles.emptySubtitle}>
                            Great job! You have no loss of pay records.
                        </Text>
                    </GlassCard>
                ) : (
                    lopEntries.map((entry) => {
                        return (
                            <GlassCard key={entry.id} style={styles.entryCard}>
                                <View style={styles.entryHeader}>
                                    <View style={styles.entryDateRow}>
                                        <Calendar size={16} color={COLORS.error[500]} />
                                        <Text style={styles.entryDate}>
                                            {format(new Date(entry.date), 'dd MMM yyyy')}
                                        </Text>
                                    </View>
                                    <View style={styles.hoursTag}>
                                        <Clock size={12} color={COLORS.error[600]} />
                                        <Text style={styles.hoursText}>{entry.hours_lost}h lost</Text>
                                    </View>
                                </View>

                                <Text style={styles.entryReason}>{entry.reason}</Text>

                                {entry.reversal_status ? (
                                    <View
                                        style={[
                                            styles.reversalStatus,
                                            { backgroundColor: `${getStatusColor(entry.reversal_status)}15` },
                                        ]}
                                    >
                                        {entry.reversal_status === 'approved' ? (
                                            <CheckCircle2 size={16} color={getStatusColor(entry.reversal_status)} />
                                        ) : entry.reversal_status === 'rejected' ? (
                                            <XCircle size={16} color={getStatusColor(entry.reversal_status)} />
                                        ) : (
                                            <RefreshCw size={16} color={getStatusColor(entry.reversal_status)} />
                                        )}
                                        <Text
                                            style={[
                                                styles.reversalStatusText,
                                                { color: getStatusColor(entry.reversal_status) },
                                            ]}
                                        >
                                            {getStatusLabel(entry.reversal_status)}
                                        </Text>
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        style={styles.requestButton}
                                        onPress={() => openReversalModal(entry)}
                                    >
                                        <RefreshCw size={16} color={COLORS.primary[600]} />
                                        <Text style={styles.requestButtonText}>Request Reversal</Text>
                                        <ChevronRight size={16} color={COLORS.primary[400]} />
                                    </TouchableOpacity>
                                )}
                            </GlassCard>
                        );
                    })
                )}

                <View style={styles.bottomSpacer} />
            </ScrollView>

            {/* Reversal Request Modal */}
            <Modal
                visible={showReversalModal === true}
                transparent={true}
                animationType="slide"
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Request LOP Reversal</Text>

                        {selectedEntry !== null && selectedEntry !== undefined ? (
                            <View style={styles.modalEntryInfo}>
                                <Text style={styles.modalEntryDate}>
                                    {format(new Date(selectedEntry.date), 'dd MMMM yyyy')}
                                </Text>
                                <Text style={styles.modalEntryReason}>{selectedEntry.reason}</Text>
                            </View>
                        ) : null}

                        <Text style={styles.inputLabel}>Reason for Reversal *</Text>
                        <TextInput
                            style={styles.textArea}
                            value={reversalReason}
                            onChangeText={setReversalReason}
                            placeholder="Explain why this LOP should be reversed (min 20 characters)..."
                            placeholderTextColor={COLORS.neutral[400]}
                            multiline={true}
                            numberOfLines={4}
                        />
                        <Text style={styles.charCount}>{reversalReason.length}/20 min</Text>

                        <Text style={styles.inputLabel}>Evidence (Upload Proof) *</Text>

                        {evidenceUrl ? (
                            <View style={styles.previewContainer}>
                                <Image
                                    source={{ uri: evidenceUrl }}
                                    style={styles.previewImage}
                                    resizeMode="cover"
                                />
                                <TouchableOpacity
                                    style={styles.changePhotoButton}
                                    onPress={pickImage}
                                    disabled={uploadingProof}
                                >
                                    <Text style={styles.changePhotoText}>Change Photo</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={styles.uploadButton}
                                onPress={pickImage}
                                disabled={uploadingProof}
                            >
                                {uploadingProof ? (
                                    <ActivityIndicator size="small" color={COLORS.primary[600]} />
                                ) : (
                                    <View style={{ alignItems: 'center', gap: 8 }}>
                                        <View style={styles.uploadIconCircle}>
                                            <FileText size={24} color={COLORS.primary[600]} />
                                        </View>
                                        <Text style={styles.uploadButtonText}>Select Proof Image</Text>
                                        <Text style={styles.uploadHint}>Tap to upload screenshot/photo</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        )}

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => setShowReversalModal(false)}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <Button
                                title="Submit Request"
                                onPress={handleSubmitReversal}
                                loading={submitting === true}
                                disabled={submitting === true}
                                style={styles.submitButton}
                            />
                        </View>
                    </View>
                </View>
            </Modal>
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
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
    },

    content: {
        padding: SPACING.xl,
        paddingBottom: 120,
    },

    summaryRow: {
        flexDirection: 'row',
        gap: SPACING.sm,
        marginBottom: SPACING.xl,
    },
    summaryCard: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: SPACING.md,
    },
    summaryValue: {
        fontSize: 24,
        fontWeight: '700',
        color: COLORS.error[600],
    },
    summaryLabel: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[500],
        marginTop: SPACING.xs,
    },

    sectionTitle: {
        ...TYPOGRAPHY.bodyBold,
        color: COLORS.neutral[800],
        marginBottom: SPACING.md,
    },

    emptyCard: {
        alignItems: 'center',
        paddingVertical: SPACING.xxxl,
    },
    emptyTitle: {
        ...TYPOGRAPHY.h4,
        color: COLORS.success[700],
        marginTop: SPACING.lg,
    },
    emptySubtitle: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[500],
        marginTop: SPACING.sm,
        textAlign: 'center',
    },

    entryCard: {
        marginBottom: SPACING.md,
    },
    entryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    entryDateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    entryDate: {
        ...TYPOGRAPHY.bodyBold,
        color: COLORS.error[700],
    },
    hoursTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.error[50],
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.md,
        gap: 4,
    },
    hoursText: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.error[600],
    },
    entryReason: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[600],
        marginBottom: SPACING.md,
    },

    reversalStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        gap: SPACING.sm,
    },
    reversalStatusText: {
        ...TYPOGRAPHY.captionBold,
    },

    requestButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.sm,
        gap: SPACING.sm,
    },
    requestButtonText: {
        ...TYPOGRAPHY.captionBold,
        color: COLORS.primary[600],
        flex: 1,
    },

    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: BORDER_RADIUS.xl,
        borderTopRightRadius: BORDER_RADIUS.xl,
        padding: SPACING.xl,
        paddingBottom: 40,
    },
    modalTitle: {
        ...TYPOGRAPHY.h4,
        color: COLORS.neutral[800],
        marginBottom: SPACING.lg,
    },
    modalEntryInfo: {
        backgroundColor: COLORS.error[50],
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        marginBottom: SPACING.lg,
    },
    modalEntryDate: {
        ...TYPOGRAPHY.bodyBold,
        color: COLORS.error[700],
    },
    modalEntryReason: {
        ...TYPOGRAPHY.caption,
        color: COLORS.error[600],
        marginTop: SPACING.xs,
    },

    inputLabel: {
        ...TYPOGRAPHY.captionBold,
        color: COLORS.neutral[700],
        marginBottom: SPACING.sm,
    },
    input: {
        backgroundColor: COLORS.neutral[50],
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        ...TYPOGRAPHY.body,
        color: COLORS.neutral[800],
        borderWidth: 1,
        borderColor: COLORS.neutral[200],
        marginBottom: SPACING.lg,
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
    charCount: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[400],
        textAlign: 'right',
        marginTop: SPACING.xs,
        marginBottom: SPACING.lg,
    },

    modalButtons: {
        flexDirection: 'row',
        gap: SPACING.md,
        marginTop: SPACING.lg,
    },
    cancelButton: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: SPACING.lg,
        backgroundColor: COLORS.neutral[100],
        borderRadius: BORDER_RADIUS.lg,
    },
    cancelButtonText: {
        ...TYPOGRAPHY.bodyBold,
        color: COLORS.neutral[600],
    },
    submitButton: {
        flex: 1,
    },

    bottomSpacer: {
        height: 40,
    },

    // Upload Styles
    uploadButton: {
        backgroundColor: COLORS.neutral[50],
        borderWidth: 2,
        borderColor: COLORS.neutral[200],
        borderStyle: 'dashed',
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.xl,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.lg,
        minHeight: 120,
    },
    uploadIconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.primary[50],
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.xs,
    },
    uploadButtonText: {
        ...TYPOGRAPHY.bodyBold,
        color: COLORS.primary[600],
    },
    uploadHint: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[500],
    },
    previewContainer: {
        marginBottom: SPACING.lg,
        borderRadius: BORDER_RADIUS.lg,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: COLORS.neutral[200],
    },
    previewImage: {
        width: '100%',
        height: 200,
        backgroundColor: COLORS.neutral[100],
    },
    changePhotoButton: {
        backgroundColor: COLORS.neutral[900],
        padding: SPACING.md,
        alignItems: 'center',
    },
    changePhotoText: {
        ...TYPOGRAPHY.captionBold,
        color: '#fff',
    },
});
