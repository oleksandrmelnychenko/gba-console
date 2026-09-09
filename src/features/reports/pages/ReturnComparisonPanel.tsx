import { Alert, Card, SimpleGrid, Stack, Text, TextInput } from '@mantine/core'
import { CLIENT_COMPARISON_MAX_DATE, CLIENT_COMPARISON_MIN_DATE } from '../data/clientPeriodComparison'
import { defaultReturnComparison } from '../data/returnComparison'

type Props = { dataSource: number; value: unknown; disabled: boolean; onChange: (value: unknown) => void }
export default function ReturnComparisonPanel({ dataSource, value, disabled, onChange }: Props) {
  if (dataSource !== 18) return null
  const draft = value && typeof value === 'object' ? value as Record<string, unknown> : defaultReturnComparison()
  return <Card className="app-section-card reports-return-comparison-settings" withBorder radius="md" padding="md" style={{ minWidth: 0 }}><Stack gap="sm" aria-label="Параметри порівняння повернень">
    <Text fw={600}>Повернення покупців за двома періодами</Text>
    <Text size="sm">Дати «Від» і «До» визначають поточний період. Нижче задайте незалежний період порівняння. Обидва включають крайні дні за Києвом; можуть перетинатися, збігатися чи мати різну тривалість. Поточний період може бути ранішим.</Text>
    <SimpleGrid cols={{ base: 1, sm: 2 }}>
      <TextInput type="date" label="Повернення: порівняння від" value={typeof draft.From === 'string' ? draft.From : ''} disabled={disabled}
        min={CLIENT_COMPARISON_MIN_DATE} max={CLIENT_COMPARISON_MAX_DATE} onChange={event => onChange({ ...draft, From: event.currentTarget.value })} />
      <TextInput type="date" label="Повернення: порівняння до" value={typeof draft.To === 'string' ? draft.To : ''} disabled={disabled}
        min={typeof draft.From === 'string' && draft.From ? draft.From : CLIENT_COMPARISON_MIN_DATE} max={CLIENT_COMPARISON_MAX_DATE} onChange={event => onChange({ ...draft, To: event.currentTarget.value })} />
    </SimpleGrid>
    <Text size="sm">Клієнт → точний договір. Звіт використовує дату документа повернення, а не початкового продажу. Імпортовані дати читаються за місцевим календарем Києва, дати створених у GBA повернень — з урахуванням часу UTC.</Text>
    <Text size="sm">Записана сума повернення входить зі зворотним знаком: додатна сума документа зменшує результат. Знаки й нулі зберігаються. Ціни договору, ПДВ, знижки та валютний перерахунок повторно не застосовуються. Імпортована сума без підтвердження валюти залишається невідомою.</Text>
    <Alert color="blue">Відома нульова сума періоду порівняння дає показник зміни 100%, включно з 0/0. Це правило показника, а не оцінка поліпшення. Невідома сума залишається порожньою; інший період зберігається незалежно. Усі зміни й підсумки обчислює сервер до остаточного округлення.</Alert>
  </Stack></Card>
}
