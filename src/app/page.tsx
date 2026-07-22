import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import LandingHero from "@/components/LandingHero";
import AboutSections from "@/components/AboutSections";
import SideCards from "@/components/SideCards";

// Public landing — static. No DB access, no investment aggregates.
// All financial aggregates are admin-only and live under /admin.
export const dynamic = "force-static";

export const metadata = {
  title: "Neobee Hospital PLC — Stakeholder Portal",
  description:
    "Neobee Hospital PLC — a specialized, full-service hospital initiative in Chattogram. Reserve your shares, receive a unique ID, digital money receipt and QR verification.",
};

export default function HomePage() {
  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-20 pt-7 sm:pt-9">
        <LandingHero />

        <div className="grid gap-6 md:grid-cols-[1.6fr_1fr] md:items-start">
          <article className="rounded-2xl border border-line bg-panel p-6 leading-relaxed text-[#3C382A] sm:p-8">
            <AboutSections />
          </article>
          <SideCards />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
