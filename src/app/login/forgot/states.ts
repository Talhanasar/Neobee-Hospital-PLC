/**
 * =====================================================================
 *  Stakeholder Forgot Password — Form State Types + Initial Values
 * =====================================================================
 *
 *  Lives in a plain (NON "use server") module so client components can
 *  import the initial-state constants and the state TYPE definitions
 *  (Next.js forbids exporting non-function values from a "use server"
 *  file).
 *
 *  NOTE — flow difference vs admin:
 *    The stakeholder flow uses an OTP CODE (not a magic link). After the
 *    request step succeeds we render a "sent" state with the email so
 *    the form can deep-link the user into `/login/reset?email=…` where
 *    they paste the 6-digit code from their email.
 * =====================================================================
 */

export type ForgotState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      fieldErrors?: Partial<Record<"email", string>>;
    }
  | {
      // The "we sent a code" success state. The form renders a deep
      // link into /login/reset?email=… so the user can paste the
      // 6-digit OTP they just received.
      status: "sent";
      email: string;
      message: string;
    };

export const forgotInitialState: ForgotState = { status: "idle" };
