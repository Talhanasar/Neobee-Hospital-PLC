"use client";

import { useActionState, useId } from "react";

import {
  securityInitialState,
  type SecurityState,
} from "@/app/dashboard/security/states";
import { changePassword } from "@/app/dashboard/security/actions";

/**
 * Client form for the /dashboard/security page. Three password fields:
 *   - currentPassword  (re-auth gate)
 *   - newPassword      (min 8 chars)
 *   - confirm          (must match newPassword)
 *
 * On success the server action returns a success state — no redirect,
 * we stay on the page and clear the inputs.
 */
export default function SecurityForm() {
  const [state, formAction, pending] = useActionState<
    SecurityState,
    FormData
  >(changePassword, securityInitialState);

  const idBase = useId();
  const currentId = `${idBase}-current`;
  const currentErrId = `${currentId}-err`;
  const newId = `${idBase}-new`;
  const newErrId = `${newId}-err`;
  const confirmId = `${idBase}-confirm`;
  const confirmErrId = `${confirmId}-err`;

  const fieldErrors =
    state.status === "error" && state.fieldErrors ? state.fieldErrors : {};
  const currentError = fieldErrors.currentPassword;
  const newError = fieldErrors.newPassword;
  const confirmError = fieldErrors.confirm;
  const topError = state.status === "error" ? state.message : null;
  const success = state.status === "success" ? state.message : null;

  return (
    <form
      action={formAction}
      noValidate
      className="rounded-2xl border border-line bg-panel p-6 sm:p-7"
    >
      {success && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-green bg-green-soft px-3.5 py-2.5 text-[13px] text-ink"
        >
          {success}
        </div>
      )}

      {topError && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-amber bg-amber-soft px-3.5 py-2.5 text-[13px] text-ink"
        >
          {topError}
        </div>
      )}

      <Field
        id={currentId}
        label="Current password"
        error={currentError}
        errorId={currentErrId}
      >
        <input
          id={currentId}
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          aria-invalid={currentError ? true : undefined}
          aria-describedby={currentError ? currentErrId : undefined}
          className={inputClass(Boolean(currentError))}
        />
      </Field>

      <div className="mt-4">
        <Field
          id={newId}
          label="New password"
          help="At least 8 characters."
          error={newError}
          errorId={newErrId}
        >
          <input
            id={newId}
            name="newPassword"
            type="password"
            required
            autoComplete="new-password"
            placeholder="••••••••"
            aria-invalid={newError ? true : undefined}
            aria-describedby={newError ? newErrId : undefined}
            className={inputClass(Boolean(newError))}
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
            name="confirm"
            type="password"
            required
            autoComplete="new-password"
            placeholder="••••••••"
            aria-invalid={confirmError ? true : undefined}
            aria-describedby={confirmError ? confirmErrId : undefined}
            className={inputClass(Boolean(confirmError))}
          />
        </Field>
      </div>

      <div className="mt-6">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center rounded-full bg-honey px-6 py-3 font-display text-[14px] font-bold tracking-tight text-ink shadow-sm transition-colors hover:bg-[#d99408] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-honey-deep"
        >
          {pending ? "Updating…" : "Update password"}
        </button>
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
