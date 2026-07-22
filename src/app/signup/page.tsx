import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SignupForm from "@/components/SignupForm";

export const metadata = {
  title: "Register as a stakeholder — Neobee Hospital PLC",
  description:
    "Reserve your Neobee Hospital PLC shares — get a unique ID, digital money receipt and QR verification.",
};

export default function SignupPage() {
  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-20 pt-7 sm:pt-9">
        <header className="mb-7">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-honey-soft bg-honey-soft/70 px-3 py-1 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-honey-deep">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-honey-deep" />
            Stakeholder registration
          </div>
          <h1 className="font-display text-[30px] font-extrabold leading-tight tracking-[-0.02em] text-ink sm:text-[34px]">
            Register a shareholder
          </h1>
          <p className="mt-2 max-w-[640px] text-[14.5px] leading-relaxed text-ink-soft">
            On saving, the system issues a unique ID, a QR verification code
            and a digital money receipt — as promised to every shareholder on
            deposit.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-[1.6fr_1fr] md:items-start">
          <SignupForm />

          <aside className="flex flex-col gap-5">
            <section className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
              <h2 className="mb-3 font-display text-[14px] font-bold uppercase tracking-[0.06em] text-ink-soft">
                How deposit works
              </h2>
              <ol className="space-y-2.5 text-[14px] leading-relaxed text-ink">
                <li>
                  <span className="font-mono font-semibold text-honey-deep">
                    1.
                  </span>{" "}
                  Submit this form — your record is saved with status{" "}
                  <b>PENDING</b>.
                </li>
                <li>
                  <span className="font-mono font-semibold text-honey-deep">
                    2.
                  </span>{" "}
                  We email a one-time login code to the address you provided.
                </li>
                <li>
                  <span className="font-mono font-semibold text-honey-deep">
                    3.
                  </span>{" "}
                  Deposit to the NEOBEE bank account using the chosen method
                  and reference.
                </li>
                <li>
                  <span className="font-mono font-semibold text-honey-deep">
                    4.
                  </span>{" "}
                  Once the deposit is reconciled, status flips to{" "}
                  <b>CONFIRMED</b> and your receipt is downloadable from the
                  dashboard.
                </li>
              </ol>
            </section>

            <section className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
              <h2 className="mb-3 font-display text-[14px] font-bold uppercase tracking-[0.06em] text-ink-soft">
                Share categories
              </h2>
              <div className="divide-y divide-line text-[14px]">
                <div className="flex items-center justify-between gap-2.5 py-2.5">
                  <span>
                    <span className="mr-2 inline-block rounded-md bg-neutral-soft px-2 py-0.5 text-[11.5px] font-semibold text-ink-soft">
                      Shareholder
                    </span>
                    1 share
                  </span>
                  <span className="font-mono text-[13.5px] font-semibold">
                    ৳2,00,000
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2.5 py-2.5">
                  <span>
                    <span className="mr-2 inline-block rounded-md bg-honey-soft px-2 py-0.5 text-[11.5px] font-semibold text-honey-deep">
                      Premium
                    </span>
                    5 shares
                  </span>
                  <span className="font-mono text-[13.5px] font-semibold">
                    ৳10,00,000
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2.5 py-2.5">
                  <span>
                    <span className="mr-2 inline-block rounded-md bg-green-soft px-2 py-0.5 text-[11.5px] font-semibold text-green">
                      Director
                    </span>
                    10 shares
                  </span>
                  <span className="font-mono text-[13.5px] font-semibold">
                    ৳20,00,000
                  </span>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
