import { Alert, SimpleGrid, Stack, Text, TextInput } from '@mantine/core'
import { CLIENT_COMPARISON_MAX_DATE, CLIENT_COMPARISON_MIN_DATE } from '../data/clientPeriodComparison'
import { defaultRevenueComparison } from '../data/revenueComparison'

type Props = { value: unknown; disabled: boolean; onChange: (value: unknown) => void }
export default function RevenueComparisonPanel({ value, disabled, onChange }: Props) {
  const draft = value && typeof value === 'object' ? value as Record<string, unknown> : defaultRevenueComparison()
  return <Stack gap="sm" aria-label="Параметри порівняння виручки">
    <Text fw={600}>Виручка за двома періодами</Text>
    <Text size="sm">Дати «Від» і «До» визначають поточний період. Нижче задайте окремий період порівняння. Обидва включають крайні дні за Києвом; можуть перетинатися, збігатися чи мати різну тривалість. Поточний період може бути ранішим.</Text>
    <SimpleGrid cols={{ base: 1, sm: 2 }}>
      <TextInput type="date" label="Виручка: порівняння від" value={typeof draft.From === 'string' ? draft.From : ''} disabled={disabled}
        min={CLIENT_COMPARISON_MIN_DATE} max={CLIENT_COMPARISON_MAX_DATE} onChange={event => onChange({ ...draft, From: event.currentTarget.value })} />
      <TextInput type="date" label="Виручка: порівняння до" value={typeof draft.To === 'string' ? draft.To : ''} disabled={disabled}
        min={typeof draft.From === 'string' && draft.From ? draft.From : CLIENT_COMPARISON_MIN_DATE} max={CLIENT_COMPARISON_MAX_DATE} onChange={event => onChange({ ...draft, To: event.currentTarget.value })} />
    </SimpleGrid>
    <Text size="sm">Клієнт → точний договір. Порівнюються записані суми продажів у EUR; ціни за договором повторно не обчислюються. Зміна суми й відсоток визначаються з початкових сум до остаточного округлення.</Text>
    <Alert color="blue">Коли обидві суми підтверджені, а сума періоду порівняння дорівнює нулю, показник зміни становить 100%, включно з порожнім результатом 0/0. Це правило показника, а не підтвердження зростання. Невідома сума залишається порожньою; інший період зберігається незалежно.</Alert>
  </Stack>
}
