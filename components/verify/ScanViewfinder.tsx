'use client';

import * as React from 'react';
import { HexQr } from '@/components/ui/bits';

/** Mock scan: tapping the viewfinder "captures" the sample code. */
export default function ScanViewfinder({ statusLabel, okLabel }: { statusLabel: string; okLabel: string }) {
  const [scanned, setScanned] = React.useState(false);

  const mockScan = () => {
    setScanned(true);
    window.setTimeout(() => setScanned(false), 1800);
  };

  return (
    <button
      type="button"
      onClick={mockScan}
      aria-label={statusLabel}
      className="group relative mx-auto mt-5 block aspect-square w-full max-w-[240px] overflow-hidden rounded-2xl border border-line bg-ink focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2"
    >
      {/* viewfinder backdrop — faint hex lattice on ink */}
      <span aria-hidden="true" className="hex-bg absolute inset-0 opacity-[0.16]" />
      {/* the "target" QR */}
      <span className="absolute inset-0 grid place-items-center">
        <span className="grid place-items-center transition-transform duration-500 group-hover:scale-105">
          <HexQr value={scanned ? 'NB-VERIFY-OK' : 'NB-SCAN-ME'} qrSize={96} />
        </span>
      </span>

      {/* corner brackets — honey, hexagon-flavoured viewfinder */}
      <span aria-hidden="true" className="absolute left-3 top-3 h-6 w-6 border-l-2 border-t-2 border-honey" />
      <span aria-hidden="true" className="absolute right-3 top-3 h-6 w-6 border-r-2 border-t-2 border-honey" />
      <span aria-hidden="true" className="absolute bottom-3 left-3 h-6 w-6 border-b-2 border-l-2 border-honey" />
      <span aria-hidden="true" className="absolute bottom-3 right-3 h-6 w-6 border-b-2 border-r-2 border-honey" />

      {/* scan line — honey sweep, disabled under reduced motion */}
      <span aria-hidden="true" className="scan-line absolute left-4 right-4 top-6 h-0.5 rounded-full bg-honey" />

      {/* status chip */}
      <span className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-line bg-paper/90 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
        {scanned ? okLabel : statusLabel}
      </span>
    </button>
  );
}
