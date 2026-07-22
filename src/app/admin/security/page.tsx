import Link from "next/link";

import { requireAdmin } from "@/lib/auth";

import AdminSecurityForm from "./AdminSecurityForm";

// Protected page — admin session required. Per-request.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Security — Admin — Neobee Hospital PLC",
  description: "Change the password on your Neobee admin account.",
};

export default async function AdminSecurityPage() {
  // requireAdmin() — defense-in-depth. Proxy.ts already enforces
  // "logged in" on /admin/security; this enforces "is an admin".
  await requireAdmin();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-20 pt-7 sm:pt-9">
      <header className="mb-7">
        <Link
          href="/admin"
          className="text-[13px] font-semibold text-ink-soft transition-colors hover:text-ink"
        >
          ← Back to dashboard
        </Link>
        <div className="mt-3 mb-3 inline-flex items-center gap-2 rounded-full border border-honey-soft bg-honey-soft/70 px-3 py-1 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-honey-deep">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-honey-deep" />
          Admin · Security
        </div>
        <h1 className="font-display text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-ink sm:text-[30px]">
          Change your password
        </h1>
        <p className="mt-2 max-w-[640px] text-[14.5px] leading-relaxed text-ink-soft">
          Update the password on your admin account. You&apos;ll need to enter
          your current password to confirm the change.
        </p>
      </header>

      <div className="rounded-2xl border border-line bg-panel p-5 sm:p-7 shadow-sm">
        <AdminSecurityForm />
      </div>

      <p className="mt-5 text-[12.5px] text-ink-soft">
        Forgot your current password? Use the{" "}
        <Link
          href="/admin/forgot"
          className="font-semibold text-honey-deep underline-offset-2 hover:underline"
        >
          forgot password
        </Link>{" "}
        flow to receive a reset link instead.
      </p>
    </main>
  );
}
