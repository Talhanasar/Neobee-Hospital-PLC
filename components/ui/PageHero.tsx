type PageHeroProps = { eyebrow?: string; title: string; lead?: string };

export function PageHero({ eyebrow, title, lead }: PageHeroProps) {
  return (
    <section className="mb-7 max-w-2xl">
      {eyebrow ? (
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[.16em] text-honey-deep">{eyebrow}</p>
      ) : null}
      <h1 className="font-display text-[30px] font-extrabold leading-[1.08] tracking-[-.045em] sm:text-[42px]">{title}</h1>
      {lead ? <p className="mt-3 text-[15px] leading-7 text-ink-soft">{lead}</p> : null}
    </section>
  );
}

export default PageHero;
