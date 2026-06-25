import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Loader,
  NumberInput,
  Progress,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core'
import { IconAlertCircle, IconRefresh } from '@tabler/icons-react'
import { Fragment, useEffect, useMemo, useReducer, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { TranslateFunction } from '../../../shared/i18n/types'
import { UrgencyDonut, type UrgencySliceInput } from '../../../shared/ui/charts'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { getSupplyOrderSuppliers } from '../../supply-ukraine-orders/api/supplyUkraineOrdersApi'
import type { Client } from '../../supply-ukraine-orders/types'
import { getBudgetCartPlan } from '../api/procurementApi'
import type { CartOptimizeMethod, CartPlan, ProcurementUrgency, ReorderSuggestion } from '../procurementTypes'

type BudgetCartState = {
  plan: CartPlan | null
  error: string | null
  isLoading: boolean
}

type BudgetCartAction =
  | { type: 'failed'; error: string }
  | { type: 'loaded'; plan: CartPlan }
  | { type: 'loading' }

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

const URGENCY_LABEL: Record<ProcurementUrgency, string> = {
  critical: 'Критична',
  high: 'Висока',
  normal: 'Звичайна',
  none: 'Достатньо',
}

const URGENCY_BADGE_COLOR: Record<ProcurementUrgency, string> = {
  critical: 'red',
  high: 'orange',
  normal: 'yellow',
  none: 'gray',
}

const qtyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
})

const countFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 0,
})

const eurFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

const densityFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 3,
})

const percentFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 1,
})

export function BudgetCartTab() {
  const { t } = useI18n()
  const [state, dispatch] = useReducer(budgetCartReducer, initialState)
  const [budgetInput, setBudgetInput] = useState<number | ''>(DEFAULT_BUDGET_EUR)
  const [method, setMethod] = useState<CartOptimizeMethod>('greedy')
  const [request, setRequest] = useState<{ budgetEur: number; method: CartOptimizeMethod } | null>(null)
  const [hasRequested, setHasRequested] = useState(false)
  const [producers, setProducers] = useState<Client[]>([])
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
      setRequest({ budgetEur, method })
    }, OPTIMIZE_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [budgetInput, hasRequested, method])

  useEffect(() => {
    if (!request) {
      return
    }

    let cancelled = false
    const controller = new AbortController()

    async function loadPlan(activeRequest: { budgetEur: number; method: CartOptimizeMethod }) {
      dispatch({ type: 'loading' })

      try {
        const loaded = await getBudgetCartPlan(
          { budgetEur: activeRequest.budgetEur, method: activeRequest.method },
          controller.signal,
        )

        if (!cancelled) {
          dispatch({ plan: loaded, type: 'loaded' })
        }
      } catch (loadError) {
        if (controller.signal.aborted) {
          return
        }

        if (!cancelled) {
          dispatch({
            error: loadError instanceof Error ? loadError.message : t('Не вдалося оптимізувати кошик'),
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

  const firstDeferredIndex = useMemo(() => sortedItems.findIndex((item) => item.within_budget === false), [sortedItems])

  const utilization = useMemo(() => {
    if (!plan || plan.budget_eur <= 0) {
      return 0
    }

    return Math.min(100, (plan.budget_used_eur / plan.budget_eur) * 100)
  }, [plan])

  const splitSlices = useMemo<UrgencySliceInput[]>(() => buildSplitSlices(plan, t), [plan, t])

  function triggerOptimize() {
    const budgetEur = typeof budgetInput === 'number' && Number.isFinite(budgetInput) && budgetInput > 0 ? budgetInput : 0

    if (budgetEur <= 0) {
      return
    }

    setHasRequested(true)
    setRequest({ budgetEur, method })
  }

  const hasPlan = Boolean(plan) && !isLoading
  const isEmpty = hasPlan && sortedItems.length === 0
  const isBudgetValid = typeof budgetInput === 'number' && Number.isFinite(budgetInput) && budgetInput > 0

  return (
    <Stack gap="lg">
      <Group align="flex-end" gap="md" wrap="wrap">
        <NumberInput
          allowNegative={false}
          decimalScale={0}
          description={t('Ліміт закупівлі')}
          label={`${t('Бюджет')} (EUR)`}
          min={0}
          onChange={(value) => setBudgetInput(typeof value === 'number' ? value : '')}
          step={1000}
          thousandSeparator=" "
          value={budgetInput}
          w={220}
        />
        <Stack gap={4}>
          <Text fw={500} size="sm">
            {t('Метод')}
          </Text>
          <SegmentedControl
            data={[
              { label: t('Жадібний'), value: 'greedy' },
              { label: t('MILP оптимум'), value: 'milp' },
            ]}
            onChange={(value) => setMethod(value as CartOptimizeMethod)}
            value={method}
          />
        </Stack>
        <Button color={CREATE_ACTION_COLOR} disabled={!isBudgetValid} loading={isLoading} onClick={triggerOptimize}>
          {t('Оптимізувати')}
        </Button>
        {hasRequested && (
          <Tooltip label={t('Оновити')}>
            <ActionIcon
              aria-label={t('Оновити')}
              disabled={!isBudgetValid}
              loading={isLoading}
              size="lg"
              variant="subtle"
              onClick={triggerOptimize}
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={16} />} variant="light">
          {error}
        </Alert>
      )}

      {!hasRequested && !error && (
        <Card className="app-section-card" padding="lg" radius="md" withBorder>
          <Text c="dimmed" size="sm" ta="center">
            {t('Введіть бюджет та натисніть «Оптимізувати»')}
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
        <Card className="app-section-card" padding="md" radius="md" withBorder>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
            <Stack gap="md">
              <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
                <SummaryItem label={`${t('Бюджет')} (EUR)`} value={`€${eurFormatter.format(plan.budget_eur)}`} />
                <SummaryItem
                  label={`${t('Використано')} (EUR)`}
                  value={`€${eurFormatter.format(plan.budget_used_eur)}`}
                />
                <SummaryItem
                  color="teal"
                  label={`${t('Захоплена цінність')} (EUR)`}
                  value={`€${eurFormatter.format(plan.value_captured_eur)}`}
                />
                <SummaryItem
                  color="green"
                  label={t('В бюджеті')}
                  value={countFormatter.format(plan.selected_count)}
                />
                <SummaryItem
                  color="gray"
                  label={t('Відкладено')}
                  value={countFormatter.format(plan.deferred_count)}
                />
                <SummaryItem label={t('Позицій')} value={countFormatter.format(plan.item_count)} />
              </SimpleGrid>
              <Stack gap={4}>
                <Group justify="space-between">
                  <Text c="dimmed" size="xs">
                    {t('Використання бюджету')}
                  </Text>
                  <Text fw={600} size="xs">
                    {percentFormatter.format(utilization)}%
                  </Text>
                </Group>
                <Progress color={utilization >= 99 ? 'orange' : 'teal'} radius="xl" size="lg" value={utilization} />
              </Stack>
            </Stack>

            <Stack align="center" gap="xs">
              <Text fw={600} size="sm">
                {t('Розподіл позицій')}
              </Text>
              <UrgencyDonut
                chartLabel={countFormatter.format(plan.item_count)}
                data={splitSlices}
                emptyLabel={t('Немає позицій')}
                valueFormatter={(value) => countFormatter.format(value)}
              />
            </Stack>
          </SimpleGrid>
        </Card>
      )}

      {hasPlan && !isEmpty && (
        <Card className="app-section-card" padding="md" radius="md" withBorder>
          <BudgetCartTable
            firstDeferredIndex={firstDeferredIndex}
            items={sortedItems}
            producerNameById={producerNameById}
            t={t}
          />
        </Card>
      )}

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

function BudgetCartTable({
  firstDeferredIndex,
  items,
  producerNameById,
  t,
}: {
  firstDeferredIndex: number
  items: ReorderSuggestion[]
  producerNameById: Map<number, string>
  t: TranslateFunction
}) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="budget-cart-table">
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>{t('Виробник')}</th>
            <th style={{ textAlign: 'left' }}>{t('Товар')}</th>
            <th style={{ textAlign: 'left' }}>{t('Терміновість')}</th>
            <th style={{ textAlign: 'left' }}>{t('Квадрант')}</th>
            <th style={{ textAlign: 'right' }}>{t('Рекомендовано')}</th>
            <th style={{ textAlign: 'right' }}>{`${t('Ціна')} (EUR)`}</th>
            <th style={{ textAlign: 'right' }}>{`${t('Маржа')} (EUR)`}</th>
            <th style={{ textAlign: 'right' }}>{`${t('Сума')} (EUR)`}</th>
            <th style={{ textAlign: 'right' }}>{t('Цінність')}</th>
            <th style={{ textAlign: 'center' }}>{t('Бюджет')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <Fragment key={`${item.producer_id}-${item.product_id}`}>
              {index === firstDeferredIndex && firstDeferredIndex > 0 && (
                <tr className="budget-cart-divider-row">
                  <td colSpan={10}>
                    <Divider
                      label={t('Поза бюджетом')}
                      labelPosition="center"
                      my="xs"
                    />
                  </td>
                </tr>
              )}
              <BudgetCartRow item={item} producerNameById={producerNameById} t={t} />
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BudgetCartRow({
  item,
  producerNameById,
  t,
}: {
  item: ReorderSuggestion
  producerNameById: Map<number, string>
  t: TranslateFunction
}) {
  const deferred = item.within_budget === false
  const quadrant = quadrantLabel(item)

  return (
    <tr style={deferred ? { opacity: 0.7 } : undefined}>
      <td>
        <Text size="sm">{producerNameById.get(item.producer_id) || `#${item.producer_id}`}</Text>
      </td>
      <td>
        <Text size="sm">#{item.product_id}</Text>
      </td>
      <td>
        <Badge color={URGENCY_BADGE_COLOR[item.urgency]} size="sm" variant="light">
          {t(URGENCY_LABEL[item.urgency])}
        </Badge>
      </td>
      <td>
        {quadrant ? (
          <Badge color="blue" size="sm" variant="outline">
            {quadrant}
          </Badge>
        ) : (
          <Text c="dimmed" size="sm">
            —
          </Text>
        )}
      </td>
      <td style={{ textAlign: 'right' }}>
        <Text fw={600} size="sm">
          {qtyFormatter.format(item.suggested_qty)}
        </Text>
      </td>
      <td style={{ textAlign: 'right' }}>
        <Text size="sm">{item.unit_cost_eur === null ? '—' : eurFormatter.format(item.unit_cost_eur)}</Text>
      </td>
      <td style={{ textAlign: 'right' }}>
        {item.unit_margin_eur === null ? (
          <Text size="sm">—</Text>
        ) : (
          <Text c={item.unit_margin_eur >= 0 ? 'green' : 'red'} fw={600} size="sm">
            {eurFormatter.format(item.unit_margin_eur)}
          </Text>
        )}
      </td>
      <td style={{ textAlign: 'right' }}>
        <Text size="sm">{item.line_cost_eur === null ? '—' : eurFormatter.format(item.line_cost_eur)}</Text>
      </td>
      <td style={{ textAlign: 'right' }}>
        <Text size="sm">{item.value_density === null ? '—' : densityFormatter.format(item.value_density)}</Text>
      </td>
      <td style={{ textAlign: 'center' }}>
        <Badge color={deferred ? 'gray' : 'green'} size="sm" variant={deferred ? 'light' : 'filled'}>
          {deferred ? t('відкладено') : t('в бюджеті')}
        </Badge>
      </td>
    </tr>
  )
}

function SummaryItem({ color, label, value }: { color?: string; label: string; value: string }) {
  return (
    <Stack gap={2}>
      <Text c="dimmed" size="xs">
        {label}
      </Text>
      <Text c={color} fw={700}>
        {value}
      </Text>
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
  return [...items].sort((left, right) => {
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

function quadrantLabel(item: ReorderSuggestion): string {
  if (item.quadrant) {
    return item.quadrant
  }

  const abc = item.abc ?? ''
  const xyz = item.xyz ?? ''

  return `${abc}${xyz}`
}
