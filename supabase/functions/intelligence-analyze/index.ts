import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface UnifiedActivity {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  department: string;
  role: string;
  type: 'regular' | 'shift';
  status: 'working' | 'break' | 'absent' | 'completed';
  loginTime: string | null;
  lastActiveSlot: string | null;
  complianceScore: number;
  metrics: {
    plansCount: number;
    reportsCount: number;
    lateReports: number;
    selfiesCount: number;
  };
}

interface AnalysisRequest {
  activities: UnifiedActivity[];
  analysisType: 'overview' | 'department' | 'individuals' | 'recommendations';
  date: string;
}

function buildPrompt(data: AnalysisRequest): string {
  const { activities, analysisType, date } = data;
  
  // Aggregate stats
  const totalEmployees = activities.length;
  const working = activities.filter(a => a.status === 'working').length;
  const onBreak = activities.filter(a => a.status === 'break').length;
  const absent = activities.filter(a => a.status === 'absent').length;
  const completed = activities.filter(a => a.status === 'completed').length;
  const avgScore = totalEmployees > 0 
    ? Math.round(activities.reduce((sum, a) => sum + a.complianceScore, 0) / totalEmployees) 
    : 0;
  
  // Department breakdown
  const deptStats: Record<string, { count: number; totalScore: number; names: string[] }> = {};
  activities.forEach(a => {
    if (!deptStats[a.department]) {
      deptStats[a.department] = { count: 0, totalScore: 0, names: [] };
    }
    deptStats[a.department].count++;
    deptStats[a.department].totalScore += a.complianceScore;
    if (a.complianceScore < 50) {
      deptStats[a.department].names.push(a.userName);
    }
  });
  
  // Top/Bottom performers
  const sorted = [...activities].sort((a, b) => b.complianceScore - a.complianceScore);
  const top5 = sorted.slice(0, 5);
  const bottom5 = sorted.slice(-5).reverse();
  
  // Late reports total
  const totalLateReports = activities.reduce((sum, a) => sum + a.metrics.lateReports, 0);
  
  const baseContext = `
Date: ${date}
Total Employees: ${totalEmployees}
Currently Working: ${working}
On Break: ${onBreak}
Absent: ${absent}
Completed: ${completed}
Average Compliance Score: ${avgScore}%
Total Late Reports Today: ${totalLateReports}

Department Breakdown:
${Object.entries(deptStats).map(([dept, stats]) => 
  `- ${dept}: ${stats.count} employees, avg score ${Math.round(stats.totalScore / stats.count)}%${stats.names.length > 0 ? `, Low performers: ${stats.names.join(', ')}` : ''}`
).join('\n')}

Top 5 Performers:
${top5.map(a => `- ${a.userName} (${a.department}): ${a.complianceScore}%`).join('\n')}

Bottom 5 Performers:
${bottom5.map(a => `- ${a.userName} (${a.department}): ${a.complianceScore}%`).join('\n')}
`;

  const prompts: Record<string, string> = {
    overview: `You are a workforce intelligence analyst. Analyze this employee data and provide a concise organization-wide overview.

${baseContext}

Provide a brief but insightful summary with:
1. Overall compliance assessment (1-2 sentences)
2. Key observations (3-4 bullet points)
3. Department performance table (markdown table)
4. Immediate actions needed (if any)

Use markdown formatting. Be concise and actionable.`,

    department: `You are a workforce intelligence analyst. Provide a department-by-department analysis.

${baseContext}

For each department:
1. Score assessment with status indicator (✅/⚠️/❌)
2. Key metrics (active count, avg score)
3. Notable patterns or concerns
4. Specific recommendations

Use markdown tables and formatting. Focus on actionable insights.`,

    individuals: `You are a workforce intelligence analyst. Analyze individual employee performance.

${baseContext}

Provide:
1. Top Performers section - highlight what makes them effective
2. Watch List - employees needing attention with specific reasons
3. Patterns observed in high vs low performers
4. Recognition recommendations

Use markdown formatting. Be specific with names and scores.`,

    recommendations: `You are a workforce intelligence analyst. Provide actionable improvement recommendations.

${baseContext}

Structure your response as:
1. Immediate Actions (Today) - 2-3 specific, actionable items
2. Short-term Improvements (This Week) - 2-3 items
3. Systemic Patterns Observed - trends that need addressing
4. System/Process Suggestions - automation or policy ideas

Be specific, practical, and prioritize by impact. Use markdown formatting.`
  };

  return prompts[analysisType] || prompts.overview;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { activities, analysisType, date } = await req.json() as AnalysisRequest;
    
    if (!activities || !Array.isArray(activities)) {
      throw new Error('Invalid activities data');
    }

    const prompt = buildPrompt({ activities, analysisType, date });
    
    console.log(`[intelligence-analyze] Processing ${analysisType} for ${activities.length} employees`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        max_tokens: 1024,
        stream: true,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[intelligence-analyze] API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`AI API error: ${response.status}`);
    }

    // Stream SSE response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;
                
                try {
                  const parsed = JSON.parse(data);
                  // OpenAI-compatible format from Lovable AI Gateway
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: content })}\n\n`));
                  }
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          }
        } catch (e) {
          console.error('[intelligence-analyze] Stream error:', e);
        } finally {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('[intelligence-analyze] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
