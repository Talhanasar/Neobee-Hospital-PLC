'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { btnClasses } from '@/components/ui/bits';

// Minimal type shims for the browser-native BarcodeDetector API.
// This TS lib.dom (5.9.3) does not declare BarcodeDetector, and we install no
// extra @types — these cover only what we use (detect + getSupportedFormats).
interface DetectedBarcode {
  format: string;
  rawValue: string | null;
}
interface BarcodeDetectorCtor {
  new (): { detect(source: HTMLVideoElement): Promise<DetectedBarcode[]> };
  getSupportedFormats?: () => Promise<string[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorCtor;
  }
}

const CODE_RE = /^NB-[A-HJ-NP-Z2-9]{6}$/i;

export default function ScanViewfinder({ onCode }: { onCode: (code: string) => void }) {
  const t = useTranslations('verify');
  type State = 'idle' | 'checking' | 'scanning' | 'found' | 'unsupported' | 'error';
  // Lazy initial state: unsupported browsers (no BarcodeDetector) show the
  // fallback note immediately without a setState-in-effect render cascade.
  const [state, setState] = React.useState<State>(() =>
    typeof window !== 'undefined' && (!('BarcodeDetector' in window) || !window.BarcodeDetector)
      ? 'unsupported'
      : 'idle',
  );
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const intervalRef = React.useRef<number | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const detectorRef = React.useRef<{ detect(source: HTMLVideoElement): Promise<DetectedBarcode[]> } | null>(null);

  const stopCamera = React.useCallback(() => {
    if (intervalRef.current != null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    detectorRef.current = null;
  }, []);

  // Detect support once at mount so unsupported browsers show the note immediately,
  // not only after a button press. Lazy initial state avoids setState-in-effect.
  React.useEffect(() => () => stopCamera(), [stopCamera]);

  const extractCode = React.useCallback((raw: string): string | null => {
    try {
      const u = new URL(raw);
      const c = u.searchParams.get('code');
      if (c) return c;
    } catch {
      if (CODE_RE.test(raw)) return raw.toUpperCase();
    }
    return null;
  }, []);

  const startScan = React.useCallback(async () => {
    if (!('BarcodeDetector' in window) || !window.BarcodeDetector) {
      setState('unsupported');
      return;
    }
    const BD = window.BarcodeDetector;
    try {
      const formats = BD.getSupportedFormats ? await BD.getSupportedFormats() : [];
      if (!formats || !formats.length) {
        setState('unsupported');
        return;
      }
    } catch {
      setState('unsupported');
      return;
    }

    setState('checking');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const detector = new BD();
      detectorRef.current = detector;
      setState('scanning');

      intervalRef.current = window.setInterval(() => {
        const video = videoRef.current;
        if (!video) return;
        detectorRef.current?.detect(video).then((barcodes) => {
          for (const b of barcodes) {
            if (!b.rawValue) continue;
            const code = extractCode(b.rawValue);
            if (code) {
              setState('found');
              stopCamera();
              onCode(code);
              return;
            }
          }
        }).catch(() => {});
      }, 300);
    } catch {
      setState('error');
    }
  }, [onCode, stopCamera, extractCode]);

  return (
    <div className="mt-5">
      <div className="relative mx-auto aspect-square w-full max-w-[240px] overflow-hidden rounded-2xl border border-line bg-ink">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="absolute inset-0 h-full w-full object-cover"
        />
        <span aria-hidden="true" className="hex-bg absolute inset-0 opacity-[0.16]" />

        {/* corner brackets — honey, hexagon-flavoured viewfinder */}
        <span aria-hidden="true" className="absolute left-3 top-3 h-6 w-6 border-l-2 border-t-2 border-honey" />
        <span aria-hidden="true" className="absolute right-3 top-3 h-6 w-6 border-r-2 border-t-2 border-honey" />
        <span aria-hidden="true" className="absolute bottom-3 left-3 h-6 w-6 border-b-2 border-l-2 border-honey" />
        <span aria-hidden="true" className="absolute bottom-3 right-3 h-6 w-6 border-b-2 border-r-2 border-honey" />

        {/* scan line — honey sweep, disabled under reduced motion */}
        <span aria-hidden="true" className="scan-line absolute left-4 right-4 top-6 h-0.5 rounded-full bg-honey" />

        {/* status chip */}
        <span className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-line bg-paper/90 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
          {state === 'found' ? t('scannerFound') : t('scanStatus')}
        </span>
      </div>

      {state === 'unsupported' ? (
        <p className="mt-3 text-[11px] leading-relaxed text-ink-soft">{t('scannerUnsupported')}</p>
      ) : state === 'error' ? (
        <p className="mt-3 text-[11px] leading-relaxed text-ink-soft">{t('scannerError')}</p>
      ) : state === 'scanning' ? (
        <button
          type="button"
          onClick={stopCamera}
          className={`${btnClasses('primary', 'md')} mt-4 w-full focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2`}
        >
          {t('scannerStop')}
        </button>
      ) : state === 'idle' ? (
        <button
          type="button"
          onClick={startScan}
          className={`${btnClasses('primary', 'md')} mt-4 w-full focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2`}
        >
          {t('scannerStart')}
        </button>
      ) : null}
    </div>
  );
}
