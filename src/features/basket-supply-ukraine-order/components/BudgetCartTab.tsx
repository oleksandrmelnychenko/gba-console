import {
  ActionIcon,
  Alert,
  Button,
  Card,
  Group,
  Loader,
  NumberInput,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { ChevronUp, CircleAlert, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useReducer, useState } from 'react'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { TranslateFunction } from '../../../shared/i18n/types'
import { AppBottomSheet } from '../../../shared/ui/AppBottomSheet'
import type { UrgencySliceInput } from '../../../shared/ui/charts/donutData'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { getSupplyOrderSuppliers } from '../../supply-ukraine-orders/api/supplyUkraineOrdersApi'
import type { Client } from '../../supply-ukraine-orders/types'
import { getBudgetCartPlan } from '../api/procurementApi'
import type { CartOptimizeMethod, CartPlan, ReorderSuggestion } from '../procurementTypes'
import { BudgetCartGuide } from './BudgetCartGuide'
import { BudgetCartSummary, type BudgetCartFinancials } from './BudgetCartSummary'
import { BudgetCartTable } from './BudgetCartTable'

type BudgetCartState = {
  plan: CartPlan | null
  error: string | null
  isLoading: boolean
}

type BudgetCartAction =
  | { type: 'failed'; error: string }
  | { type: 'loaded'; plan: CartPlan }
  | { type: 'loading' }

type BudgetCartRequest = {
  asOfDate?: string
  budgetEur: number
  method: CartOptimizeMethod
}

const initialState: BudgetCartState = {
  plan: null,
  error: null,
  isLoading: false,
}

function budgetCartReducer(state: BudgetCartState, action: BudgetCartAction): BudgetCartState {
  switch (action.type) {
    case 'failed':
      return { plan: null, error: action.error, isLoading: false }
    case 'loaded':
      return { plan: action.plan, error: null, isLoading: false }
    case 'loading':
      return { ...state, error: null, isLoading: true }
  }
}

const DEFAULT_BUDGET_EUR = 50000
const OPTIMIZE_DEBOUNCE_MS = 500

export function BudgetCartTab() {
  const { t } = useI18n()
  const [state, dispatch] = useReducer(budgetCartReducer, initialState)
  const [budgetInput, setBudgetInput] = useState<number | ''>(DEFAULT_BUDGET_EUR)
  const [method, setMethod] = useState<CartOptimizeMethod>('greedy')
  const [asOfDate, setAsOfDate] = useState(() => formatLocalDate(new Date()))
  const [request, setRequest] = useState<BudgetCartRequest | null>(null)
  const [hasRequested, setHasRequested] = useState(false)
  const [producers, setProducers] = useState<Client[]>([])
  const [isSheetOpen, setSheetOpen] = useState(false)
  const { plan, error, isLoading } = state

  useEffect(() => {
    let cancelled = false

    async function loadProducers() {
      try {
        const loaded = await getSupplyOrderSuppliers()

        if (!cancelled) {
          setProducers(loaded)
        }
      } catch {
        if (!cancelled) {
          setProducers([])
        }
      }
    }

    void loadProducers()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!hasRequested) {
      return
    }

    const budgetEur = typeof budgetInput === 'number' && Number.isFinite(budgetInput) && budgetInput > 0 ? budgetInput : 0

    if (budgetEur <= 0) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setRequest({ asOfDate: normalizeDateFilter(asOfDate), budgetEur, method })
    }, OPTIMIZE_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [asOfDate, budgetInput, hasRequested, method])

  useEffect(() => {
    if (!request) {
      return
    }

    let cancelled = false
    const controller = new AbortController()

    async function loadPlan(activeRequest: BudgetCartRequest) {
      dispatch({ type: 'loading' })

      try {
        const loaded = await getBudgetCartPlan(
          { asOfDate: activeRequest.asOfDate, budgetEur: activeRequest.budgetEur, method: activeRequest.method },
          controller.signal,
        )

        if (!cancelled) {
          dispatch({ plan: loaded, type: 'loaded' })
          setSheetOpen(loaded.items.length > 0)
        }
      } catch (loadError) {
        if (controller.signal.aborted) {
          return
        }

        if (!cancelled) {
          dispatch({
            error: loadError instanceof Error ? loadError.message : t('Не вдалося сформувати план закупівлі'),
            type: 'failed',
          })
        }
      }
    }

    void loadPlan(request)

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [request, t])

  const producerNameById = useMemo(() => buildProducerNameMap(producers), [producers])

  const sortedItems = useMemo(() => (plan ? sortWithinBudgetFirst(plan.items) : []), [plan])

  const utilization = useMemo(() => {
    if (!plan || plan.budget_eur <= 0) {
      return 0
    }

    return Math.min(100, (plan.budget_used_eur / plan.budget_eur) * 100)
  }, [plan])

  const financials = useMemo(() => calculateBudgetCartFinancials(plan), [plan])

  const splitSlices = useMemo<UrgencySliceInput[]>(() => buildSplitSlices(plan, t), [plan, t])

  function triggerOptimize() {
    const budgetEur = typeof budgetInput === 'number' && Number.isFinite(budgetInput) && budgetInput > 0 ? budgetInput : 0

    if (budgetEur <= 0) {
      return
    }

    setHasRequested(true)
    setRequest({ asOfDate: normalizeDateFilter(asOfDate), budgetEur, method })
  }

  const hasPlan = Boolean(plan) && !isLoading
  const isEmpty = hasPlan && sortedItems.length === 0
  const isBudgetValid = typeof budgetInput === 'number' && Number.isFinite(budgetInput) && budgetInput > 0

  return (
    <Stack className="budget-cart-tab" gap={6}>
      <Card className="app-data-card basket-supply-primary-card" padding={0} radius="md" withBorder>
        <div className="app-filter-bar budget-cart-filter-bar">
          <Group align="flex-end" gap={10} wrap="nowrap" className="budget-cart-filter-row">
            <Tooltip label={t('На яку дату рахувати прогноз і залишки')}>
              <TextInput
                label={t('Дата зрізу')}
                size="sm"
                type="date"
                value={asOfDate}
                w={160}
                onChange={(event) => setAsOfDate(event.currentTarget.value)}
              />
            </Tooltip>
            <Tooltip label={t('Ліміт закупівлі')}>
              <NumberInput
                allowNegative={false}
                decimalScale={0}
                label={`${t('Бюджет')} (EUR)`}
                min={0}
                onChange={(value) => setBudgetInput(typeof value === 'number' ? value : '')}
                size="sm"
                step={1000}
                thousandSeparator=" "
                value={budgetInput}
                w={180}
              />
            </Tooltip>
            <Stack className="app-filter-field" gap={4}>
              <Text className="app-filter-label" fw={600} size="xs">
                {t('Метод')}
              </Text>
              <SegmentedControl
                data={[
                  { label: t('Швидкий'), value: 'greedy' },
                  { label: t('Оптимальний'), value: 'milp' },
                ]}
                size="sm"
                onChange={(value) => setMethod(value as CartOptimizeMethod)}
                value={method}
              />
            </Stack>
            <Stack className="budget-cart-filter-note" gap={2}>
              <Text c="gray.8" fw={600} size="sm">
                {t('AI підбирає товари до закупівлі в межах заданого ліміту в EUR')}
              </Text>
              <Text c="gray.9" size="xs">
                {t('Кандидати відбираються на основі дефіциту, прогнозу попиту, залишків і правил закупівлі')}
              </Text>
            </Stack>
            <div className="app-filter-actions budget-cart-filter-actions">
              {hasRequested && (
                <Tooltip label={t('Оновити')}>
                  <ActionIcon
                    aria-label={t('Оновити')}
                    color="gray"
                    disabled={!isBudgetValid}
                    loading={isLoading}
                    size={34}
                    variant="light"
                    onClick={triggerOptimize}
                  >
                    <RefreshCw size={17} />
                  </ActionIcon>
                </Tooltip>
              )}
            </div>
            <Button
              color={CREATE_ACTION_COLOR}
              disabled={!isBudgetValid}
              loading={isLoading}
              size="sm"
              styles={{ label: { fontFamily: 'var(--font-mono)', letterSpacing: 0 } }}
              onClick={triggerOptimize}
            >
              {t('Сформувати план')}
            </Button>
          </Group>
        </div>
      </Card>

      <BudgetCartGuide method={method} />

      {error && (
        <Alert color="red" icon={<CircleAlert size={16} />} variant="light">
          {error}
        </Alert>
      )}

      {!hasRequested && !error && (
        <Card className="app-section-card" padding="lg" radius="md" withBorder>
          <Text c="dimmed" size="sm" ta="center">
            {t('Введіть бюджет та натисніть «Сформувати план»')}
          </Text>
        </Card>
      )}

      {hasRequested && isLoading && (
        <Card className="app-section-card" padding="lg" radius="md" withBorder>
          <Group justify="center">
            <Loader size="sm" />
            <Text c="dimmed" size="sm">
              {t('Завантаження…')}
            </Text>
          </Group>
        </Card>
      )}

      {hasPlan && plan && (
        <BudgetCartSummary
          financials={financials}
          plan={plan}
          splitSlices={splitSlices}
          utilization={utilization}
        />
      )}

      {hasPlan && !isEmpty && !isSheetOpen && (
        <Card className="app-section-card" padding="sm" radius="md" withBorder>
          <Group justify="space-between" wrap="nowrap">
            <Text c="gray.8" fw={600} size="sm">
              {t('План закупівлі')} · <Text className="app-money" component="span" size="sm">{sortedItems.length}</Text> {t('позицій')}
            </Text>
            <Button
              leftSection={<ChevronUp size={16} />}
              size="xs"
              variant="outline"
              onClick={() => setSheetOpen(true)}
            >
              {t('Показати план')}
            </Button>
          </Group>
        </Card>
      )}

      <AppBottomSheet
        bodyClassName="budget-cart-sheet__body"
        closeLabel={t('Закрити план закупівлі')}
        collapseLabel={t('Згорнути план закупівлі')}
        contentClassName="budget-cart-sheet"
        expandLabel={t('Розгорнути план закупівлі')}
        opened={isSheetOpen && hasPlan && !isEmpty}
        title={
          <span>
            {t('План закупівлі')} · {sortedItems.length} {t('позицій')}
          </span>
        }
        onClose={() => setSheetOpen(false)}
      >
        <BudgetCartTable
          items={sortedItems}
          maxHeight="calc(var(--drawer-size) - 118px - env(safe-area-inset-bottom))"
          producerNameById={producerNameById}
        />
      </AppBottomSheet>

      {isEmpty && (
        <Card className="app-section-card" padding="lg" radius="md" withBorder>
          <Text c="dimmed" size="sm" ta="center">
            {t('Немає позицій')}
          </Text>
        </Card>
      )}
    </Stack>
  )
}

function buildProducerNameMap(producers: Client[]): Map<number, string> {
  const map = new Map<number, string>()

  producers.forEach((producer) => {
    const id = producer.Id

    if (typeof id !== 'number' || !Number.isFinite(id)) {
      return
    }

    const label = producer.FullName || producer.Name || producer.Code || ''

    if (label) {
      map.set(id, label)
    }
  })

  return map
}

function sortWithinBudgetFirst(items: ReorderSuggestion[]): ReorderSuggestion[] {
  return items.toSorted((left, right) => {
    const leftDeferred = left.within_budget === false ? 1 : 0
    const rightDeferred = right.within_budget === false ? 1 : 0

    if (leftDeferred !== rightDeferred) {
      return leftDeferred - rightDeferred
    }

    return (right.value_density ?? 0) - (left.value_density ?? 0)
  })
}

function buildSplitSlices(plan: CartPlan | null, t: TranslateFunction): UrgencySliceInput[] {
  if (!plan) {
    return []
  }

  const slices: UrgencySliceInput[] = []

  if (plan.selected_count > 0) {
    slices.push({ label: t('В бюджеті'), level: 'low', value: plan.selected_count })
  }

  if (plan.deferred_count > 0) {
    slices.push({ label: t('Відкладено'), level: 'critical', value: plan.deferred_count })
  }

  return slices
}

function calculateBudgetCartFinancials(plan: CartPlan | null): BudgetCartFinancials {
  const selected = plan?.items.filter((item) => item.within_budget === true) ?? []
  const producerIds = new Set<number>()
  let selectedUnits = 0
  let expectedRevenueEur = 0
  let expectedMarginEur = 0
  let hasRevenue = false
  let hasMargin = false

  selected.forEach((item) => {
    selectedUnits += item.suggested_qty
    producerIds.add(item.producer_id)

    if (item.unit_sale_eur !== null) {
      expectedRevenueEur += item.suggested_qty * item.unit_sale_eur
      hasRevenue = true
    }

    if (item.unit_margin_eur !== null) {
      expectedMarginEur += item.suggested_qty * item.unit_margin_eur
      hasMargin = true
    }
  })

  return {
    expectedMarginEur: hasMargin ? expectedMarginEur : null,
    expectedRevenueEur: hasRevenue ? expectedRevenueEur : null,
    selectedProducerCount: producerIds.size,
    selectedUnits,
  }
}

function normalizeDateFilter(value: string): string | undefined {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined
}
