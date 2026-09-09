import { Alert, Card, Select, SimpleGrid, Stack, Text, TextInput } from '@mantine/core'
import { CLIENT_COMPARISON_MAX_DATE, CLIENT_COMPARISON_MIN_DATE } from '../data/clientPeriodComparison'
import { defaultPaymentComparison } from '../data/paymentComparison'

type Props = { dataSource: number; value: unknown; disabled: boolean; onChange: (value: unknown) => void }
const directions = [{ value: '1', label: 'Надходження' }, { value: '2', label: 'Виплати' }]
export default function PaymentComparisonPanel({ dataSource, value, disabled, onChange }: Props) {
  if (dataSource !== 21) return null
  const draft = value && typeof value === 'object' ? value as Record<string, unknown> : defaultPaymentComparison()
  return <Card className="app-section-card reports-payment-comparison-settings" withBorder radius="md" padding="md" style={{ minWidth: 0 }}><Stack gap="sm" aria-label="Параметри порівняння платежів">
    <Text fw={600}>Імпортовані платежі за двома періодами</Text>
    <Select label="Напрям платежів" placeholder="Оберіть напрям" data={directions} disabled={disabled} allowDeselect={false}
      value={draft.Direction === 1 || draft.Direction === 2 ? String(draft.Direction) : null}
      onChange={value => onChange({ ...draft, Direction: value === null ? null : Number(value) })} />
    <Text size="sm">Дати «Від» і «До» визначають поточний період. Нижче задайте незалежний період порівняння. Періоди можуть збігатися, перетинатися чи мати різну тривалість; поточний може бути ранішим.</Text>
    <SimpleGrid cols={{ base: 1, sm: 2 }}>
      <TextInput type="date" label="Платежі: порівняння від" value={typeof draft.From === 'string' ? draft.From : ''} disabled={disabled}
        min={CLIENT_COMPARISON_MIN_DATE} max={CLIENT_COMPARISON_MAX_DATE} onChange={event => onChange({ ...draft, From: event.currentTarget.value })} />
      <TextInput type="date" label="Платежі: порівняння до" value={typeof draft.To === 'string' ? draft.To : ''} disabled={disabled}
        min={typeof draft.From === 'string' && draft.From ? draft.From : CLIENT_COMPARISON_MIN_DATE} max={CLIENT_COMPARISON_MAX_DATE} onChange={event => onChange({ ...draft, To: event.currentTarget.value })} />
    </SimpleGrid>
    <Text size="sm">Валюта → клієнт → точний договір. Порівнюються записані суми імпортованих документів у власній валюті. Знак виплати зберігається. Це стан збережених документів за підтвердженою датою, без перерахунку за поточними курсами чи умовами договору.</Text>
    <Text size="sm">Суми й підсумки обчислює сервер. Різні або непідтверджені валюти не додаються; для діаграми потрібно обрати одну підтверджену валюту.</Text>
    <Alert color="blue">Невідома сума залишається порожньою. За змішаних або непідтверджених валют обох періодів усі показники групи порожні. Відома попередня сума 0 дає відносну зміну 100%, зокрема для двох відомих нулів; це правило показника. Повністю порожній звіт не створює такого відсотка.</Alert>
  </Stack></Card>
}
