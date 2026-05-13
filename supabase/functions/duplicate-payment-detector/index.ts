import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
import { crypto } from "std/crypto";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ─── Utility Functions ───

function normalizeVendorName(name: string): string {
    return name
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\b(pvt|private|ltd|limited|llp|inc|corp|co|company)\b/g, '')
        .trim();
}

async function md5Hash(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('MD5', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hash(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function levenshteinSimilarity(a: string, b: string): number {
    const an = a.length;
    const bn = b.length;
    if (an === 0) return bn === 0 ? 100 : 0;
    if (bn === 0) return 0;
    const matrix: number[][] = [];
    for (let i = 0; i <= bn; i++) matrix[i] = [i];
    for (let j = 0; j <= an; j++) matrix[0][j] = j;
    for (let i = 1; i <= bn; i++) {
        for (let j = 1; j <= an; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    const maxLen = Math.max(an, bn);
    return Math.round(((maxLen - matrix[bn][an]) / maxLen) * 100);
}

interface DetectionResult {
    rule: string;
    confidence: number;
    matched_payment_id: string;
    matched_vendor: string;
    matched_amount: number;
    matched_date: string;
}

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

        interface RequestBody {
            vendor_name: string;
            amount: number;
            account_number?: string;
            ifsc?: string;
            upi?: string;
            bill_url?: string;
            requester_id: string;
            date?: string;
        }

        const {
            vendor_name,
            amount,
            account_number,
            ifsc,
            upi,
            bill_url,
            requester_id,
            date,
        } = await req.json() as RequestBody;

        if (!vendor_name || !amount || !requester_id) {
            return new Response(JSON.stringify({ error: 'Missing required fields: vendor_name, amount, requester_id' }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const paymentDate = date || new Date().toISOString().split('T')[0];
        const normalizedVendor = normalizeVendorName(vendor_name);
        const vendorFingerprint = await md5Hash(normalizedVendor);
        const accountFingerprint = account_number && ifsc
            ? await md5Hash(`${account_number.trim()}:${ifsc.trim().toUpperCase()}`)
            : null;
        const upiFingerprint = upi ? await md5Hash(upi.trim().toLowerCase()) : null;
        const billUrlHash = bill_url ? await sha256Hash(bill_url.trim()) : null;

        // Lookback window: 30 days
        const lookbackDate = new Date();
        lookbackDate.setDate(lookbackDate.getDate() - 30);
        const lookbackStr = lookbackDate.toISOString().split('T')[0];

        const matches: DetectionResult[] = [];

        // ─── Rule 1: Same-day exact duplicate (vendor + amount + date) ───
        const { data: exactMatches } = await supabase
            .from('payment_deduplication_registry')
            .select('payment_request_id, amount, payment_date')
            .eq('vendor_fingerprint', vendorFingerprint)
            .eq('amount', amount)
            .eq('payment_date', paymentDate)
            .eq('status', 'active')
            .limit(5);

        if (exactMatches?.length) {
            for (const m of exactMatches) {
                matches.push({
                    rule: 'exact_same_day_duplicate',
                    confidence: 100,
                    matched_payment_id: m.payment_request_id,
                    matched_vendor: vendor_name,
                    matched_amount: m.amount,
                    matched_date: m.payment_date,
                });
            }
        }

        // ─── Rule 2: Invoice/bill URL hash duplicate ───
        if (billUrlHash) {
            const { data: billMatches } = await supabase
                .from('payment_deduplication_registry')
                .select('payment_request_id, amount, payment_date')
                .eq('bill_url_hash', billUrlHash)
                .gte('payment_date', lookbackStr)
                .eq('status', 'active')
                .limit(5);

            if (billMatches?.length) {
                for (const m of billMatches) {
                    matches.push({
                        rule: 'invoice_hash_duplicate',
                        confidence: 100,
                        matched_payment_id: m.payment_request_id,
                        matched_vendor: vendor_name,
                        matched_amount: m.amount,
                        matched_date: m.payment_date,
                    });
                }
            }
        }

        // ─── Rule 3: Bank account duplicate (account + amount ±5%) ───
        if (accountFingerprint) {
            const amtLow = amount * 0.95;
            const amtHigh = amount * 1.05;
            const { data: acctMatches } = await supabase
                .from('payment_deduplication_registry')
                .select('payment_request_id, amount, payment_date')
                .eq('account_fingerprint', accountFingerprint)
                .gte('amount', amtLow)
                .lte('amount', amtHigh)
                .gte('payment_date', lookbackStr)
                .eq('status', 'active')
                .limit(5);

            if (acctMatches?.length) {
                for (const m of acctMatches) {
                    matches.push({
                        rule: 'bank_account_duplicate',
                        confidence: 95,
                        matched_payment_id: m.payment_request_id,
                        matched_vendor: vendor_name,
                        matched_amount: m.amount,
                        matched_date: m.payment_date,
                    });
                }
            }
        }

        // ─── Rule 4: UPI duplicate (upi ID + amount ±5%) ───
        if (upiFingerprint) {
            const amtLow = amount * 0.95;
            const amtHigh = amount * 1.05;
            const { data: upiMatches } = await supabase
                .from('payment_deduplication_registry')
                .select('payment_request_id, amount, payment_date')
                .eq('upi_fingerprint', upiFingerprint)
                .gte('amount', amtLow)
                .lte('amount', amtHigh)
                .gte('payment_date', lookbackStr)
                .eq('status', 'active')
                .limit(5);

            if (upiMatches?.length) {
                for (const m of upiMatches) {
                    matches.push({
                        rule: 'upi_duplicate',
                        confidence: 95,
                        matched_payment_id: m.payment_request_id,
                        matched_vendor: vendor_name,
                        matched_amount: m.amount,
                        matched_date: m.payment_date,
                    });
                }
            }
        }

        // ─── Rule 5: Fuzzy vendor name match (Levenshtein ≥85%) ───
        // Get recent vendor fingerprints and compare
        const { data: recentPayments } = await supabase
            .from('payment_requests')
            .select('id, vendor_name, amount, created_at')
            .gte('created_at', lookbackStr)
            .neq('requester_id', '__skip__') // fetch all
            .order('created_at', { ascending: false })
            .limit(200);

        if (recentPayments?.length) {
            const amtLow = amount * 0.95;
            const amtHigh = amount * 1.05;
            for (const rp of recentPayments) {
                if (!rp.vendor_name) continue;
                const rpNorm = normalizeVendorName(rp.vendor_name);
                if (rpNorm === normalizedVendor) continue; // skip exact (caught by Rule 1)
                const similarity = levenshteinSimilarity(normalizedVendor, rpNorm);
                if (similarity >= 85 && rp.amount >= amtLow && rp.amount <= amtHigh) {
                    // Avoid duplicate entries for same payment
                    if (!matches.find(m => m.matched_payment_id === rp.id)) {
                        matches.push({
                            rule: 'fuzzy_vendor_match',
                            confidence: similarity,
                            matched_payment_id: rp.id,
                            matched_vendor: rp.vendor_name,
                            matched_amount: rp.amount,
                            matched_date: rp.created_at.split('T')[0],
                        });
                    }
                }
            }
        }

        // ─── Rule 6: Requester pattern (>5 same day OR >3 same vendor in 7 days) ───
        const { data: sameDayCount } = await supabase
            .from('payment_requests')
            .select('id', { count: 'exact', head: true })
            .eq('requester_id', requester_id)
            .gte('created_at', `${paymentDate}T00:00:00`)
            .lte('created_at', `${paymentDate}T23:59:59`);

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const { data: sameVendor7d } = await supabase
            .from('payment_requests')
            .select('id')
            .eq('requester_id', requester_id)
            .ilike('vendor_name', `%${vendor_name.substring(0, Math.min(vendor_name.length, 20))}%`)
            .gte('created_at', sevenDaysAgo.toISOString())
            .limit(10);

        if ((sameDayCount as any)?.length > 5 || (sameVendor7d?.length || 0) > 3) {
            matches.push({
                rule: 'requester_pattern_anomaly',
                confidence: 60,
                matched_payment_id: requester_id,
                matched_vendor: vendor_name,
                matched_amount: amount,
                matched_date: paymentDate,
            });
        }

        // ─── Calculate overall result ───
        const isDuplicate = matches.length > 0;
        const maxConfidence = isDuplicate
            ? Math.max(...matches.map(m => m.confidence))
            : 0;

        let recommendation: 'allow' | 'warn' | 'flag' = 'allow';
        if (maxConfidence >= 90) recommendation = 'flag';
        else if (maxConfidence >= 60) recommendation = 'warn';

        return new Response(JSON.stringify({
            is_duplicate: isDuplicate,
            confidence: maxConfidence,
            recommendation,
            matches: matches.map(m => ({
                ...m,
                matched_vendor: m.matched_vendor || 'Unknown',
            })),
            fingerprints: {
                vendor: vendorFingerprint,
                account: accountFingerprint,
                upi: upiFingerprint,
                bill_url: billUrlHash,
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });





    } catch (error) {
        console.error('Payment Guardian Error:', error);

        // FAIL OPEN: if detection fails, allow payment to proceed
        return new Response(JSON.stringify({
            is_duplicate: false,
            confidence: 0,
            recommendation: 'allow',
            matches: [],
            error: 'Detection service temporarily unavailable',
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
