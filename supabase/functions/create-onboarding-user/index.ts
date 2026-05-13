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
 * Send onboarding email with credentials and activation link using Resend API
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
        .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 10px; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>IGO Agritech Farms</h1>
            <p>Welcome to the Team!</p>
        </div>
        <div class="content">
            <p>Dear <strong>${fullName}</strong>,</p>
            
            <p>You have been selected at <strong>IGO Agritech Farms</strong>. Your onboarding process has been initiated.</p>
            
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
            
            <div class="warning">
                <strong>Important:</strong> Please complete your onboarding by clicking the button below. After HR verification, your ERP access will be activated.
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

You have been selected at IGO Agritech Farms. Your onboarding process has been initiated.

YOUR LOGIN CREDENTIALS:
------------------------
Email: ${toEmail}
Username: ${username}
Password: ${password}

COMPLETE YOUR ONBOARDING:
------------------------
Please complete your onboarding using the link below:
${activationLink}

After HR verification, your ERP access will be activated.

IMPORTANT:
- Keep your credentials secure
- Change your password after first login
- Complete onboarding within 7 days

Regards,
HR Team
IGO Agritech Farms

This is an automated email. Please do not reply to this message.`;

    try {
        console.log(`[Email] Sending onboarding email to ${toEmail}...`);
        console.log(`[Email] Activation link: ${activationLink}`);
        
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
            console.error("[Email] API error:", errorText);
            return { success: false, error: `Resend API error: ${errorText}` };
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
 * Generate secure activation token
 */
function generateActivationToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Build activation link
 */
function buildActivationLink(baseUrl: string, token: string): string {
    return `${baseUrl}/onboarding/complete?token=${token}`;
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    console.log("[CreateOnboardingUser] ====== START ======");

    try {
        // ===== ENVIRONMENT VARIABLES =====
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        const appUrl = Deno.env.get("APP_URL") || "https://app.igogroups.com";
        // Sender config: NO FALLBACK. Must be explicitly set in Supabase secrets.
        const fromEmail = Deno.env.get("RESEND_FROM_EMAIL");
        const fromName = Deno.env.get("RESEND_FROM_NAME") || "IGO Groups";

        console.log("[CreateOnboardingUser] === SENDER DIAGNOSTICS ===");
        console.log("[CreateOnboardingUser] RESEND_FROM_EMAIL present:", !!fromEmail);
        console.log("[CreateOnboardingUser] RESEND_FROM_EMAIL value:", fromEmail || "NOT SET");
        console.log("[CreateOnboardingUser] Environment check:");
        console.log("  - SUPABASE_URL:", supabaseUrl ? "✓ SET" : "✗ MISSING");
        console.log("  - SUPABASE_SERVICE_ROLE_KEY:", serviceRoleKey ? "✓ SET" : "✗ MISSING");
        console.log("  - RESEND_API_KEY:", resendApiKey ? "✓ SET" : "✗ MISSING");
        console.log("  - APP_URL:", appUrl);

        if (!supabaseUrl || !serviceRoleKey) {
            return new Response(
                JSON.stringify({ error: "Server configuration error: Missing Supabase credentials" }),
                { status: 500, headers: corsHeaders }
            );
        }

        if (!resendApiKey) {
            return new Response(
                JSON.stringify({ error: "Server configuration error: RESEND_API_KEY not configured" }),
                { status: 500, headers: corsHeaders }
            );
        }

        // Fail fast if RESEND_FROM_EMAIL is not configured
        if (!fromEmail) {
            console.error("[CreateOnboardingUser] RESEND_FROM_EMAIL is not set in Supabase secrets");
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
            console.error("[CreateOnboardingUser] RESEND_FROM_EMAIL is malformed:", fromEmail);
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

        console.log("[CreateOnboardingUser] Sender confirmed:", fromEmail);

        // ===== AUTHENTICATION =====
        const authHeader = req.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return new Response(
                JSON.stringify({ error: "Unauthorized - Please log in" }),
                { status: 401, headers: corsHeaders }
            );
        }

        const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } },
        });

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
        if (authError || !user) {
            return new Response(
                JSON.stringify({ error: "Unauthorized - Invalid session" }),
                { status: 401, headers: corsHeaders }
            );
        }

        // Create admin client
        const adminClient = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // ===== AUTHORIZATION =====
        const { data: profile } = await adminClient
            .from("profiles")
            .select("role, name")
            .eq("id", user.id)
            .single();

        const allowedRoles = ["admin", "superadmin", "hr", "ceo"];
        if (!allowedRoles.includes(profile?.role?.toLowerCase() || "")) {
            return new Response(
                JSON.stringify({ error: "Only admins can create onboarding users" }),
                { status: 403, headers: corsHeaders }
            );
        }

        // ===== PARSE REQUEST =====
        const { fullName, email, department, generatedUsername, generatedPassword } = await req.json();

        console.log("[CreateOnboardingUser] Request data:");
        console.log("  - fullName:", fullName);
        console.log("  - email:", email);
        console.log("  - department:", department);
        console.log("  - username:", generatedUsername);

        // ===== VALIDATION =====
        if (!fullName || !email || !department || !generatedUsername || !generatedPassword) {
            return new Response(
                JSON.stringify({ error: "Missing required fields" }),
                { status: 400, headers: corsHeaders }
            );
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return new Response(
                JSON.stringify({ error: "Invalid email format" }),
                { status: 400, headers: corsHeaders }
            );
        }

        // ===== STEP 1: CHECK IF USER ALREADY EXISTS =====
        console.log("[CreateOnboardingUser] Checking for existing user...");
        const { data: existingUsers } = await adminClient.auth.admin.listUsers({
            filter: `email.eq.${email}`,
        });

        if (existingUsers?.users?.length > 0) {
            return new Response(
                JSON.stringify({ error: "A user with this email already exists" }),
                { status: 409, headers: corsHeaders }
            );
        }

        // ===== STEP 2: GENERATE ACTIVATION TOKEN =====
        console.log("[CreateOnboardingUser] Generating activation token...");
        const activationToken = generateActivationToken();
        const activationLink = buildActivationLink(appUrl, activationToken);
        const tokenExpiresAt = new Date();
        tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 7); // 7 days expiry

        console.log("[CreateOnboardingUser] Activation link:", activationLink);

        // ===== STEP 3: CREATE ONBOARDING REQUEST =====
        console.log("[CreateOnboardingUser] Creating onboarding request...");
        const { data: onboardingRequest, error: onboardingError } = await adminClient
            .from("employee_onboarding_requests")
            .insert({
                full_name: fullName.trim(),
                email: email.trim(),
                department: department,
                generated_username: generatedUsername,
                temporary_password_hint: generatedPassword.replace(/./g, '*'), // Masked for security
                activation_token: activationToken,
                activation_link: activationLink,
                activation_expires_at: tokenExpiresAt.toISOString(),
                status: "invited",
                invited_by: user.id,
                invited_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (onboardingError) {
            console.error("[CreateOnboardingUser] Error creating onboarding request:", onboardingError);
            return new Response(
                JSON.stringify({ error: `Failed to create onboarding request: ${onboardingError.message}` }),
                { status: 500, headers: corsHeaders }
            );
        }

        console.log("[CreateOnboardingUser] Onboarding request created:", onboardingRequest.id);

        // ===== STEP 4: SEND EMAIL =====
        console.log("[CreateOnboardingUser] Sending onboarding email...");
        console.log("[CreateOnboardingUser] Email details:", {
            to: email,
            username: generatedUsername,
            link: activationLink
        });

        const emailResult = await sendOnboardingEmail(
            resendApiKey,
            email,
            fullName,
            generatedUsername,
            generatedPassword,
            activationLink,
            fromEmail,
            fromName
        );

        // ===== STEP 5: HANDLE EMAIL FAILURE =====
        if (!emailResult.success) {
            console.error("[CreateOnboardingUser] EMAIL FAILED - Rolling back...");
            
            // Delete the onboarding request since email failed
            await adminClient
                .from("employee_onboarding_requests")
                .delete()
                .eq("id", onboardingRequest.id);

            console.error("[CreateOnboardingUser] Onboarding request deleted due to email failure");

            return new Response(
                JSON.stringify({
                    success: false,
                    error: "Failed to send onboarding email",
                    details: emailResult.error,
                    message: "Account was not created because email could not be sent. Please check email configuration and try again."
                }),
                { status: 500, headers: corsHeaders }
            );
        }

        console.log("[CreateOnboardingUser] Email sent successfully");

        // ===== STEP 6: UPDATE ONBOARDING REQUEST WITH EMAIL STATUS =====
        await adminClient
            .from("employee_onboarding_requests")
            .update({
                email_sent: true,
                email_sent_at: new Date().toISOString(),
            })
            .eq("id", onboardingRequest.id);

        // ===== STEP 7: LOG TO AUDIT =====
        await adminClient.from("audit_logs").insert({
            action: "ONBOARDING_INVITATION_SENT",
            performed_by: user.id,
            performed_by_name: profile.name,
            performed_by_role: profile.role,
            record_type: "employee_onboarding_requests",
            record_id: onboardingRequest.id,
            after_state: {
                email: email.trim(),
                full_name: fullName.trim(),
                username: generatedUsername,
                department: department,
                activation_link: activationLink,
                email_sent: true,
            },
            remarks: `Onboarding invitation sent to ${fullName} (${email}). Email ID: ${emailResult.data?.id}`,
        });

        console.log("[CreateOnboardingUser] ====== SUCCESS ======");

        return new Response(
            JSON.stringify({
                success: true,
                message: "Onboarding invitation created and email sent successfully",
                onboardingId: onboardingRequest.id,
                emailSent: true,
                activationLink: activationLink,
            }),
            { status: 200, headers: corsHeaders }
        );

    } catch (error) {
        console.error("[CreateOnboardingUser] ====== ERROR ======", error);
        return new Response(
            JSON.stringify({
                success: false,
                error: `Internal server error: ${error.message}`,
            }),
            { status: 500, headers: corsHeaders }
        );
    }
});
