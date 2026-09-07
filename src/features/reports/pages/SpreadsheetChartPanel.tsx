import { Alert, Box, Group, SegmentedControl, Select, Stack, Text } from '@mantine/core'
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CHART_GRID_COLOR, CHART_LABEL_COLOR } from '../../../shared/ui/charts/chartTheme'
import { buildSpreadsheetChartData, getChartMeasureOptions, type SpreadsheetChartPoint } from '../data/spreadsheetChartData'
import type { SpreadsheetRow, SpreadsheetSheet } from '../types'
import { getSpreadsheetNumberFormatter } from '../spreadsheet'

type Props = { sheet: SpreadsheetSheet; rows: SpreadsheetRow[] }
type ChartKind = 'column' | 'bar' | 'line'
const formatNumber = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 4 })
const chartKinds = [{ value: 'column', label: 'Стовпчики' }, { value: 'bar', label: 'Смуги' }, { value: 'line', label: 'Лінія' }]

export default function SpreadsheetChartPanel({ sheet, rows }: Props) {
  const options = useMemo(() => getChartMeasureOptions(sheet), [sheet])
  const [selectedMeasure, setSelectedMeasure] = useState<string | null>(null)
  const [kind, setKind] = useState<ChartKind>('column')
  const measure = options.find(option => option.value === selectedMeasure) ?? options[0]
  const chart = useMemo(() => buildSpreadsheetChartData(sheet, rows, Number(measure?.value)), [sheet, rows, measure?.value])

  if (!options.length) return <Alert color="gray">У файлі немає числових показників для діаграми.</Alert>
  return <Stack gap="sm">
    <Group align="end">
      <Select label="Показник діаграми" data={options} value={measure.value} allowDeselect={false}
        onChange={setSelectedMeasure} style={{ flex: 1, minWidth: 220 }} />
      <SegmentedControl aria-label="Тип діаграми" data={chartKinds} value={kind} onChange={value => setKind(value as ChartKind)} />
    </Group>
    <Text size="sm">Кожна точка — окремий рядок таблиці. {sheet.header ? 'Службові підсумки звіту виключено. ' : ''}Значення й відсотки не додаються.</Text>
    <Text size="xs" c="dimmed">Показано {chart.points.length} із {chart.dataRowCount} рядків у порядку таблиці.
      {chart.hiddenCount ? ' Діаграма обмежена першими 50 рядками; звузьте відбори для перегляду інших.' : ''}</Text>
    {chart.unknownCount ? <Alert color="yellow">Для {chart.unknownCount} показаних рядків немає числового значення. Вони залишені порожніми; лінія має розриви.</Alert> : null}
    {!chart.points.length ? <Alert color="gray">За поточними відборами немає рядків даних.</Alert> : <SpreadsheetChartPlot points={chart.points} kind={kind} measure={measure.label} unknownCount={chart.unknownCount}
      formatter={getSpreadsheetNumberFormatter(sheet, Number(measure.value)) ?? formatNumber} />}
  </Stack>
}

function SpreadsheetChartPlot({ points, kind, measure, unknownCount, formatter }: {
  points: SpreadsheetChartPoint[]; kind: ChartKind; measure: string; unknownCount: number; formatter: Intl.NumberFormat
}) {
  const labels = useMemo(() => new Map(points.map(point => [point.rowKey, point.label])), [points])
  const horizontal = kind === 'bar'
  const height = horizontal ? Math.max(320, points.length * 26) : 360
  const categoryTick = (key: string) => {
    const label = labels.get(key) ?? key
    return label.length > 30 ? `${label.slice(0, 29)}…` : label
  }

  return <Box
      role="img" aria-label={`${measure}: ${points.length} рядків, ${unknownCount} без значення`}
      style={{ width: '100%', minWidth: 0, height }}>
      <ResponsiveContainer width="100%" height="100%">
        {kind === 'line' ? <LineChart data={points} margin={{ top: 12, right: 24, bottom: 36, left: 24 }}>
          <CartesianGrid stroke={CHART_GRID_COLOR} />
          <XAxis dataKey="rowKey" tickFormatter={categoryTick} tick={{ fill: CHART_LABEL_COLOR, fontSize: 11 }} />
          <YAxis tickFormatter={value => formatter.format(value)} tick={{ fill: CHART_LABEL_COLOR, fontSize: 11 }} />
          <Tooltip content={<ChartPointTooltip measure={measure} formatter={formatter} />} filterNull={false} />
          <ReferenceLine y={0} stroke={CHART_LABEL_COLOR} />
          <Line type="linear" dataKey="value" name={measure} connectNulls={false} stroke="var(--mantine-color-blue-6)"
            isAnimationActive={false} dot={{ r: 3 }} />
        </LineChart> : <BarChart data={points} layout={horizontal ? 'vertical' : 'horizontal'}
          margin={{ top: 12, right: 24, bottom: 36, left: 24 }}>
          <CartesianGrid stroke={CHART_GRID_COLOR} />
          <XAxis type={horizontal ? 'number' : 'category'} dataKey={horizontal ? undefined : 'rowKey'}
            tickFormatter={horizontal ? value => formatter.format(Number(value)) : categoryTick}
            tick={{ fill: CHART_LABEL_COLOR, fontSize: 11 }} />
          <YAxis type={horizontal ? 'category' : 'number'} dataKey={horizontal ? 'rowKey' : undefined}
            width={horizontal ? 200 : 60} tickFormatter={horizontal ? categoryTick : value => formatter.format(Number(value))}
            tick={{ fill: CHART_LABEL_COLOR, fontSize: 11 }} />
          <Tooltip content={<ChartPointTooltip measure={measure} formatter={formatter} />} filterNull={false} />
          <ReferenceLine {...(horizontal ? { x: 0 } : { y: 0 })} stroke={CHART_LABEL_COLOR} />
          <Bar dataKey="value" name={measure} fill="var(--mantine-color-blue-6)" isAnimationActive={false} />
        </BarChart>}
      </ResponsiveContainer>
    </Box>
}

function ChartPointTooltip({ active, payload, measure, formatter }: {
  active?: boolean; payload?: ReadonlyArray<{ payload?: SpreadsheetChartPoint }>; measure: string; formatter: Intl.NumberFormat
}) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  return <Box p="sm" bg="var(--mantine-color-body)" style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 6 }}>
    <Text size="sm" fw={600}>{point.label}</Text>
    <Text size="sm">{measure}: {point.value === null ? 'немає даних' : formatter.format(point.value)}</Text>
  </Box>
}
