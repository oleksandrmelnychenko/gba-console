import { Alert, Button, Group, Select, Stack, Text, TextInput } from '@mantine/core'
import { useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { AmgDiscountVariant, AmgDiscountVariantScope } from '../data/originalAmgDiscountAnalysisVariants'
import { useAmgDiscountVariants } from '../hooks/useAmgDiscountVariants'

type Variants = ReturnType<typeof useAmgDiscountVariants>
type VariantState = Variants['run']['lastRun']

function VariantPicker({ variants, state, selected, disabled, setChosen }: {
  variants: Variants; state: VariantState; selected: AmgDiscountVariant | null; disabled: boolean; setChosen: (id: string | null) => void
}) {
  const { t } = useI18n()
  return <Group><Button variant="light" disabled={disabled} loading={variants.run.isLoading} onClick={() => { setChosen(null); void variants.refresh() }}>{t('Оновити варіанти AMG')}</Button>
    <Select label={t('Збережений варіант AMG')} searchable data={(state?.list.Items ?? []).map(v => ({ value: v.Id, label: v.Name }))} value={selected?.Id ?? null} disabled={disabled || !state?.list.StorageAvailable} onChange={setChosen} /></Group>
}

function VariantActions({ variants, selected, active, scope, name, disabled, savable, setChosen, setName, onLoad }: {
  variants: Variants; selected: AmgDiscountVariant | null; active: AmgDiscountVariant | null; scope: AmgDiscountVariantScope | null
  name: string; disabled: boolean; savable: boolean; setChosen: (id: string | null) => void; setName: (name: string) => void; onLoad: (v: AmgDiscountVariant) => void
}) {
  const { t } = useI18n()
  return <Group><Button variant="light" disabled={disabled || !selected} onClick={() => { if (selected) void variants.load(selected, variant => { setName(variant.Name); setChosen(variant.Id); onLoad(variant) }) }}>{t('Відкрити варіант AMG')}</Button>
      <Button variant="light" disabled={!savable} onClick={() => { if (scope) void variants.save({ Id: null, Revision: 0, Name: name, Scope: scope }, saved => { setChosen(saved.Id); setName(saved.Name) }) }}>{t('Зберегти як новий варіант AMG')}</Button>
      <Button variant="light" disabled={!savable || !active} onClick={() => { if (scope && active) void variants.save({ Id: active.Id, Revision: active.Revision, Name: name, Scope: scope }, saved => { setChosen(saved.Id); setName(saved.Name) }) }}>{t('Оновити власний варіант AMG')}</Button>
      <Button variant="light" color="red" disabled={disabled || !selected} onClick={() => { if (selected) void variants.remove(selected) }}>{t('Видалити власний варіант AMG')}</Button></Group>
}

function VariantFeedback({ state, error }: { state: VariantState; error: string | null }) {
  const { t } = useI18n()
  return <>
    {state?.list.StorageAvailable === false ? <Text size="sm" c="dimmed">{t('Сховище власних варіантів AMG ще недоступне.')}</Text> : null}
    {error ? <Alert color="red">{error}</Alert> : null}
  </>
}

export function OriginalAmgDiscountVariantControls({ callerKey, permitted, busy, scope, blocked, onLoad }: {
  callerKey: string | null; permitted: boolean; busy: boolean; scope: AmgDiscountVariantScope | null; blocked: boolean; onLoad: (v: AmgDiscountVariant) => void
}) {
  const { t } = useI18n(), variants = useAmgDiscountVariants(callerKey, permitted, JSON.stringify(scope)), [name, setName] = useState(''), [chosen, setChosen] = useState<string | null>(null)
  const state = variants.run.lastRun, selected = state?.list.Items.find(v => v.Id === chosen) ?? null, active = state?.active ?? null
  const disabled = !permitted || busy || variants.run.isLoading, savable = !disabled && !!scope && !blocked && !!name.trim() && state?.list.StorageAvailable === true
  return <Stack gap="xs"><VariantPicker variants={variants} state={state} selected={selected} disabled={disabled} setChosen={setChosen} />
    <TextInput label={t('Назва варіанта AMG')} value={name} maxLength={120} disabled={disabled} onChange={event => setName(event.currentTarget.value)} />
    <VariantActions variants={variants} selected={selected} active={active} scope={scope} name={name} disabled={disabled} savable={savable} setChosen={setChosen} setName={setName} onLoad={onLoad} />
    <VariantFeedback state={state} error={variants.run.error} /></Stack>
}
