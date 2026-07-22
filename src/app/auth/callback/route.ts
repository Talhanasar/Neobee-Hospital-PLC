import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { isSupabaseConfigured } from "@/lib/auth";

/**
 * Magic-link / OAuth callback handler.
 *
 * Flow:
 *   1. Supabase emails the user a link of the form
 *      `${SITE_URL}/auth/callback?code=...`.
 *   2. The user clicks it; this route handler runs.
 *   3. We exchange the one-time `code` for a session via
 *      `supabase.auth.exchangeCodeForSession(code)` — the @supabase/ssr
 *      cookie adapter writes the session cookies on the response we
 *      return.
 *   4. We then look up the matching domain row (Admin first, then
 *      Stakeholder) and link `authUserId` so future server reads can
 *      resolve "me" by auth id instead of email.
 *   5. Redirect to `/admin` for admins, `/dashboard` for stakeholders,
 *      `/login` as a fallback.
 *
 * Errors (missing/invalid code, exchange failure, Supabase not
 * configured) all redirect back to `/login?error=1` rather than
 * rendering HTML — the user always gets a navigable page.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextRaw = url.searchParams.get("next");
  const next = sanitizeNext(nextRaw);

  // Supabase not configured (placeholder creds) — bounce to /login with a
  // soft error flag so the page can show a notice instead of crashing.
  if (!isSupabaseConfigured()) {
    return redirectTo(request, "/login?error=supabase_not_configured");
  }

  if (!code) {
    return redirectTo(request, "/login?error=missing_code");
  }

  // exchangeCodeForSession sets the session cookies via the cookie adapter.
  // If it throws or returns an error, fall back to /login.
  let userId: string | null = null;
  let userEmail: string | null | undefined = null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) {
      console.warn("[auth/callback] exchangeCodeForSession error:", error?.message);
      return redirectTo(request, "/login?error=invalid_code");
    }
    userId = data.user.id;
    userEmail = data.user.email;
  } catch (err) {
    console.warn("[auth/callback] exchange threw:", err);
    return redirectTo(request, "/login?error=exchange_failed");
  }

  // Link the Supabase identity to the domain row. Non-fatal: if the DB
  // is down or the row doesn't exist yet, still send the user to the
  // dashboard so the empty-state copy can guide them.
  let destination = "/dashboard";
  try {
    const normalized = userEmail?.toLowerCase() ?? "";
    if (normalized) {
      const admin = await prisma.admin.findUnique({
        where: { email: normalized },
      });
      if (admin) {
        if (!admin.authUserId) {
          await prisma.admin.updateMany({
            where: { id: admin.id, authUserId: null },
            data: { authUserId: userId },
          });
        }
        destination = "/admin";
      } else {
        const stakeholder = await prisma.stakeholder.findUnique({
          where: { email: normalized },
        });
        if (stakeholder && !stakeholder.authUserId) {
          await prisma.stakeholder.updateMany({
            where: { id: stakeholder.id, authUserId: null },
            data: { authUserId: userId },
          });
        }
      }
    }
  } catch (err) {
    console.warn("[auth/callback] auth-link DB step failed (non-fatal):", err);
  }

  // If the caller supplied a safe `?next=` we honour it; otherwise the
  // role-based default.
  const finalDestination =
    next && next !== "/login" ? next : destination;
  return redirectTo(request, finalDestination);
}

/**
 * Build a NextResponse.redirect against the same origin so the Set-Cookie
 * headers we attached during code-exchange survive the redirect.
 *
 * `NextResponse.redirect` requires an absolute URL — we resolve it from
 * the incoming request to support any host / port (Vercel previews, etc.).
 */
function redirectTo(request: NextRequest, path: string): NextResponse {
  const target = new URL(path, request.url);
  return NextResponse.redirect(target);
}

/**
 * Only allow same-origin relative paths in `?next=`. Anything else
 * (absolute URLs, protocol-relative, javascript:, etc.) is discarded.
 */
function sanitizeNext(raw: string | null): string | null {
  if (!raw) return null;
  // Reject anything that isn't a leading "/" — covers absolute URLs,
  // //evil.example, and pseudo-protocols in one check.
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}
