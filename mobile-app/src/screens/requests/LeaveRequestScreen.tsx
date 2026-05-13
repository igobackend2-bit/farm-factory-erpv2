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
    Platform,
    Modal,
    Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Picker } from '@react-native-picker/picker'; // Ensure this is installed
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../../services/supabase';
import { GlassCard, Button } from '../../components/ui';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../theme';
import { ChevronLeft, Calendar, Clock, FileText, Check } from 'lucide-react-native';
import { format } from 'date-fns';

// Create a safe gradient tuple
const BG_GRADIENT: [string, string, ...string[]] = ['#e0e7ff', '#f0f9ff', '#f8fafc'];
const HEADER_GRADIENT: [string, string, ...string[]] = ['#3b82f6', '#1d4ed8'];

type DurationCategory = 'Full Day' | 'Half Day' | 'Permission';
type ShiftType = 'Session 1' | 'Session 2';

interface LeaveType {
    id: string;
    name: string;
}

export default function LeaveRequestScreen({ navigation }: any) {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);

    // Form State
    const [selectedLeaveType, setSelectedLeaveType] = useState<string>('');
    const [durationCategory, setDurationCategory] = useState<DurationCategory>('Full Day');
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date());
    const [shift, setShift] = useState<ShiftType>('Session 1');
    const [startTime, setStartTime] = useState(new Date());
    const [endTime, setEndTime] = useState(new Date());
    const [reason, setReason] = useState('');
    const [proofUrl, setProofUrl] = useState('');
    const [uploadingProof, setUploadingProof] = useState(false);

    // Picker Visibility State (Android mostly, or custom modal logic)
    const [showStartDate, setShowStartDate] = useState(false);
    const [showEndDate, setShowEndDate] = useState(false);
    const [showStartTime, setShowStartTime] = useState(false);
    const [showEndTime, setShowEndTime] = useState(false);

    useEffect(() => {
        fetchLeaveTypes();
    }, []);

    const fetchLeaveTypes = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('leave_types')
                .select('id, name')
                .eq('is_active', true)
                .order('name');

            const hasError = error !== null && error !== undefined;
            if (hasError === true) throw error;

            const hasData = data !== null && data !== undefined;
            if (hasData === true) {
                setLeaveTypes(data);
                if (data.length > 0) {
                    setSelectedLeaveType(data[0].id);
                }
            }
        } catch (error) {
            console.error('Error fetching leave types:', error);
            Alert.alert('Error', 'Failed to load leave types.');
        } finally {
            setLoading(false);
        }
    };

    const handleDateChange = (event: any, selectedDate?: Date, type?: 'start' | 'end') => {
        const currentDate = selectedDate || (type === 'start' ? startDate : endDate);

        if (Platform.OS === 'android') {
            setShowStartDate(false);
            setShowEndDate(false);
        }

        if (type === 'start') {
            setStartDate(currentDate);
            // Auto-update end date if it's before start date
            if (endDate < currentDate) {
                setEndDate(currentDate);
            }
        } else {
            setEndDate(currentDate);
        }
    };

    const handleTimeChange = (event: any, selectedDate?: Date, type?: 'start' | 'end') => {
        const currentDate = selectedDate || (type === 'start' ? startTime : endTime);

        if (Platform.OS === 'android') {
            setShowStartTime(false);
            setShowEndTime(false);
        }

        if (type === 'start') {
            setStartTime(currentDate);
        } else {
            setEndTime(currentDate);
        }
    };


    const handleSubmit = async () => {
        if (!selectedLeaveType) {
            Alert.alert('Required', 'Please select a leave type.');
            return;
        }
        if (!reason.trim()) {
            Alert.alert('Required', 'Please enter a reason for the leave.');
            return;
        }

        setSubmitting(true);
        try {
            const userResult = await supabase.auth.getUser();
            const user = userResult?.data?.user;
            const userExists = user !== null && user !== undefined;
            if (userExists === false) throw new Error('Not logged in');

            const payload: any = {
                employee_id: user.id,
                leave_type_id: selectedLeaveType,
                reason: reason.trim(),
                duration_category: durationCategory,
                status: 'Pending',
                start_date: format(startDate, 'yyyy-MM-dd'),
                proof_url: proofUrl !== '' ? proofUrl : null,
            };

            if (durationCategory === 'Full Day') {
                payload.end_date = format(endDate, 'yyyy-MM-dd');
            } else if (durationCategory === 'Half Day') {
                payload.end_date = format(startDate, 'yyyy-MM-dd'); // Same day
                payload.shift = shift;
            } else if (durationCategory === 'Permission') {
                payload.end_date = format(startDate, 'yyyy-MM-dd');
                payload.start_time = format(startTime, 'HH:mm:ss');
                payload.end_time = format(endTime, 'HH:mm:ss');
            }

            let { error } = await supabase
                .from('leave_requests')
                .insert(payload);

            if (error?.code === '42703') {
                const fallbackPayload = { ...payload };
                delete fallbackPayload.proof_url;
                const fallback = await supabase.from('leave_requests').insert(fallbackPayload);
                error = fallback.error;
            }

            const hasError = error !== null && error !== undefined;
            if (hasError === true) throw error;

            Alert.alert('Success', 'Leave request submitted successfully!', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);

        } catch (error: any) {
            console.error('Submit error:', error);
            const errorMessage = error?.message || 'Failed to submit request';
            Alert.alert('Error', errorMessage);
        } finally {
            setSubmitting(false);
        }
    };

    const pickAndUploadProof = async () => {
        try {
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (permission.status !== 'granted') {
                Alert.alert('Permission required', 'Please allow media access to upload leave proof.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.8,
            });

            if (result.canceled || !result.assets?.length) return;

            const uri = result.assets[0].uri;
            setUploadingProof(true);

            const userResult = await supabase.auth.getUser();
            const user = userResult?.data?.user;
            if (!user) throw new Error('No user');

            const response = await fetch(uri);
            const blob = await response.blob();
            const ext = uri.split('.').pop() || 'jpg';
            const fileName = `${user.id}-${Date.now()}.${ext}`;
            const filePath = `leave-proofs/${fileName}`;

            const upload = await supabase.storage.from('leave-proofs').upload(filePath, blob, {
                upsert: false,
                contentType: blob.type || 'image/jpeg',
            });

            if (upload.error) throw upload.error;

            const publicUrl = supabase.storage.from('leave-proofs').getPublicUrl(filePath).data.publicUrl;
            setProofUrl(publicUrl);
            Alert.alert('Uploaded', 'Proof uploaded successfully.');
        } catch (error: any) {
            Alert.alert('Upload failed', error?.message || 'Failed to upload proof.');
        } finally {
            setUploadingProof(false);
        }
    };

    if (loading === true) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary[500]} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <LinearGradient colors={BG_GRADIENT} style={styles.background} />

            {/* Header */}
            <View style={styles.header}>
                <LinearGradient colors={HEADER_GRADIENT} style={styles.headerGradient}>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <ChevronLeft size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Leave Request</Text>
                    <View style={{ width: 40 }} />
                </LinearGradient>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                {/* Leave Type */}
                <GlassCard style={styles.card}>
                    <Text style={styles.label}>Leave Type</Text>
                    <View style={styles.pickerContainer}>
                        <Picker
                            selectedValue={selectedLeaveType}
                            onValueChange={(itemValue) => setSelectedLeaveType(itemValue)}
                            style={Platform.OS === 'android' ? styles.pickerAndroid : undefined}
                            itemStyle={Platform.OS === 'ios' ? styles.pickerIOS : undefined}
                        >
                            {leaveTypes.map((type) => (
                                <Picker.Item key={type.id} label={type.name} value={type.id} color="#000" />
                            ))}
                        </Picker>
                    </View>
                </GlassCard>

                {/* Duration Category */}
                <GlassCard style={styles.card}>
                    <Text style={styles.label}>Duration</Text>
                    <View style={styles.toggleContainer}>
                        {(['Full Day', 'Half Day', 'Permission'] as DurationCategory[]).map((cat) => (
                            <TouchableOpacity
                                key={cat}
                                style={[
                                    styles.toggleButton,
                                    durationCategory === cat ? styles.toggleButtonActive : null
                                ]}
                                onPress={() => setDurationCategory(cat)}
                            >
                                <Text style={[
                                    styles.toggleText,
                                    durationCategory === cat ? styles.toggleTextActive : null
                                ]}>{cat}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </GlassCard>

                {/* Dates & Times */}
                <GlassCard style={styles.card}>
                    <Text style={styles.label}>
                        {durationCategory === 'Full Day' ? 'Date Range' : 'Date'}
                    </Text>

                    <View style={styles.row}>
                        <View style={styles.dateInputWrapper}>
                            <Text style={styles.subLabel}>From</Text>
                            <TouchableOpacity style={styles.dateButton} onPress={() => setShowStartDate(true)}>
                                <Calendar size={18} color={COLORS.primary[500]} />
                                <Text style={styles.dateText}>{format(startDate, 'dd MMM yyyy')}</Text>
                            </TouchableOpacity>
                            {(showStartDate || Platform.OS === 'ios') && (
                                <DateTimePicker
                                    value={startDate}
                                    mode="date"
                                    display={Platform.OS === 'ios' ? 'compact' : 'default'}
                                    onChange={(e, date) => handleDateChange(e, date, 'start')}
                                    style={Platform.OS === 'ios' ? styles.datePickerIOS : undefined}
                                />
                            )}
                        </View>

                        {durationCategory === 'Full Day' && (
                            <View style={styles.dateInputWrapper}>
                                <Text style={styles.subLabel}>To</Text>
                                <TouchableOpacity style={styles.dateButton} onPress={() => setShowEndDate(true)}>
                                    <Calendar size={18} color={COLORS.primary[500]} />
                                    <Text style={styles.dateText}>{format(endDate, 'dd MMM yyyy')}</Text>
                                </TouchableOpacity>
                                {(showEndDate || Platform.OS === 'ios') && (
                                    <DateTimePicker
                                        value={endDate}
                                        mode="date"
                                        display={Platform.OS === 'ios' ? 'compact' : 'default'}
                                        onChange={(e, date) => handleDateChange(e, date, 'end')}
                                        minimumDate={startDate}
                                        style={Platform.OS === 'ios' ? styles.datePickerIOS : undefined}
                                    />
                                )}
                            </View>
                        )}
                    </View>

                    {/* Half Day Shift Selection */}
                    {durationCategory === 'Half Day' && (
                        <View style={styles.section}>
                            <Text style={styles.label}>Session</Text>
                            <View style={styles.toggleContainer}>
                                <TouchableOpacity
                                    style={[styles.toggleButton, shift === 'Session 1' ? styles.toggleButtonActive : null]}
                                    onPress={() => setShift('Session 1')}
                                >
                                    <Text style={[styles.toggleText, shift === 'Session 1' ? styles.toggleTextActive : null]}>Session 1 (AM)</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.toggleButton, shift === 'Session 2' ? styles.toggleButtonActive : null]}
                                    onPress={() => setShift('Session 2')}
                                >
                                    <Text style={[styles.toggleText, shift === 'Session 2' ? styles.toggleTextActive : null]}>Session 2 (PM)</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* Permission Times */}
                    {durationCategory === 'Permission' && (
                        <View style={styles.section}>
                            <Text style={styles.label}>Time Duration</Text>
                            <View style={styles.row}>
                                <View style={styles.dateInputWrapper}>
                                    <Text style={styles.subLabel}>Start Time</Text>
                                    <TouchableOpacity style={styles.dateButton} onPress={() => setShowStartTime(true)}>
                                        <Clock size={18} color={COLORS.primary[500]} />
                                        <Text style={styles.dateText}>{format(startTime, 'hh:mm a')}</Text>
                                    </TouchableOpacity>
                                    {(showStartTime || Platform.OS === 'ios') && (
                                        <DateTimePicker
                                            value={startTime}
                                            mode="time"
                                            display={Platform.OS === 'ios' ? 'compact' : 'default'}
                                            onChange={(e, date) => handleTimeChange(e, date, 'start')}
                                            style={Platform.OS === 'ios' ? styles.datePickerIOS : undefined}
                                        />
                                    )}
                                </View>

                                <View style={styles.dateInputWrapper}>
                                    <Text style={styles.subLabel}>End Time</Text>
                                    <TouchableOpacity style={styles.dateButton} onPress={() => setShowEndTime(true)}>
                                        <Clock size={18} color={COLORS.primary[500]} />
                                        <Text style={styles.dateText}>{format(endTime, 'hh:mm a')}</Text>
                                    </TouchableOpacity>
                                    {(showEndTime || Platform.OS === 'ios') && (
                                        <DateTimePicker
                                            value={endTime}
                                            mode="time"
                                            display={Platform.OS === 'ios' ? 'compact' : 'default'}
                                            onChange={(e, date) => handleTimeChange(e, date, 'end')}
                                            minimumDate={startTime}
                                            style={Platform.OS === 'ios' ? styles.datePickerIOS : undefined}
                                        />
                                    )}
                                </View>
                            </View>
                        </View>
                    )}
                </GlassCard>

                {/* Reason */}
                <GlassCard style={styles.card}>
                    <Text style={styles.label}>Reason</Text>
                    <TextInput
                        style={styles.textArea}
                        value={reason}
                        onChangeText={setReason}
                        placeholder="Please detail the reason for your leave request..."
                        placeholderTextColor={COLORS.neutral[400]}
                        multiline
                        textAlignVertical="top"
                    />

                    <Text style={[styles.label, { marginTop: SPACING.lg }]}>Proof (Optional)</Text>
                    {proofUrl ? (
                        <View style={styles.proofPreviewWrap}>
                            <Image source={{ uri: proofUrl }} style={styles.proofPreview} resizeMode="cover" />
                            <TouchableOpacity style={styles.changeProofBtn} onPress={pickAndUploadProof} disabled={uploadingProof}>
                                <Text style={styles.changeProofText}>{uploadingProof ? 'Uploading...' : 'Change Proof'}</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity style={styles.uploadProofBtn} onPress={pickAndUploadProof} disabled={uploadingProof}>
                            <Text style={styles.uploadProofText}>{uploadingProof ? 'Uploading...' : 'Upload Proof'}</Text>
                        </TouchableOpacity>
                    )}
                </GlassCard>

                {/* Submit Button */}
                <Button
                    title="Submit Request"
                    onPress={handleSubmit}
                    loading={submitting}
                    disabled={submitting}
                    size="lg"
                    icon={<FileText size={20} color="#fff" />}
                    style={styles.submitButton}
                />

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    background: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },

    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    header: {
        height: Platform.OS === 'ios' ? 110 : 90,
        overflow: 'hidden',
    },
    headerGradient: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.lg,
        paddingBottom: SPACING.lg,
    },
    backButton: { padding: SPACING.sm },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 4,
    },

    content: {
        padding: SPACING.lg,
        paddingTop: SPACING.xl,
    },

    card: { marginBottom: SPACING.lg },
    label: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.neutral[700],
        marginBottom: SPACING.md,
        letterSpacing: 0.5,
    },
    subLabel: {
        fontSize: 12,
        color: COLORS.neutral[500],
        marginBottom: 4,
    },

    pickerContainer: {
        borderWidth: 1,
        borderColor: COLORS.neutral[200],
        borderRadius: BORDER_RADIUS.md,
        backgroundColor: COLORS.neutral[50],
        overflow: 'hidden',
    },
    pickerAndroid: {
        height: 50,
        width: '100%',
        color: COLORS.neutral[900],
    },
    pickerIOS: {
        height: 150,
    },

    toggleContainer: {
        flexDirection: 'row',
        backgroundColor: COLORS.neutral[100],
        borderRadius: BORDER_RADIUS.md,
        padding: 4,
        gap: 4,
    },
    toggleButton: {
        flex: 1,
        paddingVertical: SPACING.md,
        alignItems: 'center',
        borderRadius: BORDER_RADIUS.sm,
    },
    toggleButtonActive: {
        backgroundColor: '#fff',
        ...SHADOWS.sm,
    },
    toggleText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.neutral[500],
    },
    toggleTextActive: {
        color: COLORS.primary[600],
    },

    row: {
        flexDirection: 'row',
        gap: SPACING.md,
    },
    dateInputWrapper: {
        flex: 1,
    },
    dateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.neutral[50],
        borderWidth: 1,
        borderColor: COLORS.neutral[200],
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        height: 48,
        gap: SPACING.sm,
    },
    dateText: {
        fontSize: 14,
        color: COLORS.neutral[800],
    },
    datePickerIOS: {
        marginTop: SPACING.sm,
        alignSelf: 'flex-start',
    },

    section: {
        marginTop: SPACING.lg,
        borderTopWidth: 1,
        borderTopColor: COLORS.neutral[100],
        paddingTop: SPACING.lg,
    },

    textArea: {
        backgroundColor: COLORS.neutral[50],
        borderWidth: 1,
        borderColor: COLORS.neutral[200],
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        height: 120,
        fontSize: 15,
        color: COLORS.neutral[800],
    },

    submitButton: {
        marginTop: SPACING.sm,
    },
    uploadProofBtn: {
        marginTop: SPACING.sm,
        backgroundColor: COLORS.primary[50],
        borderWidth: 1,
        borderColor: COLORS.primary[200],
        borderRadius: BORDER_RADIUS.md,
        paddingVertical: SPACING.md,
        alignItems: 'center',
    },
    uploadProofText: {
        ...TYPOGRAPHY.captionBold,
        color: COLORS.primary[700],
    },
    proofPreviewWrap: {
        marginTop: SPACING.sm,
    },
    proofPreview: {
        width: '100%',
        height: 160,
        borderRadius: BORDER_RADIUS.md,
        backgroundColor: COLORS.neutral[100],
    },
    changeProofBtn: {
        marginTop: SPACING.sm,
        alignSelf: 'flex-start',
        backgroundColor: COLORS.neutral[100],
        borderRadius: BORDER_RADIUS.md,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
    },
    changeProofText: {
        ...TYPOGRAPHY.captionBold,
        color: COLORS.neutral[700],
    },
});
