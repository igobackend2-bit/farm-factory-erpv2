import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FileText, IndianRupee, Plane, Wallet } from 'lucide-react-native';
import { AppScreen, GlassCard } from '../../components/ui';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../theme';

const BG_GRADIENT: readonly [string, string, string] = ['#e0e7ff', '#f0f9ff', '#f8fafc'] as const;

export default function RequestsHomeScreen({ navigation }: any) {
    return (
        <AppScreen title="Requests" subtitle="Submit and track your ERP requests">
            <LinearGradient colors={BG_GRADIENT} style={styles.background} />

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => navigation.navigate('LeaveRequest')}
                    activeOpacity={0.8}
                >
                    <GlassCard style={styles.card}>
                        <View style={[styles.iconWrap, { backgroundColor: COLORS.primary[100] }]}>
                            <FileText size={22} color={COLORS.primary[700]} />
                        </View>
                        <View style={styles.cardBody}>
                            <Text style={styles.cardTitle}>Leave Request</Text>
                            <Text style={styles.cardSub}>Apply leave for approved days and reasons.</Text>
                        </View>
                    </GlassCard>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => navigation.navigate('PaymentRequest')}
                    activeOpacity={0.8}
                >
                    <GlassCard style={styles.card}>
                        <View style={[styles.iconWrap, { backgroundColor: COLORS.success[100] }]}>
                            <Wallet size={22} color={COLORS.success[700]} />
                        </View>
                        <View style={styles.cardBody}>
                            <Text style={styles.cardTitle}>Payment Request</Text>
                            <Text style={styles.cardSub}>Salary, Advance, and Reimbursement requests.</Text>
                        </View>
                    </GlassCard>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => navigation.navigate('TravelClaim')}
                    activeOpacity={0.8}
                >
                    <GlassCard style={styles.card}>
                        <View style={[styles.iconWrap, { backgroundColor: COLORS.warning[100] }]}>
                            <IndianRupee size={22} color={COLORS.warning[600]} />
                        </View>
                        <View style={styles.cardBody}>
                            <Text style={styles.cardTitle}>Travel Claim</Text>
                            <Text style={styles.cardSub}>Submit travel expense claims and reimbursements.</Text>
                        </View>
                    </GlassCard>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => navigation.navigate('TravelApproval')}
                    activeOpacity={0.8}
                >
                    <GlassCard style={styles.card}>
                        <View style={[styles.iconWrap, { backgroundColor: COLORS.warning[100] }]}>
                            <Plane size={22} color={COLORS.warning[600]} />
                        </View>
                        <View style={styles.cardBody}>
                            <Text style={styles.cardTitle}>Travel Request</Text>
                            <Text style={styles.cardSub}>Create and submit travel movement approvals.</Text>
                        </View>
                    </GlassCard>
                </TouchableOpacity>
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
    actionButton: {
        borderRadius: BORDER_RADIUS.lg,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
        ...SHADOWS.sm,
    },
    iconWrap: {
        width: 48,
        height: 48,
        borderRadius: BORDER_RADIUS.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardBody: {
        flex: 1,
    },
    cardTitle: {
        ...TYPOGRAPHY.bodyBold,
        color: COLORS.neutral[800],
    },
    cardSub: {
        ...TYPOGRAPHY.caption,
        marginTop: 2,
        color: COLORS.neutral[500],
    },
});
