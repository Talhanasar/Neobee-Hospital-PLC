/**
 * =====================================================================
 *  Admin Form State Types + Initial Values
 * =====================================================================
 *
 *  Lives in a plain (NON "use server") module because:
 *    - Next.js forbids exporting non-function values from a "use server"
 *      file (it errors out at build with: "A 'use server' file can only
 *      export async functions, found object.").
 *    - Client components import the initial-state constants + the state
 *      TYPE definitions to type `useActionState` correctly.
 *
 *  Types are erased at compile time so they're safe in either module —
 *  but keeping them here lets a single import line cover both shapes
 *  and initial values for client forms.
 *
 *  `actions.ts` (the "use server" module) imports the types back from
 *  here for its function signatures.
 * =====================================================================
 */

export type AdminCreateState =
  | { status: "idle" }
  | {
      status: "success";
      uniqueId: string;
      verificationCode: string;
      message: string;
    }
  | {
      status: "error";
      message: string;
      fieldErrors?: Partial<Record<string, string>>;
    };

export const adminCreateInitialState: AdminCreateState = { status: "idle" };

export type AdminEditState =
  | { status: "idle" }
  | {
      status: "success";
      message: string;
    }
  | {
      status: "error";
      message: string;
      fieldErrors?: Partial<Record<string, string>>;
    };

export const adminEditInitialState: AdminEditState = { status: "idle" };

export type AdminResendState =
  | { status: "idle" }
  | { status: "success"; message: string; delivered: boolean }
  | { status: "error"; message: string };

export const adminResendInitialState: AdminResendState = { status: "idle" };
