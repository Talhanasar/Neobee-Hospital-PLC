"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, requireAdmin } from "@/lib/auth";

import type { AdminSecurityState } from "./states";

/**
 * =====================================================================
 *  Admin — change password while signed in (`/admin/security`)
 * =====================================================================
 *
 *  Requires the caller to be an admin (defense-in-depth — the page
 *  also calls `requireAdmin()`). The re-auth step (signInWithPassword
 *  with the current password) is the explicit "are you really you?"
 *  check before letting the password change through.
 * =====================================================================
 */

export async function adminChangePassword(
  _prev: AdminSecurityState,
  formData: FormData,
): Promise<AdminSecurityState> {
  // ---- 1. Defense-in-depth: must be an admin --------------------------
  // requireAdmin() throws a redirect to /login?denied=1 if the caller
  // isn't an admin. That means we never reach the body below for a
  // non-admin, but we keep the call so this action is also safe to
  // invoke via a direct POST.
  const admin = await requireAdmin();

  // ---- 2. Validate inputs ---------------------------------------------
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const fieldErrors: Partial<
    Record<"currentPassword" | "newPassword" | "confirm", string>
  > = {};

  if (!currentPassword) {
    fieldErrors.currentPassword = "Please enter your current password.";
  }
  if (!newPassword) {
    fieldErrors.newPassword = "Please enter a new password.";
  } else if (newPassword.length < 8) {
    fieldErrors.newPassword = "Password must be at least 8 characters.";
  }
  if (!confirm) {
    fieldErrors.confirm = "Please confirm your new password.";
  } else if (confirm !== newPassword) {
    fieldErrors.confirm = "Passwords do not match.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Please fix the highlighted fields and try again.",
      fieldErrors,
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      status: "error",
      message: "Auth service isn't configured — password can't be changed.",
    };
  }

  // ---- 3. Re-authenticate with the current password -------------------
  // This is the "are you really you?" gate. Even though the user has
  // a session, we don't let `updateUser` run until they've proven
  // they know the current password.
  try {
    const supabase = await createClient();
    const { error: reAuthError } = await supabase.auth.signInWithPassword({
      email: admin.email,
      password: currentPassword,
    });
    if (reAuthError) {
      console.warn(
        "[admin/security] re-auth signInWithPassword error:",
        reAuthError.message,
      );
      return {
        status: "error",
        message: "Your current password is incorrect.",
        fieldErrors: {
          currentPassword: "Your current password is incorrect.",
        },
      };
    }

    // ---- 4. Apply the password change --------------------------------
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (updateError) {
      console.warn(
        "[admin/security] updateUser error:",
        updateError.message,
      );
      return {
        status: "error",
        message:
          "We couldn't save your new password. Please try again in a moment.",
      };
    }
  } catch (err) {
    console.warn("[admin/security] change-password threw:", err);
    return {
      status: "error",
      message:
        "We couldn't save your new password. Please try again in a moment.",
    };
  }

  // ---- 5. Stay on the page; show a success notice --------------------
  // No redirect — per spec we want the admin to see the confirmation
  // and the form clear, not bounce around.
  return {
    status: "success",
    message: "Your password has been updated.",
  };
}
