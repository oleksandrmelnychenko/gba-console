import { Alert, Checkbox, Stack } from '@mantine/core'
import type { ReportDataset, ReportRequestBody } from '../types'
import { positiveClosingQuantity, requestStockQuantityFilter, stockQuantityFilterError, stockQuantityFilterSupported,
  type StockQuantityFilter } from '../data/stockQuantityFilter'

export function StockQuantityFilterPanel({ dataset, request, disabled, onChange }: {
  dataset?: ReportDataset; request: ReportRequestBody; disabled: boolean
  onChange: (value: StockQuantityFilter | undefined) => void
}) {
  const raw = requestStockQuantityFilter(request)
  const supported = stockQuantityFilterSupported(dataset) && request.dataSource === 45
  if (!supported && raw == null) return null
  const error = stockQuantityFilterError(request, dataset)
  return <Stack gap="xs" role="group" aria-label="Відбір кінцевого залишку">
    <Checkbox label="Кінцевий залишок: кількість > 0" checked={raw != null} disabled={disabled || !supported && raw == null}
      onChange={event => onChange(event.currentTarget.checked ? { ...positiveClosingQuantity } : undefined)} />
    {error ? <Alert color="yellow">{error} Збережені налаштування не змінено.</Alert> : null}
  </Stack>
}
