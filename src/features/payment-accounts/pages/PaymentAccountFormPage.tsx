import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Group,
  Loader,
  Select,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconArrowLeft, IconDeviceFloppy, IconPencil, IconRefresh, IconTrash } from '@tabler/icons-react'
import { type FormEvent, type ReactNode, useEffect, useMemo, useReducer } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { useAuth } from '../../auth/useAuth'
import {
  createPaymentAccount,
  deletePaymentAccount,
  getPaymentAccount,
  getPaymentAccountBanks,
  getPaymentAccountCurrencyActivity,
  getPaymentAccountCurrencies,
  getPaymentAccountExchanges,
  getPaymentAccountOrganizations,
  getPaymentAccountTransfers,
  updatePaymentAccount,
} from '../api/paymentAccountsApi'
import { PAYMENT_ACCOUNT_CREATE_PERMISSION, PAYMENT_ACCOUNT_EDIT_PERMISSION } from '../permissions'
import type {
  BankItem,
  Currency,
  NamedEntity,
  Organization,
  PaymentAccount,
  PaymentAccountIncomeOrder,
  PaymentAccountOutcomeOrder,
  PaymentAccountPayload,
  PaymentCurrencyRegister,
  PaymentRegisterCurrencyExchange,
  PaymentRegisterTransfer,
} from '../types'
import { PaymentRegisterTransferType, PaymentRegisterType, TransferOperationType } from '../types'

type LocationState = {
  returnPath?: string
}

type CurrencyDraft = {
  amount: string
  currency: Currency
  original?: PaymentCurrencyRegister
  selected: boolean
}

type PaymentAccountFormState = {
  accountNumber: string
  bankName: string
  city: string
  cvv: string
  fromDate: string
  isActive: boolean
  isForRetail: boolean
  name: string
  organizationNetId: string
  sortCode: string
  swiftCode: string
  type: PaymentRegisterType
  iban: string
}

type PaymentAccountPageState = {
  account: PaymentAccount
  banks: BankItem[]
  currencyDrafts: CurrencyDraft[]
  error: string | null
  form: PaymentAccountFormState
  hiddenCurrencyRegisters: PaymentCurrencyRegister[]
  isLoading: boolean
  organizations: Organization[]
}

type PaymentAccountPageStateAction =
  | Partial<PaymentAccountPageState>
  | ((state: PaymentAccountPageState) => PaymentAccountPageState)

type PaymentAccountFormHeaderState = {
  canSave: boolean
  isDeleting: boolean
  isEditing: boolean
  isEditMode: boolean
  isLoading: boolean
  isSaving: boolean
}

type PaymentAccountFormCardState = {
  account: PaymentAccount
  bankOptions: Array<{ label: string; value: string }>
  banks: BankItem[]
  canSave: boolean
  currencyDrafts: CurrencyDraft[]
  error: string | null
  form: PaymentAccountFormState
  headerState: PaymentAccountFormHeaderState
  isDeleting: boolean
  isEditMode: boolean
  isFormDisabled: boolean
  isLoading: boolean
  isSaving: boolean
  organizationOptions: Array<{ label: string; value: string }>
}

type PaymentAccountActivityTab = 'balances' | 'transfers' | 'exchanges' | 'currency'

type PaymentAccountActivityState = {
  currencyActivity: PaymentCurrencyRegister | null
  error: string | null
  exchanges: PaymentRegisterCurrencyExchange[]
  isLoading: boolean
  transfers: PaymentRegisterTransfer[]
}

type ActivityColumn<T> = {
  align?: 'left' | 'right'
  cell: (item: T) => ReactNode
  header: string
  key: string
}

type PaymentAccountActivityStateAction =
  | { type: 'failed'; error: string }
  | { type: 'loading' }
  | { type: 'reset' }
  | {
      type: 'succeeded'
      currencyActivity: PaymentCurrencyRegister | null
      exchanges: PaymentRegisterCurrencyExchange[]
      transfers: PaymentRegisterTransfer[]
    }

function pageStateReducer(
  state: PaymentAccountPageState,
  action: PaymentAccountPageStateAction,
): PaymentAccountPageState {
  if (typeof action === 'function') {
    return action(state)
  }

  return {
    ...state,
    ...action,
  }
}

function activityStateReducer(
  state: PaymentAccountActivityState,
  action: PaymentAccountActivityStateAction,
): PaymentAccountActivityState {
  switch (action.type) {
    case 'failed':
      return {
        currencyActivity: null,
        error: action.error,
        exchanges: [],
        isLoading: false,
        transfers: [],
      }
    case 'loading':
      return {
        ...state,
        error: null,
        isLoading: true,
      }
    case 'reset':
      return EMPTY_ACTIVITY_STATE
    case 'succeeded':
      return {
        currencyActivity: action.currencyActivity,
        error: null,
        exchanges: action.exchanges,
        isLoading: false,
        transfers: action.transfers,
      }
    default:
      return state
  }
}

const ACCOUNTS_PATH = '/accounting/payment-accounts'
const SKIPPED_CURRENCY_CODE = ['P', 'L', 'N'].join('')
const ACTIVITY_RANGE_DAYS = -7
const EMPTY_ACTIVITY_STATE: PaymentAccountActivityState = {
  currencyActivity: null,
  error: null,
  exchanges: [],
  isLoading: false,
  transfers: [],
}
const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
  timeStyle: 'short',
})
const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

export function PaymentAccountFormPage() {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const { id } = useParams<{ id?: string }>()
  const routeLocation = useLocation()
  const navigate = useNavigate()
  const locationState = routeLocation.state as LocationState | null
  const returnPath = locationState?.returnPath || ACCOUNTS_PATH
  const isEditMode = Boolean(id)
  const [pageState, dispatchPageState] = useReducer(pageStateReducer, true, createInitialPageState)
  const [isEditing, setEditing] = useValueState(!isEditMode)
  const [isSaving, setSaving] = useValueState(false)
  const [isDeleting, setDeleting] = useValueState(false)
  const [deleteModalOpened, setDeleteModalOpened] = useValueState(false)
  const { account, banks, currencyDrafts, error, form, hiddenCurrencyRegisters, isLoading, organizations } = pageState
  const activity = usePaymentAccountActivity({ account, id, isEditMode, t })
  const canSave = hasPermission(isEditMode ? PAYMENT_ACCOUNT_EDIT_PERMISSION : PAYMENT_ACCOUNT_CREATE_PERMISSION)
  const isFormDisabled = isLoading || isSaving || isDeleting || (isEditMode && !isEditing)

  useEffect(() => {
    const controller = new AbortController()

    dispatchPageState({ error: null, isLoading: true })

    void Promise.all([
      getPaymentAccountCurrencies(),
      getPaymentAccountOrganizations(),
      getPaymentAccountBanks(),
      id ? getPaymentAccount(id) : Promise.resolve(null),
    ])
      .then(([nextCurrencies, nextOrganizations, nextBanks, nextAccount]) => {
        if (controller.signal.aborted) {
          return
        }

        const initialAccount = nextAccount || createEmptyAccount()
        const initialOrganization = initialAccount.Organization || nextOrganizations[0] || null
        dispatchPageState({
          account: initialAccount,
          banks: nextBanks,
          currencyDrafts: toCurrencyDrafts(nextCurrencies, initialAccount.PaymentCurrencyRegisters || []),
          error: null,
          form: toFormState(initialAccount, initialOrganization),
          hiddenCurrencyRegisters: (initialAccount.PaymentCurrencyRegisters || []).filter(hasSkippedCurrencyCode),
          isLoading: false,
          organizations: includeEntity(nextOrganizations, initialOrganization),
        })
      })
      .catch((loadError: unknown) => {
        if (!isAbortError(loadError) && !controller.signal.aborted) {
          dispatchPageState({
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити рахунок'),
            isLoading: false,
          })
        }
      })

    return () => controller.abort()
  }, [id, t])

  const organizationOptions = useMemo(
    () => toSelectOptions(organizations, (organization) => organization.Name || organization.FullName),
    [organizations],
  )
  const bankOptions = useMemo(
    () => toBankOptions(banks),
    [banks],
  )
  const headerState = useMemo<PaymentAccountFormHeaderState>(
    () => ({
      canSave,
      isDeleting,
      isEditing,
      isEditMode,
      isLoading,
      isSaving,
    }),
    [canSave, isDeleting, isEditing, isEditMode, isLoading, isSaving],
  )
  const selectedOrganization = useMemo(
    () => organizations.find((organization) => getEntityValue(organization) === form.organizationNetId) || null,
    [form.organizationNetId, organizations],
  )
  if (isEditMode && !id) {
    return <Navigate replace to={ACCOUNTS_PATH} />
  }

  function updateForm(patch: Partial<PaymentAccountFormState>) {
    dispatchPageState((current) => ({ ...current, form: { ...current.form, ...patch } }))
  }

  function cancelEdit() {
    dispatchPageState((current) => {
      const organization = current.account.Organization || current.organizations[0] || null

      return {
        ...current,
        currencyDrafts: toCurrencyDrafts(current.currencyDrafts.map((draft) => draft.currency), current.account.PaymentCurrencyRegisters || []),
        error: null,
        form: toFormState(current.account, organization),
        hiddenCurrencyRegisters: (current.account.PaymentCurrencyRegisters || []).filter(hasSkippedCurrencyCode),
        organizations: includeEntity(current.organizations, organization),
      }
    })
    setEditing(false)
  }

  function setAccountType(value: string) {
    const nextType = Number(value) as PaymentRegisterType

    dispatchPageState((current) => ({
      ...current,
      currencyDrafts: current.currencyDrafts.map((draft) => ({ ...draft, selected: false })),
      form: { ...current.form, type: nextType },
    }))
  }

  function updateCurrency(index: number, patch: Partial<CurrencyDraft>) {
    dispatchPageState((current) => {
      const nextCurrencyDrafts = (() => {
        if (current.form.type === PaymentRegisterType.Cash || !patch.selected) {
          return current.currencyDrafts.map((draft, draftIndex) => (draftIndex === index ? { ...draft, ...patch } : draft))
        }

        return current.currencyDrafts.map((draft, draftIndex) => ({
          ...draft,
          selected: draftIndex === index,
          ...(draftIndex === index ? patch : {}),
        }))
      })()

      return {
        ...current,
        currencyDrafts: nextCurrencyDrafts,
      }
    })
  }

  function handleCancel() {
    if (isSaving || isDeleting) {
      return
    }

    navigate(returnPath, { replace: true })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isEditMode && !isEditing) {
      return
    }

    const validationError = validateForm(form, currencyDrafts, selectedOrganization, canSave, isEditMode, t)

    if (validationError) {
      dispatchPageState({ error: validationError })
      return
    }

    const payload = toPayload(account, form, selectedOrganization as Organization, currencyDrafts, hiddenCurrencyRegisters, isEditMode)
    setSaving(true)
    dispatchPageState({ error: null })

    try {
      const savedAccount = isEditMode ? await updatePaymentAccount(payload) : await createPaymentAccount(payload)
      const nextAccount = savedAccount || payload
      dispatchPageState((current) => ({
        ...current,
        account: nextAccount,
        currencyDrafts: toCurrencyDrafts(current.currencyDrafts.map((draft) => draft.currency), nextAccount.PaymentCurrencyRegisters || []),
        form: toFormState(nextAccount, nextAccount.Organization || selectedOrganization),
        hiddenCurrencyRegisters: (nextAccount.PaymentCurrencyRegisters || []).filter(hasSkippedCurrencyCode),
      }))
      setEditing(!isEditMode)
      notifications.show({
        color: 'green',
        message: isEditMode ? t('Рахунок оновлено') : t('Рахунок створено'),
      })
      navigate(isEditMode || !nextAccount.NetUid ? returnPath : `${ACCOUNTS_PATH}/edit/${nextAccount.NetUid}`, { replace: true })
    } catch (saveError) {
      dispatchPageState({
        error: saveError instanceof Error ? saveError.message : t('Не вдалося зберегти рахунок'),
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    const netId = account.NetUid || id

    if (!netId) {
      return
    }

    setDeleting(true)
    dispatchPageState({ error: null })

    try {
      await deletePaymentAccount(netId)
      notifications.show({ color: 'green', message: t('Рахунок видалено') })
      navigate(returnPath, { replace: true })
    } catch (deleteError) {
      dispatchPageState({
        error: deleteError instanceof Error ? deleteError.message : t('Не вдалося видалити рахунок'),
      })
    } finally {
      setDeleting(false)
      setDeleteModalOpened(false)
    }
  }

  return (
    <Stack gap="md">
      <PaymentAccountFormCard
        state={{
          account,
          bankOptions,
          banks,
          canSave,
          currencyDrafts,
          error,
          form,
          headerState,
          isDeleting,
          isEditMode,
          isFormDisabled,
          isLoading,
          isSaving,
          organizationOptions,
        }}
        onCancel={handleCancel}
        onCancelEdit={cancelEdit}
        onChangeCurrency={updateCurrency}
        onChangeForm={updateForm}
        onEdit={() => setEditing(true)}
        onOpenCurrencyActivity={(register) => {
          activity.setSelectedCurrencyRegisterNetId(getEntityValue(register))
          activity.setActiveActivityTab('currency')
        }}
        onOpenDelete={() => setDeleteModalOpened(true)}
        onSetAccountType={setAccountType}
        onSubmit={handleSubmit}
      />

      {isEditMode && (
        <PaymentAccountActivityPanel
          account={account}
          activeTab={activity.activeActivityTab}
          from={activity.activityFrom}
          isLoadingAccount={isLoading}
          selectedCurrencyRegister={activity.selectedCurrencyRegister}
          state={activity.activityState}
          to={activity.activityTo}
          onActiveTabChange={activity.setActiveActivityTab}
          onFromChange={activity.setActivityFrom}
          onOpenIncome={() => openRegisterScopedPage(navigate, '/accounting/income-cashflows', account)}
          onOpenOutgoing={() => openRegisterScopedPage(navigate, '/accounting/outgoing-cashflow', account)}
          onRefresh={activity.reloadActivity}
          onSelectedCurrencyChange={activity.setSelectedCurrencyRegisterNetId}
          onToChange={activity.setActivityTo}
        />
      )}

      <AppModal
        centered
        opened={deleteModalOpened}
        title={t('Видалити рахунок')}
        onClose={() => setDeleteModalOpened(false)}
      >
        <Stack gap="md">
          <Text>
            {t('Видалити рахунок')} <Text span fw={600}>{form.name || t('Без назви')}</Text>?
          </Text>
          <Group justify="flex-end">
            <Button color="gray" disabled={isDeleting} variant="light" onClick={() => setDeleteModalOpened(false)}>
              {t('Скасувати')}
            </Button>
            <Button color="red" leftSection={<IconTrash size={16} />} loading={isDeleting} onClick={handleDelete}>
              {t('Видалити')}
            </Button>
          </Group>
        </Stack>
      </AppModal>
    </Stack>
  )
}

function usePaymentAccountActivity({
  account,
  id,
  isEditMode,
  t,
}: {
  account: PaymentAccount
  id?: string
  isEditMode: boolean
  t: (value: string) => string
}) {
  const [activeActivityTab, setActiveActivityTab] = useValueState<PaymentAccountActivityTab>('balances')
  const [activityFrom, setActivityFrom] = useValueState(() => getDateShiftedByDays(ACTIVITY_RANGE_DAYS))
  const [activityTo, setActivityTo] = useValueState(() => formatLocalDate(new Date()))
  const [selectedCurrencyRegisterNetId, setSelectedCurrencyRegisterNetId] = useValueState('')
  const [activityState, dispatchActivityState] = useReducer(activityStateReducer, EMPTY_ACTIVITY_STATE)
  const [activityReloadKey, reloadActivity] = useReducer((key: number) => key + 1, 0)
  const visibleCurrencyRegisters = useMemo(
    () => (account.PaymentCurrencyRegisters || []).filter((register) => !hasSkippedCurrencyCode(register)),
    [account.PaymentCurrencyRegisters],
  )
  const selectedCurrencyRegister = useMemo(
    () =>
      visibleCurrencyRegisters.find((register) => getEntityValue(register) === selectedCurrencyRegisterNetId) ||
      visibleCurrencyRegisters.find((register) => register.NetUid) ||
      visibleCurrencyRegisters[0] ||
      null,
    [selectedCurrencyRegisterNetId, visibleCurrencyRegisters],
  )

  useEffect(() => {
    const accountNetId = account.NetUid || id || ''

    if (!isEditMode || !accountNetId) {
      dispatchActivityState({ type: 'reset' })
      return
    }

    let isActive = true

    dispatchActivityState({ type: 'loading' })

    void Promise.all([
      getPaymentAccountTransfers({
        from: activityFrom,
        netId: accountNetId,
        to: activityTo,
        type: PaymentRegisterTransferType.All,
      }),
      getPaymentAccountExchanges({
        from: activityFrom,
        netId: accountNetId,
        to: activityTo,
      }),
      selectedCurrencyRegister?.NetUid
        ? getPaymentAccountCurrencyActivity({
            currencyRegisterNetId: selectedCurrencyRegister.NetUid,
            from: activityFrom,
            to: activityTo,
          })
        : Promise.resolve(null),
    ])
      .then(([transfers, exchanges, currencyActivity]) => {
        if (isActive) {
          dispatchActivityState({
            currencyActivity,
            exchanges,
            transfers,
            type: 'succeeded',
          })
        }
      })
      .catch((activityError: unknown) => {
        if (isActive) {
          dispatchActivityState({
            error: activityError instanceof Error ? activityError.message : t('Не вдалося завантажити активність рахунку'),
            type: 'failed',
          })
        }
      })

    return () => {
      isActive = false
    }
  }, [
    account.NetUid,
    activityFrom,
    activityReloadKey,
    activityTo,
    id,
    isEditMode,
    selectedCurrencyRegister?.NetUid,
    t,
  ])

  return {
    activeActivityTab,
    activityFrom,
    activityState,
    activityTo,
    reloadActivity,
    selectedCurrencyRegister,
    setActiveActivityTab,
    setActivityFrom,
    setActivityTo,
    setSelectedCurrencyRegisterNetId,
  }
}

function PaymentAccountFormCard({
  state,
  onCancel,
  onCancelEdit,
  onChangeCurrency,
  onChangeForm,
  onEdit,
  onOpenCurrencyActivity,
  onOpenDelete,
  onSetAccountType,
  onSubmit,
}: {
  state: PaymentAccountFormCardState
  onCancel: () => void
  onCancelEdit: () => void
  onChangeCurrency: (index: number, patch: Partial<CurrencyDraft>) => void
  onChangeForm: (patch: Partial<PaymentAccountFormState>) => void
  onEdit: () => void
  onOpenCurrencyActivity: (register: PaymentCurrencyRegister) => void
  onOpenDelete: () => void
  onSetAccountType: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const { t } = useI18n()
  const {
    account,
    bankOptions,
    banks,
    canSave,
    currencyDrafts,
    error,
    form,
    headerState,
    isDeleting,
    isEditMode,
    isFormDisabled,
    isLoading,
    isSaving,
    organizationOptions,
  } = state

  return (
    <Card withBorder radius="md" shadow="sm">
      <form onSubmit={onSubmit}>
        <Stack gap="md">
          <PaymentAccountFormHeader
            state={headerState}
            onCancel={onCancel}
            onCancelEdit={onCancelEdit}
            onEdit={onEdit}
            onOpenDelete={onOpenDelete}
          />

          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {error}
            </Alert>
          )}

          {!canSave && (
            <Alert color="yellow" icon={<IconAlertCircle size={18} />} variant="light">
              {t('Немає прав для збереження рахунку')}
            </Alert>
          )}

          <SegmentedControl
            data={[
              { label: t('Каса'), value: String(PaymentRegisterType.Cash) },
              { label: t('Банківська картка'), value: String(PaymentRegisterType.Card) },
              { label: t('Банк'), value: String(PaymentRegisterType.Bank) },
            ]}
            disabled={isLoading || isSaving || isDeleting || isEditMode}
            value={String(form.type)}
            onChange={onSetAccountType}
          />

          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <TextInput
              disabled={isFormDisabled}
              label={t('Назва')}
              required
              value={form.name}
              onChange={(event) => onChangeForm({ name: event.currentTarget.value })}
            />
            <Select
              data={organizationOptions}
              disabled={isFormDisabled || (isEditMode && form.type !== PaymentRegisterType.Bank)}
              label={t('Організація')}
              required
              searchable
              value={form.organizationNetId || null}
              onChange={(value) => onChangeForm({ organizationNetId: value || '' })}
            />
          </SimpleGrid>

          {form.type === PaymentRegisterType.Bank && (
            <BankFields
              banks={banks}
              bankOptions={bankOptions}
              disabled={isFormDisabled}
              form={form}
              onChange={onChangeForm}
            />
          )}

          {form.type === PaymentRegisterType.Card && (
            <CardFields
              bankOptions={bankOptions}
              disabled={isFormDisabled}
              form={form}
              onChange={onChangeForm}
            />
          )}

          <Divider />
          <CurrencySelector
            drafts={currencyDrafts}
            isEditMode={isEditMode}
            isSingle={form.type !== PaymentRegisterType.Cash}
            isDisabled={isLoading || isSaving || isDeleting}
            onChange={onChangeCurrency}
            onOpenCurrencyActivity={onOpenCurrencyActivity}
          />
          {isEditMode && (
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <InfoCell label={t('Всього в EUR')} value={formatMoney(account.TotalEuroAmount)} />
              <InfoCell label={t('Тип')} value={getPaymentRegisterTypeLabel(form.type, t)} />
              <InfoCell label={t('Статус')} value={form.isActive ? t('Основний') : t('Звичайний')} />
            </SimpleGrid>
          )}
        </Stack>
      </form>
    </Card>
  )
}

function PaymentAccountFormHeader({
  state,
  onCancel,
  onCancelEdit,
  onEdit,
  onOpenDelete,
}: {
  state: PaymentAccountFormHeaderState
  onCancel: () => void
  onCancelEdit: () => void
  onEdit: () => void
  onOpenDelete: () => void
}) {
  const { t } = useI18n()
  const { canSave, isDeleting, isEditing, isEditMode, isLoading, isSaving } = state

  return (
    <Group justify="space-between" wrap="wrap">
      <div>
        <Text fw={700} size="xl">
          {isEditMode ? t('Редагування рахунку') : t('Новий рахунок')}
        </Text>
      </div>

      <Group gap="xs">
        <Button color="gray" leftSection={<IconArrowLeft size={16} />} type="button" variant="light" onClick={onCancel}>
          {t('Назад')}
        </Button>
        {isEditMode && canSave && !isEditing && (
          <Button
            color="violet"
            disabled={isLoading || isSaving || isDeleting}
            leftSection={<IconPencil size={16} />}
            type="button"
            onClick={onEdit}
          >
            {t('Редагувати')}
          </Button>
        )}
        {isEditMode && canSave && isEditing && (
          <Button
            color="red"
            disabled={isLoading || isSaving}
            leftSection={<IconTrash size={16} />}
            loading={isDeleting}
            type="button"
            variant="light"
            onClick={onOpenDelete}
          >
            {t('Видалити')}
          </Button>
        )}
        {isEditMode && isEditing && (
          <Button color="gray" disabled={isLoading || isSaving || isDeleting} type="button" variant="light" onClick={onCancelEdit}>
            {t('Скасувати')}
          </Button>
        )}
        {(!isEditMode || isEditing) && (
          <Button
            color="violet"
            disabled={isLoading || !canSave}
            leftSection={<IconDeviceFloppy size={16} />}
            loading={isSaving}
            type="submit"
          >
            {t('Зберегти')}
          </Button>
        )}
      </Group>
    </Group>
  )
}

function BankFields({
  banks,
  bankOptions,
  disabled,
  form,
  onChange,
}: {
  banks: BankItem[]
  bankOptions: Array<{ label: string; value: string }>
  disabled: boolean
  form: PaymentAccountFormState
  onChange: (patch: Partial<PaymentAccountFormState>) => void
}) {
  const { t } = useI18n()

  return (
    <SimpleGrid cols={{ base: 1, md: 2 }}>
      <Select
        clearable
        data={bankOptions}
        disabled={disabled}
        label={t('Банк')}
        searchable
        value={form.bankName || null}
        onChange={(value) => {
          const bank = banks.find((item) => item.Name === value) || null

          onChange({
            bankName: value || '',
            city: bank?.City || form.city,
          })
        }}
      />
      <TextInput
        disabled={disabled}
        label={t('Дата відкриття')}
        type="date"
        value={toDateInputValue(form.fromDate)}
        onChange={(event) => onChange({ fromDate: event.currentTarget.value })}
      />
      <TextInput disabled={disabled} label={t('Номер рахунку')} value={form.accountNumber} onChange={(event) => onChange({ accountNumber: event.currentTarget.value })} />
      <TextInput disabled={disabled} label={t('BIC')} value={form.sortCode} onChange={(event) => onChange({ sortCode: event.currentTarget.value })} />
      <TextInput disabled={disabled} label={t('IBAN')} value={form.iban} onChange={(event) => onChange({ iban: event.currentTarget.value })} />
      <TextInput disabled={disabled} label={t('Swift')} value={form.swiftCode} onChange={(event) => onChange({ swiftCode: event.currentTarget.value })} />
      <TextInput disabled={disabled} label={t('Місто')} value={form.city} onChange={(event) => onChange({ city: event.currentTarget.value })} />
      <Checkbox
        checked={form.isActive}
        disabled={disabled}
        label={t('Основний')}
        mt="lg"
        onChange={(event) => onChange({ isActive: event.currentTarget.checked })}
      />
    </SimpleGrid>
  )
}

function CardFields({
  bankOptions,
  disabled,
  form,
  onChange,
}: {
  bankOptions: Array<{ label: string; value: string }>
  disabled: boolean
  form: PaymentAccountFormState
  onChange: (patch: Partial<PaymentAccountFormState>) => void
}) {
  const { t } = useI18n()

  return (
    <SimpleGrid cols={{ base: 1, md: 2 }}>
      <Select
        clearable
        data={bankOptions}
        disabled={disabled}
        label={t('Банк')}
        required
        searchable
        value={form.bankName || null}
        onChange={(value) => onChange({ bankName: value || '' })}
      />
      <TextInput
        disabled={disabled}
        label={t('Номер картки')}
        required
        value={form.accountNumber}
        onChange={(event) => onChange({ accountNumber: event.currentTarget.value })}
      />
      <TextInput
        disabled={disabled}
        label={t('Термін дії')}
        required
        type="month"
        value={toMonthInputValue(form.fromDate)}
        onChange={(event) => onChange({ fromDate: event.currentTarget.value })}
      />
      <TextInput
        disabled={disabled}
        label="CVV"
        maxLength={3}
        value={form.cvv}
        onChange={(event) => onChange({ cvv: event.currentTarget.value })}
      />
      <Checkbox
        checked={form.isForRetail}
        disabled={disabled}
        label={t('Для інтернет-магазину')}
        mt="lg"
        onChange={(event) => onChange({ isForRetail: event.currentTarget.checked })}
      />
    </SimpleGrid>
  )
}

function CurrencySelector({
  drafts,
  isEditMode,
  isDisabled,
  isSingle,
  onChange,
  onOpenCurrencyActivity,
}: {
  drafts: CurrencyDraft[]
  isEditMode: boolean
  isDisabled: boolean
  isSingle: boolean
  onChange: (index: number, patch: Partial<CurrencyDraft>) => void
  onOpenCurrencyActivity: (register: PaymentCurrencyRegister) => void
}) {
  const { t } = useI18n()
  const visibleDrafts = drafts.filter((draft) => isEditMode ? shouldShowCurrencyBalance(draft) : true)

  return (
    <Stack gap="sm">
      <Group gap="xs">
        <Text fw={700}>{t('Валюти')}</Text>
        {isSingle && (
          <Badge color="gray" variant="light">
            {t('Одна валюта')}
          </Badge>
        )}
      </Group>
      {visibleDrafts.length === 0 && (
        <Text c="dimmed" size="sm">
          {t('Валюти відсутні')}
        </Text>
      )}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {visibleDrafts.map((draft) => {
          const index = drafts.indexOf(draft)
          const label = draft.currency.Code || draft.currency.Name || t('Валюта')

          if (isEditMode) {
            return (
              <Card
                key={draft.original?.NetUid || draft.original?.Id || draft.currency.NetUid || draft.currency.Id || draft.currency.Code}
                withBorder
                radius="sm"
                padding="sm"
              >
                <Group justify="space-between" gap="xs" wrap="nowrap">
                  <Stack gap={2}>
                    <Text fw={600} size="sm">
                      {label}
                    </Text>
                    <Text c="dimmed" size="xs">
                      {draft.currency.Name || label}
                    </Text>
                  </Stack>
                  <Text fw={700}>{formatMoney(parseAmount(draft.amount))}</Text>
                </Group>
                {draft.original?.NetUid && (
                  <Button
                    disabled={isDisabled}
                    fullWidth
                    mt="xs"
                    size="xs"
                    type="button"
                    variant="light"
                    onClick={() => onOpenCurrencyActivity(draft.original as PaymentCurrencyRegister)}
                  >
                    {t('Рух валюти')}
                  </Button>
                )}
              </Card>
            )
          }

          return (
            <Card key={draft.currency.NetUid || draft.currency.Id || draft.currency.Code || index} withBorder radius="sm" padding="sm">
              <Stack gap="xs">
                <Checkbox
                  checked={draft.selected}
                  disabled={isDisabled}
                  label={label}
                  onChange={(event) => onChange(index, { selected: event.currentTarget.checked })}
                />
                <TextInput
                  disabled={isDisabled || !draft.selected}
                  inputMode="decimal"
                  label={t('Сума')}
                  maxLength={14}
                  value={draft.amount}
                  onChange={(event) => onChange(index, { amount: event.currentTarget.value.slice(0, 14) })}
                />
              </Stack>
            </Card>
          )
        })}
      </SimpleGrid>
    </Stack>
  )
}

function PaymentAccountActivityPanel({
  account,
  activeTab,
  from,
  isLoadingAccount,
  selectedCurrencyRegister,
  state,
  to,
  onActiveTabChange,
  onFromChange,
  onOpenIncome,
  onOpenOutgoing,
  onRefresh,
  onSelectedCurrencyChange,
  onToChange,
}: {
  account: PaymentAccount
  activeTab: PaymentAccountActivityTab
  from: string
  isLoadingAccount: boolean
  selectedCurrencyRegister: PaymentCurrencyRegister | null
  state: PaymentAccountActivityState
  to: string
  onActiveTabChange: (tab: PaymentAccountActivityTab) => void
  onFromChange: (value: string) => void
  onOpenIncome: () => void
  onOpenOutgoing: () => void
  onRefresh: () => void
  onSelectedCurrencyChange: (value: string) => void
  onToChange: (value: string) => void
}) {
  const { t } = useI18n()
  const currencyOptions = getCurrencyRegisterOptions(account.PaymentCurrencyRegisters || [])

  return (
    <Card withBorder radius="md" shadow="sm">
      <Stack gap="md">
        <Group justify="space-between" wrap="wrap">
          <Group gap="xs">
            <Text fw={700}>{t('Операції')}</Text>
            <Badge color="gray" variant="light">
              {formatDate(from)} - {formatDate(to)}
            </Badge>
          </Group>
          <Group gap="xs">
            <Button color="green" disabled={!account.NetUid} size="xs" variant="light" onClick={onOpenIncome}>
              {t('Прихід')}
            </Button>
            <Button color="red" disabled={!account.NetUid} size="xs" variant="light" onClick={onOpenOutgoing}>
              {t('Розхід')}
            </Button>
            <Button
              color="gray"
              disabled={isLoadingAccount}
              leftSection={<IconRefresh size={16} />}
              loading={state.isLoading}
              size="xs"
              type="button"
              variant="light"
              onClick={onRefresh}
            >
              {t('Оновити')}
            </Button>
          </Group>
        </Group>

        <Group align="end" gap="sm" wrap="wrap">
          <TextInput label={t('З')} type="date" value={from} w={150} onChange={(event) => onFromChange(event.currentTarget.value)} />
          <TextInput label={t('По')} type="date" value={to} w={150} onChange={(event) => onToChange(event.currentTarget.value)} />
        </Group>

        {state.error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {state.error}
          </Alert>
        )}

        <Tabs value={activeTab} onChange={(value) => value && onActiveTabChange(value as PaymentAccountActivityTab)}>
          <Tabs.List>
            <Tabs.Tab value="balances">{t('Залишки')}</Tabs.Tab>
            <Tabs.Tab value="transfers">{t('Перекази')}</Tabs.Tab>
            <Tabs.Tab value="exchanges">{t('Обмін валют')}</Tabs.Tab>
            <Tabs.Tab value="currency">{t('Рух валюти')}</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="balances" pt="md">
            <PaymentAccountBalancesView
              account={account}
              selectedCurrencyRegister={selectedCurrencyRegister}
              onSelectedCurrencyChange={onSelectedCurrencyChange}
              onShowCurrency={() => onActiveTabChange('currency')}
            />
          </Tabs.Panel>

          <Tabs.Panel value="transfers" pt="md">
            <ActivityTable
              columns={getTransferColumns(account, t)}
              emptyText={t('Перекази відсутні')}
              getRowKey={(item, index) => getEntityValue(item) || `transfer-${index}`}
              isLoading={state.isLoading}
              rows={state.transfers}
            />
          </Tabs.Panel>

          <Tabs.Panel value="exchanges" pt="md">
            <ActivityTable
              columns={getExchangeColumns(account, t)}
              emptyText={t('Обмін валют відсутній')}
              getRowKey={(item, index) => getEntityValue(item) || `exchange-${index}`}
              isLoading={state.isLoading}
              rows={state.exchanges}
            />
          </Tabs.Panel>

          <Tabs.Panel value="currency" pt="md">
            <Stack gap="md">
              <Select
                data={currencyOptions}
                label={t('Валюта')}
                value={selectedCurrencyRegister ? getEntityValue(selectedCurrencyRegister) : null}
                w={{ base: '100%', sm: 280 }}
                onChange={(value) => onSelectedCurrencyChange(value || '')}
              />
              <PaymentCurrencyActivityView activity={state.currencyActivity} isLoading={state.isLoading} />
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Card>
  )
}

function PaymentAccountBalancesView({
  account,
  selectedCurrencyRegister,
  onSelectedCurrencyChange,
  onShowCurrency,
}: {
  account: PaymentAccount
  selectedCurrencyRegister: PaymentCurrencyRegister | null
  onSelectedCurrencyChange: (value: string) => void
  onShowCurrency: () => void
}) {
  const { t } = useI18n()
  const registers = (account.PaymentCurrencyRegisters || []).filter((register) => !hasSkippedCurrencyCode(register))

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <InfoCell label={t('Всього в EUR')} value={formatMoney(account.TotalEuroAmount)} />
        <InfoCell label={t('Організація')} value={displayValue(account.Organization?.Name || account.Organization?.FullName)} />
        <InfoCell label={t('Рахунок')} value={displayValue(account.Name)} />
      </SimpleGrid>
      <ActivityTable
        columns={[
          { key: 'currency', header: t('Валюта'), cell: (register) => displayValue(getCurrencyLabel(register)) },
          { key: 'amount', header: t('Сума'), align: 'right', cell: (register) => formatMoney(register.Amount) },
          {
            key: 'selected',
            header: '',
            align: 'right',
            cell: (register) => (
              <Button
                disabled={!register.NetUid}
                size="xs"
                variant={selectedCurrencyRegister?.NetUid === register.NetUid ? 'filled' : 'light'}
                onClick={() => {
                  onSelectedCurrencyChange(getEntityValue(register))
                  onShowCurrency()
                }}
              >
                {t('Рух')}
              </Button>
            ),
          },
        ]}
        emptyText={t('Валюти відсутні')}
        getRowKey={(item, index) => getEntityValue(item) || `currency-${index}`}
        rows={registers}
      />
    </Stack>
  )
}

function PaymentCurrencyActivityView({
  activity,
  isLoading,
}: {
  activity: PaymentCurrencyRegister | null
  isLoading: boolean
}) {
  const { t } = useI18n()
  const incomeOrders = activity?.PaymentRegister?.IncomePaymentOrders || activity?.IncomePaymentOrders || []
  const outcomeOrders = activity?.OutcomePaymentOrders || activity?.PaymentRegister?.OutcomePaymentOrders || []

  return (
    <Stack gap="md">
      <ActivityTable
        columns={getTransferColumns(activity?.PaymentRegister || null, t)}
        emptyText={t('Перекази відсутні')}
        getRowKey={(item, index) => getEntityValue(item) || `currency-transfer-${index}`}
        isLoading={isLoading}
        rows={activity?.PaymentRegisterTransfers || []}
      />
      <ActivityTable
        columns={getIncomeColumns(t)}
        emptyText={t('Прихід відсутній')}
        getRowKey={(item, index) => getEntityValue(item) || `income-${index}`}
        isLoading={isLoading}
        rows={incomeOrders}
        title={t('Прихід')}
      />
      <ActivityTable
        columns={getOutcomeColumns(t)}
        emptyText={t('Розхід відсутній')}
        getRowKey={(item, index) => getEntityValue(item) || `outcome-${index}`}
        isLoading={isLoading}
        rows={outcomeOrders}
        title={t('Розхід')}
      />
      <ActivityTable
        columns={getExchangeColumns(activity?.PaymentRegister || null, t)}
        emptyText={t('Обмін валют відсутній')}
        getRowKey={(item, index) => getEntityValue(item) || `currency-exchange-${index}`}
        isLoading={isLoading}
        rows={activity?.PaymentRegisterCurrencyExchanges || []}
        title={t('Обмін валют')}
      />
    </Stack>
  )
}

function ActivityTable<T>({
  columns,
  emptyText,
  getRowKey,
  isLoading = false,
  rows,
  title,
}: {
  columns: ActivityColumn<T>[]
  emptyText: string
  getRowKey: (item: T, index: number) => string
  isLoading?: boolean
  rows: T[]
  title?: string
}) {
  if (isLoading) {
    return (
      <Group justify="center" py="md">
        <Loader size="sm" />
      </Group>
    )
  }

  return (
    <Stack gap="xs">
      {title && <Text fw={600}>{title}</Text>}
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
            {rows.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={columns.length}>
                  <Text c="dimmed" size="sm">
                    {emptyText}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              rows.map((row, rowIndex) => (
                <Table.Tr key={getRowKey(row, rowIndex)}>
                  {columns.map((column) => (
                    <Table.Td key={column.key} style={{ textAlign: column.align === 'right' ? 'right' : 'left' }}>
                      {column.cell(row)}
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

function getTransferColumns(
  account: PaymentAccount | null,
  t: (value: string) => string,
): ActivityColumn<PaymentRegisterTransfer>[] {
  return [
    { key: 'fromDate', header: t('Дата'), cell: (transfer) => formatDateTime(transfer.FromDate) },
    { key: 'number', header: t('Номер'), cell: (transfer) => displayValue(transfer.Number) },
    { key: 'status', header: t('Статус'), cell: (transfer) => <CanceledBadge canceled={Boolean(transfer.IsCanceled)} /> },
    { key: 'operation', header: t('Операція'), cell: (transfer) => getPaymentRegisterTransferTypeLabel(transfer.Type, t) },
    { key: 'from', header: t('З рахунку'), cell: (transfer) => displayValue(transfer.FromPaymentCurrencyRegister?.PaymentRegister?.Name) },
    { key: 'to', header: t('На рахунок'), cell: (transfer) => displayValue(transfer.ToPaymentCurrencyRegister?.PaymentRegister?.Name) },
    { key: 'type', header: t('Тип операції'), cell: (transfer) => getTransferOperationLabel(transfer, account, t) },
    { key: 'amount', header: t('Сума'), align: 'right', cell: (transfer) => formatMoney(transfer.Amount) },
    { key: 'currency', header: t('Валюта'), cell: (transfer) => displayValue(transfer.FromPaymentCurrencyRegister?.Currency?.Code) },
    { key: 'movement', header: t('Стаття руху'), cell: (transfer) => displayValue(getPaymentMovementName(transfer.PaymentMovementOperation)) },
    { key: 'user', header: t('Відповідальний'), cell: (transfer) => displayValue(getPersonName(transfer.User)) },
    { key: 'comment', header: t('Коментар'), cell: (transfer) => displayValue(transfer.Comment) },
  ]
}

function getExchangeColumns(
  account: PaymentAccount | null,
  t: (value: string) => string,
): ActivityColumn<PaymentRegisterCurrencyExchange>[] {
  return [
    { key: 'fromDate', header: t('Дата'), cell: (exchange) => formatDateTime(exchange.FromDate) },
    { key: 'number', header: t('Номер'), cell: (exchange) => displayValue(exchange.Number) },
    { key: 'incomeNumber', header: t('Вхідний номер'), cell: (exchange) => displayValue(exchange.IncomeNumber) },
    { key: 'status', header: t('Статус'), cell: (exchange) => <CanceledBadge canceled={Boolean(exchange.IsCanceled)} /> },
    { key: 'operation', header: t('Операція'), cell: (exchange) => getExchangeOperationLabel(exchange, account, t) },
    { key: 'from', header: t('З рахунку'), cell: (exchange) => displayValue(exchange.FromPaymentCurrencyRegister?.PaymentRegister?.Name) },
    { key: 'to', header: t('На рахунок'), cell: (exchange) => displayValue(exchange.ToPaymentCurrencyRegister?.PaymentRegister?.Name) },
    { key: 'amount', header: t('Сума'), align: 'right', cell: (exchange) => formatExchangeAmount(exchange, account) },
    { key: 'currency', header: t('Валюта'), cell: (exchange) => displayValue(getExchangeCurrencyCode(exchange, account)) },
    { key: 'rate', header: t('Курс'), align: 'right', cell: (exchange) => displayValue(exchange.ExchangeRate) },
    { key: 'user', header: t('Відповідальний'), cell: (exchange) => displayValue(getPersonName(exchange.User)) },
    { key: 'comment', header: t('Коментар'), cell: (exchange) => displayValue(exchange.Comment) },
  ]
}

function getIncomeColumns(t: (value: string) => string): ActivityColumn<PaymentAccountIncomeOrder>[] {
  return [
    { key: 'fromDate', header: t('Дата'), cell: (income) => formatDateTime(income.FromDate) },
    { key: 'number', header: t('Номер'), cell: (income) => displayValue(income.Number) },
    { key: 'status', header: t('Статус'), cell: (income) => <CanceledBadge canceled={Boolean(income.IsCanceled)} /> },
    { key: 'payer', header: t('Платник'), cell: (income) => displayValue(getIncomePayerName(income)) },
    { key: 'amount', header: t('Сума'), align: 'right', cell: (income) => formatMoney(income.Amount) },
    { key: 'currency', header: t('Валюта'), cell: (income) => displayValue(income.Currency?.Code) },
    { key: 'movement', header: t('Стаття руху'), cell: (income) => displayValue(getPaymentMovementName(income.PaymentMovementOperation)) },
    { key: 'organization', header: t('Організація'), cell: (income) => displayValue(income.Organization?.Name) },
    { key: 'user', header: t('Відповідальний'), cell: (income) => displayValue(getPersonName(income.User)) },
    { key: 'comment', header: t('Коментар'), cell: (income) => displayValue(income.Comment) },
  ]
}

function getOutcomeColumns(t: (value: string) => string): ActivityColumn<PaymentAccountOutcomeOrder>[] {
  return [
    { key: 'fromDate', header: t('Дата'), cell: (outcome) => formatDateTime(outcome.FromDate) },
    { key: 'number', header: t('Номер'), cell: (outcome) => displayValue(outcome.Number) },
    { key: 'status', header: t('Статус'), cell: (outcome) => <CanceledBadge canceled={Boolean(outcome.IsCanceled)} /> },
    { key: 'payee', header: t('Одержувач'), cell: (outcome) => displayValue(getOutcomePayeeName(outcome)) },
    { key: 'amount', header: t('Сума'), align: 'right', cell: (outcome) => formatMoney(outcome.Amount) },
    { key: 'currency', header: t('Валюта'), cell: (outcome) => displayValue(outcome.PaymentCurrencyRegister?.Currency?.Code) },
    { key: 'movement', header: t('Стаття руху'), cell: (outcome) => displayValue(getPaymentMovementName(outcome.PaymentMovementOperation)) },
    { key: 'organization', header: t('Організація'), cell: (outcome) => displayValue(outcome.Organization?.Name) },
    { key: 'user', header: t('Відповідальний'), cell: (outcome) => displayValue(getPersonName(outcome.User)) },
    { key: 'comment', header: t('Коментар'), cell: (outcome) => displayValue(outcome.Comment) },
  ]
}

function CanceledBadge({ canceled }: { canceled: boolean }) {
  const { t } = useI18n()

  return (
    <Badge color={canceled ? 'gray' : 'green'} variant="light">
      {canceled ? t('Скасовано') : t('Активний')}
    </Badge>
  )
}

function getCurrencyRegisterOptions(registers: PaymentCurrencyRegister[]): Array<{ label: string; value: string }> {
  return registers.filter((register) => !hasSkippedCurrencyCode(register)).reduce<Array<{ label: string; value: string }>>((options, register) => {
    const value = getEntityValue(register)

    if (value) {
      options.push({
        label: getCurrencyLabel(register),
        value,
      })
    }

    return options
  }, [])
}

function getCurrencyLabel(register: PaymentCurrencyRegister): string {
  return register.Currency?.Code || register.Currency?.Name || getEntityValue(register) || '—'
}

function getPaymentRegisterTransferTypeLabel(type: PaymentRegisterTransferType | undefined, t: (value: string) => string): string {
  switch (type) {
    case PaymentRegisterTransferType.Income:
      return t('Прихід')
    case PaymentRegisterTransferType.Outcome:
      return t('Розхід')
    case PaymentRegisterTransferType.All:
      return t('Усі')
    default:
      return '—'
  }
}

function getTransferOperationLabel(
  transfer: PaymentRegisterTransfer,
  account: PaymentAccount | null,
  t: (value: string) => string,
): string {
  if (transfer.TypeOfOperation === TransferOperationType.FundsTransfer) {
    return t('Переказ коштів')
  }

  if (transfer.TypeOfOperation === TransferOperationType.PaymentRegisterTransfer) {
    return t('Переказ на інший рахунок')
  }

  if (transfer.TypeOfOperation === TransferOperationType.CashBankTransfer) {
    const fromRegisterNetId = transfer.FromPaymentCurrencyRegister?.PaymentRegister?.NetUid

    return account?.NetUid && fromRegisterNetId === account.NetUid ? t('Зняття готівки з банку') : t('Внесення готівки в банк')
  }

  return '—'
}

function getExchangeOperationLabel(
  exchange: PaymentRegisterCurrencyExchange,
  account: PaymentAccount | null,
  t: (value: string) => string,
): string {
  if (account?.Type === PaymentRegisterType.Bank) {
    const fromRegisterId = exchange.FromPaymentCurrencyRegister?.PaymentRegister?.Id

    return fromRegisterId && account.Id && fromRegisterId === account.Id ? t('Розхід') : t('Прихід')
  }

  return getPaymentRegisterTransferTypeLabel(exchange.Type, t)
}

function formatExchangeAmount(exchange: PaymentRegisterCurrencyExchange, account: PaymentAccount | null): string {
  if (account?.Type !== PaymentRegisterType.Bank) {
    return formatMoney(exchange.Amount)
  }

  const fromRegisterId = exchange.FromPaymentCurrencyRegister?.PaymentRegister?.Id

  if (!fromRegisterId || !account.Id || fromRegisterId === account.Id || !exchange.ExchangeRate) {
    return formatMoney(exchange.Amount)
  }

  const defaultCurrency = exchange.Type === PaymentRegisterTransferType.Income
    ? exchange.ToPaymentCurrencyRegister?.Currency?.Code
    : exchange.FromPaymentCurrencyRegister?.Currency?.Code
  const convertedAmount = defaultCurrency === 'UAH'
    ? (exchange.Amount || 0) / exchange.ExchangeRate
    : (exchange.Amount || 0) * exchange.ExchangeRate

  return `${formatMoney(exchange.Amount)} / ${formatMoney(convertedAmount)}`
}

function getExchangeCurrencyCode(exchange: PaymentRegisterCurrencyExchange, account: PaymentAccount | null): string | undefined {
  const defaultCurrency = exchange.Type === PaymentRegisterTransferType.Income
    ? exchange.ToPaymentCurrencyRegister?.Currency?.Code
    : exchange.FromPaymentCurrencyRegister?.Currency?.Code

  if (account?.Type === PaymentRegisterType.Bank) {
    const fromRegisterId = exchange.FromPaymentCurrencyRegister?.PaymentRegister?.Id

    if (fromRegisterId && account.Id && fromRegisterId !== account.Id) {
      return exchange.ToPaymentCurrencyRegister?.Currency?.Code || defaultCurrency
    }
  }

  return defaultCurrency
}

function getPaymentMovementName(operation?: PaymentAccountIncomeOrder['PaymentMovementOperation'] | null): string | undefined {
  return operation?.PaymentMovement?.OperationName || operation?.PaymentMovement?.Name
}

function getPersonName(person?: NamedEntity | null): string | undefined {
  return person?.FullName || [person?.FirstName, person?.LastName].filter(Boolean).join(' ') || person?.LastName || person?.Name
}

function getIncomePayerName(income: PaymentAccountIncomeOrder): string | undefined {
  return getPersonName(income.Client) || getPersonName(income.Colleague) || income.SupplyOrganization?.Name
}

function getOutcomePayeeName(outcome: PaymentAccountOutcomeOrder): string | undefined {
  return getPersonName(outcome.Colleague) || outcome.ConsumableProductOrganization?.Name || getPersonName(outcome.ClientAgreement?.Client)
}

function openRegisterScopedPage(
  navigate: (path: string) => void,
  path: string,
  account: PaymentAccount,
) {
  if (!account.NetUid) {
    return
  }

  const params = new URLSearchParams({ registerNetId: account.NetUid })

  navigate(`${path}?${params.toString()}`)
}

function InfoCell({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Stack gap={2}>
      <Text c="dimmed" size="xs">
        {label}
      </Text>
      <Text fw={600}>{value || '—'}</Text>
    </Stack>
  )
}

function createEmptyAccount(): PaymentAccount {
  return {
    PaymentCurrencyRegisters: [],
    Type: PaymentRegisterType.Cash,
  }
}

function createEmptyForm(): PaymentAccountFormState {
  return {
    accountNumber: '',
    bankName: '',
    city: '',
    cvv: '',
    fromDate: '',
    iban: '',
    isActive: false,
    isForRetail: false,
    name: '',
    organizationNetId: '',
    sortCode: '',
    swiftCode: '',
    type: PaymentRegisterType.Cash,
  }
}

function createInitialPageState(isLoading: boolean): PaymentAccountPageState {
  return {
    account: createEmptyAccount(),
    banks: [],
    currencyDrafts: [],
    error: null,
    form: createEmptyForm(),
    hiddenCurrencyRegisters: [],
    isLoading,
    organizations: [],
  }
}

function toFormState(account: PaymentAccount, organization: Organization | null): PaymentAccountFormState {
  return {
    accountNumber: account.AccountNumber || '',
    bankName: account.BankName || '',
    city: account.City || '',
    cvv: account.CVV || '',
    fromDate: normalizeDateInput(account.FromDate),
    iban: account.IBAN || '',
    isActive: Boolean(account.IsActive),
    isForRetail: Boolean(account.IsForRetail),
    name: account.Name || '',
    organizationNetId: getEntityValue(organization) || '',
    sortCode: account.SortCode || '',
    swiftCode: account.SwiftCode || '',
    type: account.Type ?? PaymentRegisterType.Cash,
  }
}

function toCurrencyDrafts(currencies: Currency[], registers: PaymentCurrencyRegister[]): CurrencyDraft[] {
  return currencies.reduce<CurrencyDraft[]>((drafts, currency) => {
    if (hasSkippedCurrencyCode({ Currency: currency })) {
      return drafts
    }

    const original = registers.find((register) => getEntityValue(register.Currency) === getEntityValue(currency))
    const hasOriginalIdentity = Boolean(original?.NetUid || original?.Id)
    const hasOriginalAmount = typeof original?.Amount === 'number' && Number.isFinite(original.Amount) && original.Amount !== 0
    const hasOriginalValue = hasOriginalIdentity || hasOriginalAmount || Boolean(original?.IsSelected)

    drafts.push({
      amount: typeof original?.Amount === 'number' && Number.isFinite(original.Amount) ? String(original.Amount) : '',
      currency,
      original,
      selected: hasOriginalValue,
    })

    return drafts
  }, [])
}

function toPayload(
  account: PaymentAccount,
  form: PaymentAccountFormState,
  organization: Organization,
  currencyDrafts: CurrencyDraft[],
  hiddenCurrencyRegisters: PaymentCurrencyRegister[],
  isEditMode: boolean,
): PaymentAccountPayload {
  return {
    ...account,
    AccountNumber: form.accountNumber.trim(),
    BankName: form.bankName.trim(),
    City: form.city.trim(),
    CVV: form.cvv.trim(),
    FromDate: form.type === PaymentRegisterType.Card ? fromMonthInputValue(form.fromDate) : form.fromDate,
    IBAN: form.iban.trim(),
    IsActive: form.isActive,
    IsForRetail: form.isForRetail,
    Name: form.name.trim(),
    Organization: organization,
    PaymentCurrencyRegisters: isEditMode
      ? account.PaymentCurrencyRegisters || []
      : [
          ...currencyDrafts.reduce<PaymentCurrencyRegister[]>((registers, draft) => {
            if (draft.selected) {
              registers.push({
                ...draft.original,
                Amount: parseAmount(draft.amount),
                Currency: draft.currency,
                IsSelected: true,
              })
            }

            return registers
          }, []),
          ...hiddenCurrencyRegisters,
        ],
    SortCode: form.sortCode.trim(),
    SwiftCode: form.swiftCode.trim(),
    Type: form.type,
  }
}

function validateForm(
  form: PaymentAccountFormState,
  currencyDrafts: CurrencyDraft[],
  organization: Organization | null,
  canSave: boolean,
  isEditMode: boolean,
  t: (value: string) => string,
): string | null {
  if (!canSave) {
    return t('Немає прав для збереження рахунку')
  }

  if (!form.name.trim()) {
    return t('Вкажіть назву рахунку')
  }

  if (!organization) {
    return t('Оберіть організацію')
  }

  if (!isEditMode && !currencyDrafts.some((draft) => draft.selected)) {
    return t('Оберіть валюту')
  }

  if (form.type === PaymentRegisterType.Card) {
    if (!form.bankName.trim() || !form.accountNumber.trim() || !form.fromDate.trim()) {
      return t('Заповніть банк, номер картки і термін дії')
    }
  }

  if (form.type === PaymentRegisterType.Bank) {
    return getBankValidationError(form, t)
  }

  return null
}

function getBankValidationError(form: PaymentAccountFormState, t: (value: string) => string): string | null {
  if (form.sortCode.length > 20) {
    return t('BIC має бути до 20 символів')
  }

  if (form.swiftCode.length > 50) {
    return t('Swift має бути до 50 символів')
  }

  if (form.iban.length > 50) {
    return t('IBAN має бути до 50 символів')
  }

  if (form.city.length > 100) {
    return t('Місто має бути до 100 символів')
  }

  if (form.accountNumber.length > 50) {
    return t('Номер рахунку має бути до 50 символів')
  }

  return null
}

function includeEntity<T extends { Id?: number; NetUid?: string }>(items: T[], entity?: T | null): T[] {
  const value = getEntityValue(entity)

  if (!entity || !value || items.some((item) => getEntityValue(item) === value)) {
    return items
  }

  return [entity, ...items]
}

function toSelectOptions<T extends { Id?: number; NetUid?: string }>(items: T[], getLabel: (item: T) => string | undefined) {
  return items.reduce<Array<{ label: string; value: string }>>((options, item) => {
    const value = getEntityValue(item)

    if (value) {
      options.push({
        label: getLabel(item) || value,
        value,
      })
    }

    return options
  }, [])
}

function toBankOptions(banks: BankItem[]) {
  return banks.reduce<Array<{ label: string; value: string }>>((options, bank) => {
    const value = bank.Name || ''

    if (value) {
      options.push({
        label: value,
        value,
      })
    }

    return options
  }, [])
}

function getEntityValue(entity?: NamedEntity | null): string {
  return entity?.NetUid || (typeof entity?.Id === 'number' ? String(entity.Id) : '')
}

function hasSkippedCurrencyCode(register: Pick<PaymentCurrencyRegister, 'Currency'>): boolean {
  return register.Currency?.Code === SKIPPED_CURRENCY_CODE
}

function shouldShowCurrencyBalance(draft: CurrencyDraft): boolean {
  return Boolean(draft.original?.NetUid || draft.original?.Id || draft.selected || parseAmount(draft.amount) !== 0)
}

function parseAmount(value: string): number {
  const normalized = value.replace(',', '.')
  const parsed = Number(normalized)

  return Number.isFinite(parsed) ? parsed : 0
}

function formatMoney(value?: number): string {
  return moneyFormatter.format(typeof value === 'number' && Number.isFinite(value) ? value : 0)
}

function formatDate(value?: string): string {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('uk-UA')
}

function formatDateTime(value?: string): string {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? value : dateTimeFormatter.format(date)
}

function displayValue(value?: ReactNode): ReactNode {
  if (value === null || value === undefined || value === '') {
    return '—'
  }

  return value
}

function getDateShiftedByDays(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)

  return formatLocalDate(date)
}

function getPaymentRegisterTypeLabel(type: PaymentRegisterType | undefined, t: (value: string) => string): string {
  switch (type) {
    case PaymentRegisterType.Cash:
      return t('Каса')
    case PaymentRegisterType.Card:
      return t('Банківська картка')
    case PaymentRegisterType.Bank:
      return t('Банк')
    default:
      return '—'
  }
}

function normalizeDateInput(value?: string): string {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return toDateInputValue(value)
}

function toDateInputValue(value: string): string {
  if (!value) {
    return ''
  }

  return value.slice(0, 10)
}

function toMonthInputValue(value: string): string {
  if (!value) {
    return ''
  }

  return value.slice(0, 7)
}

function fromMonthInputValue(value: string): string {
  if (!value || value.length > 7) {
    return value
  }

  return `${value}-01`
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
