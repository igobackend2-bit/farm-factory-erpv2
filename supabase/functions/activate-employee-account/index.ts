// @ts-nocheck - Deno Edge Function
// @deno-types="https://esm.sh/@supabase/supabase-js@2.49.1"
/// <reference types="https://esm.sh/@supabase/supabase-js@2.49.1" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
};

/**
 * Send welcome email after HR verification
 */
async function sendWelcomeEmail(
    resendApiKey: string,
    toEmail: string,
    fullName: string,
    username: string,
    password: string
) {
    const emailSubject = "Welcome to IGO Agritech Farms - Your Account is Active";
    const emailBody = `Dear ${fullName},

Your onboarding has been verified by HR and your ERP account is now active.

Login Credentials:
Email: ${toEmail}
Username: ${username}
Password: ${password}

You can now login to the ERP system at: ${Deno.env.get("APP_URL") || "https://your-erp-domain.com"}

Please change your password after first login.

Regards,
IGO Agritech Farms
HR Department`;

    try {
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${resendApiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: "IGO Agritech Farms <hr@resend.dev>",
                to: [toEmail],
                subject: emailSubject,
                text: emailBody,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            return { success: false, error: errorText };
        }

        const data = await response.json();
        return { success: true, data };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";

        const authHeader = req.headers.get("Authorization");

        // Validate admin authorization
        const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader || "" } },
        });

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

        if (authError || !user) {
            return new Response(
                JSON.stringify({ error: "Unauthorized" }),
                { status: 401, headers: corsHeaders }
            );
        }

        // Create admin client
        const adminClient = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // Check user role
        const { data: profile } = await adminClient
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();

        const allowedRoles = ["admin", "superadmin", "hr", "ceo"];
        if (!allowedRoles.includes(profile?.role?.toLowerCase())) {
            return new Response(
                JSON.stringify({ error: "Only HR/Admin can activate accounts" }),
                { status: 403, headers: corsHeaders }
            );
        }

        // Parse request
        const { onboardingId, email, fullName, username, department } = await req.json();

        if (!email || !fullName || !username || !department) {
            return new Response(
                JSON.stringify({ error: "Missing required fields" }),
                { status: 400, headers: corsHeaders }
            );
        }

        // Department to role mapping
        const departmentToRole: Record<string, string> = {
            "HR": "hr",
            "Admin": "admin",
            "Accounts": "accounts",
            "Marketing": "marketing",
            "Sales": "sales",
            "IT": "employee",
            "Operations": "employee",
            "Farm": "employee",
            "Purchase": "employee",
            "R&D": "employee",
        };

        const userRole = departmentToRole[department] || "employee";

        // Extract password hint from onboarding record
        const { data: onboarding } = await adminClient
            .from("employee_onboarding_requests")
            .select("temporary_password_hint")
            .eq("id", onboardingId)
            .single();

        // Generate a new password for auth (employees will use this to login)
        const password = onboarding?.temporary_password_hint 
            ? onboarding.temporary_password_hint.replace(/\*/g, '123') // Replace *** with actual
            : `${username.split('@')[0]}${department.toLowerCase()}#123`;

        // Create auth user
        const { data: authData, error: createError } = await adminClient.auth.admin.createUser({
            email: email.trim(),
            password: password,
            email_confirm: true,
            user_metadata: {
                full_name: fullName.trim(),
                name: fullName.trim(),
                role: userRole,
                department: department,
                username: username,
            }
        });

        if (createError) {
            console.error("[ActivateAccount] Error creating auth user:", createError);
            return new Response(
                JSON.stringify({ error: `Failed to create user: ${createError.message}` }),
                { status: 400, headers: corsHeaders }
            );
        }

        const newUser = authData.user;

        // Upsert profile
        await adminClient.from("profiles").upsert({
            id: newUser.id,
            name: fullName.trim(),
            email: email.trim(),
            role: userRole,
            department: department,
            username: username,
            is_active: true,
            onboarding_completed: true,
            hr_verified: true,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

        // Send welcome email
        let emailResult = { success: false, error: "Resend API key not configured" };
        if (resendApiKey) {
            emailResult = await sendWelcomeEmail(
                resendApiKey,
                email,
                fullName,
                username,
                password
            );
        }

        return new Response(
            JSON.stringify({
                success: true,
                userId: newUser.id,
                emailSent: emailResult.success,
                emailError: emailResult.error || null,
            }),
            { status: 200, headers: corsHeaders }
        );

    } catch (error) {
        console.error("[ActivateAccount] Unexpected error:", error);
        return new Response(
            JSON.stringify({ error: `Internal server error: ${error.message}` }),
            { status: 500, headers: corsHeaders }
        );
    }
});
