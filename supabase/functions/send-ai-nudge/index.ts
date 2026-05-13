import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NudgeRequest {
    userId: string;
    userName: string;
    currentScore: number;
    currentStatus: string;
    missingItems: string[];
    hour: number;
}

interface NudgeResponse {
    nudgeType: 'reminder' | 'motivation' | 'alert' | 'coaching';
    message: string;
    targetAudience: 'employee' | 'manager' | 'both';
    triggerReason: string;
}

function buildNudgePrompt(data: NudgeRequest): string {
    const timeOfDay = data.hour < 12 ? 'morning' : data.hour < 17 ? 'afternoon' : 'evening';

    return `You are a friendly workplace assistant for IGO Group. Generate a SHORT, encouraging nudge notification.

EMPLOYEE: ${data.userName}
CURRENT SCORE: ${data.currentScore}/100
STATUS: ${data.currentStatus}
TIME: ${timeOfDay} (${data.hour}:00)

MISSING ITEMS TODAY:
${data.missingItems.length > 0 ? data.missingItems.map(i => `- ${i}`).join('\n') : '- Nothing missing!'}

NUDGE RULES:
1. Score >= 80: Send MOTIVATION (celebrate good work)
2. Score 60-79: Send gentle REMINDER (encourage improvement)
3. Score < 60 by 3 PM: Send COACHING tip
4. Score < 40 OR missing 3+ items: Also send manager ALERT

Generate a nudge message that is:
- SHORT (max 50 words for employee, max 30 words for manager)
- FRIENDLY and encouraging (use 1-2 relevant emoji)
- SPECIFIC about what to improve (if applicable)
- NOT preachy or condescending

Return ONLY valid JSON:
{
  "nudgeType": "reminder" | "motivation" | "alert" | "coaching",
  "message": "<employee message>",
  "managerMessage": "<manager alert if needed, otherwise null>",
  "targetAudience": "employee" | "manager" | "both",
  "triggerReason": "<brief reason for this nudge>"
}`;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        const nudgeRequest: NudgeRequest = await req.json();

        console.log(`[send-ai-nudge] Generating nudge for ${nudgeRequest.userName} (score: ${nudgeRequest.currentScore})`);

        // Don't send nudges for high performers
        if (nudgeRequest.currentScore >= 85 && nudgeRequest.missingItems.length === 0) {
            // Occasional motivation only
            if (Math.random() > 0.3) {
                return new Response(
                    JSON.stringify({ skipped: true, reason: 'High performer, no nudge needed' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }
        }

        const prompt = buildNudgePrompt(nudgeRequest);

        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
            },
            body: JSON.stringify({
                model: "google/gemini-3-flash-preview",
                max_tokens: 256,
                temperature: 0.8,
                messages: [{ role: "user", content: prompt }],
            }),
        });

        if (!response.ok) {
            throw new Error(`AI API error: ${response.status}`);
        }

        const result = await response.json();
        const aiResponse = result.choices?.[0]?.message?.content;

        // Parse AI response
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Could not parse nudge response');
        }

        const parsed = JSON.parse(jsonMatch[0]);
        const today = new Date().toISOString().split('T')[0];

        // Store employee nudge
        const { error: nudgeError } = await supabase
            .from('ai_nudges')
            .insert({
                user_id: nudgeRequest.userId,
                date: today,
                nudge_type: parsed.nudgeType,
                trigger_reason: parsed.triggerReason,
                message: parsed.message,
                target_audience: parsed.targetAudience,
                ai_score_at_trigger: nudgeRequest.currentScore,
                hour_of_day: nudgeRequest.hour,
            });

        if (nudgeError) {
            console.error('[send-ai-nudge] Error storing nudge:', nudgeError);
        }

        console.log(`[send-ai-nudge] ${nudgeRequest.userName}: ${parsed.nudgeType} nudge sent`);

        return new Response(
            JSON.stringify({
                success: true,
                nudge: parsed,
                userId: nudgeRequest.userId,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('[send-ai-nudge] Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        return new Response(
            JSON.stringify({ error: errorMessage }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
