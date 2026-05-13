import "https://deno.land/x/xhr@0.1.0/mod.ts";
// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: {
    env: {
        get(key: string): string | undefined;
    };
};

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmployeeData {
    userId: string;
    userName: string;
    department: string;
    loginTime: string | null;
    dayPlan: string | null;
    hourlyPlans: Array<{ time: string; plan: string }>;
    hourlyReports: Array<{ time: string; summary: string }>;
    lunchSelfieTime: string | null;
    eveningSelfieTime: string | null;
    eodSummary: string | null;
}

interface AIScoreResult {
    score: number;
    status: 'working_productively' | 'idle' | 'needs_attention';
    analysis: string;
    breakdown: {
        punctuality: number;
        planQuality: number;
        reportQuality: number;
        consistency: number;
    };
    metadata?: {
        duration_ms: number;
    };
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // CRITICAL FIX: Use IST date for all date comparisons (not UTC!)
    const now = new Date();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now); // IST date in YYYY-MM-DD
    const currentHour = parseInt(new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        hour12: false,
        timeZone: 'Asia/Kolkata'
    }).format(now));


    // Only run during work hours (10 AM - 7 PM IST)
    if (currentHour < 10 || currentHour > 19) {
        console.log(`[hourly-ai-scoring] Outside work hours (IST hour: ${currentHour}), skipping`);
        return new Response(
            JSON.stringify({ message: 'Outside work hours', skipped: true, istHour: currentHour }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    console.log(`[hourly-ai-scoring] Starting hourly AI scoring for ${today} (IST hour: ${currentHour})`);

    try {
        // 0. Check Global Kill Switch
        const { data: configData, error: configError } = await supabase
            .from('ai_config')
            .select('is_active')
            .single();

        if (configError) {
            console.error('[hourly-ai-scoring] Failed to fetch config, defaulting to ABORT', configError);
            return new Response(
                JSON.stringify({ error: 'Config fetch failed', details: configError }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        if (!configData?.is_active) {
            console.warn('[hourly-ai-scoring] GLOBAL KILL SWITCH ACTIVE. Aborting execution.');
            return new Response(
                JSON.stringify({ message: 'AI Systems are currently DISABLED via Governance Control.', skipped: true }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 1. Get active users (those who have logged in today via selfie)
        const { data: activeSelfies, error: selfieError } = await supabase
            .from('selfie_records')
            .select('user_id, created_at, selfie_type')
            .eq('date', today);

        if (selfieError) {
            console.error(`[hourly-ai-scoring] Selfie Error:`, selfieError);
            throw selfieError;
        }

        console.log(`[hourly-ai-scoring] Found ${activeSelfies?.length || 0} total selfies for ${today}`);

        const activeUserIds = [...new Set(activeSelfies?.map((s: any) => s.user_id) || [])];
        console.log(`[hourly-ai-scoring] Found ${activeUserIds.length} unique active users`);

        if (activeUserIds.length === 0) {
            console.log('[hourly-ai-scoring] No active users today');
            return new Response(
                JSON.stringify({ message: 'No active users', today, processed: 0 }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 2. Fetch all required data for active users
        const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, full_name, department, role')
            .in('id', activeUserIds);

        if (profileError) {
            console.error(`[hourly-ai-scoring] Profile Error:`, profileError);
        }

        console.log(`[hourly-ai-scoring] Found ${profiles?.length || 0} profiles matching active user IDs`);

        const { data: dayPlans } = await supabase
            .from('day_plans')
            .select('user_id, plan_text, created_at')
            .eq('date', today)
            .in('user_id', activeUserIds);

        const { data: hourlyPlans } = await supabase
            .from('hourly_plans')
            .select('user_id, plan, hour, created_at')
            .eq('date', today)
            .in('user_id', activeUserIds);

        const { data: hourlyReports } = await supabase
            .from('hourly_reports')
            .select('user_id, summary, hour, created_at')
            .eq('date', today)
            .in('user_id', activeUserIds);

        const { data: eodReports } = await supabase
            .from('eod_reports')
            .select('user_id, summary, created_at')
            .eq('date', today)
            .in('user_id', activeUserIds);

        // 3. Process each active user
        const results: Array<{ userId: string; success: boolean; score?: number; error?: string }> = [];

        for (const profile of (profiles || [])) {
            try {
                // Get user's selfie times (using correct selfie_type values from database)
                const loginSelfie = activeSelfies?.find(
                    (s: any) => s.user_id === profile.id && s.selfie_type === 'morning_login'
                );
                const lunchSelfie = activeSelfies?.find(
                    (s: any) => s.user_id === profile.id && s.selfie_type === 'afternoon_break'
                );
                const eveningSelfie = activeSelfies?.find(
                    (s: any) => s.user_id === profile.id && s.selfie_type === 'evening_break'
                );

                // Build employee data
                const employeeData: EmployeeData = {
                    userId: profile.id,
                    userName: profile.full_name || 'Unknown',
                    department: profile.department || 'Unknown',
                    loginTime: loginSelfie?.created_at
                        ? new Date(loginSelfie.created_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
                        : null,
                    dayPlan: dayPlans?.find((d: any) => d.user_id === profile.id)?.plan_text || null,
                    hourlyPlans: (hourlyPlans || [])
                        .filter((p: any) => p.user_id === profile.id)
                        .map((p: any) => ({ time: `${p.hour}:00`, plan: p.plan })),
                    hourlyReports: (hourlyReports || [])
                        .filter((r: any) => r.user_id === profile.id)
                        .map((r: any) => ({ time: `${r.hour}:00`, summary: r.summary })),
                    lunchSelfieTime: lunchSelfie?.created_at
                        ? new Date(lunchSelfie.created_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
                        : null,
                    eveningSelfieTime: eveningSelfie?.created_at
                        ? new Date(eveningSelfie.created_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
                        : null,
                    eodSummary: eodReports?.find((e: any) => e.user_id === profile.id)?.summary || null,
                };

                // Call AI evaluation edge function
                const aiResponse = await fetch(`${supabaseUrl}/functions/v1/evaluate-employee-compliance`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${supabaseKey}`,
                        'apikey': supabaseKey,
                    },
                    body: JSON.stringify({ ...employeeData, date: today }),
                });

                if (!aiResponse.ok) {
                    throw new Error(`AI evaluation failed: ${aiResponse.status}`);
                }

                const aiResult = (await aiResponse.json()) as AIScoreResult;

                // Upsert into ai_employee_scores
                const { error: upsertError } = await supabase
                    .from('ai_employee_scores')
                    .upsert({
                        user_id: profile.id,
                        date: today,
                        last_updated: new Date().toISOString(),
                        ai_score: aiResult.score,
                        ai_status: aiResult.status,
                        ai_analysis: aiResult.analysis,
                        punctuality_score: aiResult.breakdown?.punctuality || 0,
                        plan_quality_score: aiResult.breakdown?.planQuality || 0,
                        report_quality_score: aiResult.breakdown?.reportQuality || 0,
                        consistency_score: aiResult.breakdown?.consistency || 0,
                        ai_call_duration_ms: aiResult.metadata?.duration_ms || 0,
                        analysis_timestamp: new Date().toISOString(),
                    }, {
                        onConflict: 'user_id,date',
                    });

                if (upsertError) throw upsertError;

                results.push({ userId: profile.id, success: true, score: aiResult.score });
                console.log(`[hourly-ai-scoring] ${profile.full_name}: ${aiResult.score}/100 (${aiResult.status})`);

                // === PHASE 2: Trigger nudge for low scores ===
                const shouldNudge = aiResult.score < 70 || aiResult.status === 'needs_attention';
                const missingItems: string[] = [];

                if (!employeeData.dayPlan) missingItems.push('Day Plan');
                if (employeeData.hourlyPlans.length < Math.max(0, currentHour - 10)) missingItems.push('Hourly Plans');
                if (employeeData.hourlyReports.length < Math.max(0, currentHour - 10)) missingItems.push('Hourly Reports');
                if (currentHour >= 14 && !employeeData.lunchSelfieTime) missingItems.push('Lunch Selfie');

                if (shouldNudge || missingItems.length >= 2) {
                    try {
                        await fetch(`${supabaseUrl}/functions/v1/send-ai-nudge`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${supabaseKey}`,
                            },
                            body: JSON.stringify({
                                userId: profile.id,
                                userName: profile.full_name,
                                currentScore: aiResult.score,
                                currentStatus: aiResult.status,
                                missingItems,
                                hour: currentHour,
                            }),
                        });
                        console.log(`[hourly-ai-scoring] Nudge sent to ${profile.full_name}`);
                    } catch (nudgeError) {
                        console.error(`[hourly-ai-scoring] Nudge failed for ${profile.full_name}:`, nudgeError);
                    }
                }

                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 200));

            } catch (userError) {
                const errorMsg = userError instanceof Error ? userError.message : 'Unknown error';
                results.push({ userId: profile.id, success: false, error: errorMsg });
                console.error(`[hourly-ai-scoring] Error for ${profile.full_name}:`, errorMsg);
            }
        }

        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        console.log(`[hourly-ai-scoring] Complete: ${successful} successful, ${failed} failed`);

        return new Response(
            JSON.stringify({
                message: 'Hourly AI scoring complete',
                date: today,
                totalActive: activeUserIds.length,
                processed: successful,
                failed: failed,
                results: results,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error: any) {
        console.error('[hourly-ai-scoring] Error:', error?.message || error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        return new Response(
            JSON.stringify({ error: errorMessage }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
