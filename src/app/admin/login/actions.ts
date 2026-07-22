"use server";

import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/auth";

import type { AdminLoginState } from "./states";

/**
 * =====================================================================
 *  Admin password sign-in (`/admin/login`)
 * =====================================================================
 *
 *  Runs SEPARATELY from the stakeholder OTP flow at `/login`. Uses
 *  Supabase's `signInWithPassword` and then verifies the resulting
 *  session belongs to a real Admin row — if not, we immediately sign
 *  the user out so a stakeholder who somehow set a Supabase password
 *  can't slip into `/admin`.
 *
 *  Race-safe linking: if the matching Admin row has no `authUserId`
 *  yet, we link it via `updateMany({ where: { id, authUserId: null } })`
 *  so a concurrent verify of the same email can't P2002.
 * =====================================================================
 */

export async function adminSignIn(
  _prev: AdminLoginState,
  formData: FormData,
): Promise<AdminLoginState> {
  // ---- 1. Pull + validate ----------------------------------------------
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const fieldErrors: Partial<Record<"email" | "password", string>> = {};

  if (!email) {
    fieldErrors.email = "Please enter your email.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fieldErrors.email = "That doesn't look like a valid email address.";
  }
  if (!password) {
    fieldErrors.password = "Please enter your password.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Please fill in both fields and try again.",
      fieldErrors,
    };
  }

  // ---- 2. Soft-fail when Supabase isn't configured (placeholder env) ---
  if (!isSupabaseConfigured()) {
    return {
      status: "error",
      message:
        "Admin sign-in is not configured yet. Reach out to the project team to verify your account.",
    };
  }

  // ---- 3. Attempt the password sign-in --------------------------------
  let signedInEmail: string | null = email;
  try {
    const supabase = await createClient();
    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      // Generic message — never reveal whether the email exists.
      console.warn("[admin/login] signInWithPassword error:", error.message);
      return {
        status: "error",
        message: "Invalid email or password.",
      };
    }
    // The session is established. Capture the email Supabase actually
    // authenticated (in case the row's email differs from the form input
    // casing, though we already normalised).
    signedInEmail = data.user?.email ?? email;
  } catch (err) {
    console.warn("[admin/login] signInWithPassword threw:", err);
    return {
      status: "error",
      message: "We couldn't sign you in just now. Please try again.",
    };
  }

  // ---- 4. Verify the caller is actually an Admin ----------------------
  // Look up by the email we attempted to sign in as. If there's no
  // matching admin row we MUST sign out — otherwise we'd leave a
  // stakeholder's session alive behind a redirect to /admin, where
  // requireAdmin() would bounce them anyway but the session cookie
  // would still be set.
  try {
    const lookupEmail = signedInEmail?.toLowerCase() ?? email;
    const admin = await prisma.admin.findUnique({
      where: { email: lookupEmail },
    });

    if (!admin) {
      // Force sign-out so the (real or test) session can't be reused.
      try {
        const supabase = await createClient();
        await supabase.auth.signOut();
      } catch (signOutErr) {
        console.warn(
          "[admin/login] post-deny signOut failed (non-fatal):",
          signOutErr,
        );
      }
      return {
        status: "error",
        message: "This account is not an administrator.",
      };
    }

    // ---- 5. Link the Supabase user id to the Admin row (idempotent) ---
    if (!admin.authUserId) {
      // `updateMany` with the `authUserId: null` guard is race-safe —
      // a concurrent verify of the same email won't P2002.
      const { data: sessionData } = await createClient().then((s) =>
        s.auth.getUser(),
      );
      const userId = sessionData.user?.id;
      if (userId) {
        try {
          await prisma.admin.updateMany({
            where: { id: admin.id, authUserId: null },
            data: { authUserId: userId },
          });
        } catch (linkErr) {
          // Non-fatal: the email fallback in `getCurrentAdmin` still works.
          console.warn(
            "[admin/login] admin authUserId link failed (non-fatal):",
            linkErr,
          );
        }
      }
    }
  } catch (err) {
    console.warn("[admin/login] admin lookup failed:", err);
    // Treat a DB hiccup the same as "not an admin" from the user's
    // perspective — don't reveal whether the account exists.
    try {
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch {
      /* swallow */
    }
    return {
      status: "error",
      message: "We couldn't verify your account. Please try again.",
    };
  }

  // ---- 6. Redirect to the admin dashboard -----------------------------
  // redirect() throws — must be OUTSIDE the try/catch above, otherwise
  // the redirect would be swallowed by a generic catch.
  redirect("/admin");
}
