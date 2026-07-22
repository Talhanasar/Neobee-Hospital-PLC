/**
 * =====================================================================
 *  Admin Forgot Password — Form State Types + Initial Values
 * =====================================================================
 *
 *  Lives in a plain (NON "use server") module so client components can
 *  import the initial-state constants and the state TYPE definitions
 *  (Next.js forbids exporting non-function values from a "use server"
 *  file).
 * =====================================================================
 */

export type AdminForgotState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      fieldErrors?: Partial<Record<"email", string>>;
    }
  | {
      // The "we sent a link" notice. ALWAYS rendered the same way
      // regardless of whether the email is on file — prevents account
      // enumeration.
      status: "notice";
      message: string;
    };

export const adminForgotInitialState: AdminForgotState = { status: "idle" };
