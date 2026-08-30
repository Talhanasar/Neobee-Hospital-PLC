'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { confirmInvestmentAction } from '@/app/[locale]/(dash)/portal/actions';
export default function ConfirmButton({ investmentId }: { investmentId: string }) { const t = useTranslations('portal'); const [armed, setArmed] = React.useState(false); const [loading, setLoading] = React.useState(false); const [error, setError] = React.useState<string | null>(null); const run = async () => { if (!armed) { setArmed(true); return; } setLoading(true); setError(null); try { const result = await confirmInvestmentAction(investmentId); if (result.error) setError(result.error); else setArmed(false); } catch { setError(t('errorFallback')); } finally { setLoading(false); } }; return <div className="space-y-2"><Button variant="primary" onClick={run} disabled={loading}>{loading ? t('confirming') : t('confirmAction')}</Button>{armed ? <div className="rounded-lg border border-line bg-paper p-3 text-sm space-y-2"><p>{t('confirmWarning')}</p><div className="flex gap-2"><Button variant="primary" onClick={run} disabled={loading}>{t('confirmYes')}</Button><Button onClick={() => setArmed(false)} disabled={loading}>{t('confirmCancel')}</Button></div></div> : null}{error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}</div>; }
