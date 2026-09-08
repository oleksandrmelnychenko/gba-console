import { Alert, SimpleGrid, Stack, Text, TextInput } from '@mantine/core'
import { CLIENT_COMPARISON_MAX_DATE, CLIENT_COMPARISON_MIN_DATE } from '../data/clientPeriodComparison'
import { defaultBuyerSalesShare } from '../data/buyerSalesShare'

type Props = { value: unknown; disabled: boolean; onChange: (value: unknown) => void }
export default function BuyerSalesSharePanel({ value, disabled, onChange }: Props) {
  const draft = value && typeof value === 'object' ? value as Record<string, unknown> : defaultBuyerSalesShare()
  return <Stack gap="sm" aria-label="Параметри часток продажів покупцям">
    <Text fw={600}>Нові й повторні покупці за двома періодами</Text>
    <Text size="sm">Дати «Від» і «До» визначають поточний період. Нижче задайте окремий період порівняння. Обидва включають крайні дні за Києвом; можуть перетинатися, збігатися чи мати різну тривалість. Поточний період може бути ранішим.</Text>
    <SimpleGrid cols={{ base: 1, sm: 2 }}>
      <TextInput type="date" label="Частки продажів: порівняння від" value={typeof draft.From === 'string' ? draft.From : ''} disabled={disabled}
        min={CLIENT_COMPARISON_MIN_DATE} max={CLIENT_COMPARISON_MAX_DATE} onChange={event => onChange({ ...draft, From: event.currentTarget.value })} />
      <TextInput type="date" label="Частки продажів: порівняння до" value={typeof draft.To === 'string' ? draft.To : ''} disabled={disabled}
        min={typeof draft.From === 'string' && draft.From ? draft.From : CLIENT_COMPARISON_MIN_DATE} max={CLIENT_COMPARISON_MAX_DATE} onChange={event => onChange({ ...draft, To: event.currentTarget.value })} />
    </SimpleGrid>
    <Text size="sm">Покупець новий, якщо в історії GBA немає проведених продажів йому до початку відповідного періоду. Враховуються всі його договори й товари; відбори цього звіту не змінюють історію першої покупки.</Text>
    <Text size="sm">Клієнт → точний договір. Частки визначаються за записаними сумами продажів у EUR. Ціни за договором повторно не обчислюються. Зміна частки у в.п. — відсоткові пункти; відносна зміна у % — окремий показник. Підсумки обчислює сервер із початкових сум.</Text>
    <Alert color="blue">За підтвердженої нульової суми періоду обидві частки дорівнюють нулю. Нульова частка періоду порівняння дає відносну зміну 100%, включно з 0/0; це правило показника. Невідома сума залишає частки цього періоду порожніми. Від’ємні суми можуть дати від’ємні частки або частки понад 100%.</Alert>
  </Stack>
}
