/**
 * Neobee hex "N" brand mark. Single source of truth for the logo used in
 * headers (and mirrored by the app favicon in src/app/icon.svg).
 * Honey outer hex (#E9A215), ink inner hex (#201D12), honey "N".
 */
export default function LogoMark({ className = "h-9 w-[34px] flex-none" }: { className?: string }) {
  return (
    <svg viewBox="0 0 38 42" aria-hidden="true" className={className}>
      <polygon points="19,1 36,11 36,31 19,41 2,31 2,11" className="fill-honey" />
      <polygon points="19,8 30,14.5 30,27.5 19,34 8,27.5 8,14.5" className="fill-ink" />
      <text
        x="19"
        y="26"
        textAnchor="middle"
        fontFamily="var(--font-archivo), sans-serif"
        fontWeight="800"
        fontSize="13"
        className="fill-honey"
      >
        N
      </text>
    </svg>
  );
}
