// State shape consumed by the LoginForm client component via useActionState.
// Lives in a plain (non-"use server") module so it can export the type +
// initial-state constant — a "use server" file may only export async functions.
export type LoginState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      fieldErrors?: Partial<Record<string, string>>;
    }
  | {
      status: "notice";
      message: string;
      email?: string;
    };

export const loginInitialState: LoginState = { status: "idle" };
