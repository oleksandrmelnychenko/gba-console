import { Button, Checkbox, MultiSelect, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { receiptCaptionNote, warehouseReceiptKey, type ReceiptCaptionContext, type WarehouseReceiptKey } from '../data/warehouseReceiptCaptions'

type ReceiptOption = { value: string; label: string }
function useSelectedReceiptOptions(scope: string, context: ReceiptCaptionContext | undefined, selectedKeys: string[]) {
  const selectionKey = JSON.stringify(selectedKeys), selectedSet = new Set(selectedKeys)
  const [remembered, remember] = useState<{ scope: string; context: ReceiptCaptionContext | undefined; selectionKey: string; choices: ReceiptOption[] }>({
    scope: '', context: undefined, selectionKey: '', choices: [],
  })
  const prior = remembered.scope === scope ? remembered.choices.filter(choice => selectedSet.has(choice.value)) : []
  const known = context?.NormalSourceGenerationBound ? context.Choices.filter(choice => selectedSet.has(warehouseReceiptKey(choice.Receipt)))
    .map(choice => ({ value: warehouseReceiptKey(choice.Receipt), label: choice.Caption })) : []
  const choices = [...new Map([...prior, ...known].map(choice => [choice.value, choice])).values()]
  // Cache genuine selected captions with the same render's inputs; never carry names across scopes.
  if (remembered.scope !== scope || remembered.context !== context || remembered.selectionKey !== selectionKey) {
    remember({ scope, context, selectionKey, choices })
  }
  return choices
}
export function WarehouseReceiptCaptionControls({ supported, enabled, scope, context, selected, busy, toggle, select }: {
  supported: boolean; enabled: boolean; scope: string; context: ReceiptCaptionContext | undefined; selected: WarehouseReceiptKey[];
  busy: boolean; toggle: (value: boolean) => void; select: (values: string[]) => void
}) {
  const { t } = useI18n()
  const selectedKeys = selected.map(warehouseReceiptKey), prior = useSelectedReceiptOptions(scope, context, selectedKeys)
  const complete = context?.NormalSourceGenerationBound === true && context.CompleteReceiptChoices
  const current = complete ? context.Choices.map(choice => ({ value: warehouseReceiptKey(choice.Receipt), label: choice.Caption })) : []
  const names = new Map([...prior, ...current].map(choice => [choice.value, choice]))
  if (!supported) return null
  return <Stack gap="xs"><Checkbox label={t('Поточні підписи документів GBA')} checked={enabled} disabled={busy} onChange={event => toggle(event.currentTarget.checked)} />
    {enabled ? <><MultiSelect label={t('Документи надходження')} placeholder={t('Повний список для відбору з’явиться після перевіреного формування')}
      data={[...names.values()]} value={selectedKeys.filter(key => names.has(key))}
      disabled={busy || (!selected.length && (!complete || !current.length))} searchable clearable maxValues={256}
      clearButtonProps={{ 'aria-label': t('Очистити документи надходження') }} onChange={select} />
      {selected.length ? <Button variant="subtle" size="xs" disabled={busy} onClick={() => select([])}>{t('Очистити відбір документів')}</Button> : null}
      <Text size="sm" c="dimmed">{t(context ? receiptCaptionNote(context) : 'Спочатку сформуйте звіт для цього періоду, товарів і складів. Назви доступні лише за узгодженою версією джерела.')}</Text></> : null}
  </Stack>
}
export function WarehouseReceiptCaptionStatus({ context, fallback }: { context: ReceiptCaptionContext | undefined; fallback: string }) {
  const { t } = useI18n()
  return <Text size="sm" c="dimmed">{t(context ? receiptCaptionNote(context) : fallback)}</Text>
}
