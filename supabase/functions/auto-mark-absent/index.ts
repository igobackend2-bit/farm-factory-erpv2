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

// AUTO-MARK ABSENT FUNCTION
// Runs at 12:30 PM IST daily
// If an employee hasn't logged in (no morning_login selfie) by 12 PM, mark them absent
// Also creates 1 day LOP automatically

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
      console.warn('Unauthorized access attempt to auto-mark-absent');
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
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    const dateStr = requestedDate || istDate.toISOString().split('T')[0];

    console.log(`🕐 Running Auto-Mark Absent for: ${dateStr}`);

    // Get all active employees (excluding CEO and admin-only roles)
    const { data: employees, error: empError } = await adminClient
      .from("profiles")
      .select("id, name, role, email, department")
      .eq("is_active", true)
      .not("role", "in", '("ceo","CEO","admin","ADMIN","auditor","AUDITOR","accounts","ACCOUNTS","boi","BOI")');

    if (empError) {
      console.error("Error fetching employees:", empError);
      throw empError;
    }

    // Get all active shift users to EXCLUDE from fixed-time processing
    const { data: shiftUserData, error: shiftError } = await adminClient
      .from("shift_user_assignments")
      .select("user_id")
      .eq("is_active", true);

    if (shiftError) {
      console.error("Error fetching shift users:", shiftError);
    }

    const shiftUserIds = new Set(shiftUserData?.map(s => s.user_id) || []);
    console.log(`🔄 Excluding ${shiftUserIds.size} shift users from fixed-time absent marking`);

    // Filter out shift users from processing
    const regularEmployees = (employees || []).filter(emp => !shiftUserIds.has(emp.id));

    console.log(`📋 Checking ${regularEmployees.length} regular (non-shift) employees for login status`);

    // Get all morning login selfies for today
    const { data: morningSelfies, error: selfieError } = await adminClient
      .from("selfie_records")
      .select("user_id")
      .eq("date", dateStr)
      .eq("selfie_type", "morning_login");

    if (selfieError) {
      console.error("Error fetching selfies:", selfieError);
      throw selfieError;
    }

    const loggedInUserIds = new Set(morningSelfies?.map(s => s.user_id) || []);
    console.log(`✅ ${loggedInUserIds.size} employees have logged in today`);


    // Get existing HR attestations for today
    const { data: existingAttestations, error: attError } = await adminClient
      .from("hr_attestations")
      .select("employee_id, status")
      .eq("date", dateStr);

    if (attError) {
      console.error("Error fetching attestations:", attError);
    }

    const attestedEmployeeIds = new Set(existingAttestations?.map(a => a.employee_id) || []);

    // Get ALL active week-off assignments for today (both one-time and recurring)
    // 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
    const istDayOfWeek = istDate.getUTCDay();

    // One-time week offs for today
    const { data: oneTimeWeekOffs } = await adminClient
      .from("week_off_assignments")
      .select("employee_id")
      .eq("week_off_date", dateStr)
      .eq("assignment_type", "one_time")
      .eq("is_active", true);

    // Recurring week offs for this day of week
    const { data: recurringWeekOffs } = await adminClient
      .from("week_off_assignments")
      .select("employee_id")
      .eq("recurring_day", istDayOfWeek)
      .eq("assignment_type", "recurring_weekly")
      .eq("is_active", true);

    const weekOffUserIds = new Set([
      ...(oneTimeWeekOffs?.map(w => w.employee_id) || []),
      ...(recurringWeekOffs?.map(w => w.employee_id) || [])
    ]);

    console.log(`🌴 Skipping ${weekOffUserIds.size} employees who are on weekly off today`);

    // Get existing LOP entries for today (to avoid duplicates)
    const { data: existingLOPs, error: lopCheckError } = await adminClient
      .from("lop_entries")
      .select("employee_id")
      .eq("lop_date", dateStr)
      .eq("source", "SYSTEM_ABSENT");

    if (lopCheckError) {
      console.error("Error checking existing LOPs:", lopCheckError);
    }

    const existingLOPEmployeeIds = new Set(existingLOPs?.map(l => l.employee_id) || []);

    let absentCount = 0;
    let lopCreatedCount = 0;
    const absentEmployees: { id: string; name: string; department: string }[] = [];

    // Find employees who haven't logged in (only checking regular employees, not shift users)
    for (const emp of regularEmployees) {
      // SKIP IF: Already logged in OR it's their Weekly Off
      if (loggedInUserIds.has(emp.id) || weekOffUserIds.has(emp.id)) {
        continue;
      }

      absentEmployees.push({ id: emp.id, name: emp.name, department: emp.department });

      // Auto-mark as absent if not already attested
      if (!attestedEmployeeIds.has(emp.id)) {
        const { error: attestError } = await adminClient
          .from("hr_attestations")
          .upsert({
            employee_id: emp.id,
            hr_id: emp.id, // System-generated
            date: dateStr,
            status: "Absent",
            remarks: "Auto-marked absent: No login by 12 PM",
            attested_at: new Date().toISOString(),
          }, {
            onConflict: "employee_id,date",
          });

        if (attestError) {
          console.error(`Error marking ${emp.name} absent:`, attestError);
        } else {
          absentCount++;
          console.log(`❌ ${emp.name} marked ABSENT (no login by 12 PM)`);
        }
      }

      // Create 1 day LOP if not already exists
      if (!existingLOPEmployeeIds.has(emp.id)) {
        // First, delete any existing 0.25 day LOPs for this date (from selfie/report compliance)
        // since 1 day absent replaces all partial LOPs
        await adminClient
          .from("lop_entries")
          .delete()
          .eq("employee_id", emp.id)
          .eq("lop_date", dateStr)
          .in("source", ["SYSTEM_SELFIE", "SYSTEM_REPORTS", "SYSTEM_COMPLIANCE"]);

        const { error: lopError } = await adminClient
          .from("lop_entries")
          .insert({
            employee_id: emp.id,
            created_by: emp.id,
            lop_date: dateStr,
            lop_type: "1_day",
            reason: `Auto-absent: No login recorded by 12 PM`,
            auto_reason: `System auto-generated: Employee did not log in by 12 PM cutoff`,
            evidence_url: "SYSTEM_AUTO",
            source: "SYSTEM_ABSENT",
            status: "approved",
          });

        if (lopError) {
          console.error(`Error creating LOP for ${emp.name}:`, lopError);
        } else {
          lopCreatedCount++;
          console.log(`📋 1 Day LOP created for ${emp.name} (absent)`);
        }
      }
    }

    console.log(`✅ Auto-Mark Absent complete. ${absentCount} marked absent, ${lopCreatedCount} LOPs created.`);

    // Notify HR/Admin about absent employees
    if (absentEmployees.length > 0) {
      const { data: hrAdmins } = await adminClient
        .from("profiles")
        .select("id, role")
        .in("role", ["hr", "HR", "admin", "ADMIN"])
        .eq("is_active", true);

      for (const admin of hrAdmins || []) {
        await adminClient.from("notifications").insert({
          user_id: admin.id,
          role: admin.role,
          type: "absent_alert",
          title: "Daily Absent Report",
          message: `${absentEmployees.length} employee(s) marked absent for ${dateStr} (no login by 12 PM). 1 Day LOP auto-generated.`,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: dateStr,
        totalEmployees: employees?.length || 0,
        loggedIn: loggedInUserIds.size,
        absentMarked: absentCount,
        lopCreated: lopCreatedCount,
        absentEmployees: absentEmployees.map(e => e.name),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Auto-mark absent error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
