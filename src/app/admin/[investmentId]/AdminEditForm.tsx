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
  adminEditInitialState,
  adminResendInitialState,
  type AdminEditState,
  type AdminResendState,
} from "../states";
import {
  adminResendReceiptAction,
  adminUpdateInvestmentAction,
} from "../actions";

const DEPOSIT_METHODS = [
  "Bank deposit — NEOBEE account",
  "Bank transfer",
  "Cheque",
  "Mobile banking",
] as const;

type InvestmentSeed = {
  id: string;
  uniqueId: string;
  verificationCode: string;
  shares: number;
  category: ShareCategory;
  isFoundingEntrepreneur: boolean;
  amount: number;
  incentiveAmount: number;
  depositDate: string | null; // ISO date string from the server
  depositMethod: string | null;
  paymentReference: string | null;
  notes: string | null;
  status: "PENDING" | "CONFIRMED";
  stakeholder: {
    name: string;
    phone: string | null;
    email: string | null;
    nid: string | null;
  };
};

export default function AdminEditForm({ inv }: { inv: InvestmentSeed }) {
  const [state, formAction, pending] = useActionState<AdminEditState, FormData>(
    adminUpdateInvestmentAction,
    adminEditInitialState,
  );

  const [resendState, resendAction, resendPending] = useActionState<
    AdminResendState,
    FormData
  >(adminResendReceiptAction, adminResendInitialState);

  // Controlled inputs for the live financial preview. The server is the
  // source of truth — this is purely UX. Re-initialize on save via the
  // `formKey` so the form remounts with fresh seed values once the parent
  // re-renders after revalidatePath().
  const formKey = `${inv.id}-${inv.shares}-${inv.isFoundingEntrepreneur ? 1 : 0}`;

  return (
    <FormBody
      key={formKey}
      inv={inv}
      state={state}
      formAction={formAction}
      pending={pending}
      resendState={resendState}
      resendAction={resendAction}
      resendPending={resendPending}
    />
  );
}

// Inner body extracted so we can re-mount it on save (via `key` above).
// React 19 prefers `key`-driven reset over `useEffect(() => setState(...))`
// when you want prop changes to flow into controlled inputs.
function FormBody({
  inv,
  state,
  formAction,
  pending,
  resendState,
  resendAction,
  resendPending,
}: {
  inv: InvestmentSeed;
  state: AdminEditState;
  formAction: (payload: FormData) => void;
  pending: boolean;
  resendState: AdminResendState;
  resendAction: (payload: FormData) => void;
  resendPending: boolean;
}) {
  const [shares, setShares] = useState<number>(inv.shares);
  const [isFoundingEntrepreneur, setIsFoundingEntrepreneur] = useState<boolean>(
    inv.isFoundingEntrepreneur,
  );

  const safeShares =
    Number.isFinite(shares) && shares >= 1 && shares <= 100
      ? Math.floor(shares)
      : inv.shares;

  const nextCategory: ShareCategory = categoryFor(safeShares);
  const nextAmount = amountFor(safeShares);
  const nextIncentive = incentiveFor(safeShares, isFoundingEntrepreneur);

  const idBase = useId();
  const inputId = (k: string) => `${idBase}-${k}`;
  const errId = (k: string) => `${inputId(k)}-err`;

  const fieldErrors =
    state.status === "error" && state.fieldErrors ? state.fieldErrors : {};

  const depositDateValue = formatDateInput(inv.depositDate);

  return (
    <div className="flex flex-col gap-5">
      {/* ---- Edit form ---- */}
      <form
        action={formAction}
        noValidate
        className="rounded-2xl border border-line bg-panel p-6 sm:p-7"
      >
        <input type="hidden" name="investmentId" value={inv.id} />

        {state.status === "error" && state.message && !state.fieldErrors && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-amber bg-amber-soft px-3.5 py-2.5 text-[13px] text-ink"
          >
            {state.message}
          </div>
        )}
        {state.status === "success" && (
          <div
            role="status"
            className="mb-4 rounded-lg border border-green bg-green-soft px-3.5 py-2.5 text-[13px] text-green"
          >
            {state.message}
          </div>
        )}

        <h2 className="font-display text-[15px] font-bold tracking-tight">
          Edit shareholder
        </h2>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              defaultValue={inv.stakeholder.name}
              className={inputClass(Boolean(fieldErrors.name))}
            />
          </Field>

          <Field id={inputId("phone")} label="Phone">
            <input
              id={inputId("phone")}
              name="phone"
              type="text"
              defaultValue={inv.stakeholder.phone ?? ""}
              className={inputClass(false)}
            />
          </Field>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            id={inputId("email")}
            label="Email"
            error={fieldErrors.email}
            errorId={errId("email")}
          >
            <input
              id={inputId("email")}
              name="email"
              type="email"
              defaultValue={inv.stakeholder.email ?? ""}
              autoComplete="off"
              className={inputClass(Boolean(fieldErrors.email))}
            />
          </Field>
          <Field id={inputId("nid")} label="NID / passport">
            <input
              id={inputId("nid")}
              name="nid"
              type="text"
              defaultValue={inv.stakeholder.nid ?? ""}
              className={inputClass(false)}
            />
          </Field>
        </div>

        <hr className="my-5 border-line" />

        <h2 className="font-display text-[15px] font-bold tracking-tight">
          Investment
        </h2>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            id={inputId("shares")}
            label="Shares *"
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
              className={inputClass(Boolean(fieldErrors.shares))}
            />
          </Field>

          <Field id={inputId("categoryPreview")} label="Category (auto)">
            <input
              id={inputId("categoryPreview")}
              type="text"
              readOnly
              value={CATEGORY_LABEL[nextCategory]}
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
            <b>Founding entrepreneur</b> — entitle to the ৳20,000 per-share
            incentive.
          </label>
        </div>

        <CalcPreview
          shares={safeShares}
          amount={nextAmount}
          incentive={nextIncentive}
          isFoundingEntrepreneur={isFoundingEntrepreneur}
        />

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id={inputId("depositDate")} label="Deposit date">
            <input
              id={inputId("depositDate")}
              name="depositDate"
              type="date"
              defaultValue={depositDateValue}
              className={inputClass(false)}
            />
          </Field>

          <Field id={inputId("depositMethod")} label="Deposit method">
            <select
              id={inputId("depositMethod")}
              name="depositMethod"
              defaultValue={inv.depositMethod ?? ""}
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
              defaultValue={inv.paymentReference ?? ""}
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
              defaultValue={inv.notes ?? ""}
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
            {pending ? "Saving…" : "Save changes"}
          </button>
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-full border border-line bg-panel px-5 py-3 text-[14px] font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink"
          >
            Back to dashboard
          </Link>
        </div>
      </form>

      {/* ---- Resend receipt ---- */}
      <form
        action={resendAction}
        className="rounded-2xl border border-line bg-panel p-6 sm:p-7"
      >
        <input type="hidden" name="investmentId" value={inv.id} />

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-[15px] font-bold tracking-tight">
              Resend receipt
            </h2>
            <p className="mt-1 max-w-[520px] text-[13px] text-ink-soft">
              Logs an audit row and (best-effort) emails the stakeholder.
              Real SMTP is not wired in this build — the audit trail is the
              source of truth.
            </p>
          </div>
          <button
            type="submit"
            disabled={resendPending}
            className="inline-flex items-center justify-center rounded-full border border-line bg-panel px-4 py-2 text-[13px] font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink disabled:opacity-60"
          >
            {resendPending ? "Logging…" : "Resend receipt"}
          </button>
        </div>

        {resendState.status === "success" && (
          <div
            role="status"
            className="mt-3 rounded-lg border border-green bg-green-soft px-3.5 py-2.5 text-[13px] text-green"
          >
            {resendState.message}
            {resendState.delivered
              ? ""
              : " (Email transport not yet configured — audit row written.)"}
          </div>
        )}
        {resendState.status === "error" && (
          <div
            role="alert"
            className="mt-3 rounded-lg border border-amber bg-amber-soft px-3.5 py-2.5 text-[13px] text-ink"
          >
            {resendState.message}
          </div>
        )}
      </form>
    </div>
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

function CalcPreview({
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
      <Row
        label={`${shares} share${shares === 1 ? "" : "s"} × ৳2,00,000`}
        value={fmt(amount)}
      />
      {isFoundingEntrepreneur && (
        <Row
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-[3px]">
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

/** Convert a Date → "yyyy-mm-dd" for <input type="date">, or null. */
function formatDateInput(d: string | null | undefined): string {
  if (!d) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
