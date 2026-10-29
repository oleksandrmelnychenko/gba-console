import { Alert, Checkbox, Stack, Text } from '@mantine/core'
import { DOCUMENT_DETAIL_GROUPING, DOCUMENT_DETAIL_LABEL, documentDetailsError, documentDetailsSupported, hasDocumentDetails } from '../data/reportDocumentDetails'
import type { ReportGroupingLayout } from '../data/reportGroupingLayout'
import type { ReportDataset, ReportRequestBody } from '../types'

export function ReportDocumentDetailsPanel({ dataset, request, onChange }: {
  dataset?: ReportDataset; request: ReportRequestBody; onChange: (layout: ReportGroupingLayout) => void
}) {
  const selected = hasDocumentDetails(request), supported = documentDetailsSupported(dataset, request)
  if (!selected && !supported) return null
  const enabledLayout = { Row: [...request.sorted.Row, { type: DOCUMENT_DETAIL_GROUPING, key: 'GbaDocumentDetail', label: DOCUMENT_DETAIL_LABEL }], Col: request.sorted.Col }
  const error = documentDetailsError(selected ? request : { ...request, sorted: { ...request.sorted, ...enabledLayout } }, dataset)
  return <Stack gap="xs">
    <Checkbox label="Детальні записи" checked={selected} disabled={!selected && !!error}
      onChange={event => onChange(event.currentTarget.checked ? enabledLayout : {
        Row: request.sorted.Row.filter(row => row.type !== DOCUMENT_DETAIL_GROUPING), Col: request.sorted.Col.filter(row => row.type !== DOCUMENT_DETAIL_GROUPING),
      })} />
    <Text size="sm">Окремі рядки документів GBA. Імпортовані дані без доказу рядка залишаються окремо за документом і товаром: «Без підтвердженої деталізації».</Text>
    {error ? <Alert color="yellow">{error} Налаштування не змінено.</Alert> : null}
  </Stack>
}
