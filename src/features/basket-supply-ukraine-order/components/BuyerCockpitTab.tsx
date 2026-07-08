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
  Popover,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { Check, CircleAlert, RefreshCw, School, Settings, ThumbsDown, ThumbsUp, TriangleAlert } from 'lucide-react'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AiFeatureBadge } from '../../../shared/ai/AiFeatureBadge'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { TranslateFunction } from '../../../shared/i18n/types'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { getSupplyOrderSuppliers } from '../../supply-ukraine-orders/api/supplyUkraineOrdersApi'
import type { Client } from '../../supply-ukraine-orders/types'
import {
  createCockpitDraftOrder,
  getProducerPlan,
  getProducerProfile,
  recordFeedback,
  upsertProducerProfile,
  upsertProductTerms,
} from '../api/procurementApi'
import type {
  CockpitDraftItem,
  FeedbackAction,
  ProcurementUrgency,
  ProducerPlan,
  ReorderSuggestion,
} from '../procurementTypes'

type TermsSaveStatus = 'idle' | 'saving' | 'saved'

type FeedbackDecision = 'accepted' | 'dismissed'

type EditFeedbackStatus = 'idle' | 'saving' | 'saved'

type TermsDraft = {
  moq: number | ''
  order_multiple: number | ''
}

type BuyerCockpitState = {
  plan: ProducerPlan | null
  error: string | null
  isLoading: boolean
}

type BuyerCockpitAction =
  | { type: 'failed'; error: string }
  | { type: 'loaded'; plan: ProducerPlan }
  | { type: 'loading' }
  | { type: 'reset' }

const initialState: BuyerCockpitState = {
  plan: null,
  error: null,
  isLoading: false,
}

function cockpitReducer(_state: BuyerCockpitState, action: BuyerCockpitAction): BuyerCockpitState {
  switch (action.type) {
    case 'failed':
      return { plan: null, error: action.error, isLoading: false }
    case 'loaded':
      return { plan: action.plan, error: null, isLoading: false }
    case 'loading':
      return { plan: null, error: null, isLoading: true }
    case 'reset':
      return initialState
  }
}

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

const URGENCY_PILL_CLASS: Record<ProcurementUrgency, string> = {
  critical: 'app-role-pill is-red',
  high: 'app-role-pill is-orange',
  normal: 'app-role-pill is-yellow',
  none: 'app-role-pill is-gray',
}

const URGENCY_RANK: Record<ProcurementUrgency, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  none: 3,
}

const LEAD_TIME_SOURCE_LABEL: Record<string, string> = {
  empirical: 'емпіричний',
  geo: 'за геогр.',
  override: 'вручну',
  default: 'за замовч.',
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

const percentFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 1,
})

export function BuyerCockpitTab() {
  const { t } = useI18n()
  const [searchParams] = useSearchParams()
  const routeProducerId = searchParams.get('producerId')
  const routeProductId = searchParams.get('productId')
  const [state, dispatch] = useReducer(cockpitReducer, initialState)
  const [producers, setProducers] = useState<Client[]>([])
  const [producersError, setProducersError] = useState<string | null>(null)
  const [areProducersLoading, setProducersLoading] = useState(true)
  const [selectedProducerId, setSelectedProducerId] = useState<string | null>(() => normalizeRouteId(routeProducerId))
  const [draftQty, setDraftQty] = useState<Record<number, number>>({})
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const [termsDraft, setTermsDraft] = useState<Record<number, TermsDraft>>({})
  const [termsStatus, setTermsStatus] = useState<Record<number, TermsSaveStatus>>({})
  const [profileLeadTime, setProfileLeadTime] = useState<number | ''>('')
  const [profileServiceLevel, setProfileServiceLevel] = useState<number | ''>('')
  const [isProfileSaving, setProfileSaving] = useState(false)
  const [feedbackDecision, setFeedbackDecision] = useState<Record<number, FeedbackDecision>>({})
  const [feedbackPending, setFeedbackPending] = useState<Record<number, boolean>>({})
  const [editStatus, setEditStatus] = useState<Record<number, EditFeedbackStatus>>({})
  const lastEditedQty = useRef<Record<number, number>>({})
  const [isConfirmOpen, { open: openConfirm, close: closeConfirm }] = useDisclosure(false)
  const [isCreatingOrder, setCreatingOrder] = useState(false)
  const { plan, error, isLoading } = state

  const focusedProductId = useMemo(() => normalizeRouteNumber(routeProductId), [routeProductId])

  useEffect(() => {
    let cancelled = false

    async function loadProducers() {
      setProducersLoading(true)
      setProducersError(null)

      try {
        const loaded = await getSupplyOrderSuppliers()

        if (!cancelled) {
          setProducers(loaded)
        }
      } catch (loadError) {
        if (!cancelled) {
          setProducers([])
          setProducersError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити виробників'))
        }
      } finally {
        if (!cancelled) {
          setProducersLoading(false)
        }
      }
    }

    void loadProducers()

    return () => {
      cancelled = true
    }
  }, [t])

  useEffect(() => {
    if (selectedProducerId === null) {
      dispatch({ type: 'reset' })
      return
    }

    const producerId = Number(selectedProducerId)

    if (!Number.isFinite(producerId)) {
      dispatch({ type: 'reset' })
      return
    }

    let cancelled = false
    const controller = new AbortController()

    async function loadPlan() {
      dispatch({ type: 'loading' })

      try {
        const loaded = await getProducerPlan(producerId, undefined, controller.signal)

        if (!cancelled) {
          setDraftQty(buildDraftQty(loaded.items))
          setTermsDraft(buildTermsDraft(loaded.items))
          setTermsStatus({})
          setFeedbackDecision({})
          setFeedbackPending({})
          setEditStatus({})
          lastEditedQty.current = {}
          dispatch({ plan: loaded, type: 'loaded' })
        }
      } catch (loadError) {
        if (controller.signal.aborted) {
          return
        }

        if (!cancelled) {
          dispatch({
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити план поповнення'),
            type: 'failed',
          })
        }
      }
    }

    void loadPlan()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [selectedProducerId, reloadKey, t])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const producerId = selectedProducerId === null ? Number.NaN : Number(selectedProducerId)

    function clearProfileInputs() {
      if (!cancelled) {
        setProfileLeadTime('')
        setProfileServiceLevel('')
      }
    }

    async function loadProfile() {
      if (!Number.isFinite(producerId)) {
        clearProfileInputs()
        return
      }

      try {
        const loaded = await getProducerProfile(producerId, controller.signal)

        if (!cancelled) {
          setProfileLeadTime(loaded.lead_time_override_days ?? '')
          setProfileServiceLevel(loaded.service_level_target === null ? '' : loaded.service_level_target * 100)
        }
      } catch {
        if (controller.signal.aborted) {
          return
        }

        clearProfileInputs()
      }
    }

    void loadProfile()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [selectedProducerId, reloadKey])

  const producerOptions = useMemo(() => buildProducerOptions(producers), [producers])

  const sortedItems = useMemo(
    () => (plan ? plan.items.toSorted((left, right) => URGENCY_RANK[left.urgency] - URGENCY_RANK[right.urgency]) : []),
    [plan],
  )

  const urgencyCounts = useMemo(() => buildUrgencyCounts(plan?.items ?? []), [plan])

  const totalDraftCost = useMemo(
    () =>
      sortedItems.reduce((sum, item) => {
        const qty = getDraftQty(draftQty, item)
        const unitCost = lineUnitCost(item)

        return sum + qty * unitCost
      }, 0),
    [sortedItems, draftQty],
  )

  const orderableItems = useMemo(
    () =>
      sortedItems.filter((item) => {
        if (feedbackDecision[item.product_id] === 'dismissed') {
          return false
        }

        return getDraftQty(draftQty, item) > 0
      }),
    [sortedItems, draftQty, feedbackDecision],
  )

  const orderableCost = useMemo(
    () =>
      orderableItems.reduce((sum, item) => sum + getDraftQty(draftQty, item) * lineUnitCost(item), 0),
    [orderableItems, draftQty],
  )

  function updateDraftQty(productId: number, value: number | '') {
    const nextValue = typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0

    setDraftQty((current) => ({ ...current, [productId]: nextValue }))
  }

  function updateTermsDraft(productId: number, field: keyof TermsDraft, value: number | '') {
    setTermsDraft((current) => ({
      ...current,
      [productId]: { ...(current[productId] ?? { moq: '', order_multiple: '' }), [field]: value },
    }))
  }

  const saveTerms = useCallback(
    async (item: ReorderSuggestion, draft: TermsDraft) => {
      if (selectedProducerId === null) {
        return
      }

      const producerId = Number(selectedProducerId)

      if (!Number.isFinite(producerId)) {
        return
      }

      const moq = toTermsNumber(draft.moq, item.moq)
      const orderMultiple = toTermsNumber(draft.order_multiple, item.order_multiple)

      if (moq === (item.moq ?? null) && orderMultiple === (item.order_multiple ?? null)) {
        return
      }

      setTermsStatus((current) => ({ ...current, [item.product_id]: 'saving' }))

      try {
        await upsertProductTerms({
          producer_id: producerId,
          product_id: item.product_id,
          moq,
          order_multiple: orderMultiple,
        })

        setTermsStatus((current) => ({ ...current, [item.product_id]: 'saved' }))
        reload()
      } catch (saveError) {
        setTermsStatus((current) => ({ ...current, [item.product_id]: 'idle' }))
        notifications.show({
          color: 'red',
          message: saveError instanceof Error ? saveError.message : t('Не вдалося зберегти умови'),
        })
      }
    },
    [selectedProducerId, t],
  )

  const submitFeedback = useCallback(
    async (item: ReorderSuggestion, action: Extract<FeedbackAction, 'accept' | 'dismiss'>) => {
      if (selectedProducerId === null) {
        return
      }

      const producerId = Number(selectedProducerId)

      if (!Number.isFinite(producerId)) {
        return
      }

      if (feedbackDecision[item.product_id] || feedbackPending[item.product_id]) {
        return
      }

      const finalQty = action === 'dismiss' ? 0 : getDraftQty(draftQty, item)

      setFeedbackPending((current) => ({ ...current, [item.product_id]: true }))

      try {
        await recordFeedback({
          producer_id: producerId,
          product_id: item.product_id,
          suggested_qty: item.suggested_qty,
          final_qty: finalQty,
          action,
          abc: item.abc,
        })

        setFeedbackDecision((current) => ({
          ...current,
          [item.product_id]: action === 'accept' ? 'accepted' : 'dismissed',
        }))
      } catch (feedbackError) {
        notifications.show({
          color: 'red',
          message: feedbackError instanceof Error ? feedbackError.message : t('Не вдалося зберегти рішення'),
        })
      } finally {
        setFeedbackPending((current) => ({ ...current, [item.product_id]: false }))
      }
    },
    [draftQty, feedbackDecision, feedbackPending, selectedProducerId, t],
  )

  const submitEditFeedback = useCallback(
    async (item: ReorderSuggestion) => {
      if (selectedProducerId === null) {
        return
      }

      const producerId = Number(selectedProducerId)

      if (!Number.isFinite(producerId)) {
        return
      }

      if (feedbackDecision[item.product_id]) {
        return
      }

      const finalQty = getDraftQty(draftQty, item)

      if (finalQty === item.suggested_qty) {
        return
      }

      if (lastEditedQty.current[item.product_id] === finalQty) {
        return
      }

      lastEditedQty.current[item.product_id] = finalQty
      setEditStatus((current) => ({ ...current, [item.product_id]: 'saving' }))

      try {
        await recordFeedback({
          producer_id: producerId,
          product_id: item.product_id,
          suggested_qty: item.suggested_qty,
          final_qty: finalQty,
          action: 'edit',
          abc: item.abc,
        })

        setEditStatus((current) => ({ ...current, [item.product_id]: 'saved' }))
      } catch (feedbackError) {
        delete lastEditedQty.current[item.product_id]
        setEditStatus((current) => ({ ...current, [item.product_id]: 'idle' }))
        notifications.show({
          color: 'red',
          message: feedbackError instanceof Error ? feedbackError.message : t('Не вдалося зберегти рішення'),
        })
      }
    },
    [draftQty, feedbackDecision, selectedProducerId, t],
  )

  async function saveProfile() {
    if (selectedProducerId === null) {
      return
    }

    const producerId = Number(selectedProducerId)

    if (!Number.isFinite(producerId)) {
      return
    }

    setProfileSaving(true)

    try {
      await upsertProducerProfile({
        producer_id: producerId,
        lead_time_override_days: profileLeadTime === '' ? null : profileLeadTime,
        service_level_target: profileServiceLevel === '' ? null : profileServiceLevel / 100,
      })

      notifications.show({ color: 'green', message: t('Налаштування виробника збережено') })
      reload()
    } catch (saveError) {
      notifications.show({
        color: 'red',
        message: saveError instanceof Error ? saveError.message : t('Не вдалося зберегти налаштування виробника'),
      })
    } finally {
      setProfileSaving(false)
    }
  }

  async function submitCockpitDraftOrder() {
    if (selectedProducerId === null || isCreatingOrder) {
      return
    }

    const producerId = Number(selectedProducerId)

    if (!Number.isFinite(producerId)) {
      return
    }

    const items: CockpitDraftItem[] = orderableItems.map((item) => ({
      productId: item.product_id,
      qty: getDraftQty(draftQty, item),
    }))

    if (items.length === 0) {
      return
    }

    setCreatingOrder(true)

    try {
      const created = await createCockpitDraftOrder(producerId, items)
      const orderNumber = readOrderNumber(created)

      notifications.show({
        color: 'green',
        message: orderNumber
          ? `${t('Чернетку замовлення створено')} № ${orderNumber}`
          : t('Чернетку замовлення створено'),
      })
      closeConfirm()
      reload()
    } catch (createError) {
      notifications.show({
        color: 'red',
        message: createError instanceof Error ? createError.message : t('Не вдалося створити чернетку'),
      })
    } finally {
      setCreatingOrder(false)
    }
  }

  const columns = useMemo<Array<DataTableColumn<ReorderSuggestion>>>(
    () => [
      {
        id: 'product',
        header: t('Товар'),
        accessor: (item) => item.product_id,
        cell: (item) => `#${item.product_id}`,
        width: 110,
      },
      {
        id: 'urgency',
        header: t('Терміновість'),
        accessor: (item) => URGENCY_RANK[item.urgency],
        cell: (item) => (
          <Badge className={URGENCY_PILL_CLASS[item.urgency]} size="sm" variant="light">
            {t(URGENCY_LABEL[item.urgency])}
          </Badge>
        ),
        width: 130,
      },
      {
        id: 'quadrant',
        header: t('Квадрант'),
        accessor: (item) => quadrantLabel(item),
        cell: (item) => {
          const label = quadrantLabel(item)

          if (!label) {
            return (
              <Text c="dimmed" size="sm">
                —
              </Text>
            )
          }

          return (
            <Badge className="app-role-pill" size="sm" variant="outline">
              {label}
            </Badge>
          )
        },
        width: 110,
      },
      {
        id: 'suggestedQty',
        header: t('Рекомендовано'),
        accessor: (item) => item.suggested_qty,
        cell: (item) => <SuggestedQtyCell item={item} t={t} />,
        width: 150,
        align: 'right',
        enableSorting: false,
      },
      {
        id: 'terms',
        header: t('Умови'),
        cell: (item) => {
          const draft = termsDraft[item.product_id] ?? { moq: '', order_multiple: '' }

          return (
            <Group gap={4} justify="flex-end" wrap="nowrap">
              <NumberInput
                allowNegative={false}
                aria-label={t('MOQ')}
                hideControls
                min={0}
                onBlur={() => void saveTerms(item, draft)}
                onChange={(value) => updateTermsDraft(item.product_id, 'moq', typeof value === 'number' ? value : '')}
                placeholder={t('MOQ')}
                size="xs"
                value={draft.moq}
                w={64}
              />
              <NumberInput
                allowNegative={false}
                aria-label={t('Кратність')}
                hideControls
                min={0}
                onBlur={() => void saveTerms(item, draft)}
                onChange={(value) =>
                  updateTermsDraft(item.product_id, 'order_multiple', typeof value === 'number' ? value : '')
                }
                placeholder="×"
                size="xs"
                value={draft.order_multiple}
                w={64}
              />
              <TermsStatusIndicator status={termsStatus[item.product_id] ?? 'idle'} t={t} />
            </Group>
          )
        },
        width: 180,
        align: 'right',
        enableSorting: false,
      },
      {
        id: 'draftQty',
        header: t('К-сть до замовлення'),
        accessor: (item) => getDraftQty(draftQty, item),
        cell: (item) => (
          <Group gap={4} justify="flex-end" wrap="nowrap">
            <NumberInput
              allowNegative={false}
              disabled={Boolean(feedbackDecision[item.product_id])}
              min={0}
              onBlur={() => void submitEditFeedback(item)}
              onChange={(value) => updateDraftQty(item.product_id, typeof value === 'number' ? value : '')}
              size="xs"
              value={getDraftQty(draftQty, item)}
              w={120}
            />
            <TermsStatusIndicator status={editStatus[item.product_id] ?? 'idle'} t={t} />
          </Group>
        ),
        width: 170,
        align: 'right',
        enableSorting: false,
      },
      {
        id: 'unitCost',
        header: `${t('Ціна')} (EUR)`,
        accessor: (item) => item.unit_cost_eur ?? 0,
        cell: (item) => (item.unit_cost_eur === null ? '' : <span className="app-money">{eurFormatter.format(item.unit_cost_eur)}</span>),
        width: 120,
        align: 'right',
      },
      {
        id: 'unitMargin',
        header: `${t('Маржа')} (EUR)`,
        accessor: (item) => item.unit_margin_eur ?? 0,
        cell: (item) => {
          if (item.unit_margin_eur === null) {
            return ''
          }

          return <Text className="app-money" fw={600} size="sm">{eurFormatter.format(item.unit_margin_eur)}</Text>
        },
        width: 120,
        align: 'right',
      },
      {
        id: 'serviceLevel',
        header: t('Рівень сервісу'),
        accessor: (item) => item.applied_service_level ?? 0,
        cell: (item) =>
          item.applied_service_level === null ? '' : `${percentFormatter.format(item.applied_service_level * 100)}%`,
        width: 130,
        align: 'right',
      },
      {
        id: 'daysOfCover',
        header: t('Днів покриття'),
        accessor: (item) => item.days_of_cover,
        cell: (item) => qtyFormatter.format(item.days_of_cover),
        width: 120,
        align: 'right',
      },
      {
        id: 'cheaperAlt',
        header: '',
        cell: (item) =>
          item.cheaper_alt ? (
            <Tooltip
              label={`${t('дешевший постачальник')}: €${eurFormatter.format(item.cheaper_alt.cost_eur)}`}
            >
              <ActionIcon aria-label={t('дешевший постачальник')} color="orange" size="sm" variant="subtle">
                <TriangleAlert size={16} />
              </ActionIcon>
            </Tooltip>
          ) : null,
        width: 56,
        enableSorting: false,
      },
      {
        id: 'action',
        header: t('Дія'),
        cell: (item) => (
          <FeedbackActionsCell
            decision={feedbackDecision[item.product_id] ?? null}
            isPending={Boolean(feedbackPending[item.product_id])}
            onAccept={() => void submitFeedback(item, 'accept')}
            onDismiss={() => void submitFeedback(item, 'dismiss')}
            t={t}
          />
        ),
        width: 120,
        align: 'center',
        enableSorting: false,
      },
    ],
    [draftQty, editStatus, feedbackDecision, feedbackPending, saveTerms, submitEditFeedback, submitFeedback, termsDraft, termsStatus, t],
  )

  const toolbarRight = (
    <Tooltip label={t('Оновити')}>
      <ActionIcon
        aria-label={t('Оновити')}
        disabled={selectedProducerId === null}
        loading={isLoading}
        size="sm"
        variant="subtle"
        onClick={() => reload()}
      >
        <RefreshCw size={16} />
      </ActionIcon>
    </Tooltip>
  )

  const hasSelection = selectedProducerId !== null
  const hasPlan = Boolean(plan) && !isLoading
  const hasItems = sortedItems.length > 0

  return (
    <Stack gap={6}>
      <Card className="app-data-card" padding={0} radius="md" withBorder>
      <div className="app-filter-bar basket-supply-command-bar">
        <Select
          clearable
          data={producerOptions}
          disabled={areProducersLoading}
          label={t('Виробник')}
          nothingFoundMessage={t('Нічого не знайдено')}
          placeholder={areProducersLoading ? t('Завантаження…') : t('Оберіть виробника')}
          searchable
          value={selectedProducerId}
          w={360}
          onChange={setSelectedProducerId}
        />
      </div>
      <Stack gap="md" p="md">
      {producersError && (
        <Alert color="yellow" icon={<CircleAlert size={16} />} variant="light">
          {producersError}
        </Alert>
      )}

      {error && (
        <Alert color="red" icon={<CircleAlert size={16} />} variant="light">
          {error}
        </Alert>
      )}

      {!hasSelection && !error && (
        <Card className="app-section-card" padding="lg" radius="md" withBorder>
          <Text c="dimmed" size="sm" ta="center">
            {t('Оберіть виробника')}
          </Text>
        </Card>
      )}

      {hasSelection && isLoading && (
        <Card className="app-section-card" padding="lg" radius="md" withBorder>
          <Group justify="center">
            <Loader size="sm" />
            <Text c="dimmed" size="sm">
              {t('Завантаження…')}
            </Text>
          </Group>
        </Card>
      )}

      {hasSelection && hasPlan && plan && (
        <Card className="app-section-card" padding="md" radius="md" withBorder>
          <Stack gap="sm">
            <Group justify="space-between" wrap="wrap">
              <Stack gap={2}>
                <Group gap="xs" wrap="nowrap">
                  <Text fw={600} size="lg">
                    {plan.producer_name || `#${plan.producer_id ?? ''}`}
                  </Text>
                  <AiFeatureBadge tooltip={t('AI-помічник закупівельника')} />
                </Group>
                <Group gap="xs">
                  <Text c="dimmed" size="sm">
                    {t('Час постачання')}: {qtyFormatter.format(plan.lead_time_days)} ±{' '}
                    {qtyFormatter.format(plan.lead_time_std_days)} {t('днів')}
                  </Text>
                  {plan.lead_time_source && (
                    <Badge className="app-role-pill is-gray" size="sm" variant="light">
                      {t(LEAD_TIME_SOURCE_LABEL[plan.lead_time_source] ?? plan.lead_time_source)}
                    </Badge>
                  )}
                </Group>
              </Stack>
              <Group align="flex-end" gap="md" wrap="nowrap">
                <Stack align="flex-end" gap={2}>
                  <Text c="dimmed" size="xs">
                    {t('Чернетка замовлення')} (EUR)
                  </Text>
                  <Text fw={700} size="lg">
                    €{eurFormatter.format(totalDraftCost)}
                  </Text>
                </Stack>
                <Popover position="bottom-end" shadow="md" withinPortal>
                  <Popover.Target>
                    <Button leftSection={<Settings size={16} />} size="xs" variant="default">
                      {t('Налаштування виробника')}
                    </Button>
                  </Popover.Target>
                  <Popover.Dropdown p="md">
                    <Stack gap="sm" w={260}>
                      <Text fw={600} size="sm">
                        {t('Налаштування виробника')}
                      </Text>
                      <NumberInput
                        allowNegative={false}
                        description={t('Перевизначення часу постачання')}
                        label={`${t('Час постачання')} (${t('днів')})`}
                        min={0}
                        onChange={(value) => setProfileLeadTime(typeof value === 'number' ? value : '')}
                        placeholder={qtyFormatter.format(plan.lead_time_days)}
                        size="xs"
                        value={profileLeadTime}
                      />
                      <NumberInput
                        allowNegative={false}
                        decimalScale={1}
                        description={t('Цільовий рівень сервісу')}
                        label={`${t('Рівень сервісу')} (%)`}
                        max={100}
                        min={0}
                        onChange={(value) => setProfileServiceLevel(typeof value === 'number' ? value : '')}
                        size="xs"
                        suffix="%"
                        value={profileServiceLevel}
                      />
                      <Divider />
                      <Group justify="flex-end">
                        <Button color={CREATE_ACTION_COLOR} loading={isProfileSaving} onClick={() => void saveProfile()} size="xs">
                          {t('Зберегти')}
                        </Button>
                      </Group>
                    </Stack>
                  </Popover.Dropdown>
                </Popover>
              </Group>
            </Group>

            <SimpleGrid cols={{ base: 2, md: 5 }} spacing="sm">
              <SummaryItem label={t('Позицій')} value={countFormatter.format(plan.item_count)} />
              <SummaryItem
                color={URGENCY_BADGE_COLOR.critical}
                label={t(URGENCY_LABEL.critical)}
                value={countFormatter.format(urgencyCounts.critical)}
              />
              <SummaryItem
                color={URGENCY_BADGE_COLOR.high}
                label={t(URGENCY_LABEL.high)}
                value={countFormatter.format(urgencyCounts.high)}
              />
              <SummaryItem
                color={URGENCY_BADGE_COLOR.normal}
                label={t(URGENCY_LABEL.normal)}
                value={countFormatter.format(urgencyCounts.normal)}
              />
              <SummaryItem
                label={t(URGENCY_LABEL.none)}
                value={countFormatter.format(urgencyCounts.none)}
              />
            </SimpleGrid>
          </Stack>
        </Card>
      )}

      {hasSelection && hasPlan && (
        <Card className="app-section-card" padding="md" radius="md" withBorder>
          <Stack gap="md">
            <DataTable
              columns={columns}
              data={sortedItems}
              emptyText={t('Немає позицій до замовлення')}
              getRowId={(item) => String(item.product_id)}
              isLoading={isLoading}
              maxHeight={560}
              minWidth={1510}
              rowClassName={(item) => (item.product_id === focusedProductId ? 'basket-supply-row-ai-focus' : undefined)}
              tableId="basket-supply-ukraine-order-buyer-cockpit"
              toolbarRight={toolbarRight}
            />

            <Group justify="flex-end">
              <Button
                color={CREATE_ACTION_COLOR}
                disabled={orderableItems.length === 0}
                loading={isCreatingOrder}
                onClick={openConfirm}
              >
                {t('Створити замовлення постачальнику')}
              </Button>
            </Group>

            {hasItems && (
              <Text c="dimmed" size="xs" ta="right">
                {t('Чернетка')}: {countFormatter.format(sortedItems.length)} {t('позицій')} · €
                {eurFormatter.format(totalDraftCost)}
              </Text>
            )}
          </Stack>
        </Card>
      )}
      </Stack>
      </Card>

      <AppModal
        centered
        opened={isConfirmOpen}
        size="sm"
        title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Створити чернетку замовлення?')}</span>}
        onClose={() => {
          if (!isCreatingOrder) {
            closeConfirm()
          }
        }}
      >
        <Stack gap="md">
          <Stack gap={4}>
            <Text size="sm">{plan?.producer_name || `#${plan?.producer_id ?? ''}`}</Text>
            <Text c="dimmed" size="sm">
              {countFormatter.format(orderableItems.length)} {t('позицій')} · €{eurFormatter.format(orderableCost)}
            </Text>
          </Stack>
          <Group justify="flex-end" gap="sm">
            <Button color="gray" disabled={isCreatingOrder} variant="light" onClick={closeConfirm}>
              {t('Скасувати')}
            </Button>
            <Button
              color={CREATE_ACTION_COLOR}
              data-autofocus
              disabled={orderableItems.length === 0}
              loading={isCreatingOrder}
              onClick={() => void submitCockpitDraftOrder()}
            >
              {t('Створити')}
            </Button>
          </Group>
        </Stack>
      </AppModal>
    </Stack>
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

function normalizeRouteNumber(value: string | null): number | null {
  const numericValue = Number(value)

  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null
}

function normalizeRouteId(value: string | null): string | null {
  const numericValue = normalizeRouteNumber(value)

  return numericValue === null ? null : String(numericValue)
}

function buildProducerOptions(producers: Client[]) {
  return producers
    .map((producer) => {
      const id = producer.Id

      if (typeof id !== 'number' || !Number.isFinite(id)) {
        return null
      }

      const label = producer.FullName || producer.Name || producer.Code || `#${id}`

      return { label, value: String(id) }
    })
    .filter((option): option is { label: string; value: string } => option !== null)
}

function SuggestedQtyCell({ item, t }: { item: ReorderSuggestion; t: TranslateFunction }) {
  const hasRounding = item.raw_qty !== null && item.raw_qty !== item.suggested_qty
  const hints: string[] = []

  if (item.moq !== null) {
    hints.push(`MOQ ${qtyFormatter.format(item.moq)}`)
  }

  if (item.order_multiple !== null) {
    hints.push(`×${qtyFormatter.format(item.order_multiple)}`)
  }

  const learnedFactor = item.learned_factor
  const hasLearned = learnedFactor !== null && learnedFactor !== 1

  return (
    <Stack align="flex-end" gap={2}>
      <Group gap={6} justify="flex-end" wrap="nowrap">
        <Text fw={700} size="sm">
          {qtyFormatter.format(item.suggested_qty)}
        </Text>
        {hasRounding && item.raw_qty !== null && (
          <Text c="dimmed" size="xs" td="line-through">
            {qtyFormatter.format(item.raw_qty)}
          </Text>
        )}
      </Group>
      {hasRounding && hints.length > 0 && (
        <Badge className="app-role-pill is-gray" size="xs" variant="light">
          {hints.join(' / ')}
        </Badge>
      )}
      {hasLearned && (
        <Tooltip label={t('Кількість скориговано на основі попередніх рішень закупівельника')} withinPortal>
          <Badge
            color="orange"
            leftSection={<School size={11} />}
            size="xs"
            variant="light"
          >
            {t('навчено')} ×{qtyFormatter.format(learnedFactor)}
          </Badge>
        </Tooltip>
      )}
    </Stack>
  )
}

function TermsStatusIndicator({ status, t }: { status: TermsSaveStatus; t: TranslateFunction }) {
  if (status === 'saving') {
    return <Loader size={14} />
  }

  if (status === 'saved') {
    return (
      <Tooltip label={t('Збережено')}>
        <Check color="var(--mantine-color-green-6)" size={16} />
      </Tooltip>
    )
  }

  return <span style={{ display: 'inline-block', width: 16 }} />
}

function FeedbackActionsCell({
  decision,
  isPending,
  onAccept,
  onDismiss,
  t,
}: {
  decision: FeedbackDecision | null
  isPending: boolean
  onAccept: () => void
  onDismiss: () => void
  t: TranslateFunction
}) {
  if (decision === 'accepted') {
    return (
      <Group gap={4} justify="center" wrap="nowrap">
        <Check color="var(--mantine-color-green-6)" size={16} />
        <Text c="green" size="xs">
          {t('Прийнято')}
        </Text>
      </Group>
    )
  }

  if (decision === 'dismissed') {
    return (
      <Text c="dimmed" size="xs" ta="center">
        {t('Відхилено')}
      </Text>
    )
  }

  return (
    <Group gap={4} justify="center" wrap="nowrap">
      <Tooltip label={t('Прийняти')}>
        <ActionIcon
          aria-label={t('Прийняти')}
          color="green"
          disabled={isPending}
          onClick={onAccept}
          size="sm"
          variant="subtle"
        >
          <ThumbsUp size={16} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label={t('Відхилити')}>
        <ActionIcon
          aria-label={t('Відхилити')}
          color="red"
          disabled={isPending}
          onClick={onDismiss}
          size="sm"
          variant="subtle"
        >
          <ThumbsDown size={16} />
        </ActionIcon>
      </Tooltip>
    </Group>
  )
}

function buildTermsDraft(items: ReorderSuggestion[]): Record<number, TermsDraft> {
  return items.reduce<Record<number, TermsDraft>>((draft, item) => {
    draft[item.product_id] = {
      moq: item.moq ?? '',
      order_multiple: item.order_multiple ?? '',
    }
    return draft
  }, {})
}

function toTermsNumber(value: number | '' | undefined, fallback: number | null): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (value === '') {
    return null
  }

  return fallback
}

function buildDraftQty(items: ReorderSuggestion[]): Record<number, number> {
  return items.reduce<Record<number, number>>((draft, item) => {
    draft[item.product_id] = item.suggested_qty
    return draft
  }, {})
}

function getDraftQty(draftQty: Record<number, number>, item: ReorderSuggestion): number {
  const value = draftQty[item.product_id]

  return typeof value === 'number' && Number.isFinite(value) ? value : item.suggested_qty
}

function lineUnitCost(item: ReorderSuggestion): number {
  if (item.unit_cost_eur !== null) {
    return item.unit_cost_eur
  }

  if (item.line_cost_eur !== null && item.suggested_qty > 0) {
    return item.line_cost_eur / item.suggested_qty
  }

  return 0
}

function buildUrgencyCounts(items: ReorderSuggestion[]): Record<ProcurementUrgency, number> {
  return items.reduce<Record<ProcurementUrgency, number>>(
    (counts, item) => {
      counts[item.urgency] += 1
      return counts
    },
    { critical: 0, high: 0, normal: 0, none: 0 },
  )
}

function quadrantLabel(item: ReorderSuggestion): string {
  if (item.quadrant) {
    return item.quadrant
  }

  const abc = item.abc ?? ''
  const xyz = item.xyz ?? ''
  const label = `${abc}${xyz}`

  return label
}

function readOrderNumber(order: unknown): string {
  if (!order || typeof order !== 'object') {
    return ''
  }

  const value = (order as Record<string, unknown>).Number

  if (typeof value === 'string' && value !== '') {
    return value
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  return ''
}
