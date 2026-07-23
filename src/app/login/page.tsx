import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import LoginForm from "@/app/login/LoginForm";

export const metadata = {
  title: "Log in — Neobee Hospital PLC",
  description:
    "Log in to your Neobee Hospital PLC stakeholder dashboard with your email and password.",
};

type SearchParams = {
  email?: string;
  new?: string;
  denied?: string;
  pending?: string;
  reset?: string;
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { email, new: isNew, denied, pending, reset } = await searchParams;
  const defaultEmail = email ? decodeURIComponent(email) : undefined;
  const resetSuccess = reset === "1";

  return (
    <>
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="w-full lg:grid lg:grid-cols-12 lg:items-stretch lg:gap-10 xl:gap-14">
          
          {/* Left Side: Information & Portal Showcase (Desktop 5 cols, Mobile top/bottom) */}
          <div className="mb-8 lg:mb-0 lg:col-span-5 flex flex-col justify-between rounded-3xl border border-line/80 bg-gradient-to-b from-[#FDFCF7] via-panel to-[#FBF0D6]/30 p-6 sm:p-8 shadow-sm">
            <div>
              {/* Brand Header */}
              <div className="flex items-center gap-3.5">
                <HexBrandMark />
                <div>
                  <h2 className="font-display text-[18px] font-extrabold tracking-tight text-ink">
                    Neobee Hospital PLC
                  </h2>
                  <p className="text-[12.5px] font-medium text-honey-deep uppercase tracking-wider">
                    Stakeholder Portal
                  </p>
                </div>
              </div>

              <div className="mt-6 border-t border-line/60 pt-6">
                <h3 className="font-display text-[13px] font-bold uppercase tracking-wider text-ink-soft mb-4">
                  How Login Works
                </h3>

                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-honey/20 text-[12px] font-bold text-honey-deep">
                      1
                    </span>
                    <div>
                      <h4 className="text-[13.5px] font-semibold text-ink">Enter Credentials</h4>
                      <p className="text-[12.5px] text-ink-soft leading-relaxed">
                        Sign in using your registered email and password.
                      </p>
                    </div>
                  </li>

                  <li className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-honey/20 text-[12px] font-bold text-honey-deep">
                      2
                    </span>
                    <div>
                      <h4 className="text-[13.5px] font-semibold text-ink">Verification & Access</h4>
                      <p className="text-[12.5px] text-ink-soft leading-relaxed">
                        Admin-verified accounts reach the stakeholder dashboard immediately.
                      </p>
                    </div>
                  </li>

                  <li className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-honey/20 text-[12px] font-bold text-honey-deep">
                      3
                    </span>
                    <div>
                      <h4 className="text-[13.5px] font-semibold text-ink">Password Recovery</h4>
                      <p className="text-[12.5px] text-ink-soft leading-relaxed">
                        Easily reset forgotten passwords with a secure one-time verification code.
                      </p>
                    </div>
                  </li>
                </ul>
              </div>
            </div>

            {/* Bottom Callout in Left Side */}
            <div className="mt-8 rounded-2xl border border-honey/30 bg-honey-soft/50 p-4 transition-colors hover:bg-honey-soft/80">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-lg bg-honey/20 p-1.5 text-honey-deep">
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-[13px] font-bold text-ink">New to Neobee Hospital?</h4>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-soft">
                    If you haven&apos;t registered yet, complete the{" "}
                    <Link
                      href="/signup"
                      className="font-semibold text-honey-deep underline-offset-2 hover:underline"
                    >
                      shareholder registration
                    </Link>{" "}
                    first.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Main Login Form (Desktop 7 cols, Mobile full) */}
          <div className="lg:col-span-7 flex flex-col justify-center">
            <div className="mx-auto w-full max-w-md lg:max-w-lg">
              {/* Form Heading */}
              <div className="mb-6 text-center lg:text-left">
                <h1 className="font-display text-[26px] sm:text-[30px] font-extrabold leading-tight tracking-tight text-ink">
                  Sign in to your account
                </h1>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
                  Enter your email and password to access your stakeholder dashboard.
                </p>
              </div>

              {/* Inline success notice after password reset */}
              {resetSuccess && (
                <div
                  role="status"
                  className="mb-4 rounded-xl border border-green/40 bg-green-soft px-4 py-3 text-[13px] text-ink flex items-center gap-2.5 shadow-xs"
                >
                  <svg className="size-4 text-green shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Your password has been updated. Sign in with your new password.</span>
                </div>
              )}

              {/* Login Card */}
              <LoginForm
                defaultEmail={defaultEmail}
                newSignupNotice={isNew === "1"}
                deniedNotice={denied === "1"}
                pendingNotice={pending === "1"}
              />
            </div>
          </div>

        </div>
      </main>

      <SiteFooter />
    </>
  );
}

function HexBrandMark() {
  return (
    <svg
      viewBox="0 0 70 78"
      aria-hidden="true"
      className="h-12 w-[40px] shrink-0"
    >
      <defs>
        <linearGradient id="login-hex-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FBF0D6" />
          <stop offset="100%" stopColor="#FDFCF7" />
        </linearGradient>
      </defs>
      <polygon
        points="35,2 66,19 66,59 35,76 4,59 4,19"
        fill="url(#login-hex-bg)"
        stroke="#E9E4D4"
        strokeWidth="1"
      />
      <polygon points="35,12 56,23.5 56,54.5 35,66 14,54.5 14,23.5" fill="#201D12" />
      <text
        x="35"
        y="48"
        textAnchor="middle"
        fontFamily="var(--font-archivo), sans-serif"
        fontWeight="800"
        fontSize="22"
        fill="#E9A215"
      >
        N
      </text>
    </svg>
  );
}
