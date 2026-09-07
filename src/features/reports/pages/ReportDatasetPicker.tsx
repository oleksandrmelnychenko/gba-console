import { Alert, Button, Select, Stack, Text } from '@mantine/core'
import type { ReportDataset } from '../types'

type Props = {
  datasets: ReportDataset[]
  selected: number
  disabled: boolean
  loaded: boolean
  error: string | null
  onChange: (dataset: ReportDataset) => void
  onRetry: () => void
}

export function ReportDatasetPicker({ datasets, selected, disabled, loaded, error, onChange, onRetry }: Props) {
  const dataset = datasets.find(item => item.DataSource === selected)
  return <Stack gap={6} p="sm">
    <Select label="Набір даних звіту" data={datasets.map(item => ({ value: String(item.DataSource), label: item.Name }))}
      value={dataset ? String(selected) : null} disabled={disabled || !loaded || !!error}
      placeholder={!loaded ? 'Завантаження наборів даних…' : 'Виберіть набір даних'} allowDeselect={false}
      description="Зміна набору застосує початкові групування й показники та очистить відбори. Період збережеться."
      onChange={value => { const next = datasets.find(item => String(item.DataSource) === value); if (next && next.DataSource !== selected) onChange(next) }} />
    {error ? <Alert color="red" title="Набори даних недоступні">
      <Text size="sm">{error}</Text><Button size="xs" variant="light" mt="xs" onClick={onRetry}>Спробувати ще раз</Button>
    </Alert> : null}
    {dataset ? <>
      <Text size="sm">{dataset.Description}</Text>
      {dataset.Limitations.length ? <Alert color="yellow" title="Межі розрахунку">
        <Stack gap={4}>{dataset.Limitations.map(text => <Text key={text} size="xs">{text}</Text>)}</Stack>
      </Alert> : null}
    </> : null}
  </Stack>
}
