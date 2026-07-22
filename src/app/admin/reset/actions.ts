"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getSessionUser, isSupabaseConfigured } from "@/lib/auth";

import type { AdminResetState } from "./states";

/**
 * =====================================================================
 *  Admin password reset — set new password (`/admin/reset`)
 * =====================================================================
 *
 *  The recovery link emailed from `/admin/forgot` flows through
 *  `/auth/callback?next=/admin/reset`, which exchanges the one-time
 *  code for a Supabase recovery session. We then update the user's
 *  password and redirect to `/admin`.
 *
 *  If the recovery session is missing (link expired, opened in a
 *  different browser, etc.) we render an error state so the user knows
 *  to request a fresh link.
 * =====================================================================
 */

export async function adminSetNewPassword(
  _prev: AdminResetState,
  formData: FormData,
): Promise<AdminResetState> {
  // ---- 1. Require an active recovery session ---------------------------
  const user = await getSessionUser();
  if (!user) {
    return {
      status: "error",
      message:
        "Your reset link is invalid or has expired. Request a new one.",
    };
  }

  // ---- 2. Validate the new password -----------------------------------
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const fieldErrors: Partial<Record<"password" | "confirm", string>> = {};

  if (!password) {
    fieldErrors.password = "Please enter a new password.";
  } else if (password.length < 8) {
    fieldErrors.password = "Password must be at least 8 characters.";
  }

  if (!confirm) {
    fieldErrors.confirm = "Please confirm your new password.";
  } else if (confirm !== password) {
    fieldErrors.confirm = "Passwords do not match.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Please fix the highlighted fields and try again.",
      fieldErrors,
    };
  }

  // ---- 3. Apply the password change -----------------------------------
  if (!isSupabaseConfigured()) {
    return {
      status: "error",
      message:
        "Auth service isn't configured yet — the password couldn't be saved.",
    };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      console.warn("[admin/reset] updateUser error:", error.message);
      return {
        status: "error",
        message:
          "We couldn't save your new password. Please try again or request a fresh reset link.",
      };
    }
  } catch (err) {
    console.warn("[admin/reset] updateUser threw:", err);
    return {
      status: "error",
      message: "We couldn't save your new password. Please try again.",
    };
  }

  // ---- 4. Redirect to the admin dashboard -----------------------------
  // redirect() throws — must be outside the try/catch.
  redirect("/admin");
}
