import { Alert, Checkbox, Stack, Text } from '@mantine/core'
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
    <Text size="sm">Відбір застосовується після групування та враховує точну кількість до округлення для показу. Підсумки враховують лише групи з додатним кінцевим залишком. За невідомої кількості звіт не формується. Групування за датою не підтримується; дати періоду можна змінювати.</Text>
    {error ? <Alert color="yellow">{error} Збережені налаштування не змінено.</Alert> : null}
  </Stack>
}
