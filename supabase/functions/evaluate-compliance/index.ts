import { createClient } from "@supabase/supabase-js";

declare const Deno: {
  serve: (handler: (req: Request) => Promise<Response>) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

// PILLAR A: Login Time Compliance - Nightly Evaluation
// Runs every day at 8:00 PM IST (scheduled via Supabase cron)
// Evaluates all active employees for:
// - Login Time Compliance (10:16-11:00 -> 0.25 LOP, 11:01-12:00 -> 0.50 LOP)
// NOTE: Pillar B (Hourly Report Compliance) is now handled by immediate database trigger

interface ComplianceResult {
  userId: string;
  name: string;
  violations: string[];
  loginLopCreated: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Security: Validate service role token or cron secret
    const authHeader = req.headers.get('Authorization');
    const cronSecret = req.headers.get('X-Cron-Secret') || req.headers.get('x-cron-secret');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const expectedCronSecret = Deno.env.get('CRON_SECRET') || '';

    const bearerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : '';

    const hasValidServiceToken = !!serviceKey && bearerToken === serviceKey;
    const hasValidCronSecret = !!expectedCronSecret && cronSecret === expectedCronSecret;

    if (!hasValidServiceToken && !hasValidCronSecret) {
      console.warn('Unauthorized access attempt to evaluate-compliance');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for optional date parameter
    let requestedDate: string | null = null;
    try {
      const body = await req.json() as any;
      if (body.date && typeof body.date === 'string') {
        requestedDate = body.date;
      }
    } catch {
      // No body or invalid JSON, use today's date
    }

    // Get date in IST (use requested date or today)
    const now = new Date();
    // IST is UTC+5:30
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    const dateStr = requestedDate || istDate.toISOString().split('T')[0];

    console.log(`🕗 Running Login Time Compliance Evaluation for: ${dateStr}`);

    // Get all active employees (excluding CEO, admin roles)
    const { data: employees, error: empError } = await adminClient
      .from("profiles")
      .select("id, name, role, email")
      .eq("is_active", true)
      .not("role", "in", '("ceo","CEO","admin","ADMIN","auditor","AUDITOR")');

    if (empError) {
      console.error("Error fetching employees:", empError);
      throw empError;
    }

    // Get all active shift users to EXCLUDE from fixed-time login compliance
    const { data: shiftUserData, error: shiftError } = await adminClient
      .from("shift_user_assignments")
      .select("user_id")
      .eq("is_active", true);

    if (shiftError) {
      console.error("Error fetching shift users:", shiftError);
    }

    const shiftUserIds = new Set(shiftUserData?.map(s => s.user_id) || []);
    console.log(`🔄 Excluding ${shiftUserIds.size} shift users from fixed-time login compliance`);

    // Filter out shift users from processing
    const regularEmployees = (employees || []).filter(emp => !shiftUserIds.has(emp.id));

    console.log(`📋 Evaluating ${regularEmployees.length} regular (non-shift) employees`);

    const results: ComplianceResult[] = [];

    // Evaluate each employee (only regular employees, not shift users)
    for (const employee of regularEmployees) {
      // 1. Fetch Existing LOPs to avoid double-penalizing
      const { data: existingLOPs } = await adminClient
        .from("lop_entries")
        .select("lop_type, source")
        .eq("employee_id", employee.id)
        .eq("lop_date", dateStr);

      // Rule: If user has a 1-day LOP (from SYSTEM_ABSENT), skip
      const hasFullDayLOP = existingLOPs?.some((l: any) => l.lop_type === "1_day");

      if (hasFullDayLOP) {
        console.log(`⏭️ Skipping ${employee.name}: Already has 1-day LOP for ${dateStr}`);
        continue;
      }

      let loginLopCreated = false;
      const violations: string[] = [];

      // 2. EVALUATE PILLAR A: Login Time Compliance
      const { data: dayStart } = await adminClient
        .from("day_starts")
        .select("submitted_at")
        .eq("user_id", employee.id)
        .eq("date", dateStr)
        .maybeSingle();

      if (dayStart) {
        const loginTime = new Date(dayStart.submitted_at);
        const istLogin = new Date(loginTime.getTime() + istOffset);
        const hours = istLogin.getUTCHours();
        const minutes = istLogin.getUTCMinutes();

        const totalMinutes = (hours * 60) + minutes;
        const cutoff1015 = (10 * 60) + 15;
        const cutoff1100 = (11 * 60) + 0;
        const cutoff1200 = (12 * 60) + 0;

        let lopType = "";
        let reason = "";

        if (totalMinutes > cutoff1015 && totalMinutes <= cutoff1100) {
          lopType = "0.25_day";
          reason = `Late Login (10:16-11:00 AM) - Logged in at ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} IST`;
        } else if (totalMinutes > cutoff1100 && totalMinutes <= cutoff1200) {
          lopType = "0.5_day";
          reason = `Severe Late Login (11:01 AM-12:00 PM) - Logged in at ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} IST`;
        }

        if (lopType) {
          const hasLoginLOP = existingLOPs?.some((l: any) => l.source === "SYSTEM_TIME_TRAP");

          if (!hasLoginLOP) {
            const { error: loginError } = await adminClient
              .from("lop_entries")
              .insert({
                employee_id: employee.id,
                created_by: employee.id,
                lop_date: dateStr,
                lop_type: lopType,
                reason: reason,
                auto_reason: `Auto-generated by Login Time Compliance Evaluation (Pillar A). Threshold: 10:15 cutoff.`,
                evidence_url: "SYSTEM_AUTO",
                source: "SYSTEM_TIME_TRAP",
                status: "approved",
              });

            if (loginError) {
              console.error(`Error creating login LOP for ${employee.name}:`, loginError);
            } else {
              loginLopCreated = true;
              violations.push(`Late Login: ${reason}`);
              console.log(`✅ Login LOP created for ${employee.name}: ${lopType}`);
            }
          }
        }
      }

      if (loginLopCreated) {
        results.push({
          userId: employee.id,
          name: employee.name,
          violations,
          loginLopCreated,
        });
      }
    }

    console.log(`✅ Login compliance evaluation complete. ${results.length} violations found.`);

    // Create summary notification for HR/Admin
    if (results.length > 0) {
      const { data: hrAdmins } = await adminClient
        .from("profiles")
        .select("id, role")
        .in("role", ["hr", "HR", "admin", "ADMIN", "boi", "BOI"])
        .eq("is_active", true);

      for (const admin of hrAdmins || []) {
        await adminClient.from("notifications").insert({
          user_id: admin.id,
          role: admin.role,
          type: "compliance_report",
          title: "Daily Login Compliance Report",
          message: `${results.length} employee(s) have login time violations for ${dateStr}. LOPs auto-generated.`,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: dateStr,
        totalEmployees: employees?.length || 0,
        violationsFound: results.length,
        rule: "Login Time: 10:16-11:00 (0.25 LOP), 11:01-12:00 (0.50 LOP)",
        note: "Hourly report compliance is now handled by immediate database trigger",
        details: results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Compliance evaluation error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
