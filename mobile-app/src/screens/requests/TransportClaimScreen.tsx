import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Plus, MapPin, DollarSign, Clock, FileText, CheckCircle, XCircle } from 'lucide-react-native';
import { format, parseISO } from 'date-fns';
import { COLORS, SPACING, BORDER_RADIUS } from '../../theme';
import { transportService } from '../../services/commService';
import * as ImagePicker from 'expo-image-picker';

interface TransportClaimScreenProps {
  navigation: any;
}

interface Claim {
  id: string;
  claim_date: string;
  claim_type: string;
  amount: number;
  description: string;
  from_location?: string;
  to_location?: string;
  distance_km?: number;
  receipt_url?: string;
  status: string;
  created_at: string;
}

const CLAIM_TYPES = [
  { value: 'travel', label: 'Travel', icon: '🚗' },
  { value: 'local', label: 'Local', icon: '🚕' },
  { value: 'fuel', label: 'Fuel', icon: '⛽' },
  { value: 'parking', label: 'Parking', icon: '🅿️' },
  { value: 'toll', label: 'Toll', icon: '💳' },
  { value: 'other', label: 'Other', icon: '📋' },
];

export default function TransportClaimScreen({ navigation }: TransportClaimScreenProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    claim_type: 'travel',
    amount: '',
    description: '',
    from_location: '',
    to_location: '',
    distance_km: '',
    receipt_url: '',
  });

  useEffect(() => {
    loadClaims();
  }, []);

  const loadClaims = async () => {
    const data = await transportService.getClaims();
    setClaims(data);
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadClaims();
    setRefreshing(false);
  };

  const handlePickReceipt = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setForm(prev => ({ ...prev, receipt_url: result.assets[0].uri }));
    }
  };

  const handleSubmit = async () => {
    if (!form.amount || parseFloat(form.amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    setSubmitting(true);
    const { error } = await transportService.submitClaim({
      claim_type: form.claim_type,
      amount: parseFloat(form.amount),
      description: form.description,
      from_location: form.from_location,
      to_location: form.to_location,
      distance_km: form.distance_km ? parseFloat(form.distance_km) : undefined,
      receipt_url: form.receipt_url,
    });

    if (error) {
      Alert.alert('Error', 'Failed to submit claim. Please try again.');
    } else {
      Alert.alert('Success', 'Claim submitted successfully!');
      setShowForm(false);
      setForm({
        claim_type: 'travel',
        amount: '',
        description: '',
        from_location: '',
        to_location: '',
        distance_km: '',
        receipt_url: '',
      });
      loadClaims();
    }
    setSubmitting(false);
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'approved': return '#16a34a';
      case 'rejected': return '#dc2626';
      case 'paid': return '#2563eb';
      default: return '#f59e0b';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle size={16} color="#16a34a" />;
      case 'rejected': return <XCircle size={16} color="#dc2626" />;
      case 'paid': return <CheckCircle size={16} color="#2563eb" />;
      default: return <Clock size={16} color="#f59e0b" />;
    }
  };

  const totalPending = claims.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.amount, 0);
  const totalApproved = claims.filter(c => c.status === 'approved').reduce((sum, c) => sum + c.amount, 0);
  const totalPaid = claims.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.amount, 0);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary[600]} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={24} color={COLORS.neutral[800]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Transport Claims</Text>
        <TouchableOpacity 
          onPress={() => setShowForm(true)}
          style={styles.addButton}
        >
          <Plus size={24} color={COLORS.primary[600]} />
        </TouchableOpacity>
      </View>

      {!showForm ? (
        <>
          <View style={styles.summaryContainer}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Pending</Text>
              <Text style={[styles.summaryAmount, { color: '#f59e0b' }]}>
                ₹{totalPending.toFixed(2)}
              </Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Approved</Text>
              <Text style={[styles.summaryAmount, { color: '#16a34a' }]}>
                ₹{totalApproved.toFixed(2)}
              </Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Paid</Text>
              <Text style={[styles.summaryAmount, { color: '#2563eb' }]}>
                ₹{totalPaid.toFixed(2)}
              </Text>
            </View>
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {claims.length === 0 ? (
              <View style={styles.emptyContainer}>
                <FileText size={64} color={COLORS.neutral[300]} />
                <Text style={styles.emptyText}>No claims yet</Text>
                <Text style={styles.emptySubtext}>Tap + to submit a new claim</Text>
              </View>
            ) : (
              <View style={styles.list}>
                {claims.map((claim) => (
                  <View key={claim.id} style={styles.claimCard}>
                    <View style={styles.claimHeader}>
                      <View style={styles.claimType}>
                        <Text style={styles.claimTypeText}>
                          {CLAIM_TYPES.find(t => t.value === claim.claim_type)?.icon}
                        </Text>
                        <Text style={styles.claimTypeLabel}>
                          {CLAIM_TYPES.find(t => t.value === claim.claim_type)?.label}
                        </Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(claim.status)}20` }]}>
                        {getStatusIcon(claim.status)}
                        <Text style={[styles.statusText, { color: getStatusColor(claim.status) }]}>
                          {claim.status.charAt(0).toUpperCase() + claim.status.slice(1)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.claimAmount}>₹{claim.amount.toFixed(2)}</Text>
                    {claim.description && (
                      <Text style={styles.claimDescription}>{claim.description}</Text>
                    )}
                    <View style={styles.claimFooter}>
                      <Text style={styles.claimDate}>
                        {format(parseISO(claim.claim_date), 'MMM d, yyyy')}
                      </Text>
                      {claim.distance_km && (
                        <Text style={styles.claimDistance}>{claim.distance_km} km</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </>
      ) : (
        <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.form}>
            <Text style={styles.formTitle}>New Transport Claim</Text>

            <Text style={styles.inputLabel}>Claim Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeSelector}>
              {CLAIM_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.typeOption,
                    form.claim_type === type.value && styles.typeOptionSelected,
                  ]}
                  onPress={() => setForm(prev => ({ ...prev, claim_type: type.value }))}
                >
                  <Text style={styles.typeIcon}>{type.icon}</Text>
                  <Text style={[
                    styles.typeLabel,
                    form.claim_type === type.value && styles.typeLabelSelected,
                  ]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Amount (₹)</Text>
              <TextInput
                style={styles.input}
                value={form.amount}
                onChangeText={(v) => setForm(prev => ({ ...prev, amount: v }))}
                placeholder="0.00"
                placeholderTextColor={COLORS.neutral[400]}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.flex1]}>
                <Text style={styles.inputLabel}>From</Text>
                <TextInput
                  style={styles.input}
                  value={form.from_location}
                  onChangeText={(v) => setForm(prev => ({ ...prev, from_location: v }))}
                  placeholder="Pickup location"
                  placeholderTextColor={COLORS.neutral[400]}
                />
              </View>
              <View style={[styles.inputGroup, styles.flex1]}>
                <Text style={styles.inputLabel}>To</Text>
                <TextInput
                  style={styles.input}
                  value={form.to_location}
                  onChangeText={(v) => setForm(prev => ({ ...prev, to_location: v }))}
                  placeholder="Drop location"
                  placeholderTextColor={COLORS.neutral[400]}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Distance (km)</Text>
              <TextInput
                style={styles.input}
                value={form.distance_km}
                onChangeText={(v) => setForm(prev => ({ ...prev, distance_km: v }))}
                placeholder="0.0"
                placeholderTextColor={COLORS.neutral[400]}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={form.description}
                onChangeText={(v) => setForm(prev => ({ ...prev, description: v }))}
                placeholder="Describe the purpose..."
                placeholderTextColor={COLORS.neutral[400]}
                multiline
                numberOfLines={3}
              />
            </View>

            <TouchableOpacity style={styles.receiptButton} onPress={handlePickReceipt}>
              <FileText size={20} color={COLORS.primary[600]} />
              <Text style={styles.receiptText}>
                {form.receipt_url ? 'Receipt Attached' : 'Attach Receipt'}
              </Text>
            </TouchableOpacity>

            <View style={styles.formButtons}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowForm(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit Claim</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral[200],
    backgroundColor: '#fff',
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.neutral[800],
  },
  addButton: {
    padding: SPACING.xs,
  },
  summaryContainer: {
    flexDirection: 'row',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.neutral[500],
    marginBottom: 4,
  },
  summaryAmount: {
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  list: {
    padding: SPACING.md,
    paddingTop: 0,
  },
  claimCard: {
    backgroundColor: '#fff',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.neutral[200],
  },
  claimHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  claimType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  claimTypeText: {
    fontSize: 16,
  },
  claimTypeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.neutral[700],
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  claimAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.neutral[800],
    marginBottom: SPACING.xs,
  },
  claimDescription: {
    fontSize: 14,
    color: COLORS.neutral[600],
    marginBottom: SPACING.sm,
  },
  claimFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  claimDate: {
    fontSize: 12,
    color: COLORS.neutral[500],
  },
  claimDistance: {
    fontSize: 12,
    color: COLORS.neutral[500],
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxl * 2,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.neutral[600],
    marginTop: SPACING.md,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.neutral[500],
    marginTop: SPACING.xs,
  },
  formContainer: {
    flex: 1,
  },
  form: {
    padding: SPACING.md,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.neutral[800],
    marginBottom: SPACING.lg,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.neutral[600],
    marginBottom: SPACING.xs,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.neutral[300],
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 16,
    color: COLORS.neutral[800],
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  flex1: {
    flex: 1,
  },
  typeSelector: {
    marginBottom: SPACING.md,
  },
  typeOption: {
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.neutral[300],
    marginRight: SPACING.sm,
  },
  typeOptionSelected: {
    borderColor: COLORS.primary[600],
    backgroundColor: COLORS.primary[50],
  },
  typeIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.neutral[600],
  },
  typeLabelSelected: {
    color: COLORS.primary[600],
  },
  receiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary[600],
    borderStyle: 'dashed',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  receiptText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.primary[600],
  },
  formButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.neutral[300],
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.neutral[600],
  },
  submitButton: {
    flex: 1,
    backgroundColor: COLORS.primary[600],
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});