'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';

export function QrModal({ qrDataUrl, code, uid, defaultOpen = false }: { qrDataUrl: string; code: string; uid: string; defaultOpen?: boolean }) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [copied, setCopied] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const t = useTranslations('qr');

  React.useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const timer = window.setTimeout(() => panelRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown);
      trigger?.focus();
    };
  }, [open]);

  const download = () => {
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `${uid}-qr.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const copy = async () => {
    if (!navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  return (
    <>
      <Button ref={triggerRef} size="sm" onClick={() => setOpen(true)}>
        {t('trigger')}
      </Button>
      {open ? (
        <div className="fixed inset-0 bg-ink/55 flex items-center justify-center z-50 p-5 overflow-auto print-static" onClick={() => setOpen(false)}>
          <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} className="bg-panel rounded-[18px] max-w-[440px] w-full p-7 text-center relative" onClick={(e) => e.stopPropagation()}>
            <button type="button" aria-label={t('close')} className="no-print absolute right-3 top-3 text-ink-soft" onClick={() => setOpen(false)}>
              ×
            </button>
            <h3 id={titleId} className="text-[22px] font-semibold">
              {t('title')}
            </h3>
            <div className="text-sm text-ink-soft">
              {t('subtitle')} <span className="num">{uid}</span>
            </div>
            <div className="w-[230px] h-[258px] mx-auto mb-4 flex items-center justify-center bg-honey hex">
              <div className="w-[214px] h-[242px] bg-white flex items-center justify-center hex">
                {/* Data-URL QR: next/image cannot optimize a data: URI, and its wrapper markup breaks the print layout. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="" width={150} height={150} />
              </div>
            </div>
            <div className="inline-flex rounded-full bg-honey-soft px-3 py-1 text-sm font-semibold num">{code}</div>
            <div className="no-print mt-5 flex justify-center gap-2.5">
              <Button size="sm" onClick={download}>
                {t('download')}
              </Button>
              <Button size="sm" onClick={copy}>
                {copied ? t('copied') : t('copy')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
