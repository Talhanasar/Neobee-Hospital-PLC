"use client";

import Link from "next/link";

/**
 * Marketing-grade hero for the landing page:
 *  - Slim eyebrow chip ("Chattogram · Founding phase open")
 *  - Large display heading + supporting line + subtitle
 *  - Primary honey CTA ("Become a stakeholder" → /signup)
 *  - Secondary ghost CTA ("Verify a receipt" → /verify)
 *  - Subtle decorative hex motif (large soft hex + conic accent in the corner)
 */
export default function LandingHero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative mb-10 overflow-hidden rounded-3xl border border-line bg-panel px-6 py-10 sm:px-10 sm:py-14"
    >
      {/* Decorative hex motif — large soft hex (top-right) + smaller conic
          accent (bottom-left). Mirrors the language of the brand mark and
          the legacy ProgressBanner's hex corner, but at low opacity so it
          never competes with the copy. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-16 h-[280px] w-[260px] opacity-[0.10]"
        style={{
          background:
            "conic-gradient(from 30deg, #E9A215 0 60deg, transparent 60deg 120deg, #E9A215 120deg 180deg, transparent 180deg 240deg, #E9A215 240deg 300deg, transparent 300deg)",
          clipPath:
            "polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-10 -left-10 h-[140px] w-[130px] opacity-[0.08]"
        style={{
          background:
            "conic-gradient(from 30deg, #2F7D5B 0 60deg, transparent 60deg 120deg, #2F7D5B 120deg 180deg, transparent 180deg 240deg, #2F7D5B 240deg 300deg, transparent 300deg)",
          clipPath:
            "polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)",
        }}
      />

      <div className="relative max-w-3xl">
        {/* Eyebrow chip */}
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-honey-soft bg-honey-soft/70 px-3 py-1 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-honey-deep">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-honey-deep" />
          Chattogram · Founding phase open
        </div>

        {/* Heading + supporting line */}
        <h1
          id="hero-title"
          className="font-display text-[34px] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink sm:text-[44px] md:text-[52px]"
        >
          Neobee Hospital PLC
        </h1>
        <p className="mt-3 font-display text-[16px] font-medium text-ink-soft sm:text-[18px]">
          A specialized, full-service hospital initiative in Chattogram.
        </p>

        {/* Subtitle */}
        <p className="mt-5 max-w-[640px] text-[15px] leading-relaxed text-ink-soft sm:text-[16px]">
          Shares of ৳2,00,000 each, opening with a 50-entrepreneur founding phase. Every deposit gets a unique ID, digital money receipt and QR verification.
        </p>

        {/* CTAs */}
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-full bg-honey px-7 py-3.5 font-display text-[15px] font-bold tracking-tight text-ink shadow-sm transition-colors hover:bg-[#d99408] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-honey-deep"
          >
            Become a stakeholder
            <span aria-hidden="true" className="ml-2">→</span>
          </Link>
          <Link
            href="/verify"
            className="inline-flex items-center justify-center rounded-full border border-line bg-paper/70 px-6 py-3.5 text-[14.5px] font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-honey"
          >
            Verify a receipt
          </Link>
        </div>
      </div>
    </section>
  );
}
