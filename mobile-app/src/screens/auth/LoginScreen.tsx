import React, { useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import { signInWithPasswordWithRecovery } from '../../services/supabase';
import { COLORS, SPACING, SHADOWS, TYPOGRAPHY, BORDER_RADIUS } from '../../theme';
import { Input, Button } from '../../components/ui';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [touched, setTouched] = useState({ email: false, password: false });

    const errors = useMemo(() => {
        const next: { email?: string; password?: string } = {};
        if (touched.email) {
            if (!email.trim()) next.email = 'Email is required';
            else if (!/\S+@\S+\.\S+/.test(email.trim())) next.email = 'Enter a valid email';
        }
        if (touched.password) {
            if (!password) next.password = 'Password is required';
            else if (password.length < 6) next.password = 'Must be at least 6 characters';
        }
        return next;
    }, [email, password, touched]);

    const validateAll = () => {
        const nextTouched = { email: true, password: true };
        setTouched(nextTouched);
        const emailValid = email.trim().length > 0 && /\S+@\S+\.\S+/.test(email.trim());
        const passwordValid = password.length >= 6;
        return emailValid && passwordValid;
    };

    const handleLogin = async () => {
        if (!validateAll()) return;
        setLoading(true);
        try {
            const { error } = await signInWithPasswordWithRecovery({
                email: email.trim(),
                password,
            });
            if (error) {
                Alert.alert('Login Failed', error.message.includes('Invalid login credentials') ? 'Invalid email or password' : error.message);
            }
        } catch (_err) {
            Alert.alert('Error', 'Something went wrong while logging in.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#0f4bbf', '#2563eb', '#60a5fa']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
            />

            <View style={styles.bgShapeTop} />
            <View style={styles.bgShapeBottom} />

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.contentWrap}>
                <View style={styles.logoSection}>
                    <View style={styles.logoFrame}>
                        <Image source={require('../../assets/igo-logo.png')} style={styles.logoImage} resizeMode="contain" />
                    </View>
                    <Text style={styles.brandTitle}>IGO Group</Text>
                    <Text style={styles.brandSubtitle}>Operations Mobile Workspace</Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Welcome Back</Text>
                    <Text style={styles.cardSubtitle}>Sign in to continue your day workflow</Text>

                    <Input
                        label="Work Email"
                        placeholder="name@igogroup.com"
                        value={email}
                        onChangeText={setEmail}
                        onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
                        error={errors.email}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        autoCorrect={false}
                        leftIcon={<Mail size={18} color={COLORS.neutral[500]} />}
                    />

                    <Input
                        label="Password"
                        placeholder="Enter password"
                        value={password}
                        onChangeText={setPassword}
                        onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
                        error={errors.password}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                        leftIcon={<Lock size={18} color={COLORS.neutral[500]} />}
                        rightIcon={(
                            <Pressable onPress={() => setShowPassword((prev) => !prev)} hitSlop={12}>
                                {showPassword ? <EyeOff size={18} color={COLORS.neutral[500]} /> : <Eye size={18} color={COLORS.neutral[500]} />}
                            </Pressable>
                        )}
                    />

                    <Button title="Sign In" onPress={handleLogin} loading={loading} fullWidth size="lg" />
                </View>

                <Text style={styles.footerText}>Secure Access for IGO Field Teams</Text>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.primary[700],
    },
    contentWrap: {
        flex: 1,
        paddingHorizontal: SPACING.xl,
        justifyContent: 'center',
    },
    bgShapeTop: {
        position: 'absolute',
        top: -120,
        right: -80,
        width: 260,
        height: 260,
        borderRadius: 200,
        backgroundColor: 'rgba(255,255,255,0.12)',
    },
    bgShapeBottom: {
        position: 'absolute',
        bottom: -100,
        left: -60,
        width: 220,
        height: 220,
        borderRadius: 180,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    logoSection: {
        alignItems: 'center',
        marginBottom: SPACING.xxl,
    },
    logoFrame: {
        width: 120,
        height: 120,
        borderRadius: 28,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.lg,
        ...SHADOWS.lg,
    },
    logoImage: {
        width: 106,
        height: 106,
    },
    brandTitle: {
        ...TYPOGRAPHY.h2,
        color: '#ffffff',
        fontWeight: '800',
    },
    brandSubtitle: {
        ...TYPOGRAPHY.caption,
        color: 'rgba(255,255,255,0.84)',
        marginTop: 4,
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: BORDER_RADIUS.xxl,
        padding: SPACING.xl,
        ...SHADOWS.lg,
    },
    cardTitle: {
        ...TYPOGRAPHY.h3,
        marginBottom: 2,
        color: COLORS.neutral[900],
    },
    cardSubtitle: {
        ...TYPOGRAPHY.caption,
        marginBottom: SPACING.xl,
        color: COLORS.neutral[500],
    },
    footerText: {
        marginTop: SPACING.xl,
        textAlign: 'center',
        ...TYPOGRAPHY.caption,
        color: 'rgba(255,255,255,0.78)',
    },
});
