import { Checkbox, MultiSelect, Stack, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { receiptCaptionNote, warehouseReceiptKey, type ReceiptCaptionContext, type WarehouseReceiptKey } from '../data/warehouseReceiptCaptions'

export function WarehouseReceiptCaptionControls({ supported, enabled, context, selected, busy, toggle, select }: {
  supported: boolean; enabled: boolean; context: ReceiptCaptionContext | undefined; selected: WarehouseReceiptKey[];
  busy: boolean; toggle: (value: boolean) => void; select: (values: string[]) => void
}) {
  const { t } = useI18n()
  if (!supported) return null
  const complete = context?.NormalSourceGenerationBound === true && context.CompleteReceiptChoices
  const choices = complete ? context.Choices.map(choice => ({ value: warehouseReceiptKey(choice.Receipt), label: choice.Caption })) : []
  const keys = new Set(choices.map(choice => choice.value))
  return <Stack gap="xs"><Checkbox label={t('Поточні підписи документів GBA')} checked={enabled} disabled={busy} onChange={event => toggle(event.currentTarget.checked)} />
    {enabled ? <><MultiSelect label={t('Документи надходження')} placeholder={t('Повний список для відбору з’явиться після перевіреного формування')}
      data={choices}
      value={selected.map(warehouseReceiptKey).filter(key => keys.has(key))} disabled={busy || !complete || !context?.Choices.length} searchable clearable maxValues={256} onChange={select} />
      <Text size="sm" c="dimmed">{t(context ? receiptCaptionNote(context) : 'Спочатку сформуйте звіт для цього періоду, товарів і складів. Назви доступні лише за узгодженою версією джерела.')}</Text></> : null}
  </Stack>
}
export function WarehouseReceiptCaptionStatus({ context, fallback }: { context: ReceiptCaptionContext | undefined; fallback: string }) {
  const { t } = useI18n()
  return <Text size="sm" c="dimmed">{t(context ? receiptCaptionNote(context) : fallback)}</Text>
}
