"use client";

import { useLang } from "@/lib/i18n/LanguageProvider";

/**
 * Side rail for the landing page. Desktop: stacked column next to the
 * AboutSections prose. Mobile: stacks under it.
 *
 * Contains:
 *   1. Three share-category pricing tier cards (Shareholder / Premium /
 *      Director). Director is subtly marked as the top tier.
 *   2. Contacts card.
 *   3. Compact "How to deposit" highlight card.
 *
 * Public info only — no target sums, no raised amounts.
 */
export default function SideCards() {
  const { t } = useLang();

  return (
    <aside className="flex flex-col gap-5">
      <ShareCategoriesCard t={t} />
      <ContactsCard t={t} />
      <HowToDepositCard t={t} />
    </aside>
  );
}

// ---------- Share categories (3 pricing tier cards) -----------------------

function ShareCategoriesCard({
  t,
}: {
  t: (path: Parameters<ReturnType<typeof useLang>["t"]>[0]) => string;
}) {
  return (
    <section
      aria-labelledby="side-categories-title"
      className="rounded-2xl border border-line bg-panel p-5 sm:p-6"
    >
      <header className="mb-4">
        <h3
          id="side-categories-title"
          className="font-display text-[14px] font-bold uppercase tracking-[0.06em] text-ink-soft"
        >
          {t("side.shareCategories")}
        </h3>
        <p className="mt-1 text-[12.5px] text-ink-soft">
          {t("side.shareCategoriesHint")}
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <TierCard
          kind="shareholder"
          badge={t("side.shareholderBadge")}
          shareCount={t("side.oneShare")}
          price="৳2,00,000"
          badgeClass="bg-neutral-soft text-ink-soft"
        />
        <TierCard
          kind="premium"
          badge={t("side.premiumBadge")}
          shareCount={t("side.fiveShares")}
          price="৳10,00,000"
          badgeClass="bg-honey-soft text-honey-deep"
        />
        <TierCard
          kind="director"
          badge={t("side.directorBadge")}
          shareCount={t("side.tenShares")}
          price="৳20,00,000"
          badgeClass="bg-green-soft text-green"
          topTier
        />
      </div>
    </section>
  );
}

function TierCard({
  kind,
  badge,
  shareCount,
  price,
  badgeClass,
  topTier = false,
}: {
  kind: "shareholder" | "premium" | "director";
  badge: string;
  shareCount: string;
  price: string;
  badgeClass: string;
  topTier?: boolean;
}) {
  // Per-tier accent ring. Director (top tier) gets a subtle green ring to
  // mark it as the flagship category.
  const ringClass =
    kind === "director"
      ? "border-green/40 ring-1 ring-green/15"
      : kind === "premium"
        ? "border-honey/30 ring-1 ring-honey/10"
        : "border-line";

  return (
    <div
      className={`relative rounded-xl bg-paper px-4 py-3.5 transition-shadow hover:shadow-sm ${ringClass}`}
    >
      {topTier && (
        <span
          aria-label="Top tier"
          className="absolute -top-2 right-3 inline-block rounded-full bg-green px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-paper shadow-sm"
        >
          Top tier
        </span>
      )}
      <div className="flex items-start justify-between gap-3">
        <div>
          <span
            className={`inline-block rounded-md px-2 py-0.5 text-[11.5px] font-semibold ${badgeClass}`}
          >
            {badge}
          </span>
          <div className="mt-1.5 text-[13px] text-ink-soft">
            {shareCount}
          </div>
        </div>
        <div className="font-mono text-[15px] font-bold text-ink">
          {price}
        </div>
      </div>
    </div>
  );
}

// ---------- Contacts ------------------------------------------------------

function ContactsCard({
  t,
}: {
  t: (path: Parameters<ReturnType<typeof useLang>["t"]>[0]) => string;
}) {
  return (
    <section
      aria-labelledby="side-contacts-title"
      className="rounded-2xl border border-line bg-panel p-5 sm:p-6"
    >
      <h3
        id="side-contacts-title"
        className="mb-3 font-display text-[14px] font-bold uppercase tracking-[0.06em] text-ink-soft"
      >
        {t("side.contacts")}
      </h3>
      <div className="divide-y divide-line">
        <Person name="Jahangir Alam Akash" role={t("side.chairman")} />
        <Person name="Mizanur Rahman" role={t("side.spokesperson")} />
        <Person name="Junayed" role={t("side.mdNeotech")} />
      </div>
    </section>
  );
}

function Person({ name, role }: { name: string; role: string }) {
  return (
    <div className="py-2.5 first:pt-0 last:pb-0">
      <b className="block text-[14px] font-semibold text-ink">{name}</b>
      <span className="text-[12.5px] text-ink-soft">{role}</span>
    </div>
  );
}

// ---------- How to deposit (mini rail) -----------------------------------

function HowToDepositCard({
  t,
}: {
  t: (path: Parameters<ReturnType<typeof useLang>["t"]>[0]) => string;
}) {
  return (
    <section
      aria-labelledby="side-deposit-title"
      className="rounded-2xl border border-honey-soft bg-honey-soft/50 p-5 sm:p-6"
    >
      <h3
        id="side-deposit-title"
        className="mb-2 font-display text-[14px] font-bold uppercase tracking-[0.06em] text-honey-deep"
      >
        {t("side.depositHighlight")}
      </h3>
      <p className="text-[13.5px] leading-relaxed text-ink">
        {t("side.depositHighlightBody")}
      </p>
    </section>
  );
}
