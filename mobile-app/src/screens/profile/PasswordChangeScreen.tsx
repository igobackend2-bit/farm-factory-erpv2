import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Lock, Eye, EyeOff } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../theme';
import { profileService } from '../../services/profileService';

interface PasswordChangeScreenProps {
  navigation: any;
}

export default function PasswordChangeScreen({ navigation }: PasswordChangeScreenProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const validatePassword = (password: string): boolean => {
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return false;
    }
    if (!/[A-Z]/.test(password)) {
      Alert.alert('Error', 'Password must contain at least one uppercase letter');
      return false;
    }
    if (!/[a-z]/.test(password)) {
      Alert.alert('Error', 'Password must contain at least one lowercase letter');
      return false;
    }
    if (!/[0-9]/.test(password)) {
      Alert.alert('Error', 'Password must contain at least one number');
      return false;
    }
    return true;
  };

  const handleChangePassword = async () => {
    if (!currentPassword) {
      Alert.alert('Error', 'Please enter your current password');
      return;
    }

    if (!newPassword) {
      Alert.alert('Error', 'Please enter a new password');
      return;
    }

    if (!validatePassword(newPassword)) {
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    if (currentPassword === newPassword) {
      Alert.alert('Error', 'New password must be different from current password');
      return;
    }

    setLoading(true);
    const { error } = await profileService.changePassword(currentPassword, newPassword);
    
    if (error) {
      if (error.message?.includes('invalid')) {
        Alert.alert('Error', 'Current password is incorrect');
      } else {
        Alert.alert('Error', 'Failed to change password. Please try again.');
      }
    } else {
      Alert.alert('Success', 'Password changed successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    }
    setLoading(false);
  };

  const getPasswordStrength = (): { level: number; color: string; text: string } => {
    if (!newPassword) return { level: 0, color: COLORS.neutral[300], text: '' };
    
    let strength = 0;
    if (newPassword.length >= 8) strength++;
    if (newPassword.length >= 12) strength++;
    if (/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword)) strength++;
    if (/[0-9]/.test(newPassword)) strength++;
    if (/[^A-Za-z0-9]/.test(newPassword)) strength++;

    if (strength <= 2) return { level: strength, color: '#ef4444', text: 'Weak' };
    if (strength <= 3) return { level: strength, color: '#f59e0b', text: 'Medium' };
    if (strength <= 4) return { level: strength, color: '#22c55e', text: 'Good' };
    return { level: strength, color: '#16a34a', text: 'Strong' };
  };

  const strength = getPasswordStrength();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={24} color={COLORS.neutral[800]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Change Password</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.iconContainer}>
            <Lock size={48} color={COLORS.primary[600]} />
          </View>

          <Text style={styles.subtitle}>
            Create a strong password with at least 8 characters including uppercase, lowercase, and numbers.
          </Text>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Current Password</Text>
              <View style={styles.passwordInput}>
                <TextInput
                  style={styles.input}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Enter current password"
                  placeholderTextColor={COLORS.neutral[400]}
                  secureTextEntry={!showCurrent}
                />
                <TouchableOpacity 
                  onPress={() => setShowCurrent(!showCurrent)}
                  style={styles.eyeButton}
                >
                  {showCurrent ? (
                    <EyeOff size={20} color={COLORS.neutral[400]} />
                  ) : (
                    <Eye size={20} color={COLORS.neutral[400]} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>New Password</Text>
              <View style={styles.passwordInput}>
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Enter new password"
                  placeholderTextColor={COLORS.neutral[400]}
                  secureTextEntry={!showNew}
                />
                <TouchableOpacity 
                  onPress={() => setShowNew(!showNew)}
                  style={styles.eyeButton}
                >
                  {showNew ? (
                    <EyeOff size={20} color={COLORS.neutral[400]} />
                  ) : (
                    <Eye size={20} color={COLORS.neutral[400]} />
                  )}
                </TouchableOpacity>
              </View>
              {newPassword.length > 0 && (
                <View style={styles.strengthContainer}>
                  <View style={styles.strengthBar}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <View
                        key={i}
                        style={[
                          styles.strengthSegment,
                          {
                            backgroundColor: i <= strength.level ? strength.color : COLORS.neutral[200],
                          },
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={[styles.strengthText, { color: strength.color }]}>
                    {strength.text}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm New Password</Text>
              <View style={styles.passwordInput}>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm new password"
                  placeholderTextColor={COLORS.neutral[400]}
                  secureTextEntry={!showConfirm}
                />
                <TouchableOpacity 
                  onPress={() => setShowConfirm(!showConfirm)}
                  style={styles.eyeButton}
                >
                  {showConfirm ? (
                    <EyeOff size={20} color={COLORS.neutral[400]} />
                  ) : (
                    <Eye size={20} color={COLORS.neutral[400]} />
                  )}
                </TouchableOpacity>
              </View>
              {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                <Text style={styles.errorText}>Passwords do not match</Text>
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.submitButton,
                (loading || !currentPassword || !newPassword || !confirmPassword) && 
                styles.submitButtonDisabled
              ]}
              onPress={handleChangePassword}
              disabled={loading || !currentPassword || !newPassword || !confirmPassword}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Change Password</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  content: {
    flex: 1,
  },
  iconContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  subtitle: {
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
    fontSize: 14,
    color: COLORS.neutral[500],
    marginBottom: SPACING.lg,
  },
  form: {
    padding: SPACING.md,
  },
  inputGroup: {
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.neutral[600],
    marginBottom: SPACING.xs,
  },
  passwordInput: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.neutral[300],
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 16,
    color: COLORS.neutral[800],
  },
  eyeButton: {
    position: 'absolute',
    right: SPACING.md,
    padding: SPACING.xs,
  },
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  strengthBar: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    marginRight: SPACING.sm,
  },
  strengthSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: SPACING.xs,
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