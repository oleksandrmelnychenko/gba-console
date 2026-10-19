import { Alert, Loader, Text } from '@mantine/core'
import { CircleAlert, PackageCheck } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useI18n } from '../../../shared/i18n/useI18n'
import { TableChip } from '../../../shared/ui/TableChip'
import { getSupplyOrderProductIncome, type SupplyOrderProductIncomeSource } from '../api/directOrderProductIncomeApi'
import type { DirectOrderProductIncome, User } from '../types'
import './direct-order-income-status.css'

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
    <div className="direct-order-income-summary">
      <div className="direct-order-income-summary__heading">
        <PackageCheck size={16} aria-hidden="true" />
        <span>{t('Оприходування')}</span>
        <span className="direct-order-income-summary__date">{formatDateTime(state.income.FromDate)}</span>
      </div>
      <div className="direct-order-income-summary__values">
        <TableChip tone="document" value={state.income.Number || '-'} />
        <TableChip tone="storage" value={state.income.Storage?.Name || '-'} />
        {!compact && (
          <span className="direct-order-income-summary__owner">
            {t('Відповідальний')}: <strong>{getUserName(state.income.User)}</strong>
          </span>
        )}
      </div>
    </div>
  )
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
