"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/auth";

import type { AdminForgotState } from "./states";

/**
 * =====================================================================
 *  Admin password reset — request email (`/admin/forgot`)
 * =====================================================================
 *
 *  Always renders the same generic notice regardless of whether the
 *  email is on file — this prevents account enumeration. We still log
 *  the underlying Supabase error so debugging isn't blind.
 *
 *  The reset link points at `/auth/callback?next=/admin/reset`. The
 *  auth/callback route exchanges the one-time code, establishes a
 *  Supabase session (recovery type), then forwards to /admin/reset
 *  where the admin sets a new password.
 * =====================================================================
 */

export async function adminRequestPasswordReset(
  _prev: AdminForgotState,
  formData: FormData,
): Promise<AdminForgotState> {
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

  // Always the same generic notice — never reveal whether the address
  // is on file or not.
  const genericNotice: AdminForgotState = {
    status: "notice",
    message:
      "If that email belongs to an administrator, a password reset link is on its way.",
  };

  // Supabase not configured — still render the same notice so the page
  // doesn't crash in dev and the dev/learner doesn't see a different UX
  // than production. The email simply won't be sent.
  if (!isSupabaseConfigured()) {
    return genericNotice;
  }

  try {
    const supabase = await createClient();
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl.replace(/\/$/, "")}/auth/callback?next=/admin/reset`,
    });
    if (error) {
      // Swallow — log only. We still return the same notice so we
      // don't leak whether the email exists.
      console.warn(
        "[admin/forgot] resetPasswordForEmail error:",
        error.message,
      );
    }
  } catch (err) {
    console.warn("[admin/forgot] resetPasswordForEmail threw:", err);
  }

  return genericNotice;
}
