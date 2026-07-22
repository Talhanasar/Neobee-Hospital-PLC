"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import {
  amountFor,
  CATEGORY_LABEL,
  categoryFor,
  fmt,
  incentiveFor,
  type ShareCategory,
} from "@/lib/business";
import {
  adminCreateInitialState,
  type AdminCreateState,
} from "../states";
import { adminCreateStakeholderAction } from "../actions";

// Same deposit-method vocabulary as the public signup — keeps the UI
// consistent across stakeholder-facing and admin-facing forms.
const DEPOSIT_METHODS = [
  "Bank deposit — NEOBEE account",
  "Bank transfer",
  "Cheque",
  "Mobile banking",
] as const;

export default function AdminAddForm() {
  const [state, formAction, pending] = useActionState<AdminCreateState, FormData>(
    adminCreateStakeholderAction,
    adminCreateInitialState,
  );

  // Controlled inputs for the live financial preview. Server recomputes
  // the same numbers — the preview is purely UX, never authoritative.
  const [shares, setShares] = useState<number>(1);
  const [isFoundingEntrepreneur, setIsFoundingEntrepreneur] =
    useState<boolean>(false);

  const safeShares =
    Number.isFinite(shares) && shares >= 1 && shares <= 100
      ? Math.floor(shares)
      : 1;

  const category: ShareCategory = categoryFor(safeShares);
  const amount = amountFor(safeShares);
  const incentive = incentiveFor(safeShares, isFoundingEntrepreneur);

  const fieldErrors =
    state.status === "error" && state.fieldErrors ? state.fieldErrors : {};

  const idBase = useId();
  const inputId = (k: string) => `${idBase}-${k}`;
  const errId = (k: string) => `${inputId(k)}-err`;

  // Success state — show the issued IDs prominently + a link back.
  if (state.status === "success") {
    return (
      <div className="rounded-2xl border border-line bg-panel p-7">
        <div
          role="status"
          className="rounded-xl border border-green bg-green-soft px-4 py-3 text-[13.5px] text-green"
        >
          {state.message}
        </div>
        <dl className="mt-5 grid grid-cols-1 gap-x-4 gap-y-2 text-[14px] sm:grid-cols-[170px_1fr]">
          <Row label="Unique ID" value={state.uniqueId} mono />
          <Row label="Verification code" value={state.verificationCode} mono />
        </dl>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-full bg-honey px-5 py-2.5 font-display text-[13px] font-bold tracking-tight text-ink shadow-sm transition-colors hover:bg-[#d99408]"
          >
            ← Back to dashboard
          </Link>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center rounded-full border border-line bg-panel px-5 py-2.5 text-[13px] font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink"
          >
            Add another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      noValidate
      className="rounded-2xl border border-line bg-panel p-6 sm:p-7"
    >
      {state.status === "error" && state.message && !state.fieldErrors && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-amber bg-amber-soft px-3.5 py-2.5 text-[13px] text-ink"
        >
          {state.message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          id={inputId("name")}
          label="Shareholder name *"
          error={fieldErrors.name}
          errorId={errId("name")}
        >
          <input
            id={inputId("name")}
            name="name"
            type="text"
            required
            placeholder="e.g. Farhana Rahman"
            aria-invalid={fieldErrors.name ? true : undefined}
            aria-describedby={fieldErrors.name ? errId("name") : undefined}
            className={inputClass(Boolean(fieldErrors.name))}
          />
        </Field>

        <Field
          id={inputId("phone")}
          label="Phone"
          help="For the share registry / receipts."
        >
          <input
            id={inputId("phone")}
            name="phone"
            type="text"
            placeholder="e.g. 01700-000000"
            className={inputClass(false)}
          />
        </Field>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          id={inputId("email")}
          label="Email"
          help="Optional — used to attach to an existing stakeholder if they have one."
          error={fieldErrors.email}
          errorId={errId("email")}
        >
          <input
            id={inputId("email")}
            name="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="off"
            aria-invalid={fieldErrors.email ? true : undefined}
            aria-describedby={fieldErrors.email ? errId("email") : undefined}
            className={inputClass(Boolean(fieldErrors.email))}
          />
        </Field>

        <Field id={inputId("nid")} label="NID / passport">
          <input
            id={inputId("nid")}
            name="nid"
            type="text"
            placeholder="For share registry"
            className={inputClass(false)}
          />
        </Field>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          id={inputId("shares")}
          label="Number of shares *"
          help="1 share = ৳2,00,000"
          error={fieldErrors.shares}
          errorId={errId("shares")}
        >
          <input
            id={inputId("shares")}
            name="shares"
            type="number"
            min={1}
            max={100}
            step={1}
            required
            value={shares}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              setShares(Number.isFinite(n) ? n : 1);
            }}
            aria-invalid={fieldErrors.shares ? true : undefined}
            aria-describedby={fieldErrors.shares ? errId("shares") : undefined}
            className={inputClass(Boolean(fieldErrors.shares))}
          />
        </Field>

        <Field id={inputId("category")} label="Category (auto)">
          <input
            id={inputId("category")}
            type="text"
            readOnly
            value={CATEGORY_LABEL[category]}
            tabIndex={-1}
            className={inputClass(false) + " bg-neutral-soft text-ink-soft"}
          />
        </Field>
      </div>

      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-honey-soft bg-honey-soft/50 p-3 text-[13.5px] leading-relaxed text-ink">
        <input
          id={inputId("entre")}
          name="isFoundingEntrepreneur"
          type="checkbox"
          checked={isFoundingEntrepreneur}
          onChange={(e) => setIsFoundingEntrepreneur(e.target.checked)}
          className="mt-[3px] h-[17px] w-[17px] flex-none accent-[color:var(--honey-deep)]"
        />
        <label htmlFor={inputId("entre")} className="cursor-pointer">
          <b>Founding entrepreneur</b> — one of the 50 project entrepreneurs
          (৳20 lakh entry, used for land registration bayna). Entitled to
          the ৳20,000 per-share incentive.
        </label>
      </div>

      <CalcBox
        shares={safeShares}
        amount={amount}
        incentive={incentive}
        isFoundingEntrepreneur={isFoundingEntrepreneur}
      />

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id={inputId("depositDate")} label="Deposit date">
          <input
            id={inputId("depositDate")}
            name="depositDate"
            type="date"
            className={inputClass(false)}
          />
        </Field>

        <Field id={inputId("depositMethod")} label="Deposit method">
          <select
            id={inputId("depositMethod")}
            name="depositMethod"
            defaultValue=""
            className={inputClass(false)}
          >
            <option value="">— Select —</option>
            {DEPOSIT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id={inputId("paymentReference")} label="Bank / payment reference">
          <input
            id={inputId("paymentReference")}
            name="paymentReference"
            type="text"
            placeholder="Deposit slip / cheque no."
            className={inputClass(false)}
          />
        </Field>

        <Field
          id={inputId("status")}
          label="Status"
          help="Mark CONFIRMED only when the offline deposit is already verified."
        >
          <select
            id={inputId("status")}
            name="status"
            defaultValue="PENDING"
            className={inputClass(false)}
          >
            <option value="PENDING">Pending (awaiting stakeholder confirm)</option>
            <option value="CONFIRMED">Confirmed (already verified)</option>
          </select>
        </Field>
      </div>

      <div className="mt-4">
        <Field id={inputId("notes")} label="Notes">
          <textarea
            id={inputId("notes")}
            name="notes"
            rows={2}
            placeholder="Optional admin note"
            className={inputClass(false) + " resize-y"}
          />
        </Field>
      </div>

      {state.status === "error" && state.message && state.fieldErrors && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-amber bg-amber-soft px-3.5 py-2.5 text-[13px] text-ink"
        >
          {state.message}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2.5">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center rounded-full bg-honey px-6 py-3 font-display text-[14px] font-bold tracking-tight text-ink shadow-sm transition-colors hover:bg-[#d99408] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-honey-deep"
        >
          {pending ? "Saving…" : "Save stakeholder"}
        </button>
        <Link
          href="/admin"
          className="inline-flex items-center justify-center rounded-full border border-line bg-panel px-5 py-3 text-[14px] font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

// ---------- sub-components -------------------------------------------------

function Field({
  id,
  label,
  help,
  error,
  errorId,
  children,
}: {
  id: string;
  label: string;
  help?: string;
  error?: string;
  errorId?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-1">
      <label
        htmlFor={id}
        className="mb-1.5 block text-[12.5px] font-semibold text-ink"
      >
        {label}
      </label>
      {children}
      {help && !error && (
        <div className="mt-1 text-[12px] text-ink-soft">{help}</div>
      )}
      {error && (
        <div id={errorId} className="mt-1 text-[12px] font-semibold text-[#b3261e]">
          {error}
        </div>
      )}
    </div>
  );
}

function inputClass(hasError: boolean): string {
  return (
    "block w-full rounded-lg border bg-paper px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-soft/70 " +
    "focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-honey " +
    (hasError
      ? "border-[#b3261e] focus:border-[#b3261e] focus-visible:outline-[#b3261e]"
      : "border-line focus:border-honey")
  );
}

function CalcBox({
  shares,
  amount,
  incentive,
  isFoundingEntrepreneur,
}: {
  shares: number;
  amount: number;
  incentive: number;
  isFoundingEntrepreneur: boolean;
}) {
  return (
    <div
      aria-live="polite"
      className="my-5 rounded-xl border border-[#D9BE79] bg-honey-soft/60 px-4 py-3 text-[13.5px]"
    >
      <CalcRow
        label={`${shares} share${shares === 1 ? "" : "s"} × ৳2,00,000`}
        value={fmt(amount)}
      />
      {isFoundingEntrepreneur && (
        <CalcRow
          label={`Entrepreneur share incentive (${shares} × ৳20,000)`}
          value={`+ ${fmt(incentive)} in bonus shares`}
        />
      )}
      <div className="mt-1.5 flex items-baseline justify-between gap-3 border-t border-dashed border-[#D9BE79] pt-2 font-semibold">
        <span>Amount to deposit</span>
        <span className="font-mono">{fmt(amount)}</span>
      </div>
    </div>
  );
}

function CalcRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-[3px]">
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <>
      <dt className="text-ink-soft">{label}</dt>
      <dd className={mono ? "font-mono font-medium" : "font-medium"}>
        {value}
      </dd>
    </>
  );
}
