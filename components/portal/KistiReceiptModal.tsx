'use client';

import * as React from 'react';
import { useTranslations, useLocale } from 'next-intl';

export function KistiReceiptModal({ investmentId, uid, installmentNo }: { investmentId: string; uid: string; installmentNo: number }) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const t = useTranslations('portal');
  const tPrint = useTranslations('admin');
  const locale = useLocale();

  const title = `${t('receiptModalTitle')} · ${uid}-K${installmentNo}`;

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

  return (
    <>
      <button type="button" ref={triggerRef} onClick={() => setOpen(true)} className="font-mono text-xs font-semibold text-ink hover:text-honey underline underline-offset-4">
        {t('receiptDownload')}
      </button>
      {open ? (
        <div className="fixed inset-0 bg-ink/55 flex items-center justify-center z-50 p-4 sm:p-6 overflow-auto" onClick={() => setOpen(false)}>
          <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} className="bg-panel rounded-[18px] max-w-[760px] w-full p-4 sm:p-5 relative" onClick={(e) => e.stopPropagation()}>
            <button type="button" aria-label={t('receiptModalClose')} className="no-print absolute right-3 top-3 text-ink-soft" onClick={() => setOpen(false)}>
              ×
            </button>
            <h3 id={titleId} className="text-base font-semibold pr-6">{title}</h3>
            <iframe ref={iframeRef} src={`/${locale}/receipts/${investmentId}?kisti=${installmentNo}&embed=1`} title={title} className="mt-3 h-[70vh] w-full rounded-lg border border-line bg-panel" />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => iframeRef.current?.contentWindow?.postMessage('neobee:print', '*')}
                className="inline-flex h-8 items-center rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold text-ink hover:border-honey"
              >
                {tPrint('print')}
              </button>
              <a href={`/api/investments/${investmentId}/receipt?kisti=${installmentNo}`} download className="inline-flex h-8 items-center rounded-lg bg-honey px-3 text-[13px] font-semibold text-ink hover:bg-honey-deep">{t('receiptDownload')}</a>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
