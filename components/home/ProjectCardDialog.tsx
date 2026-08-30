'use client';

import * as React from 'react';
import { ImageDownIcon, LoaderCircleIcon } from '@/components/ui/icons';
import { Btn } from '@/components/ui/bits';
import { drawProjectCard, downloadCanvas } from '@/components/share-card';

export type ProjectCardDialogProps = {
  triggerLabel: string;
  title: string;
  drawingLabel: string;
  downloadLabel: string;
  savedLabel: string;
  hint: string;
  services: string[];
  location: string;
};

/**
 * "Project at a glance" share card — renders a 1080×1350 PNG on a
 * <canvas> entirely on-device (no network, no backend) and downloads it.
 */
export default function ProjectCardDialog({
  triggerLabel,
  title,
  drawingLabel,
  downloadLabel,
  savedLabel,
  hint,
  services,
  location,
}: ProjectCardDialogProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [open, setOpen] = React.useState(false);
  const [drawing, setDrawing] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const renderGlance = React.useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setDrawing(true);
    try {
      await drawProjectCard(canvas, {
        beds: 200,
        phases: 3,
        services,
        location,
      });
    } catch {
      /* best-effort rendering */
    } finally {
      setDrawing(false);
    }
  }, [services, location]);

  React.useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => void renderGlance());
    return () => cancelAnimationFrame(id);
  }, [open, renderGlance]);

  /* Escape closes the dialog. */
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas || drawing) return;
    downloadCanvas(canvas, 'neobee-project-card.png');
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  return (
    <>
      <Btn
        variant="outline"
        onClick={() => setOpen(true)}
        className="focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2"
      >
        <ImageDownIcon size={16} aria-hidden="true" />
        {triggerLabel}
      </Btn>

      {open ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="nb-card w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
            <div className="relative mt-4 overflow-hidden rounded-xl border border-line">
              <canvas
                ref={canvasRef}
                className="block w-full"
                style={{ aspectRatio: '1080 / 1350' }}
              />
              {drawing ? (
                <div className="absolute inset-0 grid place-items-center bg-paper/80">
                  <p className="flex items-center gap-2 text-sm text-ink-soft">
                    <LoaderCircleIcon size={16} className="animate-spin" aria-hidden="true" />
                    {drawingLabel}
                  </p>
                </div>
              ) : null}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-ink-soft">{hint}</p>
            <div className="mt-3 flex items-center gap-3">
              <Btn className="w-full" onClick={download} disabled={drawing}>
                <ImageDownIcon size={16} aria-hidden="true" />
                {downloadLabel}
              </Btn>
              <span aria-live="polite" className="shrink-0 text-xs font-medium text-green">
                {saved ? savedLabel : ''}
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
