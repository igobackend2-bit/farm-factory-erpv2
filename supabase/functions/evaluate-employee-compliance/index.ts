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
    date: string;
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
}

function buildPrompt(data: EmployeeData): string {
    const now = new Date();
    const currentHour = now.getHours();
    const expectedReports = Math.max(0, Math.min(8, currentHour - 10)); // 10 AM - 6 PM

    return `You are a Senior Strategic Performance Auditor for IGO Group. Your mission is to provide a "PERFECT" evaluation of this employee's productivity based on raw activity data. Use logic, context, and behavioral analysis to determine the true value of their work today.

EMPLOYEE: ${data.userName}
DEPARTMENT: ${data.department}
DATE: ${data.date}
CURRENT TIME: ${now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}

═══════════════════════════════════════════════════
WORK CONTEXT & RAW DATA
═══════════════════════════════════════════════════
• Login: ${data.loginTime || '❌ ABSENT'} 
• Lunch Check: ${data.lunchSelfieTime || '❌ MISSING'}
• Logout Check: ${data.eveningSelfieTime || '⌛ IN PROGRESS'}

• DECLARED DAY GOAL: 
  ${data.dayPlan ? `"${data.dayPlan}"` : '❌ NO STRATEGIC DIRECTION SET'}

• HOURLY EXECUTION (${data.hourlyPlans.length} plans, ${data.hourlyReports.length} reports):
${data.hourlyReports.length > 0
            ? data.hourlyReports.map((r: any, i: number) => `  [Slot ${r.time}] Plan: "${data.hourlyPlans[i]?.plan || 'N/A'}" -> Actual: "${r.summary}"`).join('\n')
            : '  ❌ NO HOURLY MOVEMENT DETECTED'}

• FINAL OUTCOME:
  ${data.eodSummary ? `"${data.eodSummary}"` : '⌛ EOD SUMMARY PENDING'}

═══════════════════════════════════════════════════
AUDIT SCORING CATEGORIES (100pts TOTAL)
═══════════════════════════════════════════════════

1. STRATEGIC ALIGNMENT (0-30 points):
   - Did the hourly work actually contribute to the Day Plan?
   - Is there a logical progression throughout the day?
   - Score high for clear results, low for vague phrases like "worked as per plan".

2. EXECUTION QUALITY (0-30 points):
   - Are reports detailed or perfunctory?
   - Compare "Plan" vs "Actual". Did they follow through or drift?
   - Identify "filler" reporting (repetitive or generic entries).

3. DISCIPLINE & VELOCITY (0-20 points):
   - Punctuality of login and lunch snapshots.
   - Reporting cadence (is everyone slot filled or are there gaps?).
   - Speed of reporting relative to current time.

4. BEHAVIORAL SENTIMENT (0-20 points):
   - Is the employee showing ownership or just ticking boxes?
   - Detection of "Idle Patterns" (e.g., reports with identical text over multiple hours).
   - Professionalism of the EOD synthesis.

═══════════════════════════════════════════════════
RESPONSE SPECIFICATION (JSON ONLY)
═══════════════════════════════════════════════════
{
  "score": <0-100 based on the above criteria>,
  "status": "working_productively" | "idle" | "needs_attention",
  "analysis": "<Audit summary: Be sharp, professional, and analytical. Identify exactly WHERE they are winning or failing. Mention specific slots if they have issues. No generic feedback.>",
  "breakdown": {
    "punctuality": <0-25>,
    "planQuality": <0-25>,
    "reportQuality": <0-25>,
    "consistency": <0-25>
  }
}

NOTE: A score above 85 is rare and requires exceptional detail. A score below 40 indicates major gaps in either visibility or actual work presence.`;
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        const employeeData = (await req.json()) as any;
        const startTime = Date.now();

        console.log(`[evaluate-employee-compliance] Analyzing ${employeeData.userName}`);

        // 1. Fetch Dynamic Config
        let aiModel = "google/gemini-1.5-flash"; // Default
        let fallbackModel = "google/gemini-1.5-pro";
        let systemPrompt = null;
        let temperature = 0.7;
        let maxTokens = 1024;
        let provider = 'google';
        let apiKey = Deno.env.get("LOVABLE_API_KEY");

        const { data: config } = await supabase
            .from('ai_config')
            .select('*')
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();
        if (config) {
            // 0. Check Global Kill Switch
            if (config.is_active === false) {
                console.warn('[evaluate-employee-compliance] GLOBAL KILL SWITCH ACTIVE. Aborting execution.');
                return new Response(
                    JSON.stringify({
                        score: 0,
                        status: 'needs_attention',
                        analysis: 'AI Evaluation Suspended by Governance Control.',
                        breakdown: { punctuality: 0, planQuality: 0, reportQuality: 0, consistency: 0 }
                    }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            aiModel = config.model_id || aiModel;
            fallbackModel = config.fallback_model_id || fallbackModel;
            systemPrompt = config.system_prompt || null;
            temperature = Number(config.temperature) || temperature;
            provider = config.provider || provider;

            if (config.api_key && config.api_key.length > 5) {
                apiKey = config.api_key;
            }

            if (config.settings) {
                const settings = typeof config.settings === 'string'
                    ? JSON.parse(config.settings)
                    : config.settings;
                if (settings.max_tokens) maxTokens = Number(settings.max_tokens);
            }
        }

        const userPrompt = buildPrompt(employeeData);
        const messages: any[] = [];

        if (systemPrompt) {
            messages.push({ role: "system", content: systemPrompt });
        }
        messages.push({ role: "user", content: userPrompt });

        // 2. AI Execution with Fallback Logic
        let result = null;
        let currentModel = aiModel;
        let isFallbackUsed = false;
        let errorMsg = null;

        const callAI = async (modelName: string) => {
            const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: modelName,
                    max_tokens: maxTokens,
                    temperature: temperature,
                    messages: messages,
                }),
            });

            if (!resp.ok) {
                const errText = await resp.text();
                throw new Error(`AI API error (${resp.status}): ${errText}`);
            }
            return await resp.json();
        };

        try {
            console.log(`[evaluate-employee-compliance] Attempting with primary: ${aiModel}`);
            result = await callAI(aiModel);
        } catch (primaryError: any) {
            console.error(`[evaluate-employee-compliance] Primary model failed:`, primaryError.message);
            if (fallbackModel && fallbackModel !== aiModel) {
                console.log(`[evaluate-employee-compliance] Retrying with fallback: ${fallbackModel}`);
                isFallbackUsed = true;
                currentModel = fallbackModel;
                try {
                    result = await callAI(fallbackModel);
                } catch (fallbackError: any) {
                    console.error(`[evaluate-employee-compliance] Fallback model also failed:`, fallbackError.message);
                    errorMsg = `All models failed. Primary: ${primaryError.message}. Fallback: ${fallbackError.message}`;
                }
            } else {
                errorMsg = primaryError.message;
            }
        }

        if (errorMsg) throw new Error(errorMsg);

        const aiResponseText = (result as any).choices?.[0]?.message?.content;
        if (!aiResponseText) throw new Error('Empty AI response');

        // Parse AI response - extract JSON
        const jsonMatch = aiResponseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error('[evaluate-employee-compliance] Invalid response:', aiResponseText);
            throw new Error('Could not parse AI response as JSON');
        }

        const parsed: AIScoreResult = JSON.parse(jsonMatch[0]);
        const duration = Date.now() - startTime;

        // 3. Log Usage to ai_usage_logs
        try {
            await supabase.from('ai_usage_logs').insert({
                function_name: 'evaluate-employee-compliance',
                provider: provider,
                model: currentModel,
                tokens_input: Math.ceil((userPrompt.length + (systemPrompt?.length || 0)) / 4),
                tokens_output: Math.ceil(aiResponseText.length / 4),
                duration_ms: duration,
                status: 'success',
                meta: {
                    userId: employeeData.userId,
                    isFallbackUsed,
                    primaryModel: aiModel
                }
            });
        } catch (logErr: any) {
            console.error('[evaluate-employee-compliance] Failed to log usage:', logErr?.message || logErr);
        }

        console.log(`[evaluate-employee-compliance] ${employeeData.userName}: ${parsed.score}/100 (${parsed.status}) in ${duration}ms [Fallback: ${isFallbackUsed}]`);

        return new Response(
            JSON.stringify({
                userId: employeeData.userId,
                date: employeeData.date,
                ...parsed,
                metadata: {
                    duration_ms: duration,
                    model: currentModel,
                    isFallback: isFallbackUsed,
                    timestamp: new Date().toISOString()
                }
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            }
        );

    } catch (error: any) {
        console.error('[evaluate-employee-compliance] Fatal Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        return new Response(
            JSON.stringify({ error: errorMessage }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
