import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WeeklyScoreData {
    userId: string;
    userName: string;
    department: string;
    dailyScores: Array<{ date: string; score: number; status: string }>;
    avgScore: number;
    trend: 'improving' | 'stable' | 'declining';
}

function buildWeeklyPrompt(employees: WeeklyScoreData[], weekStart: string, weekEnd: string): string {
    const employeeSummaries = employees.map(e =>
        `- ${e.userName} (${e.department}): Avg ${e.avgScore.toFixed(0)}/100, Trend: ${e.trend}, Days: ${e.dailyScores.length}`
    ).join('\n');

    const deptGroups: Record<string, number[]> = {};
    employees.forEach(e => {
        if (!deptGroups[e.department]) deptGroups[e.department] = [];
        deptGroups[e.department].push(e.avgScore);
    });

    const deptSummary = Object.entries(deptGroups).map(([dept, scores]) => {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        return `- ${dept}: ${avg.toFixed(0)}/100 avg (${scores.length} employees)`;
    }).join('\n');

    return `You are the Chief Productivity Analyst for IGO Group. Analyze this week's employee compliance data and provide strategic predictions.

WEEK: ${weekStart} to ${weekEnd}
TOTAL EMPLOYEES ANALYZED: ${employees.length}

EMPLOYEE PERFORMANCE:
${employeeSummaries}

DEPARTMENT SUMMARY:
${deptSummary}

Provide a comprehensive weekly analysis. Return ONLY valid JSON:
{
  "orgTrend": "improving" | "stable" | "declining",
  "orgPrediction": "<2-3 sentence prediction for next week>",
  "atRiskEmployees": [
    {"userId": "<id>", "reason": "<why at risk>", "riskLevel": "high" | "medium"}
  ],
  "topPerformers": [
    {"userId": "<id>", "highlight": "<what they did well>"}
  ],
  "departmentInsights": {
    "<dept>": "<1 sentence insight>"
  },
  "recommendedActions": [
    {"priority": "high" | "medium" | "low", "action": "<specific action>", "target": "management" | "hr" | "employees"}
  ],
  "fullAnalysis": "<3-4 paragraph executive summary covering: overall trends, concerns, opportunities, and recommendations>"
}`;
}

function calculateTrend(scores: number[]): 'improving' | 'stable' | 'declining' {
    if (scores.length < 2) return 'stable';
    const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
    const secondHalf = scores.slice(Math.floor(scores.length / 2));
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    if (avgSecond - avgFirst > 5) return 'improving';
    if (avgFirst - avgSecond > 5) return 'declining';
    return 'stable';
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    const startTime = Date.now();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Calculate week boundaries (Sunday to Saturday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek - 7); // Last week's Sunday
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // Last week's Saturday

    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    console.log(`[weekly-ai-predictions] Generating predictions for ${weekStartStr} to ${weekEndStr}`);

    try {
        // Check if prediction already exists for this week
        const { data: existing } = await supabase
            .from('ai_weekly_predictions')
            .select('id')
            .eq('week_start', weekStartStr)
            .single();

        if (existing) {
            console.log('[weekly-ai-predictions] Prediction already exists for this week');
            return new Response(
                JSON.stringify({ message: 'Prediction already exists', weekStart: weekStartStr }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Fetch all scores for the week
        const { data: weeklyScores, error: scoresError } = await supabase
            .from('ai_employee_scores')
            .select('user_id, date, ai_score, ai_status')
            .gte('date', weekStartStr)
            .lte('date', weekEndStr);

        if (scoresError) throw scoresError;

        if (!weeklyScores || weeklyScores.length === 0) {
            console.log('[weekly-ai-predictions] No scores found for this week');
            return new Response(
                JSON.stringify({ message: 'No scores for this week', weekStart: weekStartStr }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Fetch profiles for the scored users
        const userIds = [...new Set(weeklyScores.map(s => s.user_id))];
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, department')
            .in('id', userIds);

        // Group scores by user
        const userScoresMap = new Map<string, WeeklyScoreData>();

        for (const score of weeklyScores) {
            const profile = profiles?.find(p => p.id === score.user_id);
            if (!profile) continue;

            if (!userScoresMap.has(score.user_id)) {
                userScoresMap.set(score.user_id, {
                    userId: score.user_id,
                    userName: profile.full_name || 'Unknown',
                    department: profile.department || 'Unknown',
                    dailyScores: [],
                    avgScore: 0,
                    trend: 'stable',
                });
            }

            userScoresMap.get(score.user_id)!.dailyScores.push({
                date: score.date,
                score: score.ai_score,
                status: score.ai_status,
            });
        }

        // Calculate averages and trends
        const employees: WeeklyScoreData[] = [];
        for (const [, data] of userScoresMap) {
            const scores = data.dailyScores.map(d => d.score).sort((a, b) => a - b);
            data.avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
            data.trend = calculateTrend(data.dailyScores.map(d => d.score));
            employees.push(data);
        }

        // Calculate org-level metrics
        const orgAvgScore = employees.reduce((sum, e) => sum + e.avgScore, 0) / employees.length;

        // Call Lovable AI for predictions
        const prompt = buildWeeklyPrompt(employees, weekStartStr, weekEndStr);

        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
            },
            body: JSON.stringify({
                model: "google/gemini-3-flash-preview",
                max_tokens: 2048,
                temperature: 0.7,
                messages: [{ role: "user", content: prompt }],
            }),
        });

        if (!response.ok) {
            throw new Error(`AI API error: ${response.status}`);
        }

        const result = await response.json();
        const aiContent = result.choices?.[0]?.message?.content;

        // Parse AI response
        const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Could not parse AI response');
        }

        const parsed = JSON.parse(jsonMatch[0]);
        const processingTime = Date.now() - startTime;

        // Store the prediction
        const { error: insertError } = await supabase
            .from('ai_weekly_predictions')
            .insert({
                week_start: weekStartStr,
                week_end: weekEndStr,
                org_trend: parsed.orgTrend,
                org_avg_score: orgAvgScore,
                org_prediction: parsed.orgPrediction,
                at_risk_employees: parsed.atRiskEmployees || [],
                top_performers: parsed.topPerformers || [],
                department_insights: parsed.departmentInsights || {},
                recommended_actions: parsed.recommendedActions || [],
                full_analysis: parsed.fullAnalysis,
                processing_time_ms: processingTime,
            });

        if (insertError) throw insertError;

        console.log(`[weekly-ai-predictions] Complete in ${processingTime}ms`);

        return new Response(
            JSON.stringify({
                success: true,
                weekStart: weekStartStr,
                weekEnd: weekEndStr,
                employeesAnalyzed: employees.length,
                orgTrend: parsed.orgTrend,
                processingTimeMs: processingTime,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('[weekly-ai-predictions] Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        return new Response(
            JSON.stringify({ error: errorMessage }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
