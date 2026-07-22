"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/auth";

import type { ResetState } from "./states";

/**
 * =====================================================================
 *  Stakeholder password reset — verify OTP + set new password
 *  (`/login/reset`)
 * =====================================================================
 *
 *  Step 2 of the stakeholder OTP flow:
 *
 *    1. User submitted email at /login/forgot → server sent a
 *       "Reset Password" email containing a 6-digit code
 *       (template must include {{ .Token }}).
 *    2. User pastes the code + a new password here.
 *    3. We call `supabase.auth.verifyOtp({ email, token, type:
 *       "recovery" })` to establish a recovery session.
 *    4. We call `supabase.auth.updateUser({ password })` to set the
 *       new password.
 *    5. `redirect("/login?reset=1")` — the login page renders a
 *       friendly "Password updated" success notice.
 *
 *  Note on redirect: `redirect()` throws, so it MUST sit OUTSIDE the
 *  try/catch around the Supabase calls. We also never reach a return
 *  statement on the happy path.
 * =====================================================================
 */

export async function resetPassword(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  // ---- 1. Read + validate input -----------------------------------------
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const fieldErrors: Partial<
    Record<"email" | "token" | "password" | "confirmPassword", string>
  > = {};

  if (!email) {
    fieldErrors.email = "Please enter your email.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fieldErrors.email = "That doesn't look like a valid email address.";
  }

  if (!token) {
    fieldErrors.token = "Enter the 6-digit code from your email.";
  } else if (!/^\d{6}$/.test(token)) {
    fieldErrors.token = "Enter the 6-digit code from your email.";
  }

  if (!password) {
    fieldErrors.password = "Please enter a new password.";
  } else if (password.length < 8) {
    fieldErrors.password = "Password must be at least 8 characters.";
  }

  if (!confirmPassword) {
    fieldErrors.confirmPassword = "Please confirm your new password.";
  } else if (confirmPassword !== password) {
    fieldErrors.confirmPassword = "Passwords do not match.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Please fix the highlighted fields and try again.",
      fieldErrors,
    };
  }

  // ---- 2. Bail out cleanly if Supabase isn't configured -----------------
  if (!isSupabaseConfigured()) {
    return {
      status: "error",
      message:
        "Auth service isn't configured yet — the password couldn't be saved.",
    };
  }

  // ---- 3. Verify OTP → mint recovery session, then update password ------
  try {
    const supabase = await createClient();
    const { error: verifyErr } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "recovery",
    });
    if (verifyErr) {
      console.warn("[login/reset] verifyOtp error:", verifyErr.message);
      return {
        status: "error",
        message:
          "That code is invalid or has expired. Request a new one.",
      };
    }

    const { error: updErr } = await supabase.auth.updateUser({ password });
    if (updErr) {
      console.warn("[login/reset] updateUser error:", updErr.message);
      return {
        status: "error",
        message: "We couldn't update your password. Please try again.",
      };
    }
  } catch (err) {
    console.warn("[login/reset] reset threw:", err);
    return {
      status: "error",
      message: "We couldn't update your password. Please try again.",
    };
  }

  // ---- 4. Redirect to /login with a success flag -----------------------
  // redirect() throws — must be outside the try/catch.
  redirect("/login?reset=1");
}
