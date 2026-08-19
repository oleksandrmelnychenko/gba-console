import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Checkbox,
  Divider,
  FileButton,
  Group,
  Loader,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { Banknote, CircleAlert, FileUp, GitMerge, Info, Plus, Save, Trash2 } from 'lucide-react'
import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatLocalDate, formatLocalInputDateTime } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import { TableRowAction } from '../../../shared/ui/table-row-action'
import { upgradeHttpToHttps } from '../../../shared/url/upgradeHttpToHttps'
import { useAuth } from '../../auth/useAuth'
import { CashFlowDetailContent } from '../../accounting-cash-flow/components/CashFlowDetailContent'
import { getAccountingCashFlowPaymentStatus } from '../../accounting-cash-flow/accountingCashFlowPaymentStatus'
import { getAccountingCashFlowDrilldownRoute } from '../../accounting-cash-flow/cashFlowDrilldown'
import type { AccountingCashFlowHeadItem } from '../../accounting-cash-flow/types'
import { createAvailablePaymentOutcomeOperation } from '../models/availablePaymentOutcomeOperation'
import { validateAvailablePaymentOutcomeForm } from '../models/availablePaymentOutcomePolicy'
import {
  getAvailablePaymentSelectionError,
  validateAvailablePaymentSelection,
} from '../models/availablePaymentSelection'
import {
  getAvailablePaymentMergeError,
  uniqueTaskModels,
  validateAvailablePaymentMerge,
} from '../models/availablePaymentMerge'
import {
  countActiveDocuments,
} from '../models/availablePaymentDocuments'
import { getAvailablePaymentSourceRoute } from '../models/availablePaymentSourceRoute'
import { buildTaskModels } from '../models/paymentTaskModelMapper'
import {
  calculateAvailablePaymentConvertedAmount,
  createAvailablePaymentMovement,
  createAvailablePaymentOutcome,
  getAvailablePaymentAccountingCashFlow,
  getAvailablePaymentExchangeRate,
  getAvailablePaymentMovements,
  getAvailablePaymentTaskByNetId,
  mergeAvailablePaymentTasks,
  searchAvailablePaymentMovements,
  searchAvailablePaymentRegisters,
  setAvailablePaymentTaskToActive,
} from '../api/availablePaymentsApi'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import {
  TaskStatusValue,
  type AccountingTypeValue,
  type AvailablePaymentAccountingCashFlow,
  type AvailablePaymentColumn,
  type AvailablePaymentCurrencyRegister,
  type AvailablePaymentDocument,
  type AvailablePaymentMovement,
  type AvailablePaymentOrderSummary,
  type AvailablePaymentOutcomeRequest,
  type AvailablePaymentRegister,
  type AvailablePaymentTaskModel,
  type AvailablePaymentTaskRow,
  type AvailablePaymentsOrganization,
  type GroupedPaymentTask,
  type SupplyPaymentTask,
} from '../types'
import './available-payments-detail-drawer.css'
import {
  AVAILABLE_PAYMENTS_CASH_FLOW_OPEN_PERMISSION,
  AVAILABLE_PAYMENTS_MOVEMENT_CREATE_PERMISSION,
  AVAILABLE_PAYMENTS_OUTCOME_CREATE_PERMISSION,
  AVAILABLE_PAYMENTS_TASK_MARK_AVAILABLE_PERMISSION,
  AVAILABLE_PAYMENTS_TASK_MERGE_PERMISSION,
} from '../permissions'

type AvailablePaymentsDetailDrawerProps = {
  filesByTaskId: Record<string, File[]>
  group: GroupedPaymentTask | null
  markedModels: AvailablePaymentTaskModel[]
  markedTaskIds: string[]
  outcomeRequest: {
    key: number
    models: AvailablePaymentTaskModel[]
  } | null
  typePaymentTask: AccountingTypeValue
  onChanged: () => void
  onClearMarked: () => void
  onClose: () => void
  onFilesChanged: (taskId: string, files: File[]) => void
  onTaskUpdated: (taskId: string, task: SupplyPaymentTask) => void
  onToggleMarked: (model: AvailablePaymentTaskModel) => void
}

type OutcomeFormState = {
  amount: number
  comment: string
  customNumber: string
  date: string
  exchangeRate: number
  isAccounting: boolean
  isManagementAccounting: boolean
  movementSearch: string
  movementValue: string
  organizationValue: string
  paymentPurpose: string
  registerValue: string
  selectedCurrencyValue: string
  time: string
  vatRate: number
}

type CashFlowState = {
  data: AvailablePaymentAccountingCashFlow | null
  error: string | null
  isLoading: boolean
}

type CashFlowFilters = {
  from: string
  to: string
}

type OutcomeOpenOptions = {
  requireDocuments?: boolean
}

type TaskDetailTab = 'cash-flow' | 'invoice' | 'payment' | 'transfer'

type AvailablePaymentCashFlowTableItem = {
  id: string
  CurrentBalance?: number
  CurrentValue?: number
  FromDate?: string
  IsCreditValue?: boolean
  Name?: string
  Number?: string
  OrganizationName?: string
  Type?: number
  source: AccountingCashFlowHeadItem
}

type AvailablePaymentCashFlowSummary = {
  beforeInAmount?: number
  beforeOutAmount?: number
  beforeBalance?: number
  afterInAmount?: number
  afterOutAmount?: number
  closingBalance?: number
}

type DataRecord = Record<string, unknown>

const SEARCH_DEBOUNCE_MS = 300

const dateFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short' })
const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short', timeStyle: 'short' })

export function AvailablePaymentsDetailDrawer(props: AvailablePaymentsDetailDrawerProps) {
  const model = useAvailablePaymentsDetailDrawerModel(props)

  return <AvailablePaymentsDetailDrawerView model={model} />
}

function useAvailablePaymentsDetailDrawerModel({
  filesByTaskId,
  group,
  markedModels,
  markedTaskIds,
  outcomeRequest,
  typePaymentTask,
  onChanged,
  onClearMarked,
  onClose,
  onFilesChanged,
  onTaskUpdated,
  onToggleMarked,
}: AvailablePaymentsDetailDrawerProps) {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const navigate = useNavigate()
  const canCreateOutcome = hasPermission(AVAILABLE_PAYMENTS_OUTCOME_CREATE_PERMISSION)
  const canMergeTasks = hasPermission(AVAILABLE_PAYMENTS_TASK_MERGE_PERMISSION)
  const canMarkTaskAvailable = hasPermission(AVAILABLE_PAYMENTS_TASK_MARK_AVAILABLE_PERMISSION)
  const canOpenCashFlow = hasPermission(AVAILABLE_PAYMENTS_CASH_FLOW_OPEN_PERMISSION)
  const canCreateMovement = hasPermission(AVAILABLE_PAYMENTS_MOVEMENT_CREATE_PERMISSION)
  const models = useMemo(() => buildTaskModels(group, t), [group, t])
  const [activeTabs, setActiveTabs] = useValueState<Record<string, TaskDetailTab>>({})
  const [cashFlows, setCashFlows] = useValueState<Record<string, CashFlowState>>({})
  const [cashFlowFiltersByTaskId, setCashFlowFiltersByTaskId] = useValueState<Record<string, CashFlowFilters>>({})
  const [selectedCashFlowItem, setSelectedCashFlowItem] = useValueState<AccountingCashFlowHeadItem | null>(null)
  const [outcomeModels, setOutcomeModels] = useValueState<AvailablePaymentTaskModel[]>([])
  const [outcomeRequiresDocuments, setOutcomeRequiresDocuments] = useValueState(true)
  const [registers, setRegisters] = useValueState<AvailablePaymentRegister[]>([])
  const [movements, setMovements] = useValueState<AvailablePaymentMovement[]>([])
  const [form, setForm] = useValueState<OutcomeFormState>(() => createInitialOutcomeForm())
  const [isLoadingDictionaries, setLoadingDictionaries] = useValueState(false)
  const [isSaving, setSaving] = useValueState(false)
  const [error, setError] = useValueState<string | null>(null)
  const [confirmCloseOutcomeOpen, setConfirmCloseOutcomeOpen] = useValueState(false)
  const cashFlowRequestRef = useRef<Record<string, number>>({})
  const handledOutcomeRequestKeyRef = useRef<number | null>(null)
  const movementSearchRequestRef = useRef(0)
  const movementSearchTimeoutRef = useRef<number | null>(null)
  const [outcomeOperation] = useState(createAvailablePaymentOutcomeOperation)

  useEffect(() => {
    let cancelled = false

    void outcomeOperation.reconcile()
      .then((status) => {
        if (cancelled || status !== 'completed') {
          return
        }

        notifications.show({
          color: 'green',
          message: t('Попередній видатковий ордер успішно створено'),
        })
        onClearMarked()
        onChanged()
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [onChanged, onClearMarked, outcomeOperation, t])

  useEffect(() => {
    if (!canCreateOutcome || outcomeModels.length === 0) {
      return
    }

    let cancelled = false

    async function loadDictionaries() {
      setLoadingDictionaries(true)
      setError(null)

      try {
        const [nextRegisters, nextMovements] = await Promise.all([
          searchAvailablePaymentRegisters(''),
          getAvailablePaymentMovements(),
        ])

        if (cancelled) {
          return
        }

        setRegisters(nextRegisters)
        setMovements(nextMovements)
        setForm((current) => selectOutcomeDefaults(current, outcomeModels, nextRegisters))
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити довідники'))
        }
      } finally {
        if (!cancelled) {
          setLoadingDictionaries(false)
        }
      }
    }

    void loadDictionaries()

    return () => {
      cancelled = true
    }
  }, [canCreateOutcome, outcomeModels, setError, setForm, setLoadingDictionaries, setMovements, setRegisters, t])

  useEffect(
    () => () => {
      if (movementSearchTimeoutRef.current) {
        window.clearTimeout(movementSearchTimeoutRef.current)
      }
    },
    [],
  )

  const selectedOrganization = useMemo(
    () =>
      getAvailableOrganizations(outcomeModels, registers).find(
        (organization) => getEntityValue(organization) === form.organizationValue,
      ) || null,
    [form.organizationValue, outcomeModels, registers],
  )
  const filteredRegisters = useMemo(
    () => registers.filter((register) => isRegisterForOrganization(register, selectedOrganization)),
    [registers, selectedOrganization],
  )
  const selectedRegister = useMemo(
    () => filteredRegisters.find((register) => getEntityValue(register) === form.registerValue) || null,
    [filteredRegisters, form.registerValue],
  )
  const selectedCurrencyRegister = useMemo(
    () =>
      (selectedRegister?.PaymentCurrencyRegisters || []).find(
        (currencyRegister) => getEntityValue(currencyRegister) === form.selectedCurrencyValue,
      ) || null,
    [form.selectedCurrencyValue, selectedRegister],
  )
  const selectedMovement = useMemo(
    () =>
      movements.find((movement) => getEntityValue(movement) === form.movementValue)
      || findPaymentMovementByLabel(movements, form.movementSearch),
    [form.movementSearch, form.movementValue, movements],
  )

  const paymentCurrency = selectedCurrencyRegister?.Currency || null
  const taskCurrency = outcomeModels[0]?.currency || null
  const paymentCurrencyNetUid = paymentCurrency?.NetUid || ''
  const paymentCurrencyCode = paymentCurrency?.Code || ''
  const paymentCurrencyId = paymentCurrency?.Id || 0
  const taskCurrencyNetUid = taskCurrency?.NetUid || ''
  const taskCurrencyCode = taskCurrency?.Code || ''
  const taskCurrencyId = taskCurrency?.Id || 0
  const baseOutcomeAmount = useMemo(
    () => uniqueOutcomeModels(outcomeModels).reduce((total, model) => total + getModelPaymentAmount(model), 0),
    [outcomeModels],
  )
  const organizationName = selectedOrganization?.Name || outcomeModels[0]?.organization?.Name || ''
  const exchangeFromDate = form.date

  useEffect(() => {
    if (!canCreateOutcome || outcomeModels.length === 0) {
      return
    }

    if (
      !paymentCurrencyNetUid
      || !taskCurrencyNetUid
      || paymentCurrencyNetUid === taskCurrencyNetUid
      || (Boolean(paymentCurrencyCode) && paymentCurrencyCode === taskCurrencyCode)
    ) {
      setForm((current) => ({
        ...current,
        amount: baseOutcomeAmount,
        exchangeRate: 0,
      }))
      return
    }

    let cancelled = false

    void getAvailablePaymentExchangeRate({
      fromCurrencyNetId: taskCurrencyNetUid,
      fromDate: toQueryDate(exchangeFromDate),
      organizationName,
      toCurrencyNetId: paymentCurrencyNetUid,
    })
      .then((rate) => {
        if (!cancelled) {
          setForm((current) => ({ ...current, exchangeRate: rate }))
        }
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [
    exchangeFromDate,
    baseOutcomeAmount,
    canCreateOutcome,
    organizationName,
    outcomeModels.length,
    paymentCurrencyCode,
    paymentCurrencyNetUid,
    setForm,
    taskCurrencyCode,
    taskCurrencyNetUid,
  ])

  useEffect(() => {
    if (!canCreateOutcome || outcomeModels.length === 0) {
      return
    }

    if (!baseOutcomeAmount || !paymentCurrencyId || !taskCurrencyId) {
      return
    }

    if (
      paymentCurrencyId === taskCurrencyId
      || (Boolean(paymentCurrencyCode) && paymentCurrencyCode === taskCurrencyCode)
    ) {
      setForm((current) => (current.amount === baseOutcomeAmount ? current : { ...current, amount: baseOutcomeAmount }))
      return
    }

    if (form.exchangeRate <= 0) {
      return
    }

    let cancelled = false

    void calculateAvailablePaymentConvertedAmount({
      amount: baseOutcomeAmount,
      exchangeRate: form.exchangeRate,
      fromCurrencyId: taskCurrencyId,
      toCurrencyId: paymentCurrencyId,
    })
      .then((amount) => {
        if (!cancelled && amount > 0) {
          setForm((current) => ({ ...current, amount }))
        }
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [
    baseOutcomeAmount,
    canCreateOutcome,
    form.exchangeRate,
    outcomeModels.length,
    paymentCurrencyCode,
    paymentCurrencyId,
    setForm,
    taskCurrencyCode,
    taskCurrencyId,
  ])

  function updateForm(patch: Partial<OutcomeFormState>) {
    setForm((current) => ({ ...current, ...patch }))
  }

  const resetMovementSearchState = useCallback(() => {
    movementSearchRequestRef.current += 1

    if (movementSearchTimeoutRef.current) {
      window.clearTimeout(movementSearchTimeoutRef.current)
      movementSearchTimeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!canCreateOutcome) {
      resetMovementSearchState()
    }
  }, [canCreateOutcome, resetMovementSearchState])

  function closeOutcomeForm(): boolean {
    if (outcomeOperation.hasPending()) {
      setError(t('Неможливо закрити форму, доки результат попередньої спроби невідомий. Повторіть без змін.'))
      setConfirmCloseOutcomeOpen(false)
      return false
    }

    resetMovementSearchState()
    setOutcomeModels([])
    setOutcomeRequiresDocuments(true)
    setForm(createInitialOutcomeForm())
    setMovements([])
    setRegisters([])
    setLoadingDictionaries(false)
    setConfirmCloseOutcomeOpen(false)

    return true
  }

  function requestDrawerClose() {
    if (isSaving) {
      return
    }

    if (
      outcomeModels.length > 0 &&
      outcomeOperation.hasPending()
    ) {
      setError(t('Неможливо закрити форму, доки результат попередньої спроби невідомий. Повторіть без змін.'))
      return
    }

    if (outcomeModels.length > 0) {
      setConfirmCloseOutcomeOpen(true)
      return
    }

    setSelectedCashFlowItem(null)
    onClose()
  }

  function confirmDrawerClose() {
    if (isSaving) {
      return
    }

    if (!closeOutcomeForm()) {
      return
    }

    setSelectedCashFlowItem(null)
    onClose()
  }

  function handleMovementSearchChange(nextValue: string) {
    if (!hasPermission(AVAILABLE_PAYMENTS_OUTCOME_CREATE_PERMISSION)) {
      return
    }

    const selectedMovementLabel = getPaymentMovementLabel(selectedMovement)

    updateForm({
      movementSearch: nextValue,
      movementValue: nextValue === selectedMovementLabel ? form.movementValue : '',
    })

    const value = nextValue.trim()
    const requestId = movementSearchRequestRef.current + 1
    movementSearchRequestRef.current = requestId

    if (movementSearchTimeoutRef.current) {
      window.clearTimeout(movementSearchTimeoutRef.current)
    }

    movementSearchTimeoutRef.current = window.setTimeout(() => {
      const request = value ? searchAvailablePaymentMovements(value) : getAvailablePaymentMovements()

      void request
        .then((nextMovements) => {
          if (movementSearchRequestRef.current === requestId) {
            setMovements(nextMovements)
          }
        })
        .catch(() => undefined)
    }, SEARCH_DEBOUNCE_MS)
  }

  const getTaskPaymentProofDocumentCount = useCallback((model: AvailablePaymentTaskModel): number => {
    const taskWithDocuments = buildTaskWithDocumentChanges(
      model,
      filesByTaskId[model.id] || [],
    )

    return countActiveDocuments(taskWithDocuments.SupplyPaymentTaskDocuments)
  }, [filesByTaskId])

  async function handleCreateMovement() {
    if (isSaving) {
      return
    }

    if (
      !hasPermission(AVAILABLE_PAYMENTS_OUTCOME_CREATE_PERMISSION) ||
      !hasPermission(AVAILABLE_PAYMENTS_MOVEMENT_CREATE_PERMISSION)
    ) {
      setError(t('Немає права для створення статті руху коштів'))
      return
    }

    const operationName = form.movementSearch.trim()

    if (!operationName) {
      setError(t('Введіть значення статті руху коштів'))
      return
    }

    const existingMovement = findPaymentMovementByLabel(movements, operationName)

    if (existingMovement) {
      updateForm({
        movementSearch: getPaymentMovementLabel(existingMovement),
        movementValue: getEntityValue(existingMovement),
      })
      return
    }

    setSaving(true)
    setError(null)

    try {
      const createdMovement = await createAvailablePaymentMovement(operationName)

      if (createdMovement) {
        setMovements((current) => includeEntity(current, createdMovement))
        updateForm({
          movementSearch: getPaymentMovementLabel(createdMovement) || operationName,
          movementValue: getEntityValue(createdMovement),
        })
      }
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : t('Не вдалося створити статтю руху коштів'))
    } finally {
      setSaving(false)
    }
  }

  const openOutcomeForm = useCallback((nextModels: AvailablePaymentTaskModel[], options: OutcomeOpenOptions = {}) => {
    if (isSaving) {
      return
    }

    if (!hasPermission(AVAILABLE_PAYMENTS_OUTCOME_CREATE_PERMISSION)) {
      setError(t('Немає права для створення видаткового ордера'))
      return
    }

    const payableModels = uniqueOutcomeModels(nextModels)
    const shouldRequireDocuments = options.requireDocuments ?? true

    if (payableModels.length === 0) {
      setError(t('Немає платіжних задач для створення видаткового ордера'))
      return
    }

    const groupValidationError = validateAvailablePaymentSelection(payableModels, t)

    if (groupValidationError) {
      setError(groupValidationError)
      return
    }

    if (
      shouldRequireDocuments &&
      payableModels.some((model) => getTaskPaymentProofDocumentCount(model) === 0)
    ) {
      setError(t('Додайте хоча б один документ до кожної платіжної задачі'))
      return
    }

    resetMovementSearchState()
    setOutcomeModels(payableModels)
    setOutcomeRequiresDocuments(shouldRequireDocuments)
    setForm(createInitialOutcomeForm(payableModels))
    setError(null)
  }, [
    getTaskPaymentProofDocumentCount,
    hasPermission,
    isSaving,
    resetMovementSearchState,
    setError,
    setForm,
    setOutcomeModels,
    setOutcomeRequiresDocuments,
    t,
  ])

  useEffect(() => {
    if (!outcomeRequest || handledOutcomeRequestKeyRef.current === outcomeRequest.key) {
      return
    }

    handledOutcomeRequestKeyRef.current = outcomeRequest.key
    openOutcomeForm(outcomeRequest.models, { requireDocuments: false })
  }, [openOutcomeForm, outcomeRequest])

  async function loadCashFlow(model: AvailablePaymentTaskModel, filters: CashFlowFilters) {
    if (!hasPermission(AVAILABLE_PAYMENTS_CASH_FLOW_OPEN_PERMISSION)) {
      setError(t('Немає права для перегляду руху коштів'))
      return
    }

    if (!model.serviceAgreementNetId) {
      return
    }

    const requestId = (cashFlowRequestRef.current[model.id] || 0) + 1
    cashFlowRequestRef.current[model.id] = requestId
    const isCurrentCashFlowRequest = () => cashFlowRequestRef.current[model.id] === requestId
    const filterError = getDateRangeError(filters.from, filters.to)

    if (filterError) {
      setCashFlows((current) => ({
        ...current,
        [model.id]: { data: null, error: filterError, isLoading: false },
      }))
      return
    }

    setCashFlows((current) => ({
      ...current,
      [model.id]: { data: null, error: null, isLoading: true },
    }))

    try {
      const result = await getAvailablePaymentAccountingCashFlow({
        from: filters.from,
        netId: model.serviceAgreementNetId,
        to: filters.to,
        typePaymentTask,
      })

      if (isCurrentCashFlowRequest()) {
        setCashFlows((current) => ({
          ...current,
          [model.id]: { data: result, error: null, isLoading: false },
        }))
      }
    } catch (cashFlowError) {
      if (isCurrentCashFlowRequest()) {
        setCashFlows((current) => ({
          ...current,
          [model.id]: {
            data: null,
            error: cashFlowError instanceof Error ? cashFlowError.message : t('Не вдалося завантажити рух коштів'),
            isLoading: false,
          },
        }))
      }
    }
  }

  async function handleCashFlowTab(model: AvailablePaymentTaskModel, tab: string | null) {
    if (tab === 'cash-flow' && !hasPermission(AVAILABLE_PAYMENTS_CASH_FLOW_OPEN_PERMISSION)) {
      setError(t('Немає права для перегляду руху коштів'))
      return
    }

    const nextTab = resolveTaskDetailTab(
      model,
      tab,
      canOpenCashFlow,
      canCreateOutcome || canMarkTaskAvailable,
    )
    setActiveTabs((current) => ({ ...current, [model.id]: nextTab }))

    if (nextTab !== 'cash-flow' || !model.serviceAgreementNetId || cashFlows[model.id]?.data) {
      return
    }

    const filters = cashFlowFiltersByTaskId[model.id] || createDefaultCashFlowFilters()

    if (!cashFlowFiltersByTaskId[model.id]) {
      setCashFlowFiltersByTaskId((current) => ({ ...current, [model.id]: filters }))
    }

    await loadCashFlow(model, filters)
  }

  function handleCashFlowFiltersChange(model: AvailablePaymentTaskModel, filters: CashFlowFilters) {
    if (!hasPermission(AVAILABLE_PAYMENTS_CASH_FLOW_OPEN_PERMISSION)) {
      return
    }

    setCashFlowFiltersByTaskId((current) => ({ ...current, [model.id]: filters }))
    setSelectedCashFlowItem(null)
    void loadCashFlow(model, filters)
  }

  async function handleMoveToDone(model: AvailablePaymentTaskModel) {
    if (isSaving) {
      return
    }

    if (!hasPermission(AVAILABLE_PAYMENTS_TASK_MARK_AVAILABLE_PERMISSION)) {
      setError(t('Немає права переводити платіжну задачу в оплату'))
      return
    }

    const localFiles = filesByTaskId[model.id] || []
    const taskWithDocuments = buildTaskWithDocumentChanges(
      model,
      localFiles,
    )

    if (countActiveDocuments(taskWithDocuments.SupplyPaymentTaskDocuments) === 0) {
      setError(t('Додайте хоча б один документ'))
      return
    }

    setSaving(true)
    setError(null)

    try {
      await setAvailablePaymentTaskToActive(taskWithDocuments, localFiles)
      notifications.show({ color: 'green', message: t('Платіжну задачу оновлено') })

      const taskNetId = String(model.task.NetUid || '')
      const updatedTask = taskNetId ? await getAvailablePaymentTaskByNetId(taskNetId).catch(() => null) : null

      if (updatedTask) {
        onTaskUpdated(model.id, updatedTask)
      } else {
        onChanged()
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося оновити платіжну задачу'))
    } finally {
      setSaving(false)
    }
  }

  async function handleMergeMarked(models: AvailablePaymentTaskModel[]) {
    if (isSaving) {
      return
    }

    if (!hasPermission(AVAILABLE_PAYMENTS_TASK_MERGE_PERMISSION)) {
      setError(t('Немає права об’єднувати платіжні задачі'))
      return
    }

    const mergeValidationError = validateAvailablePaymentMerge(models, t)

    if (mergeValidationError) {
      setError(mergeValidationError)
      return
    }

    setSaving(true)
    setError(null)

    try {
      await mergeAvailablePaymentTasks(uniqueTaskModels(models).map((model) => model.task))
      notifications.show({ color: 'green', message: t('Платіжні задачі об’єднано') })
      onClearMarked()
      onChanged()
    } catch (mergeError) {
      setError(mergeError instanceof Error ? mergeError.message : t('Не вдалося об’єднати платіжні задачі'))
    } finally {
      setSaving(false)
    }
  }

  function handleRedirectToSource(model: AvailablePaymentTaskModel) {
    const route = getAvailablePaymentSourceRoute(model)

    if (route) {
      navigate(route)
    }
  }

  function handleCashFlowRowClick(item: AccountingCashFlowHeadItem) {
    if (!hasPermission(AVAILABLE_PAYMENTS_CASH_FLOW_OPEN_PERMISSION)) {
      return
    }

    const route = getAccountingCashFlowDrilldownRoute(item)

    if (route) {
      navigate(route)
      return
    }

    setSelectedCashFlowItem(item)
  }

  async function handleCreateOutcome(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isSaving) {
      return
    }

    if (!hasPermission(AVAILABLE_PAYMENTS_OUTCOME_CREATE_PERMISSION)) {
      setError(t('Немає права для створення видаткового ордера'))
      return
    }

    const validationError = validateAvailablePaymentOutcomeForm({
      amount: form.amount,
      date: form.date,
      outcomeModels,
      selectedCurrencyRegister,
      selectedMovement,
      selectedOrganization,
      selectedRegister,
      t,
      time: form.time,
    })

    if (validationError) {
      setError(validationError)
      return
    }

    const selectionValidationError = validateAvailablePaymentSelection(outcomeModels, t)

    if (selectionValidationError) {
      setError(selectionValidationError)
      return
    }

    if (
      outcomeRequiresDocuments &&
      outcomeModels.some((model) => getTaskPaymentProofDocumentCount(model) === 0)
    ) {
      setError(t('Додайте хоча б один документ до кожної платіжної задачі'))
      return
    }

    const documents = outcomeModels.flatMap((model) => filesByTaskId[model.id] || [])
    const modelsWithDocuments = outcomeModels.map((model) => ({
      ...model,
      task: buildTaskWithDocumentChanges(
        model,
        filesByTaskId[model.id] || [],
      ),
    }))
    const request: AvailablePaymentOutcomeRequest = {
      amount: form.amount,
      comment: form.comment.trim(),
      customNumber: form.customNumber.trim(),
      documents,
      exchangeRate: form.exchangeRate,
      fromDate: toIsoDateTime(form.date, form.time),
      isAccounting: form.isAccounting,
      isManagementAccounting: form.isManagementAccounting,
      models: modelsWithDocuments,
      organization: selectedOrganization as AvailablePaymentsOrganization,
      paymentPurpose: form.paymentPurpose.trim(),
      selectedCurrencyRegister: selectedCurrencyRegister as AvailablePaymentCurrencyRegister,
      selectedMovement: selectedMovement as AvailablePaymentMovement,
      selectedRegister: selectedRegister as AvailablePaymentRegister,
    }
    let operationId: string

    setSaving(true)
    setError(null)

    try {
      operationId = await outcomeOperation.getOrCreate(request)
    } catch {
      setError(t('Попередня спроба має невизначений результат. Повторіть її без змін.'))
      setSaving(false)
      return
    }

    try {
      await createAvailablePaymentOutcome(request, { operationId })
      outcomeOperation.complete(operationId)
      notifications.show({ color: 'green', message: t('Видатковий ордер створено') })
      closeOutcomeForm()
      onClearMarked()
      onChanged()
    } catch (saveError) {
      outcomeOperation.handleFailure(operationId, saveError)
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося створити видатковий ордер'))
    } finally {
      setSaving(false)
    }
  }

  const title = group
    ? `${t('Наявні платежі')} - ${formatDate(group.PayToDate)}`
    : outcomeModels.length > 0
      ? t('Створити видатковий')
      : t('Наявні платежі')

  return {
    activeTabs,
    canCreateMovement,
    canCreateOutcome,
    canMarkTaskAvailable,
    canMergeTasks,
    canOpenCashFlow,
    cashFlowFiltersByTaskId,
    cashFlows,
    confirmCloseOutcomeOpen,
    error,
    filesByTaskId,
    filteredRegisters,
    form,
    group,
    isLoadingDictionaries,
    isSaving,
    markedModels,
    markedTaskIds,
    models,
    movements,
    outcomeModels,
    registers,
    selectedCashFlowItem,
    selectedMovement,
    selectedOrganization,
    selectedRegister,
    title,
    closeOutcomeForm,
    confirmDrawerClose,
    handleCashFlowFiltersChange,
    handleCashFlowRowClick,
    handleCashFlowTab,
    handleCreateOutcome,
    handleCreateMovement,
    handleMovementSearchChange,
    handleMergeMarked,
    handleMoveToDone,
    handleRedirectToSource,
    onClearMarked,
    onFilesChanged,
    onToggleMarked,
    openOutcomeForm,
    requestDrawerClose,
    setConfirmCloseOutcomeOpen,
    setSelectedCashFlowItem,
    updateForm,
  }
}

type AvailablePaymentsDetailDrawerModel = ReturnType<typeof useAvailablePaymentsDetailDrawerModel>

function AvailablePaymentsDetailDrawerView({ model }: { model: AvailablePaymentsDetailDrawerModel }) {
  const { t } = useI18n()
  const {
    activeTabs,
    canCreateMovement,
    canCreateOutcome,
    canMarkTaskAvailable,
    canMergeTasks,
    canOpenCashFlow,
    cashFlowFiltersByTaskId,
    cashFlows,
    confirmCloseOutcomeOpen,
    error,
    filesByTaskId,
    filteredRegisters,
    form,
    group,
    isLoadingDictionaries,
    isSaving,
    markedModels,
    markedTaskIds,
    models,
    movements,
    outcomeModels,
    registers,
    selectedCashFlowItem,
    selectedMovement,
    selectedOrganization,
    selectedRegister,
    title,
    closeOutcomeForm,
    confirmDrawerClose,
    handleCashFlowFiltersChange,
    handleCashFlowRowClick,
    handleCashFlowTab,
    handleCreateOutcome,
    handleCreateMovement,
    handleMovementSearchChange,
    handleMergeMarked,
    handleMoveToDone,
    handleRedirectToSource,
    onClearMarked,
    onFilesChanged,
    onToggleMarked,
    openOutcomeForm,
    requestDrawerClose,
    setConfirmCloseOutcomeOpen,
    setSelectedCashFlowItem,
    updateForm,
  } = model

  return (
    <AppDrawer
      opened={Boolean(group) || outcomeModels.length > 0}
      position="right"
      size="full"
      title={title}
      onClose={requestDrawerClose}
      footer={
        outcomeModels.length > 0 && canCreateOutcome ? (
          <Group gap="xs">
            <Button color="gray" disabled={isSaving} type="button" variant="light" onClick={closeOutcomeForm}>
              {t('Скасувати')}
            </Button>
            <Button
              color={CREATE_ACTION_COLOR}
              disabled={isLoadingDictionaries}
              form="available-payment-outcome-form"
              leftSection={<Save size={16} />}
              loading={isSaving}
              type="submit"
            >
              {t('Створити')}
            </Button>
          </Group>
        ) : null
      }
    >
      <Stack gap="md">
        {error && (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}

        {group && (
          models.length === 0 ? (
            <Text c="dimmed" size="sm">
              {t('Платіжних задач не знайдено')}
            </Text>
          ) : (
            <AvailablePaymentTaskList
              activeTabs={activeTabs}
              canCreateOutcome={canCreateOutcome}
              canMarkTaskAvailable={canMarkTaskAvailable}
              canMergeTasks={canMergeTasks}
              canOpenCashFlow={canOpenCashFlow}
              cashFlowFiltersByTaskId={cashFlowFiltersByTaskId}
              cashFlows={cashFlows}
              filesByTaskId={filesByTaskId}
              isSaving={isSaving}
              markedModels={markedModels}
              markedTaskIds={markedTaskIds}
              models={models}
              onCashFlowTab={handleCashFlowTab}
              onCashFlowFiltersChange={handleCashFlowFiltersChange}
              onCashFlowRowClick={handleCashFlowRowClick}
              onClearMarked={onClearMarked}
              onCreateOutcome={openOutcomeForm}
              onFilesChanged={onFilesChanged}
              onMergeMarked={handleMergeMarked}
              onMoveToDone={handleMoveToDone}
              onRedirectToSource={handleRedirectToSource}
              onToggleMarked={onToggleMarked}
            />
          )
        )}

        {outcomeModels.length > 0 && canCreateOutcome && (
          <AvailablePaymentOutcomeForm
            canCreateMovement={canCreateMovement}
            filteredRegisters={filteredRegisters}
            form={form}
            isLoadingDictionaries={isLoadingDictionaries}
            isSaving={isSaving}
            movements={movements}
            outcomeModels={outcomeModels}
            registers={registers}
            selectedMovement={selectedMovement}
            selectedOrganization={selectedOrganization}
            selectedRegister={selectedRegister}
            onCreateMovement={handleCreateMovement}
            onMovementSearchChange={handleMovementSearchChange}
            onSubmit={handleCreateOutcome}
            updateForm={updateForm}
          />
        )}

        <AppModal
          centered
          opened={confirmCloseOutcomeOpen}
          title={t('Є незбережені зміни')}
          onClose={() => {
            if (!isSaving) {
              setConfirmCloseOutcomeOpen(false)
            }
          }}
        >
          <Stack gap="md">
            <Text>{t('Якщо закрити вікно, дані видаткового ордера не будуть збережені.')}</Text>
            <Group justify="flex-end">
              <Button color="gray" disabled={isSaving} variant="light" onClick={() => setConfirmCloseOutcomeOpen(false)}>
                {t('Залишитися')}
              </Button>
              <Button color="red" disabled={isSaving} onClick={confirmDrawerClose}>
                {t('Закрити без збереження')}
              </Button>
            </Group>
          </Stack>
        </AppModal>

        {canOpenCashFlow && (
          <AvailablePaymentCashFlowDetailDrawer
            item={selectedCashFlowItem}
            onClose={() => setSelectedCashFlowItem(null)}
          />
        )}
      </Stack>
    </AppDrawer>
  )
}

function AvailablePaymentTaskList({
  activeTabs,
  canCreateOutcome,
  canMarkTaskAvailable,
  canMergeTasks,
  canOpenCashFlow,
  cashFlowFiltersByTaskId,
  cashFlows,
  filesByTaskId,
  isSaving,
  markedModels,
  markedTaskIds,
  models,
  onCashFlowTab,
  onCashFlowFiltersChange,
  onCashFlowRowClick,
  onClearMarked,
  onCreateOutcome,
  onFilesChanged,
  onMergeMarked,
  onMoveToDone,
  onRedirectToSource,
  onToggleMarked,
}: {
  activeTabs: Record<string, TaskDetailTab>
  canCreateOutcome: boolean
  canMarkTaskAvailable: boolean
  canMergeTasks: boolean
  canOpenCashFlow: boolean
  cashFlowFiltersByTaskId: Record<string, CashFlowFilters>
  cashFlows: Record<string, CashFlowState>
  filesByTaskId: Record<string, File[]>
  isSaving: boolean
  markedModels: AvailablePaymentTaskModel[]
  markedTaskIds: string[]
  models: AvailablePaymentTaskModel[]
  onCashFlowTab: (model: AvailablePaymentTaskModel, tab: string | null) => Promise<void>
  onCashFlowFiltersChange: (model: AvailablePaymentTaskModel, filters: CashFlowFilters) => void
  onCashFlowRowClick: (item: AccountingCashFlowHeadItem) => void
  onClearMarked: () => void
  onCreateOutcome: (models: AvailablePaymentTaskModel[], options?: OutcomeOpenOptions) => void
  onFilesChanged: (taskId: string, files: File[]) => void
  onMergeMarked: (models: AvailablePaymentTaskModel[]) => Promise<void>
  onMoveToDone: (model: AvailablePaymentTaskModel) => Promise<void>
  onRedirectToSource: (model: AvailablePaymentTaskModel) => void
  onToggleMarked: (model: AvailablePaymentTaskModel) => void
}) {
  const { t } = useI18n()
  const markedTaskIdSet = useMemo(() => new Set(markedTaskIds), [markedTaskIds])
  const canSelectTasks = canCreateOutcome || canMergeTasks
  const markedSelectionError = markedModels.length > 0 ? validateAvailablePaymentSelection(markedModels, t) : null
  const markedMergeError = markedModels.length > 0 ? validateAvailablePaymentMerge(markedModels, t) : null
  const columns = useMemo<DataTableColumn<AvailablePaymentTaskModel>[]>(
    () => {
      const nextColumns: DataTableColumn<AvailablePaymentTaskModel>[] = [
      {
        id: 'selection',
        header: '',
        width: 52,
        minWidth: 52,
        maxWidth: 52,
        align: 'center',
        enableHiding: false,
        enablePinning: false,
        enableReorder: false,
        enableResizing: false,
        cell: (taskModel) => {
          const isMarked = markedTaskIdSet.has(taskModel.id)
          const paymentSelectionError = isMarked
            ? null
            : getAvailablePaymentSelectionError(markedModels, taskModel, t)
          const mergeSelectionError = isMarked
            ? null
            : getAvailablePaymentMergeError(markedModels, taskModel, t)
          const selectionError = paymentSelectionError && mergeSelectionError
            ? `${paymentSelectionError}. ${mergeSelectionError}`
            : null

          return (
            <Tooltip disabled={!selectionError} label={selectionError}>
              <span className="available-payment-task-list__checkbox">
                <Checkbox
                  checked={isMarked}
                  aria-label={t('Вибрати платіжну задачу')}
                  disabled={isSaving || Boolean(selectionError)}
                  onChange={() => onToggleMarked(taskModel)}
                />
              </span>
            </Tooltip>
          )
        },
      },
      {
        id: 'name',
        header: t('Контрагент'),
        accessor: (taskModel) => taskModel.organizationName,
        minWidth: 320,
        cell: (taskModel) => (
          <div className="available-payment-task-list__identity">
            <span
              className="available-payment-task-list__name"
              title={taskModel.organizationName || t('Назва')}
            >
              {taskModel.organizationName || t('Назва')}
            </span>
            <div className="available-payment-task-list__badge-row">
              <TaskStatusBadge task={taskModel.task} />
            </div>
          </div>
        ),
      },
      {
        id: 'text',
        header: t('Документ / товар'),
        accessor: (taskModel) => taskModel.serviceName,
        minWidth: 420,
        fill: true,
        cell: (taskModel) => {
          const serviceNumber = taskModel.serviceNumber ? displayValue(taskModel.serviceNumber) : ''
          const taskText = taskModel.serviceName

          return (
            <div className="available-payment-task-list__identity">
              <span
                className="available-payment-task-list__name"
                title={taskText}
              >
                {taskText}
              </span>
              {serviceNumber && (
                <Badge
                  className="app-role-pill is-gray available-payment-task-list__product"
                  size="xs"
                  title={serviceNumber}
                  variant="light"
                >
                  {serviceNumber}
                </Badge>
              )}
            </div>
          )
        },
      },
      {
        id: 'amount',
        header: t('Сума'),
        accessor: (taskModel) => getModelPaymentAmount(taskModel),
        width: 170,
        minWidth: 150,
        align: 'right',
        cell: (taskModel) => (
          <div className="available-payment-task-list__amount">
            <span className="app-money">{formatAmount(getModelPaymentAmount(taskModel))}</span>
            <span className="app-money-meta">{taskModel.currencyCode}</span>
          </div>
        ),
      },
      {
        id: 'actions',
        header: '',
        width: 52,
        minWidth: 52,
        maxWidth: 52,
        align: 'right',
        rowActions: true,
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        cell: (taskModel) => (
          <RedirectToSourceButton model={taskModel} onRedirectToSource={onRedirectToSource} />
        ),
      },
      ]

      return canSelectTasks
        ? nextColumns
        : nextColumns.filter((column) => column.id !== 'selection')
    },
    [
      canSelectTasks,
      isSaving,
      markedModels,
      markedTaskIdSet,
      onRedirectToSource,
      onToggleMarked,
      t,
    ],
  )

  return (
    <Stack className="available-payment-task-list" gap="sm">
      {markedModels.length > 0 && canSelectTasks && (
        <div className="available-payment-task-list__selection">
          <Group gap="sm" justify="space-between" wrap="wrap">
            <Group gap="xs">
              <Info aria-hidden="true" size={16} />
              <Text className="available-payment-task-list__selection-label" size="sm">
                {t('Вибрано платіжних задач')}: {markedModels.length}
              </Text>
            </Group>
            <Group gap="xs" wrap="wrap">
              {canCreateOutcome && (
                <Tooltip disabled={!markedSelectionError} label={markedSelectionError}>
                  <span>
                    <Button
                      color={CREATE_ACTION_COLOR}
                      disabled={isSaving || Boolean(markedSelectionError)}
                      size="xs"
                      onClick={() => onCreateOutcome(markedModels, { requireDocuments: false })}
                    >
                      {t('Створити видатковий')}
                    </Button>
                  </span>
                </Tooltip>
              )}
              {canMergeTasks && (
                <Tooltip disabled={!markedMergeError} label={markedMergeError}>
                  <span>
                    <Button
                      disabled={isSaving || Boolean(markedMergeError)}
                      leftSection={<GitMerge size={15} />}
                      size="xs"
                      variant="default"
                      onClick={() => void onMergeMarked(markedModels)}
                    >
                      {t('Об’єднати задачі')}
                    </Button>
                  </span>
                </Tooltip>
              )}
              <Button color="gray" disabled={isSaving} size="xs" variant="subtle" onClick={onClearMarked}>
                {t('Очистити')}
              </Button>
            </Group>
          </Group>
        </div>
      )}

      <DataTable
        columns={columns}
        data={models}
        defaultLayout={{ density: 'normal' }}
        expandColumnLabels={{
          collapseRow: t('Згорнути деталі'),
          expandRow: t('Розгорнути деталі'),
        }}
        footer={<AvailablePaymentTaskListFooter models={models} />}
        getRowId={(taskModel) => taskModel.id}
        layoutVersion={2}
        maxHeight="calc(100vh - 160px)"
        minWidth={760}
        showDensityToggle={false}
        showLayoutControls={false}
        tableId="available-payments-detail-tasks"
        renderExpandedRow={(taskModel) => (
          <AvailablePaymentTaskDetails
            activeTab={resolveTaskDetailTab(
              taskModel,
              activeTabs[taskModel.id],
              canOpenCashFlow,
              canCreateOutcome || canMarkTaskAvailable,
            )}
            canCreateOutcome={canCreateOutcome}
            canMarkTaskAvailable={canMarkTaskAvailable}
            canOpenCashFlow={canOpenCashFlow}
            cashFlowFilters={cashFlowFiltersByTaskId[taskModel.id] || createDefaultCashFlowFilters()}
            cashFlowState={cashFlows[taskModel.id]}
            files={filesByTaskId[taskModel.id] || []}
            isSaving={isSaving}
            model={taskModel}
            onCashFlowFiltersChange={(filters) => onCashFlowFiltersChange(taskModel, filters)}
            onCashFlowRowClick={onCashFlowRowClick}
            onCreateOutcome={() => onCreateOutcome([taskModel])}
            onFilesChanged={(files) => onFilesChanged(taskModel.id, files)}
            onMoveToDone={() => void onMoveToDone(taskModel)}
            onTabChange={(tab) => void onCashFlowTab(taskModel, tab)}
          />
        )}
      />
    </Stack>
  )
}

function AvailablePaymentTaskDetails({
  activeTab,
  canCreateOutcome,
  canMarkTaskAvailable,
  canOpenCashFlow,
  cashFlowFilters,
  cashFlowState,
  files,
  isSaving,
  model,
  onCashFlowFiltersChange,
  onCashFlowRowClick,
  onCreateOutcome,
  onFilesChanged,
  onMoveToDone,
  onTabChange,
}: {
  activeTab: TaskDetailTab
  canCreateOutcome: boolean
  canMarkTaskAvailable: boolean
  canOpenCashFlow: boolean
  cashFlowFilters: CashFlowFilters
  cashFlowState?: CashFlowState
  files: File[]
  isSaving: boolean
  model: AvailablePaymentTaskModel
  onCashFlowFiltersChange: (filters: CashFlowFilters) => void
  onCashFlowRowClick: (item: AccountingCashFlowHeadItem) => void
  onCreateOutcome: () => void
  onFilesChanged: (files: File[]) => void
  onMoveToDone: () => void
  onTabChange: (tab: TaskDetailTab) => void
}) {
  const { t } = useI18n()
  const tabs = getTaskDetailTabs(
    model,
    canOpenCashFlow,
    canCreateOutcome || canMarkTaskAvailable,
  )

  return (
    <div className="available-payment-task-details">
      <div
        aria-label={t('Розділи платіжної задачі')}
        className="pill-tabs"
        role="tablist"
      >
        {tabs.map((tab) => (
          <button
            key={tab}
            aria-selected={activeTab === tab}
            className={`pill-tab${activeTab === tab ? ' is-active' : ''}`}
            role="tab"
            type="button"
            onClick={() => onTabChange(tab)}
          >
            {getTaskDetailTabLabel(tab, t)}
          </button>
        ))}
      </div>

      <div className="available-payment-task-details__content">
        {model.isUnsupported && (
          <Alert color="orange" icon={<CircleAlert size={18} />} variant="light">
            {t(
              'Немає підтриманого джерела для цієї платіжної задачі. Створення видаткового ордера заблоковано.',
            )}
          </Alert>
        )}

        {activeTab === 'invoice' && <InvoiceTab model={model} />}
        {activeTab === 'cash-flow' && (
          <CashFlowTab
            filters={cashFlowFilters}
            state={cashFlowState}
            onFiltersChange={onCashFlowFiltersChange}
            onRowClick={onCashFlowRowClick}
          />
        )}
        {activeTab === 'payment' && (
          <PaymentTab
            canCreateOutcome={canCreateOutcome}
            canMarkTaskAvailable={canMarkTaskAvailable}
            files={files}
            isSaving={isSaving}
            model={model}
            onCreateOutcome={onCreateOutcome}
            onFilesChanged={onFilesChanged}
            onMoveToDone={onMoveToDone}
          />
        )}
        {activeTab === 'transfer' && <TransferTab model={model} />}
      </div>
    </div>
  )
}

function AvailablePaymentTaskListFooter({ models }: { models: AvailablePaymentTaskModel[] }) {
  const { t } = useI18n()
  const totals = Array.from(
    models.reduce((result, model) => {
      const currency = model.currencyCode || ''
      result.set(currency, (result.get(currency) || 0) + getModelPaymentAmount(model))
      return result
    }, new Map<string, number>()),
  )

  return (
    <Group className="available-payment-task-list__footer" gap="xs" justify="flex-end" wrap="nowrap">
      <Badge className="app-role-pill is-gray" size="xs" variant="light">
        {t('Всього')}: {models.length}
      </Badge>
      {totals.map(([currency, amount]) => (
        <Badge key={currency || 'total'} className="app-role-pill is-gray" size="xs" variant="light">
          <span className="app-money">{formatAmount(amount)} {currency}</span>
        </Badge>
      ))}
    </Group>
  )
}

function getTaskDetailTabs(
  model: AvailablePaymentTaskModel,
  canOpenCashFlow = true,
  canUsePayment = true,
): TaskDetailTab[] {
  const tabs: TaskDetailTab[] =
    model.serviceAgreementNetId && canOpenCashFlow
      ? ['invoice', 'cash-flow']
      : ['invoice']

  if (model.task.TaskStatus === TaskStatusValue.Done) {
    return [...tabs, 'transfer']
  }

  if (model.isUnsupported) {
    return tabs
  }

  return canUsePayment ? [...tabs, 'payment'] : tabs
}

function resolveTaskDetailTab(
  model: AvailablePaymentTaskModel,
  tab?: string | null,
  canOpenCashFlow = true,
  canUsePayment = true,
): TaskDetailTab {
  const tabs = getTaskDetailTabs(model, canOpenCashFlow, canUsePayment)

  return tabs.includes(tab as TaskDetailTab) ? tab as TaskDetailTab : 'invoice'
}

function getTaskDetailTabLabel(tab: TaskDetailTab, t: (key: string) => string): string {
  if (tab === 'cash-flow') {
    return t('Рух коштів')
  }

  if (tab === 'payment') {
    return t('Оплата')
  }

  if (tab === 'transfer') {
    return t('Переказ')
  }

  return t('Рахунок')
}

function AvailablePaymentOutcomeForm({
  canCreateMovement,
  filteredRegisters,
  form,
  isLoadingDictionaries,
  isSaving,
  movements,
  outcomeModels,
  registers,
  selectedMovement,
  selectedOrganization,
  selectedRegister,
  onCreateMovement,
  onMovementSearchChange,
  onSubmit,
  updateForm,
}: {
  canCreateMovement: boolean
  filteredRegisters: AvailablePaymentRegister[]
  form: OutcomeFormState
  isLoadingDictionaries: boolean
  isSaving: boolean
  movements: AvailablePaymentMovement[]
  outcomeModels: AvailablePaymentTaskModel[]
  registers: AvailablePaymentRegister[]
  selectedMovement: AvailablePaymentMovement | null
  selectedOrganization: AvailablePaymentsOrganization | null
  selectedRegister: AvailablePaymentRegister | null
  onCreateMovement: () => void
  onMovementSearchChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  updateForm: (patch: Partial<OutcomeFormState>) => void
}) {
  const { t } = useI18n()
  const organizationOptions = getAvailableOrganizations(outcomeModels, registers).map((organization) => ({
    label: organization.Name || organization.FullName || getEntityValue(organization),
    value: getEntityValue(organization),
  }))
  const recipientName =
    outcomeModels[0]?.payForClient?.Name
    || outcomeModels[0]?.payForClient?.FullName
    || selectedOrganization?.Name
    || outcomeModels[0]?.organization?.Name
    || ''
  const baseOutcomeAmount = outcomeModels.reduce((sum, model) => sum + (model.paymentAmount ?? model.grossPrice ?? 0), 0)
  const taskCurrencyCode = outcomeModels[0]?.currencyCode || ''
  const selectedCurrencyRegister =
    (selectedRegister?.PaymentCurrencyRegisters || []).find((currencyRegister) => getEntityValue(currencyRegister) === form.selectedCurrencyValue) || null

  return (
    <form id="available-payment-outcome-form" onSubmit={onSubmit}>
      <Stack gap="md" p="md" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 8 }}>
        <Group justify="space-between">
          <Text className="app-section-title" fw={600}>
            {t('Новий видатковий ордер')}
          </Text>
          <Badge variant="light">{outcomeModels.length}</Badge>
        </Group>

        {isLoadingDictionaries ? (
          <Group justify="center" py="md">
            <Loader size="sm" />
          </Group>
        ) : (
          <>
            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <InfoCell label={t('Отримувач')} value={displayValue(recipientName)} />
              <InfoCell
                label={t('Сума до оплати')}
                mono
                value={`${formatAmount(baseOutcomeAmount)} ${taskCurrencyCode}`.trim()}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, md: 3 }}>
              <TextInput
                disabled={isSaving}
                label={t('Номер')}
                value={form.customNumber}
                onChange={(event) => updateForm({ customNumber: event.currentTarget.value })}
              />
              <TextInput
                disabled={isSaving}
                label={t('Від якої дати')}
                type="date"
                value={form.date}
                onChange={(event) => updateForm({ date: event.currentTarget.value })}
              />
              <TextInput
                disabled={isSaving}
                label={t('Час')}
                type="time"
                value={form.time}
                onChange={(event) => updateForm({ time: event.currentTarget.value })}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, md: 3 }}>
              <Select
                data={organizationOptions}
                disabled={isSaving}
                label={t('Організація')}
                searchable
                value={form.organizationValue || null}
                onChange={(value) => {
                  const organization =
                    getAvailableOrganizations(outcomeModels, registers).find(
                      (item) => getEntityValue(item) === value,
                    ) || null
                  const nextRegister = selectDefaultRegister(registers, organization)
                  const nextCurrency = nextRegister?.PaymentCurrencyRegisters?.[0] || null

                  updateForm({
                    organizationValue: value || '',
                    registerValue: nextRegister ? getEntityValue(nextRegister) : '',
                    selectedCurrencyValue: nextCurrency ? getEntityValue(nextCurrency) : '',
                  })
                }}
              />
              <Select
                data={filteredRegisters.map((register) => ({
                  label: register.Name || getEntityValue(register),
                  value: getEntityValue(register),
                }))}
                disabled={isSaving || !selectedOrganization}
                label={t('Грошові рахунки')}
                searchable
                value={form.registerValue || null}
                onChange={(value) => {
                  const register = filteredRegisters.find((item) => getEntityValue(item) === value) || null
                  const currencyRegister = register?.PaymentCurrencyRegisters?.[0] || null

                  updateForm({
                    registerValue: value || '',
                    selectedCurrencyValue: currencyRegister ? getEntityValue(currencyRegister) : '',
                  })
                }}
              />
              <Stack gap={6}>
                <Select
                  data={(selectedRegister?.PaymentCurrencyRegisters || []).map((currencyRegister) => ({
                    label: currencyRegister.Currency?.Code || currencyRegister.Currency?.Name || getEntityValue(currencyRegister),
                    value: getEntityValue(currencyRegister),
                  }))}
                  disabled={isSaving || !selectedRegister}
                  label={t('Валюта')}
                  searchable
                  value={form.selectedCurrencyValue || null}
                  onChange={(value) => updateForm({ selectedCurrencyValue: value || '' })}
                />
                {selectedCurrencyRegister && (
                  <Text c="dimmed" size="xs">
                    {t('Залишки')}: {' '}
                    <span className="app-money">
                      {`${formatAmount(selectedCurrencyRegister.Amount)} ${selectedCurrencyRegister.Currency?.Code || ''}`.trim()}
                    </span>
                  </Text>
                )}
              </Stack>
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, md: 3 }}>
              <NumberInput
                allowNegative={false}
                decimalScale={2}
                disabled={isSaving}
                label={t('Сума')}
                min={0}
                value={form.amount}
                onChange={(value) => updateForm({ amount: toNumber(value) })}
              />
              <NumberInput
                allowNegative={false}
                decimalScale={4}
                disabled={isSaving}
                label={t('Курс обміну')}
                min={0}
                value={form.exchangeRate}
                onChange={(value) => updateForm({ exchangeRate: toNumber(value) })}
              />
              <NumberInput
                allowNegative={false}
                decimalScale={2}
                disabled={isSaving}
                label={t('Ставка ПДВ')}
                min={0}
                value={form.vatRate}
                onChange={(value) => updateForm({ vatRate: toNumber(value) })}
              />
              <NumberInput
                decimalScale={2}
                label={t('Сума ПДВ')}
                readOnly
                value={calculateVatAmount(form.amount, form.vatRate)}
              />
              <Stack gap={6}>
                <Select
                  data={movements.map((movement) => ({
                    label: getPaymentMovementLabel(movement),
                    value: getEntityValue(movement),
                  }))}
                  disabled={isSaving}
                  label={t('Статті руху грошових коштів')}
                  searchable
                  searchValue={form.movementSearch}
                  value={form.movementValue || null}
                  onChange={(value) => {
                    const movement = movements.find((item) => getEntityValue(item) === value) || null

                    updateForm({
                      movementSearch: getPaymentMovementLabel(movement),
                      movementValue: value || '',
                    })
                  }}
                  onSearchChange={onMovementSearchChange}
                />
                {canCreateMovement && (
                  <Button
                    disabled={isSaving || Boolean(selectedMovement) || !form.movementSearch.trim()}
                    leftSection={<Plus size={16} />}
                    size="xs"
                    type="button"
                    onClick={onCreateMovement}
                  >
                    {t('Створити статтю')}
                  </Button>
                )}
              </Stack>
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <TextInput
                disabled={isSaving}
                label={t('Призначення платежу')}
                value={form.paymentPurpose}
                onChange={(event) => updateForm({ paymentPurpose: event.currentTarget.value })}
              />
              <Textarea
                disabled={isSaving}
                label={t('Коментар')}
                value={form.comment}
                onChange={(event) => updateForm({ comment: event.currentTarget.value })}
              />
            </SimpleGrid>

            <Group gap="lg">
              <Checkbox
                checked={form.isManagementAccounting}
                disabled={isSaving}
                label={t('Управлінський облік')}
                onChange={(event) => updateForm({ isManagementAccounting: event.currentTarget.checked })}
              />
              <Checkbox
                checked={form.isAccounting}
                disabled={isSaving}
                label={t('Бухгалтерський облік')}
                onChange={(event) => updateForm({ isAccounting: event.currentTarget.checked })}
              />
            </Group>

          </>
        )}
      </Stack>
    </form>
  )
}

function InvoiceTab({ model }: { model: AvailablePaymentTaskModel }) {
  const { t } = useI18n()
  const columns = useMemo<DataTableColumn<AvailablePaymentTaskRow>[]>(
    () =>
      model.columns.map((column, columnIndex) => {
        const isLastColumn = columnIndex === model.columns.length - 1
        const isNumericColumn = column.align === 'right'

        return {
          id: column.key,
          header: column.header,
          accessor: (row) => row[column.key],
          align: isNumericColumn ? 'right' : 'left',
          width: isLastColumn ? 120 : isNumericColumn ? 95 : 120,
          minWidth: isLastColumn ? 108 : isNumericColumn ? 84 : 92,
          fill: columnIndex === Math.min(1, model.columns.length - 1),
          cell: (row) => <InvoiceTableCell column={column} row={row} />,
        }
      }),
    [model.columns],
  )

  if (columns.length === 0) {
    return (
      <Stack gap="md">
        <DocumentsList documents={model.documents} />
        <Text c="dimmed" size="sm">
          {t('Дані рахунку відсутні')}
        </Text>
      </Stack>
    )
  }

  return (
    <Stack gap="md">
      <DocumentsList documents={model.documents} />
      <div className="available-payment-invoice-table">
        <DataTable
          columns={columns}
          data={model.rows}
          defaultLayout={{ density: 'normal' }}
          emptyText={t('Дані рахунку відсутні')}
          getRowId={(row, rowIndex) => getInvoiceRowKey(model, row, rowIndex)}
          layoutVersion={4}
          maxHeight={340}
          minWidth={760}
          showDensityToggle={false}
          showLayoutControls={false}
          tableId={`available-payment-invoice-${model.id}`}
        />
      </div>
      <InvoicePaymentSummary model={model} />
    </Stack>
  )
}

function InvoicePaymentSummary({ model }: { model: AvailablePaymentTaskModel }) {
  const { t } = useI18n()
  const isDone = model.task.TaskStatus === TaskStatusValue.Done

  return (
    <Group justify="flex-end" gap="xs">
      <Text c="dimmed" size="sm">
        {isDone ? t('Оплачено') : t('До оплати')}
      </Text>
      {!isDone && (
        <Text className="available-payment-invoice-total-value" fw={700} size="sm">
          {formatAmount(getModelPaymentAmount(model))} {model.currencyCode}
        </Text>
      )}
    </Group>
  )
}

function InvoiceTableCell({ column, row }: { column: AvailablePaymentColumn; row: AvailablePaymentTaskRow }) {
  const value = row[column.key]

  if (value === null || value === undefined || value === '') {
    return null
  }

  if (column.format === 'date') {
    return <>{formatDate(value as Date | string | undefined)}</>
  }

  if (column.format === 'price') {
    return <>{formatAmount(readFiniteNumber(value))}</>
  }

  return <>{displayValue(value)}</>
}

function CashFlowTab({
  filters,
  state,
  onFiltersChange,
  onRowClick,
}: {
  filters: CashFlowFilters
  state?: CashFlowState
  onFiltersChange: (filters: CashFlowFilters) => void
  onRowClick: (item: AccountingCashFlowHeadItem) => void
}) {
  const { t } = useI18n()
  const filterError = getDateRangeError(filters.from, filters.to)
  const items = useMemo(
    () => extractCashFlowRows(state?.data ?? null).map(toCashFlowTableItem),
    [state?.data],
  )
  const summary = useMemo(
    () => extractCashFlowSummary(state?.data ?? null, items),
    [items, state?.data],
  )
  const columns = useMemo<DataTableColumn<AvailablePaymentCashFlowTableItem>[]>(
    () => [
      {
        id: 'name',
        header: t('Назва'),
        accessor: (item) => item.Name,
        width: 220,
        minWidth: 160,
        fill: true,
        cell: (item) => (
          <Text title={displayValue(item.Name)} truncate style={{ minWidth: 0 }}>
            {displayValue(item.Name)}
          </Text>
        ),
      },
      {
        id: 'date',
        header: t('Дата'),
        accessor: (item) => item.FromDate,
        width: 120,
        minWidth: 96,
        cell: (item) => formatDate(item.FromDate),
      },
      {
        id: 'number',
        header: t('Номер'),
        accessor: (item) => item.Number,
        width: 135,
        minWidth: 108,
        cell: (item) => displayValue(item.Number),
      },
      {
        id: 'paymentStatus',
        header: t('Статус'),
        accessor: (item) => getAccountingCashFlowPaymentStatus(item.source)?.label,
        width: 125,
        minWidth: 100,
        cell: (item) => <CashFlowPaymentStatusBadge item={item.source} />,
      },
      {
        id: 'debit',
        header: t('Дебет'),
        accessor: (item) => item.IsCreditValue ? undefined : item.CurrentValue,
        width: 120,
        minWidth: 96,
        align: 'right',
        cell: (item) => item.IsCreditValue ? null : formatAmount(item.CurrentValue),
      },
      {
        id: 'credit',
        header: t('Кредит'),
        accessor: (item) => item.IsCreditValue ? item.CurrentValue : undefined,
        width: 120,
        minWidth: 96,
        align: 'right',
        cell: (item) => item.IsCreditValue ? formatAmount(item.CurrentValue) : null,
      },
      {
        id: 'balance',
        header: t('Баланс'),
        accessor: (item) => item.CurrentBalance,
        width: 135,
        minWidth: 108,
        align: 'right',
        cell: (item) => formatAmount(item.CurrentBalance),
      },
    ],
    [t],
  )
  const controls = (
    <Group align="end" gap={10} wrap="wrap">
      <TextInput
        label={t('Від')}
        type="date"
        value={filters.from}
        w={150}
        onChange={(event) => onFiltersChange({ ...filters, from: event.currentTarget.value })}
      />
      <TextInput
        label={t('До')}
        type="date"
        value={filters.to}
        w={150}
        onChange={(event) => onFiltersChange({ ...filters, to: event.currentTarget.value })}
      />
    </Group>
  )

  if (filterError) {
    return (
      <Stack gap="md">
        {controls}
        <Alert color="yellow" icon={<CircleAlert size={18} />} variant="light">
          {filterError}
        </Alert>
      </Stack>
    )
  }

  return (
    <Stack gap="md">
      {controls}
      {state?.error && (
        <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
          {state.error}
        </Alert>
      )}
      <div className="available-payment-cash-flow-table">
        <DataTable
          columns={columns}
          data={items}
          defaultLayout={{ density: 'normal' }}
          emptyText={t('Рух коштів відсутній')}
          getRowId={(item) => item.id}
          isLoading={!state || state.isLoading}
          layoutVersion="available-payment-cash-flow-2"
          maxHeight={340}
          minWidth={760}
          showDensityToggle={false}
          showLayoutControls={false}
          tableId="available-payment-cash-flow"
          footer={state?.data ? <CashFlowTableFooter summary={summary} /> : undefined}
          onRowClick={(item) => onRowClick(item.source)}
        />
      </div>
    </Stack>
  )
}

function AvailablePaymentCashFlowDetailDrawer({
  item,
  onClose,
}: {
  item: AccountingCashFlowHeadItem | null
  onClose: () => void
}) {
  const { t } = useI18n()

  return (
    <AppDrawer
      opened={Boolean(item)}
      padding="lg"
      position="right"
      size="min(980px, 100vw)"
      title={item?.Name || t('Деталі руху коштів')}
      onClose={onClose}
    >
      {item && (
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
            <CashFlowDetailValue label={t('Дата')} value={formatDateTime(item.FromDate)} />
            <CashFlowDetailValue label={t('Документ')} value={displayValue(item.Name)} />
            <CashFlowDetailValue label={t('Номер')} value={displayValue(item.Number)} />
            <CashFlowDetailValue label={t('Організація')} value={displayValue(item.OrganizationName)} />
            <CashFlowDetailValue label={t('Операція')} value={item.IsCreditValue ? t('Кредит') : t('Дебет')} />
            <CashFlowDetailValue label={t('Статус накладної')} value={<CashFlowPaymentStatusBadge item={item} />} />
            <CashFlowDetailValue label={t('Сума')} value={formatAmount(item.CurrentValue)} />
            <CashFlowDetailValue label={t('Поточний баланс')} value={formatAmount(item.CurrentBalance)} />
          </SimpleGrid>

          <CashFlowDetailContent item={item} />
        </Stack>
      )}
    </AppDrawer>
  )
}

function CashFlowDetailValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={600} lineClamp={2}>
        {value || '-'}
      </Text>
    </Stack>
  )
}

function CashFlowPaymentStatusBadge({ item }: { item: AccountingCashFlowHeadItem }) {
  const { t } = useI18n()
  const status = getAccountingCashFlowPaymentStatus(item)

  if (!status) {
    return displayValue(undefined)
  }

  return (
    <Badge className={`app-role-pill ${getCashFlowStatusClassName(status.color)}`} size="xs" variant="light">
      {t(status.label)}
    </Badge>
  )
}

function CashFlowTableFooter({ summary }: { summary: AvailablePaymentCashFlowSummary }) {
  const { t } = useI18n()

  return (
    <div aria-label={t('Підсумки руху коштів')} className="available-payment-cash-flow-table__footer">
      <CashFlowSummaryRow
        balance={summary.beforeBalance}
        balanceHint={t('Баланс на початок')}
        credit={summary.beforeOutAmount}
        debit={summary.beforeInAmount}
        label={t('До періоду')}
      />
      <CashFlowSummaryRow
        balance={summary.closingBalance}
        balanceHint={t('Баланс на кінець')}
        credit={summary.afterOutAmount}
        debit={summary.afterInAmount}
        label={t('За період')}
      />
    </div>
  )
}

function CashFlowSummaryRow({
  balance,
  balanceHint,
  credit,
  debit,
  label,
}: {
  balance?: number
  balanceHint: string
  credit?: number
  debit?: number
  label: string
}) {
  return (
    <div className="available-payment-cash-flow-table__summary-row">
      <div className="available-payment-cash-flow-table__summary-label">
        <span>{label}</span>
        <span>{balanceHint}</span>
      </div>
      <span className="available-payment-cash-flow-table__summary-value">{formatAmount(debit)}</span>
      <span className="available-payment-cash-flow-table__summary-value">{formatAmount(credit)}</span>
      <span className={cashFlowSummaryBalanceClassName(balance)}>{formatAmount(balance)}</span>
    </div>
  )
}

function getCashFlowStatusClassName(color: string): string {
  if (color === 'green') {
    return 'is-green'
  }

  if (color === 'red') {
    return 'is-red'
  }

  if (color === 'yellow' || color === 'orange') {
    return 'is-orange'
  }

  return 'is-gray'
}

function cashFlowSummaryBalanceClassName(value?: number): string {
  return [
    'available-payment-cash-flow-table__summary-value',
    typeof value === 'number' && value < 0 ? 'is-negative' : '',
  ].filter(Boolean).join(' ')
}

function toCashFlowTableItem(row: DataRecord, index: number): AvailablePaymentCashFlowTableItem {
  const number = stringOrUndefined(readUnknown(row, ['Number', 'CustomNumber']))
  const name = stringOrUndefined(readUnknown(row, ['Name', 'Type', 'OperationTypeName']))

  return {
    id: `${number || name || 'cash-flow'}-${index}`,
    CurrentBalance: readUnknownNumber(row, ['CurrentBalance']),
    CurrentValue: readUnknownNumber(row, ['CurrentValue', 'Amount', 'Total', 'GrossPrice']),
    FromDate: readUnknownDateString(row, ['FromDate', 'Date', 'Created']),
    IsCreditValue: readUnknown(row, ['IsCreditValue']) === true,
    Name: name,
    Number: number,
    OrganizationName: stringOrUndefined(readUnknown(row, ['OrganizationName'])),
    Type: readUnknownNumber(row, ['Type']),
    source: row as AccountingCashFlowHeadItem,
  }
}

function extractCashFlowSummary(
  data: AvailablePaymentAccountingCashFlow | null,
  items: AvailablePaymentCashFlowTableItem[],
): AvailablePaymentCashFlowSummary {
  const record = asRecord(data)

  return {
    afterInAmount: record ? readUnknownNumber(record, ['AfterRangeInAmount']) : undefined,
    afterOutAmount: record ? readUnknownNumber(record, ['AfterRangeOutAmount']) : undefined,
    beforeBalance: record ? readUnknownNumber(record, ['BeforeRangeBalance']) : undefined,
    beforeInAmount: record ? readUnknownNumber(record, ['BeforeRangeInAmount']) : undefined,
    beforeOutAmount: record ? readUnknownNumber(record, ['BeforeRangeOutAmount']) : undefined,
    closingBalance: items.at(-1)?.CurrentBalance,
  }
}

function readUnknownDateString(record: DataRecord, keys: string[]): string | undefined {
  const value = readUnknownDate(record, keys)

  if (value instanceof Date) {
    return value.toISOString()
  }

  return value
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : undefined
}

function PaymentTab({
  canCreateOutcome,
  canMarkTaskAvailable,
  files,
  isSaving,
  model,
  onCreateOutcome,
  onFilesChanged,
  onMoveToDone,
}: {
  canCreateOutcome: boolean
  canMarkTaskAvailable: boolean
  files: File[]
  isSaving: boolean
  model: AvailablePaymentTaskModel
  onCreateOutcome: () => void
  onFilesChanged: (files: File[]) => void
  onMoveToDone: () => void
}) {
  const { t } = useI18n()
  const isDone = model.task.TaskStatus === TaskStatusValue.Done
  const isUnsupported = Boolean(model.isUnsupported)
  const isAvailableForPayment = model.task.IsAvailableForPayment !== false
  const canManagePaymentDocuments = canCreateOutcome || canMarkTaskAvailable

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        {!isDone && !isUnsupported && canManagePaymentDocuments ? (
          <FileButton multiple onChange={(nextFiles) => onFilesChanged(mergeLocalFiles(files, nextFiles || []))}>
            {(props) => (
              <Button
                {...props}
                color="gray"
                disabled={isSaving}
                leftSection={<FileUp size={16} />}
                variant="light"
              >
                {t('Завантажити файли')}
              </Button>
            )}
          </FileButton>
        ) : isUnsupported ? (
          <Text c="dimmed" size="sm">
            {t('Оплата недоступна для цього типу платіжної задачі')}
          </Text>
        ) : (
          <Text c="dimmed" size="sm">
            {t('Задачу вже виконано')}
          </Text>
        )}
        <Group gap="xs">
          {canMarkTaskAvailable && !isDone && !isUnsupported && !isAvailableForPayment && (
            <Button color="green" disabled={isSaving} loading={isSaving} variant="outline" onClick={onMoveToDone}>
              {t('Перевести в оплату')}
            </Button>
          )}
          {canCreateOutcome && !isDone && (
            <Button
              color={CREATE_ACTION_COLOR}
              disabled={isSaving || isUnsupported || !isAvailableForPayment}
              leftSection={<Banknote size={16} />}
              onClick={onCreateOutcome}
            >
              {t('Створити видатковий')}
            </Button>
          )}
        </Group>
      </Group>
      <DocumentsList
        documents={model.task.SupplyPaymentTaskDocuments || []}
      />
      {files.length > 0 && (
        <>
          <Divider />
          <Stack gap={4}>
            <Text fw={600} size="sm">
              {t('Нові файли')}
            </Text>
            {files.map((file) => (
              <Group key={`${file.name}-${file.size}-${file.lastModified}`} gap="xs" justify="space-between" wrap="nowrap">
                <Text size="sm">{file.name}</Text>
                <Tooltip label={t('Видалити')}>
                  <ActionIcon
                    aria-label={t('Видалити')}
                    color="red"
                    disabled={isSaving}
                    size="sm"
                    variant="subtle"
                    onClick={() => onFilesChanged(files.filter((entry) => getLocalFileKey(entry) !== getLocalFileKey(file)))}
                  >
                    <Trash2 size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            ))}
          </Stack>
        </>
      )}
    </Stack>
  )
}

function TransferTab({ model }: { model: AvailablePaymentTaskModel }) {
  const { t } = useI18n()
  const order = model.paidOrder

  return (
    <Stack gap="md">
      {order ? (
        <SimpleGrid cols={{ base: 1, md: 3 }}>
          <InfoCell label={t('Документ')} value={getTransferOrderTypeLabel(order, t)} />
          <InfoCell label={t('Номер')} value={displayValue(order.Number)} />
          <InfoCell label={t('Дата')} value={formatDateTime(order.FromDate)} />
          <InfoCell
            label={t('Сума')}
            mono
            value={`${formatAmount(order.Amount)} ${order.PaymentCurrencyRegister?.Currency?.Code || ''}`}
          />
          <InfoCell label={t('Рахунок')} value={displayValue(order.PaymentCurrencyRegister?.PaymentRegister?.Name)} />
          <InfoCell label={t('Оплатив')} value={displayValue(order.User?.LastName || order.User?.FullName || order.User?.Name)} />
        </SimpleGrid>
      ) : (
        <Text c="dimmed" size="sm">
          {t('Переказ ще не створено')}
        </Text>
      )}
      <Divider />
      <Stack gap={4}>
        <Text fw={600} size="sm">
          {t('Документи')}
        </Text>
        <DocumentsList documents={model.task.SupplyPaymentTaskDocuments || []} />
      </Stack>
    </Stack>
  )
}

function getTransferOrderTypeLabel(order: AvailablePaymentOrderSummary, t: (key: string) => string): string {
  const registerType = order.PaymentCurrencyRegister?.PaymentRegister?.Type ?? order.PaymentRegister?.Type

  if (registerType === 0) {
    return t('Видатковий касовий ордер')
  }

  if (registerType === 2) {
    return t('Видатковий банківський ордер')
  }

  return t('Видатковий картковий ордер')
}

function InfoCell({ label, mono = false, value }: { label: string; mono?: boolean; value: string }) {
  return (
    <Stack gap={2}>
      <Text c="dimmed" size="xs">
        {label}
      </Text>
      <Text className={mono ? 'app-money' : undefined} fw={600}>{value}</Text>
    </Stack>
  )
}

function RedirectToSourceButton({
  model,
  onRedirectToSource,
}: {
  model: AvailablePaymentTaskModel
  onRedirectToSource: (model: AvailablePaymentTaskModel) => void
}) {
  const { t } = useI18n()
  const canNavigate = Boolean(getAvailablePaymentSourceRoute(model))
  const hasPolandOrder = !canNavigate && Boolean(model.supplyOrderNetUid)

  if (!canNavigate && !hasPolandOrder) {
    return null
  }

  if (hasPolandOrder) {
    return (
      <TableRowAction
        action="open"
        disabled
        hint={t('Перегляд замовлення з Польщі недоступний')}
        label={t('Перейти до замовлення')}
      />
    )
  }

  return (
    <TableRowAction
      action="open"
      label={t('Перейти до замовлення')}
      onClick={() => onRedirectToSource(model)}
    />
  )
}

function DocumentsList({
  documents,
}: {
  documents: AvailablePaymentDocument[]
}) {
  const { t } = useI18n()

  if (documents.length === 0) {
    return (
      <Badge className="app-role-pill is-gray" size="xs" variant="light">
        {t('Документи відсутні')}
      </Badge>
    )
  }

  return (
    <Stack gap={4}>
      {documents.map((document, index) => {
        const key = getDocumentKey(document, index)
        const label = document.FileName || document.Name || t('Документ')
        const url = getDocumentUrl(document)
        const isDeleted = Boolean(document.Deleted)
        const content = url && !isDeleted ? (
          <Anchor key={key} href={upgradeHttpToHttps(url)} rel="noreferrer" size="sm" target="_blank">
            {label}
          </Anchor>
        ) : (
          <Text key={key} c={isDeleted ? 'dimmed' : undefined} size="sm" td={isDeleted ? 'line-through' : undefined}>
            {label}
          </Text>
        )

        return content
      })}
    </Stack>
  )
}

function getDocumentKey(document: AvailablePaymentDocument, index: number): string {
  return String(
    document.NetUid ||
      document.Id ||
      document.FileName ||
      getDocumentUrl(document) ||
      document.Name ||
      `document-${index}`,
  )
}

function getDocumentUrl(document: AvailablePaymentDocument): string | undefined {
  return (
    document.DocumentUrl ||
    document.DocumentURL ||
    document.PdfDocumentURL ||
    document.PdfDocumentUrl ||
    document.URL ||
    document.Url ||
    document.url
  )
}

function mergeLocalFiles(currentFiles: File[], nextFiles: File[]): File[] {
  const filesByKey = new Map(currentFiles.map((file) => [getLocalFileKey(file), file]))

  nextFiles.forEach((file) => filesByKey.set(getLocalFileKey(file), file))

  return Array.from(filesByKey.values())
}

function getLocalFileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`
}

function buildTaskWithDocumentChanges(
  model: AvailablePaymentTaskModel,
  files: File[],
): SupplyPaymentTask {
  return {
    ...model.task,
    SupplyPaymentTaskDocuments: [
      ...(model.task.SupplyPaymentTaskDocuments || []),
      ...files.map((file) => ({
        ContentType: file.type,
        FileName: file.name,
      })),
    ],
  }
}

function uniqueOutcomeModels(models: AvailablePaymentTaskModel[]): AvailablePaymentTaskModel[] {
  const modelsByTaskKey = new Map<string, AvailablePaymentTaskModel>()

  for (const model of models) {
    const taskKey = getOutcomeTaskKey(model)

    if (!modelsByTaskKey.has(taskKey)) {
      modelsByTaskKey.set(taskKey, model)
    }
  }

  return Array.from(modelsByTaskKey.values())
}

function getOutcomeTaskKey(model: AvailablePaymentTaskModel): string {
  return String(model.task.NetUid || model.task.Id || model.id)
}

function getInvoiceRowKey(model: AvailablePaymentTaskModel, row: AvailablePaymentTaskRow, rowIndex: number): string {
  return `${model.id}-${rowIndex}-${row.number || row.name || ''}-${row.serviceNumber || ''}`
}

function TaskStatusBadge({ task }: { task: SupplyPaymentTask }) {
  const { t } = useI18n()

  if (task.TaskStatus === TaskStatusValue.Done) {
    return (
      <Badge className="app-role-pill is-green" size="xs" variant="light">
        {t('Виконано')}
      </Badge>
    )
  }

  if (task.TaskStatus === TaskStatusValue.PartiallyDone) {
    return (
      <Badge className="app-role-pill is-orange" size="xs" variant="light">
        {t('Оплачено частково')}
      </Badge>
    )
  }

  return (
    <Badge className="app-role-pill is-gray" size="xs" variant="light">
      {t('Не завершено')}
    </Badge>
  )
}

function getAvailableOrganizations(
  models: AvailablePaymentTaskModel[],
  registers: AvailablePaymentRegister[],
): AvailablePaymentsOrganization[] {
  const modelOrganizations = models
    .map((model) => model.organization)
    .filter((organization): organization is AvailablePaymentsOrganization => Boolean(organization))
  const organizations = modelOrganizations.length > 0
    ? modelOrganizations
    : registers
        .map((register) => register.Organization)
        .filter((organization): organization is AvailablePaymentsOrganization => Boolean(organization))
  const seen = new Set<string>()

  return organizations.filter((organization) => {
    const value = getEntityValue(organization)

    if (!value || seen.has(value)) {
      return false
    }

    seen.add(value)
    return true
  })
}

function selectOutcomeDefaults(
  current: OutcomeFormState,
  models: AvailablePaymentTaskModel[],
  registers: AvailablePaymentRegister[],
): OutcomeFormState {
  const organizations = getAvailableOrganizations(models, registers)
  const organization = organizations.find((item) => getEntityValue(item) === current.organizationValue) || organizations[0] || null
  const register = selectDefaultRegister(registers, organization)
  const currencyRegister = register?.PaymentCurrencyRegisters?.[0] || null

  return {
    ...current,
    organizationValue: organization ? getEntityValue(organization) : '',
    registerValue: register ? getEntityValue(register) : '',
    selectedCurrencyValue: currencyRegister ? getEntityValue(currencyRegister) : '',
  }
}

function selectDefaultRegister(
  registers: AvailablePaymentRegister[],
  organization: AvailablePaymentsOrganization | null,
): AvailablePaymentRegister | null {
  const filtered = registers.filter((register) => isRegisterForOrganization(register, organization))

  return filtered.find((register) => register.IsMain) || filtered[0] || null
}

function isRegisterForOrganization(
  register: AvailablePaymentRegister,
  organization: AvailablePaymentsOrganization | null,
): boolean {
  if (!organization) {
    return true
  }

  if (typeof register.OrganizationId === 'number' && typeof organization.Id === 'number') {
    return register.OrganizationId === organization.Id
  }

  if (register.Organization) {
    return getEntityValue(register.Organization) === getEntityValue(organization)
  }

  return false
}

function createInitialOutcomeForm(models: AvailablePaymentTaskModel[] = []): OutcomeFormState {
  const now = new Date()
  const uniqueModels = uniqueOutcomeModels(models)

  return {
    amount: uniqueModels.reduce((total, model) => total + getModelPaymentAmount(model), 0),
    comment: '',
    customNumber: '',
    date: formatLocalDate(now),
    exchangeRate: 0,
    isAccounting: false,
    isManagementAccounting: false,
    movementSearch: '',
    movementValue: '',
    organizationValue: uniqueModels[0]?.organization ? getEntityValue(uniqueModels[0].organization) : '',
    paymentPurpose: '',
    registerValue: '',
    selectedCurrencyValue: '',
    time: toTimeValue(now),
    vatRate: 0,
  }
}

function getModelPaymentAmount(model: AvailablePaymentTaskModel): number {
  return model.paymentAmount ?? model.grossPrice ?? 0
}

function calculateVatAmount(amount: number, vatRate: number): number {
  if (!vatRate || vatRate <= 0) {
    return 0
  }

  return Math.round((amount * vatRate / (100 + vatRate)) * 100) / 100
}

function extractCashFlowRows(data: AvailablePaymentAccountingCashFlow | null): DataRecord[] {
  if (!data) {
    return []
  }

  const collection = Array.isArray(data.Collection)
    ? data.Collection
    : Array.isArray(data.Items)
      ? data.Items
      : Array.isArray(data.Data)
        ? data.Data
        : Array.isArray(data.AccountingCashFlowHeadItems)
          ? data.AccountingCashFlowHeadItems
          : []

  return collection.map(asRecord).filter((row): row is DataRecord => Boolean(row))
}

function asRecord(value: unknown): DataRecord | null {
  return value && typeof value === 'object' ? (value as DataRecord) : null
}

function readUnknown(record: DataRecord, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== null && typeof record[key] !== 'undefined') {
      return record[key]
    }
  }

  return undefined
}

function readUnknownNumber(record: DataRecord, keys: string[]): number | undefined {
  return readFiniteNumber(readUnknown(record, keys))
}

function readUnknownDate(record: DataRecord, keys: string[]): Date | string | undefined {
  const value = readUnknown(record, keys)

  return value instanceof Date || typeof value === 'string' ? value : undefined
}

function readFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined
  }

  if (typeof value === 'string' && value.trim()) {
    const normalized = Number(value.replace(/\s/g, '').replace(',', '.'))

    return Number.isFinite(normalized) ? normalized : undefined
  }

  return undefined
}

function getEntityValue(entity?: { Id?: number; NetUid?: string } | null): string {
  return String(entity?.NetUid || entity?.Id || '')
}

function getPaymentMovementLabel(movement?: AvailablePaymentMovement | null): string {
  return movement?.OperationName || movement?.Name || getEntityValue(movement)
}

function findPaymentMovementByLabel(
  movements: AvailablePaymentMovement[],
  label: string,
): AvailablePaymentMovement | null {
  const normalizedLabel = normalizeSearchLabel(label)

  if (!normalizedLabel) {
    return null
  }

  return movements.find((movement) => normalizeSearchLabel(getPaymentMovementLabel(movement)) === normalizedLabel) || null
}

function includeEntity<T extends { Id?: number; NetUid?: string }>(entities: T[], entity: T | null): T[] {
  if (!entity) {
    return entities
  }

  const value = getEntityValue(entity)

  if (!value || entities.some((item) => getEntityValue(item) === value)) {
    return entities
  }

  return [entity, ...entities]
}

function normalizeSearchLabel(value: string): string {
  return value.trim().toLocaleLowerCase('uk-UA')
}

function toQueryDate(value: string): string {
  return formatLocalInputDateTime(value)
}

function getDateShiftedByDays(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)

  return formatLocalDate(date)
}

function createDefaultCashFlowFilters(): CashFlowFilters {
  return {
    from: getDateShiftedByDays(-30),
    to: formatLocalDate(new Date()),
  }
}

function getDateRangeError(fromDate: string, toDate: string): string | null {
  if (!fromDate || !toDate) {
    return 'Вкажіть період'
  }

  if (fromDate > toDate) {
    return 'Дата початку не може бути пізніше дати завершення'
  }

  return null
}

function toIsoDateTime(dateValue: string, timeValue: string): string {
  return formatLocalInputDateTime(dateValue, timeValue)
}

function toTimeValue(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${hours}:${minutes}`
}

function toNumber(value: string | number): number {
  const parsed = typeof value === 'number' ? value : Number(value.replace(',', '.'))

  return Number.isFinite(parsed) ? parsed : 0
}

function formatDate(value?: Date | string): string {
  if (!value) {
    return '-'
  }

  const date = value instanceof Date ? value : new Date(value)

  return Number.isNaN(date.getTime()) ? String(value) : dateFormatter.format(date)
}

function formatDateTime(value?: Date | string): string {
  if (!value) {
    return '-'
  }

  const date = value instanceof Date ? value : new Date(value)

  return Number.isNaN(date.getTime()) ? String(value) : dateTimeFormatter.format(date)
}

function formatAmount(value?: number): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-'
  }

  return value.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function displayValue(value: unknown): string {
  if (value === null || typeof value === 'undefined' || value === '') {
    return '-'
  }

  return String(value)
}
