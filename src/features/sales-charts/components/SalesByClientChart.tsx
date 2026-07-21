import { LineChart } from '@mantine/charts'
import { Alert, Autocomplete, Card, Select, Stack, Text, TextInput } from '@mantine/core'
import { CircleAlert } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getSalesByClient, searchSalesClients } from '../api/salesChartsApi'
import type { SalesChartsClientOption, SalesChartsClientPoint } from '../types'
import { SalesChartsPeriodType } from '../types'

const PERIOD_OPTIONS = [
  { label: 'День', value: String(SalesChartsPeriodType.Day) },
  { label: 'Тиждень', value: String(SalesChartsPeriodType.Week) },
  { label: 'Місяць', value: String(SalesChartsPeriodType.Month) },
  { label: 'Рік', value: String(SalesChartsPeriodType.Year) },
]

export function SalesByClientChart() {
  const { t } = useI18n()
  const today = useMemo(() => formatLocalDate(new Date()), [])
  const [from, setFrom] = useValueState(today)
  const [to, setTo] = useValueState(today)
  const [netId, setNetId] = useValueState<string | null>(null)
  const [typePeriod, setTypePeriod] = useValueState<SalesChartsPeriodType>(SalesChartsPeriodType.Day)
  const [clientQuery, setClientQuery] = useValueState('')
  const [clients, setClients] = useValueState<SalesChartsClientOption[]>([])
  const [points, setPoints] = useValueState<SalesChartsClientPoint[]>([])
  const [isLoading, setIsLoading] = useValueState(false)
  const [error, setError] = useValueState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const query = clientQuery.trim()

    if (query.length < 2) {
      return () => {
        cancelled = true
      }
    }

    async function load() {
      try {
        const result = await searchSalesClients(query)

        if (!cancelled) {
          setClients(result)
        }
      } catch {
        if (!cancelled) {
          setClients([])
        }
      }
    }

    const handle = setTimeout(() => {
      void load()
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [clientQuery, setClients])

  useEffect(() => {
    let cancelled = false

    if (!netId) {
      return () => {
        cancelled = true
      }
    }

    async function load() {
      setIsLoading(true)
      setError(null)

      try {
        const result = await getSalesByClient({ from, netId: netId || '', to, typePeriod })

        if (!cancelled) {
          setPoints(Object.entries(result).map(([name, value]) => ({ amount: value || 0, name })))
        }
      } catch {
        if (!cancelled) {
          setError(t('Не вдалося завантажити дані'))
          setPoints([])
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [from, to, netId, typePeriod, setError, setIsLoading, setPoints, t])

  const clientOptions = useMemo(
    () =>
      clients.reduce<{ netId: string; value: string }[]>((acc, client) => {
        const option = { netId: client.NetUid || '', value: clientLabel(client) }
        if (option.netId && option.value) {
          acc.push(option)
        }
        return acc
      }, []),
    [clients],
  )

  const autocompleteData = useMemo(() => clientOptions.map((option) => option.value), [clientOptions])

  const periodFormatter = useMemo(() => createPeriodFormatter(typePeriod), [typePeriod])

  return (
    <Card className="app-data-card sales-chart-card" withBorder radius="md" padding={0}>
      <div className="app-filter-bar">
        <div className="sales-chart-filter-row is-client">
          <div className="app-filter-date-range">
            <TextInput
              className="sales-chart-filter-control"
              label={t('Від')}
              max={to || undefined}
              type="date"
              value={from}
              onChange={(event) => setFrom(event.currentTarget.value)}
            />
            <TextInput
              className="sales-chart-filter-control"
              label={t('До')}
              min={from || undefined}
              type="date"
              value={to}
              onChange={(event) => setTo(event.currentTarget.value)}
            />
          </div>
          <Autocomplete
            className="sales-chart-filter-control"
            data={autocompleteData}
            label={t('Клієнт')}
            placeholder={t('Пошук клієнта')}
            value={clientQuery}
            onChange={(value) => {
              setClientQuery(value)
              setNetId(null)
            }}
            onOptionSubmit={(value) => {
              const matched = clientOptions.find((option) => option.value === value)
              setNetId(matched ? matched.netId : null)
            }}
          />
          <Select
            allowDeselect={false}
            className="sales-chart-filter-control"
            data={PERIOD_OPTIONS.map((option) => ({ ...option, label: t(option.label) }))}
            label={t('Тип')}
            value={String(typePeriod)}
            onChange={(value) => setTypePeriod(toPeriodType(value))}
          />
        </div>
      </div>

      <Stack className="sales-chart-content" gap="md" p="md">

        {error && (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}

        {points.length === 0 ? (
          <Text c="dimmed" size="sm">
            {isLoading ? t('Завантаження даних') : t('Дані відсутні')}
          </Text>
        ) : (
          <div>
            <Text className="app-section-title" fw={600} mb={8} size="sm">
              {t('Динаміка продажів клієнта')}
            </Text>
          <LineChart
            curveType="linear"
            data={points}
            dataKey="name"
            h={300}
            series={[{ color: 'orange.6', label: t('Сума продажу в євро'), name: 'amount' }]}
            xAxisProps={{ tickFormatter: periodFormatter }}
          />
          </div>
        )}
      </Stack>
    </Card>
  )
}

function clientLabel(client: SalesChartsClientOption): string {
  const fullName = `${client.FirstName || ''} ${client.LastName || ''}`.trim()

  return client.FullName || fullName || client.Name || ''
}

function toPeriodType(value: string | null): SalesChartsPeriodType {
  switch (Number(value)) {
    case SalesChartsPeriodType.Week:
      return SalesChartsPeriodType.Week
    case SalesChartsPeriodType.Month:
      return SalesChartsPeriodType.Month
    case SalesChartsPeriodType.Year:
      return SalesChartsPeriodType.Year
    default:
      return SalesChartsPeriodType.Day
  }
}

function createPeriodFormatter(typePeriod: SalesChartsPeriodType): (value: string) => string {
  return (value: string) => {
    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
      return value
    }

    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = String(date.getFullYear())

    if (typePeriod === SalesChartsPeriodType.Year) {
      return year
    }

    if (typePeriod === SalesChartsPeriodType.Month) {
      return `${month}.${year}`
    }

    return `${day}.${month}`
  }
}
