import 'server-only';
import { cookies } from 'next/headers';

// __Host- prefix (Secure + Path=/ + no Domain) in production over HTTPS.
// Development runs on plain HTTP, where browsers reject Secure cookies — so
// dev uses a plain name without the Secure flag. Same session semantics.
export const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === 'production' ? '__Host-neobee_session' : 'neobee_session';
export const SESSION_COOKIE_SECURE = process.env.NODE_ENV === 'production';
// 24h, matching the default session TTL used by store.createSession.
export const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24;

export async function setSessionCookie(token: string): Promise<void> {
  // sameSite is 'lax' on purpose: 'strict' would break top-navigation links
  // opened from email clients (e.g. clicking a verification/reset link opens the
  // app in a top-level navigation where a Strict cookie is dropped), whereas
  // 'lax' survives that navigation while still blocking the cross-site
  // CSRF-style reads this cookie is not meant for.
  const jar = await cookies();
  jar.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: SESSION_COOKIE_SECURE,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete({
    name: SESSION_COOKIE_NAME,
    path: '/',
    secure: SESSION_COOKIE_SECURE,
    httpOnly: true,
    sameSite: 'lax',
  });
}

export async function getSessionCookieToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE_NAME)?.value ?? null;
}
