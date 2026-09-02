'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { updateSettingsAction, type SettingsState, type SettingsFormValues } from '@/app/[locale]/(dash)/admin/settings/actions';

const initialState: SettingsState = { ok: false, fieldErrors: {} };

const fields = [
  { name: 'SHARE_PRICE', label: 'settingsSharePrice', help: 'settingsSharePriceHelp', min: 1 },
  { name: 'INCENTIVE_PER_SHARE', label: 'settingsIncentivePerShare', help: 'settingsIncentiveHelp', min: 0 },
  { name: 'TARGET_AMOUNT', label: 'settingsTargetAmount', help: 'settingsTargetAmountHelp', min: 1 },
  { name: 'TARGET_SHARES', label: 'settingsTargetShares', help: null, min: 1 },
  { name: 'FOUNDING_AMOUNT', label: 'settingsFoundingAmount', help: 'settingsFoundingAmountHelp', min: 1 },
  { name: 'TARGET_ENTREPRENEURS', label: 'settingsTargetEntrepreneurs', help: null, min: 1 },
] as const;

function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  if (!messages?.length) return null;
  return <p id={id} className="mt-1 text-xs text-[#B3261E]">{messages[0]}</p>;
}

export function SettingsForm({ settings }: { settings: SettingsFormValues }) {
  const t = useTranslations('admin');
  const [state, action, pending] = useActionState(updateSettingsAction, initialState);

  return (
    <form action={action} className="space-y-5">
      {state.ok ? <div role="status" className="bg-green-soft text-green rounded-card px-4 py-3">{t('settingsSuccess')}</div> : null}
      {state.ok === false && state.formError ? <div role="alert" className="bg-[#FBE4E2] text-[#B3261E] rounded-card px-4 py-3">{state.formError}</div> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {fields.map((field) => {
          const errors = state.ok === false ? state.fieldErrors[field.name] : undefined;
          return (
            <label key={field.name} className="block">
              <span className="block text-[12.5px] font-semibold mb-1.5">{t(field.label)}</span>
              <input
                name={field.name}
                type="number"
                min={field.min}
                step={1}
                required
                defaultValue={settings[field.name]}
                aria-invalid={Boolean(errors)}
                aria-describedby={errors ? `${field.name}-error` : undefined}
                className="w-full border border-line rounded-lg px-3 py-2.5 bg-paper focus:outline-2 outline-honey-deep border-honey"
              />
              <FieldError id={`${field.name}-error`} messages={errors} />
              {field.help ? <p className="text-xs text-ink-soft mt-1">{t(field.help)}</p> : null}
            </label>
          );
        })}
      </div>
      <Button variant="primary" type="submit" disabled={pending}>{pending ? t('settingsSaving') : t('settingsSave')}</Button>
    </form>
  );
}
