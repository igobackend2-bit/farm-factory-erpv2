import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeptStats {
    dept: string;
    avgScore: number;
    empCount: number;
}

function buildMonthlyPrompt(stats: any): string {
    return `You are the Strategic Operations Director for IGO Group. Analyze the monthly performance data and generate an executive report.

MONTH: ${stats.monthName}
TOTAL EMPLOYEES: ${stats.totalEmployees}
OVERALL AVG COMPLIANCE SCORE: ${stats.avgScore.toFixed(1)}/100
IMPROVEMENT FROM LAST MONTH: ${stats.improvement.toFixed(1)}%

DEPARTMENT PERFORMANCE:
${stats.deptStats.map((d: any) => `- ${d.dept}: ${d.avgScore.toFixed(1)}/100 (${d.empCount} employees)`).join('\n')}

Provide a high-level executive summary and strategic analysis. Return ONLY valid JSON:
{
  "topDepartments": [
    {"dept": "<dept>", "avgScore": <score>, "reason": "<why they performed well>"}
  ],
  "strategicConcerns": [
    {"concern": "<concern>", "impact": "high" | "medium", "evidence": "<data point>"}
  ],
  "successStories": [
    {"title": "<title>", "description": "<story of improvement or excellence>"}
  ],
  "quarterlyProjection": "<1-2 sentence projection for the next quarter based on current vector>",
  "executiveSummary": "<2-3 paragraph high-level summary for the CEO>",
  "detailedAnalysis": "<3-5 paragraph deep dive into specific trends, behavioral shifts, and operational impacts>",
  "strategicRecommendations": [
    {"recommendation": "<recommendation>", "timeframe": "short-term" | "mid-term" | "long-term", "expectedROI": "<qualitative outcome>"}
  ]
}`;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    const startTime = Date.now();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Calculate month boundaries
    const now = new Date();
    const firstDayCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const monthStr = firstDayLastMonth.toISOString().split('T')[0];
    const lastDayStr = lastDayLastMonth.toISOString().split('T')[0];
    const monthName = firstDayLastMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

    console.log(`[monthly-ai-reports] Generating report for ${monthName}`);

    try {
        // Check if report already exists
        const { data: existing } = await supabase
            .from('ai_monthly_reports')
            .select('id')
            .eq('month', monthStr)
            .single();

        if (existing) {
            return new Response(
                JSON.stringify({ message: 'Report already exists', month: monthName }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Fetch all scores for the month
        const { data: monthlyScores } = await supabase
            .from('ai_employee_scores')
            .select('user_id, ai_score, ai_status')
            .gte('date', monthStr)
            .lte('date', lastDayStr);

        if (!monthlyScores || monthlyScores.length === 0) {
            return new Response(
                JSON.stringify({ message: 'No scores for this month', month: monthName }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Fetch profiles
        const userIds = [...new Set(monthlyScores.map(s => s.user_id))];
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, department')
            .in('id', userIds);

        // Aggregate statistics
        const totalAvg = monthlyScores.reduce((a, b) => a + b.ai_score, 0) / monthlyScores.length;

        const deptGroups: Record<string, { scores: number[], empIds: Set<string> }> = {};
        monthlyScores.forEach(s => {
            const profile = profiles?.find(p => p.id === s.user_id);
            const dept = profile?.department || 'Unknown';
            if (!deptGroups[dept]) deptGroups[dept] = { scores: [], empIds: new Set() };
            deptGroups[dept].scores.push(s.ai_score);
            deptGroups[dept].empIds.add(s.user_id);
        });

        const deptStats = Object.entries(deptGroups).map(([dept, data]) => ({
            dept,
            avgScore: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
            empCount: data.empIds.size
        })).sort((a, b) => b.avgScore - a.avgScore);

        // Get last month's stats for comparison
        const firstDayTwoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        const lastDayTwoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 1, 0);

        const { data: prevMonthReport } = await supabase
            .from('ai_monthly_reports')
            .select('avg_org_score')
            .eq('month', firstDayTwoMonthsAgo.toISOString().split('T')[0])
            .single();

        const improvement = prevMonthReport ? (totalAvg - (prevMonthReport.avg_org_score || totalAvg)) : 0;

        // Call AI
        const prompt = buildMonthlyPrompt({
            monthName,
            totalEmployees: userIds.length,
            avgScore: totalAvg,
            improvement,
            deptStats
        });

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
            },
            body: JSON.stringify({
                model: "google/gemini-3-flash-preview",
                max_tokens: 3000,
                temperature: 0.7,
                messages: [{ role: "user", content: prompt }],
            }),
        });

        const result = await aiRes.json();
        const content = result.choices?.[0]?.message?.content;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('AI response parsing failed');
        const parsed = JSON.parse(jsonMatch[0]);

        // Store report
        const { error: insertError } = await supabase
            .from('ai_monthly_reports')
            .insert({
                month: monthStr,
                avg_org_score: totalAvg,
                total_active_employees: userIds.length,
                improvement_from_last_month: improvement,
                top_departments: parsed.topDepartments,
                strategic_concerns: parsed.strategicConcerns,
                success_stories: parsed.successStories,
                quarterly_projection: parsed.quarterlyProjection,
                executive_summary: parsed.executiveSummary,
                detailed_analysis: parsed.detailedAnalysis,
                strategic_recommendations: parsed.strategicRecommendations,
            });

        if (insertError) throw insertError;

        return new Response(
            JSON.stringify({ success: true, month: monthName, totalAvg }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('[monthly-ai-reports] Error:', error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
