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
import { ArrowLeft, ArrowLeftRight, CircleAlert, Pencil, RefreshCw, Save, Trash2, X } from 'lucide-react'
import { type FormEvent, type ReactNode, useEffect, useMemo, useReducer } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { useAuth } from '../../auth/useAuth'
import {
  cancelPaymentAccountExchange,
  cancelPaymentAccountTransfer,
  calculatePaymentAccountExchange,
  createPaymentAccountExchange,
  createPaymentAccount,
  createPaymentAccountTransfer,
  deletePaymentAccount,
  getPaymentAccount,
  getPaymentAccountBanks,
  getPaymentAccountCurrencyActivity,
  getPaymentAccountCurrencies,
  getPaymentAccountCurrencyTraders,
  getPaymentAccountExchanges,
  getPaymentAccountOrganizations,
  getPaymentAccountPaymentMovements,
  getPaymentAccountTransfers,
  getPaymentAccounts,
  getPaymentAccountsByBank,
  updatePaymentAccount,
} from '../api/paymentAccountsApi'
import { PAYMENT_ACCOUNT_CREATE_PERMISSION, PAYMENT_ACCOUNT_EDIT_PERMISSION } from '../permissions'
import type {
  BankItem,
  Currency,
  CurrencyTrader,
  NamedEntity,
  Organization,
  PaymentAccount,
  PaymentAccountIncomeOrder,
  PaymentAccountOutcomeOrder,
  PaymentAccountPayload,
  PaymentCurrencyRegister,
  PaymentMovement,
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

type PaymentAccountTransferDraft = {
  amount: string
  comment: string
  fromDate: string
  fromPaymentCurrencyRegisterNetId: string
  movementNetId: string
  time: string
  toPaymentCurrencyRegisterNetId: string
  typeOfOperation: TransferOperationType
}

type PaymentAccountExchangeDraft = {
  amount: string
  comment: string
  currencyTraderNetId: string
  exchangeRate: string
  fromDate: string
  fromPaymentCurrencyRegisterNetId: string
  incomeNumber: string
  movementNetId: string
  time: string
  toPaymentCurrencyRegisterNetId: string
}

type PaymentAccountActivityStateAction =
  | { type: 'failed'; error: string }
  | { type: 'loading' }
  | { type: 'reset' }
  | {
      type: 'succeeded'
      currencyActivity?: PaymentCurrencyRegister | null
      error?: string | null
      exchanges?: PaymentRegisterCurrencyExchange[]
      transfers?: PaymentRegisterTransfer[]
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
        ...state,
        error: action.error,
        isLoading: false,
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
        currencyActivity: 'currencyActivity' in action ? action.currencyActivity || null : state.currencyActivity,
        error: action.error || null,
        exchanges: action.exchanges || state.exchanges,
        isLoading: false,
        transfers: action.transfers || state.transfers,
      }
    default:
      return state
  }
}

const ACCOUNTS_PATH = '/accounting/payment-accounts'
const SKIPPED_CURRENCY_CODE = ['P', 'L', 'N'].join('')
const ACTIVITY_RANGE_DAYS = -7
const DEFAULT_TRANSFER_MOVEMENT_NAME = 'Переміщення валюти'
const DEFAULT_EXCHANGE_MOVEMENT_NAME = 'Конвертація валюти'
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

  async function reloadAccountAfterActivityMutation() {
    const netId = account.NetUid || id

    if (netId) {
      const nextAccount = await getPaymentAccount(netId)

      if (nextAccount) {
        dispatchPageState((current) => ({
          ...current,
          account: nextAccount,
          currencyDrafts: toCurrencyDrafts(current.currencyDrafts.map((draft) => draft.currency), nextAccount.PaymentCurrencyRegisters || []),
          form: toFormState(nextAccount, nextAccount.Organization || current.account.Organization || null),
          hiddenCurrencyRegisters: (nextAccount.PaymentCurrencyRegisters || []).filter(hasSkippedCurrencyCode),
        }))
      }
    }

    activity.reloadActivity()
  }

  return (
    <AppDrawer
      opened
      position="right"
      size="wide"
      title={isEditMode ? t('Редагування рахунку') : t('Новий рахунок')}
      onClose={handleCancel}
    >
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
          onMutationComplete={reloadAccountAfterActivityMutation}
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
            <Button color="red" leftSection={<Trash2 size={16} />} loading={isDeleting} onClick={handleDelete}>
              {t('Видалити')}
            </Button>
          </Group>
        </Stack>
      </AppModal>
    </Stack>
    </AppDrawer>
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

    if (activeActivityTab === 'balances') {
      dispatchActivityState({ type: 'succeeded' })
      return () => {
        isActive = false
      }
    }

    dispatchActivityState({ type: 'loading' })

    async function loadActivity() {
      try {
        if (activeActivityTab === 'transfers') {
          const transfers = await getPaymentAccountTransfers({
            from: activityFrom,
            netId: accountNetId,
            to: activityTo,
            type: PaymentRegisterTransferType.All,
          })

          if (isActive) {
            dispatchActivityState({ transfers, type: 'succeeded' })
          }

          return
        }

        if (activeActivityTab === 'exchanges') {
          const exchanges = await getPaymentAccountExchanges({
            from: activityFrom,
            netId: accountNetId,
            to: activityTo,
          })

          if (isActive) {
            dispatchActivityState({ exchanges, type: 'succeeded' })
          }

          return
        }

        const currencyActivity = selectedCurrencyRegister?.NetUid
          ? await getPaymentAccountCurrencyActivity({
              currencyRegisterNetId: selectedCurrencyRegister.NetUid,
              from: activityFrom,
              to: activityTo,
            })
          : null

        if (isActive) {
          dispatchActivityState({ currencyActivity, type: 'succeeded' })
        }
      } catch (activityError) {
        if (isActive) {
          dispatchActivityState({
            error: activityError instanceof Error ? activityError.message : t('Не вдалося завантажити активність рахунку'),
            type: 'failed',
          })
        }
      }
    }

    void loadActivity()

    return () => {
      isActive = false
    }
  }, [
    account.NetUid,
    activeActivityTab,
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
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}

        {!canSave && (
          <Alert color="yellow" icon={<CircleAlert size={18} />} variant="light">
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
            disabled={isFormDisabled || isEditMode}
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
    <Group justify="flex-end" gap="xs" wrap="wrap">
      <Button color="gray" leftSection={<ArrowLeft size={16} />} type="button" variant="light" onClick={onCancel}>
        {t('Назад')}
      </Button>
      {isEditMode && canSave && !isEditing && (
        <Button
          color={CREATE_ACTION_COLOR}
          disabled={isLoading || isSaving || isDeleting}
          leftSection={<Pencil size={16} />}
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
          leftSection={<Trash2 size={16} />}
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
          color={CREATE_ACTION_COLOR}
          disabled={isLoading || !canSave}
          leftSection={<Save size={16} />}
          loading={isSaving}
          type="submit"
        >
          {t('Зберегти')}
        </Button>
      )}
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
                    variant="outline"
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
  onMutationComplete,
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
  onMutationComplete: () => Promise<void>
  onRefresh: () => void
  onSelectedCurrencyChange: (value: string) => void
  onToChange: (value: string) => void
}) {
  const { t } = useI18n()
  const currencyOptions = getCurrencyRegisterOptions(account.PaymentCurrencyRegisters || [])
  const [transferModalOpened, setTransferModalOpened] = useValueState(false)
  const [exchangeModalOpened, setExchangeModalOpened] = useValueState(false)
  const [cancelTransfer, setCancelTransfer] = useValueState<PaymentRegisterTransfer | null>(null)
  const [cancelExchange, setCancelExchange] = useValueState<PaymentRegisterCurrencyExchange | null>(null)
  const [isMutating, setMutating] = useValueState(false)

  async function handleCancelTransfer() {
    const netId = getEntityValue(cancelTransfer)

    if (!netId) {
      return
    }

    setMutating(true)

    try {
      await cancelPaymentAccountTransfer(netId)
      notifications.show({ color: 'green', message: t('Переказ скасовано') })
      setCancelTransfer(null)
      await onMutationComplete()
    } catch (cancelError) {
      notifications.show({
        color: 'red',
        message: cancelError instanceof Error ? cancelError.message : t('Не вдалося скасувати переказ'),
      })
    } finally {
      setMutating(false)
    }
  }

  async function handleCancelExchange() {
    const netId = getEntityValue(cancelExchange)

    if (!netId) {
      return
    }

    setMutating(true)

    try {
      await cancelPaymentAccountExchange(netId)
      notifications.show({ color: 'green', message: t('Обмін валют скасовано') })
      setCancelExchange(null)
      await onMutationComplete()
    } catch (cancelError) {
      notifications.show({
        color: 'red',
        message: cancelError instanceof Error ? cancelError.message : t('Не вдалося скасувати обмін валют'),
      })
    } finally {
      setMutating(false)
    }
  }

  return (
    <>
      <Card className="app-section-card" withBorder radius="md">
        <Stack gap="md">
          <Group justify="space-between" wrap="wrap">
            <Group gap="xs">
              <Text fw={700}>{t('Операції')}</Text>
              <Badge color="gray" variant="light">
                {formatDate(from)} - {formatDate(to)}
              </Badge>
            </Group>
            <Group gap="xs">
              <Button color="green" disabled={!account.NetUid} size="xs" variant="outline" onClick={onOpenIncome}>
                {t('Прихід')}
              </Button>
              <Button color="red" disabled={!account.NetUid} size="xs" variant="light" onClick={onOpenOutgoing}>
                {t('Розхід')}
              </Button>
              <Button
                disabled={!account.NetUid || isLoadingAccount}
                leftSection={<ArrowLeftRight size={16} />}
                size="xs"
                type="button"
                variant="outline"
                onClick={() => {
                  setTransferModalOpened(true)
                  onActiveTabChange('transfers')
                }}
              >
                {t('Переказ')}
              </Button>
              <Button
                disabled={!account.NetUid || isLoadingAccount}
                leftSection={<ArrowLeftRight size={16} />}
                size="xs"
                type="button"
                variant="outline"
                onClick={() => {
                  setExchangeModalOpened(true)
                  onActiveTabChange('exchanges')
                }}
              >
                {t('Обмін')}
              </Button>
              <Button
                color="gray"
                disabled={isLoadingAccount}
                leftSection={<RefreshCw size={16} />}
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
            <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
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
                columns={getTransferColumns(account, t, setCancelTransfer)}
                emptyText={t('Перекази відсутні')}
                getRowKey={(item, index) => getEntityValue(item) || `transfer-${index}`}
                isLoading={state.isLoading}
                rows={state.transfers}
              />
            </Tabs.Panel>

            <Tabs.Panel value="exchanges" pt="md">
              <ActivityTable
                columns={getExchangeColumns(account, t, setCancelExchange)}
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
                <PaymentCurrencyActivityView
                  activity={state.currencyActivity}
                  isLoading={state.isLoading}
                  onCancelExchange={setCancelExchange}
                  onCancelTransfer={setCancelTransfer}
                />
              </Stack>
            </Tabs.Panel>
          </Tabs>
        </Stack>
      </Card>

      <PaymentAccountTransferModal
        account={account}
        opened={transferModalOpened}
        onClose={() => setTransferModalOpened(false)}
        onMutationComplete={onMutationComplete}
      />
      <PaymentAccountExchangeModal
        account={account}
        opened={exchangeModalOpened}
        onClose={() => setExchangeModalOpened(false)}
        onMutationComplete={onMutationComplete}
      />
      <CancelActivityModal
        isLoading={isMutating}
        opened={Boolean(cancelTransfer)}
        title={t('Скасувати переказ')}
        onClose={() => setCancelTransfer(null)}
        onConfirm={handleCancelTransfer}
      />
      <CancelActivityModal
        isLoading={isMutating}
        opened={Boolean(cancelExchange)}
        title={t('Скасувати обмін валют')}
        onClose={() => setCancelExchange(null)}
        onConfirm={handleCancelExchange}
      />
    </>
  )
}

function PaymentAccountTransferModal({
  account,
  opened,
  onClose,
  onMutationComplete,
}: {
  account: PaymentAccount
  opened: boolean
  onClose: () => void
  onMutationComplete: () => Promise<void>
}) {
  const { t } = useI18n()
  const [draft, setDraft] = useValueState(() => createTransferDraft(account))
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(false)
  const [isSubmitting, setSubmitting] = useValueState(false)
  const [movements, setMovements] = useValueState<PaymentMovement[]>([])
  const [paymentAccounts, setPaymentAccounts] = useValueState<PaymentAccount[]>([])
  const currencyRegisters = getVisibleCurrencyRegisters(account)
  const selectedFromRegister = findCurrencyRegister(currencyRegisters, draft.fromPaymentCurrencyRegisterNetId)
  const destinationRegisters = getTransferDestinationRegisters(paymentAccounts, account, selectedFromRegister)
  const selectedToRegister = findCurrencyRegister(destinationRegisters, draft.toPaymentCurrencyRegisterNetId)
  const selectedMovement = findEntity(movements, draft.movementNetId)

  useEffect(() => {
    if (!opened) {
      return
    }

    let isActive = true

    setError(null)
    setLoading(true)

    void Promise.all([getPaymentAccounts(), getPaymentAccountPaymentMovements()])
      .then(([accountsResponse, nextMovements]) => {
        if (!isActive) {
          return
        }

        setPaymentAccounts(accountsResponse.paymentRegisters)
        setMovements(nextMovements)
        setDraft(createTransferDraft(account, nextMovements))
      })
      .catch((loadError: unknown) => {
        if (isActive) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити дані для переказу'))
        }
      })
      .finally(() => {
        if (isActive) {
          setLoading(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [account, opened, setDraft, setError, setLoading, setMovements, setPaymentAccounts, t])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const amount = parseAmount(draft.amount)
    const validationError = validateTransferDraft(draft, selectedFromRegister, selectedToRegister, selectedMovement, amount, t)

    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      await createPaymentAccountTransfer({
        Amount: amount,
        Comment: draft.comment.trim(),
        FromDate: toLocalIsoDateTime(draft.fromDate, draft.time),
        FromPaymentCurrencyRegister: selectedFromRegister,
        PaymentMovementOperation: {
          PaymentMovement: selectedMovement,
        },
        ToPaymentCurrencyRegister: selectedToRegister,
        TypeOfOperation: draft.typeOfOperation,
      })
      notifications.show({ color: 'green', message: t('Переказ створено') })
      onClose()
      await onMutationComplete()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t('Не вдалося створити переказ'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppModal centered opened={opened} size="lg" title={t('Новий переказ')} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          {error && (
            <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
              {error}
            </Alert>
          )}
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Select
              data={toCurrencyRegisterSelectOptions(currencyRegisters)}
              disabled={isLoading || isSubmitting}
              label={t('З валюти')}
              required
              searchable
              value={draft.fromPaymentCurrencyRegisterNetId || null}
              onChange={(value) => setDraft((current) => ({
                ...current,
                fromPaymentCurrencyRegisterNetId: value || '',
                toPaymentCurrencyRegisterNetId: '',
              }))}
            />
            <Select
              data={toCurrencyRegisterSelectOptions(destinationRegisters)}
              disabled={!selectedFromRegister || isLoading || isSubmitting}
              label={t('На рахунок')}
              required
              searchable
              value={draft.toPaymentCurrencyRegisterNetId || null}
              onChange={(value) => setDraft((current) => ({ ...current, toPaymentCurrencyRegisterNetId: value || '' }))}
            />
            <TextInput
              disabled={isSubmitting}
              inputMode="decimal"
              label={t('Сума')}
              required
              value={draft.amount}
              onChange={(event) => setDraft((current) => ({ ...current, amount: event.currentTarget.value }))}
            />
            <Select
              data={[
                { label: t('Переказ коштів'), value: String(TransferOperationType.FundsTransfer) },
                { label: t('Отримання/внесення готівки в банк'), value: String(TransferOperationType.CashBankTransfer) },
                { label: t('Переказ коштів на інший рахунок'), value: String(TransferOperationType.PaymentRegisterTransfer) },
              ]}
              disabled={isSubmitting}
              label={t('Тип операції')}
              required
              value={String(draft.typeOfOperation)}
              onChange={(value) => setDraft((current) => ({
                ...current,
                typeOfOperation: Number(value) as TransferOperationType,
              }))}
            />
            <TextInput
              disabled={isSubmitting}
              label={t('Дата')}
              required
              type="date"
              value={draft.fromDate}
              onChange={(event) => setDraft((current) => ({ ...current, fromDate: event.currentTarget.value }))}
            />
            <TextInput
              disabled={isSubmitting}
              label={t('Час')}
              required
              type="time"
              value={draft.time}
              onChange={(event) => setDraft((current) => ({ ...current, time: event.currentTarget.value }))}
            />
            <Select
              data={toPaymentMovementOptions(movements)}
              disabled={isLoading || isSubmitting}
              label={t('Стаття руху')}
              required
              searchable
              value={draft.movementNetId || null}
              onChange={(value) => setDraft((current) => ({ ...current, movementNetId: value || '' }))}
            />
            <TextInput
              disabled={isSubmitting}
              label={t('Коментар')}
              value={draft.comment}
              onChange={(event) => setDraft((current) => ({ ...current, comment: event.currentTarget.value }))}
            />
          </SimpleGrid>
          <Group justify="flex-end">
            <Button color="gray" disabled={isSubmitting} type="button" variant="light" onClick={onClose}>
              {t('Скасувати')}
            </Button>
            <Button color={CREATE_ACTION_COLOR} leftSection={<ArrowLeftRight size={16} />} loading={isSubmitting} type="submit">
              {t('Створити')}
            </Button>
          </Group>
        </Stack>
      </form>
    </AppModal>
  )
}

function PaymentAccountExchangeModal({
  account,
  opened,
  onClose,
  onMutationComplete,
}: {
  account: PaymentAccount
  opened: boolean
  onClose: () => void
  onMutationComplete: () => Promise<void>
}) {
  const { t } = useI18n()
  const [draft, setDraft] = useValueState(() => createExchangeDraft(account))
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(false)
  const [isSubmitting, setSubmitting] = useValueState(false)
  const [isLoadingTraders, setLoadingTraders] = useValueState(false)
  const [isCalculatingExchange, setCalculatingExchange] = useValueState(false)
  const [bankAccounts, setBankAccounts] = useValueState<PaymentAccount[]>([])
  const [movements, setMovements] = useValueState<PaymentMovement[]>([])
  const [currencyTraders, setCurrencyTraders] = useValueState<CurrencyTrader[]>([])
  const currencyRegisters = getVisibleCurrencyRegisters(account)
  const selectedFromRegister = findCurrencyRegister(currencyRegisters, draft.fromPaymentCurrencyRegisterNetId)
  const destinationRegisters = getExchangeDestinationRegisters([account, ...bankAccounts], selectedFromRegister)
  const selectedToRegister = findCurrencyRegister(destinationRegisters, draft.toPaymentCurrencyRegisterNetId)
  const selectedFromRegisterNetId = getEntityValue(selectedFromRegister)
  const selectedToRegisterNetId = getEntityValue(selectedToRegister)
  const traderLookupRegisterNetId = selectedToRegisterNetId || selectedFromRegisterNetId
  const selectedMovement = findEntity(movements, draft.movementNetId)
  const selectedTrader = findCurrencyTrader(currencyTraders, draft.currencyTraderNetId)
  const amount = parseAmount(draft.amount)
  const exchangeRate = parseAmount(draft.exchangeRate)
  const exchangeCurrencyCode = selectedFromRegister?.Currency?.Code || ''
  const exchangeRateCurrencyCode = getExchangeRateCurrencyCode(selectedFromRegister, selectedToRegister)
  const exchangeTraderOptions = toCurrencyTraderSelectOptions(currencyTraders, exchangeRateCurrencyCode)
  const [convertedAmount, setConvertedAmount] = useValueState<number | null>(null)
  const convertedAmountLabel = isCalculatingExchange
    ? t('Рахується')
    : convertedAmount !== null
      ? formatMoney(convertedAmount)
      : '—'

  useEffect(() => {
    if (!opened) {
      return
    }

    let isActive = true

    setError(null)
    setLoading(true)

    void Promise.all([
      account.NetUid ? getPaymentAccountsByBank(account.NetUid) : Promise.resolve([]),
      getPaymentAccountPaymentMovements(),
    ])
      .then(([nextBankAccounts, nextMovements]) => {
        if (!isActive) {
          return
        }

        setBankAccounts(nextBankAccounts)
        setMovements(nextMovements)
        setCurrencyTraders([])
        setDraft(createExchangeDraft(account, nextMovements))
      })
      .catch((loadError: unknown) => {
        if (isActive) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити дані для обміну'))
        }
      })
      .finally(() => {
        if (isActive) {
          setLoading(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [account, opened, setBankAccounts, setCurrencyTraders, setDraft, setError, setLoading, setMovements, t])

  useEffect(() => {
    if (!opened) {
      return
    }

    if (!traderLookupRegisterNetId) {
      setCurrencyTraders([])
      return
    }

    let isActive = true

    setLoadingTraders(true)

    void getPaymentAccountCurrencyTraders(traderLookupRegisterNetId)
      .then((traders) => {
        if (!isActive) {
          return
        }

        setCurrencyTraders(traders)
        setDraft((current) => {
          if (!current.currencyTraderNetId || traders.some((trader) => getEntityValue(trader) === current.currencyTraderNetId)) {
            return current
          }

          return { ...current, currencyTraderNetId: '' }
        })
      })
      .catch((loadError: unknown) => {
        if (isActive) {
          setCurrencyTraders([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити курси трейдерів'))
        }
      })
      .finally(() => {
        if (isActive) {
          setLoadingTraders(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [
    opened,
    setCurrencyTraders,
    setDraft,
    setError,
    setLoadingTraders,
    t,
    traderLookupRegisterNetId,
  ])

  useEffect(() => {
    if (!opened || !amount || amount <= 0 || !exchangeRate || exchangeRate <= 0 || !exchangeCurrencyCode) {
      setConvertedAmount(null)
      setCalculatingExchange(false)
      return
    }

    let isActive = true

    setCalculatingExchange(true)

    void calculatePaymentAccountExchange({
      amount,
      currencyCode: exchangeCurrencyCode,
      exchangeRate,
    })
      .then((nextAmount) => {
        if (isActive) {
          setConvertedAmount(nextAmount)
        }
      })
      .catch((calculateError: unknown) => {
        if (isActive) {
          setConvertedAmount(null)
          setError(calculateError instanceof Error ? calculateError.message : t('Не вдалося перерахувати суму після конвертації'))
        }
      })
      .finally(() => {
        if (isActive) {
          setCalculatingExchange(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [
    amount,
    exchangeCurrencyCode,
    exchangeRate,
    opened,
    setCalculatingExchange,
    setConvertedAmount,
    setError,
    t,
  ])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationError = validateExchangeDraft(draft, selectedFromRegister, selectedToRegister, selectedMovement, amount, exchangeRate, t)

    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      await createPaymentAccountExchange({
        Amount: amount,
        Comment: draft.comment.trim(),
        CurrencyTrader: selectedTrader,
        ExchangeRate: exchangeRate,
        FromDate: toLocalIsoDateTime(draft.fromDate, draft.time),
        FromPaymentCurrencyRegister: selectedFromRegister,
        IncomeNumber: draft.incomeNumber.trim(),
        PaymentMovementOperation: {
          PaymentMovement: selectedMovement,
        },
        ToPaymentCurrencyRegister: selectedToRegister,
      })
      notifications.show({ color: 'green', message: t('Обмін валют створено') })
      onClose()
      await onMutationComplete()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t('Не вдалося створити обмін валют'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppModal centered opened={opened} size="lg" title={t('Новий обмін валют')} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          {error && (
            <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
              {error}
            </Alert>
          )}
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Select
              data={toCurrencyRegisterSelectOptions(currencyRegisters)}
              disabled={isLoading || isSubmitting}
              label={t('З валюти')}
              required
              searchable
              value={draft.fromPaymentCurrencyRegisterNetId || null}
              onChange={(value) => setDraft((current) => ({
                ...current,
                currencyTraderNetId: '',
                exchangeRate: '',
                fromPaymentCurrencyRegisterNetId: value || '',
                toPaymentCurrencyRegisterNetId: '',
              }))}
            />
            <Select
              data={toCurrencyRegisterSelectOptions(destinationRegisters)}
              disabled={!selectedFromRegister || isLoading || isSubmitting}
              label={t('У валюту')}
              required
              searchable
              value={draft.toPaymentCurrencyRegisterNetId || null}
              onChange={(value) => setDraft((current) => ({
                ...current,
                currencyTraderNetId: '',
                exchangeRate: '',
                toPaymentCurrencyRegisterNetId: value || '',
              }))}
            />
            <TextInput
              disabled={isSubmitting}
              inputMode="decimal"
              label={t('Сума')}
              required
              value={draft.amount}
              onChange={(event) => setDraft((current) => ({ ...current, amount: event.currentTarget.value }))}
            />
            <Select
              data={exchangeTraderOptions}
              disabled={!selectedFromRegister || !selectedToRegister || isLoading || isLoadingTraders || isSubmitting}
              label={t('Курс трейдера')}
              searchable
              value={draft.currencyTraderNetId || null}
              onChange={(value) => {
                const nextTrader = findCurrencyTrader(currencyTraders, value || '')
                const nextRate = getTraderExchangeRate(nextTrader, exchangeRateCurrencyCode)

                setDraft((current) => ({
                  ...current,
                  currencyTraderNetId: value || '',
                  exchangeRate: nextRate ? String(nextRate.ExchangeRate) : current.exchangeRate,
                }))
              }}
            />
            <TextInput
              disabled={isSubmitting}
              inputMode="decimal"
              label={t('Курс')}
              required
              value={draft.exchangeRate}
              onChange={(event) => setDraft((current) => ({
                ...current,
                currencyTraderNetId: '',
                exchangeRate: event.currentTarget.value,
              }))}
            />
            <InfoCell label={t('Сума після конвертації')} value={convertedAmountLabel} />
            <TextInput
              disabled={isSubmitting}
              label={t('Вхідний номер')}
              value={draft.incomeNumber}
              onChange={(event) => setDraft((current) => ({ ...current, incomeNumber: event.currentTarget.value }))}
            />
            <TextInput
              disabled={isSubmitting}
              label={t('Дата')}
              required
              type="date"
              value={draft.fromDate}
              onChange={(event) => setDraft((current) => ({ ...current, fromDate: event.currentTarget.value }))}
            />
            <TextInput
              disabled={isSubmitting}
              label={t('Час')}
              required
              type="time"
              value={draft.time}
              onChange={(event) => setDraft((current) => ({ ...current, time: event.currentTarget.value }))}
            />
            <Select
              data={toPaymentMovementOptions(movements)}
              disabled={isLoading || isSubmitting}
              label={t('Стаття руху')}
              required
              searchable
              value={draft.movementNetId || null}
              onChange={(value) => setDraft((current) => ({ ...current, movementNetId: value || '' }))}
            />
            <TextInput
              disabled={isSubmitting}
              label={t('Коментар')}
              value={draft.comment}
              onChange={(event) => setDraft((current) => ({ ...current, comment: event.currentTarget.value }))}
            />
          </SimpleGrid>
          <Group justify="flex-end">
            <Button color="gray" disabled={isSubmitting} type="button" variant="light" onClick={onClose}>
              {t('Скасувати')}
            </Button>
            <Button color={CREATE_ACTION_COLOR} leftSection={<ArrowLeftRight size={16} />} loading={isSubmitting} type="submit">
              {t('Створити')}
            </Button>
          </Group>
        </Stack>
      </form>
    </AppModal>
  )
}

function CancelActivityModal({
  isLoading,
  opened,
  title,
  onClose,
  onConfirm,
}: {
  isLoading: boolean
  opened: boolean
  title: string
  onClose: () => void
  onConfirm: () => void
}) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={opened} title={title} onClose={onClose}>
      <Stack gap="md">
        <Text>{t('Скасувати операцію?')}</Text>
        <Group justify="flex-end">
          <Button color="gray" disabled={isLoading} type="button" variant="light" onClick={onClose}>
            {t('Ні')}
          </Button>
          <Button color="red" leftSection={<X size={16} />} loading={isLoading} type="button" onClick={onConfirm}>
            {t('Так, скасувати')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
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
  onCancelExchange,
  onCancelTransfer,
}: {
  activity: PaymentCurrencyRegister | null
  isLoading: boolean
  onCancelExchange: (exchange: PaymentRegisterCurrencyExchange) => void
  onCancelTransfer: (transfer: PaymentRegisterTransfer) => void
}) {
  const { t } = useI18n()
  const incomeOrders = activity?.PaymentRegister?.IncomePaymentOrders || activity?.IncomePaymentOrders || []
  const outcomeOrders = activity?.OutcomePaymentOrders || activity?.PaymentRegister?.OutcomePaymentOrders || []

  return (
    <Stack gap="md">
      <ActivityTable
        columns={getTransferColumns(activity?.PaymentRegister || null, t, onCancelTransfer)}
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
        columns={getExchangeColumns(activity?.PaymentRegister || null, t, onCancelExchange)}
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
  onCancel?: (transfer: PaymentRegisterTransfer) => void,
): ActivityColumn<PaymentRegisterTransfer>[] {
  const columns: ActivityColumn<PaymentRegisterTransfer>[] = [
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

  if (onCancel) {
    columns.push({
      key: 'actions',
      header: '',
      align: 'right',
      cell: (transfer) => (
        <Button
          color="red"
          disabled={Boolean(transfer.IsCanceled) || !getEntityValue(transfer)}
          leftSection={<X size={14} />}
          size="xs"
          type="button"
          variant="light"
          onClick={() => onCancel(transfer)}
        >
          {t('Скасувати')}
        </Button>
      ),
    })
  }

  return columns
}

function getExchangeColumns(
  account: PaymentAccount | null,
  t: (value: string) => string,
  onCancel?: (exchange: PaymentRegisterCurrencyExchange) => void,
): ActivityColumn<PaymentRegisterCurrencyExchange>[] {
  const columns: ActivityColumn<PaymentRegisterCurrencyExchange>[] = [
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

  if (onCancel) {
    columns.push({
      key: 'actions',
      header: '',
      align: 'right',
      cell: (exchange) => (
        <Button
          color="red"
          disabled={Boolean(exchange.IsCanceled) || !getEntityValue(exchange)}
          leftSection={<X size={14} />}
          size="xs"
          type="button"
          variant="light"
          onClick={() => onCancel(exchange)}
        >
          {t('Скасувати')}
        </Button>
      ),
    })
  }

  return columns
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

function getVisibleCurrencyRegisters(account: PaymentAccount): PaymentCurrencyRegister[] {
  return (account.PaymentCurrencyRegisters || [])
    .filter((register) => !hasSkippedCurrencyCode(register) && Boolean(getEntityValue(register)))
}

function createTransferDraft(
  account: PaymentAccount,
  movements: PaymentMovement[] = [],
): PaymentAccountTransferDraft {
  const now = new Date()
  const selectedFromRegister = getVisibleCurrencyRegisters(account)[0] || null
  const selectedMovement = findDefaultPaymentMovement(movements, DEFAULT_TRANSFER_MOVEMENT_NAME)

  return {
    amount: '',
    comment: '',
    fromDate: formatLocalDate(now),
    fromPaymentCurrencyRegisterNetId: getEntityValue(selectedFromRegister),
    movementNetId: getEntityValue(selectedMovement),
    time: toTimeInputValue(now),
    toPaymentCurrencyRegisterNetId: '',
    typeOfOperation: TransferOperationType.FundsTransfer,
  }
}

function createExchangeDraft(
  account: PaymentAccount,
  movements: PaymentMovement[] = [],
): PaymentAccountExchangeDraft {
  const now = new Date()
  const selectedFromRegister = getVisibleCurrencyRegisters(account)[0] || null
  const selectedToRegister = selectedFromRegister
    ? getExchangeDestinationRegisters([account], selectedFromRegister)[0] || null
    : null
  const selectedMovement = findDefaultPaymentMovement(movements, DEFAULT_EXCHANGE_MOVEMENT_NAME)

  return {
    amount: '',
    comment: '',
    currencyTraderNetId: '',
    exchangeRate: '',
    fromDate: formatLocalDate(now),
    fromPaymentCurrencyRegisterNetId: getEntityValue(selectedFromRegister),
    incomeNumber: '',
    movementNetId: getEntityValue(selectedMovement),
    time: toTimeInputValue(now),
    toPaymentCurrencyRegisterNetId: getEntityValue(selectedToRegister),
  }
}

function getTransferDestinationRegisters(
  paymentAccounts: PaymentAccount[],
  account: PaymentAccount,
  selectedFromRegister: PaymentCurrencyRegister | null,
): PaymentCurrencyRegister[] {
  if (!selectedFromRegister?.Currency) {
    return []
  }

  const sourceAccountValue = getEntityValue(account)
  const sourceRegisterValue = getEntityValue(selectedFromRegister)

  return dedupeCurrencyRegisters(
    paymentAccounts.reduce<PaymentCurrencyRegister[]>((registers, paymentAccount) => {
      if (getEntityValue(paymentAccount) === sourceAccountValue) {
        return registers
      }

      getVisibleCurrencyRegisters(paymentAccount).forEach((register) => {
        if (getEntityValue(register) !== sourceRegisterValue && isSameCurrency(register.Currency, selectedFromRegister.Currency)) {
          registers.push({
            ...register,
            PaymentRegister: register.PaymentRegister || paymentAccount,
          })
        }
      })

      return registers
    }, []),
  )
}

function getExchangeDestinationRegisters(
  paymentAccounts: PaymentAccount[],
  selectedFromRegister: PaymentCurrencyRegister | null,
): PaymentCurrencyRegister[] {
  if (!selectedFromRegister?.Currency) {
    return []
  }

  const sourceRegisterValue = getEntityValue(selectedFromRegister)

  return dedupeCurrencyRegisters(
    paymentAccounts.reduce<PaymentCurrencyRegister[]>((registers, paymentAccount) => {
      getVisibleCurrencyRegisters(paymentAccount).forEach((register) => {
        if (getEntityValue(register) !== sourceRegisterValue && !isSameCurrency(register.Currency, selectedFromRegister.Currency)) {
          registers.push({
            ...register,
            PaymentRegister: register.PaymentRegister || paymentAccount,
          })
        }
      })

      return registers
    }, []),
  )
}

function dedupeCurrencyRegisters(registers: PaymentCurrencyRegister[]): PaymentCurrencyRegister[] {
  const seen = new Set<string>()

  return registers.filter((register) => {
    const value = getEntityValue(register)

    if (!value || seen.has(value)) {
      return false
    }

    seen.add(value)
    return true
  })
}

function findCurrencyRegister(registers: PaymentCurrencyRegister[], value: string): PaymentCurrencyRegister | null {
  return findEntity(registers, value)
}

function findCurrencyTrader(traders: CurrencyTrader[], value: string): CurrencyTrader | null {
  return findEntity(traders, value)
}

function findEntity<T extends { Id?: number; NetUid?: string }>(items: T[], value: string): T | null {
  if (!value) {
    return null
  }

  return items.find((item) => getEntityValue(item) === value) || null
}

function findDefaultPaymentMovement(movements: PaymentMovement[], defaultName: string): PaymentMovement | null {
  return movements.find((movement) => getPaymentMovementLabel(movement) === defaultName) || movements[0] || null
}

function toCurrencyRegisterSelectOptions(registers: PaymentCurrencyRegister[]): Array<{ label: string; value: string }> {
  return registers.reduce<Array<{ label: string; value: string }>>((options, register) => {
    const value = getEntityValue(register)

    if (value) {
      const accountName = register.PaymentRegister?.Name
      const amount = typeof register.Amount === 'number' ? ` · ${formatMoney(register.Amount)}` : ''

      options.push({
        label: [getCurrencyLabel(register), accountName].filter(Boolean).join(' · ') + amount,
        value,
      })
    }

    return options
  }, [])
}

function toCurrencyTraderSelectOptions(
  traders: CurrencyTrader[],
  currencyCode: string,
): Array<{ label: string; value: string }> {
  return traders.reduce<Array<{ label: string; value: string }>>((options, trader) => {
    const value = getEntityValue(trader)
    const rate = getTraderExchangeRate(trader, currencyCode)

    if (value && rate?.ExchangeRate) {
      options.push({
        label: `${getCurrencyTraderName(trader)} · ${rate.CurrencyName || currencyCode} ${formatMoney(rate.ExchangeRate)}`,
        value,
      })
    }

    return options
  }, [])
}

function getTraderExchangeRate(
  trader: CurrencyTrader | null,
  currencyCode: string,
): NonNullable<CurrencyTrader['CurrencyTraderExchangeRates']>[number] | null {
  if (!trader || !currencyCode) {
    return null
  }

  return (trader.CurrencyTraderExchangeRates || []).find(
    (rate) => rate.CurrencyName?.toLowerCase() === currencyCode.toLowerCase() && typeof rate.ExchangeRate === 'number',
  ) || null
}

function getCurrencyTraderName(trader: CurrencyTrader): string {
  return [trader.FirstName, trader.LastName, trader.MiddleName].filter(Boolean).join(' ') || getEntityValue(trader) || '—'
}

function getExchangeRateCurrencyCode(
  selectedFromRegister: PaymentCurrencyRegister | null,
  selectedToRegister: PaymentCurrencyRegister | null,
): string {
  const fromCode = selectedFromRegister?.Currency?.Code || ''
  const toCode = selectedToRegister?.Currency?.Code || ''

  return toCode.toLowerCase() === 'uah' ? fromCode : toCode
}

function toPaymentMovementOptions(movements: PaymentMovement[]): Array<{ label: string; value: string }> {
  return movements.reduce<Array<{ label: string; value: string }>>((options, movement) => {
    const value = getEntityValue(movement)

    if (value) {
      options.push({
        label: getPaymentMovementLabel(movement) || value,
        value,
      })
    }

    return options
  }, [])
}

function validateTransferDraft(
  draft: PaymentAccountTransferDraft,
  selectedFromRegister: PaymentCurrencyRegister | null,
  selectedToRegister: PaymentCurrencyRegister | null,
  selectedMovement: PaymentMovement | null,
  amount: number,
  t: (value: string) => string,
): string | null {
  if (!selectedFromRegister) {
    return t('Оберіть валюту для списання')
  }

  if (!selectedToRegister) {
    return t('Оберіть рахунок для зарахування')
  }

  if (getEntityValue(selectedFromRegister) === getEntityValue(selectedToRegister)) {
    return t('Оберіть інший рахунок')
  }

  if (!amount || amount <= 0) {
    return t('Вкажіть суму')
  }

  if (!selectedMovement) {
    return t('Оберіть статтю руху')
  }

  if (!draft.fromDate || !draft.time) {
    return t('Вкажіть дату і час')
  }

  return null
}

function validateExchangeDraft(
  draft: PaymentAccountExchangeDraft,
  selectedFromRegister: PaymentCurrencyRegister | null,
  selectedToRegister: PaymentCurrencyRegister | null,
  selectedMovement: PaymentMovement | null,
  amount: number,
  exchangeRate: number,
  t: (value: string) => string,
): string | null {
  if (!selectedFromRegister) {
    return t('Оберіть валюту для списання')
  }

  if (!selectedToRegister) {
    return t('Оберіть валюту зарахування')
  }

  if (getEntityValue(selectedFromRegister) === getEntityValue(selectedToRegister) || isSameCurrency(selectedFromRegister.Currency, selectedToRegister.Currency)) {
    return t('Оберіть іншу валюту')
  }

  if (!amount || amount <= 0) {
    return t('Вкажіть суму')
  }

  if (typeof selectedFromRegister.Amount === 'number' && amount > selectedFromRegister.Amount) {
    return t('Сума більша за залишок')
  }

  if (!exchangeRate || exchangeRate <= 0) {
    return t('Вкажіть курс')
  }

  if (!selectedMovement) {
    return t('Оберіть статтю руху')
  }

  if (!draft.fromDate || !draft.time) {
    return t('Вкажіть дату і час')
  }

  return null
}

function toLocalIsoDateTime(date: string, time: string): string {
  return `${date}T${time || '00:00'}:00`
}

function toTimeInputValue(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function isSameCurrency(left?: Currency | null, right?: Currency | null): boolean {
  const leftValue = getEntityValue(left) || left?.Code || left?.Name
  const rightValue = getEntityValue(right) || right?.Code || right?.Name

  return Boolean(leftValue && rightValue && leftValue === rightValue)
}

function getPaymentMovementLabel(movement?: PaymentMovement | null): string | undefined {
  return movement?.OperationName || movement?.Name
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
  const payloadOrganization = isEditMode && account.Organization ? account.Organization : organization

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
    Organization: payloadOrganization,
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
  const seenValues = new Set<string>()

  return banks.reduce<Array<{ label: string; value: string }>>((options, bank) => {
    const value = bank.Name?.trim() || ''

    if (value && !seenValues.has(value)) {
      seenValues.add(value)
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
