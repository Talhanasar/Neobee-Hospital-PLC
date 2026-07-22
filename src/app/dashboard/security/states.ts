/**
 * =====================================================================
 *  Stakeholder Security (change password) — Form State Types + Initial Values
 * =====================================================================
 *
 *  Lives in a plain (NON "use server") module so client components can
 *  import the initial-state constants and the state TYPE definitions
 *  (Next.js forbids exporting non-function values from a "use server"
 *  file).
 * =====================================================================
 */

export type SecurityState =
  | { status: "idle" }
  | {
      status: "success";
      message: string;
    }
  | {
      status: "error";
      message: string;
      fieldErrors?: Partial<
        Record<"currentPassword" | "newPassword" | "confirm", string>
      >;
    };

export const securityInitialState: SecurityState = { status: "idle" };
