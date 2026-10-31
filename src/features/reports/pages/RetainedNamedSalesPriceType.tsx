import { Alert, Stack, Text } from '@mantine/core'
import type { ReportRequestBody, ReportSelection } from '../types'
import { namedSalesPriceTypeSelectionError } from '../data/salesConstructorProfiles'
/** Keep archived selection bytes and the surrounding row's enable/remove actions intact. */
export function RetainedNamedSalesPriceType({ request, selection }: { request?: ReportRequestBody; selection: ReportSelection }) {
  const error = namedSalesPriceTypeSelectionError(request, selection)
  return <Stack gap="xs"><Text fw={500}>{selection.SelectedField.Name || 'Тип ціни (збережено)'}</Text>
    {selection.Values.map(value => <Text key={JSON.stringify(value)} size="sm" style={{ whiteSpace: 'pre-wrap' }}>{value.Name || 'Збережене значення без підпису'}</Text>)}
    {error ? <Alert color="yellow">{error}</Alert> : <Text size="sm" c="dimmed">Збережену умову вимкнено. Її значення залишено без змін.</Text>}
  </Stack>
}
