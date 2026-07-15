import { ActionIcon, Alert, Box, Button, Card, Group, Stack, Text, Tooltip } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { CircleAlert, Pencil, Plus, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import { DataTableDensityToggle } from '../../../shared/ui/data-table/DataTableDensityToggle'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import { useDataTableDensity } from '../../../shared/ui/data-table/useDataTableDensity'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { useAuth } from '../../auth/useAuth'
import {
  getAllCurrencyTraders,
  getCurrencyTraderExchangeRates,
  updateCurrencyTrader,
} from '../api/currencyConvertorsApi'
import { CurrencyTraderExchangeRatesDrawer } from '../components/CurrencyTraderExchangeRatesDrawer'
import { CURRENCY_CONVERTOR_CREATE_PERMISSION, CURRENCY_CONVERTOR_EDIT_PERMISSION } from '../permissions'
import { CURRENCY_ORDER } from '../types'
import type { CurrencyTrader, CurrencyTraderExchangeRate, CurrencyTraderPayload } from '../types'
import './currency-convertors-page.css'

const CONVERTORS_PATH = '/accounting/currency-convertors'

type NewRateDraft = {
  date: string
  rates: Record<string, string>
}

function createNewRateDraft(): NewRateDraft {
  return {
    date: formatLocalDate(new Date()),
    rates: CURRENCY_ORDER.reduce<Record<string, string>>((acc, currency) => {
      acc[currency] = ''

      return acc
    }, {}),
  }
}

function useCurrencyConvertorsPageModel() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const { hasPermission } = useAuth()
  const canCreate = hasPermission(CURRENCY_CONVERTOR_CREATE_PERMISSION)
  const canEdit = hasPermission(CURRENCY_CONVERTOR_EDIT_PERMISSION)
  const initialFrom = useMemo(() => getDateShiftedByDays(-7), [])
  const initialTo = useMemo(() => formatLocalDate(new Date()), [])

  const [traders, setTraders] = useValueState<CurrencyTrader[]>([])
  const [isLoading, setLoading] = useValueState(true)
  const [error, setError] = useValueState<string | null>(null)
  const [selectedTrader, setSelectedTrader] = useValueState<CurrencyTrader | null>(null)
  const [rates, setRates] = useValueState<CurrencyTraderExchangeRate[]>([])
  const [isRatesLoading, setRatesLoading] = useValueState(false)
  const [ratesError, setRatesError] = useValueState<string | null>(null)
  const [from, setFrom] = useValueState(initialFrom)
  const [to, setTo] = useValueState(initialTo)
  const [isSaving, setSaving] = useValueState(false)
  const [isAdding, setAdding] = useValueState(false)
  const [newRateDraft, setNewRateDraft] = useValueState<NewRateDraft>(createNewRateDraft)
  const [editingRate, setEditingRate] = useValueState<CurrencyTraderExchangeRate | null>(null)
  const [editingValue, setEditingValue] = useValueState('')
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const ratesRequestRef = useRef(0)
  const traderIndexMap = useMemo(() => buildTraderIndexMap(traders), [traders])

  useEffect(() => {
    let cancelled = false

    async function loadTraders() {
      setLoading(true)
      setError(null)

      try {
        const nextTraders = await getAllCurrencyTraders()

        if (!cancelled) {
          setTraders(nextTraders)
        }
      } catch (loadError) {
        if (!cancelled) {
          setTraders([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити валютних трейдерів'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadTraders()

    return () => {
      cancelled = true
    }
  }, [reloadKey, setError, setLoading, setTraders, t])

  const loadRates = useCallback(
    async (netId: string, fromValue: string, toValue: string) => {
      const requestId = ratesRequestRef.current + 1
      ratesRequestRef.current = requestId
      setRatesLoading(true)
      setRatesError(null)

      try {
        const nextRates = await getCurrencyTraderExchangeRates({ from: fromValue, netId, to: toValue })

        if (ratesRequestRef.current === requestId) {
          setRates(orderRates(nextRates))
        }
      } catch (loadError) {
        if (ratesRequestRef.current === requestId) {
          setRates([])
          setRatesError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити курси валют'))
        }
      } finally {
        if (ratesRequestRef.current === requestId) {
          setRatesLoading(false)
        }
      }
    },
    [setRates, setRatesError, setRatesLoading, t],
  )

  const showAddButton = useMemo(() => computeShowAddButton(rates), [rates])
  const ratesDrawerViewState = useMemo(
    () => ({
      canEdit,
      isAdding,
      isLoading: isRatesLoading,
      isSaving,
      showAddButton,
    }),
    [canEdit, isAdding, isRatesLoading, isSaving, showAddButton],
  )

  const openTrader = useCallback(
    (trader: CurrencyTrader) => {
      setSelectedTrader(trader)
      setAdding(false)
      setEditingRate(null)
      setNewRateDraft(createNewRateDraft())

      if (trader.NetUid) {
        void loadRates(trader.NetUid, from, to)
      }
    },
    [from, loadRates, setAdding, setEditingRate, setNewRateDraft, setSelectedTrader, to],
  )

  const closeTrader = useCallback(() => {
    ratesRequestRef.current += 1
    setSelectedTrader(null)
    setRates([])
    setRatesError(null)
    setAdding(false)
    setEditingRate(null)
  }, [setAdding, setEditingRate, setRates, setRatesError, setSelectedTrader])

  function changeFrom(value: string) {
    setFrom(value)

    if (selectedTrader?.NetUid) {
      void loadRates(selectedTrader.NetUid, value, to)
    }
  }

  function changeTo(value: string) {
    setTo(value)

    if (selectedTrader?.NetUid) {
      void loadRates(selectedTrader.NetUid, from, value)
    }
  }

  async function persistTrader(payload: CurrencyTraderPayload, successMessage: string) {
    setSaving(true)
    setRatesError(null)

    try {
      const saved = await updateCurrencyTrader(payload)
      const nextTrader = saved || payload
      setSelectedTrader(nextTrader)
      setTraders((current) => current.map((trader) => (trader.NetUid === nextTrader.NetUid ? nextTrader : trader)))
      notifications.show({ color: 'green', message: successMessage })

      if (nextTrader.NetUid) {
        void loadRates(nextTrader.NetUid, from, to)
      }
    } catch (saveError) {
      setRatesError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти курс валют'))
    } finally {
      setSaving(false)
    }
  }

  function startAdd() {
    setNewRateDraft(createNewRateDraft())
    setEditingRate(null)
    setAdding(true)
  }

  function cancelAdd() {
    setAdding(false)
  }

  function changeNewRateDate(value: string) {
    setNewRateDraft((current) => ({ ...current, date: value }))
  }

  function changeNewRateValue(currency: string, value: string) {
    setNewRateDraft((current) => ({ ...current, rates: { ...current.rates, [currency]: value } }))
  }

  async function saveNewRate() {
    if (!selectedTrader) {
      return
    }

    const addedRates = CURRENCY_ORDER.map((currency) => ({
      CurrencyName: currency,
      ExchangeRate: parseAmount(newRateDraft.rates[currency]),
      FromDate: newRateDraft.date,
    }))

    const payload: CurrencyTraderPayload = {
      ...selectedTrader,
      CurrencyTraderExchangeRates: [...rates, ...addedRates],
    }

    setAdding(false)
    await persistTrader(payload, t('Курс валют збережено'))
  }

  function startEdit(rate: CurrencyTraderExchangeRate) {
    setEditingRate(rate)
    setEditingValue(typeof rate.ExchangeRate === 'number' ? String(rate.ExchangeRate) : '')
  }

  function cancelEdit() {
    setEditingRate(null)
  }

  async function saveEdit() {
    if (!selectedTrader || !editingRate) {
      return
    }

    const updatedValue = parseAmount(editingValue)

    if (!(updatedValue > 0)) {
      setRatesError(t('Курс валют має бути більшим за нуль'))
      return
    }

    const nextRates = rates.map((rate) => (rate === editingRate ? { ...rate, ExchangeRate: updatedValue } : rate))

    const payload: CurrencyTraderPayload = {
      ...selectedTrader,
      CurrencyTraderExchangeRates: nextRates,
    }

    setEditingRate(null)
    await persistTrader(payload, t('Курс валют збережено'))
  }

  async function deleteRate(rate: CurrencyTraderExchangeRate) {
    if (!selectedTrader) {
      return
    }

    const nextRates = rates.map((current) => (current === rate ? { ...current, Deleted: true } : current))

    const payload: CurrencyTraderPayload = {
      ...selectedTrader,
      CurrencyTraderExchangeRates: nextRates,
    }

    await persistTrader(payload, t('Курс валют видалено'))
  }

  function goToCreate() {
    navigate(`${CONVERTORS_PATH}/new`, { state: { backgroundLocation: location } })
  }

  function goToEdit(trader: CurrencyTrader) {
    if (trader.NetUid) {
      navigate(`${CONVERTORS_PATH}/edit/${trader.NetUid}`, { state: { backgroundLocation: location } })
    }
  }

  const columns = useCurrencyTraderColumns({ canEdit, indexMap: traderIndexMap, onEdit: goToEdit })
  const { density, toggleDensity } = useDataTableDensity('currency-convertors', 'normal')

  return {
    canCreate,
    canEdit,
    columns,
    density,
    editingRate,
    editingValue,
    error,
    from,
    isAdding,
    isLoading,
    isRatesLoading,
    isSaving,
    newRateDraft,
    rates,
    ratesError,
    ratesDrawerViewState,
    reload,
    selectedTrader,
    showAddButton,
    to,
    traders,
    cancelAdd,
    cancelEdit,
    changeFrom,
    changeNewRateDate,
    changeNewRateValue,
    changeTo,
    closeTrader,
    deleteRate,
    goToCreate,
    openTrader,
    saveEdit,
    saveNewRate,
    setEditingValue,
    startAdd,
    startEdit,
    toggleDensity,
  }
}

export function CurrencyConvertorsPage() {
  const model = useCurrencyConvertorsPageModel()
  const { t } = useI18n()

  return (
    <Stack className="currency-convertors-page" gap={6}>

      <Card className="app-data-card currency-convertors-card" withBorder radius="md" padding={0}>
        <div className="app-filter-bar currency-convertors-filter-bar">
          <Group align="center" gap={10} justify="flex-end" wrap="nowrap" className="currency-convertors-filter-row">
            <div className="app-filter-actions">
              <Tooltip label={t('Оновити')}>
                <ActionIcon
                  aria-label={t('Оновити')}
                  color="gray"
                  loading={model.isLoading}
                  size={34}
                  variant="light"
                  onClick={() => model.reload()}
                >
                  <RefreshCw size={18} />
                </ActionIcon>
              </Tooltip>
              <DataTableDensityToggle density={model.density} onToggle={model.toggleDensity} size={34} />
            </div>
            {model.canCreate && (
              <Button
                color={CREATE_ACTION_COLOR}
                leftSection={<Plus size={16} />}
                size="sm"
                styles={{ label: { fontFamily: 'var(--font-mono)', letterSpacing: 0 } }}
                onClick={model.goToCreate}
              >
                {t('Створення валютного трейдера')}
              </Button>
            )}
          </Group>
        </div>

        {model.error && (
          <Alert className="currency-convertors-alert" color="red" icon={<CircleAlert size={18} />} variant="light">
            {model.error}
          </Alert>
        )}

        <div className="currency-convertors-page__table">
          <DataTable
            columns={model.columns}
            data={model.traders}
            density={model.density}
            emptyText={t('Валютних трейдерів не знайдено')}
            getRowId={(trader, index) => String(trader.NetUid || trader.Id || index)}
            height="100%"
            isLoading={model.isLoading}
            layoutVersion="currency-convertors-table-1"
            loadingText={t('Завантаження валютних трейдерів')}
            minWidth={900}
            tableId="currency-convertors"
            onRowClick={model.openTrader}
          />
        </div>
      </Card>

      <CurrencyTraderExchangeRatesDrawer
        editingRate={model.editingRate}
        editingValue={model.editingValue}
        error={model.ratesError}
        from={model.from}
        newRateDraft={model.newRateDraft}
        rates={model.rates}
        to={model.to}
        trader={model.selectedTrader}
        viewState={model.ratesDrawerViewState}
        onCancelAdd={model.cancelAdd}
        onCancelEdit={model.cancelEdit}
        onChangeEditingValue={model.setEditingValue}
        onChangeFrom={model.changeFrom}
        onChangeNewRateDate={model.changeNewRateDate}
        onChangeNewRateValue={model.changeNewRateValue}
        onChangeTo={model.changeTo}
        onClose={model.closeTrader}
        onDelete={model.deleteRate}
        onSaveEdit={model.saveEdit}
        onSaveNewRate={model.saveNewRate}
        onStartAdd={model.startAdd}
        onStartEdit={model.startEdit}
      />
    </Stack>
  )
}

function useCurrencyTraderColumns({
  canEdit,
  indexMap,
  onEdit,
}: {
  canEdit: boolean
  indexMap: Map<CurrencyTrader, number>
  onEdit: (trader: CurrencyTrader) => void
}) {
  const { t } = useI18n()

  return useMemo<DataTableColumn<CurrencyTrader>[]>(() => {
    const baseColumns: DataTableColumn<CurrencyTrader>[] = [
      {
        id: 'index',
        header: '#',
        width: 56,
        minWidth: 48,
        align: 'right',
        enableSorting: false,
        enableHiding: false,
        accessor: (trader) => indexMap.get(trader) || 0,
        cell: (trader) => (
          <Text c="dimmed" size="sm">
            {indexMap.get(trader) || ''}
          </Text>
        ),
      },
      {
        id: 'firstName',
        header: t("Ім'я"),
        minWidth: 180,
        accessor: (trader) => trader.FirstName,
        cell: (trader) => <Text fw={600}>{displayValue(trader.FirstName)}</Text>,
      },
      {
        id: 'lastName',
        header: t('Прізвище'),
        minWidth: 180,
        accessor: (trader) => trader.LastName,
        cell: (trader) => displayValue(trader.LastName),
      },
      {
        id: 'middleName',
        header: t('По батькові'),
        minWidth: 180,
        accessor: (trader) => trader.MiddleName,
        cell: (trader) => displayValue(trader.MiddleName),
      },
      {
        id: 'phone',
        header: t('Телефон'),
        minWidth: 160,
        accessor: (trader) => trader.PhoneNumber,
        cell: (trader) => <Text fw={600} size="sm" style={{ fontFamily: 'var(--font-mono)', letterSpacing: 0 }}>{displayValue(trader.PhoneNumber)}</Text>,
      },
    ]

    if (!canEdit) {
      return baseColumns
    }

    return [
      ...baseColumns,
      {
        id: 'actions',
        header: '',
        width: 58,
        minWidth: 58,
        maxWidth: 58,
        align: 'center',
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
        cell: (trader) => (
          <Box onClick={(event) => event.stopPropagation()}>
            <Tooltip label={t('Редагування валютного трейдера')}>
              <ActionIcon
                aria-label={t('Редагування валютного трейдера')}
                color="gray"
                variant="subtle"
                onClick={() => onEdit(trader)}
              >
                <Pencil size={18} />
              </ActionIcon>
            </Tooltip>
          </Box>
        ),
      },
    ]
  }, [canEdit, indexMap, onEdit, t])
}

function buildTraderIndexMap(traders: CurrencyTrader[]): Map<CurrencyTrader, number> {
  return traders.reduce((indexMap, trader, index) => {
    indexMap.set(trader, index + 1)

    return indexMap
  }, new Map<CurrencyTrader, number>())
}

function orderRates(rates: CurrencyTraderExchangeRate[]): CurrencyTraderExchangeRate[] {
  const groups = new Map<string, CurrencyTraderExchangeRate[]>()

  rates.forEach((rate) => {
    const key = rate.FromDate || ''
    const group = groups.get(key) || []
    group.push(rate)
    groups.set(key, group)
  })

  const result: CurrencyTraderExchangeRate[] = []

  groups.forEach((group) => {
    CURRENCY_ORDER.forEach((currency) => {
      const match = group.find((rate) => rate.CurrencyName === currency)

      if (match) {
        result.push(match)
      }
    })
  })

  return result
}

function computeShowAddButton(rates: CurrencyTraderExchangeRate[]): boolean {
  if (rates.length === 0) {
    return true
  }

  const todayDayOfMonth = new Date().getDate()

  return !rates.some((rate) => {
    if (!rate.FromDate) {
      return false
    }

    const date = new Date(rate.FromDate)

    return !Number.isNaN(date.getTime()) && date.getDate() === todayDayOfMonth
  })
}

function getDateShiftedByDays(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)

  return formatLocalDate(date)
}

function parseAmount(value: string): number {
  const normalized = (value || '').replace(',', '.')
  const parsed = Number(normalized)

  return Number.isFinite(parsed) ? parsed : 0
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return String(value)
}
