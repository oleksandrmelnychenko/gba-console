import {
  Alert,
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
  Table,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconCash, IconDeviceFloppy, IconFileUpload, IconInfoCircle } from '@tabler/icons-react'
import { type FormEvent, useEffect, useMemo } from 'react'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import {
  createAvailablePaymentOutcome,
  getAvailablePaymentAccountingCashFlow,
  getAvailablePaymentMovements,
  searchAvailablePaymentMovements,
  searchAvailablePaymentRegisters,
  setAvailablePaymentTaskToActive,
} from '../api/availablePaymentsApi'
import {
  TaskStatusValue,
  type AccountingTypeValue,
  type AvailablePaymentAccountingCashFlow,
  type AvailablePaymentCurrencyRegister,
  type AvailablePaymentDocument,
  type AvailablePaymentMovement,
  type AvailablePaymentRegister,
  type AvailablePaymentTaskModel,
  type AvailablePaymentsOrganization,
  type GroupedPaymentTask,
  type SupplyPaymentTask,
} from '../types'

type AvailablePaymentsDetailDrawerProps = {
  group: GroupedPaymentTask | null
  markedModels: AvailablePaymentTaskModel[]
  markedTaskIds: string[]
  typePaymentTask: AccountingTypeValue
  onChanged: () => void
  onClearMarked: () => void
  onClose: () => void
  onToggleMarked: (model: AvailablePaymentTaskModel) => void
}

type OutcomeFormState = {
  amount: number
  comment: string
  customNumber: string
  date: string
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

type DataRecord = Record<string, unknown>

const SEARCH_DEBOUNCE_MS = 300

const dateFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short' })
const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short', timeStyle: 'short' })

export function AvailablePaymentsDetailDrawer({
  group,
  markedModels,
  markedTaskIds,
  typePaymentTask,
  onChanged,
  onClearMarked,
  onClose,
  onToggleMarked,
}: AvailablePaymentsDetailDrawerProps) {
  const { t } = useI18n()
  const models = useMemo(() => buildTaskModels(group), [group])
  const [expandedId, setExpandedId] = useValueState<string | null>(null)
  const [activeTabs, setActiveTabs] = useValueState<Record<string, string>>({})
  const [cashFlows, setCashFlows] = useValueState<Record<string, CashFlowState>>({})
  const [filesByTaskId, setFilesByTaskId] = useValueState<Record<string, File[]>>({})
  const [outcomeModels, setOutcomeModels] = useValueState<AvailablePaymentTaskModel[]>([])
  const [registers, setRegisters] = useValueState<AvailablePaymentRegister[]>([])
  const [movements, setMovements] = useValueState<AvailablePaymentMovement[]>([])
  const [form, setForm] = useValueState<OutcomeFormState>(() => createInitialOutcomeForm())
  const [isLoadingDictionaries, setLoadingDictionaries] = useValueState(false)
  const [isSaving, setSaving] = useValueState(false)
  const [error, setError] = useValueState<string | null>(null)

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

  useEffect(() => {
    if (outcomeModels.length === 0) {
      return
    }

    const value = form.movementSearch.trim()
    const timeoutId = window.setTimeout(() => {
      if (!value) {
        return
      }

      void searchAvailablePaymentMovements(value).then(setMovements).catch(() => undefined)
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [form.movementSearch, outcomeModels.length, setMovements])

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

  function updateForm(patch: Partial<OutcomeFormState>) {
    setForm((current) => ({ ...current, ...patch }))
  }

  function openOutcomeForm(nextModels: AvailablePaymentTaskModel[]) {
    const payableModels = nextModels.filter((model) => model.task.TaskStatus !== TaskStatusValue.Done)

    if (payableModels.length === 0) {
      setError(t('Немає платіжних задач для створення видаткового ордера'))
      return
    }

    setOutcomeModels(payableModels)
    setForm(createInitialOutcomeForm(payableModels))
    setError(null)
  }

  async function handleCashFlowTab(model: AvailablePaymentTaskModel, tab: string | null) {
    const nextTab = tab || 'invoice'
    setActiveTabs((current) => ({ ...current, [model.id]: nextTab }))

    if (nextTab !== 'cash-flow' || !model.serviceAgreementNetId || cashFlows[model.id]?.data) {
      return
    }

    setCashFlows((current) => ({
      ...current,
      [model.id]: { data: null, error: null, isLoading: true },
    }))

    try {
      const result = await getAvailablePaymentAccountingCashFlow({
        from: getDateShiftedByDays(-30),
        netId: model.serviceAgreementNetId,
        to: formatLocalDate(new Date()),
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

  async function handleMoveToDone(model: AvailablePaymentTaskModel) {
    const localFiles = filesByTaskId[model.id] || []

    if (localFiles.length === 0 && (model.task.SupplyPaymentTaskDocuments || []).length === 0) {
      setError(t('Додайте хоча б один документ'))
      return
    }

    setSaving(true)
    setError(null)

    try {
      await setAvailablePaymentTaskToActive(model.task, localFiles)
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

  function handleFilesChanged(model: AvailablePaymentTaskModel, files: File[]) {
    setFilesByTaskId((current) => ({ ...current, [model.id]: files }))
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

    const documents = outcomeModels.flatMap((model) => filesByTaskId[model.id] || [])

    setSaving(true)
    setError(null)

    try {
      await createAvailablePaymentOutcome({
        amount: form.amount,
        comment: form.comment.trim(),
        customNumber: form.customNumber.trim(),
        documents,
        fromDate: toIsoDateTime(form.date, form.time),
        isAccounting: form.isAccounting,
        isManagementAccounting: form.isManagementAccounting,
        models: outcomeModels,
        organization: selectedOrganization as AvailablePaymentsOrganization,
        paymentPurpose: form.paymentPurpose.trim(),
        selectedCurrencyRegister: selectedCurrencyRegister as AvailablePaymentCurrencyRegister,
        selectedMovement: selectedMovement as AvailablePaymentMovement,
        selectedRegister: selectedRegister as AvailablePaymentRegister,
      })
      notifications.show({ color: 'green', message: t('Видатковий ордер створено') })
      setOutcomeModels([])
      onClearMarked()
      onChanged()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося створити видатковий ордер'))
    } finally {
      setSaving(false)
    }
  }

  const title = group ? `${t('Наявні платежі')} - ${formatDate(group.PayToDate)}` : t('Наявні платежі')
  const markedInDrawer = markedModels.filter((model) => markedTaskIds.includes(model.id))

  return (
    <AppDrawer opened={Boolean(group)} position="right" size="80vw" title={title} onClose={onClose}>
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
            cashFlows={cashFlows}
            expandedId={expandedId}
            filesByTaskId={filesByTaskId}
            isSaving={isSaving}
            markedInDrawer={markedInDrawer}
            markedTaskIds={markedTaskIds}
            models={models}
            onCashFlowTab={handleCashFlowTab}
            onClearMarked={onClearMarked}
            onCreateOutcome={openOutcomeForm}
            onFilesChanged={handleFilesChanged}
            onMoveToDone={handleMoveToDone}
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
            onCancel={() => setOutcomeModels([])}
            onSubmit={handleCreateOutcome}
            updateForm={updateForm}
          />
        )}
      </Stack>
    </AppDrawer>
  )
}

function AvailablePaymentTaskList({
  activeTabs,
  cashFlows,
  expandedId,
  filesByTaskId,
  isSaving,
  markedInDrawer,
  markedTaskIds,
  models,
  onCashFlowTab,
  onClearMarked,
  onCreateOutcome,
  onFilesChanged,
  onMoveToDone,
  onToggleExpanded,
  onToggleMarked,
}: {
  activeTabs: Record<string, string>
  cashFlows: Record<string, CashFlowState>
  expandedId: string | null
  filesByTaskId: Record<string, File[]>
  isSaving: boolean
  markedInDrawer: AvailablePaymentTaskModel[]
  markedTaskIds: string[]
  models: AvailablePaymentTaskModel[]
  onCashFlowTab: (model: AvailablePaymentTaskModel, tab: string | null) => Promise<void>
  onClearMarked: () => void
  onCreateOutcome: (models: AvailablePaymentTaskModel[]) => void
  onFilesChanged: (model: AvailablePaymentTaskModel, files: File[]) => void
  onMoveToDone: (model: AvailablePaymentTaskModel) => Promise<void>
  onToggleExpanded: (model: AvailablePaymentTaskModel) => void
  onToggleMarked: (model: AvailablePaymentTaskModel) => void
}) {
  const { t } = useI18n()

  return (
    <Stack gap="sm">
      {markedInDrawer.length > 0 && (
        <Alert color="blue" icon={<IconInfoCircle size={18} />} variant="light">
          <Group justify="space-between" gap="sm">
            <Text size="sm">
              {t('Вибрано платіжних задач')}: {markedInDrawer.length}
            </Text>
            <Group gap="xs">
              <Button size="xs" variant="light" onClick={() => onCreateOutcome(markedInDrawer)}>
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
              {activeTabs[model.id] === 'cash-flow' && <CashFlowTab state={cashFlows[model.id]} />}
              {activeTabs[model.id] === 'payment' && (
                <PaymentTab
                  files={filesByTaskId[model.id] || []}
                  isSaving={isSaving}
                  model={model}
                  onCreateOutcome={() => onCreateOutcome([model])}
                  onFilesChanged={(files) => onFilesChanged(model, files)}
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

            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <NumberInput
                allowNegative={false}
                decimalScale={2}
                label={t('Сума')}
                min={0}
                value={form.amount}
                onChange={(value) => updateForm({ amount: toNumber(value) })}
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
                onSearchChange={(value) => updateForm({ movementSearch: value })}
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

  return (
    <Stack gap="md">
      <DocumentsList documents={model.documents} />
      <Table.ScrollContainer minWidth={760}>
        <Table withTableBorder withColumnBorders striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('Назва')}</Table.Th>
              <Table.Th>{t('Номер')}</Table.Th>
              <Table.Th>{t('Дата')}</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>{t('Кількість')}</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>{t('Сума')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {model.rows.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text c="dimmed" size="sm">
                    {t('Дані рахунку відсутні')}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              model.rows.map((row) => (
                <Table.Tr key={getInvoiceRowKey(model, row)}>
                  <Table.Td>{row.name || '-'}</Table.Td>
                  <Table.Td>{row.number || '-'}</Table.Td>
                  <Table.Td>{formatDate(row.date)}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{row.quantity || '-'}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{formatAmount(row.total ?? row.amount ?? row.price)}</Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Stack>
  )
}

function CashFlowTab({ state }: { state?: CashFlowState }) {
  const { t } = useI18n()

  if (!state || state.isLoading) {
    return (
      <Group justify="center" py="md">
        <Loader size="sm" />
      </Group>
    )
  }

  if (state.error) {
    return (
      <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
        {state.error}
      </Alert>
    )
  }

  const rows = extractCashFlowRows(state.data)

  return (
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
                <Table.Td>{displayValue(readUnknown(row, ['Type', 'OperationTypeName']))}</Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>{formatAmount(readUnknownNumber(row, ['Amount', 'Total']))}</Table.Td>
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
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
        <FileButton multiple onChange={(files) => onFilesChanged(files || [])}>
          {(props) => (
            <Button {...props} color="gray" leftSection={<IconFileUpload size={16} />} variant="light">
              {t('Завантажити файли')}
            </Button>
          )}
        </FileButton>
        <Group gap="xs">
          {!isDone && (
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
              <Text key={`${file.name}-${file.size}`} size="sm">
                {file.name}
              </Text>
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
      {documents.map((document) => (
        <Text key={getDocumentKey(document)} size="sm">
          {document.FileName || document.Name || document.Url || t('Документ')}
        </Text>
      ))}
    </Stack>
  )
}

function getDocumentKey(document: AvailablePaymentDocument): string {
  return String(document.NetUid || document.Id || document.FileName || document.Url || document.Name || 'document')
}

function getInvoiceRowKey(model: AvailablePaymentTaskModel, row: { date?: Date | string; name: string; number?: string; total?: number }): string {
  return `${model.id}-${row.number || row.name}-${row.date || ''}-${row.total || ''}`
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

function buildTaskModels(group: GroupedPaymentTask | null): AvailablePaymentTaskModel[] {
  if (!group?.SupplyPaymentTasks) {
    return []
  }

  return group.SupplyPaymentTasks.flatMap((task, index) => buildModelsFromTask(task, index))
}

function buildModelsFromTask(task: SupplyPaymentTask, index: number): AvailablePaymentTaskModel[] {
  const record = task as DataRecord
  const consumableOrder = asRecord(record.ConsumablesOrder)

  if (consumableOrder) {
    return [buildConsumableOrderModel(task, consumableOrder, index)]
  }

  const services = getServiceEntries(record)

  if (services.length === 0) {
    return [buildFallbackModel(task, index)]
  }

  return services.map(({ service, serviceName }, serviceIndex) =>
    buildServiceModel(task, service, serviceName, `${index}-${serviceIndex}`),
  )
}

function buildConsumableOrderModel(
  task: SupplyPaymentTask,
  consumableOrder: DataRecord,
  index: number,
): AvailablePaymentTaskModel {
  const supplierAgreement = asRecord(consumableOrder.SupplyOrganizationAgreement)
  const organization = toOrganization(asRecord(consumableOrder.ConsumableProductOrganization))
  const currency = asRecord(supplierAgreement?.Currency) as AvailablePaymentTaskModel['currency']
  const rows = readArray(consumableOrder.ConsumablesOrderItems).map((item) => {
    const product = asRecord(item.ConsumableProduct)
    const measureUnit = asRecord(product?.MeasureUnit)

    return {
      amount: toOptionalNumber(item.TotalPriceWithVAT ?? item.TotalPrice),
      name: readString(product, ['Name']) || readString(item, ['Name']),
      number: readString(product, ['VendorCode']),
      price: toOptionalNumber(item.PricePerItem),
      quantity: `${displayValue(item.Qty)}${measureUnit?.Name ? ` ${String(measureUnit.Name)}` : ''}`,
      total: toOptionalNumber(item.TotalPriceWithVAT ?? item.TotalPrice),
      vat: toOptionalNumber(item.VAT),
      vatPercent: toOptionalNumber(item.VatPercent),
    }
  })

  return {
    currency,
    currencyCode: readString(currency, ['Code', 'Name']),
    documents: readDocuments(consumableOrder.ConsumablesOrderDocuments),
    grossPrice: task.GrossPrice || readNumber(consumableOrder, ['TotalAmount']) || 0,
    id: getTaskModelId(task, `consumable-${index}`),
    organization,
    organizationName: readString(organization, ['Name', 'FullName']) || readString(consumableOrder, ['OrganizationName']),
    organizationNetUid: getEntityValue(organization),
    paidOrder: getPaidOrder(task),
    rows,
    serviceAgreementNetId: readString(supplierAgreement, ['NetUid']),
    serviceName: 'Побутові товари',
    serviceNumber: readString(consumableOrder, ['Number', 'OrganizationNumber']),
    task,
  }
}

function buildServiceModel(
  task: SupplyPaymentTask,
  service: DataRecord,
  serviceName: string,
  fallbackId: string,
): AvailablePaymentTaskModel {
  const agreement = asRecord(service.SupplyOrganizationAgreement) || asRecord(service.ClientAgreement)
  const agreementCurrency = asRecord(agreement?.Currency) || asRecord(asRecord(agreement?.Agreement)?.Currency)
  const organization = findOrganization(service)
  const grossPrice = readNumber(service, ['GrossPrice', 'Value', 'TotalPrice', 'TotalAmount']) || task.GrossPrice || 0

  return {
    currency: agreementCurrency as AvailablePaymentTaskModel['currency'],
    currencyCode: readString(agreementCurrency, ['Code', 'Name']),
    documents: readDocuments(service.InvoiceDocuments || service.BillOfLadingDocuments || service.Documents),
    grossPrice,
    id: getTaskModelId(task, fallbackId),
    organization,
    organizationName: readString(organization, ['Name', 'FullName']) || readString(service, ['OrganizationName', 'Name']),
    organizationNetUid: getEntityValue(organization),
    paidOrder: getPaidOrder(task),
    rows: [
      {
        amount: grossPrice,
        date: readUnknownDate(service, ['FromDate', 'Date']),
        name: readString(service, ['Name']) || serviceName,
        number: readString(service, ['Number', 'InvNumber', 'ServiceNumber']),
        total: grossPrice,
        vat: readNumber(service, ['Vat', 'VAT', 'VatAmount']),
        vatPercent: readNumber(service, ['VatPercent']),
      },
    ],
    serviceAgreementNetId: readString(agreement, ['NetUid']),
    serviceName,
    serviceNumber: readString(service, ['ServiceNumber', 'Number']),
    task,
  }
}

function buildFallbackModel(task: SupplyPaymentTask, index: number): AvailablePaymentTaskModel {
  return {
    currency: null,
    currencyCode: '',
    documents: readDocuments(task.SupplyPaymentTaskDocuments),
    grossPrice: task.GrossPrice || 0,
    id: getTaskModelId(task, `task-${index}`),
    organization: null,
    organizationName: '',
    organizationNetUid: '',
    paidOrder: getPaidOrder(task),
    rows: [],
    serviceAgreementNetId: '',
    serviceName: 'Платіжна задача',
    serviceNumber: readString(task as DataRecord, ['Number']),
    task,
  }
}

function getServiceEntries(task: DataRecord): Array<{ service: DataRecord; serviceName: string }> {
  const keys: Array<[string, string]> = [
    ['SupplyOrderUkrainePaymentDeliveryProtocols', 'Прихідна накладна'],
    ['CustomAgencyServices', 'Митні послуги'],
    ['VehicleDeliveryServices', 'Перевезення'],
    ['TransportationServices', 'Транспортні послуги'],
    ['PortCustomAgencyServices', 'Портові митні послуги'],
    ['PlaneDeliveryServices', 'Авіа доставка'],
    ['BrokerServices', 'Брокерські послуги'],
    ['ContainerServices', 'Контейнерні послуги'],
    ['PortWorkServices', 'Портові роботи'],
    ['BillOfLadingServices', 'Коносамент'],
    ['CustomServices', 'Митні платежі'],
    ['ExciseDutyServices', 'Акциз'],
  ]

  return keys.flatMap(([key, serviceName]) =>
    readArray(task[key])
      .map(asRecord)
      .filter((service): service is DataRecord => Boolean(service))
      .map((service) => ({ service, serviceName })),
  )
}

function findOrganization(service: DataRecord): AvailablePaymentsOrganization | null {
  const organizationKeys = [
    'Organization',
    'PayForSupplyOrganization',
    'CustomAgencyOrganization',
    'VehicleDeliveryOrganization',
    'TransportationOrganization',
    'PortCustomAgencyOrganization',
    'PlaneDeliveryOrganization',
    'ExciseDutyOrganization',
    'CustomOrganization',
  ]

  for (const key of organizationKeys) {
    const organization = toOrganization(asRecord(service[key]))

    if (organization) {
      return organization
    }
  }

  const agreementOrganization = toOrganization(asRecord(asRecord(service.SupplyOrganizationAgreement)?.Organization))

  if (agreementOrganization) {
    return agreementOrganization
  }

  return toOrganization(asRecord(asRecord(service.SupplyOrderUkraine)?.Organization))
}

function getPaidOrder(task: SupplyPaymentTask) {
  return task.OutcomePaymentOrderSupplyPaymentTasks?.[0]?.OutcomePaymentOrder || null
}

function getTaskModelId(task: SupplyPaymentTask, fallback: string): string {
  return String(task.NetUid || task.Id || fallback)
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
        : []

  return collection.map(asRecord).filter((row): row is DataRecord => Boolean(row))
}

function readDocuments(value: unknown): AvailablePaymentDocument[] {
  return readArray(value)
    .map(asRecord)
    .filter((document): document is DataRecord => Boolean(document))
    .map((document) => document as AvailablePaymentDocument)
}

function readArray(value: unknown): DataRecord[] {
  return Array.isArray(value) ? value.filter((item): item is DataRecord => Boolean(item && typeof item === 'object')) : []
}

function toOrganization(record: DataRecord | null): AvailablePaymentsOrganization | null {
  return record ? (record as AvailablePaymentsOrganization) : null
}

function asRecord(value: unknown): DataRecord | null {
  return value && typeof value === 'object' ? (value as DataRecord) : null
}

function readString(record: DataRecord | null | undefined, keys: string[]): string {
  if (!record) {
    return ''
  }

  for (const key of keys) {
    const value = record[key]

    if (typeof value === 'string' && value) {
      return value
    }

    if (typeof value === 'number') {
      return String(value)
    }
  }

  return ''
}

function readNumber(record: DataRecord | null | undefined, keys: string[]): number {
  if (!record) {
    return 0
  }

  for (const key of keys) {
    const value = record[key]

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
  }

  return 0
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
  const value = readUnknown(record, keys)

  return typeof value === 'number' ? value : undefined
}

function readUnknownDate(record: DataRecord, keys: string[]): Date | string | undefined {
  const value = readUnknown(record, keys)

  return value instanceof Date || typeof value === 'string' ? value : undefined
}

function toOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function getEntityValue(entity?: { Id?: number; NetUid?: string } | null): string {
  return String(entity?.NetUid || entity?.Id || '')
}

function getDateShiftedByDays(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)

  return date.toDateString()
}

function toIsoDateTime(dateValue: string, timeValue: string): string {
  const date = new Date(`${dateValue || formatLocalDate(new Date())}T${timeValue || '00:00'}`)

  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
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
