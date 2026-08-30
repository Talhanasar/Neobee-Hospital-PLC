/**
 * Client-side demo-mode flag. Mirrors the server's DEMO_DATA switch through
 * the same env var — safe to import anywhere (no server code pulled in).
 */
export function isDemoClient(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_DATA === 'true';
}
