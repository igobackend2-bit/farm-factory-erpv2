import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const today = new Date().toISOString().split('T')[0];

const SYSTEM_PROMPTS: Record<string, string> = {
  general: `You are IGO Group's ERP Intelligence Assistant. Today: ${today}
    Your goal is to provide accurate, data-driven insights from the ERP system for admins.
    Use the provided tools to query attendance, payments, and other business metrics.
    Tone: Professional, concise, and helpful.`,

  auditor: `You are IGO Group's ERP Financial Auditor AI. Today: ${today}
    Specialization: Financial oversight and payment auditing.
    Help admins identify payment bottlenecks, audit vendor requests, and monitor project budget health.
    Focus on: Pending payments, vendor patterns, and financial escalation trends.
    Tone: Precise, skeptical (in a good way), and detail-oriented.`,

  operations: `You are IGO Group's ERP HR & Operations Specialist AI. Today: ${today}
    Specialization: Workforce management and compliance.
    Focus on: Attendance patterns, geofence compliance, late logins, and team productivity.
    Help identify employees who are consistently late or missing checkpoints.
    Tone: Empathetic but firm on compliance and facts.`,

  projects: `You are IGO Group's ERP Project Orchestrator AI. Today: ${today}
    Specialization: Project execution and health.
    Focus on: Project milestones, health status, and resource bottlenecks.
    Identify projects that are at risk or falling behind schedule.
    Tone: Strategic, forward-looking, and solution-focused.`
};

// Database query functions
async function getAttendanceSummary(date: string) {
  console.log(`[ERP-AI] Fetching attendance for ${date}`);
  const { data, error } = await supabase
    .from('day_starts')
    .select(`id, user_id, date, submitted_at, location_zone, login_status,
      profiles!day_starts_user_id_fkey (name, department, role)`)
    .eq('date', date);

  if (error) throw error;
  const summary = {
    total: data?.length || 0,
    onTime: data?.filter(d => d.login_status === 'on_time').length || 0,
    late: data?.filter(d => d.login_status === 'late').length || 0,
    byDepartment: {} as Record<string, { total: number; late: number }>
  };
  data?.forEach(d => {
    const dept = (d.profiles as any)?.department || 'Unknown';
    if (!summary.byDepartment[dept]) summary.byDepartment[dept] = { total: 0, late: 0 };
    summary.byDepartment[dept].total++;
    if (d.login_status === 'late') summary.byDepartment[dept].late++;
  });
  return { type: 'attendance_summary', date, summary, count: data?.length || 0 };
}

async function getLateLogins(date: string) {
  const { data, error } = await supabase
    .from('day_starts')
    .select(`id, submitted_at, profiles!day_starts_user_id_fkey (name, department, role)`)
    .eq('date', date)
    .eq('login_status', 'late');
  if (error) throw error;
  return {
    type: 'late_logins', date, count: data?.length || 0, employees: data?.map(d => ({
      name: (d.profiles as any)?.name,
      department: (d.profiles as any)?.department,
      time: d.submitted_at
    }))
  };
}

async function getEscalationStats(startDate: string, endDate: string) {
  const [escalations, criticals] = await Promise.all([
    supabase.from('client_escalations').select('id, status, department, priority, ack_late, resolve_deadline')
      .gte('created_at', startDate).lte('created_at', endDate + 'T23:59:59'),
    supabase.from('hourly_criticals').select('id, status, department, issue_type')
      .gte('created_at', startDate).lte('created_at', endDate + 'T23:59:59')
  ]);
  if (escalations.error) throw escalations.error;
  if (criticals.error) throw criticals.error;
  const summary = {
    escalations: { total: escalations.data?.length || 0, byStatus: {} as any, breached: escalations.data?.filter(e => e.ack_late).length || 0 },
    criticals: { total: criticals.data?.length || 0, byStatus: {} as any }
  };
  return { type: 'escalation_stats', startDate, endDate, summary };
}

async function getPaymentPipeline() {
  const { data, error } = await supabase.from('payment_requests').select('id, amount, status, vendor_name, department')
    .in('status', ['pending', 'pending_gm', 'pending_ceo', 'approved']);
  if (error) throw error;
  return { type: 'payment_pipeline', count: data?.length || 0, totalAmount: data?.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) };
}

async function getProjectHealth() {
  const { data, error } = await supabase.from('projects').select('id, project_name, status, vertical, total_value, end_date')
    .in('status', ['active', 'in_progress', 'pending', 'on_hold']);
  if (error) throw error;
  return { type: 'project_health', count: data?.length || 0 };
}

async function getEmployeeStats() {
  const { data, error } = await supabase.from('profiles').select('id, department, role').eq('is_active', true);
  if (error) throw error;
  return { type: 'employee_stats', total: data?.length || 0 };
}

async function getSystemMetrics() {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [attendance, escalations, payments, projects, employees] = await Promise.all([
    getAttendanceSummary(today),
    getEscalationStats(weekAgo, today),
    getPaymentPipeline(),
    getProjectHealth(),
    getEmployeeStats()
  ]);
  return { type: 'system_metrics', today, attendance, escalations, payments, projects, employees };
}

const tools = [
  { type: "function", function: { name: "get_attendance_summary", description: "Get attendance for a date", parameters: { type: "object", properties: { date: { type: "string" } }, required: ["date"] } } },
  { type: "function", function: { name: "get_late_logins", description: "Get late logins for a date", parameters: { type: "object", properties: { date: { type: "string" } }, required: ["date"] } } },
  { type: "function", function: { name: "get_escalation_stats", description: "Get escalation stats for date range", parameters: { type: "object", properties: { start_date: { type: "string" }, end_date: { type: "string" } }, required: ["start_date", "end_date"] } } },
  { type: "function", function: { name: "get_payment_pipeline", description: "Get pending payments", parameters: { type: "object", properties: {}, required: [] } } },
  { type: "function", function: { name: "get_project_health", description: "Get project status", parameters: { type: "object", properties: {}, required: [] } } },
  { type: "function", function: { name: "get_employee_stats", description: "Get employee stats", parameters: { type: "object", properties: {}, required: [] } } },
  { type: "function", function: { name: "get_system_metrics", description: "Get all metrics for analysis", parameters: { type: "object", properties: {}, required: [] } } }
];

async function executeTool(name: string, args: Record<string, any>) {
  switch (name) {
    case "get_attendance_summary": return await getAttendanceSummary(args.date);
    case "get_late_logins": return await getLateLogins(args.date);
    case "get_escalation_stats": return await getEscalationStats(args.start_date, args.end_date);
    case "get_payment_pipeline": return await getPaymentPipeline();
    case "get_project_health": return await getProjectHealth();
    case "get_employee_stats": return await getEmployeeStats();
    case "get_system_metrics": return await getSystemMetrics();
    default: return { error: "Unknown function" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Unauthorized");

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role?.toLowerCase() !== "admin") throw new Error("Forbidden: Admin access required");

    const { messages, purpose = "general" } = await req.json();
    console.log(`[ERP-AI] Processing ${messages.length} messages for purpose: ${purpose}`);

    const systemPrompt = SYSTEM_PROMPTS[purpose] || SYSTEM_PROMPTS.general;

    // First call with tools - non-streaming for tool detection
    let result;
    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          tools,
          stream: false
        }),
      });

      if (!response.ok) {
        const status = response.status;
        console.log(`[ERP-AI] AI gateway error: ${status}`);
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI gateway error: ${status}`);
      }

      result = await response.json();
    } catch (err) {
      console.error("[ERP-AI] Failed to get tool detection response:", err);
      return await getDirectStreamingResponse(messages, systemPrompt);
    }

    const assistantMessage = result?.choices?.[0]?.message;
    if (!assistantMessage) {
      console.error("[ERP-AI] Invalid assistant message structure:", result);
      return await getDirectStreamingResponse(messages, systemPrompt);
    }

    // Handle tool calls
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      console.log(`[ERP-AI] Executing ${assistantMessage.tool_calls.length} tool calls`);

      try {
        const toolResults = await Promise.all(
          assistantMessage.tool_calls.map(async (toolCall: any) => {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              const result = await executeTool(toolCall.function.name, args);
              return { role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(result) };
            } catch (pErr) {
              console.error(`[ERP-AI] Error in tool ${toolCall.function.name}:`, pErr);
              return { role: "tool", tool_call_id: toolCall.id, content: JSON.stringify({ error: "Execution failed" }) };
            }
          })
        );

        const streamResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [{ role: "system", content: systemPrompt }, ...messages, assistantMessage, ...toolResults],
            stream: true
          }),
        });

        if (!streamResponse.ok) throw new Error(`AI gateway error during streaming: ${streamResponse.status}`);
        return new Response(streamResponse.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
      } catch (toolExecErr) {
        console.error("[ERP-AI] Tool flow failed:", toolExecErr);
        return await getDirectStreamingResponse(messages, systemPrompt);
      }
    }

    return await getDirectStreamingResponse(messages, systemPrompt);

  } catch (error) {
    console.error("[ERP-AI] Critical Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

async function getDirectStreamingResponse(messages: any[], systemPrompt: string) {
  console.log(`[ERP-AI] Streaming direct response`);
  try {
    const directStream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true
      }),
    });

    if (!directStream.ok) throw new Error(`AI gateway error: ${directStream.status}`);
    return new Response(directStream.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (err) {
    console.error("[ERP-AI] Direct streaming failed:", err);
    return new Response(JSON.stringify({ error: "Service temporarily unavailable" }), {
      status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
