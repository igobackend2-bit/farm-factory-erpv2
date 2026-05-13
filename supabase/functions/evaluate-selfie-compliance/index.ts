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

// SELFIE COMPLIANCE EVALUATION
// Runs daily at 8 PM IST
// Checks: Morning Selfie (by 9:30 AM), Lunch Selfie (1-2 PM), Evening Selfie (6:30-7:30 PM)
// Rule: If ANY selfie is late or missing = 0.25 LOP (single LOP, not stacking)

interface SelfieComplianceResult {
  userId: string;
  name: string;
  morningStatus: 'on_time' | 'late' | 'missing';
  lunchStatus: 'on_time' | 'late' | 'missing';
  eveningStatus: 'on_time' | 'late' | 'missing';
  lopCreated: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: Validate authorization - REJECT if unauthorized
    const authHeader = req.headers.get('Authorization');
    const cronSecret = req.headers.get('X-Cron-Secret');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const expectedCronSecret = Deno.env.get('CRON_SECRET');

    // Check for valid authentication: either service role key or cron secret
    const hasValidServiceKey = authHeader && authHeader.includes(serviceKey.substring(0, 20));
    const hasValidCronSecret = expectedCronSecret && cronSecret === expectedCronSecret;

    if (!hasValidServiceKey && !hasValidCronSecret) {
      console.error('Unauthorized access attempt to evaluate-selfie-compliance');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid or missing authentication' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

    console.log(`📸 Running Selfie Compliance Evaluation for: ${dateStr}`);

    // Get all active employees (excluding CEO, admin)
    const { data: employees, error: empError } = await adminClient
      .from("profiles")
      .select("id, name, role, email")
      .eq("is_active", true)
      .not("role", "in", '("ceo","CEO","admin","ADMIN","auditor","AUDITOR")');

    if (empError) {
      console.error("Error fetching employees:", empError);
      throw empError;
    }

    // Get all active shift users to EXCLUDE from fixed-time selfie compliance
    const { data: shiftUserData, error: shiftError } = await adminClient
      .from("shift_user_assignments")
      .select("user_id")
      .eq("is_active", true);

    if (shiftError) {
      console.error("Error fetching shift users:", shiftError);
    }

    const shiftUserIds = new Set(shiftUserData?.map(s => s.user_id) || []);
    console.log(`🔄 Excluding ${shiftUserIds.size} shift users from fixed-time selfie compliance`);

    // Filter out shift users from processing  
    const regularEmployees = (employees || []).filter(emp => !shiftUserIds.has(emp.id));

    console.log(`📋 Evaluating ${regularEmployees.length} regular (non-shift) employees for selfie compliance`);

    const results: SelfieComplianceResult[] = [];

    // Define selfie deadlines (IST) - Updated per business requirements
    // Morning: Must be submitted by 10:15 AM
    // Lunch: Must be submitted by 2:45 PM  
    // Evening: Must be submitted by 5:45 PM

    const MORNING_DEADLINE_HOUR = 10;
    const MORNING_DEADLINE_MIN = 15;
    const LUNCH_DEADLINE_HOUR = 14;
    const LUNCH_DEADLINE_MIN = 50;
    const EVENING_DEADLINE_HOUR = 17;
    const EVENING_DEADLINE_MIN = 50;

    for (const employee of regularEmployees) {
      // Fetch all selfie records for this employee on this date
      const { data: selfies, error: selfieError } = await adminClient
        .from("selfie_records")
        .select("selfie_type, captured_at")
        .eq("user_id", employee.id)
        .eq("date", dateStr);

      if (selfieError) {
        console.error(`Error fetching selfies for ${employee.name}:`, selfieError);
        continue;
      }

      // Create a map of selfie types
      const selfieMap = new Map<string, Date>();
      for (const selfie of selfies || []) {
        selfieMap.set(selfie.selfie_type, new Date(selfie.captured_at));
      }

      // Helper function to convert UTC to IST minutes
      const getISTMinutes = (date: Date): number => {
        const istDate = new Date(date.getTime() + (5.5 * 60 * 60 * 1000));
        return (istDate.getUTCHours() * 60) + istDate.getUTCMinutes();
      };

      // Check morning selfie - deadline 10:15 AM
      let morningStatus: 'on_time' | 'late' | 'missing' = 'missing';
      const morningSelfie = selfieMap.get('morning') || selfieMap.get('login') || selfieMap.get('morning_login');
      if (morningSelfie) {
        const selfieMinutes = getISTMinutes(morningSelfie);
        const deadlineMinutes = (MORNING_DEADLINE_HOUR * 60) + MORNING_DEADLINE_MIN;
        morningStatus = selfieMinutes <= deadlineMinutes ? 'on_time' : 'late';
      }

      // Check lunch selfie - deadline 2:45 PM
      let lunchStatus: 'on_time' | 'late' | 'missing' = 'missing';
      const lunchSelfie = selfieMap.get('lunch') || selfieMap.get('afternoon_break');
      if (lunchSelfie) {
        const selfieMinutes = getISTMinutes(lunchSelfie);
        const deadlineMinutes = (LUNCH_DEADLINE_HOUR * 60) + LUNCH_DEADLINE_MIN;
        lunchStatus = selfieMinutes <= deadlineMinutes ? 'on_time' : 'late';
      }

      // Check evening selfie - deadline 5:45 PM
      let eveningStatus: 'on_time' | 'late' | 'missing' = 'missing';
      const eveningSelfie = selfieMap.get('evening') || selfieMap.get('logout') || selfieMap.get('evening_break');
      if (eveningSelfie) {
        const selfieMinutes = getISTMinutes(eveningSelfie);
        const deadlineMinutes = (EVENING_DEADLINE_HOUR * 60) + EVENING_DEADLINE_MIN;
        eveningStatus = selfieMinutes <= deadlineMinutes ? 'on_time' : 'late';
      }

      console.log(`👤 ${employee.name}: Morning=${morningStatus}, Lunch=${lunchStatus}, Evening=${eveningStatus}`);

      // Check if ANY selfie is late or missing
      const hasViolation = morningStatus !== 'on_time' ||
        lunchStatus !== 'on_time' ||
        eveningStatus !== 'on_time';

      if (hasViolation) {
        // Check if LOP already exists for this date from selfie compliance
        const { data: existingLOP } = await adminClient
          .from("lop_entries")
          .select("id")
          .eq("employee_id", employee.id)
          .eq("lop_date", dateStr)
          .eq("source", "SYSTEM_SELFIE")
          .maybeSingle();

        if (!existingLOP) {
          // Create single 0.25 LOP for ANY selfie violation (not stacking)
          const violations = [];
          if (morningStatus !== 'on_time') violations.push(`Morning: ${morningStatus}`);
          if (lunchStatus !== 'on_time') violations.push(`Lunch: ${lunchStatus}`);
          if (eveningStatus !== 'on_time') violations.push(`Evening: ${eveningStatus}`);

          const { error: lopError } = await adminClient
            .from("lop_entries")
            .insert({
              employee_id: employee.id,
              created_by: employee.id,
              lop_date: dateStr,
              lop_type: "0.1_day",
              reason: `Selfie Compliance Failure: ${violations.join(', ')}`,
              auto_reason: `Auto-generated by Selfie Compliance Check. Any late/missing selfie = 0.1 LOP (single, not stacking)`,
              evidence_url: "SYSTEM_AUTO",
              source: "SYSTEM_SELFIE",
              status: "approved",
            });

          if (lopError) {
            console.error(`Error creating LOP for ${employee.name}:`, lopError);
          } else {
            console.log(`✅ LOP created for ${employee.name}: 0.25 day (selfie violation)`);
          }

          results.push({
            userId: employee.id,
            name: employee.name,
            morningStatus,
            lunchStatus,
            eveningStatus,
            lopCreated: !lopError,
          });
        } else {
          console.log(`⏭️ Selfie LOP already exists for ${employee.name} on ${dateStr}`);
        }
      }
    }

    console.log(`✅ Selfie compliance evaluation complete. ${results.length} employees with violations.`);

    // Notify HR/Admin
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
          type: "selfie_compliance",
          title: "Daily Selfie Compliance Report",
          message: `${results.length} employee(s) have selfie compliance issues for ${dateStr}. 0.25 LOP auto-generated.`,
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
        rule: "Any late/missing selfie = 0.1 LOP (single, not stacking)",
        details: results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Selfie compliance error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
