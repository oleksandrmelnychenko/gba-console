import { Alert, Button, Loader, Select, Stack, Text } from '@mantine/core'
import type { ReportDataset } from '../types'

type Props = {
  datasets: ReportDataset[]
  selected: number
  disabled: boolean
  loaded: boolean
  error: string | null
  compact?: boolean
  activeDataSources?: ReadonlySet<number>
  onChange: (dataset: ReportDataset) => void
  onRetry: () => void
}

export function ReportDatasetPicker({ datasets, selected, disabled, loaded, error, compact = false, activeDataSources, onChange, onRetry }: Props) {
  const dataset = datasets.find(item => item.DataSource === selected)
  return <Stack gap={6} p={compact ? 0 : 'sm'} className={compact ? 'report-dataset-picker report-dataset-picker--compact' : 'report-dataset-picker'}>
    <Select label="Набір даних звіту" data={datasets.map(item => ({ value: String(item.DataSource), label: activeDataSources && !activeDataSources.has(item.DataSource) ? `${item.Name} · Готово (запуск вимкнено)` : item.Name, disabled: activeDataSources ? !activeDataSources.has(item.DataSource) : false }))}
      value={dataset && (!activeDataSources || activeDataSources.has(selected)) ? String(selected) : null} disabled={disabled || !loaded || !!error}
      placeholder={!loaded ? 'Завантаження наборів даних…' : 'Виберіть набір даних'} allowDeselect={false}
      searchable={compact} aria-label="Набір даних звіту" aria-busy={!loaded}
      nothingFoundMessage="Наборів даних не знайдено"
      rightSection={!loaded ? <Loader size="xs" aria-label="Завантаження наборів даних" /> : undefined}
      description={compact ? undefined : 'Зміна набору застосує початкові групування й показники та очистить відбори, групи І/АБО, TOP, ABC-класифікацію і правила сортування. Набори поточного стану очищують період; після повернення до набору з періодом попередні дати відновляться.'}
      onChange={value => { const next = datasets.find(item => String(item.DataSource) === value); if (next && (!activeDataSources || activeDataSources.has(next.DataSource)) && next.DataSource !== selected) onChange(next) }} />
    {error ? <Alert color="red" title="Набори даних недоступні">
      <Text size="sm">{error}</Text><Button size="xs" variant="light" mt="xs" onClick={onRetry}>Спробувати ще раз</Button>
    </Alert> : null}
    {!compact && dataset ? <>
      <Text size="sm">{dataset.Description}</Text>
      {dataset.Limitations.length ? <Alert color="yellow" title="Межі розрахунку">
        <Stack gap={4}>{dataset.Limitations.map(text => <Text key={text} size="xs">{text}</Text>)}</Stack>
      </Alert> : null}
    </> : null}
  </Stack>
}

export function ReportDatasetSummary({ dataset }: { dataset?: ReportDataset | null }) {
  if (!dataset) return null
  const requiresImportedSnapshot = [23, 24, 25, 27, 28].includes(dataset.DataSource)
  return <Stack gap={6} className="report-dataset-summary">
    <Text size="sm">{dataset.Description}</Text>
    {requiresImportedSnapshot ? <Alert color="yellow" title="Потрібен окремий знімок даних 1С">
      Звичайна синхронізація GBA не наповнює цей набір. Після повного reset/sync він не сформує дані без окремого імпорту; використовуйте нативний набір із відповідним поточним змістом, якщо він доступний.
    </Alert> : null}
    {dataset.Limitations.length ? <details className="report-dataset-limitations">
      <summary>Межі розрахунку</summary>
      <Stack gap={4}>{dataset.Limitations.map(text => <Text key={text} size="xs">{text}</Text>)}</Stack>
    </details> : null}
  </Stack>
}
