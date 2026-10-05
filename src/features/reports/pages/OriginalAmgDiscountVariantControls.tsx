import { Alert, Button, Group, Select, Stack, Text, TextInput } from '@mantine/core'
import { useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { AmgDiscountVariant, AmgDiscountVariantScope } from '../data/originalAmgDiscountAnalysisVariants'
import { useAmgDiscountVariants } from '../hooks/useAmgDiscountVariants'
export function OriginalAmgDiscountVariantControls({ callerKey, permitted, busy, scope, blocked, onLoad }: {
  callerKey: string | null; permitted: boolean; busy: boolean; scope: AmgDiscountVariantScope | null; blocked: boolean; onLoad: (v: AmgDiscountVariant) => void
}) {
  const { t } = useI18n(), variants = useAmgDiscountVariants(callerKey, permitted, JSON.stringify(scope)), [name, setName] = useState(''), [chosen, setChosen] = useState<string | null>(null)
  const state = variants.run.lastRun, selected = state?.list.Items.find(v => v.Id === chosen) ?? null, active = state?.active ?? null
  const disabled = !permitted || busy || variants.run.isLoading, savable = !disabled && !!scope && !blocked && !!name.trim() && state?.list.StorageAvailable === true
  return <Stack gap="xs"><Group><Button variant="light" disabled={disabled} loading={variants.run.isLoading} onClick={() => { setChosen(null); void variants.refresh() }}>{t('Оновити варіанти AMG')}</Button>
    <Select label={t('Збережений варіант AMG')} searchable data={(state?.list.Items ?? []).map(v => ({ value: v.Id, label: v.Name }))} value={selected?.Id ?? null} disabled={disabled || !state?.list.StorageAvailable} onChange={setChosen} /></Group>
    <TextInput label={t('Назва варіанта AMG')} value={name} maxLength={120} disabled={disabled} onChange={event => setName(event.currentTarget.value)} />
    <Group><Button variant="light" disabled={disabled || !selected} onClick={() => { if (selected) void variants.load(selected, variant => { setName(variant.Name); setChosen(variant.Id); onLoad(variant) }) }}>{t('Відкрити варіант AMG')}</Button>
      <Button variant="light" disabled={!savable} onClick={() => { if (scope) void variants.save({ Id: null, Revision: 0, Name: name, Scope: scope }, saved => { setChosen(saved.Id); setName(saved.Name) }) }}>{t('Зберегти як новий варіант AMG')}</Button>
      <Button variant="light" disabled={!savable || !active} onClick={() => { if (scope && active) void variants.save({ Id: active.Id, Revision: active.Revision, Name: name, Scope: scope }, saved => { setChosen(saved.Id); setName(saved.Name) }) }}>{t('Оновити власний варіант AMG')}</Button>
      <Button variant="light" color="red" disabled={disabled || !selected} onClick={() => { if (selected) void variants.remove(selected) }}>{t('Видалити власний варіант AMG')}</Button></Group>
    {state?.list.StorageAvailable === false ? <Text size="sm" c="dimmed">{t('Сховище власних варіантів AMG ще недоступне.')}</Text> : null}
    {variants.run.error ? <Alert color="red">{variants.run.error}</Alert> : null}</Stack>
}
