import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard, StatusBadge, AppScreen } from '../../components/ui';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../theme';
import { useLocationStore } from '../../store/useLocationStore';
import { supabase, signOutWithRecovery } from '../../services/supabase';
import { useShiftUserStatus } from '../../hooks/useShiftUserStatus';
import Constants from 'expo-constants';
import {
    User,
    Clock,
    Calendar,
    FileText,
    ClipboardList,
    AlertTriangle,
    LogOut,
    ChevronRight,
    Shield,
    Bell,
    Settings,
    HelpCircle,
    MapPin,
    Activity,
    Wallet,
    Camera,
    Coffee,
} from 'lucide-react-native';

const HEADER_GRADIENT: [string, string, ...string[]] = ['#2563eb', '#1e40af'];

const debugIngestUrl = (() => {
    // Prefer the dev machine host (works on devices/emulators); fallback to localhost for simulator.
    const hostUri = (Constants as any)?.expoConfig?.hostUri || (Constants as any)?.manifest2?.extra?.expoClient?.hostUri;
    const host = typeof hostUri === 'string' ? hostUri.split(':')[0] : null;
    const baseHost = host || '127.0.0.1';
    return `http://${baseHost}:7610/ingest/ed0f322d-6eec-4494-9deb-f57f59262717`;
})();

interface UserProfile {
    full_name: string;
    role: string;
    designation?: string;
    department: string;
    avatar_url?: string;
}

const GENERAL_MENU_SECTIONS = [
    {
        title: 'Daily Workflow',
        items: [
            { icon: Clock, label: 'Day Start / Login', screen: 'Home', color: COLORS.primary[500] },
            { icon: ClipboardList, label: 'Hourly Reports', screen: 'HourlyReport', color: COLORS.success[500] },
            { icon: FileText, label: 'Day Plan', screen: 'DayPlan', color: COLORS.warning[500] },
            { icon: Activity, label: 'EOD Summary', screen: 'EODReport', color: COLORS.error[400] },
        ],
    },
    {
        title: 'My Items',
        items: [
            { icon: AlertTriangle, label: 'My LOP', screen: 'LOPScreen', color: COLORS.error[500] },
            { icon: ClipboardList, label: 'My SOP', screen: 'MySOPs', color: COLORS.primary[600] },
            { icon: Wallet, label: 'My Payslip', screen: 'Payslip', color: COLORS.success[600] },
            { icon: FileText, label: 'My Requests', screen: 'RequestsHome', color: COLORS.warning[600] },
        ],
    },
    {
        title: 'Management',
        items: [
            { icon: Calendar, label: 'Company Calendar', screen: 'CompanyCalendar', color: COLORS.primary[600] },
            { icon: Coffee, label: 'Palm Cafe', screen: 'PalmCafe', color: COLORS.warning[600] },
            { icon: Shield, label: 'Leave Request', screen: 'LeaveRequest', color: COLORS.neutral[600] },
            { icon: Activity, label: 'Payment Request', screen: 'PaymentRequest', color: COLORS.success[600] },
            { icon: MapPin, label: 'Travel Request', screen: 'TravelApproval', color: COLORS.primary[600] },
        ],
    },
    {
        title: 'Settings',
        items: [
            { icon: FileText, label: 'EOD Summary', screen: 'EODSummary', color: COLORS.primary[500] },
            { icon: Bell, label: 'Notifications', screen: 'Notifications', color: COLORS.warning[500] },
            { icon: Settings, label: 'Diagnostics', screen: 'Diagnostics', color: COLORS.neutral[500] },
            { icon: HelpCircle, label: 'Help & Support', screen: 'Help', color: COLORS.primary[400] },
        ],
    },
];

const SHIFT_MENU_SECTIONS = [
    {
        title: 'Shift Workflow',
        items: [
            { icon: Clock, label: 'Shift Home', screen: 'ShiftHome', color: COLORS.primary[500] },
            { icon: ClipboardList, label: 'Hourly Slot Report', screen: 'ShiftHourly', color: COLORS.success[500] },
            { icon: Activity, label: 'Break Entry', screen: 'ShiftBreak', color: COLORS.warning[500] },
            { icon: FileText, label: 'Shift EOD', screen: 'ShiftEOD', color: COLORS.error[400] },
            { icon: MapPin, label: 'Payment Audit', screen: 'PaymentAudit', color: COLORS.primary[600] },
            { icon: LogOut, label: 'Logout Checklist', screen: 'ShiftLogout', color: COLORS.neutral[600] },
        ],
    },
    {
        title: 'My Items',
        items: [
            { icon: AlertTriangle, label: 'My LOP', screen: 'LOPReversal', color: COLORS.error[500] },
            { icon: ClipboardList, label: 'My SOP', screen: 'MySOPs', color: COLORS.primary[600] },
            { icon: Wallet, label: 'My Payslip', screen: 'Payslip', color: COLORS.success[600] },
            { icon: FileText, label: 'My Requests', screen: 'RequestsHome', color: COLORS.warning[600] },
        ],
    },
    {
        title: 'Management',
        items: [
            {
                icon: MapPin, label: 'Travel Management', screen: 'TripList', color: COLORS.success[600]
            },
            { icon: Shield, label: 'Leave Request', screen: 'LeaveRequest', color: COLORS.neutral[600] },
            { icon: Activity, label: 'Payment Request', screen: 'TravelClaim', color: COLORS.success[600] },
            { icon: Calendar, label: 'Company Calendar', screen: 'CompanyCalendar', color: COLORS.primary[600] },
        ],
    },
    {
        title: 'Settings',
        items: [
            { icon: Bell, label: 'Notifications', screen: 'Notifications', color: COLORS.warning[500] },
            { icon: Settings, label: 'Diagnostics', screen: 'Diagnostics', color: COLORS.neutral[500] },
            { icon: HelpCircle, label: 'Help & Support', screen: 'Help', color: COLORS.primary[400] },
        ],
    },
];

export default function MenuScreen({ navigation }: any) {
    const { isOnDuty } = useLocationStore();
    const { isShiftUser } = useShiftUserStatus();
    const [profile, setProfile] = useState<UserProfile | null>(null);

    useEffect(() => {
        // #region agent log
        console.log('[DD2051][H1] MenuScreen mounted', {
            isShiftUser,
            isOnDuty,
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
                hypothesisId: 'H1',
                location: 'MenuScreen.tsx:useEffect(mount)',
                message: 'Menu screen mounted',
                data: { isShiftUser, isOnDuty },
                timestamp: Date.now(),
            }),
        }).catch(() => {});
        // #endregion
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const userResult = await supabase.auth.getUser();
            const user = userResult?.data?.user;
            const userExists = user !== null && user !== undefined;
            if (userExists === false) return;

            const { data } = await supabase
                .from('profiles')
                .select('full_name, role, designation, department, avatar_url')
                .eq('id', user.id)
                .maybeSingle();

            const dataExists = data !== null && data !== undefined;
            if (dataExists === true) {
                // #region agent log
                console.log('[DD2051][H3] MenuScreen fetchProfile success', {
                    hasAvatarUrl: Boolean((data as any)?.avatar_url),
                    hasFullName: Boolean((data as any)?.full_name),
                });
                // #endregion
                // #region agent log
                fetch(debugIngestUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'dd2051' },
                    body: JSON.stringify({
                        sessionId: 'dd2051',
                        runId: 'pre-fix',
                        hypothesisId: 'H3',
                        location: 'MenuScreen.tsx:fetchProfile(success)',
                        message: 'Fetched profile (profiles table)',
                        data: { hasAvatarUrl: Boolean((data as any)?.avatar_url), hasFullName: Boolean((data as any)?.full_name) },
                        timestamp: Date.now(),
                    }),
                }).catch(() => {});
                // #endregion
                setProfile(data);
            } else {
                // Safe fallback - avoid array indexing on split
                const userEmail = user !== null && user !== undefined && user.email !== null && user.email !== undefined ? String(user.email) : '';
                const emailParts = userEmail.split('@');
                const emailPrefix = emailParts.length > 0 ? emailParts[0] : 'Employee';
                setProfile({
                    full_name: emailPrefix,
                    role: 'Field Operations',
                    designation: 'Executive',
                    department: 'Operations',
                });
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
        }
    };

    const handleLogout = async () => {
        Alert.alert(
            'Confirm Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await signOutWithRecovery();
                            if (error) {
                                Alert.alert('Logout Error', error.message || 'Failed to logout. Please try again.');
                            }
                            // Navigation to login is handled by App.js auth state listener
                        } catch (err) {
                            Alert.alert('Logout Error', 'An unexpected error occurred. Please try again.');
                        }
                    },
                },
            ]
        );
    };

    const handleUploadAvatar = async () => {
        try {
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (permission.status !== 'granted') {
                Alert.alert('Permission required', 'Please allow media access to upload profile image.');
                return;
            }

            const picker = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.8,
                aspect: [1, 1],
            });

            if (picker.canceled || !picker.assets?.length) return;

            const userResult = await supabase.auth.getUser();
            const user = userResult?.data?.user;
            if (!user) throw new Error('No user');

            const uri = picker.assets[0].uri;
            const response = await fetch(uri);
            const blob = await response.blob();
            const ext = uri.split('.').pop() || 'jpg';
            const filePath = `avatars/${user.id}-${Date.now()}.${ext}`;

            const upload = await supabase.storage.from('profile-images').upload(filePath, blob, {
                upsert: false,
                contentType: blob.type || 'image/jpeg',
            });
            if (upload.error) throw upload.error;

            const publicUrl = supabase.storage.from('profile-images').getPublicUrl(filePath).data.publicUrl;

            const update = await supabase
                .from('profiles')
                .update({ avatar_url: publicUrl })
                .eq('id', user.id);
            if (update.error) throw update.error;

            setProfile((prev) => (prev ? { ...prev, avatar_url: publicUrl } : prev));
            Alert.alert('Success', 'Profile image updated.');
        } catch (error: any) {
            Alert.alert('Upload failed', error?.message || 'Unable to upload profile image.');
        }
    };

    const handleMenuPress = (screen: string) => {
        // #region agent log
        console.log('[DD2051][H1] Menu item pressed', { screen });
        // #endregion
        // #region agent log
        fetch(debugIngestUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'dd2051' },
            body: JSON.stringify({
                sessionId: 'dd2051',
                runId: 'pre-fix',
                hypothesisId: 'H1',
                location: 'MenuScreen.tsx:handleMenuPress',
                message: 'Menu item pressed',
                data: { screen },
                timestamp: Date.now(),
            }),
        }).catch(() => {});
        // #endregion
        // Special Routing Logic
        if (['ShiftHome', 'ShiftHourly', 'ShiftBreak', 'ShiftEOD', 'ShiftLogout', 'PaymentAudit'].includes(screen)) {
            navigation.navigate('Home', { screen });
            return;
        }
        if (screen === 'Home') {
            navigation.navigate('Home');
            return;
        }
        if (['HourlyReport', 'DayPlan', 'EODReport'].includes(screen)) {
            navigation.navigate('Work', { screen });
            return;
        }
        if (['LeaveRequest', 'LOPReversal', 'TravelApproval', 'TravelClaim', 'TripList', 'RequestsHome', 'PaymentRequest'].includes(screen)) {
            navigation.navigate('Requests', { screen });
            return;
        }
        if (['MySOPs', 'Payslip', 'LOPScreen'].includes(screen)) {
            navigation.navigate('More', { screen });
            return;
        }
        if (screen === 'Chat') {
            navigation.navigate('Chat');
            return;
        }
        if (screen === 'EODSummary') {
            navigation.navigate('More', { screen: 'EODSummary' });
            return;
        }
        if (screen === 'CompanyCalendar') {
            navigation.navigate('More', { screen: 'CompanyCalendar' });
            return;
        }
        if (screen === 'Diagnostics') {
            navigation.navigate('More', { screen: 'Diagnostics' });
            return;
        }

        // #region agent log
        console.log('[DD2051][H1] Menu fell through to Coming Soon', { screen });
        // #endregion
        // #region agent log
        fetch(debugIngestUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'dd2051' },
            body: JSON.stringify({
                sessionId: 'dd2051',
                runId: 'pre-fix',
                hypothesisId: 'H1',
                location: 'MenuScreen.tsx:handleMenuPress(fallback)',
                message: 'Menu item fell through to Coming Soon',
                data: { screen },
                timestamp: Date.now(),
            }),
        }).catch(() => {});
        // #endregion
        Alert.alert('Coming Soon', 'This feature is under development.');
    };

    return (
        <AppScreen scrollable={false}>

            {/* Profile Header */}
            <View style={styles.header}>
                <LinearGradient
                    colors={HEADER_GRADIENT}
                    style={styles.headerGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <View style={styles.profileSection}>
                        <View style={styles.avatarContainer}>
                            {profile !== null && profile !== undefined && profile.avatar_url !== null && profile.avatar_url !== undefined && profile.avatar_url !== '' ? (
                                <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
                            ) : (
                                <View style={styles.avatarPlaceholder}>
                                    <User size={32} color="#fff" />
                                </View>
                            )}
                            <StatusBadge
                                status={isOnDuty === true ? 'on_duty' : 'off_duty'}
                                size="sm"
                                showDot={true}
                                style={styles.statusBadge}
                            />
                            <TouchableOpacity style={styles.avatarEditBtn} onPress={handleUploadAvatar}>
                                <Camera size={14} color="#fff" />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.profileInfo}>
                            <Text style={styles.profileName}>
                                {profile !== null && profile !== undefined && profile.full_name !== null && profile.full_name !== undefined ? profile.full_name : 'Loading...'}
                            </Text>
                            <Text style={styles.profileRole}>
                                {profile !== null && profile !== undefined && (profile.designation || profile.role)
                                    ? (profile.designation || profile.role)
                                    : 'Employee'}
                            </Text>
                            <Text style={styles.profileDept}>
                                {profile !== null && profile !== undefined && profile.department !== null && profile.department !== undefined ? profile.department : 'Operations'}
                            </Text>
                        </View>
                    </View>
                </LinearGradient>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {(isShiftUser ? SHIFT_MENU_SECTIONS : GENERAL_MENU_SECTIONS).map((section, sectionIndex) => (
                    <View key={sectionIndex} style={styles.section}>
                        <Text style={styles.sectionTitle}>{section.title}</Text>
                        <GlassCard noPadding={true}>
                            {section.items.map((item, index) => {
                                const Icon = item.icon;
                                const isLast = index === section.items.length - 1;
                                return (
                                    <TouchableOpacity
                                        key={index}
                                        style={[
                                            styles.menuItem,
                                            isLast === false ? styles.menuItemBorder : null,
                                        ]}
                                        onPress={() => handleMenuPress(item.screen)}
                                        activeOpacity={0.7}
                                    >
                                        <View
                                            style={[
                                                styles.menuIcon,
                                                { backgroundColor: `${item.color}15` },
                                            ]}
                                        >
                                            <Icon size={20} color={item.color} />
                                        </View>
                                        <Text style={styles.menuLabel}>{item.label}</Text>
                                        <ChevronRight size={18} color={COLORS.neutral[400]} />
                                    </TouchableOpacity>
                                );
                            })}
                        </GlassCard>
                    </View>
                ))}

                {/* Logout Button */}
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <LogOut size={20} color={COLORS.error[600]} />
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>

                {/* Version */}
                <View style={styles.footer}>
                    <Text style={styles.version}>IGO Group Mobile</Text>
                    <Text style={styles.versionNumber}>Version 2.0.0</Text>
                </View>
            </ScrollView>
        </AppScreen>
    );
}

const styles = StyleSheet.create({
    header: {
        overflow: 'hidden',
        borderRadius: BORDER_RADIUS.xxl,
        marginHorizontal: SPACING.lg,
        marginTop: SPACING.sm,
    },
    headerGradient: {
        paddingTop: 60,
        paddingBottom: SPACING.xxl,
        paddingHorizontal: SPACING.xl,
    },
    profileSection: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarContainer: {
        position: 'relative',
    },
    avatar: {
        width: 72,
        height: 72,
        borderRadius: 36,
        borderWidth: 3,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    avatarPlaceholder: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    statusBadge: {
        position: 'absolute',
        bottom: -4,
        right: -4,
    },
    avatarEditBtn: {
        position: 'absolute',
        top: -4,
        right: -4,
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: COLORS.primary[700],
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },
    profileInfo: {
        marginLeft: SPACING.lg,
        flex: 1,
    },
    profileName: {
        fontSize: 22,
        fontWeight: '700',
        color: '#fff',
    },
    profileRole: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.9)',
        marginTop: 4,
    },
    profileDept: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 2,
    },

    scrollView: { flex: 1 },
    scrollContent: {
        padding: SPACING.lg,
        paddingTop: SPACING.lg,
        paddingBottom: 120,
    },

    section: {
        marginBottom: SPACING.xl,
    },
    sectionTitle: {
        ...TYPOGRAPHY.label,
        marginBottom: SPACING.md,
        marginLeft: SPACING.xs,
    },

    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.lg,
    },
    menuItemBorder: {
        borderBottomWidth: 1,
        borderBottomColor: COLORS.neutral[100],
    },
    menuIcon: {
        width: 40,
        height: 40,
        borderRadius: BORDER_RADIUS.md,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.md,
    },
    menuLabel: {
        ...TYPOGRAPHY.body,
        flex: 1,
        color: COLORS.neutral[800],
    },

    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.error[50],
        padding: SPACING.lg,
        borderRadius: BORDER_RADIUS.lg,
        marginTop: SPACING.md,
        gap: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.error[200],
    },
    logoutText: {
        ...TYPOGRAPHY.bodyBold,
        color: COLORS.error[600],
    },

    footer: {
        alignItems: 'center',
        marginTop: SPACING.xxxl,
        marginBottom: SPACING.xl,
    },
    version: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[400],
    },
    versionNumber: {
        fontSize: 12,
        color: COLORS.neutral[300],
        marginTop: 2,
    },
});
