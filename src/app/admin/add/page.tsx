import Link from "next/link";

import { requireAdmin } from "@/lib/auth";

import AdminAddForm from "./AdminAddForm";

// Manual add page — per-request, admin session.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Add stakeholder — Admin — Neobee Hospital PLC",
  description:
    "Manually register a stakeholder for an offline-collected deposit.",
};

export default async function AdminAddStakeholderPage() {
  // Defense-in-depth — proxy already enforces "logged in", this enforces
  // "is admin".
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
          Admin · Manual add
        </div>
        <h1 className="font-display text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-ink sm:text-[30px]">
          Add stakeholder
        </h1>
        <p className="mt-2 max-w-[640px] text-[14.5px] leading-relaxed text-ink-soft">
          Manually register a stakeholder for an offline-collected deposit.
          A unique ID and verification code will be issued on save. No OTP
          is required — the admin is entering verified information.
        </p>
      </header>

      <div className="rounded-2xl border border-line bg-panel p-5 sm:p-7 shadow-sm">
        <AdminAddForm />
      </div>
    </main>
  );
}
