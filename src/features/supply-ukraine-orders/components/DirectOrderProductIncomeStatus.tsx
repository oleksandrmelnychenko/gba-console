import { Alert, Group, Loader, Stack, Text } from '@mantine/core'
import { CircleAlert, PackageCheck } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useI18n } from '../../../shared/i18n/useI18n'
import { getSupplyOrderProductIncome, type SupplyOrderProductIncomeSource } from '../api/directOrderProductIncomeApi'
import type { DirectOrderProductIncome, User } from '../types'

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
  timeStyle: 'short',
})

type ProductIncomeState = {
  error: string | null
  income: DirectOrderProductIncome | null
  isLoading: boolean
}

export function DirectOrderProductIncomeStatus({
  compact = false,
  orderNetId,
  source = 'direct',
}: {
  compact?: boolean
  orderNetId?: string | null
  source?: SupplyOrderProductIncomeSource
}) {
  const { t } = useI18n()
  const [state, setState] = useState<ProductIncomeState>({
    error: null,
    income: null,
    isLoading: Boolean(orderNetId),
  })

  useEffect(() => {
    if (!orderNetId) {
      return
    }

    let cancelled = false

    void getSupplyOrderProductIncome(orderNetId, source)
      .then((income) => {
        if (!cancelled) {
          setState({ error: null, income, isLoading: false })
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            error: error instanceof Error ? error.message : t('Не вдалося завантажити оприходування'),
            income: null,
            isLoading: false,
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [orderNetId, source, t])

  if (!orderNetId) {
    return null
  }

  if (state.isLoading) {
    return (
      <Alert color="gray" icon={<Loader size={16} />} variant="light">
        <Text size="sm">{t('Перевіряю оприходування')}</Text>
      </Alert>
    )
  }

  if (state.error) {
    return (
      <Alert color="yellow" icon={<CircleAlert size={18} />} variant="light">
        <Text size="sm">{state.error}</Text>
      </Alert>
    )
  }

  if (!state.income) {
    return (
      <Alert color="gray" icon={<PackageCheck size={18} />} variant="light">
        <Text size="sm">{t('Оприходування ще не створено')}</Text>
      </Alert>
    )
  }

  return (
    <Alert color="green" icon={<PackageCheck size={18} />} title={t('Оприходування')} variant="light">
      {compact ? (
        <Text size="sm">
          {formatIncomeLabel(state.income)}
        </Text>
      ) : (
        <Stack gap={6}>
          <Group gap={8} wrap="wrap">
            <StatusValue label={t('Номер')} value={state.income.Number || '-'} />
            <StatusValue label={t('Дата')} value={formatDateTime(state.income.FromDate)} />
            <StatusValue label={t('Склад')} value={state.income.Storage?.Name || '-'} />
            <StatusValue label={t('Відповідальний')} value={getUserName(state.income.User)} />
          </Group>
        </Stack>
      )}
    </Alert>
  )
}

function StatusValue({ label, value }: { label: string; value: string }) {
  return (
    <Text size="sm">
      <Text component="span" c="dimmed" size="sm">{label}: </Text>
      <Text component="span" fw={600} size="sm">{value}</Text>
    </Text>
  )
}

function formatIncomeLabel(income: DirectOrderProductIncome): string {
  return [income.Number, formatDateTime(income.FromDate), income.Storage?.Name].filter(Boolean).join(' · ') || '-'
}

function formatDateTime(value?: Date | string): string {
  if (!value) {
    return '-'
  }

  const date = value instanceof Date ? value : new Date(value)

  return Number.isNaN(date.getTime()) ? '-' : dateTimeFormatter.format(date)
}

function getUserName(user?: User | null): string {
  return user?.FullName || [user?.LastName, user?.FirstName, user?.MiddleName].filter(Boolean).join(' ') || user?.Name || '-'
}
