// @ts-nocheck - Deno Edge Function
/// <reference types="https://esm.sh/@supabase/supabase-js@2.49.1" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Get the authorization header from the request
    console.log(`Incoming request: ${req.method}`);
    const authHeader = req.headers.get("Authorization");
    console.log(`Auth header present: ${!!authHeader}`);

    if (authHeader) {
      console.log(`Auth header starts with Bearer: ${authHeader.startsWith("Bearer ")}`);
    } else {
      console.log("Auth header is missing");
    }

    if (!authHeader?.startsWith("Bearer ")) {
      console.error("Missing or invalid authorization header");
      return new Response(
        JSON.stringify({ error: "Missing or invalid authorization header", receivedHeader: authHeader }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's JWT to verify they're authenticated
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    console.log("Supabase client created. Attempting getUser...");

    // Validate the JWT using getUser (Safer than getClaims)
    const { data: { user: requestingUser }, error: authError } = await supabaseClient.auth.getUser();

    if (authError) {
      console.error("getUser error:", authError);
    }
    if (!requestingUser) {
      console.error("No user found in token");
    }

    if (authError || !requestingUser) {
      console.error("JWT validation failed:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid token", details: authError }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`User authenticated: ${requestingUser.id}`);

    const requestingUserId = requestingUser.id;
    if (!requestingUserId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - No user ID in token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the user is an admin
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("role, name")
      .eq("id", requestingUserId)
      .single();

    if (profileError || !profile) {
      console.error("Profile fetch error:", profileError);
      return new Response(
        JSON.stringify({ error: "Failed to verify user role" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userRole = profile.role.toLowerCase();
    if (userRole !== "admin" && userRole !== "ceo") {
      return new Response(
        JSON.stringify({ error: "Only admins and CEOs can delete users" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the user ID to delete from the request body
    const { userId } = await req.json();
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "User ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prevent self-deletion
    if (userId === requestingUserId) {
      return new Response(
        JSON.stringify({ error: "Cannot delete your own account" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the user to be deleted for audit log
    const { data: targetUser } = await supabaseClient
      .from("profiles")
      .select("name, email, role")
      .eq("id", userId)
      .single();

    // Create admin client with service role to delete related records and user
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    console.log(`Starting deletion of user ${userId} and related records...`);

    // --- STEP 1: DELETE Records (where the column is NOT NULL or deletion is preferred) ---
    const tablesToDelete = [
      { table: "hr_attestations", column: "employee_id" },
      { table: "late_reasons", column: "user_id" },
      { table: "late_reasons", column: "employee_id" },
      { table: "reversal_requests", column: "employee_id" },
      { table: "leave_requests", column: "employee_id" },
      { table: "lop_entries", column: "employee_id" },
      { table: "lop_audit_logs", column: "employee_id" },
      { table: "payment_requests", column: "requester_id" },
      { table: "purchase_orders", column: "requester_id" },
      { table: "work_orders", column: "requester_id" },
      { table: "notifications", column: "user_id" },
      { table: "inventory_usage_logs", column: "logged_by" },
      { table: "daily_farm_logs", column: "reported_by" },
      { table: "harvest_records", column: "recorded_by" },
      { table: "farm_manager_remarks", column: "created_by" },
      { table: "purchase_progress_logs", column: "updated_by" },
      { table: "material_requests", column: "requested_by" },
      { table: "daily_site_updates", column: "reported_by" },
      { table: "vendor_work_requests", column: "requested_by" },
      { table: "vendor_ratings", column: "rated_by" },
      { table: "admin_reviews", column: "employee_id" },
      { table: "hourly_reports", column: "user_id" },
      { table: "hourly_reports", column: "reported_by" },
      { table: "hourly_plans", column: "user_id" },
      { table: "day_starts", column: "user_id" },
      { table: "day_plans", column: "user_id" },
      { table: "eod_reports", column: "user_id" },
      { table: "selfie_records", column: "user_id" },
      { table: "extra_work_entries", column: "user_id" },
      { table: "employee_issues", column: "employee_id" },
      { table: "task_assignments", column: "assigned_to" },
      // Added missing tables with NO ACTION FK constraints
      { table: "attendance_lock_overrides", column: "user_id" },
      { table: "attendance_lock_overrides", column: "admin_id" },
      { table: "attendance_lock_overrides", column: "granted_by" },
      { table: "shift_sessions", column: "user_id" },
      { table: "shift_eod_reports", column: "user_id" },
      { table: "rent_payments", column: "tenant_id" },
      { table: "rent_payments", column: "recorded_by" },
      { table: "tenant_agreements", column: "tenant_id" },
      { table: "tenant_agreements", column: "created_by" },
      { table: "room_assignments", column: "employee_id" },
      { table: "room_assignments", column: "assigned_by" },
      { table: "shift_assignment_history", column: "user_id" },
      { table: "shift_breaks", column: "user_id" },
      { table: "shift_hourly_slots", column: "user_id" },
      { table: "user_location_logs", column: "user_id" },
      { table: "travel_requests", column: "employee_id" },
      { table: "travel_claims", column: "employee_id" },
      { table: "rental_property_remarks", column: "created_by" },
    ];

    for (const { table, column } of tablesToDelete) {
      try {
        const { error } = await adminClient.from(table).delete().eq(column, userId);
        if (error) console.log(`Note: Could not delete from ${table}.${column}: ${error.message}`);
        else console.log(`Deleted records from ${table}.${column}`);
      } catch (err) {
        console.log(`Note: Error cleaning ${table}.${column}:`, err);
      }
    }

    // --- STEP 2: NULLIFY Records (where the reference should be cleared but record kept) ---
    const tablesToNullify = [
      { table: "hr_attestations", columns: ["hr_id"] },
      { table: "admin_reviews", columns: ["admin_id"] },
      { table: "late_reasons", columns: ["reviewed_by"] },
      { table: "leave_requests", columns: ["admin_reviewed_by", "hr_reviewed_by", "ceo_reviewed_by", "rejected_by"] },
      { table: "lop_entries", columns: ["created_by", "admin_verified_by", "ceo_approved_by", "reversal_admin_reviewed_by", "reversal_boi_reviewed_by", "reversal_ceo_reviewed_by"] },
      { table: "lop_audit_logs", columns: ["reversed_by"] },
      { table: "payment_requests", columns: ["admin_approved_by", "boi_approved_by", "ceo_approved_by", "accounts_executed_by", "smo_approved_by", "gmo_approved_by", "director_approved_by", "gm_approved_by"] },
      { table: "purchase_orders", columns: ["admin_approved_by", "boi_verified_by", "ceo_approved_by"] },
      { table: "work_orders", columns: ["admin_approved_by", "boi_verified_by", "ceo_approved_by"] },
      { table: "work_order_payments", columns: ["boi_verified_by", "admin_approved_by", "ceo_approved_by", "created_by"] },
      { table: "material_requests", columns: ["farm_audited_by", "assigned_auditor_id", "assigned_auditor_by", "grn_generated_by", "boi_approved_by", "admin_approved_by", "ceo_approved_by", "delivery_received_by", "assigned_to_purchase"] },
      { table: "vendor_work_requests", columns: ["assigned_to_sourcing", "smo_approved_by", "gmo_approved_by", "boi_approved_by", "admin_approved_by", "ceo_approved_by"] },
      { table: "client_escalations", columns: ["created_by", "current_owner", "acknowledged_by", "resolved_by", "gm_id", "ceo_id", "proof_submitted_by", "closure_approved_by", "assigned_to", "assigned_by", "assigned_gmo_id", "assigned_by_boi_id", "closure_admin_id", "site_visit_target_id", "raised_by_rsh_id", "assigned_layer_1_id", "assigned_layer_2_id", "assigned_layer_3_id", "closed_by_admin_id"] },
      { table: "hourly_criticals", columns: ["created_by", "acknowledged_by", "resolved_by", "proof_submitted_by", "closure_approved_by", "assigned_to", "assigned_by"] },
      { table: "projects", columns: ["assigned_engineer_id", "assigned_manager_id", "created_by", "assigned_site_manager_id", "assigned_project_engineer_id", "deal_uploaded_by", "boq_submitted_by", "boq_approved_by"] },
      { table: "project_inventory", columns: ["audited_by"] },
      { table: "cultivation_cycles", columns: ["created_by"] },
      { table: "boq_templates", columns: ["created_by"] },
      { table: "project_verticals", columns: ["created_by"] },
      { table: "project_boq", columns: ["created_by"] },
      { table: "project_execution_proofs", columns: ["uploaded_by"] },
      { table: "project_timeline", columns: ["performed_by"] },
      { table: "procurement_timeline", columns: ["performed_by"] },
      { table: "vendor_quotes", columns: ["created_by"] },
      { table: "announcements", columns: ["created_by"] },
      { table: "company_calendar", columns: ["created_by"] },
      { table: "escalations", columns: ["smo_id", "gm_id"] },
      { table: "task_comments", columns: ["user_id"] },
      { table: "task_assignments", columns: ["assigned_by"] },
      { table: "escalation_timeline", columns: ["performed_by"] },
      { table: "client_escalation_timeline", columns: ["performed_by"] },
      { table: "hourly_critical_timeline", columns: ["performed_by"] },
      { table: "audit_logs", columns: ["performed_by"] },
      // Added missing tables with NO ACTION nullify columns
      { table: "rent_payments", columns: ["approved_by"] },
      { table: "tenant_agreements", columns: ["approved_by", "ended_by"] },
      // Added site_visit_escalations
      { table: "site_visit_escalations", columns: ["raised_by_rsh_id", "site_visit_target_id", "assigned_layer_1_id", "assigned_layer_2_id", "assigned_layer_3_id", "assigned_by_boi_id", "resolved_by", "closed_by_admin_id"] },
      { table: "geofences", columns: ["created_by"] },
      { table: "travel_rate_config", columns: ["updated_by"] },
      { table: "travel_requests", columns: ["approved_by"] },
      { table: "travel_claims", columns: ["admin_reviewed_by", "ceo_reviewed_by", "paid_by"] },
      { table: "shift_user_assignments", columns: ["assigned_by"] },
    ];

    for (const { table, columns } of tablesToNullify) {
      for (const column of columns) {
        try {
          const { error } = await adminClient.from(table).update({ [column]: null }).eq(column, userId);
          if (error) console.log(`Note: Could not nullify ${table}.${column}: ${error.message}`);
          else console.log(`Nullified ${table}.${column}`);
        } catch (err) {
          console.log(`Note: Error nullifying ${table}.${column}:`, err);
        }
      }
    }

    // --- STEP 3: DELETE PROFILE AND AUTH USER ---
    // Delete the profile first (before auth.users to avoid remaining FK issues in some setups)
    const { error: profileDeleteError } = await adminClient
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (profileDeleteError) {
      console.error("Error deleting profile:", profileDeleteError);
      return new Response(
        JSON.stringify({ error: `Failed to delete profile: ${profileDeleteError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Profile deleted, now deleting auth user...");

    // Delete the user from auth.users (Admin API)
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error("Error deleting auth user:", deleteError);
      return new Response(
        JSON.stringify({ error: deleteError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- STEP 4: LOG TRANSACTION ---
    await adminClient.from("audit_logs").insert({
      action: "USER_DELETED",
      performed_by: requestingUserId,
      performed_by_name: profile.name,
      performed_by_role: "Admin",
      record_type: "profile",
      record_id: userId,
      before_state: targetUser,
      remarks: `User ${targetUser?.name || userId} (${targetUser?.email || "unknown"}) deleted permanently by admin`,
    });

    console.log(`User ${userId} deleted successfully by admin ${requestingUserId}`);

    return new Response(
      JSON.stringify({ success: true, message: "User deleted successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
