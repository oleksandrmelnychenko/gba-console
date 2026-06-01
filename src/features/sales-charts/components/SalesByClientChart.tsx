import { LineChart } from '@mantine/charts'
import { Alert, Autocomplete, Card, Group, Select, Stack, Text, TextInput } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
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
    () => clients.map((client) => ({ netId: client.NetUid || '', value: clientLabel(client) })).filter((option) => option.netId && option.value),
    [clients],
  )

  const autocompleteData = useMemo(() => clientOptions.map((option) => option.value), [clientOptions])

  const periodFormatter = useMemo(() => createPeriodFormatter(typePeriod), [typePeriod])

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="md">
        <Group align="end" gap="sm" wrap="wrap">
          <Autocomplete
            data={autocompleteData}
            label={t('Клієнт')}
            placeholder={t('Пошук клієнта')}
            value={clientQuery}
            w={280}
            onChange={(value) => {
              setClientQuery(value)
              setNetId(null)
            }}
            onOptionSubmit={(value) => {
              const matched = clientOptions.find((option) => option.value === value)
              setNetId(matched ? matched.netId : null)
            }}
          />
          <TextInput
            label={t('З')}
            max={to || undefined}
            type="date"
            value={from}
            w={150}
            onChange={(event) => setFrom(event.currentTarget.value)}
          />
          <TextInput
            label={t('По')}
            min={from || undefined}
            type="date"
            value={to}
            w={150}
            onChange={(event) => setTo(event.currentTarget.value)}
          />
          <Select
            allowDeselect={false}
            data={PERIOD_OPTIONS.map((option) => ({ ...option, label: t(option.label) }))}
            label={t('Тип')}
            value={String(typePeriod)}
            w={150}
            onChange={(value) => setTypePeriod(toPeriodType(value))}
          />
        </Group>

        {error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}

        {points.length === 0 ? (
          <Text c="dimmed" size="sm">
            {isLoading ? t('Завантаження даних') : t('Дані відсутні')}
          </Text>
        ) : (
          <LineChart
            curveType="linear"
            data={points}
            dataKey="name"
            h={300}
            series={[{ color: 'violet.6', label: t('Сума продажів в євро'), name: 'amount' }]}
            xAxisProps={{ tickFormatter: periodFormatter }}
          />
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
