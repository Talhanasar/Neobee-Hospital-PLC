"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/auth";

import type { ForgotState } from "./states";

/**
 * =====================================================================
 *  Stakeholder password reset — request OTP code (`/login/forgot`)
 * =====================================================================
 *
 *  Unlike the admin flow (which uses `resetPasswordForEmail` with a
 *  `redirectTo` so the user lands back on /admin/reset via a magic
 *  link), the stakeholder flow uses an OTP CODE:
 *
 *    1. Call `supabase.auth.resetPasswordForEmail(email)` (no redirectTo).
 *       Supabase's "Reset Password" email template MUST be configured
 *       to include the `{{ .Token }}` placeholder — that renders the
 *       6-digit code the user will type on the next screen.
 *
 *    2. The user lands on `/login/reset?email=…`, enters the code +
 *       new password. The reset action then calls
 *       `supabase.auth.verifyOtp({ email, token, type: "recovery" })`
 *       to establish a session and immediately
 *       `supabase.auth.updateUser({ password })` to set the new pw.
 *
 *  Always returns the same generic "sent" state regardless of whether
 *  the email is on file — prevents account enumeration. We log the
 *  underlying Supabase error so debugging isn't blind.
 * =====================================================================
 */

export async function requestPasswordReset(
  _prev: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email) {
    return {
      status: "error",
      message: "Please enter your email.",
      fieldErrors: { email: "Please enter your email." },
    };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      status: "error",
      message: "That doesn't look like a valid email address.",
      fieldErrors: { email: "That doesn't look like a valid email address." },
    };
  }

  // Generic success — same message whether or not the email is on file,
  // so we never leak whether an account exists.
  const sentNotice: ForgotState = {
    status: "sent",
    email,
    message:
      "If that email is on file, we've sent a 6-digit reset code. Enter it on the next screen.",
  };

  // Supabase not configured — still return the same "sent" state so the
  // dev/learner sees the same UX as production. The email simply
  // won't be sent in this branch.
  if (!isSupabaseConfigured()) {
    return sentNotice;
  }

  try {
    const supabase = await createClient();
    // NOTE: no `redirectTo` here — we want the recovery email to
    // contain the 6-digit OTP token ({{ .Token }} in the email
    // template), not a magic link. The user types that code into
    // /login/reset on the next step.
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      // Swallow — log only. We still return the same "sent" state so
      // we don't leak whether the email exists.
      console.warn(
        "[login/forgot] resetPasswordForEmail error:",
        error.message,
      );
    }
  } catch (err) {
    console.warn("[login/forgot] resetPasswordForEmail threw:", err);
  }

  return sentNotice;
}
