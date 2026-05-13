import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    TouchableOpacity,
    Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';
import { AppScreen, GlassCard } from '../../components/ui';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../theme';
import { Wallet, ExternalLink } from 'lucide-react-native';
import { format } from 'date-fns';

interface PayslipItem {
    id: string;
    salary_month: string;
    net_pay: number;
    paid_on: string | null;
    file_url: string | null;
}

const BG_GRADIENT: readonly [string, string, string] = ['#dbeafe', '#eff6ff', '#f8fafc'] as const;

export default function PayslipScreen() {
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState<PayslipItem[]>([]);
    const [errorText, setErrorText] = useState('');

    useEffect(() => {
        fetchPayslips();
    }, []);

    const fetchPayslips = async () => {
        setLoading(true);
        try {
            const userResult = await supabase.auth.getUser();
            const user = userResult?.data?.user;
            if (!user) return;

            let { data, error } = await supabase
                .from('payslips')
                .select('id, salary_month, net_pay, paid_on, file_url')
                .eq('employee_id', user.id)
                .order('salary_month', { ascending: false });

            if (error?.code === '42P01') {
                // Table doesn't exist, create it
                console.warn('Payslips table missing, creating...');
                try {
                    await supabase.rpc('create_payslips_table_if_not_exists');
                } catch (createError) {
                    console.warn('Could not create payslips table:', createError);
                }
                // Try again after potential creation
                const retry = await supabase
                    .from('payslips')
                    .select('id, salary_month, net_pay, paid_on, file_url')
                    .eq('employee_id', user.id)
                    .order('salary_month', { ascending: false });
                data = retry.data;
                error = retry.error;
            }

            if (error?.code === '42P01') {
                // Fallback to salary_slips table if payslips doesn't exist
                const fallback = await supabase
                    .from('salary_slips')
                    .select('id, salary_month, net_pay, paid_on, file_url')
                    .eq('employee_id', user.id)
                    .order('salary_month', { ascending: false });
                data = fallback.data as any;
                error = fallback.error;
            }

            if (error?.code === '42703') {
                const fallback = await supabase
                    .from('payslips')
                    .select('id, salary_month, net_pay, paid_on, file_url')
                    .eq('user_id', user.id)
                    .order('salary_month', { ascending: false });
                data = fallback.data as any;
                error = fallback.error;
            }

            if (error) {
                console.warn('Payslip fetch failed:', error);
                setErrorText(error.message || 'Unable to load payslips.');
                return;
            }

            setItems(data || []);
            setErrorText('');
        } catch (error) {
            console.error('Error fetching payslips:', error);
            setErrorText('Unable to load payslips.');
        } finally {
            setLoading(false);
        }
    };

    const openSlip = async (url: string) => {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
            await Linking.openURL(url);
        }
    };

    if (loading) {
        return (
            <View style={styles.loaderWrap}>
                <ActivityIndicator size="large" color={COLORS.primary[600]} />
            </View>
        );
    }

    return (
        <AppScreen title="My Payslip" subtitle="Monthly salary slips and payout details">
            <LinearGradient colors={BG_GRADIENT} style={styles.background} />

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {errorText !== '' ? (
                    <GlassCard style={styles.errorCard}>
                        <Text style={styles.errorText}>{errorText}</Text>
                    </GlassCard>
                ) : null}

                {items.length === 0 ? (
                    <GlassCard style={styles.emptyCard}>
                        <Wallet size={28} color={COLORS.neutral[500]} />
                        <Text style={styles.emptyTitle}>No Payslips Found</Text>
                        <Text style={styles.emptySub}>Your payslips will appear here once payroll is published.</Text>
                    </GlassCard>
                ) : (
                    items.map((item) => (
                        <GlassCard key={item.id} style={styles.card}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.monthLabel}>{item.salary_month}</Text>
                                <Text style={styles.payLabel}>Rs. {Number(item.net_pay || 0).toFixed(2)}</Text>
                            </View>

                            <Text style={styles.metaText}>
                                Paid on: {item.paid_on ? format(new Date(item.paid_on), 'dd MMM yyyy') : 'Pending'}
                            </Text>

                            {item.file_url ? (
                                <TouchableOpacity style={styles.openBtn} onPress={() => openSlip(item.file_url || '')}>
                                    <ExternalLink size={16} color={COLORS.primary[700]} />
                                    <Text style={styles.openBtnText}>Open Slip</Text>
                                </TouchableOpacity>
                            ) : null}
                        </GlassCard>
                    ))
                )}
            </ScrollView>
        </AppScreen>
    );
}

const styles = StyleSheet.create({
    loaderWrap: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background.primary,
    },
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
    emptyCard: {
        alignItems: 'center',
        paddingVertical: SPACING.xl,
        gap: SPACING.sm,
    },
    emptyTitle: {
        ...TYPOGRAPHY.h4,
        color: COLORS.neutral[800],
    },
    emptySub: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[500],
        textAlign: 'center',
    },
    card: {
        ...SHADOWS.sm,
    },
    errorCard: {
        backgroundColor: COLORS.error[50],
        borderColor: COLORS.error[100],
        borderWidth: 1,
    },
    errorText: {
        ...TYPOGRAPHY.captionBold,
        color: COLORS.error[700],
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.xs,
    },
    monthLabel: {
        ...TYPOGRAPHY.bodyBold,
        color: COLORS.neutral[800],
    },
    payLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.success[700],
    },
    metaText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[500],
    },
    openBtn: {
        marginTop: SPACING.md,
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        backgroundColor: COLORS.primary[50],
        borderRadius: BORDER_RADIUS.md,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
    },
    openBtnText: {
        ...TYPOGRAPHY.captionBold,
        color: COLORS.primary[700],
    },
});
