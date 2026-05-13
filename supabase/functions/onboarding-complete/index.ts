// @ts-nocheck - Deno Edge Function
/// <reference types="https://esm.sh/@supabase/supabase-js@2.49.1" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
};

/**
 * Send welcome email with credentials using Resend API
 */
async function sendWelcomeEmail(
    resendApiKey: string,
    toEmail: string,
    fullName: string,
    username: string,
    password: string
) {
    const emailSubject = "Your Login Credentials - IGO Agritech Farms";
    const emailBody = `Dear ${fullName},

You have been selected at IGO Agritech Farms.

Your login account has been created successfully.

Username: ${username}
Password: ${password}

Please login and change your password after first login.

Regards,
IGO Agritech Farms`;

    try {
        console.log(`[Email] Sending to ${toEmail}...`);
        
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${resendApiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: "IGO Agritech Farms <onboarding@resend.dev>",
                to: [toEmail],
                subject: emailSubject,
                text: emailBody,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("[Email] API error:", errorText);
            return { success: false, error: errorText };
        }

        const data = await response.json();
        console.log(`[Email] Sent successfully to ${toEmail}, id:`, data.id);
        return { success: true, data };
    } catch (error) {
        console.error("[Email] Sending error:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Check if user already exists in auth system
 */
async function checkExistingUser(adminClient: any, email: string) {
    try {
        const { data, error } = await adminClient.auth.admin.listUsers({
            filter: `email.eq.${email}`,
        });
        
        if (error) {
            console.error("[Auth] Error checking existing user:", error);
            return { exists: false, error: error.message };
        }
        
        const existingUser = data.users.find((u: any) => u.email === email);
        return { exists: !!existingUser, user: existingUser };
    } catch (error) {
        console.error("[Auth] Exception checking existing user:", error);
        return { exists: false, error: error.message };
    }
}

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    console.log("[Onboarding] ====== START REQUEST ======");
    console.log("[Onboarding] Method:", req.method);
    console.log("[Onboarding] URL:", req.url);

    try {
        // ===== ENVIRONMENT VARIABLES =====
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";

        console.log("[Onboarding] Environment check:");
        console.log("  - SUPABASE_URL:", supabaseUrl ? "SET" : "MISSING");
        console.log("  - SUPABASE_ANON_KEY:", supabaseAnonKey ? "SET" : "MISSING");
        console.log("  - SUPABASE_SERVICE_ROLE_KEY:", serviceRoleKey ? "SET" : "MISSING");
        console.log("  - RESEND_API_KEY:", resendApiKey ? "SET" : "MISSING (email will not be sent)");

        if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
            console.error("[Onboarding] CRITICAL: Missing required environment variables");
            return new Response(
                JSON.stringify({ 
                    error: "Server configuration error: Missing required environment variables",
                    details: "Contact administrator to check Supabase configuration"
                }),
                { status: 500, headers: corsHeaders }
            );
        }

        // ===== AUTHENTICATION =====
        const authHeader = req.headers.get("Authorization");
        console.log("[Onboarding] Auth header present:", !!authHeader);

        if (!authHeader?.startsWith("Bearer ")) {
            console.error("[Onboarding] Missing or invalid Authorization header");
            return new Response(
                JSON.stringify({ error: "Unauthorized - Please log in to perform this action." }),
                { status: 401, headers: corsHeaders }
            );
        }

        // Create user-scoped client to validate JWT
        const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } },
        });

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

        if (authError || !user) {
            console.error("[Onboarding] JWT validation failed:", authError);
            return new Response(
                JSON.stringify({ 
                    error: "Unauthorized - Invalid or expired token. Please log in again.",
                    details: authError?.message 
                }),
                { status: 401, headers: corsHeaders }
            );
        }

        console.log("[Onboarding] Authenticated user:", user.id);

        // Create admin client with service role
        const adminClient = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // ===== AUTHORIZATION =====
        console.log("[Onboarding] Checking user role...");
        const { data: profile, error: profileError } = await adminClient
            .from("profiles")
            .select("role, name")
            .eq("id", user.id)
            .single();

        if (profileError || !profile) {
            console.error("[Onboarding] Profile fetch error:", profileError);
            return new Response(
                JSON.stringify({ error: "Failed to verify user role" }),
                { status: 403, headers: corsHeaders }
            );
        }

        console.log("[Onboarding] User role:", profile.role);

        const allowedRoles = ["admin", "superadmin", "hr", "ceo"];
        if (!allowedRoles.includes(profile.role?.toLowerCase() || "")) {
            return new Response(
                JSON.stringify({ error: "Only admins can complete onboarding" }),
                { status: 403, headers: corsHeaders }
            );
        }

        // ===== PARSE REQUEST BODY =====
        let body;
        try {
            body = await req.json();
            console.log("[Onboarding] Request body parsed:", JSON.stringify(body, null, 2));
        } catch (parseError) {
            console.error("[Onboarding] Failed to parse request body:", parseError);
            return new Response(
                JSON.stringify({ error: "Invalid request body - expected valid JSON" }),
                { status: 400, headers: corsHeaders }
            );
        }

        const { onboardingId, generatedUsername, generatedPassword, fullName, email, department } = body;

        // ===== VALIDATION =====
        console.log("[Onboarding] Validating required fields...");
        const missingFields = [];
        if (!onboardingId) missingFields.push("onboardingId");
        if (!generatedUsername) missingFields.push("generatedUsername");
        if (!generatedPassword) missingFields.push("generatedPassword");
        if (!fullName) missingFields.push("fullName");
        if (!email) missingFields.push("email");
        if (!department) missingFields.push("department");

        if (missingFields.length > 0) {
            console.error("[Onboarding] Missing fields:", missingFields);
            return new Response(
                JSON.stringify({ 
                    error: "Missing required fields",
                    details: missingFields.join(", ")
                }),
                { status: 400, headers: corsHeaders }
            );
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return new Response(
                JSON.stringify({ error: "Invalid email format" }),
                { status: 400, headers: corsHeaders }
            );
        }

        // ===== STEP 1: VERIFY ONBOARDING RECORD =====
        console.log("[Onboarding] Step 1: Verifying onboarding record...");
        const { data: onboardingRecord, error: fetchError } = await adminClient
            .from("onboarding_requests")
            .select("*")
            .eq("id", onboardingId)
            .eq("status", "ceo_selected")
            .single();

        if (fetchError || !onboardingRecord) {
            console.error("[Onboarding] Onboarding record not found or wrong status:", fetchError);
            return new Response(
                JSON.stringify({ 
                    error: "Onboarding request not found or not approved by CEO",
                    details: fetchError?.message 
                }),
                { status: 400, headers: corsHeaders }
            );
        }

        console.log("[Onboarding] Onboarding record found:", onboardingRecord.id);

        // ===== STEP 2: CHECK FOR EXISTING USER =====
        console.log("[Onboarding] Step 2: Checking for existing user...");
        const existingCheck = await checkExistingUser(adminClient, email.trim());
        
        if (existingCheck.error) {
            console.warn("[Onboarding] Could not check for existing user:", existingCheck.error);
        }
        
        if (existingCheck.exists) {
            console.error("[Onboarding] User already exists with email:", email);
            return new Response(
                JSON.stringify({ 
                    error: "A user with this email already exists",
                    details: "Cannot create duplicate user account"
                }),
                { status: 409, headers: corsHeaders }
            );
        }

        // ===== STEP 3: CREATE AUTH USER =====
        console.log("[Onboarding] Step 3: Creating auth user for:", email.trim());

        const departmentToRole: Record<string, string> = {
            "HR": "HR",
            "Admin": "Admin",
            "Accounts": "Accounts",
            "Marketing": "Employee",
            "Sales": "Employee",
            "IT": "Employee",
            "Operations": "Employee",
            "Farm": "Employee",
            "Purchase": "Employee",
        };

        const userRole = departmentToRole[department] || "Employee";

        const { data: authData, error: createError } = await adminClient.auth.admin.createUser({
            email: email.trim(),
            password: generatedPassword,
            email_confirm: true,
            user_metadata: {
                full_name: fullName.trim(),
                name: fullName.trim(),
                role: userRole,
                department: department,
                username: generatedUsername,
            }
        });

        if (createError) {
            console.error("[Onboarding] Error creating auth user:", createError);
            
            // Check for specific error types
            if (createError.message.includes("already been registered")) {
                return new Response(
                    JSON.stringify({ 
                        error: "A user with this email already exists",
                        details: createError.message
                    }),
                    { status: 409, headers: corsHeaders }
                );
            }
            
            return new Response(
                JSON.stringify({ 
                    error: `Failed to create user: ${createError.message}`,
                    details: createError.message
                }),
                { status: 400, headers: corsHeaders }
            );
        }

        const newUser = authData.user;
        console.log("[Onboarding] Auth user created successfully:", newUser.id);

        // ===== STEP 4: CREATE/UPDATE PROFILE =====
        // Note: The trigger on_auth_user_created may have already created the profile
        // We use upsert to handle both cases (insert if missing, update if exists)
        console.log("[Onboarding] Step 4: Upserting profile...");
        const { error: profileUpsertError } = await adminClient
            .from("profiles")
            .upsert({
                id: newUser.id,
                name: fullName.trim(),
                email: email.trim(),
                role: userRole,
                department: department,
                is_active: true,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'id' });

        if (profileUpsertError) {
            console.error("[Onboarding] Error upserting profile:", profileUpsertError);
            return new Response(
                JSON.stringify({
                    error: `Auth user created but profile upsert failed: ${profileUpsertError.message}`,
                    details: profileUpsertError.message,
                    userId: newUser.id
                }),
                { status: 500, headers: corsHeaders }
            );
        }

        console.log("[Onboarding] Profile upserted for user:", newUser.id);

        // ===== STEP 5: UPDATE ONBOARDING RECORD =====
        console.log("[Onboarding] Step 5: Updating onboarding record...");
        const now = new Date().toISOString();
        const { error: updateError } = await adminClient
            .from("onboarding_requests")
            .update({
                auth_user_id: newUser.id,
                admin_action_by: user.id,
                admin_action_at: now,
                status: "admin_completed",
                updated_at: now,
            })
            .eq("id", onboardingId);

        if (updateError) {
            console.error("[Onboarding] Error updating onboarding record:", updateError);
            return new Response(
                JSON.stringify({
                    error: `User created but onboarding record update failed: ${updateError.message}`,
                    details: updateError.message,
                    userId: newUser.id
                }),
                { status: 500, headers: corsHeaders }
            );
        }

        console.log("[Onboarding] Onboarding record updated to admin_completed");

        // ===== STEP 6: SEND WELCOME EMAIL =====
        console.log("[Onboarding] Step 6: Sending welcome email...");
        let emailResult = { success: false, error: "Resend API key not configured" };
        
        if (resendApiKey) {
            emailResult = await sendWelcomeEmail(
                resendApiKey,
                email,
                fullName,
                generatedUsername,
                generatedPassword
            );

            if (emailResult.success) {
                await adminClient
                    .from("onboarding_requests")
                    .update({
                        email_sent: true,
                        email_sent_at: now,
                    })
                    .eq("id", onboardingId);

                console.log("[Onboarding] Welcome email sent to:", email);
            } else {
                console.error("[Onboarding] Failed to send welcome email:", emailResult.error);
            }
        } else {
            console.warn("[Onboarding] Resend API key not configured - email not sent");
        }

        // ===== STEP 7: LOG TO AUDIT =====
        console.log("[Onboarding] Step 7: Logging to audit...");
        await adminClient.from("audit_logs").insert({
            action: "ONBOARDING_COMPLETED",
            performed_by: user.id,
            performed_by_name: profile.name,
            performed_by_role: profile.role,
            record_type: "onboarding_requests",
            record_id: onboardingId,
            after_state: {
                email: email.trim(),
                full_name: fullName.trim(),
                username: generatedUsername,
                role: userRole,
                department: department,
                auth_user_id: newUser.id,
                email_sent: emailResult.success,
            },
            remarks: `Onboarding completed for ${fullName}. User account created and credentials ${emailResult.success ? 'emailed' : 'not emailed (API error)'}.`,
        });

        console.log("[Onboarding] ====== REQUEST COMPLETED SUCCESSFULLY ======");

        return new Response(
            JSON.stringify({
                success: true,
                message: "Onboarding completed successfully",
                userId: newUser.id,
                emailSent: emailResult.success,
                emailError: emailResult.success ? null : emailResult.error,
            }),
            { status: 200, headers: corsHeaders }
        );

    } catch (error) {
        console.error("[Onboarding] ====== UNEXPECTED ERROR ======", error);
        console.error("[Onboarding] Error message:", error.message);
        console.error("[Onboarding] Error stack:", error.stack);
        
        return new Response(
            JSON.stringify({ 
                error: `Internal server error: ${error.message}`,
                details: error.stack
            }),
            { status: 500, headers: corsHeaders }
        );
    }
});
