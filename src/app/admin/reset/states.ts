/**
 * =====================================================================
 *  Admin Reset Password — Form State Types + Initial Values
 * =====================================================================
 *
 *  Lives in a plain (NON "use server") module so client components can
 *  import the initial-state constants and the state TYPE definitions
 *  (Next.js forbids exporting non-function values from a "use server"
 *  file).
 * =====================================================================
 */

export type AdminResetState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      fieldErrors?: Partial<Record<"password" | "confirm", string>>;
    };

export const adminResetInitialState: AdminResetState = { status: "idle" };
