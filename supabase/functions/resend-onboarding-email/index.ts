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
 * Send onboarding email with credentials and activation link
 */
async function sendOnboardingEmail(
    resendApiKey: string,
    toEmail: string,
    fullName: string,
    username: string,
    password: string,
    activationLink: string,
    fromEmail: string,
    fromName: string = "IGO Groups"
) {
    const emailSubject = "Complete Your Onboarding - IGO Agritech Farms";
    
    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2d5a27; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
        .credentials { background: white; padding: 20px; border-left: 4px solid #2d5a27; margin: 20px 0; }
        .credential-row { margin: 10px 0; }
        .label { font-weight: bold; color: #555; }
        .value { font-family: monospace; background: #f0f0f0; padding: 5px 10px; border-radius: 3px; }
        .button { display: inline-block; background: #2d5a27; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; color: #777; font-size: 12px; margin-top: 30px; }
        .resend-notice { background: #e7f3ff; border: 1px solid #2196F3; padding: 10px; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>IGO Agritech Farms</h1>
            <p>Onboarding Credentials (Resent)</p>
        </div>
        <div class="content">
            <div class="resend-notice">
                <strong>Notice:</strong> This is a resent email with your onboarding credentials. If you have already completed onboarding, please disregard this message.
            </div>
            
            <p>Dear <strong>${fullName}</strong>,</p>
            
            <p>Here are your onboarding credentials for <strong>IGO Agritech Farms</strong>:</p>
            
            <div class="credentials">
                <h3 style="margin-top: 0;">Your Login Credentials</h3>
                <div class="credential-row">
                    <span class="label">Email:</span>
                    <span class="value">${toEmail}</span>
                </div>
                <div class="credential-row">
                    <span class="label">Username:</span>
                    <span class="value">${username}</span>
                </div>
                <div class="credential-row">
                    <span class="label">Password:</span>
                    <span class="value">${password}</span>
                </div>
            </div>
            
            <center>
                <a href="${activationLink}" class="button">Complete Onboarding</a>
            </center>
            
            <p style="font-size: 14px; color: #666;">
                If the button doesn't work, copy and paste this link:<br>
                <code style="word-break: break-all;">${activationLink}</code>
            </p>
            
            <p style="margin-top: 30px;">
                Regards,<br>
                <strong>HR Team</strong><br>
                IGO Agritech Farms
            </p>
        </div>
        <div class="footer">
            <p>This is an automated email. Please do not reply to this message.</p>
            <p>&copy; 2026 IGO Agritech Farms. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;

    const textBody = `Dear ${fullName},

This is a resent email with your onboarding credentials for IGO Agritech Farms.

YOUR LOGIN CREDENTIALS:
------------------------
Email: ${toEmail}
Username: ${username}
Password: ${password}

COMPLETE YOUR ONBOARDING:
------------------------
${activationLink}

If you have already completed onboarding, please disregard this message.

Regards,
HR Team
IGO Agritech Farms`;

    try {
        console.log(`[ResendEmail] Sending to ${toEmail}...`);
        
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${resendApiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: `${fromName} <${fromEmail}>`,
                to: [toEmail],
                subject: emailSubject,
                html: htmlBody,
                text: textBody,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("[ResendEmail] API error:", errorText);
            return { success: false, error: errorText };
        }

        const data = await response.json();
        console.log(`[ResendEmail] Sent successfully to ${toEmail}, id:`, data.id);
        return { success: true, data };
    } catch (error) {
        console.error("[ResendEmail] Sending error:", error);
        return { success: false, error: error.message };
    }
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    console.log("[ResendOnboardingEmail] ====== START ======");

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        const appUrl = Deno.env.get("APP_URL") || "https://app.igogroups.com";
        // Sender config: NO FALLBACK. Must be explicitly set in Supabase secrets.
        const fromEmail = Deno.env.get("RESEND_FROM_EMAIL");
        const fromName = Deno.env.get("RESEND_FROM_NAME") || "IGO Groups";

        // Runtime diagnostics
        console.log("[ResendOnboardingEmail] === SENDER DIAGNOSTICS ===");
        console.log("[ResendOnboardingEmail] RESEND_FROM_EMAIL present:", !!fromEmail);
        console.log("[ResendOnboardingEmail] RESEND_FROM_EMAIL value:", fromEmail || "NOT SET");
        console.log("[ResendOnboardingEmail] RESEND_API_KEY present:", !!resendApiKey);

        if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
            return new Response(
                JSON.stringify({ error: "Server configuration error" }),
                { status: 500, headers: corsHeaders }
            );
        }

        // Fail fast if RESEND_FROM_EMAIL is not configured
        if (!fromEmail) {
            console.error("[ResendOnboardingEmail] RESEND_FROM_EMAIL is not set in Supabase secrets");
            return new Response(
                JSON.stringify({
                    success: false,
                    error: "RESEND_FROM_EMAIL is not configured. Set this Supabase secret to a verified sender email.",
                    step: "send_email",
                    code: "missing_sender_config",
                }),
                { status: 500, headers: corsHeaders }
            );
        }

        // Basic format validation — domain verification is handled by Resend
        const emailFormatOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fromEmail);
        if (!emailFormatOk) {
            console.error("[ResendOnboardingEmail] RESEND_FROM_EMAIL is malformed:", fromEmail);
            return new Response(
                JSON.stringify({
                    success: false,
                    error: `RESEND_FROM_EMAIL is malformed: "${fromEmail}". Update the Supabase secret to a valid email address.`,
                    step: "send_email",
                    code: "invalid_sender_format",
                    senderUsed: fromEmail,
                }),
                { status: 500, headers: corsHeaders }
            );
        }

        console.log("[ResendOnboardingEmail] Sender confirmed:", fromEmail);

        // Authentication
        const authHeader = req.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return new Response(
                JSON.stringify({ error: "Unauthorized" }),
                { status: 401, headers: corsHeaders }
            );
        }

        const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } },
        });

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
        if (authError || !user) {
            return new Response(
                JSON.stringify({ error: "Unauthorized" }),
                { status: 401, headers: corsHeaders }
            );
        }

        const adminClient = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // Authorization
        const { data: profile } = await adminClient
            .from("profiles")
            .select("role, name")
            .eq("id", user.id)
            .single();

        const allowedRoles = ["admin", "superadmin", "hr", "ceo"];
        if (!allowedRoles.includes(profile?.role?.toLowerCase() || "")) {
            return new Response(
                JSON.stringify({ error: "Only admins can resend emails" }),
                { status: 403, headers: corsHeaders }
            );
        }

        // Parse request
        const { onboardingId } = await req.json();
        if (!onboardingId) {
            return new Response(
                JSON.stringify({ error: "Missing onboardingId" }),
                { status: 400, headers: corsHeaders }
            );
        }

        // Get onboarding request
        const { data: onboarding, error: fetchError } = await adminClient
            .from("employee_onboarding_requests")
            .select("*")
            .eq("id", onboardingId)
            .single();

        if (fetchError || !onboarding) {
            return new Response(
                JSON.stringify({ error: "Onboarding request not found" }),
                { status: 404, headers: corsHeaders }
            );
        }

        console.log("[ResendOnboardingEmail] Resending for:", onboarding.email);

        // Reconstruct password from hint (replace * with actual characters)
        // In production, you might want to store a hashed version or use a different approach
        const password = onboarding.temporary_password_hint?.replace(/\*/g, '123') || 
            `${onboarding.generated_username?.split('@')[0]}${onboarding.department?.toLowerCase()}#123`;

        // Reconstruct or use existing activation link
        let activationLink = onboarding.activation_link;
        if (!activationLink) {
            activationLink = `${appUrl}/onboarding/complete?token=${onboarding.activation_token}`;
        }

        console.log("[ResendOnboardingEmail] Password hint:", onboarding.temporary_password_hint);
        console.log("[ResendOnboardingEmail] Activation link:", activationLink);

        // Send email
        const emailResult = await sendOnboardingEmail(
            resendApiKey,
            onboarding.email,
            onboarding.full_name,
            onboarding.generated_username,
            password,
            activationLink,
            fromEmail,
            fromName
        );

        if (!emailResult.success) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: "Failed to resend email",
                    details: emailResult.error,
                }),
                { status: 500, headers: corsHeaders }
            );
        }

        // Update resend count and timestamp
        await adminClient
            .from("employee_onboarding_requests")
            .update({
                email_resent_count: (onboarding.email_resent_count || 0) + 1,
                email_resent_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq("id", onboardingId);

        // Log to audit
        await adminClient.from("audit_logs").insert({
            action: "ONBOARDING_EMAIL_RESENT",
            performed_by: user.id,
            performed_by_name: profile.name,
            performed_by_role: profile.role,
            record_type: "employee_onboarding_requests",
            record_id: onboardingId,
            after_state: {
                email: onboarding.email,
                full_name: onboarding.full_name,
                resent_count: (onboarding.email_resent_count || 0) + 1,
            },
            remarks: `Onboarding email resent to ${onboarding.full_name} (${onboarding.email})`,
        });

        console.log("[ResendOnboardingEmail] ====== SUCCESS ======");

        return new Response(
            JSON.stringify({
                success: true,
                message: "Email resent successfully",
                emailSent: true,
            }),
            { status: 200, headers: corsHeaders }
        );

    } catch (error) {
        console.error("[ResendOnboardingEmail] ====== ERROR ======", error);
        return new Response(
            JSON.stringify({
                success: false,
                error: `Internal server error: ${error.message}`,
            }),
            { status: 500, headers: corsHeaders }
        );
    }
});
