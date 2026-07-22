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
  signupInitialState,
  submitSignup,
  type SignupState,
} from "@/app/signup/actions";

// Deposit-method options — verbatim from approved prototype.
const DEPOSIT_METHODS = [
  "Bank deposit — NEOBEE account",
  "Bank transfer",
  "Cheque",
  "Mobile banking",
] as const;

export default function SignupForm() {
  const [state, formAction, pending] = useActionState<SignupState, FormData>(
    submitSignup,
    signupInitialState,
  );

  // Controlled inputs for the live calc + a friendlier "category" pill.
  const [shares, setShares] = useState<number>(1);
  const [isFoundingEntrepreneur, setIsFoundingEntrepreneur] =
    useState<boolean>(false);

  const safeShares =
    Number.isFinite(shares) && shares >= 1 && shares <= 100 ? Math.floor(shares) : 1;

  const category: ShareCategory = categoryFor(safeShares);
  const amount = amountFor(safeShares);
  const incentive = incentiveFor(safeShares, isFoundingEntrepreneur);

  const fieldErrors =
    state.status === "error" && state.fieldErrors ? state.fieldErrors : {};

  // useId() ensures SSR/CSR markup match for the input ids even if more
  // than one SignupForm ever renders on a page.
  const idBase = useId();
  const inputId = (key: string) => `${idBase}-${key}`;
  const errId = (key: string) => `${inputId(key)}-err`;

  return (
    <form
      action={formAction}
      // noValidate: the server is the source of truth on validation; we
      // still get browser UX for `required`/`type=email` but don't block
      // submission on a client-side regex disagreement.
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

      <SectionHeading label="Identity" />

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
          id={inputId("contact")}
          label="Phone / email"
          help="General contact — email below is what we'll use to log you in."
        >
          <input
            id={inputId("contact")}
            name="contact"
            type="text"
            placeholder="e.g. 01700-000000"
            className={inputClass(false)}
          />
        </Field>
      </div>

      {/* Email captured separately so the login identity is unambiguous. */}
      <Field
        id={inputId("email")}
        label="Email (for login) *"
        help="You'll log in with this email and the password below."
        error={fieldErrors.email}
        errorId={errId("email")}
      >
        <input
          id={inputId("email")}
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          autoComplete="email"
          aria-invalid={fieldErrors.email ? true : undefined}
          aria-describedby={fieldErrors.email ? errId("email") : undefined}
          className={inputClass(Boolean(fieldErrors.email))}
        />
      </Field>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          id={inputId("password")}
          label="Password *"
          help="At least 8 characters. You'll use this to log in."
          error={fieldErrors.password}
          errorId={errId("password")}
        >
          <input
            id={inputId("password")}
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            aria-invalid={fieldErrors.password ? true : undefined}
            aria-describedby={fieldErrors.password ? errId("password") : undefined}
            className={inputClass(Boolean(fieldErrors.password))}
          />
        </Field>

        <Field
          id={inputId("confirmPassword")}
          label="Confirm password *"
          error={fieldErrors.confirmPassword}
          errorId={errId("confirmPassword")}
        >
          <input
            id={inputId("confirmPassword")}
            name="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            aria-invalid={fieldErrors.confirmPassword ? true : undefined}
            aria-describedby={
              fieldErrors.confirmPassword ? errId("confirmPassword") : undefined
            }
            className={inputClass(Boolean(fieldErrors.confirmPassword))}
          />
        </Field>
      </div>

      <SectionHeading label="Investment" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            aria-describedby={
              fieldErrors.shares ? errId("shares") : undefined
            }
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
          (৳20 lakh entry, used for land registration bayna). Entitled to the
          ৳20,000 per-share incentive.
        </label>
      </div>

      <CalcBox
        shares={safeShares}
        amount={amount}
        incentive={incentive}
        isFoundingEntrepreneur={isFoundingEntrepreneur}
      />

      <SectionHeading label="Deposit details" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id={inputId("depositDate")} label="Deposit date">
          <input
            id={inputId("depositDate")}
            name="depositDate"
            type="date"
            className={inputClass(false)}
          />
        </Field>

        <Field
          id={inputId("depositMethod")}
          label="Deposit method"
          error={fieldErrors.depositMethod}
          errorId={errId("depositMethod")}
        >
          <select
            id={inputId("depositMethod")}
            name="depositMethod"
            defaultValue={DEPOSIT_METHODS[0]}
            aria-invalid={fieldErrors.depositMethod ? true : undefined}
            aria-describedby={
              fieldErrors.depositMethod ? errId("depositMethod") : undefined
            }
            className={inputClass(Boolean(fieldErrors.depositMethod))}
          >
            {DEPOSIT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          id={inputId("paymentReference")}
          label="Bank / payment reference"
        >
          <input
            id={inputId("paymentReference")}
            name="paymentReference"
            type="text"
            placeholder="Deposit slip / cheque no."
            className={inputClass(false)}
          />
        </Field>

        <Field id={inputId("nid")} label="NID / passport (optional)">
          <input
            id={inputId("nid")}
            name="nid"
            type="text"
            placeholder="For share registry"
            className={inputClass(false)}
          />
        </Field>
      </div>

      <div className="mt-4">
        <Field id={inputId("notes")} label="Notes">
          <textarea
            id={inputId("notes")}
            name="notes"
            rows={2}
            placeholder="Optional"
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
          {pending ? "Saving…" : "Save — issue ID, receipt & QR"}
        </button>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-full border border-line bg-panel px-5 py-3 text-[14px] font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

// ---------- sub-components -------------------------------------------------

// ---------- sub-components -------------------------------------------------

/**
 * Section heading — visual rhythm marker inside the form card.
 * Groups fields by phase without changing any field labels or layout.
 */
function SectionHeading({ label }: { label: string }) {
  return (
    <div className="mt-2 mb-1 flex items-center gap-3 first:mt-0">
      <h2 className="font-display text-[12px] font-bold uppercase tracking-[0.14em] text-ink-soft">
        {label}
      </h2>
      <div aria-hidden="true" className="h-px flex-1 bg-line" />
    </div>
  );
}

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
