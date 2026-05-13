import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    ActivityIndicator,
    FlatList,
    Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../services/supabase';
import { AppScreen, GlassCard, Button } from '../../components/ui';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../theme';
import {
    Wallet,
    DollarSign,
    FileText,
    Calendar,
    Upload,
    X,
    CheckCircle2,
    AlertTriangle,
    FolderOpen,
    Save,
    Send,
    Plus,
    File,
    Image as ImageIcon,
    Trash2,
    Eye,
    Download,
} from 'lucide-react-native';
import { format } from 'date-fns';

type PaymentType = 'general' | 'porter' | 'transport';

type PaymentCategory = 
    | 'local_purchase' | 'labour_payment' | 'material_payment' | 'transport_logistics'
    | 'vendor_advance' | 'site_expense' | 'ads_payment' | 'software'
    | 'home_order' | 'polyhouse_advance' | 'site_visit_expense' | 'office_expenses'
    | 'petty_cash_refill' | 'palm_cafe' | 'courier_notary' | 'franchise_payout'
    | 'soil_water_report' | 'buy_back_client' | 'salary_advance' | 'engineering_project'
    | 'valluvam' | 'ceo_ai' | 'notary_bond' | 'jv_room_rent' | 'other';

type Project = {
    id: string;
    name: string;
    code: string;
    status: 'active' | 'completed' | 'on_hold';
};

type WorkOrder = {
    id: string;
    title: string;
    project_id: string;
    status: 'pending' | 'in_progress' | 'completed';
};

type Attachment = {
    id: string;
    name: string;
    type: 'image' | 'document';
    uri: string;
    size?: number;
};

const PAYMENT_TYPES: { value: PaymentType; label: string; description: string; requiresApproval: boolean }[] = [
    { value: 'general', label: 'General (Project/Operational)', description: 'Engineering & other departments - includes project combinations', requiresApproval: true },
    { value: 'porter', label: 'Porter Payment', description: 'Porter/Daily wage payments', requiresApproval: true },
    { value: 'transport', label: 'Transport Payment', description: 'Transport and logistics', requiresApproval: true },
];

const PAYMENT_CATEGORIES: { value: PaymentCategory; label: string; group: string }[] = [
    { value: 'local_purchase', label: 'Local Purchase', group: 'Purchase' },
    { value: 'labour_payment', label: 'Labour Payment', group: 'Purchase' },
    { value: 'material_payment', label: 'Material Payment', group: 'Purchase' },
    { value: 'transport_logistics', label: 'Transport/Logistics', group: 'Purchase' },
    { value: 'vendor_advance', label: 'Vendor Advance', group: 'Purchase' },
    { value: 'site_expense', label: 'Site Expense', group: 'Project' },
    { value: 'ads_payment', label: 'Ads Payment', group: 'Marketing' },
    { value: 'software', label: 'Software', group: 'IT' },
    { value: 'home_order', label: 'HOME ORDER', group: 'Project' },
    { value: 'polyhouse_advance', label: 'Polyhouse Advance', group: 'Project' },
    { value: 'site_visit_expense', label: 'Site Visit Expense', group: 'Project' },
    { value: 'office_expenses', label: 'Office Expenses', group: 'Operations' },
    { value: 'petty_cash_refill', label: 'Petty Cash Refill', group: 'Finance' },
    { value: 'palm_cafe', label: 'Palm Cafe', group: 'Operations' },
    { value: 'courier_notary', label: 'Courier and Notary', group: 'Operations' },
    { value: 'franchise_payout', label: 'Franchise Payout', group: 'Finance' },
    { value: 'soil_water_report', label: 'Soil and Water Report', group: 'Project' },
    { value: 'buy_back_client', label: 'Buy Back Client Payout', group: 'Finance' },
    { value: 'salary_advance', label: 'Salary Advance', group: 'HR' },
    { value: 'engineering_project', label: 'Engineering Project', group: 'Project' },
    { value: 'valluvam', label: 'Valluvam', group: 'Project' },
    { value: 'ceo_ai', label: 'CEO SIR AI', group: 'Operations' },
    { value: 'notary_bond', label: 'Notary Bond', group: 'Legal' },
    { value: 'jv_room_rent', label: 'JV Room Rent', group: 'Finance' },
    { value: 'other', label: 'Other', group: 'Other' },
];

const URGENCY_LEVELS = [
    { value: 'normal', label: 'Normal', days: 3 },
    { value: 'urgent', label: 'Urgent', days: 1 },
    { value: 'critical', label: 'Critical', days: 0 },
];

export default function PaymentRequestScreen({ navigation }: any) {
    const [paymentType, setPaymentType] = useState<PaymentType>('general');
    const [paymentCategory, setPaymentCategory] = useState<PaymentCategory>('other');
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');
    const [description, setDescription] = useState('');
    const [selectedProject, setSelectedProject] = useState<string>('');
    const [selectedWorkOrder, setSelectedWorkOrder] = useState<string>('');
    const [urgency, setUrgency] = useState('normal');
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [bankProofs, setBankProofs] = useState<Attachment[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [savingDraft, setSavingDraft] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isDraft, setIsDraft] = useState(false);
    
    // Payee Details
    const [payeeName, setPayeeName] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
    const [accountNumber, setAccountNumber] = useState('');
    const [confirmAccount, setConfirmAccount] = useState('');
    const [ifscCode, setIfscCode] = useState('');
    const [beneficiaryName, setBeneficiaryName] = useState('');
    const [saveToMaster, setSaveToMaster] = useState(false);
    
    // Recording
    const [recordingUnit, setRecordingUnit] = useState('manual');

    useEffect(() => {
        fetchProjects();
        fetchWorkOrders();
        setLoading(false);
    }, []);

    const fetchProjects = async () => {
        try {
            const { data, error } = await supabase
                .from('projects')
                .select('id, name, code, status')
                .eq('status', 'active')
                .order('name');

            if (error) throw error;
            setProjects(data || []);
        } catch (error) {
            console.error('Error fetching projects:', error);
        }
    };

    const fetchWorkOrders = async () => {
        try {
            const { data, error } = await supabase
                .from('work_orders')
                .select('id, title, project_id, status')
                .in('status', ['pending', 'in_progress'])
                .order('title');

            if (error) throw error;
            setWorkOrders(data || []);
        } catch (error) {
            console.error('Error fetching work orders:', error);
        }
    };

    const pickImage = async () => {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permissionResult.granted === false) {
            Alert.alert('Permission required', 'Camera roll permissions are required to attach images.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            const asset = result.assets[0];
            const attachment: Attachment = {
                id: Date.now().toString(),
                name: asset.fileName || `image_${Date.now()}.jpg`,
                type: 'image',
                uri: asset.uri,
                size: asset.fileSize,
            };
            setAttachments(prev => [...prev, attachment]);
        }
    };
    
    const pickBankProof = async () => {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permissionResult.granted === false) {
            Alert.alert('Permission required', 'Camera roll permissions are required to attach bank proofs.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            const asset = result.assets[0];
            const attachment: Attachment = {
                id: Date.now().toString(),
                name: asset.fileName || `bank_proof_${Date.now()}.jpg`,
                type: 'image',
                uri: asset.uri,
                size: asset.fileSize,
            };
            setBankProofs(prev => [...prev, attachment]);
        }
    };

    const pickDocument = async () => {
        Alert.alert('Coming Soon', 'Document attachment feature will be available soon. Please use image attachments for now.');
    };

    const removeAttachment = (id: string) => {
        setAttachments(prev => prev.filter(att => att.id !== id));
    };
    
    const removeBankProof = (id: string) => {
        setBankProofs(prev => prev.filter(att => att.id !== id));
    };

    const validateForm = () => {
        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0.');
            return false;
        }

        if (amountNum > 50000) {
            Alert.alert('High Amount', 'Amounts over ₹50,000 require additional approval. Please contact your manager.');
            return false;
        }

        const reasonTrimmed = reason.trim();
        if (reasonTrimmed === '') {
            Alert.alert('Required', 'Please provide a reason for this payment request.');
            return false;
        }

        if (reasonTrimmed.length < 10) {
            Alert.alert('Insufficient Detail', 'Please provide a more detailed reason (minimum 10 characters).');
            return false;
        }

        const selectedType = PAYMENT_TYPES.find(type => type.value === paymentType);
        if (selectedType?.requiresApproval && attachments.length === 0) {
            Alert.alert('Attachments Required', 'Please attach supporting documents for this type of payment request.');
            return false;
        }

        return true;
    };

    const saveAsDraft = async () => {
        if (!validateForm()) return;

        setSavingDraft(true);
        try {
            const userResult = await supabase.auth.getUser();
            const user = userResult?.data?.user;
            if (!user) throw new Error('Not authenticated');

            const draftData = {
                employee_id: user.id,
                payment_type: paymentType,
                amount: parseFloat(amount),
                reason: reason.trim(),
                description: description.trim(),
                project_id: selectedProject || null,
                work_order_id: selectedWorkOrder || null,
                attachments: attachments,
                status: 'draft',
                requested_at: new Date().toISOString(),
            };

            const { data, error } = await supabase
                .from('payment_requests')
                .insert(draftData)
                .select()
                .single();

            if (error) throw error;

            Alert.alert('Success', 'Payment request saved as draft!');
            resetForm();
        } catch (error: any) {
            console.error('Draft save error:', error);
            Alert.alert('Error', error?.message || 'Failed to save draft');
        } finally {
            setSavingDraft(false);
        }
    };

    const handleSubmit = async () => {
        if (!validateForm()) return;

        setSubmitting(true);
        try {
            const userResult = await supabase.auth.getUser();
            const user = userResult?.data?.user;
            if (!user) throw new Error('Not authenticated');

            const requestData = {
                employee_id: user.id,
                payment_type: paymentType,
                amount: parseFloat(amount),
                reason: reason.trim(),
                description: description.trim(),
                project_id: selectedProject || null,
                work_order_id: selectedWorkOrder || null,
                attachments: attachments,
                status: 'pending',
                requested_at: new Date().toISOString(),
            };

            const { data, error } = await supabase
                .from('payment_requests')
                .insert(requestData)
                .select()
                .single();

            if (error) throw error;

            Alert.alert('Success', 'Payment request submitted successfully!');
            resetForm();
        } catch (error: any) {
            console.error('Payment request error:', error);
            Alert.alert('Error', error?.message || 'Failed to submit payment request');
        } finally {
            setSubmitting(false);
        }
    };

    const resetForm = () => {
        setAmount('');
        setReason('');
        setDescription('');
        setSelectedProject('');
        setSelectedWorkOrder('');
        setAttachments([]);
        setPaymentType('general');
        setIsDraft(false);
    };

    const selectedTypeInfo = PAYMENT_TYPES.find(type => type.value === paymentType);
    const filteredWorkOrders = workOrders.filter(wo => !selectedProject || wo.project_id === selectedProject);

    const renderAttachment = ({ item }: { item: Attachment }) => (
        <View style={styles.attachmentItem}>
            <View style={styles.attachmentInfo}>
                {item.type === 'image' ? (
                    <ImageIcon size={20} color={COLORS.primary[600]} />
                ) : (
                    <File size={20} color={COLORS.primary[600]} />
                )}
                <View style={styles.attachmentDetails}>
                    <Text style={styles.attachmentName} numberOfLines={1}>
                        {item.name}
                    </Text>
                    {item.size && (
                        <Text style={styles.attachmentSize}>
                            {(item.size / 1024).toFixed(1)} KB
                        </Text>
                    )}
                </View>
            </View>
            <TouchableOpacity
                style={styles.removeAttachment}
                onPress={() => removeAttachment(item.id)}
            >
                <X size={16} color={COLORS.error[500]} />
            </TouchableOpacity>
        </View>
    );

    if (loading) {
        return (
            <AppScreen>
                <View style={styles.loaderContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary[600]} />
                    <Text style={styles.loaderText}>Loading payment request form...</Text>
                </View>
            </AppScreen>
        );
    }

    return (
        <AppScreen>
            <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <Wallet size={32} color={COLORS.primary[600]} />
                    <Text style={styles.title}>Payment Request</Text>
                    <Text style={styles.subtitle}>Request payments with project tracking and attachments</Text>
                </View>

                {/* Payment Type Selection */}
                <GlassCard style={styles.section}>
                    <Text style={styles.sectionTitle}>Payment Type</Text>
                    <View style={styles.pickerContainer}>
                        <Picker
                            selectedValue={paymentType}
                            onValueChange={(value: PaymentType) => setPaymentType(value)}
                            style={styles.picker}
                        >
                            {PAYMENT_TYPES.map((type) => (
                                <Picker.Item
                                    key={type.value}
                                    label={type.label}
                                    value={type.value}
                                />
                            ))}
                        </Picker>
                    </View>
                    {selectedTypeInfo && (
                        <View style={styles.typeInfo}>
                            <Text style={styles.typeDescription}>
                                {selectedTypeInfo.description}
                            </Text>
                            {selectedTypeInfo.requiresApproval && (
                                <View style={styles.approvalRequired}>
                                    <AlertTriangle size={14} color={COLORS.warning[600]} />
                                    <Text style={styles.approvalText}>Requires approval</Text>
                                </View>
                            )}
                        </View>
                    )}
                </GlassCard>

                {/* Project Selection */}
                {paymentType === 'general' && (
                    <GlassCard style={styles.section}>
                        <Text style={styles.sectionTitle}>Project</Text>
                        <View style={styles.pickerContainer}>
                            <Picker
                                selectedValue={selectedProject}
                                onValueChange={setSelectedProject}
                                style={styles.picker}
                            >
                                <Picker.Item label="Select Project" value="" />
                                {projects.map((project) => (
                                    <Picker.Item
                                        key={project.id}
                                        label={`${project.code} - ${project.name}`}
                                        value={project.id}
                                    />
                                ))}
                            </Picker>
                        </View>
                    </GlassCard>
                )}

                {/* Work Order Selection */}
                {selectedProject && (
                    <GlassCard style={styles.section}>
                        <Text style={styles.sectionTitle}>Work Order (Optional)</Text>
                        <View style={styles.pickerContainer}>
                            <Picker
                                selectedValue={selectedWorkOrder}
                                onValueChange={setSelectedWorkOrder}
                                style={styles.picker}
                            >
                                <Picker.Item label="Select Work Order" value="" />
                                {filteredWorkOrders.map((wo) => (
                                    <Picker.Item
                                        key={wo.id}
                                        label={wo.title}
                                        value={wo.id}
                                    />
                                ))}
                            </Picker>
                        </View>
                    </GlassCard>
                )}

                {/* Payment Category */}
                <GlassCard style={styles.section}>
                    <Text style={styles.sectionTitle}>Payment Category</Text>
                    <Text style={styles.fieldHint}>Categorize this payment for better tracking & reporting</Text>
                    <View style={styles.pickerContainer}>
                        <Picker
                            selectedValue={paymentCategory}
                            onValueChange={(value: PaymentCategory) => setPaymentCategory(value)}
                            style={styles.picker}
                        >
                            {PAYMENT_CATEGORIES.map((cat) => (
                                <Picker.Item
                                    key={cat.value}
                                    label={cat.label}
                                    value={cat.value}
                                />
                            ))}
                        </Picker>
                    </View>
                </GlassCard>

                {/* Purpose */}
                <GlassCard style={styles.section}>
                    <Text style={styles.sectionTitle}>Purpose (One-line) *</Text>
                    <TextInput
                        style={styles.reasonInput}
                        value={reason}
                        onChangeText={setReason}
                        placeholder="E.g., Material purchase for Site A foundation work"
                        placeholderTextColor={COLORS.neutral[400]}
                    />
                </GlassCard>

                {/* Amount Input */}
                <GlassCard style={styles.section}>
                    <Text style={styles.sectionTitle}>Amount (₹)</Text>
                    <TextInput
                        style={styles.amountInput}
                        value={amount}
                        onChangeText={setAmount}
                        placeholder="Enter amount"
                        keyboardType="numeric"
                        placeholderTextColor={COLORS.neutral[400]}
                    />
                    {parseFloat(amount) > 50000 && (
                        <Text style={styles.warningText}>
                            ⚠️ Amounts over ₹50,000 require additional approval
                        </Text>
                    )}
                </GlassCard>

                {/* Reason Input */}
                <GlassCard style={styles.section}>
                    <Text style={styles.sectionTitle}>Reason *</Text>
                    <TextInput
                        style={styles.reasonInput}
                        value={reason}
                        onChangeText={setReason}
                        placeholder="Brief reason for this payment request"
                        placeholderTextColor={COLORS.neutral[400]}
                    />
                </GlassCard>

                {/* Description Input */}
                <GlassCard style={styles.section}>
                    <Text style={styles.sectionTitle}>Detailed Description</Text>
                    <TextInput
                        style={styles.descriptionInput}
                        value={description}
                        onChangeText={setDescription}
                        placeholder="Provide detailed description of expenses, purpose, and any additional context"
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                        placeholderTextColor={COLORS.neutral[400]}
                    />
                </GlassCard>

                {/* Urgency Level */}
                <GlassCard style={styles.section}>
                    <Text style={styles.sectionTitle}>Urgency Level</Text>
                    <View style={styles.urgencyContainer}>
                        {URGENCY_LEVELS.map((level) => (
                            <TouchableOpacity
                                key={level.value}
                                style={[
                                    styles.urgencyButton,
                                    urgency === level.value && styles.urgencyButtonActive,
                                ]}
                                onPress={() => setUrgency(level.value)}
                            >
                                <Text
                                    style={[
                                        styles.urgencyText,
                                        urgency === level.value && styles.urgencyTextActive,
                                    ]}
                                >
                                    {level.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </GlassCard>

                {/*Payee Details */}
                <GlassCard style={styles.section}>
                    <Text style={styles.sectionTitle}>Payee Details</Text>
                    
                    <Text style={styles.fieldLabel}>Recording Unit</Text>
                    <View style={styles.recordingContainer}>
                        <TouchableOpacity
                            style={[
                                styles.recordingButton,
                                recordingUnit === 'manual' && styles.recordingButtonActive,
                            ]}
                            onPress={() => setRecordingUnit('manual')}
                        >
                            <Text style={[
                                styles.recordingText,
                                recordingUnit === 'manual' && styles.recordingTextActive,
                            ]}>Manual</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.recordingButton,
                                recordingUnit === 'saved' && styles.recordingButtonActive,
                            ]}
                            onPress={() => setRecordingUnit('saved')}
                        >
                            <Text style={[
                                styles.recordingText,
                                recordingUnit === 'saved' && styles.recordingTextActive,
                            ]}>Saved</Text>
                        </TouchableOpacity>
                    </View>
                    
                    <Text style={styles.fieldLabel}>Payee Name *</Text>
                    <TextInput
                        style={styles.input}
                        value={payeeName}
                        onChangeText={setPayeeName}
                        placeholder="Company, individual, or contractor name"
                        placeholderTextColor={COLORS.neutral[400]}
                    />
                    
                    <Text style={styles.fieldLabel}>Payment Method *</Text>
                    <View style={styles.methodContainer}>
                        <Text style={styles.methodText}>🏦 Bank Transfer</Text>
                    </View>
                    
                    <Text style={styles.fieldLabel}>Account Number *</Text>
                    <TextInput
                        style={styles.input}
                        value={accountNumber}
                        onChangeText={setAccountNumber}
                        placeholder="Enter account number"
                        keyboardType="numeric"
                        placeholderTextColor={COLORS.neutral[400]}
                        secureTextEntry
                    />
                    
                    <Text style={styles.fieldLabel}>Confirm Account Number *</Text>
                    <TextInput
                        style={styles.input}
                        value={confirmAccount}
                        onChangeText={setConfirmAccount}
                        placeholder="Re-enter to confirm"
                        keyboardType="numeric"
                        placeholderTextColor={COLORS.neutral[400]}
                        secureTextEntry
                    />
                    
                    <Text style={styles.fieldLabel}>IFSC Code *</Text>
                    <TextInput
                        style={styles.input}
                        value={ifscCode}
                        onChangeText={setIfscCode}
                        placeholder="e.g., SBIN0001234"
                        placeholderTextColor={COLORS.neutral[400]}
                        autoCapitalize="characters"
                    />
                    
                    <Text style={styles.fieldLabel}>Beneficiary Name</Text>
                    <TextInput
                        style={styles.input}
                        value={beneficiaryName}
                        onChangeText={setBeneficiaryName}
                        placeholder="Bank record name"
                        placeholderTextColor={COLORS.neutral[400]}
                    />
                </GlassCard>

                {/* Attachments */}
                <GlassCard style={styles.section}>
                    <Text style={styles.sectionTitle}>Proof Folder / Bill *</Text>
                    <Text style={styles.fieldHint}>Click to upload Bill Proofs</Text>
                    <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
                        <Upload size={24} color={COLORS.primary[600]} />
                        <Text style={styles.uploadButtonText}>Click to upload Bills</Text>
                    </TouchableOpacity>
                    
                    {attachments.length > 0 && (
                        <FlatList
                            data={attachments}
                            keyExtractor={(item) => item.id}
                            renderItem={renderAttachment}
                            style={styles.attachmentsList}
                            scrollEnabled={false}
                        />
                    )}
                </GlassCard>
                
                {/* Bank Proof */}
                <GlassCard style={styles.section}>
                    <Text style={styles.sectionTitle}>Bank Proof *</Text>
                    <Text style={styles.fieldHint}>Click to upload Bank Proofs</Text>
                    <TouchableOpacity style={styles.uploadButton} onPress={pickBankProof}>
                        <Upload size={24} color={COLORS.primary[600]} />
                        <Text style={styles.uploadButtonText}>Click to upload Bank Proofs</Text>
                    </TouchableOpacity>
                    
                    {bankProofs.length > 0 && (
                        <FlatList
                            data={bankProofs}
                            keyExtractor={(item) => item.id}
                            renderItem={renderAttachment}
                            style={styles.attachmentsList}
                            scrollEnabled={false}
                        />
                    )}
                </GlassCard>

                {/* Action Buttons */}
                <View style={styles.buttonContainer}>
                    <Button
                        title={savingDraft ? "Saving Draft..." : "Save as Draft"}
                        onPress={saveAsDraft}
                        disabled={savingDraft || submitting}
                        loading={savingDraft}
                        style={[styles.button, styles.draftButton]}
                        variant="outline"
                    />

                    <Button
                        title={submitting ? "Submitting..." : "Submit Request"}
                        onPress={handleSubmit}
                        disabled={submitting || savingDraft}
                        loading={submitting}
                        style={[styles.button, styles.submitButton]}
                    />
                </View>

                {/* Info Section */}
                <GlassCard style={styles.infoSection}>
                    <Text style={styles.infoTitle}>Payment Request Guidelines</Text>
                    <View style={styles.infoItem}>
                        <CheckCircle2 size={16} color={COLORS.success[600]} />
                        <Text style={styles.infoText}>
                            General payments include Engineering projects and Operational expenses
                        </Text>
                    </View>
                    <View style={styles.infoItem}>
                        <AlertTriangle size={16} color={COLORS.warning[600]} />
                        <Text style={styles.infoText}>
                            All payment types require manager approval before processing
                        </Text>
                    </View>
                    <View style={styles.infoItem}>
                        <Calendar size={16} color={COLORS.primary[600]} />
                        <Text style={styles.infoText}>
                            Processing time: 3-7 business days for approved requests
                        </Text>
                    </View>
                    <View style={styles.infoItem}>
                        <FileText size={16} color={COLORS.primary[600]} />
                        <Text style={styles.infoText}>
                            Keep all receipts and supporting documents for your records
                        </Text>
                    </View>
                </GlassCard>
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
        alignItems: 'center',
        justifyContent: 'center',
    },
    loaderText: {
        ...TYPOGRAPHY.body,
        color: COLORS.neutral[600],
        marginTop: SPACING.md,
    },
    header: {
        alignItems: 'center',
        marginBottom: SPACING.xl,
        paddingVertical: SPACING.lg,
    },
    title: {
        ...TYPOGRAPHY.h2,
        color: COLORS.neutral[900],
        fontWeight: '700',
        marginTop: SPACING.sm,
    },
    subtitle: {
        ...TYPOGRAPHY.body,
        color: COLORS.neutral[600],
        textAlign: 'center',
        marginTop: SPACING.xs,
    },
    section: {
        marginBottom: SPACING.lg,
        padding: SPACING.md,
    },
    sectionTitle: {
        ...TYPOGRAPHY.h4,
        color: COLORS.neutral[900],
        fontWeight: '600',
        marginBottom: SPACING.sm,
    },
    pickerContainer: {
        borderWidth: 1,
        borderColor: COLORS.neutral[300],
        borderRadius: BORDER_RADIUS.md,
        backgroundColor: COLORS.neutral[50],
        marginBottom: SPACING.sm,
    },
    picker: {
        height: 50,
        color: COLORS.neutral[900],
    },
    typeInfo: {
        gap: SPACING.sm,
    },
    typeDescription: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[600],
        fontStyle: 'italic',
    },
    approvalRequired: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
    },
    approvalText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.warning[600],
        fontWeight: '500',
    },
    amountInput: {
        borderWidth: 1,
        borderColor: COLORS.neutral[300],
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        fontSize: 16,
        color: COLORS.neutral[900],
        backgroundColor: COLORS.neutral[50],
    },
    warningText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.warning[600],
        marginTop: SPACING.xs,
        fontWeight: '500',
    },
    reasonInput: {
        borderWidth: 1,
        borderColor: COLORS.neutral[300],
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        fontSize: 16,
        color: COLORS.neutral[900],
        backgroundColor: COLORS.neutral[50],
    },
    descriptionInput: {
        borderWidth: 1,
        borderColor: COLORS.neutral[300],
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        fontSize: 16,
        color: COLORS.neutral[900],
        backgroundColor: COLORS.neutral[50],
        minHeight: 100,
    },
    attachmentsDescription: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[600],
        marginBottom: SPACING.md,
    },
    attachmentButtons: {
        flexDirection: 'row',
        gap: SPACING.md,
        marginBottom: SPACING.md,
    },
    attachButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.primary[300],
        borderRadius: BORDER_RADIUS.md,
        backgroundColor: COLORS.primary[50],
        gap: SPACING.sm,
    },
    attachButtonText: {
        ...TYPOGRAPHY.bodyBold,
        color: COLORS.primary[700],
    },
    attachmentsList: {
        marginTop: SPACING.sm,
    },
    attachmentItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.neutral[50],
        padding: SPACING.sm,
        borderRadius: BORDER_RADIUS.md,
        marginBottom: SPACING.sm,
    },
    attachmentInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: SPACING.sm,
    },
    attachmentDetails: {
        flex: 1,
    },
    attachmentName: {
        ...TYPOGRAPHY.body,
        color: COLORS.neutral[800],
    },
    attachmentSize: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[500],
    },
    removeAttachment: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: COLORS.error[50],
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonContainer: {
        gap: SPACING.md,
        marginBottom: SPACING.xl,
    },
    button: {
        marginTop: SPACING.md,
    },
    draftButton: {
        backgroundColor: COLORS.neutral[100],
        borderColor: COLORS.neutral[300],
    },
    submitButton: {
        backgroundColor: COLORS.primary[600],
    },
    infoSection: {
        padding: SPACING.md,
        marginBottom: SPACING.xl,
    },
    infoTitle: {
        ...TYPOGRAPHY.h4,
        color: COLORS.neutral[900],
        fontWeight: '600',
        marginBottom: SPACING.md,
    },
    infoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.sm,
        gap: SPACING.sm,
    },
    infoText: {
        ...TYPOGRAPHY.body,
        color: COLORS.neutral[700],
        flex: 1,
    },
    fieldHint: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[500],
        marginBottom: SPACING.sm,
    },
    fieldLabel: {
        ...TYPOGRAPHY.captionBold,
        color: COLORS.neutral[700],
        marginBottom: SPACING.xs,
        marginTop: SPACING.sm,
    },
    input: {
        borderWidth: 1,
        borderColor: COLORS.neutral[300],
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        fontSize: 16,
        color: COLORS.neutral[900],
        backgroundColor: '#fff',
    },
    urgencyContainer: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    urgencyButton: {
        flex: 1,
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.neutral[300],
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    urgencyButtonActive: {
        borderColor: COLORS.primary[600],
        backgroundColor: COLORS.primary[50],
    },
    urgencyText: {
        ...TYPOGRAPHY.bodyBold,
        color: COLORS.neutral[600],
    },
    urgencyTextActive: {
        color: COLORS.primary[700],
    },
    recordingContainer: {
        flexDirection: 'row',
        gap: SPACING.sm,
        marginBottom: SPACING.md,
    },
    recordingButton: {
        flex: 1,
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.neutral[300],
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    recordingButtonActive: {
        borderColor: COLORS.primary[600],
        backgroundColor: COLORS.primary[50],
    },
    recordingText: {
        ...TYPOGRAPHY.bodyBold,
        color: COLORS.neutral[600],
    },
    recordingTextActive: {
        color: COLORS.primary[700],
    },
    methodContainer: {
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.primary[300],
        backgroundColor: COLORS.primary[50],
        marginBottom: SPACING.md,
    },
    methodText: {
        ...TYPOGRAPHY.bodyBold,
        color: COLORS.primary[700],
    },
    uploadButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.xl,
        borderWidth: 2,
        borderColor: COLORS.primary[300],
        borderRadius: BORDER_RADIUS.md,
        borderStyle: 'dashed',
        backgroundColor: COLORS.primary[50],
        gap: SPACING.sm,
    },
    uploadButtonText: {
        ...TYPOGRAPHY.bodyBold,
        color: COLORS.primary[700],
    },
});