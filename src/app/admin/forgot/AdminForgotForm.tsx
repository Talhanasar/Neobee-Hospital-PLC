"use client";

import Link from "next/link";
import { useActionState, useId } from "react";

import {
  adminForgotInitialState,
  type AdminForgotState,
} from "@/app/admin/forgot/states";
import { adminRequestPasswordReset } from "@/app/admin/forgot/actions";

/**
 * Client form for the /admin/forgot page. Single email field — the
 * server action sends a Supabase password-reset email and ALWAYS
 * returns the same generic notice so we never leak whether the email
 * is on file.
 *
 * Visual style mirrors `src/app/login/LoginForm.tsx`.
 */
export default function AdminForgotForm() {
  const [state, formAction, pending] = useActionState<
    AdminForgotState,
    FormData
  >(adminRequestPasswordReset, adminForgotInitialState);

  const idBase = useId();
  const inputId = `${idBase}-email`;
  const errId = `${inputId}-err`;

  const fieldErrors =
    state.status === "error" && state.fieldErrors ? state.fieldErrors : {};
  const emailError = fieldErrors.email;
  const topError = state.status === "error" ? state.message : null;
  const notice = state.status === "notice" ? state.message : null;

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

      {notice && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-honey bg-honey-soft px-3.5 py-2.5 text-[13px] text-ink"
        >
          {notice}
        </div>
      )}

      <div className="mb-1">
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-[12.5px] font-semibold text-ink"
        >
          Admin email
        </label>
        <input
          id={inputId}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="admin@example.com"
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? errId : undefined}
          className={
            "block w-full rounded-lg border bg-paper px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-soft/70 " +
            "focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-honey " +
            (emailError
              ? "border-[#b3261e] focus:border-[#b3261e] focus-visible:outline-[#b3261e]"
              : "border-line focus:border-honey")
          }
        />
        {emailError && (
          <div
            id={errId}
            className="mt-1 text-[12px] font-semibold text-[#b3261e]"
          >
            {emailError}
          </div>
        )}
        <div className="mt-1 text-[12px] text-ink-soft">
          We&apos;ll send a reset link to this address if it&apos;s tied to an
          administrator account.
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center rounded-full bg-honey px-6 py-3 font-display text-[14px] font-bold tracking-tight text-ink shadow-sm transition-colors hover:bg-[#d99408] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-honey-deep"
        >
          {pending ? "Sending…" : "Send reset link"}
        </button>
        <Link
          href="/admin/login"
          className="text-[12.5px] font-semibold text-honey-deep underline-offset-2 hover:underline"
        >
          Back to admin sign in
        </Link>
      </div>
    </form>
  );
}
