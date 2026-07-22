"use server";

import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/auth";

import type { LoginState } from "./states";

/**
 * =====================================================================
 *  Stakeholder password sign-in (`/login`)
 * =====================================================================
 *
 *  Runs SEPARATELY from the admin password flow at `/admin/login`. Uses
 *  Supabase's `signInWithPassword` and then verifies the resulting
 *  session belongs to a real Stakeholder row — applying TWO gates:
 *
 *    1. Supabase must have confirmed the user's email. We detect this
 *       via the `/confirm/i` error message that Supabase returns when
 *       `confirmEmail` is enabled. (The signup flow already emails the
 *       confirmation link; the user just needs to click it.)
 *
 *    2. An admin must have verified the stakeholder
 *       (`Stakeholder.verifiedAt` non-null). Otherwise we sign the
 *       user out and return the "awaiting verification" notice — the
 *       session is real, but the stakeholder isn't allowed past
 *       `requireStakeholder`, so leaving it alive would just confuse
 *       the next render.
 *
 *  Admins who accidentally land here get routed to `/admin` — admin
 *  sign-in otherwise lives at `/admin/login` and is the canonical
 *  path for admin credentials, but we don't want a stale browser-tab
 *  admin to get locked out if they hit `/login`.
 *
 *  Race-safe linking: if the matching row has no `authUserId` yet, we
 *  link it via `updateMany({ where: { id, authUserId: null } })` so a
 *  concurrent verify of the same email can't P2002.
 * =====================================================================
 */
export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
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
      message: "Please fix the highlighted fields and try again.",
      fieldErrors,
    };
  }

  // ---- 2. Soft-fail when Supabase isn't configured (placeholder env) ---
  if (!isSupabaseConfigured()) {
    return {
      status: "notice",
      email,
      message:
        "Login is offline right now. Reach out to the project team to verify your record.",
    };
  }

  // ---- 3. Attempt the password sign-in --------------------------------
  let userId: string;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      console.warn("[login] signInWithPassword error:", error.message);
      // Gate 1: Supabase email confirmation. The default Supabase error
      // message when `confirmEmail` is enabled is "Email not confirmed".
      if (/confirm/i.test(error.message)) {
        return {
          status: "notice",
          email,
          message:
            "Please confirm your email first. Check your inbox for the confirmation link we sent when you signed up.",
        };
      }
      // Generic message — never reveal whether the email exists or the
      // password was the wrong one.
      return {
        status: "error",
        message: "Incorrect email or password.",
      };
    }
    userId = data.user?.id ?? "";
    if (!userId) {
      return {
        status: "error",
        message:
          "Sign-in succeeded but no user was returned. Please try again.",
      };
    }
  } catch (err) {
    console.warn("[login] signInWithPassword threw:", err);
    return {
      status: "error",
      message: "We couldn't sign you in just now. Please try again.",
    };
  }

  // ---- 4. Resolve identity WITHOUT trusting form input ----------------
  // Look up by the email we attempted to sign in as — never by anything
  // the user typed that could be ambiguous.
  let destination: string;
  try {
    // 1. Admin path — wins over stakeholder if the same email is both.
    const admin = await prisma.admin.findFirst({ where: { email } });
    if (admin) {
      // Race-safe link (non-fatal if it fails — the email fallback in
      // getCurrentAdmin still resolves this user).
      try {
        if (!admin.authUserId) {
          await prisma.admin.updateMany({
            where: { id: admin.id, authUserId: null },
            data: { authUserId: userId },
          });
        }
      } catch (linkErr) {
        console.warn(
          "[login] admin authUserId link failed (non-fatal):",
          linkErr,
        );
      }
      destination = "/admin";
    } else {
      // 2. Stakeholder path.
      const stakeholder = await prisma.stakeholder.findFirst({
        where: { email, deletedAt: null },
      });

      if (!stakeholder) {
        // Force sign-out — we authenticated a Supabase user but they
        // have no domain row. Leaving the session alive would let them
        // poke around gated routes until requireStakeholder bounces
        // them, which is a worse UX than a clean denial here.
        try {
          const supabase = await createClient();
          await supabase.auth.signOut();
        } catch (signOutErr) {
          console.warn(
            "[login] post-deny signOut failed (non-fatal):",
            signOutErr,
          );
        }
        return {
          status: "error",
          message:
            "We couldn't find a stakeholder record for this account. Please contact the project team.",
        };
      }

      // Gate 2: admin must have verified this stakeholder's payment.
      if (!stakeholder.verifiedAt) {
        try {
          const supabase = await createClient();
          await supabase.auth.signOut();
        } catch (signOutErr) {
          console.warn(
            "[login] post-deny signOut failed (non-fatal):",
            signOutErr,
          );
        }
        return {
          status: "notice",
          email,
          message:
            "Your account isn't active yet. An administrator will verify your payment and enable login — you'll be able to sign in after that.",
        };
      }

      // Race-safe link.
      try {
        if (!stakeholder.authUserId) {
          await prisma.stakeholder.updateMany({
            where: { id: stakeholder.id, authUserId: null },
            data: { authUserId: userId },
          });
        }
      } catch (linkErr) {
        console.warn(
          "[login] stakeholder authUserId link failed (non-fatal):",
          linkErr,
        );
      }
      destination = "/dashboard";
    }
  } catch (err) {
    console.warn("[login] domain lookup failed:", err);
    // DB hiccup while resolving identity — keep the user signed out
    // rather than leaving an un-linked session behind.
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

  // ---- 5. Redirect to the role-based destination ----------------------
  // redirect() throws — must be OUTSIDE the try/catch above, otherwise
  // the redirect would be swallowed by a generic catch.
  redirect(destination);
}
