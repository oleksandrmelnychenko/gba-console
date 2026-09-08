import { Alert, Button, Group, Loader, Stack, Text } from '@mantine/core'
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
    {sheet.presentationState === 'all_confirmed_zero_hidden' ? <Alert color="blue" title="Усі підтверджені нульові записи приховано">
      <Text size="sm">У завантаженому звіті були записи; сервер приховав усі підтверджені нулі та їхній показник. Тому тут немає рядків таблиці або точок діаграми. Це стан цього файлу, а не нова перевірка джерела.</Text>
      <Text size="sm">Умови, час читання і примітки звіту збережено вище та в експорті CSV.</Text>
    </Alert> : chartOpened ? <Suspense fallback={<Loader size="sm" aria-label="Завантаження діаграми" />}>
      <SpreadsheetChartPanel sheet={sheet} rows={rows} />
    </Suspense> : table}
  </Stack>
}
