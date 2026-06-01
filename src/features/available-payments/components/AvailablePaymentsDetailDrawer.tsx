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
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconCash,
  IconDeviceFloppy,
  IconExternalLink,
  IconFileUpload,
  IconInfoCircle,
  IconTrash,
} from '@tabler/icons-react'
import { type FormEvent, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatLocalDate, formatLocalInputDateTime } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { AppModal } from '../../../shared/ui/AppModal'
import { upgradeHttpToHttps } from '../../../shared/url/upgradeHttpToHttps'
import { buildTaskModels } from '../models/paymentTaskModelMapper'
import {
  createAvailablePaymentOutcome,
  getAvailablePaymentAccountingCashFlow,
  getAvailablePaymentExchangeRate,
  getAvailablePaymentMovements,
  searchAvailablePaymentMovements,
  searchAvailablePaymentRegisters,
  setAvailablePaymentTaskToActive,
} from '../api/availablePaymentsApi'
import {
  TaskStatusValue,
  type AccountingTypeValue,
  type AvailablePaymentAccountingCashFlow,
  type AvailablePaymentColumn,
  type AvailablePaymentCurrencyRegister,
  type AvailablePaymentDocument,
  type AvailablePaymentMovement,
  type AvailablePaymentRegister,
  type AvailablePaymentTaskModel,
  type AvailablePaymentTaskRow,
  type AvailablePaymentsOrganization,
  type GroupedPaymentTask,
  type SupplyPaymentTask,
} from '../types'

type AvailablePaymentsDetailDrawerProps = {
  filesByTaskId: Record<string, File[]>
  group: GroupedPaymentTask | null
  markedModels: AvailablePaymentTaskModel[]
  markedTaskIds: string[]
  typePaymentTask: AccountingTypeValue
  onChanged: () => void
  onClearMarked: () => void
  onClose: () => void
  onFilesChanged: (taskId: string, files: File[]) => void
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

type DataRecord = Record<string, unknown>

const SEARCH_DEBOUNCE_MS = 300

const dateFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short' })
const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short', timeStyle: 'short' })

export function AvailablePaymentsDetailDrawer({
  filesByTaskId,
  group,
  markedModels,
  markedTaskIds,
  typePaymentTask,
  onChanged,
  onClearMarked,
  onClose,
  onFilesChanged,
  onToggleMarked,
}: AvailablePaymentsDetailDrawerProps) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const models = useMemo(() => buildTaskModels(group, t), [group, t])
  const [expandedId, setExpandedId] = useValueState<string | null>(null)
  const [activeTabs, setActiveTabs] = useValueState<Record<string, string>>({})
  const [cashFlows, setCashFlows] = useValueState<Record<string, CashFlowState>>({})
  const [cashFlowFiltersByTaskId, setCashFlowFiltersByTaskId] = useValueState<Record<string, CashFlowFilters>>({})
  const [outcomeModels, setOutcomeModels] = useValueState<AvailablePaymentTaskModel[]>([])
  const [registers, setRegisters] = useValueState<AvailablePaymentRegister[]>([])
  const [movements, setMovements] = useValueState<AvailablePaymentMovement[]>([])
  const [form, setForm] = useValueState<OutcomeFormState>(() => createInitialOutcomeForm())
  const [isLoadingDictionaries, setLoadingDictionaries] = useValueState(false)
  const [isSaving, setSaving] = useValueState(false)
  const [error, setError] = useValueState<string | null>(null)
  const [confirmCloseOutcomeOpen, setConfirmCloseOutcomeOpen] = useValueState(false)
  const movementSearchRequestRef = useRef(0)
  const movementSearchTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    if (outcomeModels.length === 0) {
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
  }, [outcomeModels, setError, setForm, setLoadingDictionaries, setMovements, setRegisters, t])

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
    () => movements.find((movement) => getEntityValue(movement) === form.movementValue) || null,
    [form.movementValue, movements],
  )

  const targetCurrency = selectedCurrencyRegister?.Currency || outcomeModels[0]?.currency || null
  const targetCurrencyNetUid = targetCurrency?.NetUid || ''
  const targetCurrencyCode = targetCurrency?.Code || ''
  const uahCurrencyNetUid = useMemo(() => findUahCurrencyNetUid(registers, outcomeModels), [outcomeModels, registers])
  const organizationName = selectedOrganization?.Name || outcomeModels[0]?.organization?.Name || ''
  const exchangeFromDate = form.date

  useEffect(() => {
    if (outcomeModels.length === 0) {
      return
    }

    if (!uahCurrencyNetUid || !targetCurrencyNetUid || uahCurrencyNetUid === targetCurrencyNetUid || targetCurrencyCode === 'UAH') {
      setForm((current) => (current.exchangeRate === 0 ? current : { ...current, exchangeRate: 0 }))
      return
    }

    let cancelled = false

    void getAvailablePaymentExchangeRate({
      fromCurrencyNetId: uahCurrencyNetUid,
      fromDate: toQueryDate(exchangeFromDate),
      organizationName,
      toCurrencyNetId: targetCurrencyNetUid,
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
    organizationName,
    outcomeModels.length,
    setForm,
    targetCurrencyCode,
    targetCurrencyNetUid,
    uahCurrencyNetUid,
  ])

  function updateForm(patch: Partial<OutcomeFormState>) {
    setForm((current) => ({ ...current, ...patch }))
  }

  function resetMovementSearchState() {
    movementSearchRequestRef.current += 1

    if (movementSearchTimeoutRef.current) {
      window.clearTimeout(movementSearchTimeoutRef.current)
      movementSearchTimeoutRef.current = null
    }
  }

  function closeOutcomeForm() {
    resetMovementSearchState()
    setOutcomeModels([])
    setForm(createInitialOutcomeForm())
    setMovements([])
    setRegisters([])
    setLoadingDictionaries(false)
    setConfirmCloseOutcomeOpen(false)
  }

  function requestDrawerClose() {
    if (outcomeModels.length > 0) {
      setConfirmCloseOutcomeOpen(true)
      return
    }

    onClose()
  }

  function confirmDrawerClose() {
    closeOutcomeForm()
    onClose()
  }

  function handleMovementSearchChange(nextValue: string) {
    updateForm({ movementSearch: nextValue })

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

  function openOutcomeForm(nextModels: AvailablePaymentTaskModel[]) {
    const payableModels = nextModels.filter((model) => model.task.TaskStatus !== TaskStatusValue.Done)

    if (payableModels.length === 0) {
      setError(t('Немає платіжних задач для створення видаткового ордера'))
      return
    }

    const groupValidationError = validateOutcomeModelsGroup(payableModels, t)

    if (groupValidationError) {
      setError(groupValidationError)
      return
    }

    if (payableModels.some((model) => getTaskDocumentCount(model, filesByTaskId[model.id] || []) === 0)) {
      setError(t('Додайте хоча б один документ до кожної платіжної задачі'))
      return
    }

    resetMovementSearchState()
    setOutcomeModels(payableModels)
    setForm(createInitialOutcomeForm(payableModels))
    setError(null)
  }

  async function loadCashFlow(model: AvailablePaymentTaskModel, filters: CashFlowFilters) {
    if (!model.serviceAgreementNetId) {
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

      setCashFlows((current) => ({
        ...current,
        [model.id]: { data: result, error: null, isLoading: false },
      }))
    } catch (cashFlowError) {
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

  async function handleCashFlowTab(model: AvailablePaymentTaskModel, tab: string | null) {
    const nextTab = tab || 'invoice'
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
    setCashFlowFiltersByTaskId((current) => ({ ...current, [model.id]: filters }))
    void loadCashFlow(model, filters)
  }

  async function handleMoveToDone(model: AvailablePaymentTaskModel) {
    const localFiles = filesByTaskId[model.id] || []
    const taskWithDocuments = buildTaskWithLocalDocuments(model.task, localFiles)

    if ((taskWithDocuments.SupplyPaymentTaskDocuments || []).length === 0) {
      setError(t('Додайте хоча б один документ'))
      return
    }

    setSaving(true)
    setError(null)

    try {
      await setAvailablePaymentTaskToActive(taskWithDocuments, localFiles)
      notifications.show({ color: 'green', message: t('Платіжну задачу оновлено') })
      onChanged()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося оновити платіжну задачу'))
    } finally {
      setSaving(false)
    }
  }

  function handleToggleExpanded(model: AvailablePaymentTaskModel) {
    const isOpening = expandedId !== model.id
    setExpandedId(isOpening ? model.id : null)

    if (isOpening && !activeTabs[model.id]) {
      setActiveTabs((current) => ({ ...current, [model.id]: 'invoice' }))
    }
  }

  function handleRedirectToSource(model: AvailablePaymentTaskModel) {
    if (model.supplyOrderUkraineNetUid) {
      navigate(`/orders/ukraine/view/${model.supplyOrderUkraineNetUid}`)
    } else if (model.deliveryProductProtocolNetUid) {
      navigate(`/product-delivery-protocols/${model.deliveryProductProtocolNetUid}`)
    }
  }

  async function handleCreateOutcome(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationError = validateOutcomeForm({
      amount: form.amount,
      outcomeModels,
      selectedCurrencyRegister,
      selectedMovement,
      selectedOrganization,
      selectedRegister,
      t,
    })

    if (validationError) {
      setError(validationError)
      return
    }

    if (outcomeModels.some((model) => getTaskDocumentCount(model, filesByTaskId[model.id] || []) === 0)) {
      setError(t('Додайте хоча б один документ до кожної платіжної задачі'))
      return
    }

    const documents = outcomeModels.flatMap((model) => filesByTaskId[model.id] || [])
    const modelsWithDocuments = outcomeModels.map((model) => ({
      ...model,
      task: buildTaskWithLocalDocuments(model.task, filesByTaskId[model.id] || []),
    }))

    setSaving(true)
    setError(null)

    try {
      await createAvailablePaymentOutcome({
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
      })
      notifications.show({ color: 'green', message: t('Видатковий ордер створено') })
      closeOutcomeForm()
      onClearMarked()
      onChanged()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося створити видатковий ордер'))
    } finally {
      setSaving(false)
    }
  }

  const title = group ? `${t('Наявні платежі')} - ${formatDate(group.PayToDate)}` : t('Наявні платежі')
  return (
    <AppDrawer opened={Boolean(group)} position="right" size="80vw" title={title} onClose={requestDrawerClose}>
      <Stack gap="md">
        {error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}

        {models.length === 0 ? (
          <Text c="dimmed" size="sm">
            {t('Платіжних задач не знайдено')}
          </Text>
        ) : (
          <AvailablePaymentTaskList
            activeTabs={activeTabs}
            cashFlowFiltersByTaskId={cashFlowFiltersByTaskId}
            cashFlows={cashFlows}
            expandedId={expandedId}
            filesByTaskId={filesByTaskId}
            isSaving={isSaving}
            markedModels={markedModels}
            markedTaskIds={markedTaskIds}
            models={models}
            onCashFlowTab={handleCashFlowTab}
            onCashFlowFiltersChange={handleCashFlowFiltersChange}
            onClearMarked={onClearMarked}
            onCreateOutcome={openOutcomeForm}
            onFilesChanged={onFilesChanged}
            onMoveToDone={handleMoveToDone}
            onRedirectToSource={handleRedirectToSource}
            onToggleExpanded={handleToggleExpanded}
            onToggleMarked={onToggleMarked}
          />
        )}

        {outcomeModels.length > 0 && (
          <AvailablePaymentOutcomeForm
            filteredRegisters={filteredRegisters}
            form={form}
            isLoadingDictionaries={isLoadingDictionaries}
            isSaving={isSaving}
            movements={movements}
            outcomeModels={outcomeModels}
            registers={registers}
            selectedOrganization={selectedOrganization}
            selectedRegister={selectedRegister}
            onCancel={closeOutcomeForm}
            onMovementSearchChange={handleMovementSearchChange}
            onSubmit={handleCreateOutcome}
            updateForm={updateForm}
          />
        )}

        <AppModal
          centered
          opened={confirmCloseOutcomeOpen}
          title={t('Є незбережені зміни')}
          onClose={() => setConfirmCloseOutcomeOpen(false)}
        >
          <Stack gap="md">
            <Text>{t('Якщо закрити вікно, дані видаткового ордера не будуть збережені.')}</Text>
            <Group justify="flex-end">
              <Button color="gray" variant="light" onClick={() => setConfirmCloseOutcomeOpen(false)}>
                {t('Залишитися')}
              </Button>
              <Button color="red" onClick={confirmDrawerClose}>
                {t('Закрити без збереження')}
              </Button>
            </Group>
          </Stack>
        </AppModal>
      </Stack>
    </AppDrawer>
  )
}

function AvailablePaymentTaskList({
  activeTabs,
  cashFlowFiltersByTaskId,
  cashFlows,
  expandedId,
  filesByTaskId,
  isSaving,
  markedModels,
  markedTaskIds,
  models,
  onCashFlowTab,
  onCashFlowFiltersChange,
  onClearMarked,
  onCreateOutcome,
  onFilesChanged,
  onMoveToDone,
  onRedirectToSource,
  onToggleExpanded,
  onToggleMarked,
}: {
  activeTabs: Record<string, string>
  cashFlowFiltersByTaskId: Record<string, CashFlowFilters>
  cashFlows: Record<string, CashFlowState>
  expandedId: string | null
  filesByTaskId: Record<string, File[]>
  isSaving: boolean
  markedModels: AvailablePaymentTaskModel[]
  markedTaskIds: string[]
  models: AvailablePaymentTaskModel[]
  onCashFlowTab: (model: AvailablePaymentTaskModel, tab: string | null) => Promise<void>
  onCashFlowFiltersChange: (model: AvailablePaymentTaskModel, filters: CashFlowFilters) => void
  onClearMarked: () => void
  onCreateOutcome: (models: AvailablePaymentTaskModel[]) => void
  onFilesChanged: (taskId: string, files: File[]) => void
  onMoveToDone: (model: AvailablePaymentTaskModel) => Promise<void>
  onRedirectToSource: (model: AvailablePaymentTaskModel) => void
  onToggleExpanded: (model: AvailablePaymentTaskModel) => void
  onToggleMarked: (model: AvailablePaymentTaskModel) => void
}) {
  const { t } = useI18n()

  return (
    <Stack gap="sm">
      {markedModels.length > 0 && (
        <Alert color="blue" icon={<IconInfoCircle size={18} />} variant="light">
          <Group justify="space-between" gap="sm">
            <Text size="sm">
              {t('Вибрано платіжних задач')}: {markedModels.length}
            </Text>
            <Group gap="xs">
              <Button size="xs" variant="light" onClick={() => onCreateOutcome(markedModels)}>
                {t('Створити видатковий')}
              </Button>
              <Button color="gray" size="xs" variant="subtle" onClick={onClearMarked}>
                {t('Очистити')}
              </Button>
            </Group>
          </Group>
        </Alert>
      )}

      {models.map((model) => (
        <Stack key={model.id} gap={0}>
          <Group
            align="center"
            justify="space-between"
            p="sm"
            style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 8 }}
          >
            <Group gap="sm" wrap="nowrap">
              {model.task.TaskStatus !== TaskStatusValue.Done && (
                <Checkbox
                  checked={markedTaskIds.includes(model.id)}
                  aria-label={t('Вибрати платіжну задачу')}
                  onChange={() => onToggleMarked(model)}
                />
              )}
              <Stack gap={2}>
                <Group gap="xs">
                  <TaskStatusBadge task={model.task} />
                  <Text fw={600}>{model.organizationName || t('Контрагент')}</Text>
                </Group>
                <Text c="dimmed" size="sm">
                  {model.serviceName}
                  {model.serviceNumber ? ` #${model.serviceNumber}` : ''}
                </Text>
              </Stack>
            </Group>
            <Group gap="sm">
              <Text fw={700}>
                {formatAmount(model.grossPrice)} {model.currencyCode}
              </Text>
              <RedirectToSourceButton model={model} onRedirectToSource={onRedirectToSource} />
              <Button color="gray" size="xs" variant="light" onClick={() => onToggleExpanded(model)}>
                {expandedId === model.id ? t('Згорнути') : t('Деталі')}
              </Button>
            </Group>
          </Group>

          {expandedId === model.id && (
            <Stack
              gap="md"
              p="md"
              style={{
                border: '1px solid var(--mantine-color-gray-3)',
                borderTop: 0,
                borderRadius: '0 0 8px 8px',
              }}
            >
              <SegmentedControl
                data={[
                  { label: t('Рахунок'), value: 'invoice' },
                  { label: t('Рух коштів'), value: 'cash-flow' },
                  { label: t('Оплата'), value: 'payment' },
                  { label: t('Переказ'), value: 'transfer' },
                ]}
                value={activeTabs[model.id] || 'invoice'}
                onChange={(value) => void onCashFlowTab(model, value)}
              />

              {(activeTabs[model.id] || 'invoice') === 'invoice' && <InvoiceTab model={model} />}
              {activeTabs[model.id] === 'cash-flow' && (
                <CashFlowTab
                  filters={cashFlowFiltersByTaskId[model.id] || createDefaultCashFlowFilters()}
                  state={cashFlows[model.id]}
                  onFiltersChange={(filters) => onCashFlowFiltersChange(model, filters)}
                />
              )}
              {activeTabs[model.id] === 'payment' && (
                <PaymentTab
                  files={filesByTaskId[model.id] || []}
                  isSaving={isSaving}
                  model={model}
                  onCreateOutcome={() => onCreateOutcome([model])}
                  onFilesChanged={(files) => onFilesChanged(model.id, files)}
                  onMoveToDone={() => void onMoveToDone(model)}
                />
              )}
              {activeTabs[model.id] === 'transfer' && <TransferTab model={model} />}
            </Stack>
          )}
        </Stack>
      ))}
    </Stack>
  )
}

function AvailablePaymentOutcomeForm({
  filteredRegisters,
  form,
  isLoadingDictionaries,
  isSaving,
  movements,
  outcomeModels,
  registers,
  selectedOrganization,
  selectedRegister,
  onCancel,
  onMovementSearchChange,
  onSubmit,
  updateForm,
}: {
  filteredRegisters: AvailablePaymentRegister[]
  form: OutcomeFormState
  isLoadingDictionaries: boolean
  isSaving: boolean
  movements: AvailablePaymentMovement[]
  outcomeModels: AvailablePaymentTaskModel[]
  registers: AvailablePaymentRegister[]
  selectedOrganization: AvailablePaymentsOrganization | null
  selectedRegister: AvailablePaymentRegister | null
  onCancel: () => void
  onMovementSearchChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  updateForm: (patch: Partial<OutcomeFormState>) => void
}) {
  const { t } = useI18n()
  const organizationOptions = getAvailableOrganizations(outcomeModels, registers).map((organization) => ({
    label: organization.Name || organization.FullName || getEntityValue(organization),
    value: getEntityValue(organization),
  }))

  return (
    <form onSubmit={onSubmit}>
      <Stack gap="md" p="md" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 8 }}>
        <Group justify="space-between">
          <Text fw={700}>{t('Новий видатковий ордер')}</Text>
          <Badge variant="light">{outcomeModels.length}</Badge>
        </Group>

        {isLoadingDictionaries ? (
          <Group justify="center" py="md">
            <Loader size="sm" />
          </Group>
        ) : (
          <>
            <SimpleGrid cols={{ base: 1, md: 3 }}>
              <TextInput
                label={t('Номер')}
                value={form.customNumber}
                onChange={(event) => updateForm({ customNumber: event.currentTarget.value })}
              />
              <TextInput
                label={t('Від якої дати')}
                type="date"
                value={form.date}
                onChange={(event) => updateForm({ date: event.currentTarget.value })}
              />
              <TextInput
                label={t('Час')}
                type="time"
                value={form.time}
                onChange={(event) => updateForm({ time: event.currentTarget.value })}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, md: 3 }}>
              <Select
                data={organizationOptions}
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
                disabled={!selectedOrganization}
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
              <Select
                data={(selectedRegister?.PaymentCurrencyRegisters || []).map((currencyRegister) => ({
                  label: currencyRegister.Currency?.Code || currencyRegister.Currency?.Name || getEntityValue(currencyRegister),
                  value: getEntityValue(currencyRegister),
                }))}
                disabled={!selectedRegister}
                label={t('Валюта')}
                searchable
                value={form.selectedCurrencyValue || null}
                onChange={(value) => updateForm({ selectedCurrencyValue: value || '' })}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, md: 3 }}>
              <NumberInput
                allowNegative={false}
                decimalScale={2}
                label={t('Сума')}
                min={0}
                value={form.amount}
                onChange={(value) => updateForm({ amount: toNumber(value) })}
              />
              <NumberInput
                allowNegative={false}
                decimalScale={4}
                label={t('Курс обміну')}
                min={0}
                value={form.exchangeRate}
                onChange={(value) => updateForm({ exchangeRate: toNumber(value) })}
              />
              <Select
                data={movements.map((movement) => ({
                  label: movement.OperationName || movement.Name || getEntityValue(movement),
                  value: getEntityValue(movement),
                }))}
                label={t('Статті руху грошових коштів')}
                searchable
                searchValue={form.movementSearch}
                value={form.movementValue || null}
                onChange={(value) => updateForm({ movementValue: value || '' })}
                onSearchChange={onMovementSearchChange}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <TextInput
                label={t('Призначення платежу')}
                value={form.paymentPurpose}
                onChange={(event) => updateForm({ paymentPurpose: event.currentTarget.value })}
              />
              <Textarea
                label={t('Коментар')}
                value={form.comment}
                onChange={(event) => updateForm({ comment: event.currentTarget.value })}
              />
            </SimpleGrid>

            <Group gap="lg">
              <Checkbox
                checked={form.isManagementAccounting}
                label={t('Управлінський облік')}
                onChange={(event) => updateForm({ isManagementAccounting: event.currentTarget.checked })}
              />
              <Checkbox
                checked={form.isAccounting}
                label={t('Бухгалтерський облік')}
                onChange={(event) => updateForm({ isAccounting: event.currentTarget.checked })}
              />
            </Group>

            <Group justify="flex-end">
              <Button color="gray" disabled={isSaving} type="button" variant="light" onClick={onCancel}>
                {t('Скасувати')}
              </Button>
              <Button color="violet" leftSection={<IconDeviceFloppy size={16} />} loading={isSaving} type="submit">
                {t('Створити')}
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </form>
  )
}

function InvoiceTab({ model }: { model: AvailablePaymentTaskModel }) {
  const { t } = useI18n()
  const columns = model.columns

  const dataColumns = useMemo<DataTableColumn<AvailablePaymentTaskRow>[]>(
    () =>
      columns.map((column) => ({
        id: column.key,
        header: column.header,
        align: column.align === 'right' ? 'right' : 'left',
        accessor: (row) => row[column.key],
        cell: (row) => renderCell(column, row),
      })),
    [columns],
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
      <Table.ScrollContainer minWidth={760}>
        <Table withTableBorder withColumnBorders striped>
          <Table.Thead>
            <Table.Tr>
              {columns.map((column) => (
                <Table.Th key={column.key} style={{ textAlign: column.align === 'right' ? 'right' : 'left' }}>
                  {column.header}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {model.rows.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={columns.length}>
                  <Text c="dimmed" size="sm">
                    {t('Дані рахунку відсутні')}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              model.rows.map((row, rowIndex) => (
                <Table.Tr key={getInvoiceRowKey(model, row, rowIndex)}>
                  {columns.map((column) => (
                    <Table.Td
                      key={column.key}
                      style={{ textAlign: column.align === 'right' ? 'right' : 'left' }}
                    >
                      <InvoiceTableCell column={column} row={row} />
                    </Table.Td>
                  ))}
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Stack>
  )
}

function InvoiceTableCell({ column, row }: { column: AvailablePaymentColumn; row: AvailablePaymentTaskRow }) {
  const value = row[column.key]

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
}: {
  filters: CashFlowFilters
  state?: CashFlowState
  onFiltersChange: (filters: CashFlowFilters) => void
}) {
  const { t } = useI18n()
  const controls = (
    <Group align="end" gap="sm" wrap="wrap">
      <TextInput
        label={t('З')}
        type="date"
        value={filters.from}
        w={150}
        onChange={(event) => onFiltersChange({ ...filters, from: event.currentTarget.value })}
      />
      <TextInput
        label={t('По')}
        type="date"
        value={filters.to}
        w={150}
        onChange={(event) => onFiltersChange({ ...filters, to: event.currentTarget.value })}
      />
    </Group>
  )

  const columns = useMemo<DataTableColumn<DataRecord>[]>(
    () => [
      {
        id: 'date',
        header: t('Дата'),
        accessor: (row) => readUnknownDate(row, ['FromDate', 'Date', 'Created']),
        cell: (row) => formatDate(readUnknownDate(row, ['FromDate', 'Date', 'Created'])),
      },
      {
        id: 'number',
        header: t('Номер'),
        accessor: (row) => readUnknown(row, ['Number', 'CustomNumber']),
        cell: (row) => displayValue(readUnknown(row, ['Number', 'CustomNumber'])),
      },
      {
        id: 'type',
        header: t('Тип'),
        accessor: (row) => readUnknown(row, ['Type', 'OperationTypeName']),
        cell: (row) => displayValue(readUnknown(row, ['Type', 'OperationTypeName'])),
      },
      {
        id: 'amount',
        header: t('Сума'),
        align: 'right',
        accessor: (row) => readUnknownNumber(row, ['Amount', 'Total']),
        cell: (row) => formatAmount(readUnknownNumber(row, ['Amount', 'Total'])),
      },
    ],
    [t],
  )

  if (!state || state.isLoading) {
    return (
      <Stack gap="md">
        {controls}
        <Group justify="center" py="md">
          <Loader size="sm" />
        </Group>
      </Stack>
    )
  }

  if (state.error) {
    return (
      <Stack gap="md">
        {controls}
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {state.error}
        </Alert>
      </Stack>
    )
  }

  const rows = extractCashFlowRows(state.data)

  return (
    <Stack gap="md">
      {controls}
      <Table.ScrollContainer minWidth={720}>
        <Table withTableBorder withColumnBorders striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('Дата')}</Table.Th>
              <Table.Th>{t('Номер')}</Table.Th>
              <Table.Th>{t('Тип')}</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>{t('Сума')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={4}>
                  <Text c="dimmed" size="sm">
                    {t('Рух коштів відсутній')}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              rows.map((row) => (
                <Table.Tr key={getCashFlowRowKey(row)}>
                  <Table.Td>{formatDate(readUnknownDate(row, ['FromDate', 'Date', 'Created']))}</Table.Td>
                  <Table.Td>{displayValue(readUnknown(row, ['Number', 'CustomNumber']))}</Table.Td>
                  <Table.Td>{displayValue(readUnknown(row, ['Name', 'Type', 'OperationTypeName']))}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    {formatAmount(readUnknownNumber(row, ['CurrentValue', 'Amount', 'Total', 'GrossPrice']))}
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Stack>
  )
}

function PaymentTab({
  files,
  isSaving,
  model,
  onCreateOutcome,
  onFilesChanged,
  onMoveToDone,
}: {
  files: File[]
  isSaving: boolean
  model: AvailablePaymentTaskModel
  onCreateOutcome: () => void
  onFilesChanged: (files: File[]) => void
  onMoveToDone: () => void
}) {
  const { t } = useI18n()
  const isDone = model.task.TaskStatus === TaskStatusValue.Done

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        {!isDone ? (
          <FileButton multiple onChange={(nextFiles) => onFilesChanged(mergeLocalFiles(files, nextFiles || []))}>
            {(props) => (
              <Button {...props} color="gray" leftSection={<IconFileUpload size={16} />} variant="light">
                {t('Завантажити файли')}
              </Button>
            )}
          </FileButton>
        ) : (
          <Text c="dimmed" size="sm">
            {t('Задачу вже виконано')}
          </Text>
        )}
        <Group gap="xs">
          {!isDone && !model.task.IsAvailableForPayment && (
            <Button color="green" disabled={isSaving} loading={isSaving} variant="light" onClick={onMoveToDone}>
              {t('Перевести в оплату')}
            </Button>
          )}
          {!isDone && (
            <Button color="violet" leftSection={<IconCash size={16} />} onClick={onCreateOutcome}>
              {t('Створити видатковий')}
            </Button>
          )}
        </Group>
      </Group>
      <DocumentsList documents={model.task.SupplyPaymentTaskDocuments || []} />
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
                    size="sm"
                    variant="subtle"
                    onClick={() => onFilesChanged(files.filter((entry) => getLocalFileKey(entry) !== getLocalFileKey(file)))}
                  >
                    <IconTrash size={16} />
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

  if (!order) {
    return (
      <Text c="dimmed" size="sm">
        {t('Переказ ще не створено')}
      </Text>
    )
  }

  return (
    <SimpleGrid cols={{ base: 1, md: 3 }}>
      <InfoCell label={t('Номер')} value={displayValue(order.Number)} />
      <InfoCell label={t('Дата')} value={formatDateTime(order.FromDate)} />
      <InfoCell
        label={t('Сума')}
        value={`${formatAmount(order.Amount)} ${order.PaymentCurrencyRegister?.Currency?.Code || ''}`}
      />
      <InfoCell label={t('Рахунок')} value={displayValue(order.PaymentCurrencyRegister?.PaymentRegister?.Name)} />
      <InfoCell label={t('Оплатив')} value={displayValue(order.User?.LastName || order.User?.FullName || order.User?.Name)} />
    </SimpleGrid>
  )
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={2}>
      <Text c="dimmed" size="xs">
        {label}
      </Text>
      <Text fw={600}>{value}</Text>
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
  const canNavigate = Boolean(model.supplyOrderUkraineNetUid || model.deliveryProductProtocolNetUid)
  const hasPolandOrder = !canNavigate && Boolean(model.supplyOrderNetUid)

  if (!canNavigate && !hasPolandOrder) {
    return null
  }

  if (hasPolandOrder) {
    return (
      <Tooltip label={t('Перегляд замовлення з Польщі недоступний')}>
        <Button
          color="gray"
          data-disabled
          leftSection={<IconExternalLink size={16} />}
          size="xs"
          variant="subtle"
          onClick={(event) => event.preventDefault()}
        >
          {t('Перейти до замовлення')}
        </Button>
      </Tooltip>
    )
  }

  return (
    <Button
      color="gray"
      leftSection={<IconExternalLink size={16} />}
      size="xs"
      variant="subtle"
      onClick={() => onRedirectToSource(model)}
    >
      {t('Перейти до замовлення')}
    </Button>
  )
}

function DocumentsList({ documents }: { documents: AvailablePaymentDocument[] }) {
  const { t } = useI18n()

  if (documents.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        {t('Документи відсутні')}
      </Text>
    )
  }

  return (
    <Stack gap={4}>
      {documents.map((document) => {
        const label = document.FileName || document.Name || t('Документ')
        const url = document.DocumentUrl || document.Url

        return url ? (
          <Anchor key={getDocumentKey(document)} href={upgradeHttpToHttps(url)} rel="noreferrer" size="sm" target="_blank">
            {label}
          </Anchor>
        ) : (
          <Text key={getDocumentKey(document)} size="sm">
            {label}
          </Text>
        )
      })}
    </Stack>
  )
}

function getDocumentKey(document: AvailablePaymentDocument): string {
  return String(
    document.NetUid || document.Id || document.FileName || document.DocumentUrl || document.Url || document.Name || 'document',
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

function buildTaskWithLocalDocuments(task: SupplyPaymentTask, files: File[]): SupplyPaymentTask {
  if (files.length === 0) {
    return task
  }

  return {
    ...task,
    SupplyPaymentTaskDocuments: [
      ...(task.SupplyPaymentTaskDocuments || []),
      ...files.map((file) => ({
        ContentType: file.type,
        FileName: file.name,
      })),
    ],
  }
}

function getTaskDocumentCount(model: AvailablePaymentTaskModel, files: File[]): number {
  return (model.task.SupplyPaymentTaskDocuments || []).length + files.length
}

function getInvoiceRowKey(model: AvailablePaymentTaskModel, row: AvailablePaymentTaskRow, rowIndex: number): string {
  return `${model.id}-${rowIndex}-${row.number || row.name || ''}-${row.serviceNumber || ''}`
}

function getCashFlowRowKey(row: DataRecord): string {
  return [
    readUnknown(row, ['NetUid', 'Id']),
    readUnknown(row, ['Number', 'CustomNumber']),
    readUnknown(row, ['FromDate', 'Date', 'Created']),
    readUnknown(row, ['Amount', 'Total']),
  ]
    .filter(Boolean)
    .join('-') || JSON.stringify(row).slice(0, 80)
}

function TaskStatusBadge({ task }: { task: SupplyPaymentTask }) {
  const { t } = useI18n()

  if (task.TaskStatus === TaskStatusValue.Done) {
    return (
      <Badge color="green" variant="light">
        {t('Виконано')}
      </Badge>
    )
  }

  if (task.TaskStatus === TaskStatusValue.PartiallyDone) {
    return (
      <Badge color="yellow" variant="light">
        {t('Оплачено частково')}
      </Badge>
    )
  }

  return (
    <Badge color="gray" variant="light">
      {t('Не завершено')}
    </Badge>
  )
}


function getAvailableOrganizations(
  models: AvailablePaymentTaskModel[],
  registers: AvailablePaymentRegister[],
): AvailablePaymentsOrganization[] {
  const organizations = [
    ...models.map((model) => model.organization).filter((organization): organization is AvailablePaymentsOrganization => Boolean(organization)),
    ...registers
      .map((register) => register.Organization)
      .filter((organization): organization is AvailablePaymentsOrganization => Boolean(organization)),
  ]
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

  return {
    amount: models.reduce((total, model) => total + (model.grossPrice || 0), 0),
    comment: '',
    customNumber: '',
    date: formatLocalDate(now),
    exchangeRate: 0,
    isAccounting: false,
    isManagementAccounting: false,
    movementSearch: '',
    movementValue: '',
    organizationValue: models[0]?.organization ? getEntityValue(models[0].organization) : '',
    paymentPurpose: '',
    registerValue: '',
    selectedCurrencyValue: '',
    time: toTimeValue(now),
  }
}

function validateOutcomeForm({
  amount,
  outcomeModels,
  selectedCurrencyRegister,
  selectedMovement,
  selectedOrganization,
  selectedRegister,
  t,
}: {
  amount: number
  outcomeModels: AvailablePaymentTaskModel[]
  selectedCurrencyRegister: AvailablePaymentCurrencyRegister | null
  selectedMovement: AvailablePaymentMovement | null
  selectedOrganization: AvailablePaymentsOrganization | null
  selectedRegister: AvailablePaymentRegister | null
  t: (key: string) => string
}): string | null {
  if (outcomeModels.length === 0) {
    return t('Виберіть платіжні задачі')
  }

  if (!selectedOrganization) {
    return t('Організація')
  }

  if (!selectedRegister) {
    return t('Грошові рахунки')
  }

  if (!selectedCurrencyRegister) {
    return t('Валюта')
  }

  if (!selectedMovement) {
    return t('Виберіть статтю грошових витрат')
  }

  if (!amount || amount <= 0) {
    return t('Сума')
  }

  return null
}

function validateOutcomeModelsGroup(
  models: AvailablePaymentTaskModel[],
  t: (key: string) => string,
): string | null {
  const firstModel = models[0]

  if (!firstModel) {
    return t('Виберіть платіжні задачі')
  }

  return models.slice(1).reduce<string | null>((error, model) => {
    if (error) {
      return error
    }

    if (firstModel.organizationNetUid !== model.organizationNetUid) {
      return t('Можна обрати платіжні задачі тільки одного контрагента')
    }

    if (firstModel.currencyCode !== model.currencyCode) {
      return t('Можна обрати платіжні задачі тільки в одній валюті')
    }

    if (
      firstModel.serviceAgreementNetId &&
      model.serviceAgreementNetId &&
      firstModel.serviceAgreementNetId !== model.serviceAgreementNetId
    ) {
      return t('Можна обрати платіжні задачі тільки однієї угоди')
    }

    if (Boolean(firstModel.task.IsAccounting) !== Boolean(model.task.IsAccounting)) {
      return t('Можна обрати платіжні задачі тільки одного типу обліку')
    }

    return null
  }, null)
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

function findUahCurrencyNetUid(
  registers: AvailablePaymentRegister[],
  models: AvailablePaymentTaskModel[],
): string {
  for (const register of registers) {
    for (const currencyRegister of register.PaymentCurrencyRegisters || []) {
      if (currencyRegister.Currency?.Code === 'UAH' && currencyRegister.Currency.NetUid) {
        return currencyRegister.Currency.NetUid
      }
    }
  }

  for (const model of models) {
    if (model.currency?.Code === 'UAH' && model.currency.NetUid) {
      return model.currency.NetUid
    }
  }

  return ''
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
