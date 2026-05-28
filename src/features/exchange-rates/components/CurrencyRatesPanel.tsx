import {
  ActionIcon,
  Box,
  Button,
  Group,
  Text,
  TextInput,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconRestore, IconX } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useReducer, type CSSProperties, type FormEvent } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getExchangeRateHistory, updateExchangeRates } from '../api/exchangeRatesApi'
import type { ExchangeRate, ExchangeRateGroup } from '../types'
import {
  formatRate,
  getDefaultFormDate,
  getRateKey,
  HISTORY_PAGE_SIZE,
  parseDateInputValue,
  startOfToday,
  toDateInputValue,
} from '../utils'
import { CurrencyRatesHistory } from './CurrencyRatesHistory'
import { CurrencyRatesUpdateForm } from './CurrencyRatesUpdateForm'

type CurrencyRatesPanelProps = {
  group: ExchangeRateGroup
  onClose: () => void
  onRefresh: () => Promise<void>
  style?: CSSProperties | null
}

type PanelState = {
  formDate: Date
  formError: string | null
  fromDate: Date
  isFormOpen: boolean
  isSaving: boolean
  rateAmounts: Record<string, string>
  selectedRate: ExchangeRate | null
  toDate: Date
}

type PanelAction =
  | { type: 'rateSelected'; rate: ExchangeRate }
  | { type: 'fromDateChanged'; date: Date }
  | { type: 'toDateChanged'; date: Date }
  | { type: 'filterReset' }
  | { type: 'formOpened'; groupId: string; rates: ExchangeRate[] }
  | { type: 'formClosed' }
  | { type: 'formDateChanged'; date: Date }
  | { type: 'formRateChanged'; key: string; value: string }
  | { type: 'formValidationFailed'; message: string }
  | { type: 'saveStarted' }
  | { type: 'saveSucceeded' }
  | { type: 'saveFailed'; message: string }

type HistoryState = {
  canLoadMore: boolean
  error: Error | null
  isLoading: boolean
  isMoreLoading: boolean
  items: ExchangeRate[]
  nextOffset: number
}

type HistoryAction =
  | { type: 'idle' }
  | { type: 'loadStarted' }
  | { type: 'loadSucceeded'; items: ExchangeRate[] }
  | { type: 'loadFailed'; error: Error }
  | { type: 'loadMoreStarted' }
  | { type: 'loadMoreSucceeded'; items: ExchangeRate[] }
  | { type: 'loadMoreFailed'; error: Error }

const initialHistoryState: HistoryState = {
  canLoadMore: false,
  error: null,
  isLoading: false,
  isMoreLoading: false,
  items: [],
  nextOffset: 0,
}

function createInitialPanelState(group: ExchangeRateGroup): PanelState {
  return {
    formDate: getDefaultFormDate(group.id),
    formError: null,
    fromDate: startOfToday(),
    isFormOpen: false,
    isSaving: false,
    rateAmounts: getInitialRateAmounts(group.rates),
    selectedRate: null,
    toDate: new Date(),
  }
}

function panelReducer(state: PanelState, action: PanelAction): PanelState {
  switch (action.type) {
    case 'rateSelected':
      return {
        ...state,
        selectedRate: action.rate,
      }
    case 'fromDateChanged':
      return {
        ...state,
        fromDate: action.date,
      }
    case 'toDateChanged':
      return {
        ...state,
        toDate: action.date,
      }
    case 'filterReset':
      return {
        ...state,
        fromDate: startOfToday(),
        toDate: new Date(),
      }
    case 'formOpened':
      return {
        ...state,
        formDate: getDefaultFormDate(action.groupId),
        formError: null,
        isFormOpen: true,
        rateAmounts: getInitialRateAmounts(action.rates),
      }
    case 'formClosed':
      return {
        ...state,
        formError: null,
        isFormOpen: false,
      }
    case 'formDateChanged':
      return {
        ...state,
        formDate: action.date,
      }
    case 'formRateChanged':
      return {
        ...state,
        rateAmounts: {
          ...state.rateAmounts,
          [action.key]: action.value,
        },
      }
    case 'formValidationFailed':
      return {
        ...state,
        formError: action.message,
      }
    case 'saveStarted':
      return {
        ...state,
        formError: null,
        isSaving: true,
      }
    case 'saveSucceeded':
      return {
        ...state,
        formError: null,
        isFormOpen: false,
        isSaving: false,
      }
    case 'saveFailed':
      return {
        ...state,
        formError: action.message,
        isSaving: false,
      }
    default:
      return state
  }
}

function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case 'idle':
      return initialHistoryState
    case 'loadStarted':
      return {
        ...state,
        error: null,
        isLoading: true,
        items: [],
      }
    case 'loadSucceeded':
      return {
        ...state,
        canLoadMore: action.items.length === HISTORY_PAGE_SIZE,
        error: null,
        isLoading: false,
        items: action.items,
        nextOffset: action.items.length === HISTORY_PAGE_SIZE ? HISTORY_PAGE_SIZE : 0,
      }
    case 'loadFailed':
      return {
        ...state,
        canLoadMore: false,
        error: action.error,
        isLoading: false,
        items: [],
        nextOffset: 0,
      }
    case 'loadMoreStarted':
      return {
        ...state,
        error: null,
        isMoreLoading: true,
      }
    case 'loadMoreSucceeded':
      return {
        ...state,
        canLoadMore: action.items.length === HISTORY_PAGE_SIZE,
        isMoreLoading: false,
        items: [...state.items, ...action.items],
        nextOffset: action.items.length === HISTORY_PAGE_SIZE ? state.nextOffset + HISTORY_PAGE_SIZE : state.nextOffset,
      }
    case 'loadMoreFailed':
      return {
        ...state,
        error: action.error,
        isMoreLoading: false,
      }
    default:
      return state
  }
}

export function CurrencyRatesPanel({ group, onClose, onRefresh, style }: CurrencyRatesPanelProps) {
  const { t } = useI18n()
  const [panelState, dispatchPanel] = useReducer(panelReducer, group, createInitialPanelState)
  const [historyState, dispatchHistory] = useReducer(historyReducer, initialHistoryState)
  const fromDateTime = panelState.fromDate.getTime()
  const toDateTime = panelState.toDate.getTime()
  const selectedRateNetUid = panelState.selectedRate?.NetUid || null

  useEffect(() => {
    if (!selectedRateNetUid) {
      dispatchHistory({ type: 'idle' })
      return undefined
    }

    let cancelled = false

    dispatchHistory({ type: 'loadStarted' })

    getExchangeRateHistory({
      endpoint: group.historyEndpoint,
      from: panelState.fromDate,
      historyKey: group.historyKey,
      limit: HISTORY_PAGE_SIZE,
      netUid: selectedRateNetUid,
      offset: 0,
      to: panelState.toDate,
    })
      .then((rates) => {
        if (!cancelled) {
          dispatchHistory({ type: 'loadSucceeded', items: rates })
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          dispatchHistory({ type: 'loadFailed', error })
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    fromDateTime,
    group.historyEndpoint,
    group.historyKey,
    panelState.fromDate,
    panelState.toDate,
    selectedRateNetUid,
    toDateTime,
  ])

  const selectedRateTitle = panelState.selectedRate
    ? `${panelState.selectedRate.Code}: ${formatRate(panelState.selectedRate.Amount)}`
    : t('Оберіть валюту')
  const amountEntries = useMemo(() => group.rates.map((rate) => ({ key: getRateKey(rate), rate })), [group.rates])

  const loadMore = useCallback(async () => {
    if (!selectedRateNetUid || historyState.isMoreLoading) {
      return
    }

    dispatchHistory({ type: 'loadMoreStarted' })

    try {
      const rates = await getExchangeRateHistory({
        endpoint: group.historyEndpoint,
        from: panelState.fromDate,
        historyKey: group.historyKey,
        limit: HISTORY_PAGE_SIZE,
        netUid: selectedRateNetUid,
        offset: historyState.nextOffset,
        to: panelState.toDate,
      })

      dispatchHistory({ type: 'loadMoreSucceeded', items: rates })
    } catch (error) {
      dispatchHistory({ type: 'loadMoreFailed', error: error as Error })
    }
  }, [
    group.historyEndpoint,
    group.historyKey,
    historyState.isMoreLoading,
    historyState.nextOffset,
    panelState.fromDate,
    panelState.toDate,
    selectedRateNetUid,
  ])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextRates = amountEntries.map(({ key, rate }) => {
      const amount = Number(panelState.rateAmounts[key])

      return {
        ...rate,
        Amount: amount,
        Created: panelState.formDate,
        Updated: panelState.formDate,
      }
    })

    if (nextRates.some((rate) => !Number.isFinite(rate.Amount) || rate.Amount <= 0)) {
      dispatchPanel({ type: 'formValidationFailed', message: t('Некоректне значення курсу') })
      return
    }

    dispatchPanel({ type: 'saveStarted' })

    try {
      await updateExchangeRates(group.updateMode, nextRates)
      await onRefresh()
      dispatchPanel({ type: 'saveSucceeded' })
      notifications.show({
        color: 'green',
        message: t('Курси оновлено'),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : t('Не вдалося оновити курси')
      dispatchPanel({ type: 'saveFailed', message })
      notifications.show({
        color: 'red',
        message,
      })
    }
  }

  function resetFilter() {
    dispatchPanel({ type: 'filterReset' })
  }

  function toggleForm() {
    if (!panelState.isFormOpen) {
      dispatchPanel({ type: 'formOpened', groupId: group.id, rates: group.rates })
      return
    }

    dispatchPanel({ type: 'formClosed' })
  }

  return (
    <Box className="exchange-rates-panel tx-panel-reveal" style={style || undefined}>
      <Group justify="space-between" align="center" className="exchange-rates-panel-header">
        <Box>
          <Text fw={700} lh={1.1}>
            {group.title}
          </Text>
          <Text size="xs" c="dimmed">
            {selectedRateTitle}
          </Text>
        </Box>
        <ActionIcon variant="subtle" color="gray" aria-label={t('Закрити')} onClick={onClose}>
          <IconX size={18} stroke={1.8} />
        </ActionIcon>
      </Group>

      <Group gap="xs" wrap="nowrap" className="exchange-rates-filter">
        <TextInput
          label={t('З')}
          type="date"
          value={toDateInputValue(panelState.fromDate)}
          onChange={(event) =>
            dispatchPanel({
              type: 'fromDateChanged',
              date: parseDateInputValue(event.currentTarget.value, panelState.fromDate),
            })
          }
        />
        <TextInput
          label={t('По')}
          type="date"
          value={toDateInputValue(panelState.toDate)}
          onChange={(event) =>
            dispatchPanel({
              type: 'toDateChanged',
              date: parseDateInputValue(event.currentTarget.value, panelState.toDate, true),
            })
          }
        />
        <ActionIcon variant="light" color="gray" aria-label={t('Скинути')} onClick={resetFilter}>
          <IconRestore size={18} stroke={1.8} />
        </ActionIcon>
      </Group>

      <Group gap={6} wrap="wrap" className="exchange-rates-panel-list">
        {group.rates.map((rate) => (
          <button
            key={getRateKey(rate)}
            type="button"
            className={`exchange-rates-panel-rate${panelState.selectedRate?.NetUid === rate.NetUid ? ' is-selected' : ''}`}
            onClick={() => dispatchPanel({ type: 'rateSelected', rate })}
          >
            <span className="exchange-rates-panel-rate-code">{rate.Code}</span>
            <span className="exchange-rates-panel-rate-value">{formatRate(rate.Amount)}</span>
          </button>
        ))}
      </Group>

      <CurrencyRatesHistory
        error={historyState.error}
        isLoading={historyState.isLoading}
        items={historyState.items}
        selectedRate={panelState.selectedRate}
      />

      <Group gap="xs" className="exchange-rates-panel-controls">
        {historyState.canLoadMore && (
          <Button variant="light" color="gray" onClick={loadMore} loading={historyState.isMoreLoading}>
            {t('Завантажити ще')}
          </Button>
        )}
        <Button variant={panelState.isFormOpen ? 'outline' : 'light'} color="violet" onClick={toggleForm}>
          {panelState.isFormOpen ? t('Скасувати') : t('Створити')}
        </Button>
      </Group>

      {panelState.isFormOpen && (
        <CurrencyRatesUpdateForm
          amountEntries={amountEntries}
          formDate={panelState.formDate}
          formError={panelState.formError}
          isSaving={panelState.isSaving}
          onFormDateChange={(date) => dispatchPanel({ type: 'formDateChanged', date })}
          onRateAmountChange={(key, value) => dispatchPanel({ type: 'formRateChanged', key, value })}
          onSubmit={handleSubmit}
          rateAmounts={panelState.rateAmounts}
        />
      )}
    </Box>
  )
}

function getInitialRateAmounts(rates: ExchangeRate[]): Record<string, string> {
  return Object.fromEntries(rates.map((rate) => [getRateKey(rate), String(rate.Amount || '')]))
}
