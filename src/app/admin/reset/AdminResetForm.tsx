"use client";

import Link from "next/link";
import { useActionState, useId } from "react";

import {
  adminResetInitialState,
  type AdminResetState,
} from "@/app/admin/reset/states";
import { adminSetNewPassword } from "@/app/admin/reset/actions";

/**
 * Client form for the /admin/reset page. Two password fields (new +
 * confirm). On submit, the server action updates the Supabase user and
 * redirects to /admin.
 *
 * Visual style mirrors `src/app/login/LoginForm.tsx`.
 */
export default function AdminResetForm() {
  const [state, formAction, pending] = useActionState<AdminResetState, FormData>(
    adminSetNewPassword,
    adminResetInitialState,
  );

  const idBase = useId();
  const passwordId = `${idBase}-password`;
  const passwordErrId = `${passwordId}-err`;
  const confirmId = `${idBase}-confirm`;
  const confirmErrId = `${confirmId}-err`;

  const fieldErrors =
    state.status === "error" && state.fieldErrors ? state.fieldErrors : {};
  const passwordError = fieldErrors.password;
  const confirmError = fieldErrors.confirm;
  const topMessage = state.status === "error" ? state.message : null;

  return (
    <form
      action={formAction}
      noValidate
      className="rounded-2xl border border-line bg-panel p-6 sm:p-7"
    >
      {topMessage && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-amber bg-amber-soft px-3.5 py-2.5 text-[13px] text-ink"
        >
          {topMessage}
        </div>
      )}

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
          placeholder="••••••••"
          aria-invalid={passwordError ? true : undefined}
          aria-describedby={passwordError ? passwordErrId : undefined}
          className={inputClass(Boolean(passwordError))}
        />
      </Field>

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

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center rounded-full bg-honey px-6 py-3 font-display text-[14px] font-bold tracking-tight text-ink shadow-sm transition-colors hover:bg-[#d99408] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-honey-deep"
        >
          {pending ? "Saving…" : "Set new password"}
        </button>
        <Link
          href="/admin/forgot"
          className="text-[12.5px] font-semibold text-honey-deep underline-offset-2 hover:underline"
        >
          Need a fresh link?
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
