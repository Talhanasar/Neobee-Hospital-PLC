/**
 * =====================================================================
 *  Admin Login — Form State Types + Initial Values
 * =====================================================================
 *
 *  Lives in a plain (NON "use server") module because:
 *    - Next.js forbids exporting non-function values from a "use server"
 *      file (it errors out at build with: "A 'use server' file can only
 *      export async functions, found object.").
 *    - Client components import the initial-state constants + the state
 *      TYPE definitions to type `useActionState` correctly.
 *
 *  `actions.ts` (the "use server" module) imports the types back from
 *  here for its function signatures.
 * =====================================================================
 */

export type AdminLoginState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      fieldErrors?: Partial<Record<"email" | "password", string>>;
    };

export const adminLoginInitialState: AdminLoginState = { status: "idle" };
