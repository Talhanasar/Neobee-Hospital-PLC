"use client";

import Link from "next/link";
import { useActionState, useId } from "react";

import {
  resetInitialState,
  type ResetState,
} from "@/app/login/reset/states";
import { resetPassword } from "@/app/login/reset/actions";

type ResetFormProps = {
  defaultEmail?: string;
};

/**
 * Client form for the /login/reset page. Takes the 6-digit OTP code
 * emailed from /login/forgot + a new password + confirmation. On
 * submit the server action verifies the OTP, updates the password
 * via Supabase, and redirects to /login?reset=1.
 *
 * The email field is hidden but carried through the form so the
 * server action has the address to verify against (matches the value
 * pre-populated from the `?email=` query param on the previous step).
 *
 * Visual style mirrors `src/app/login/LoginForm.tsx` /
 * `src/app/admin/reset/AdminResetForm.tsx`.
 */
export default function ResetForm({ defaultEmail }: ResetFormProps) {
  const [state, formAction, pending] = useActionState<ResetState, FormData>(
    resetPassword,
    resetInitialState,
  );

  const idBase = useId();
  const emailId = `${idBase}-email`;
  const tokenId = `${idBase}-token`;
  const tokenErrId = `${tokenId}-err`;
  const passwordId = `${idBase}-password`;
  const passwordErrId = `${passwordId}-err`;
  const confirmId = `${idBase}-confirm`;
  const confirmErrId = `${confirmId}-err`;

  const fieldErrors =
    state.status === "error" && state.fieldErrors ? state.fieldErrors : {};
  const emailError = fieldErrors.email;
  const tokenError = fieldErrors.token;
  const passwordError = fieldErrors.password;
  const confirmError = fieldErrors.confirmPassword;

  // Top-level error only when there are no field-specific errors —
  // otherwise the field-level message already tells the user what to
  // fix and a redundant banner would be noise.
  const topError =
    state.status === "error" &&
    !emailError &&
    !tokenError &&
    !passwordError &&
    !confirmError
      ? state.message
      : null;

  return (
    <form
      action={formAction}
      noValidate
      className="rounded-2xl border border-line bg-panel p-6 sm:p-7"
    >
      {topError && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-amber bg-amber-soft px-3.5 py-2.5 text-[13px] text-ink"
        >
          {topError}
        </div>
      )}

      {/* Hidden email — carried through so the action knows which
          account to verify the OTP against. Pre-populated from the
          ?email= query param the user arrived with. */}
      <input
        id={emailId}
        name="email"
        type="hidden"
        value={defaultEmail ?? ""}
        readOnly
      />

      <Field
        id={tokenId}
        label="6-digit reset code"
        help="Paste the code we emailed to you. It expires after a short while."
        error={tokenError}
        errorId={tokenErrId}
      >
        <input
          id={tokenId}
          name="token"
          type="text"
          required
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          pattern="\d{6}"
          placeholder="123456"
          aria-invalid={tokenError ? true : undefined}
          aria-describedby={tokenError ? tokenErrId : undefined}
          className={inputClass(Boolean(tokenError))}
        />
      </Field>

      <div className="mt-4">
        <Field
          id={passwordId}
          label="New password"
          help="At least 8 characters."
          error={passwordError}
          errorId={passwordErrId}
        >
          <input
            id={passwordId}
            name="password"
            type="password"
            required
            autoComplete="new-password"
            minLength={8}
            placeholder="••••••••"
            aria-invalid={passwordError ? true : undefined}
            aria-describedby={passwordError ? passwordErrId : undefined}
            className={inputClass(Boolean(passwordError))}
          />
        </Field>
      </div>

      <div className="mt-4">
        <Field
          id={confirmId}
          label="Confirm new password"
          error={confirmError}
          errorId={confirmErrId}
        >
          <input
            id={confirmId}
            name="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            minLength={8}
            placeholder="••••••••"
            aria-invalid={confirmError ? true : undefined}
            aria-describedby={confirmError ? confirmErrId : undefined}
            className={inputClass(Boolean(confirmError))}
          />
        </Field>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center rounded-full bg-honey px-6 py-3 font-display text-[14px] font-bold tracking-tight text-ink shadow-sm transition-colors hover:bg-[#d99408] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-honey-deep"
        >
          {pending ? "Updating…" : "Set new password"}
        </button>
        <Link
          href="/login/forgot"
          className="text-[12.5px] font-semibold text-honey-deep underline-offset-2 hover:underline"
        >
          Need a new code?
        </Link>
      </div>
    </form>
  );
}

// ---------- sub-components (kept local — same shape as LoginForm) --------

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
        <div
          id={errorId}
          className="mt-1 text-[12px] font-semibold text-[#b3261e]"
        >
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
