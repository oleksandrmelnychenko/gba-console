import { Alert, Card, SimpleGrid, Stack, Text, TextInput } from '@mantine/core'
import { CLIENT_COMPARISON_MAX_DATE, CLIENT_COMPARISON_MIN_DATE } from '../data/clientPeriodComparison'
import { defaultMarginComparison } from '../data/marginComparison'

type Props = { dataSource: number; value: unknown; disabled: boolean; onChange: (value: unknown) => void }
export default function MarginComparisonPanel({ dataSource, value, disabled, onChange }: Props) {
  if (dataSource !== 20) return null
  const draft = value && typeof value === 'object' ? value as Record<string, unknown> : defaultMarginComparison()
  return <Card className="app-section-card reports-margin-comparison-settings" withBorder radius="md" padding="md" style={{ minWidth: 0 }}><Stack gap="sm" aria-label="Параметри порівняння маржі">
    <Text fw={600}>Маржа без ПДВ за двома періодами</Text>
    <Text size="sm">Дати «Від» і «До» визначають поточний період. Нижче задайте незалежний період порівняння. Періоди можуть збігатися, перетинатися чи мати різну тривалість; поточний може бути ранішим.</Text>
    <SimpleGrid cols={{ base: 1, sm: 2 }}>
      <TextInput type="date" label="Маржа: порівняння від" value={typeof draft.From === 'string' ? draft.From : ''} disabled={disabled}
        min={CLIENT_COMPARISON_MIN_DATE} max={CLIENT_COMPARISON_MAX_DATE} onChange={event => onChange({ ...draft, From: event.currentTarget.value })} />
      <TextInput type="date" label="Маржа: порівняння до" value={typeof draft.To === 'string' ? draft.To : ''} disabled={disabled}
        min={typeof draft.From === 'string' && draft.From ? draft.From : CLIENT_COMPARISON_MIN_DATE} max={CLIENT_COMPARISON_MAX_DATE} onChange={event => onChange({ ...draft, To: event.currentTarget.value })} />
    </SimpleGrid>
    <Text size="sm">Клієнт → точний договір. Маржа — частка різниці продажів і собівартості у продажах, без ПДВ. Використовуються записані проведені продажі та підтверджена історична собівартість. Повернення до цього звіту не входять.</Text>
    <Text size="sm">Сервер обчислює маржу й підсумки з вихідних сум. Відсотки договорів не додаються й не усереднюються. Ціни за договором і поточна собівартість повторно не застосовуються.</Text>
    <Alert color="blue">Невідомі продажі або собівартість залишають маржу періоду порожньою. Відомі нульові продажі дають маржу 0%, лише коли собівартість також відома. Відносна зміна за відомої попередньої маржі 0% дорівнює 100%, включно з 0/0; це правило показника, а не оцінка поліпшення.</Alert>
  </Stack></Card>
}
