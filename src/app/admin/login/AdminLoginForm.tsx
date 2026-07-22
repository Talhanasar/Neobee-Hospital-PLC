"use client";

import Link from "next/link";
import { useActionState, useId } from "react";

import {
  adminLoginInitialState,
  type AdminLoginState,
} from "@/app/admin/login/states";
import { adminSignIn } from "@/app/admin/login/actions";

/**
 * Client form for the /admin/login page. Email + password fields, signed
 * in via Supabase's `signInWithPassword` (see `actions.ts`).
 *
 * - Visual style mirrors `src/app/login/LoginForm.tsx` (centered card,
 *   honey primary button, focus-visible honey outlines).
 * - The server action returns an error state on bad creds, unknown
 *   admin, or Supabase-not-configured — we render the top-level
 *   `message` and any per-field errors.
 */
export default function AdminLoginForm() {
  const [state, formAction, pending] = useActionState<AdminLoginState, FormData>(
    adminSignIn,
    adminLoginInitialState,
  );

  const idBase = useId();
  const emailId = `${idBase}-email`;
  const emailErrId = `${emailId}-err`;
  const passwordId = `${idBase}-password`;
  const passwordErrId = `${passwordId}-err`;

  const fieldErrors =
    state.status === "error" && state.fieldErrors ? state.fieldErrors : {};
  const emailError = fieldErrors.email;
  const passwordError = fieldErrors.password;
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
        id={emailId}
        label="Email"
        error={emailError}
        errorId={emailErrId}
      >
        <input
          id={emailId}
          name="email"
          type="email"
          required
          autoComplete="username"
          placeholder="admin@example.com"
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? emailErrId : undefined}
          className={inputClass(Boolean(emailError))}
        />
      </Field>

      <div className="mt-4">
        <Field
          id={passwordId}
          label="Password"
          error={passwordError}
          errorId={passwordErrId}
        >
          <input
            id={passwordId}
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            aria-invalid={passwordError ? true : undefined}
            aria-describedby={passwordError ? passwordErrId : undefined}
            className={inputClass(Boolean(passwordError))}
          />
        </Field>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center rounded-full bg-honey px-6 py-3 font-display text-[14px] font-bold tracking-tight text-ink shadow-sm transition-colors hover:bg-[#d99408] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-honey-deep"
        >
          {pending ? "Signing in…" : "Sign in to admin"}
        </button>
        <Link
          href="/admin/forgot"
          className="text-[12.5px] font-semibold text-honey-deep underline-offset-2 hover:underline"
        >
          Forgot password?
        </Link>
      </div>
    </form>
  );
}

// ---------- sub-components (kept local — same shape as LoginForm) --------

function Field({
  id,
  label,
  error,
  errorId,
  children,
}: {
  id: string;
  label: string;
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
