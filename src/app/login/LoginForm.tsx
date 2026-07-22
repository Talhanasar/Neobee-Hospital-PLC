"use client";

import Link from "next/link";
import { useActionState, useId } from "react";

import { login } from "@/app/login/actions";
import { loginInitialState, type LoginState } from "@/app/login/states";

type LoginFormProps = {
  defaultEmail?: string;
  newSignupNotice?: boolean;
  deniedNotice?: boolean;
  pendingNotice?: boolean;
};

/**
 * Client form for the /login page. Email + password sign-in.
 *
 * - Calls the `login` server action via `useActionState`.
 * - On success the action redirects to `/dashboard` (stakeholder) or
 *   `/admin` (admin) — those navigations happen server-side, no extra
 *   client logic needed here.
 * - On a soft error (Supabase not configured, awaiting verification,
 *   denied) the action returns a `notice` or `error` state and we
 *   render inline — the page must always stay usable in dev when env
 *   placeholders are present.
 * - Pre-fills the email from `?email=` so the post-signup handoff is
 *   one keystroke instead of one whole field.
 */
export default function LoginForm({
  defaultEmail,
  newSignupNotice,
  deniedNotice,
  pendingNotice,
}: LoginFormProps) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    login,
    loginInitialState,
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

  // Top-level error only when there are no field-specific errors —
  // otherwise the field-level message already tells the user what to
  // fix and a redundant banner would be noise.
  const topError =
    state.status === "error" && !emailError && !passwordError
      ? state.message
      : null;
  const noticeMessage = state.status === "notice" ? state.message : null;

  return (
    <form
      action={formAction}
      noValidate
      className="rounded-2xl border border-line bg-panel p-6 sm:p-7"
    >
      {newSignupNotice && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-green bg-green-soft px-3.5 py-2.5 text-[13px] text-ink"
        >
          Registration saved. Sign in with your email and password below.
        </div>
      )}

      {deniedNotice && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-amber bg-amber-soft px-3.5 py-2.5 text-[13px] text-ink"
        >
          You&apos;re signed in, but you don&apos;t have access to that page.
        </div>
      )}

      {pendingNotice && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-honey bg-honey-soft px-3.5 py-2.5 text-[13px] text-ink"
        >
          Your account is awaiting administrator verification. You&apos;ll be
          able to sign in once your payment is verified.
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

      {noticeMessage && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-honey bg-honey-soft px-3.5 py-2.5 text-[13px] text-ink"
        >
          {noticeMessage}
        </div>
      )}

      <Field
        id={emailId}
        label="Email"
        help="Use the email you registered with."
        error={emailError}
        errorId={emailErrId}
      >
        <input
          id={emailId}
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={defaultEmail}
          placeholder="you@example.com"
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? emailErrId : undefined}
          className={inputClass(Boolean(emailError))}
        />
      </Field>

      <div className="mt-4">
        <Field
          id={passwordId}
          label="Password"
          help="Your password is case-sensitive."
          error={passwordError}
          errorId={passwordErrId}
        >
          <input
            id={passwordId}
            name="password"
            type="password"
            required
            autoComplete="current-password"
            aria-invalid={passwordError ? true : undefined}
            aria-describedby={passwordError ? passwordErrId : undefined}
            className={inputClass(Boolean(passwordError))}
          />
        </Field>
      </div>

      <div className="mt-6 flex flex-nowrap gap-2.5">
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="group inline-flex items-center justify-center gap-2 rounded-full bg-honey px-6 py-3 font-display text-[14px] font-bold tracking-tight text-ink shadow-sm transition-[background-color,transform,box-shadow] duration-200 ease-out cursor-pointer hover:bg-[#d99408] hover:shadow-md active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-honey-deep disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-sm disabled:hover:bg-honey disabled:active:scale-100 motion-reduce:transition-none motion-reduce:active:scale-100"
        >
          {pending && (
            <svg
              className="size-4 animate-spin motion-reduce:animate-none"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-90"
                fill="currentColor"
                d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
              />
            </svg>
          )}
          {pending ? "Signing in…" : "Sign in"}
        </button>
        <Link
          href="/signup"
          className="inline-flex items-center justify-center rounded-full border border-line bg-panel px-5 py-3 text-[14px] font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink"
        >
          Create an account
        </Link>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-[12.5px] text-ink-soft">
        <Link
          href="/login/forgot"
          className="font-semibold text-honey-deep underline-offset-2 hover:underline"
        >
          Forgot your password?
        </Link>
        <span>
          New here?{" "}
          <Link
            href="/signup"
            className="font-semibold text-honey-deep underline-offset-2 hover:underline"
          >
            Create an account
          </Link>
        </span>
      </div>
    </form>
  );
}

// ---------- sub-components (kept local — same shape as SignupForm) --------

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
