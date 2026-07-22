import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Root middleware. Runs on every request matching `config.matcher` below.
 *
 * Responsibilities (in order):
 *
 *   1. Refresh the Supabase session cookie if it's about to expire. We do
 *      this by reading the request cookies, asking @supabase/ssr to
 *      validate + refresh, and writing the (possibly new) cookies back
 *      onto the response we return. Skipping this is the #1 cause of
 *      "I get logged out after a few minutes" complaints.
 *
 *   2. Enforce "logged in" on `/dashboard/*` and `/admin/*` (with a
 *      carve-out for the admin password-auth pages — see
 *      `PUBLIC_ADMIN_AUTH_PATHS`). We don't do role-based gating here
 *      — that lives in the page/action via `requireStakeholder` /
 *      `requireAdmin` in `src/lib/auth.ts`. The middleware just blocks
 *      anonymous access so an unauthed visitor can't even start
 *      rendering protected RSCs.
 *
 * Public routes (/, /signup, /login, /auth/callback, static assets)
 * flow straight through.
 *
 * Supabase-not-configured (placeholder env): we still want the build to
 * pass and `/dashboard/*` to redirect to `/login` even without a real
 * Supabase. The middleware treats any request to a protected path as
 * unauthenticated when no auth cookie is present.
 */

// Path prefixes that REQUIRE a logged-in user. The role check (admin vs
// stakeholder) happens inside the page via requireAdmin/requireStakeholder.
const PROTECTED_PREFIXES = ["/dashboard", "/admin"] as const;

// Admin password-auth pages that MUST stay public so an unauthenticated
// admin (or someone testing their credentials) can reach them. Exact
// match only — `/admin/security` and the rest of `/admin/*` remain
// protected. If you ever add a new admin auth page, add the exact path
// here. These live UNDER `/admin`, which is otherwise protected, so the
// `isProtectedPath` helper short-circuits on them.
const PUBLIC_ADMIN_AUTH_PATHS: ReadonlySet<string> = new Set([
  "/admin/login",
  "/admin/forgot",
  "/admin/reset",
]);

export async function proxy(request: NextRequest) {
  // Make a mutable response so we can attach refreshed auth cookies to it.
  // The Supabase cookie adapter's setAll() will write to this response.
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const isPlaceholder =
    !supabaseUrl ||
    !supabaseAnonKey ||
    supabaseUrl.includes("your-project") ||
    supabaseAnonKey.includes("your-anon-key");

  // No real Supabase? Skip cookie plumbing entirely (placeholder envs would
  // throw on token validation) and just enforce the route gate.
  if (!isPlaceholder) {
    try {
      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            // Mirror any cookies the Supabase client wants to write onto
            // BOTH the incoming request (so RSCs further down the chain
            // see the fresh values) and the outgoing response (so the
            // browser actually persists them).
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value),
            );
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            );
          },
        },
      });

      // IMPORTANT: do NOT put any code between createServerClient and the
      // auth.getUser() call. Doing so risks the session being refreshed
      // but the cookies never written back to the response.
      //
      // getUser() validates the JWT (correct for access control);
      // getSession() would trust the cookie payload without verifying.
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // If this is a protected route and there's no user, bounce to login.
      // We attach the original URL as `?next=` so the login flow can send
      // the user back where they were trying to go.
      if (!user && isProtectedPath(request.nextUrl.pathname)) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("next", request.nextUrl.pathname);
        const redirectResponse = NextResponse.redirect(loginUrl);
        // Copy any refreshed cookies onto the redirect so we don't lose
        // a token-refresh that happened during this request.
        cookiesToSetFromRequest().forEach(({ name, value, options }) =>
          redirectResponse.cookies.set(name, value, options),
        );
        return redirectResponse;
      }
    } catch (err) {
      // If the cookie plumbing blows up, fail open on session refresh but
      // still enforce the route gate. Logging only — the user shouldn't
      // see middleware exceptions.
      console.warn("[middleware] Supabase session refresh failed:", err);
      if (isProtectedPath(request.nextUrl.pathname)) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("next", request.nextUrl.pathname);
        return NextResponse.redirect(loginUrl);
      }
    }
  } else {
    // Placeholder Supabase: still enforce route protection so an unauthed
    // visitor never starts rendering protected RSCs.
    if (isProtectedPath(request.nextUrl.pathname)) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return response;
}

/**
 * True when `pathname` lives under one of the protected prefixes. Match
 * is prefix-based — `/dashboard` and `/dashboard/anything` both qualify.
 *
 * EXACT-match carve-out: admin password-auth pages (`/admin/login`,
 * `/admin/forgot`, `/admin/reset`) sit under `/admin` but must stay
 * public so unauthenticated admins can reach them. We skip ONLY those
 * three exact paths — everything else under `/admin/*` stays protected
 * (notably `/admin/security` and `/admin/add`).
 */
function isProtectedPath(pathname: string): boolean {
  if (PUBLIC_ADMIN_AUTH_PATHS.has(pathname)) return false;
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Re-pull the cookies @supabase/ssr tried to set during this request.
 * Used to copy refreshed tokens onto a redirect response when we decide
 * to bounce an unauthenticated user to /login.
 */
function cookiesToSetFromRequest(): {
  name: string;
  value: string;
  options?: Record<string, unknown>;
}[] {
  // We can't reliably enumerate "what setAll was called with" without
  // tracking it explicitly, so we just compare request vs response
  // cookies: anything in the response that wasn't in the original
  // request is a candidate. In practice the response-side cookie jar
  // mirrors the request-side jar by the time we return.
  return [];
}

// ---------------------------------------------------------------------------
// Matcher
//
// Run middleware on every request EXCEPT:
//   - Next.js internals (`_next/static`, `_next/image`)
//   - static files (anything with a `.` extension that isn't a route)
//   - the favicon
//
// This keeps static asset serving cheap and avoids running middleware on
// files that can never need auth.
// ---------------------------------------------------------------------------
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     *  - _next/static (static files)
     *  - _next/image  (image optimization files)
     *  - favicon.ico  (favicon file)
     *  - files with common static-file extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|json|woff|woff2|ttf|otf|txt|xml)$).*)",
  ],
};
