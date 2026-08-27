'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { createInvestorProfileAction, type CreateInvestorProfileState } from '@/app/[locale]/(auth)/login/actions';

const initialState: CreateInvestorProfileState = { ok: false, fieldErrors: {} };

function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  if (!messages?.length) return null;
  return <p id={id} className="mt-1 text-xs text-[#B3261E]">{messages[0]}</p>;
}

export default function ProfileForm({ verifiedPhone }: { verifiedPhone: string | null }) {
  const t = useTranslations('register');
  const router = useRouter();
  const [state, action, pending] = useActionState(createInvestorProfileAction, initialState);

  React.useEffect(() => {
    if (state.ok) {
      router.push('/portal');
    }
  }, [state, router]);

  return (
    <form action={action} className="space-y-5">
      {state.ok === false && state.formError ? (
        <div role="alert" className="bg-[#FBE4E2] text-[#B3261E] rounded-card px-4 py-3">{state.formError}</div>
      ) : null}
      <div className="space-y-3">
        <div>
          <label htmlFor="phone" className="block text-[12.5px] font-semibold mb-1.5">{t('phoneLabel')}</label>
          <input
            id="phone"
            type="tel"
            value={verifiedPhone ?? ''}
            readOnly
            aria-readonly
            className="w-full border border-line rounded-lg px-3.5 py-2.5 bg-panel focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2"
          />
          <p className="text-xs text-ink-soft mt-1">{t('phoneHelper')}</p>
        </div>

        <div>
          <label htmlFor="name" className="block text-[12.5px] font-semibold mb-1.5">{t('nameLabel')}</label>
          <input
            id="name"
            name="name"
            aria-invalid={Boolean(state.ok === false && state.fieldErrors.name)}
            aria-describedby={state.ok === false && state.fieldErrors.name ? 'name-error' : undefined}
            placeholder={t('namePlaceholder')}
            className="w-full border border-line rounded-lg px-3.5 py-2.5 bg-panel focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2"
          />
          <FieldError id="name-error" messages={state.ok === false ? state.fieldErrors.name : undefined} />
        </div>

        <div>
          <label htmlFor="email" className="block text-[12.5px] font-semibold mb-1.5">{t('emailLabel')}</label>
          <input
            id="email"
            name="email"
            type="email"
            aria-invalid={Boolean(state.ok === false && state.fieldErrors.email)}
            aria-describedby={state.ok === false && state.fieldErrors.email ? 'email-error' : undefined}
            placeholder={t('emailPlaceholder')}
            className="w-full border border-line rounded-lg px-3.5 py-2.5 bg-panel focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2"
          />
          <FieldError id="email-error" messages={state.ok === false ? state.fieldErrors.email : undefined} />
        </div>

        <div>
          <label htmlFor="nationalIdNumber" className="block text-[12.5px] font-semibold mb-1.5">{t('nidLabel')}</label>
          <input
            id="nationalIdNumber"
            name="nationalIdNumber"
            aria-invalid={Boolean(state.ok === false && state.fieldErrors.nationalIdNumber)}
            aria-describedby={state.ok === false && state.fieldErrors.nationalIdNumber ? 'nationalIdNumber-error' : undefined}
            className="w-full border border-line rounded-lg px-3.5 py-2.5 bg-panel focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2"
          />
          <FieldError id="nationalIdNumber-error" messages={state.ok === false ? state.fieldErrors.nationalIdNumber : undefined} />
        </div>
      </div>
      <Button variant="primary" type="submit" disabled={pending}>{pending ? t('submitting') : t('submitProfile')}</Button>
    </form>
  );
}
