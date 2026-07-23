"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";

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

  const [showPassword, setShowPassword] = useState(false);

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
      className="rounded-2xl border border-line bg-panel p-6 sm:p-8 shadow-xl shadow-honey/5 transition-shadow duration-300 hover:shadow-honey/10"
    >
      {newSignupNotice && (
        <div
          role="status"
          className="mb-5 flex items-start gap-2.5 rounded-xl border border-green/30 bg-green-soft px-4 py-3 text-[13px] leading-snug text-ink shadow-xs"
        >
          <svg
            className="mt-0.5 size-4 shrink-0 text-green"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span>Registration saved. Sign in with your email and password below.</span>
        </div>
      )}

      {deniedNotice && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-2.5 rounded-xl border border-amber/30 bg-amber-soft px-4 py-3 text-[13px] leading-snug text-ink shadow-xs"
        >
          <svg
            className="mt-0.5 size-4 shrink-0 text-amber"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span>You&apos;re signed in, but you don&apos;t have access to that page.</span>
        </div>
      )}

      {pendingNotice && (
        <div
          role="status"
          className="mb-5 flex items-start gap-2.5 rounded-xl border border-honey/40 bg-honey-soft px-4 py-3 text-[13px] leading-snug text-ink shadow-xs"
        >
          <svg
            className="mt-0.5 size-4 shrink-0 text-honey-deep"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>
            Your account is awaiting administrator verification. You&apos;ll be able to sign in once your payment is verified.
          </span>
        </div>
      )}

      {topError && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-2.5 rounded-xl border border-[#b3261e]/30 bg-[#fdf2f2] px-4 py-3 text-[13px] leading-snug text-[#b3261e] shadow-xs"
        >
          <svg
            className="mt-0.5 size-4 shrink-0 text-[#b3261e]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{topError}</span>
        </div>
      )}

      {noticeMessage && (
        <div
          role="status"
          className="mb-5 flex items-start gap-2.5 rounded-xl border border-honey/40 bg-honey-soft px-4 py-3 text-[13px] leading-snug text-ink shadow-xs"
        >
          <svg
            className="mt-0.5 size-4 shrink-0 text-honey-deep"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{noticeMessage}</span>
        </div>
      )}

      {/* Email Input */}
      <Field
        id={emailId}
        label="Email"
        help="Use the email you registered with."
        error={emailError}
        errorId={emailErrId}
      >
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-ink-soft/50">
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
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
            className={inputClass(Boolean(emailError)) + " pl-10"}
          />
        </div>
      </Field>

      {/* Password Input */}
      <div className="mt-5">
        <Field
          id={passwordId}
          label="Password"
          help="Your password is case-sensitive."
          error={passwordError}
          errorId={passwordErrId}
        >
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-ink-soft/50">
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <input
              id={passwordId}
              name="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              aria-invalid={passwordError ? true : undefined}
              aria-describedby={passwordError ? passwordErrId : undefined}
              className={inputClass(Boolean(passwordError)) + " pl-10 pr-10"}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-ink-soft/60 hover:text-ink transition-colors focus:outline-none cursor-pointer"
            >
              {showPassword ? (
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a10.05 10.05 0 013.682-.863c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m-6.115-3.447a3 3 0 11-4.243-4.243M3 3l18 18" />
                </svg>
              ) : (
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
        </Field>
      </div>

      {/* Submit Button (Full Width, single CTA as requested) */}
      <div className="mt-6">
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="group relative flex w-full items-center justify-center gap-2 rounded-xl bg-honey px-6 py-3.5 font-display text-[15px] font-bold tracking-tight text-ink shadow-md shadow-honey/20 transition-all duration-200 ease-out cursor-pointer hover:bg-[#d99408] hover:shadow-lg hover:shadow-honey/30 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-honey-deep disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none disabled:active:scale-100 motion-reduce:transition-none motion-reduce:active:scale-100"
        >
          {pending && (
            <svg
              className="size-4 animate-spin motion-reduce:animate-none text-ink"
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
      </div>

      {/* Bottom links section: Forgot password & New here options */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line/60 pt-4 text-[13px]">
        <Link
          href="/login/forgot"
          className="font-medium text-honey-deep underline-offset-4 hover:text-ink hover:underline transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-honey-deep rounded-sm"
        >
          Forgot your password?
        </Link>
        <span className="text-ink-soft">
          New here?{" "}
          <Link
            href="/signup"
            className="font-semibold text-honey-deep underline-offset-4 hover:text-ink hover:underline transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-honey-deep rounded-sm"
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
        className="mb-1.5 block text-[13px] font-semibold text-ink"
      >
        {label}
      </label>
      {children}
      {help && !error && (
        <div className="mt-1.5 text-[12px] text-ink-soft/80">{help}</div>
      )}
      {error && (
        <div id={errorId} className="mt-1.5 text-[12px] font-semibold text-[#b3261e] flex items-center gap-1">
          <svg className="size-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

function inputClass(hasError: boolean): string {
  return (
    "block w-full rounded-xl border bg-paper/80 py-2.5 text-[14px] text-ink placeholder:text-ink-soft/50 " +
    "transition-all duration-200 " +
    "focus:outline-none focus:ring-2 " +
    (hasError
      ? "border-[#b3261e] focus:border-[#b3261e] focus:ring-[#b3261e]/20"
      : "border-line focus:border-honey focus:ring-honey/20 hover:border-line/80")
  );
}
