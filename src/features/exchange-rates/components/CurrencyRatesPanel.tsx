import { ToolbarDateRangeFilter } from '../../../shared/ui/ToolbarDateRangeFilter'
import {
  ActionIcon,
  Box,
  Button,
  Group,
  FocusTrap,
  Text,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { ChevronDown, PencilLine, RotateCcw, Save, X } from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useReducer, useRef, type CSSProperties, type FormEvent, type MouseEvent } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getExchangeRateHistory, updateExchangeRates } from '../api/exchangeRatesApi'
import type { ExchangeRate, ExchangeRateGroup } from '../types'
import {
  formatHistoryDate,
  formatRate,
  getDefaultHistoryFromDate,
  getDefaultFormDate,
  getRateKey,
  HISTORY_PAGE_SIZE,
  parseDateInputValue,
  toDateInputValue,
} from '../utils'
import { CurrencyRatesHistory } from './CurrencyRatesHistory'
import { CurrencyRatesUpdateForm } from './CurrencyRatesUpdateForm'
import { AppModalFooter } from '../../../shared/ui/AppModal'
import { DocumentDetailLayout } from '../../../shared/ui/document-detail/DocumentDetail'
import { TableChip } from '../../../shared/ui/TableChip'
import '../../../shared/ui/selection-surface.css'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'

type CurrencyRatesPanelProps = {
  group: ExchangeRateGroup
  onClose: () => void
  opened?: boolean
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
  | { type: 'dateRangeChanged'; from: Date; to: Date }
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
    fromDate: getDefaultHistoryFromDate(),
    isFormOpen: false,
    isSaving: false,
    rateAmounts: getInitialRateAmounts(group.rates),
    selectedRate: group.rates[0] || null,
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
    case 'dateRangeChanged':
      return { ...state, fromDate: action.from, toDate: action.to }
    case 'filterReset':
      return {
        ...state,
        fromDate: getDefaultHistoryFromDate(),
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

export function CurrencyRatesPanel({ group, onClose, onRefresh, style, opened = true }: CurrencyRatesPanelProps) {
  const { t } = useI18n()
  const formId = useId()
  const editButtonRef = useRef<HTMLButtonElement>(null)
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

  const isReadOnly = group.id === 'government-cross'
  const selectedRateUpdatedAt = formatHistoryDate(panelState.selectedRate?.Updated)
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

  function toggleForm(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    if (!panelState.isFormOpen) {
      dispatchPanel({ type: 'formOpened', groupId: group.id, rates: group.rates })
      return
    }

    dispatchPanel({ type: 'formClosed' })
    requestAnimationFrame(() => editButtonRef.current?.focus())
  }

  return (
    <FocusTrap active={opened}>
      <Box
        className="exchange-rates-panel app-modal app-form-sheet"
        role="dialog"
        aria-label={t('Курси валют')}
        style={style || undefined}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !panelState.isSaving) {
            event.stopPropagation()
            onClose()
          }
        }}
      >
        <Group justify="space-between" wrap="nowrap" className="exchange-rates-panel-header">
          <Group gap={10} wrap="nowrap">
            <Text className="exchange-rates-panel-title">{t('Курси валют')}</Text>
            {/^(?:НБУ )?(UAH|PLN)$/.test(group.title) ? <>
              {group.title.startsWith('НБУ ') && <Text size="xs">{t('НБУ')}</Text>}
              <TableChip value={group.title.replace('НБУ ', '')} tone="source" />
            </> : <TableChip value={group.title} tone="neutral" />}
          </Group>
          <ActionIcon className="mantine-Modal-close" size={32} variant="subtle" color="gray" aria-label={t('Закрити')} disabled={panelState.isSaving} onClick={onClose}>
            <X size={18} />
          </ActionIcon>
        </Group>

        <div className="exchange-rates-panel-body">
          <DocumentDetailLayout summary={(
            <div className="exchange-rates-current">
              <div>
                <Text size="xs" c="dimmed">{t('Поточний курс')}</Text>
                <Group gap={8} align="baseline" wrap="wrap">
                  <strong className="exchange-rates-current-value app-money">{panelState.selectedRate ? formatRate(panelState.selectedRate.Amount) : '—'}</strong>
                  <TableChip value={panelState.selectedRate?.Code.replace(/\s+TO\s+/gi, ' / ')} tone="source" />
                </Group>
              </div>
              {selectedRateUpdatedAt && (
                <div className="exchange-rates-current-updated">
                  <Text size="xs" c="dimmed">{t('Оновлено')}</Text>
                  <span>{selectedRateUpdatedAt}</span>
                </div>
              )}
            </div>
          )}>
            {!panelState.isFormOpen && (
              <>
                {group.rates.length > 1 && (
                  <div className="exchange-rates-panel-list" role="group" aria-label={t('Валюта')}>
                    {group.rates.map((rate) => (
                      <Button
                        key={getRateKey(rate)}
                        type="button"
                        variant="default"
                        className="app-selection-surface exchange-rates-panel-rate"
                        data-selected={panelState.selectedRate ? getRateKey(panelState.selectedRate) === getRateKey(rate) : false}
                        aria-pressed={panelState.selectedRate ? getRateKey(panelState.selectedRate) === getRateKey(rate) : false}
                        onClick={() => dispatchPanel({ type: 'rateSelected', rate })}
                      >
                        <span className="app-selection-surface__marker" aria-hidden="true" />
                        <span className="exchange-rates-panel-rate-code">{rate.Code.replace(/\s+TO\s+/gi, ' / ')}</span>
                        <span className="exchange-rates-panel-rate-value">{formatRate(rate.Amount)}</span>
                      </Button>
                    ))}
                  </div>
                )}
                <div className="console-table-shell exchange-rates-history-card">
                  <div className="exchange-rates-history-heading">
                    <span className="app-section-title">{t('Історія')}</span>
                  </div>
                  <div className="app-filter-bar">
                    <div className="app-filter-fields">
                      <ToolbarDateRangeFilter from={toDateInputValue(panelState.fromDate)} to={toDateInputValue(panelState.toDate)}
                        onChange={range => dispatchPanel({ type: 'dateRangeChanged',
                          from: parseDateInputValue(range.from, panelState.fromDate),
                          to: parseDateInputValue(range.to, panelState.toDate, true),
                        })} />
                      <Tooltip label={t('Скинути')}>
                        <Button aria-label={t('Скинути')} onClick={resetFilter} className="exchange-toolbar-action" variant="default" leftSection={<RotateCcw size={16} />} title={t('Скинути')}>{t('Скинути')}</Button>
                      </Tooltip>
                    </div>
                  </div>
                  <CurrencyRatesHistory error={historyState.error} isLoading={historyState.isLoading} items={historyState.items} selectedRate={panelState.selectedRate} />
                </div>
              </>
            )}
            {!isReadOnly && panelState.isFormOpen && (
              <CurrencyRatesUpdateForm
                id={formId}
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
          </DocumentDetailLayout>
        </div>
        <AppModalFooter className="exchange-rates-panel-controls">
          {panelState.isFormOpen ? (
            <>
              <Button key="cancel" type="button" variant="default" color="gray" disabled={panelState.isSaving} onClick={toggleForm}>{t('Скасувати')}</Button>
              <Button key="save" type="submit" form={formId} color={CREATE_ACTION_COLOR} leftSection={<Save size={16} />} loading={panelState.isSaving}>{t('Зберегти')}</Button>
            </>
          ) : (
            <>
            {historyState.canLoadMore && !historyState.isLoading && (
              <Button key="more" type="button" size="sm" variant="default" color="gray" leftSection={<ChevronDown size={16} />} onClick={loadMore} loading={historyState.isMoreLoading}>
                {t('Завантажити ще')}
              </Button>
            )}
            {!isReadOnly && (
              <Button key="edit" type="button" ref={editButtonRef} size="sm" color={CREATE_ACTION_COLOR} leftSection={<PencilLine size={16} />} onClick={toggleForm}>
                {t('Оновити курси')}
              </Button>
            )}
            </>
          )}
        </AppModalFooter>
      </Box>
    </FocusTrap>
  )
}

function getInitialRateAmounts(rates: ExchangeRate[]): Record<string, string> {
  return Object.fromEntries(rates.map((rate) => [getRateKey(rate), String(rate.Amount || '')]))
}
