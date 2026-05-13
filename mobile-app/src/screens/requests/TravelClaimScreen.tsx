import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    Image,
    ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Picker } from '@react-native-picker/picker';
import { supabase } from '../../services/supabase';
import { AppScreen, GlassCard, Button } from '../../components/ui';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../theme';

const BG_GRADIENT: readonly [string, string, string] = ['#e0e7ff', '#f0f9ff', '#f8fafc'] as const;

type ClaimType = 'Travel' | 'Food' | 'Fuel' | 'Other';

export default function TravelClaimScreen() {
    const [claimType, setClaimType] = useState<ClaimType>('Travel');
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');
    const [proofUrl, setProofUrl] = useState('');
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const pickProof = async () => {
        try {
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (permission.status !== 'granted') {
                Alert.alert('Permission required', 'Please allow media access to upload proof.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.8,
            });

            if (result.canceled || !result.assets?.length) return;

            const userResult = await supabase.auth.getUser();
            const user = userResult?.data?.user;
            if (!user) throw new Error('No user');

            setUploading(true);
            const uri = result.assets[0].uri;
            const response = await fetch(uri);
            const blob = await response.blob();
            const ext = uri.split('.').pop() || 'jpg';
            const filePath = `payment-proofs/${user.id}-${Date.now()}.${ext}`;

            const upload = await supabase.storage.from('payment-proofs').upload(filePath, blob, {
                upsert: false,
                contentType: blob.type || 'image/jpeg',
            });

            if (upload.error) throw upload.error;

            const publicUrl = supabase.storage.from('payment-proofs').getPublicUrl(filePath).data.publicUrl;
            setProofUrl(publicUrl);
            Alert.alert('Uploaded', 'Proof uploaded successfully.');
        } catch (error: any) {
            Alert.alert('Upload failed', error?.message || 'Failed to upload proof.');
        } finally {
            setUploading(false);
        }
    };

    const submitRequest = async () => {
        if (amount.trim() === '' || Number(amount) <= 0) {
            Alert.alert('Required', 'Please enter a valid amount.');
            return;
        }
        if (reason.trim() === '') {
            Alert.alert('Required', 'Please enter request reason.');
            return;
        }

        setSubmitting(true);
        try {
            const userResult = await supabase.auth.getUser();
            const user = userResult?.data?.user;
            if (!user) throw new Error('No user');

            const payload: any = {
                employee_id: user.id,
                claim_type: claimType,
                amount: Number(amount),
                reason: reason.trim(),
                proof_url: proofUrl || null,
                status: 'Pending',
                submitted_at: new Date().toISOString(),
            };

            let { error } = await supabase.from('payment_requests').insert(payload);

            if (error?.code === '42P01') {
                // Fallback for existing travel claim table naming
                const fallback = await supabase.from('travel_claims').insert(payload);
                error = fallback.error;
            }

            if (error?.code === '42703') {
                const fallbackPayload = { ...payload };
                delete fallbackPayload.proof_url;
                const fallback = await supabase.from('payment_requests').insert(fallbackPayload);
                error = fallback.error;
            }

            if (error) throw error;

            setAmount('');
            setReason('');
            setProofUrl('');
            Alert.alert('Success', 'Payment request submitted.');
        } catch (error: any) {
            Alert.alert('Error', error?.message || 'Failed to submit payment request.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AppScreen title="Payment Request" subtitle="Submit reimbursement and payment claims">
            <LinearGradient colors={BG_GRADIENT} style={styles.background} />

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <GlassCard style={styles.card}>
                    <Text style={styles.label}>Request Type</Text>
                    <View style={styles.pickerWrap}>
                        <Picker selectedValue={claimType} onValueChange={(v) => setClaimType(v)}>
                            <Picker.Item label="Travel" value="Travel" />
                            <Picker.Item label="Food" value="Food" />
                            <Picker.Item label="Fuel" value="Fuel" />
                            <Picker.Item label="Other" value="Other" />
                        </Picker>
                    </View>

                    <Text style={[styles.label, styles.topGap]}>Amount</Text>
                    <TextInput
                        style={styles.input}
                        value={amount}
                        onChangeText={setAmount}
                        keyboardType="numeric"
                        placeholder="Enter amount"
                        placeholderTextColor={COLORS.neutral[400]}
                    />

                    <Text style={[styles.label, styles.topGap]}>Reason</Text>
                    <TextInput
                        style={styles.textArea}
                        value={reason}
                        onChangeText={setReason}
                        placeholder="Explain your request"
                        placeholderTextColor={COLORS.neutral[400]}
                        multiline
                        textAlignVertical="top"
                    />

                    <Text style={[styles.label, styles.topGap]}>Proof</Text>
                    {proofUrl ? (
                        <View>
                            <Image source={{ uri: proofUrl }} style={styles.preview} resizeMode="cover" />
                            <TouchableOpacity style={styles.secondaryBtn} onPress={pickProof} disabled={uploading}>
                                <Text style={styles.secondaryBtnText}>{uploading ? 'Uploading...' : 'Change Proof'}</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity style={styles.secondaryBtn} onPress={pickProof} disabled={uploading}>
                            <Text style={styles.secondaryBtnText}>{uploading ? 'Uploading...' : 'Upload Proof'}</Text>
                        </TouchableOpacity>
                    )}
                </GlassCard>

                <Button title="Submit Payment Request" onPress={submitRequest} loading={submitting} disabled={submitting} />
                <View style={{ height: 40 }} />
            </ScrollView>
        </AppScreen>
    );
}

const styles = StyleSheet.create({
    background: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
    },
    content: {
        paddingTop: SPACING.lg,
        paddingBottom: 80,
        gap: SPACING.md,
    },
    card: {
        ...SHADOWS.sm,
    },
    label: {
        ...TYPOGRAPHY.captionBold,
        color: COLORS.neutral[700],
        marginBottom: SPACING.xs,
    },
    topGap: {
        marginTop: SPACING.md,
    },
    pickerWrap: {
        backgroundColor: COLORS.neutral[50],
        borderWidth: 1,
        borderColor: COLORS.neutral[200],
        borderRadius: BORDER_RADIUS.md,
        overflow: 'hidden',
    },
    input: {
        backgroundColor: COLORS.neutral[50],
        borderWidth: 1,
        borderColor: COLORS.neutral[200],
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        color: COLORS.neutral[800],
    },
    textArea: {
        backgroundColor: COLORS.neutral[50],
        borderWidth: 1,
        borderColor: COLORS.neutral[200],
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        minHeight: 100,
        color: COLORS.neutral[800],
    },
    secondaryBtn: {
        marginTop: SPACING.sm,
        backgroundColor: COLORS.primary[50],
        borderWidth: 1,
        borderColor: COLORS.primary[200],
        borderRadius: BORDER_RADIUS.md,
        paddingVertical: SPACING.md,
        alignItems: 'center',
    },
    secondaryBtnText: {
        ...TYPOGRAPHY.captionBold,
        color: COLORS.primary[700],
    },
    preview: {
        width: '100%',
        height: 160,
        borderRadius: BORDER_RADIUS.md,
        backgroundColor: COLORS.neutral[100],
    },
});
