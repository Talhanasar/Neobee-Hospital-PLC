/**
 * =====================================================================
 *  Stakeholder Reset Password — Form State Types + Initial Values
 * =====================================================================
 *
 *  Lives in a plain (NON "use server") module so client components can
 *  import the initial-state constants and the state TYPE definitions
 *  (Next.js forbids exporting non-function values from a "use server"
 *  file).
 *
 *  NOTE — flow difference vs admin:
 *    The stakeholder reset form takes a 6-digit OTP code (not a
 *    recovery session). It calls `verifyOtp({ email, token, type:
 *    "recovery" })` to mint a session, then `updateUser({ password })`
 *    to set the new password, then `redirect()` to `/login?reset=1`.
 *    A success state is unreachable in practice (redirect throws) but
 *    is included so the union stays total and TypeScript can verify
 *    the "happy path" branch.
 * =====================================================================
 */

export type ResetState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      fieldErrors?: Partial<
        Record<"email" | "token" | "password" | "confirmPassword", string>
      >;
    }
  | {
      // Unreachable in practice — redirect() throws before we get here.
      // Kept in the union so callers can handle it if the redirect
      // layer is ever swapped out.
      status: "success";
      message: string;
    };

export const resetInitialState: ResetState = { status: "idle" };
