// The real Neobee logo (copied from reference/ into public/images). JPEG has no
// alpha, so it renders inside a rounded frame — treat the frame as part of the mark.
export function BrandLogo({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src="/images/logo_white_back.png"
      alt=""
      width={size}
      height={Math.round(size * 0.667)}
      className={`shrink-0 rounded-xl bg-white object-contain p-1 ring-1 ring-line ${className}`}
    />
  );
}
