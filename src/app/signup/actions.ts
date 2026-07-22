"use server";

import { redirect } from "next/navigation";
import { Prisma, ShareCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { genUniqueId, genVerificationCode } from "@/lib/ids";
import {
  amountFor,
  categoryFor,
  incentiveFor,
  type ShareCategory as ShareCategoryType,
} from "@/lib/business";

// State shape consumed by the SignupForm client component via useActionState.
// `ok` is only used as a transient value before redirect() throws — the
// client never renders it. `error` carries a top-level message plus optional
// per-field errors. `idle` is the initial state.
export type SignupState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      fieldErrors?: Partial<Record<string, string>>;
    };

const initialState: SignupState = { status: "idle" };
export const signupInitialState = initialState;

// Options for the deposit-method select — kept in one place so the client
// component and any server-side validation agree.
const DEPOSIT_METHODS = new Set([
  "Bank deposit — NEOBEE account",
  "Bank transfer",
  "Cheque",
  "Mobile banking",
]);

function parseInt10(raw: FormDataEntryValue | null): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (!/^-?\d+$/.test(s)) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function parseDate(raw: FormDataEntryValue | null): Date | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Detect obviously placeholder Supabase credentials so we can soft-fail the
// OTP step without aborting the DB write.
function supabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !key) return false;
  if (url.includes("your-project")) return false;
  if (key.includes("your-anon-key")) return false;
  return true;
}

export async function submitSignup(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  // ---- 1. Pull + validate inputs ---------------------------------------
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const contact = String(formData.get("contact") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const sharesRaw = parseInt10(formData.get("shares"));
  const isFoundingEntrepreneur =
    String(formData.get("isFoundingEntrepreneur") ?? "") === "on";
  const depositDateRaw = formData.get("depositDate");
  const depositMethod = String(formData.get("depositMethod") ?? "").trim();
  const paymentReference = String(formData.get("paymentReference") ?? "").trim();
  const nid = String(formData.get("nid") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  const fieldErrors: Record<string, string> = {};

  if (!name) fieldErrors.name = "Please enter the shareholder name.";

  // RFC-lite email check. Good enough for an OTP target; Supabase is the
  // real source of truth on delivery.
  if (!email) {
    fieldErrors.email = "An email is required so we can set up your login.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fieldErrors.email = "That doesn't look like a valid email address.";
  }

  if (!password) {
    fieldErrors.password = "Please choose a password.";
  } else if (password.length < 8) {
    fieldErrors.password = "Password must be at least 8 characters.";
  }

  if (password && confirmPassword !== password) {
    fieldErrors.confirmPassword = "Passwords do not match.";
  }

  if (sharesRaw == null) {
    fieldErrors.shares = "Enter a whole number of shares.";
  } else if (sharesRaw < 1 || sharesRaw > 100) {
    fieldErrors.shares = "Shares must be between 1 and 100.";
  }

  if (depositMethod && !DEPOSIT_METHODS.has(depositMethod)) {
    fieldErrors.depositMethod = "Pick a valid deposit method.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Please fix the highlighted fields and try again.",
      fieldErrors,
    };
  }

  const shares = sharesRaw as number;

  // ---- 2. Derive financial fields server-side. NEVER trust the client. ---
  const category: ShareCategoryType = categoryFor(shares);
  const amount = amountFor(shares);
  const incentive = incentiveFor(shares, isFoundingEntrepreneur);

  const depositDate = parseDate(depositDateRaw);

  // ---- 3. Generate fresh uniqueId + verificationCode per attempt. ------
  // genUniqueId() seeds from prisma.investment.count(), which is NOT safe
  // under concurrent signups — two requests can read the same count and
  // hand out the same NEO-#### / NB-XXXXXX. We rely on the DB's unique
  // constraints as the source of truth and regenerate + retry on P2002.
  const MAX_ID_RETRIES = 4;
  let uniqueId = "";
  let verificationCode = "";
  let isReturning = false;

  // ---- 4. Single transaction: stakeholder + investment + audit log. -----
  // Look up by email first so returning stakeholders don't blow up on the
  // Stakeholder.email unique constraint. Each attempt must be atomic across
  // stakeholder + investment + audit log, so the WHOLE transaction sits
  // inside the retry loop (a failed attempt rolls back cleanly).
  for (let attempt = 1; attempt <= MAX_ID_RETRIES; attempt++) {
    [uniqueId, verificationCode] = await Promise.all([
      genUniqueId(),
      genVerificationCode(),
    ]);

    try {
      const result = await prisma.$transaction(async (tx) => {
        const existing = email
          ? await tx.stakeholder.findUnique({ where: { email } })
          : null;

        const stakeholder = existing
          ? await tx.stakeholder.update({
              where: { id: existing.id },
              data: {
                // Refresh the latest known name/contact only when the existing
                // record has blanks — never silently overwrite filled fields.
                name: existing.name && existing.name.length > 0 ? existing.name : name,
                phone: contact
                  ? (existing.phone && existing.phone.length > 0
                      ? existing.phone
                      : contact)
                  : existing.phone,
                nid: nid
                  ? (existing.nid && existing.nid.length > 0 ? existing.nid : nid)
                  : existing.nid,
              },
            })
          : await tx.stakeholder.create({
              data: {
                name,
                email,
                phone: contact || null,
                nid: nid || null,
              },
            });

        const investment = await tx.investment.create({
          data: {
            stakeholderId: stakeholder.id,
            uniqueId,
            verificationCode,
            shares,
            category: category as ShareCategory,
            isFoundingEntrepreneur,
            amount: BigInt(amount),
            incentiveAmount: BigInt(incentive),
            depositDate,
            depositMethod: depositMethod || null,
            paymentReference: paymentReference || null,
            notes: notes || null,
            status: "PENDING",
          },
        });

        await tx.auditLog.create({
          data: {
            investmentId: investment.id,
            action: "CREATE",
            actor: "self",
            detail: JSON.stringify({
              source: "signup",
              uniqueId,
              shares,
              category,
              isFoundingEntrepreneur,
              amount,
              incentive,
            }),
          },
        });

        return { stakeholderId: stakeholder.id, isReturning: !!existing };
      });
      isReturning = result.isReturning;
      break; // success — leave the retry loop
    } catch (err) {
      // Classify P2002 by the targeted column. Retry on uniqueId /
      // verificationCode collisions; treat `email` as a duplicate account;
      // everything else (incl. unknown P2002 targets) is non-retryable.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        const targetRaw = err.meta?.target;
        const target: string[] = Array.isArray(targetRaw)
          ? (targetRaw as string[])
          : typeof targetRaw === "string"
            ? [targetRaw]
            : [];

        if (
          target.includes("uniqueId") ||
          target.includes("verificationCode")
        ) {
          // Try again with freshly generated IDs.
          if (attempt < MAX_ID_RETRIES) continue;
          // Exhausted retries — surface a clear error to the user.
          return {
            status: "error",
            message: "Could not issue a unique ID, please try again.",
          };
        }

        if (target.includes("email")) {
          return {
            status: "error",
            message:
              "An account with this email already exists — log in to add details.",
          };
        }
      }
      // Non-retryable error: log + friendly message, no DB leakage.
      console.error("[signup] DB transaction failed", err);
      return {
        status: "error",
        message:
          "We couldn't save your registration just now. Please try again in a moment.",
      };
    }
  }

  // ---- 5. Trigger Supabase password sign-up + confirmation email. -------
  // Soft-fail if Supabase isn't yet configured; the DB records above are
  // still the source of truth and the redirect's noOtp flag tells the
  // success page to fall back to manual recovery.
  let otpSent = false;
  if (supabaseConfigured()) {
    try {
      const supabase = await createClient();
      const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${siteUrl.replace(/\/$/, "")}/auth/callback`,
        },
      });
      if (!error) otpSent = true;
      else
        console.warn(
          "[signup] Supabase signUp returned error:",
          error.message,
        );
    } catch (err) {
      console.warn("[signup] Supabase signUp dispatch threw:", err);
    }
  } else {
    console.warn(
      "[signup] Supabase env not configured — skipping confirmation email dispatch.",
    );
  }

  // ---- 6. Navigate to the confirmation page. ---------------------------
  // redirect() throws a control-flow exception; code below does not execute.
  const params = new URLSearchParams({
    uid: uniqueId,
    code: verificationCode,
    email,
  });
  if (isReturning) params.set("returning", "1");
  if (!otpSent) params.set("noOtp", "1");
  redirect(`/signup/success?${params.toString()}`);
}
