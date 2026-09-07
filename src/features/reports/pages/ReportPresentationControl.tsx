import { Button, Group, Loader, Stack } from '@mantine/core'
import { lazy, Suspense, useState, type ReactNode } from 'react'
import type { SpreadsheetRow, SpreadsheetSheet } from '../types'

const SpreadsheetChartPanel = lazy(() => import('./SpreadsheetChartPanel'))

export function ReportPresentationControl({ sheet, rows, table }: { sheet: SpreadsheetSheet; rows: SpreadsheetRow[]; table: ReactNode }) {
  const [chartOpened, setChartOpened] = useState(false)
  return <Stack gap="sm">
    <Group gap="xs" aria-label="Подання звіту">
      <Button size="xs" variant={chartOpened ? 'default' : 'filled'} aria-pressed={!chartOpened} onClick={() => setChartOpened(false)}>Таблиця</Button>
      <Button size="xs" variant={chartOpened ? 'filled' : 'default'} aria-pressed={chartOpened} onClick={() => setChartOpened(true)}>Діаграма</Button>
    </Group>
    {chartOpened ? <Suspense fallback={<Loader size="sm" aria-label="Завантаження діаграми" />}>
      <SpreadsheetChartPanel sheet={sheet} rows={rows} />
    </Suspense> : table}
  </Stack>
}
