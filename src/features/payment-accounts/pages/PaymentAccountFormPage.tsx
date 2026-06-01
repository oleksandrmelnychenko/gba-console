import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Group,
  Select,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconArrowLeft, IconDeviceFloppy, IconTrash } from '@tabler/icons-react'
import { type FormEvent, useEffect, useMemo, useReducer } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { useAuth } from '../../auth/useAuth'
import {
  createPaymentAccount,
  deletePaymentAccount,
  getPaymentAccount,
  getPaymentAccountBanks,
  getPaymentAccountCurrencies,
  getPaymentAccountOrganizations,
  updatePaymentAccount,
} from '../api/paymentAccountsApi'
import { PAYMENT_ACCOUNT_CREATE_PERMISSION, PAYMENT_ACCOUNT_EDIT_PERMISSION } from '../permissions'
import type {
  BankItem,
  Currency,
  NamedEntity,
  Organization,
  PaymentAccount,
  PaymentAccountPayload,
  PaymentCurrencyRegister,
} from '../types'
import { PaymentRegisterType } from '../types'

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
  isEditMode: boolean
  isLoading: boolean
  isSaving: boolean
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

const ACCOUNTS_PATH = '/accounting/payment-accounts'
const SKIPPED_CURRENCY_CODE = ['P', 'L', 'N'].join('')

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
  const [isSaving, setSaving] = useValueState(false)
  const [isDeleting, setDeleting] = useValueState(false)
  const [deleteModalOpened, setDeleteModalOpened] = useValueState(false)
  const { account, banks, currencyDrafts, error, form, hiddenCurrencyRegisters, isLoading, organizations } = pageState
  const canSave = hasPermission(isEditMode ? PAYMENT_ACCOUNT_EDIT_PERMISSION : PAYMENT_ACCOUNT_CREATE_PERMISSION)

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
      isEditMode,
      isLoading,
      isSaving,
    }),
    [canSave, isDeleting, isEditMode, isLoading, isSaving],
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

    const validationError = validateForm(form, currencyDrafts, selectedOrganization, canSave, t)

    if (validationError) {
      dispatchPageState({ error: validationError })
      return
    }

    const payload = toPayload(account, form, selectedOrganization as Organization, currencyDrafts, hiddenCurrencyRegisters)
    setSaving(true)
    dispatchPageState({ error: null })

    try {
      const savedAccount = isEditMode ? await updatePaymentAccount(payload) : await createPaymentAccount(payload)
      const nextAccount = savedAccount || payload
      dispatchPageState({ account: nextAccount })
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
      <Card withBorder radius="md" shadow="sm">
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <PaymentAccountFormHeader
              state={headerState}
              onCancel={handleCancel}
              onOpenDelete={() => setDeleteModalOpened(true)}
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
              onChange={setAccountType}
            />

            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <TextInput
                disabled={isLoading || isSaving || isDeleting}
                label={t('Назва')}
                required
                value={form.name}
                onChange={(event) => updateForm({ name: event.currentTarget.value })}
              />
              <Select
                data={organizationOptions}
                disabled={isLoading || isSaving || isDeleting}
                label={t('Організація')}
                required
                searchable
                value={form.organizationNetId || null}
                onChange={(value) => updateForm({ organizationNetId: value || '' })}
              />
            </SimpleGrid>

            {form.type === PaymentRegisterType.Bank && (
              <BankFields
                bankOptions={bankOptions}
                disabled={isLoading || isSaving || isDeleting}
                form={form}
                onChange={updateForm}
              />
            )}

            {form.type === PaymentRegisterType.Card && (
              <CardFields
                bankOptions={bankOptions}
                disabled={isLoading || isSaving || isDeleting}
                form={form}
                onChange={updateForm}
              />
            )}

            <Divider />
            <CurrencySelector
              drafts={currencyDrafts}
              isSingle={form.type !== PaymentRegisterType.Cash}
              isDisabled={isLoading || isSaving || isDeleting}
              onChange={updateCurrency}
            />
          </Stack>
        </form>
      </Card>

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

function PaymentAccountFormHeader({
  state,
  onCancel,
  onOpenDelete,
}: {
  state: PaymentAccountFormHeaderState
  onCancel: () => void
  onOpenDelete: () => void
}) {
  const { t } = useI18n()
  const { canSave, isDeleting, isEditMode, isLoading, isSaving } = state

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
        {isEditMode && canSave && (
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
        <Button
          color="violet"
          disabled={isLoading || !canSave}
          leftSection={<IconDeviceFloppy size={16} />}
          loading={isSaving}
          type="submit"
        >
          {t('Зберегти')}
        </Button>
      </Group>
    </Group>
  )
}

function BankFields({
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
        searchable
        value={form.bankName || null}
        onChange={(value) => onChange({ bankName: value || '' })}
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
  isDisabled,
  isSingle,
  onChange,
}: {
  drafts: CurrencyDraft[]
  isDisabled: boolean
  isSingle: boolean
  onChange: (index: number, patch: Partial<CurrencyDraft>) => void
}) {
  const { t } = useI18n()

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
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {drafts.map((draft, index) => (
          <Card key={draft.currency.NetUid || draft.currency.Id || draft.currency.Code || index} withBorder radius="sm" padding="sm">
            <Stack gap="xs">
              <Checkbox
                checked={draft.selected}
                disabled={isDisabled}
                label={draft.currency.Code || draft.currency.Name || t('Валюта')}
                onChange={(event) => onChange(index, { selected: event.currentTarget.checked })}
              />
              <TextInput
                disabled={isDisabled || !draft.selected}
                inputMode="decimal"
                label={t('Сума')}
                value={draft.amount}
                onChange={(event) => onChange(index, { amount: event.currentTarget.value })}
              />
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
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
    PaymentCurrencyRegisters: [
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

  if (!currencyDrafts.some((draft) => draft.selected)) {
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

function parseAmount(value: string): number {
  const normalized = value.replace(',', '.')
  const parsed = Number(normalized)

  return Number.isFinite(parsed) ? parsed : 0
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
