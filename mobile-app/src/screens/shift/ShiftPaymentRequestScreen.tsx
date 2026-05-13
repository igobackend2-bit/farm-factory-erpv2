import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IndianRupee, Building2, FileText, Clock3, CheckCircle2, ShieldCheck, Lock, AlertCircle } from 'lucide-react-native';
import { format, addHours } from 'date-fns';

import { supabase } from '../../services/supabase';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { COLORS, GRADIENT_COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../../theme';

type PaymentCategory = 'normal' | 'important' | 'emergency';
type PaymentMethod = 'bank_transfer' | 'upi';
type PaymentStatus =
    | 'pending'
    | 'smo_audit'
    | 'gmo_audit'
    | 'director_audit'
    | 'auditor_audit'
    | 'boi_audit'
    | 'gm_audit'
    | 'admin_audit'
    | 'ceo_audit'
    | 'hr_audit'
    | 'paid';

const CATEGORY_OPTIONS: { value: PaymentCategory; label: string; desc: string }[] = [
    { value: 'normal', label: 'Normal', desc: 'Standard processing' },
    { value: 'important', label: 'Important', desc: 'Priority approval required' },
    { value: 'emergency', label: 'Emergency', desc: 'Immediate payment required' },
];

function normalizeDepartment(rawDept?: string | null): string {
    if (!rawDept) return 'others';
    const dept = rawDept.toLowerCase().trim();
    if (dept === 'agrimart') return 'agri_mart';
    if (dept.includes('r&d') || dept === 'rnd' || dept === 'r_and_d' || dept.includes('research')) return 'r_and_d';
    if (dept === 'purchase' || dept.includes('procurement')) return 'purchase';
    if (dept === 'jv engineering' || dept === 'jv_engineering' || dept === 'jv eng' || dept.includes('jv')) return 'jv_engineering';
    if (dept.includes('agri') || dept.includes('farm')) return 'agri';
    if (dept.includes('engineering') || dept === 'eng') return 'engineering';
    if (dept === 'accounts') return 'accounts';
    if (dept === 'logistics') return 'logistics';
    if (dept === 'farmers_factory') return 'farmers_factory';
    return dept;
}

function getInitialPaymentStatus(department: string, role: string, tags: string[]): PaymentStatus {
    const normalizedDepartment = normalizeDepartment(department);
    const normalizedRole = role.toLowerCase();
    const lowerTags = tags.map((tag) => tag.toLowerCase());

    if (normalizedRole === 'admin') return 'admin_audit';
    if (normalizedRole === 'ceo') return 'ceo_audit';

    if (lowerTags.some((tag) => ['salary advance', 'salary_advance'].includes(tag))) {
        return normalizedRole === 'hr' ? 'admin_audit' : 'hr_audit';
    }

    if (normalizedDepartment === 'engineering') {
        if (normalizedRole === 'smo') return 'gmo_audit';
        if (normalizedRole === 'gmo') return 'boi_audit';
        if (normalizedRole === 'boi') return 'gm_audit';
        if (normalizedRole === 'gm') return 'admin_audit';
        return 'smo_audit';
    }

    if (normalizedDepartment === 'jv_engineering') {
        if (normalizedRole === 'smo') return 'director_audit';
        if (normalizedRole === 'director') return 'gm_audit';
        if (normalizedRole === 'gm') return 'admin_audit';
        return 'smo_audit';
    }

    if (normalizedDepartment === 'farmers_factory') {
        if (normalizedRole === 'auditor') return 'admin_audit';
        const requiresAuditor = tags.some((tag) => ['Farmers Factory Purchase Chennai', 'Hyderabad Purchase'].includes(tag));
        return requiresAuditor ? 'auditor_audit' : 'admin_audit';
    }

    if (normalizedDepartment === 'agri') {
        if (normalizedRole === 'smo') return 'boi_audit';
        if (normalizedRole === 'boi') return 'director_audit';
        if (normalizedRole === 'director') return 'admin_audit';
        return 'smo_audit';
    }

    if (normalizedDepartment === 'agri_mart' || normalizedDepartment === 'accounts') {
        return normalizedRole === 'director' ? 'admin_audit' : 'director_audit';
    }

    if (normalizedDepartment === 'r_and_d' || normalizedDepartment === 'purchase') {
        return normalizedRole === 'gm' ? 'admin_audit' : 'gm_audit';
    }

    return 'admin_audit';
}

export default function ShiftPaymentRequestScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();

    const [vendorName, setVendorName] = useState('');
    const [beneficiaryName, setBeneficiaryName] = useState('');
    const [purpose, setPurpose] = useState('');
    const [detailedDescription, setDetailedDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState<PaymentCategory>('normal');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer');
    const [vendorAccountNumber, setVendorAccountNumber] = useState('');
    const [vendorIfscCode, setVendorIfscCode] = useState('');
    const [vendorUpi, setVendorUpi] = useState('');
    const [tagsInput, setTagsInput] = useState('');
    const [cutoffDate, setCutoffDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [cutoffTime, setCutoffTime] = useState(format(addHours(new Date(), 2), 'HH:mm'));
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        const amountValue = Number(amount);

        if (!vendorName.trim()) {
            Alert.alert('Required', 'Please enter vendor name.');
            return;
        }
        if (!purpose.trim()) {
            Alert.alert('Required', 'Please enter payment purpose.');
            return;
        }
        if (!Number.isFinite(amountValue) || amountValue <= 0) {
            Alert.alert('Required', 'Please enter a valid amount.');
            return;
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoffDate) || !/^\d{2}:\d{2}$/.test(cutoffTime)) {
            Alert.alert('Invalid Format', 'Cut-off date must be YYYY-MM-DD and time must be HH:mm.');
            return;
        }
        if (paymentMethod === 'bank_transfer' && (!vendorAccountNumber.trim() || !vendorIfscCode.trim())) {
            Alert.alert('Required', 'Please enter account number and IFSC code.');
            return;
        }
        if (paymentMethod === 'upi' && !vendorUpi.trim()) {
            Alert.alert('Required', 'Please enter UPI ID.');
            return;
        }

        setLoading(true);
        try {
            const userResult = await supabase.auth.getUser();
            const user = userResult?.data?.user;
            if (!user) throw new Error('User not logged in');

            const { data: profile } = await supabase
                .from('profiles')
                .select('department, full_name, role')
                .eq('id', user.id)
                .maybeSingle();

            const now = new Date().toISOString();
            const tags = tagsInput
                .split(',')
                .map((tag) => tag.trim())
                .filter(Boolean);
            const initialStatus = getInitialPaymentStatus(profile?.department || '', profile?.role || 'employee', tags);
            const vendorBankDetails = paymentMethod === 'bank_transfer'
                ? `A/C: ${vendorAccountNumber.trim()}, IFSC: ${vendorIfscCode.trim().toUpperCase()}`
                : `UPI: ${vendorUpi.trim()}`;

            const timelineEntry = {
                status: initialStatus,
                user_id: user.id,
                user_name: profile?.full_name || 'User (Mobile)',
                role: 'requester',
                timestamp: now,
                notes: 'Created via Mobile App',
            };

            const payload = {
                requester_id: user.id,
                department: profile?.department || null,
                is_project_work: false,
                vendor_name: vendorName.trim(),
                vendor_bank_details: vendorBankDetails,
                purpose: purpose.trim(),
                detailed_description: detailedDescription.trim() || null,
                amount: amountValue,
                urgency: category,
                status: initialStatus,
                cutoff_date: cutoffDate,
                cutoff_time: cutoffTime,
                payment_type: paymentMethod,
                vendor_upi: paymentMethod === 'upi' ? vendorUpi.trim() : null,
                vendor_account_number: paymentMethod === 'bank_transfer' ? vendorAccountNumber.trim() : null,
                vendor_ifsc_code: paymentMethod === 'bank_transfer' ? vendorIfscCode.trim().toUpperCase() : null,
                beneficiary_name: beneficiaryName.trim() || vendorName.trim(),
                tags,
                bill_url: null,
                work_proof_url: null,
                audit_timeline: [timelineEntry],
            };

            let { error } = await supabase.from('payment_requests').insert(payload);

            if (error?.code === '42703') {
                const fallbackPayload: any = { ...payload };
                [
                    'department',
                    'is_project_work',
                    'detailed_description',
                    'payment_type',
                    'vendor_upi',
                    'vendor_account_number',
                    'vendor_ifsc_code',
                    'beneficiary_name',
                    'tags',
                    'bill_url',
                    'work_proof_url',
                    'audit_timeline',
                ].forEach((key) => delete fallbackPayload[key]);
                const fallback = await supabase.from('payment_requests').insert(fallbackPayload);
                error = fallback.error;
            }

            if (error) throw error;

            Alert.alert('Success', 'Payment request submitted for audit.', [
                {
                    text: 'OK',
                    onPress: () => navigation.goBack(),
                },
            ]);
        } catch (error: any) {
            console.warn('Payment request submit error:', error);
            Alert.alert('Error', error?.message || 'Failed to submit payment request.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <LinearGradient colors={GRADIENT_COLORS.background as [string, string, ...string[]]} style={styles.container}>
            <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + SPACING.md, paddingBottom: insets.bottom + SPACING.xl }]}>
                <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.heroCard}>
                    <View style={styles.heroTop}>
                        <View style={styles.heroBadge}>
                            <ShieldCheck size={14} color="#0f172a" />
                            <Text style={styles.heroBadgeText}>Audit-Controlled Workflow</Text>
                        </View>
                        <View style={styles.heroLock}>
                            <Lock size={14} color="#cbd5e1" />
                        </View>
                    </View>
                    <Text style={styles.title}>Payment Request</Text>
                    <Text style={styles.subtitle}>ERP-aligned workflow with shared routing and urgency controls</Text>
                    <View style={styles.heroInfoRow}>
                        <AlertCircle size={14} color="#94a3b8" />
                        <Text style={styles.heroInfoText}>Status on submit follows ERP department and tag routing</Text>
                    </View>
                </LinearGradient>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionOverline}>Payee Details</Text>
                </View>

                <GlassCard style={styles.card}>
                    <View style={styles.fieldHeader}>
                        <Building2 size={16} color={COLORS.primary[600]} />
                        <Text style={styles.fieldTitle}>Vendor Name</Text>
                    </View>
                    <TextInput
                        style={styles.input}
                        value={vendorName}
                        onChangeText={(value) => {
                            setVendorName(value);
                            if (!beneficiaryName.trim()) setBeneficiaryName(value);
                        }}
                        placeholder="Enter vendor name"
                        placeholderTextColor={COLORS.neutral[400]}
                    />
                </GlassCard>

                <GlassCard style={styles.card}>
                    <View style={styles.fieldHeader}>
                        <Building2 size={16} color={COLORS.primary[600]} />
                        <Text style={styles.fieldTitle}>Beneficiary Name</Text>
                    </View>
                    <TextInput
                        style={styles.input}
                        value={beneficiaryName}
                        onChangeText={setBeneficiaryName}
                        placeholder="Enter account holder / beneficiary name"
                        placeholderTextColor={COLORS.neutral[400]}
                    />
                </GlassCard>

                <GlassCard style={styles.card}>
                    <View style={styles.fieldHeader}>
                        <IndianRupee size={16} color={COLORS.primary[600]} />
                        <Text style={styles.fieldTitle}>Amount</Text>
                    </View>
                    <TextInput
                        style={styles.input}
                        value={amount}
                        onChangeText={setAmount}
                        placeholder="Enter amount"
                        keyboardType="decimal-pad"
                        placeholderTextColor={COLORS.neutral[400]}
                    />
                </GlassCard>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionOverline}>Business Justification</Text>
                </View>

                <GlassCard style={styles.card}>
                    <View style={styles.fieldHeader}>
                        <FileText size={16} color={COLORS.primary[600]} />
                        <Text style={styles.fieldTitle}>Purpose</Text>
                    </View>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        value={purpose}
                        onChangeText={setPurpose}
                        placeholder="Explain why this payment is needed"
                        placeholderTextColor={COLORS.neutral[400]}
                        multiline
                        textAlignVertical="top"
                    />
                </GlassCard>

                <GlassCard style={styles.card}>
                    <View style={styles.fieldHeader}>
                        <FileText size={16} color={COLORS.primary[600]} />
                        <Text style={styles.fieldTitle}>Detailed Description</Text>
                    </View>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        value={detailedDescription}
                        onChangeText={setDetailedDescription}
                        placeholder="Add ERP-facing business context and approval notes"
                        placeholderTextColor={COLORS.neutral[400]}
                        multiline
                        textAlignVertical="top"
                    />
                </GlassCard>

                <GlassCard style={styles.card}>
                    <Text style={styles.fieldTitle}>Urgency Category (ERP)</Text>
                    <Text style={styles.helperText}>Choose the same criticality model used in the web ERP screen.</Text>
                    <View style={styles.categoryGrid}>
                        {CATEGORY_OPTIONS.map((opt) => {
                            const selected = category === opt.value;
                            return (
                                <TouchableOpacity
                                    key={opt.value}
                                    style={[styles.categoryCard, selected ? styles.categoryCardSelected : null]}
                                    onPress={() => setCategory(opt.value)}
                                    activeOpacity={0.85}
                                >
                                    <View style={styles.categoryTitleRow}>
                                        <View style={[styles.categoryDot, selected ? styles.categoryDotSelected : null]} />
                                        <Text style={[styles.categoryTitle, selected ? styles.categoryTitleSelected : null]}>{opt.label}</Text>
                                    </View>
                                    <Text style={styles.categoryDesc}>{opt.desc}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </GlassCard>

                <GlassCard style={styles.card}>
                    <Text style={styles.fieldTitle}>Payment Method</Text>
                    <View style={styles.methodRow}>
                        {(['bank_transfer', 'upi'] as PaymentMethod[]).map((method) => {
                            const selected = paymentMethod === method;
                            return (
                                <TouchableOpacity
                                    key={method}
                                    style={[styles.methodChip, selected ? styles.methodChipSelected : null]}
                                    onPress={() => setPaymentMethod(method)}
                                    activeOpacity={0.85}
                                >
                                    <Text style={[styles.methodChipText, selected ? styles.methodChipTextSelected : null]}>
                                        {method === 'bank_transfer' ? 'Bank Transfer' : 'UPI'}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {paymentMethod === 'bank_transfer' ? (
                        <View style={styles.methodFields}>
                            <TextInput
                                style={styles.input}
                                value={vendorAccountNumber}
                                onChangeText={setVendorAccountNumber}
                                placeholder="Account number"
                                placeholderTextColor={COLORS.neutral[400]}
                            />
                            <TextInput
                                style={styles.input}
                                value={vendorIfscCode}
                                onChangeText={setVendorIfscCode}
                                placeholder="IFSC code"
                                autoCapitalize="characters"
                                placeholderTextColor={COLORS.neutral[400]}
                            />
                        </View>
                    ) : (
                        <View style={styles.methodFields}>
                            <TextInput
                                style={styles.input}
                                value={vendorUpi}
                                onChangeText={setVendorUpi}
                                placeholder="UPI ID"
                                autoCapitalize="none"
                                placeholderTextColor={COLORS.neutral[400]}
                            />
                        </View>
                    )}
                </GlassCard>

                <GlassCard style={styles.card}>
                    <Text style={styles.fieldTitle}>ERP Tags</Text>
                    <Text style={styles.helperText}>Comma-separated tags for workflow routing, reporting, and ERP filtering.</Text>
                    <TextInput
                        style={styles.input}
                        value={tagsInput}
                        onChangeText={setTagsInput}
                        placeholder="Example: Salary Advance, Hyderabad Purchase"
                        placeholderTextColor={COLORS.neutral[400]}
                    />
                </GlassCard>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionOverline}>Timeline</Text>
                </View>

                <GlassCard style={styles.card}>
                    <View style={styles.fieldHeader}>
                        <Clock3 size={16} color={COLORS.primary[600]} />
                        <Text style={styles.fieldTitle}>Cut-off</Text>
                    </View>
                    <View style={styles.cutoffRow}>
                        <TextInput
                            style={[styles.input, styles.cutoffInput]}
                            value={cutoffDate}
                            onChangeText={setCutoffDate}
                            placeholder="YYYY-MM-DD"
                            placeholderTextColor={COLORS.neutral[400]}
                        />
                        <TextInput
                            style={[styles.input, styles.cutoffInput]}
                            value={cutoffTime}
                            onChangeText={setCutoffTime}
                            placeholder="HH:mm"
                            placeholderTextColor={COLORS.neutral[400]}
                        />
                    </View>
                </GlassCard>

                <View style={styles.statusStrip}>
                    <Text style={styles.statusText}>Approval Route: Same routing logic as ERP based on department, role, and tags</Text>
                </View>

                <Button
                    title="Submit Payment Request"
                    onPress={handleSubmit}
                    loading={loading}
                    fullWidth
                    size="lg"
                    icon={<CheckCircle2 size={18} color="#fff" />}
                />
            </ScrollView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { paddingHorizontal: SPACING.lg },
    heroCard: {
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        marginBottom: SPACING.md,
        shadowColor: '#0f172a',
        shadowOpacity: 0.2,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 5,
    },
    heroTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: SPACING.sm,
    },
    heroBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#f8fafc',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    heroBadgeText: {
        fontSize: 11,
        color: '#0f172a',
        fontWeight: '700',
    },
    heroLock: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#334155',
    },
    title: {
        ...TYPOGRAPHY.h2,
        color: '#f8fafc',
    },
    subtitle: {
        ...TYPOGRAPHY.caption,
        color: '#cbd5e1',
        marginTop: 4,
    },
    heroInfoRow: {
        marginTop: SPACING.sm,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    heroInfoText: {
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '600',
    },
    sectionHeader: {
        marginBottom: 8,
        marginTop: 2,
    },
    sectionOverline: {
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        color: COLORS.neutral[500],
        fontWeight: '700',
    },
    card: {
        marginBottom: SPACING.md,
        padding: SPACING.md,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    fieldHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: SPACING.sm,
    },
    fieldTitle: {
        ...TYPOGRAPHY.captionBold,
        color: COLORS.neutral[700],
        marginBottom: 6,
    },
    helperText: {
        fontSize: 12,
        color: COLORS.neutral[500],
        marginBottom: SPACING.sm,
    },
    input: {
        borderWidth: 1,
        borderColor: COLORS.neutral[200],
        borderRadius: BORDER_RADIUS.md,
        backgroundColor: '#fff',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.md,
        fontSize: 15,
        color: COLORS.neutral[900],
    },
    textArea: {
        minHeight: 110,
    },
    categoryGrid: {
        gap: SPACING.sm,
    },
    categoryCard: {
        borderWidth: 1,
        borderColor: COLORS.neutral[200],
        borderRadius: BORDER_RADIUS.md,
        backgroundColor: '#fff',
        padding: SPACING.md,
    },
    categoryCardSelected: {
        borderColor: COLORS.primary[500],
        backgroundColor: '#eff6ff',
    },
    categoryTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    categoryDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.neutral[300],
    },
    categoryDotSelected: {
        backgroundColor: COLORS.primary[600],
    },
    categoryTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.neutral[700],
    },
    categoryTitleSelected: {
        color: COLORS.primary[700],
    },
    categoryDesc: {
        fontSize: 12,
        color: COLORS.neutral[500],
        marginTop: 4,
    },
    methodRow: {
        flexDirection: 'row',
        gap: SPACING.sm,
        marginTop: SPACING.xs,
    },
    methodChip: {
        flex: 1,
        borderWidth: 1,
        borderColor: COLORS.neutral[200],
        borderRadius: BORDER_RADIUS.full,
        paddingVertical: 10,
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    methodChipSelected: {
        borderColor: COLORS.primary[500],
        backgroundColor: COLORS.primary[50],
    },
    methodChipText: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.neutral[700],
    },
    methodChipTextSelected: {
        color: COLORS.primary[700],
    },
    methodFields: {
        gap: SPACING.sm,
        marginTop: SPACING.md,
    },
    cutoffRow: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    cutoffInput: {
        flex: 1,
    },
    statusStrip: {
        backgroundColor: '#fff7ed',
        borderWidth: 1,
        borderColor: '#fed7aa',
        borderRadius: BORDER_RADIUS.md,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        marginBottom: SPACING.md,
    },
    statusText: {
        fontSize: 12,
        color: '#9a3412',
        fontWeight: '700',
    },
});
