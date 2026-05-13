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

// SHIFT USER LOP CALCULATOR
// Runs daily at 11:00 PM IST (5:30 PM UTC)
// Processes YESTERDAY's data and applies LOPs for TODAY
//
// Condition A: No shift login for 24 hours → 1 day LOP
// Condition B: Missing more than 3 hourly reports (out of 8) → 0.25 day LOP
//
// IMPORTANT: Week-off users are ALWAYS skipped first
// IMPORTANT: Shift users are EXCLUDED from all other compliance functions

interface Violation {
    user: string;
    userId: string;
    type: string;
    source: string;
    reason: string;
}

interface ProcessingError {
    user: string;
    userId: string;
    error: string;
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        // Security: Validate authorization
        const authHeader = req.headers.get('Authorization');
        const cronSecret = req.headers.get('X-Cron-Secret');
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const expectedCronSecret = Deno.env.get('CRON_SECRET');

        const hasValidServiceKey = authHeader && authHeader.includes(serviceKey.substring(0, 20));
        const hasValidCronSecret = expectedCronSecret && cronSecret === expectedCronSecret;

        if (!hasValidServiceKey && !hasValidCronSecret) {
            console.warn('⚠️ Unauthorized access attempt to shift-lop-calculator');
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const adminClient = createClient(supabaseUrl, supabaseServiceKey);

        // Parse request body for optional date override (for testing)
        let requestedDate: string | null = null;
        try {
            const body = await req.json() as any;
            if (body.date && typeof body.date === 'string') {
                requestedDate = body.date;
            }
        } catch {
            // No body or invalid JSON — use yesterday's date
        }

        // Calculate dates in IST
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istNow = new Date(now.getTime() + istOffset);

        // Yesterday in IST (the date we CHECK for violations)
        const istYesterday = new Date(istNow);
        istYesterday.setUTCDate(istYesterday.getUTCDate() - 1);
        const yesterdayStr = requestedDate || istYesterday.toISOString().split('T')[0];

        // LOP should be applied for the date the violation occurred (yesterday)
        const lopApplyDate = yesterdayStr;

        console.log(`🚀 ════════════════════════════════════════════════`);
        console.log(`🚀 SHIFT LOP CALCULATOR — Starting`);
        console.log(`🚀 Processing date: ${yesterdayStr}`);
        console.log(`🚀 LOP applied for: ${lopApplyDate}`);
        console.log(`🚀 Timestamp: ${now.toISOString()}`);
        console.log(`🚀 ════════════════════════════════════════════════`);

        // ─── STEP 1: Fetch all active shift users ───────────────────────
        const { data: shiftAssignments, error: shiftError } = await adminClient
            .from("shift_user_assignments")
            .select("user_id, target_hours")
            .eq("is_active", true);

        if (shiftError) {
            console.error("❌ Error fetching shift assignments:", shiftError);
            throw shiftError;
        }

        if (!shiftAssignments || shiftAssignments.length === 0) {
            console.log("📊 No active shift users found. Exiting.");
            return new Response(
                JSON.stringify({
                    success: true,
                    timestamp: now.toISOString(),
                    date_processed: yesterdayStr,
                    lop_applied_for_date: lopApplyDate,
                    stats: { total_shift_users: 0, processed: 0, week_off_skipped: 0, violations_found: 0, lops_created: 0, errors: 0 },
                    violations: [],
                    errors: [],
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const shiftUserIds = shiftAssignments.map(s => s.user_id);
        const userTargetHoursMap = Object.fromEntries(shiftAssignments.map(s => [s.user_id, s.target_hours || 9]));

        // Fetch profiles for shift users
        const { data: shiftProfiles, error: profileError } = await adminClient
            .from("profiles")
            .select("id, name, email, department")
            .in("id", shiftUserIds)
            .eq("is_active", true);

        if (profileError) {
            console.error("❌ Error fetching shift user profiles:", profileError);
            throw profileError;
        }

        const shiftUsers = shiftProfiles || [];
        console.log(`👥 Found ${shiftUsers.length} active shift users to process`);

        // ─── STEP 2: Batch-fetch week-off assignments for yesterday ─────
        const istYesterdayDate = new Date(yesterdayStr + 'T00:00:00Z');
        const dayOfWeek = istYesterdayDate.getUTCDay(); // 0=Sun, 6=Sat

        // One-time week offs
        const { data: oneTimeWeekOffs } = await adminClient
            .from("week_off_assignments")
            .select("employee_id")
            .eq("week_off_date", yesterdayStr)
            .eq("assignment_type", "one_time")
            .eq("is_active", true);

        // Recurring weekly week offs
        const { data: recurringWeekOffs } = await adminClient
            .from("week_off_assignments")
            .select("employee_id")
            .eq("recurring_day", dayOfWeek)
            .eq("assignment_type", "recurring_weekly")
            .eq("is_active", true);

        const weekOffUserIds = new Set([
            ...(oneTimeWeekOffs?.map(w => w.employee_id) || []),
            ...(recurringWeekOffs?.map(w => w.employee_id) || []),
        ]);

        console.log(`🏖️ ${weekOffUserIds.size} users have week-off on ${yesterdayStr} (day=${dayOfWeek})`);

        // ─── STEP 3: Batch-fetch existing LOPs to prevent duplicates ────
        const { data: existingShiftLOPs } = await adminClient
            .from("lop_entries")
            .select("employee_id, source")
            .eq("lop_date", lopApplyDate)
            .in("source", ["SYSTEM_SHIFT_NO_LOGIN", "SYSTEM_SHIFT_REPORTS", "SYSTEM_SHIFT_LOGOUT"]);

        const existingLopSet = new Set(
            (existingShiftLOPs || []).map(l => `${l.employee_id}:${l.source}`)
        );

        // ─── STEP 4: Process each shift user sequentially ───────────────
        const violations: Violation[] = [];
        const errors: ProcessingError[] = [];
        let weekOffSkipped = 0;
        let lopsCreated = 0;
        let processed = 0;

        for (const user of shiftUsers) {
            try {
                processed++;

                // ── 4a. Week-off check FIRST (non-negotiable) ──
                if (weekOffUserIds.has(user.id)) {
                    console.log(`🏖️ ${user.name} — On week-off, SKIPPING`);
                    weekOffSkipped++;
                    continue;
                }

                // ── 4b. CONDITION A: No shift login for 24 hours ──
                const { data: shiftSessions, error: sessError } = await adminClient
                    .from("shift_sessions")
                    .select("id, status, target_hours")
                    .eq("user_id", user.id)
                    .eq("date", yesterdayStr)
                    .order('created_at', { ascending: false });

                if (sessError) {
                    console.error(`❌ Error checking shift sessions for ${user.name}:`, sessError);
                    errors.push({ user: user.name, userId: user.id, error: `Shift session query failed: ${sessError.message}` });
                    continue;
                }

                const hasNoLogin = !shiftSessions || shiftSessions.length === 0;

                if (hasNoLogin) {
                    const dupKey = `${user.id}:SYSTEM_SHIFT_NO_LOGIN`;
                    if (existingLopSet.has(dupKey)) {
                        console.log(`⏭️ ${user.name} — No-login LOP already exists for ${lopApplyDate}, skipping`);
                    } else {
                        // Create 1-day LOP
                        const reason = "Absent - No shift login recorded";
                        const { data: lopEntry, error: lopError } = await adminClient
                            .from("lop_entries")
                            .insert({
                                employee_id: user.id,
                                created_by: user.id,
                                lop_date: lopApplyDate,
                                lop_type: "1_day",
                                reason: reason,
                                auto_reason: `Auto-generated by Shift LOP Calculator. No shift_sessions record found for ${yesterdayStr}.`,
                                evidence_url: "SYSTEM_AUTO",
                                source: "SYSTEM_SHIFT_NO_LOGIN",
                                status: "approved",
                            })
                            .select("id")
                            .single();

                        if (lopError) {
                            console.error(`❌ Error creating no-login LOP for ${user.name}:`, lopError);
                            errors.push({ user: user.name, userId: user.id, error: `No-login LOP insert failed: ${lopError.message}` });
                        } else {
                            lopsCreated++;
                            violations.push({ user: user.name, userId: user.id, type: "1_day", source: "SYSTEM_SHIFT_NO_LOGIN", reason });
                            console.log(`📋 ${user.name} — 1 Day LOP created (no shift login)`);

                            // Audit log
                            await adminClient.from("audit_logs").insert({
                                action: "LOP_AUTO_CREATED",
                                record_type: "lop_entry",
                                record_id: lopEntry?.id || null,
                                performed_by: null,
                                performed_by_name: "SYSTEM",
                                performed_by_role: "system",
                                remarks: `Automated shift user LOP: ${reason}`,
                                before_state: null,
                                after_state: { lop_type: "1_day", source: "SYSTEM_SHIFT_NO_LOGIN", lop_date: lopApplyDate, employee_name: user.name },
                            }).then(({ error }) => {
                                if (error) console.error(`❌ Audit log error for ${user.name}:`, error);
                            });

                            // Notifications (3 targets)
                            await sendShiftLopNotifications(adminClient, user, lopEntry?.id, "1_day", reason, lopApplyDate);
                        }
                    }

                    // If no login at all, skip other checks
                    continue;
                }

                // ── 4c. CONDITION B: Missing Logout Selfie (Active sessions from yesterday) ──
                const activeSessions = shiftSessions.filter(s => s.status === 'active');
                if (activeSessions.length > 0) {
                    const dupKey = `${user.id}:SYSTEM_SHIFT_LOGOUT`;
                    if (existingLopSet.has(dupKey)) {
                        console.log(`⏭️ ${user.name} — Logout LOP already exists for ${lopApplyDate}, skipping`);
                    } else {
                        const reason = "Missing logout selfie / shift not ended properly";
                        const { data: lopEntry, error: lopError } = await adminClient
                            .from("lop_entries")
                            .insert({
                                employee_id: user.id,
                                created_by: user.id,
                                lop_date: lopApplyDate,
                                lop_type: "0.25_day",
                                reason: reason,
                                auto_reason: `Auto-generated by Shift LOP Calculator. Shift session started on ${yesterdayStr} was never ended.`,
                                evidence_url: "SYSTEM_AUTO",
                                source: "SYSTEM_SHIFT_LOGOUT",
                                status: "approved",
                            })
                            .select("id")
                            .single();

                        if (lopError) {
                            console.error(`❌ Error creating logout LOP for ${user.name}:`, lopError);
                        } else {
                            lopsCreated++;
                            violations.push({ user: user.name, userId: user.id, type: "0.25_day", source: "SYSTEM_SHIFT_LOGOUT", reason });
                            console.log(`📋 ${user.name} — 0.25 Day LOP created (missing logout)`);

                            // Auto-close the open sessions and mark slots as missed
                            for (const sess of activeSessions) {
                                // 1. Mark session as incomplete
                                await adminClient
                                    .from("shift_sessions")
                                    .update({ 
                                        status: 'incomplete', 
                                        updated_at: new Date().toISOString(),
                                        shift_end: new Date(yesterdayStr + 'T23:59:59Z').toISOString() // Force end at end of that day
                                    })
                                    .eq("id", sess.id);
                                    
                                // 2. Mark any open slots as missed
                                await adminClient
                                    .from("shift_hourly_slots")
                                    .update({ status: 'missed', updated_at: new Date().toISOString() })
                                    .eq("session_id", sess.id)
                                    .in("status", ["pending", "plan_submitted"]);
                            }

                            // Notifications
                            await sendShiftLopNotifications(adminClient, user, lopEntry?.id, "0.25_day", reason, lopApplyDate);
                        }
                    }
                }

                // ── 4d. CONDITION C: Missing more than 3 reports ──
                // Check shift_hourly_slots for the session(s) of yesterday
                let totalReports = 0;
                let targetHours = userTargetHoursMap[user.id] || 9;
                
                for (const session of shiftSessions) {
                    const { data: slots, error: slotError } = await adminClient
                        .from("shift_hourly_slots")
                        .select("id")
                        .eq("session_id", session.id)
                        .eq("status", "report_submitted");

                    if (!slotError && slots) {
                        totalReports += slots.length;
                    }
                    if (session.target_hours) targetHours = session.target_hours;
                }

                const expectedReports = targetHours - 1; // 9 hour shift = 8 reports
                const missedReports = Math.max(0, expectedReports - totalReports);

                if (missedReports > 3) {
                    const dupKey = `${user.id}:SYSTEM_SHIFT_REPORTS`;
                    if (existingLopSet.has(dupKey)) {
                        console.log(`⏭️ ${user.name} — Report LOP already exists for ${lopApplyDate}, skipping`);
                    } else {
                        const reason = `Missed more than 3 hourly reports (${missedReports} missed out of ${expectedReports})`;
                        const { data: lopEntry, error: lopError } = await adminClient
                            .from("lop_entries")
                            .insert({
                                employee_id: user.id,
                                created_by: user.id,
                                lop_date: lopApplyDate,
                                lop_type: "0.25_day",
                                reason: reason,
                                auto_reason: `Auto-generated by Shift LOP Calculator. Only ${totalReports}/${expectedReports} reports submitted for ${yesterdayStr}.`,
                                evidence_url: "SYSTEM_AUTO",
                                source: "SYSTEM_SHIFT_REPORTS",
                                status: "approved",
                            })
                            .select("id")
                            .single();

                        if (lopError) {
                            console.error(`❌ Error creating report LOP for ${user.name}:`, lopError);
                            errors.push({ user: user.name, userId: user.id, error: `Report LOP insert failed: ${lopError.message}` });
                        } else {
                            lopsCreated++;
                            violations.push({ user: user.name, userId: user.id, type: "0.25_day", source: "SYSTEM_SHIFT_REPORTS", reason });
                            console.log(`📋 ${user.name} — 0.25 Day LOP created (${missedReports} reports missed)`);

                            // Audit log
                            await adminClient.from("audit_logs").insert({
                                action: "LOP_AUTO_CREATED",
                                record_type: "lop_entry",
                                record_id: lopEntry?.id || null,
                                performed_by: null,
                                performed_by_name: "SYSTEM",
                                performed_by_role: "system",
                                remarks: `Automated shift user LOP: ${reason}`,
                                before_state: null,
                                after_state: { lop_type: "0.25_day", source: "SYSTEM_SHIFT_REPORTS", lop_date: lopApplyDate, employee_name: user.name, reports_submitted: totalReports },
                            }).then(({ error }) => {
                                if (error) console.error(`❌ Audit log error for ${user.name}:`, error);
                            });

                            // Notifications
                            await sendShiftLopNotifications(adminClient, user, lopEntry?.id, "0.25_day", reason, lopApplyDate);
                        }
                    }
                } else {
                    console.log(`✅ ${user.name} — Compliant (${totalReports}/${expectedReports} reports, ${missedReports} missed ≤ 3)`);
                }

            } catch (userError: unknown) {
                const msg = userError instanceof Error ? userError.message : "Unknown error";
                console.error(`🚨 Unexpected error processing ${user.name}:`, msg);
                errors.push({ user: user.name, userId: user.id, error: msg });
            }
        }

        // ─── STEP 5: Final Summary ──────────────────────────────────────
        const summary = {
            success: true,
            timestamp: now.toISOString(),
            date_processed: yesterdayStr,
            lop_applied_for_date: lopApplyDate,
            stats: {
                total_shift_users: shiftUsers.length,
                processed,
                week_off_skipped: weekOffSkipped,
                violations_found: violations.length,
                lops_created: lopsCreated,
                errors: errors.length,
            },
            violations: violations.map(v => ({ user: v.user, type: v.type, reason: v.reason })),
            errors: errors.map(e => ({ user: e.user, error: e.error })),
        };

        console.log(`📊 ════════════════════════════════════════════════`);
        console.log(`📊 SHIFT LOP CALCULATOR — Complete`);
        console.log(`📊 Total shift users: ${summary.stats.total_shift_users}`);
        console.log(`📊 Processed: ${summary.stats.processed}`);
        console.log(`📊 Week-off skipped: ${summary.stats.week_off_skipped}`);
        console.log(`📊 Violations found: ${summary.stats.violations_found}`);
        console.log(`📊 LOPs created: ${summary.stats.lops_created}`);
        console.log(`📊 Errors: ${summary.stats.errors}`);
        console.log(`📊 ════════════════════════════════════════════════`);

        return new Response(
            JSON.stringify(summary),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error: unknown) {
        console.error("🚨 Shift LOP Calculator fatal error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        return new Response(
            JSON.stringify({ success: false, error: message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});

// ─── Helper: Send 3 notifications (User + HR + Admin) ─────────────
async function sendShiftLopNotifications(
    client: any,
    user: { id: string; name: string },
    lopEntryId: string | null,
    lopType: string,
    reason: string,
    lopDate: string,
) {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Notify the affected user
    await client.from("notifications").insert({
        user_id: user.id,
        type: "lop_approved",
        title: "LOP Applied",
        message: `${lopType} LOP has been applied: ${reason} on ${lopDate}`,
        related_record_id: lopEntryId,
        expires_at: expiresAt,
    }).then(({ error }: any) => {
        if (error) console.error(`❌ Notification error (user ${user.name}):`, error);
        else console.log(`🔔 Notified user: ${user.name}`);
    });

    // 2. Notify HR (role-based)
    await client.from("notifications").insert({
        role: "hr",
        type: "lop_approved",
        title: "Shift User LOP Created",
        message: `${lopType} LOP created for ${user.name}: ${reason}`,
        related_record_id: lopEntryId,
        expires_at: expiresAt,
    }).then(({ error }: any) => {
        if (error) console.error(`❌ Notification error (HR for ${user.name}):`, error);
        else console.log(`🔔 Notified HR about ${user.name}`);
    });

    // 3. Notify Admin (role-based)
    await client.from("notifications").insert({
        role: "admin",
        type: "lop_approved",
        title: "Shift User LOP Created",
        message: `${lopType} LOP created for ${user.name}: ${reason}`,
        related_record_id: lopEntryId,
        expires_at: expiresAt,
    }).then(({ error }: any) => {
        if (error) console.error(`❌ Notification error (Admin for ${user.name}):`, error);
        else console.log(`🔔 Notified Admin about ${user.name}`);
    });
}
