import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'No authorization header' }), {
                status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const now = new Date();
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const lookbackStr = sevenDaysAgo.toISOString();

        // Fetch recent payments
        const { data: recentPayments, error: fetchErr } = await supabase
            .from('payment_requests')
            .select('id, requester_id, vendor_name, amount, created_at, vendor_account_number, vendor_ifsc_code, vendor_upi')
            .gte('created_at', lookbackStr)
            .order('created_at', { ascending: false })
            .limit(500);

        if (fetchErr) throw fetchErr;
        if (!recentPayments?.length) {
            return new Response(JSON.stringify({ message: 'No recent payments to analyze', alerts_created: 0 }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const alerts: Array<{
            alert_type: string;
            requester_id: string | null;
            vendor_name: string | null;
            payment_ids: string[];
            pattern_description: string;
            severity: string;
        }> = [];

        // ─── Pattern 1: High-frequency requester (>5 payments in a single day) ───
        const byRequesterDay = new Map<string, { count: number; ids: string[]; date: string }>();
        for (const p of recentPayments) {
            const day = p.created_at.split('T')[0];
            const key = `${p.requester_id}:${day}`;
            const entry: { count: number; ids: string[]; date: string } = byRequesterDay.get(key) || { count: 0, ids: [], date: day };
            entry.count++;
            entry.ids.push(p.id);
            byRequesterDay.set(key, entry);
        }
        for (const [key, val] of byRequesterDay) {
            if (val.count > 5) {
                const requesterId = key.split(':')[0];
                alerts.push({
                    alert_type: 'high_frequency',
                    requester_id: requesterId,
                    vendor_name: null,
                    payment_ids: val.ids,
                    pattern_description: `Requester submitted ${val.count} payments on ${val.date} (threshold: 5)`,
                    severity: val.count > 10 ? 'high' : 'medium',
                });
            }
        }

        // ─── Pattern 2: Same vendor burst (>10 payments to same vendor in 7 days) ───
        const byVendor = new Map<string, { count: number; ids: string[]; name: string }>();
        for (const p of recentPayments) {
            if (!p.vendor_name) continue;
            const normVendor = p.vendor_name.toLowerCase().replace(/[^a-z0-9]/g, '');
            const entry: { count: number; ids: string[]; name: string } = byVendor.get(normVendor) || { count: 0, ids: [], name: p.vendor_name };
            entry.count++;
            entry.ids.push(p.id);
            byVendor.set(normVendor, entry);
        }
        for (const [, val] of byVendor) {
            if (val.count > 10) {
                alerts.push({
                    alert_type: 'same_vendor_burst',
                    requester_id: null,
                    vendor_name: val.name,
                    payment_ids: val.ids.slice(0, 20),
                    pattern_description: `${val.count} payments to vendor "${val.name}" in past 7 days (threshold: 10)`,
                    severity: val.count > 20 ? 'high' : 'medium',
                });
            }
        }

        // ─── Pattern 3: Round amounts (>3 payments with round amounts from same requester) ───
        const roundByRequester = new Map<string, { count: number; ids: string[]; amounts: number[] }>();
        for (const p of recentPayments) {
            if (p.amount % 1000 === 0 && p.amount >= 5000) {
                const entry: { count: number; ids: string[]; amounts: number[] } = roundByRequester.get(p.requester_id) || { count: 0, ids: [], amounts: [] };
                entry.count++;
                entry.ids.push(p.id);
                entry.amounts.push(p.amount);
                roundByRequester.set(p.requester_id, entry);
            }
        }
        for (const [requesterId, val] of roundByRequester) {
            if (val.count > 3) {
                alerts.push({
                    alert_type: 'round_amounts',
                    requester_id: requesterId,
                    vendor_name: null,
                    payment_ids: val.ids,
                    pattern_description: `${val.count} round-amount payments (₹${val.amounts.join(', ₹')}) from same requester in 7 days`,
                    severity: 'low',
                });
            }
        }

        // ─── Pattern 4: Multiple requesters → same bank account ───
        const byAccount = new Map<string, { requesters: Set<string>; ids: string[]; accountKey: string }>();
        for (const p of recentPayments) {
            if (!p.vendor_account_number) continue;
            const acctKey = `${p.vendor_account_number}:${p.vendor_ifsc_code || ''}`;
            const entry: { requesters: Set<string>; ids: string[]; accountKey: string } = byAccount.get(acctKey) || { requesters: new Set(), ids: [], accountKey: acctKey };
            entry.requesters.add(p.requester_id);
            entry.ids.push(p.id);
            byAccount.set(acctKey, entry);
        }
        for (const [, val] of byAccount) {
            if (val.requesters.size >= 3) {
                alerts.push({
                    alert_type: 'multi_requester_same_account',
                    requester_id: null,
                    vendor_name: null,
                    payment_ids: val.ids.slice(0, 20),
                    pattern_description: `${val.requesters.size} different requesters paying to same bank account (${val.accountKey}) in 7 days`,
                    severity: 'high',
                });
            }
        }

        // ─── Insert alerts (skip duplicates by checking existing pending alerts) ───
        let alertsCreated = 0;
        for (const alert of alerts) {
            // Check if similar pending alert exists
            const { data: existing } = await supabase
                .from('fraud_pattern_alerts')
                .select('id')
                .eq('alert_type', alert.alert_type)
                .eq('status', 'pending')
                .eq('requester_id', alert.requester_id || '')
                .limit(1);

            if (existing?.length) continue; // Skip duplicate alerts

            const { error: insertErr } = await supabase
                .from('fraud_pattern_alerts')
                .insert(alert);

            if (!insertErr) {
                alertsCreated++;

                // Notify admin/ceo for high-severity alerts
                if (alert.severity === 'high') {
                    // Get admin IDs
                    const { data: admins } = await supabase
                        .from('profiles')
                        .select('id')
                        .in('role', ['admin', 'ceo'])
                        .limit(10);

                    if (admins?.length) {
                        const notifications = admins.map((a: { id: string }) => ({
                            user_id: a.id,
                            title: '🚨 Payment Fraud Alert',
                            message: alert.pattern_description,
                            type: 'fraud_alert',
                        }));

                        await supabase.from('notifications').insert(notifications);
                    }
                }
            }
        }

        // Log the analysis run
        await supabase.from('audit_logs').insert({
            user_id: '00000000-0000-0000-0000-000000000000',
            action: 'payment_pattern_analysis_run',
            resource_type: 'fraud_pattern_alerts',
            details: {
                payments_analyzed: recentPayments.length,
                patterns_detected: alerts.length,
                alerts_created: alertsCreated,
                run_date: now.toISOString(),
            },
        });

        return new Response(JSON.stringify({
            message: 'Pattern analysis complete',
            payments_analyzed: recentPayments.length,
            patterns_detected: alerts.length,
            alerts_created: alertsCreated,
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Pattern Analyzer Error:', error);
        return new Response(JSON.stringify({
            error: 'Pattern analysis failed',
            details: String(error),
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
