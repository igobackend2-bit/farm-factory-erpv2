import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Save, Camera } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../theme';
import { profileService, Profile } from '../../services/profileService';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';

interface ProfileEditScreenProps {
  navigation: any;
}

const debugIngestUrl = (() => {
  const hostUri = (Constants as any)?.expoConfig?.hostUri || (Constants as any)?.manifest2?.extra?.expoClient?.hostUri;
  const host = typeof hostUri === 'string' ? hostUri.split(':')[0] : null;
  const baseHost = host || '127.0.0.1';
  return `http://${baseHost}:7610/ingest/ed0f322d-6eec-4494-9deb-f57f59262717`;
})();

export default function ProfileEditScreen({ navigation }: ProfileEditScreenProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    emergency_contact: '',
    blood_group: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
  });

  useEffect(() => {
    // #region agent log
    console.log('[DD2051][H2] ProfileEdit mounted', {
      hostUri: (Constants as any)?.expoConfig?.hostUri || (Constants as any)?.manifest2?.extra?.expoClient?.hostUri,
      debugIngestUrl,
    });
    // #endregion
    // #region agent log
    fetch(debugIngestUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'dd2051' },
      body: JSON.stringify({
        sessionId: 'dd2051',
        runId: 'pre-fix',
        hypothesisId: 'H2',
        location: 'ProfileEditScreen.tsx:useEffect(mount)',
        message: 'ProfileEdit mounted',
        data: {},
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    const data = await profileService.getProfile();
    if (data) {
      // #region agent log
      console.log('[DD2051][H2] ProfileEdit loadProfile success', { hasFullName: Boolean((data as any)?.full_name) });
      // #endregion
      // #region agent log
      fetch(debugIngestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'dd2051' },
        body: JSON.stringify({
          sessionId: 'dd2051',
          runId: 'pre-fix',
          hypothesisId: 'H2',
          location: 'ProfileEditScreen.tsx:loadProfile(success)',
          message: 'Loaded profile data',
          data: { hasFullName: Boolean((data as any)?.full_name) },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      setProfile(data);
      setFormData({
        full_name: data.full_name || '',
        phone: data.phone || '',
        emergency_contact: data.emergency_contact || '',
        blood_group: data.blood_group || '',
        address: data.address || '',
        city: data.city || '',
        state: data.state || '',
        pincode: data.pincode || '',
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    // #region agent log
    console.log('[DD2051][H2] ProfileEdit save pressed', {
      hasFullName: Boolean(formData.full_name),
      hasPhone: Boolean(formData.phone),
    });
    // #endregion
    // #region agent log
    fetch(debugIngestUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'dd2051' },
      body: JSON.stringify({
        sessionId: 'dd2051',
        runId: 'pre-fix',
        hypothesisId: 'H2',
        location: 'ProfileEditScreen.tsx:handleSave(start)',
        message: 'Save pressed',
        data: { hasFullName: Boolean(formData.full_name), hasPhone: Boolean(formData.phone) },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    setSaving(true);
    const { data, error } = await profileService.updateProfile(formData);
    
    if (error) {
      // #region agent log
      console.log('[DD2051][H2] ProfileEdit save failed');
      // #endregion
      // #region agent log
      fetch(debugIngestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'dd2051' },
        body: JSON.stringify({
          sessionId: 'dd2051',
          runId: 'pre-fix',
          hypothesisId: 'H2',
          location: 'ProfileEditScreen.tsx:handleSave(error)',
          message: 'Profile save failed',
          data: { hasError: true },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } else {
      // #region agent log
      console.log('[DD2051][H2] ProfileEdit save succeeded', { returnedData: Boolean(data) });
      // #endregion
      // #region agent log
      fetch(debugIngestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'dd2051' },
        body: JSON.stringify({
          sessionId: 'dd2051',
          runId: 'pre-fix',
          hypothesisId: 'H2',
          location: 'ProfileEditScreen.tsx:handleSave(success)',
          message: 'Profile save succeeded',
          data: { returnedData: Boolean(data) },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      Alert.alert('Success', 'Profile updated successfully!');
      navigation.goBack();
    }
    setSaving(false);
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSaving(true);
      const { data, error } = await profileService.updateProfilePicture(result.assets[0].uri);
      if (!error && data) {
        setProfile(data);
        Alert.alert('Success', 'Profile picture updated!');
      }
      setSaving(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

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
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveButton}>
          {saving ? (
            <ActivityIndicator size="small" color={COLORS.primary[600]} />
          ) : (
            <Save size={24} color={COLORS.primary[600]} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handlePickImage} style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {formData.full_name?.charAt(0)?.toUpperCase() || 'U'}
              </Text>
            </View>
            <View style={styles.cameraIcon}>
              <Camera size={16} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarHint}>Tap to change photo</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={formData.full_name}
              onChangeText={(v) => updateField('full_name', v)}
              placeholder="Enter your full name"
              placeholderTextColor={COLORS.neutral[400]}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={formData.phone}
              onChangeText={(v) => updateField('phone', v)}
              placeholder="Enter phone number"
              placeholderTextColor={COLORS.neutral[400]}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Emergency Contact</Text>
            <TextInput
              style={styles.input}
              value={formData.emergency_contact}
              onChangeText={(v) => updateField('emergency_contact', v)}
              placeholder="Emergency contact number"
              placeholderTextColor={COLORS.neutral[400]}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Blood Group</Text>
            <TextInput
              style={styles.input}
              value={formData.blood_group}
              onChangeText={(v) => updateField('blood_group', v)}
              placeholder="e.g., A+, B+, O+"
              placeholderTextColor={COLORS.neutral[400]}
            />
          </View>

          <Text style={styles.sectionTitle}>Address</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Street Address</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.address}
              onChangeText={(v) => updateField('address', v)}
              placeholder="Enter address"
              placeholderTextColor={COLORS.neutral[400]}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.flex1]}>
              <Text style={styles.label}>City</Text>
              <TextInput
                style={styles.input}
                value={formData.city}
                onChangeText={(v) => updateField('city', v)}
                placeholder="City"
                placeholderTextColor={COLORS.neutral[400]}
              />
            </View>
            <View style={{ width: SPACING.xs }} />
            <View style={[styles.inputGroup, styles.flex1]}>
              <Text style={styles.label}>State</Text>
              <TextInput
                style={styles.input}
                value={formData.state}
                onChangeText={(v) => updateField('state', v)}
                placeholder="State"
                placeholderTextColor={COLORS.neutral[400]}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Pincode</Text>
            <TextInput
              style={styles.input}
              value={formData.pincode}
              onChangeText={(v) => updateField('pincode', v)}
              placeholder="Enter pincode"
              placeholderTextColor={COLORS.neutral[400]}
              keyboardType="number-pad"
              maxLength={6}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, saving && styles.submitButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  saveButton: {
    padding: SPACING.xs,
  },
  content: {
    flex: 1,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    backgroundColor: '#fff',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 40,
    fontWeight: '700',
    color: '#fff',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarHint: {
    marginTop: SPACING.sm,
    fontSize: 14,
    color: COLORS.neutral[500],
  },
  form: {
    padding: SPACING.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.neutral[800],
    marginBottom: SPACING.md,
    marginTop: SPACING.md,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.neutral[600],
    marginBottom: SPACING.xs,
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
  },
  flex1: {
    flex: 1,
  },
  submitButton: {
    backgroundColor: COLORS.primary[600],
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.lg,
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