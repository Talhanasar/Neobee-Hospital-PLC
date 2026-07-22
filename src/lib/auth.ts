import "server-only";

import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { Admin, Stakeholder } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

/**
 * Server-only auth helpers for the Neobee portal.
 *
 * These are the SINGLE SOURCE OF TRUTH for "who is the current user?" on the
 * server. All Server Components, Server Actions, and Route Handlers that need
 * to know the caller's identity MUST go through this module — never call
 * Supabase directly or query Prisma for the stakeholder/admin row ad hoc,
 * or you will end up with two divergent definitions of "me".
 *
 * The helpers fall back to a legacy email match when a domain row has not
 * yet been linked to its Supabase `authUserId`. This keeps existing users
 * (signed up before auth linking shipped) working — but new logic should
 * always persist the link via the signInWithPassword path in
 * `src/app/login/actions.ts`.
 */

/**
 * Detect obviously placeholder Supabase credentials so we can soft-fail the
 * OTP step without aborting the DB write.
 *
 * Mirrors the check used in `src/app/signup/actions.ts`. Kept in sync by
 * copy rather than import so the signup module can stay self-contained.
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !key) return false;
  if (url.includes("your-project")) return false;
  if (key.includes("your-anon-key")) return false;
  return true;
}

/**
 * Returns the current Supabase auth `User` (or `null` if no session).
 *
 * Uses `supabase.auth.getUser()` — the JWT-validating call. `getSession()`
 * would be faster but trusts the cookie payload, which is the wrong default
 * for any access-control decision.
 */
export async function getSessionUser(): Promise<User | null> {
  // If Supabase isn't configured there is no real session to read — short
  // circuit so the page doesn't try to validate a placeholder JWT and throw.
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}

/**
 * Returns the `Stakeholder` row for the current auth user, or `null`.
 *
 * Resolution order:
 *   1. `Stakeholder.authUserId === user.id` (the canonical link)
 *   2. fallback to `Stakeholder.email === user.email` — handles the gap
 *      between "signed up via /signup" and "verified their first OTP", where
 *      the domain row exists but has not yet been linked to a Supabase user.
 *
 * The email fallback only fires when `user.email` is present and confirmed.
 * If both lookups miss, returns `null` (caller decides whether to redirect).
 */
export async function getCurrentStakeholder(): Promise<Stakeholder | null> {
  const user = await getSessionUser();
  if (!user) return null;

  // 1. canonical link by authUserId (exclude soft-deleted stakeholders)
  try {
    const byAuthId = await prisma.stakeholder.findFirst({
      where: { authUserId: user.id, deletedAt: null },
    });
    if (byAuthId) return byAuthId;
  } catch (err) {
    console.warn("[auth] stakeholder lookup by authUserId failed", err);
  }

  // 2. fallback by email — covers un-linked stakeholders (legacy signup data,
  //    or the same user verifying on a device before the link ran).
  //    Defense-in-depth: skip the email lookup unless Supabase has confirmed
  //    ownership of the address (user.email_confirmed_at is set).
  const email = user.email?.toLowerCase();
  if (!email) return null;
  if (!user.email_confirmed_at) return null;

  try {
    // findFirst (not findUnique) so we can AND in the deletedAt: null gate —
    // Prisma's findUnique only accepts unique fields in `where`.
    return await prisma.stakeholder.findFirst({
      where: { email, deletedAt: null },
    });
  } catch (err) {
    console.warn("[auth] stakeholder lookup by email failed", err);
    return null;
  }
}

/**
 * Returns the `Admin` row for the current auth user, or `null`.
 *
 * Same resolution pattern as `getCurrentStakeholder`:
 *   1. `Admin.authUserId === user.id`
 *   2. fallback to `Admin.email === user.email`
 */
export async function getCurrentAdmin(): Promise<Admin | null> {
  const user = await getSessionUser();
  if (!user) return null;

  try {
    const byAuthId = await prisma.admin.findUnique({
      where: { authUserId: user.id },
    });
    if (byAuthId) return byAuthId;
  } catch (err) {
    console.warn("[auth] admin lookup by authUserId failed", err);
  }

  const email = user.email?.toLowerCase();
  if (!email) return null;
  // Defense-in-depth: only fall back to an email match when Supabase has
  // confirmed the user owns that address (user.email_confirmed_at is set).
  if (!user.email_confirmed_at) return null;

  try {
    return await prisma.admin.findUnique({ where: { email } });
  } catch (err) {
    console.warn("[auth] admin lookup by email failed", err);
    return null;
  }
}

/**
 * Like `getCurrentStakeholder` but throws a redirect to `/login` when no
 * stakeholder is bound to the current user. Use this on pages that REQUIRE
 * a stakeholder session (e.g. `/dashboard/*`).
 */
export async function requireStakeholder(): Promise<Stakeholder> {
  const me = await getCurrentStakeholder();
  if (!me) redirect("/login");
  // Admin payment verification gate: a stakeholder with no verifiedAt has
  // registered (and may have confirmed their email) but an admin has not yet
  // marked their payment verified. Block dashboard access until then.
  if (!me.verifiedAt) redirect("/login?pending=1");
  return me;
}

/**
 * Like `getCurrentAdmin` but redirects to `/login` when the caller is not an
 * admin. The `?denied=1` flag lets the login page render a friendly notice
 * ("you're logged in, but not an admin").
 *
 * Note: admin-vs-stakeholder role enforcement happens HERE, not in the
 * middleware. The middleware only enforces "logged in"; fine-grained
 * role checks live in the page/action so that the same middleware can
 * guard `/admin/*` and `/dashboard/*` without coupling to the role model.
 */
export async function requireAdmin(): Promise<Admin> {
  const me = await getCurrentAdmin();
  if (!me) redirect("/login?denied=1");
  return me;
}

/**
 * Server action: signs the current user out and redirects to `/`.
 *
 * Kept here rather than colocated with the login flow so any Server Action,
 * button, or route handler can `import { signOut } from "@/lib/auth"` and
 * reuse the same logout semantics (including the soft-fail when Supabase
 * isn't configured, so logout never bricks the UI during local dev).
 */
export async function signOut(): Promise<void> {
  "use server";
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("[auth] signOut failed", err);
    }
  }
  redirect("/");
}
