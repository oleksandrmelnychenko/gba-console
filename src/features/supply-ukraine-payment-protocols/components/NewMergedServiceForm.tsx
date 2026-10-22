import {
  Alert,
  Button,
  Checkbox,
  FileInput,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { CircleAlert } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal, AppModalFooter } from '../../../shared/ui/AppModal'
import './payment-service-form.css'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import {
  getResponsibleUsers,
  getSupplyServiceConsumableProducts,
  searchSupplyOrganizations,
} from '../api/paymentProtocolsApi'
import type {
  ConsumableProduct,
  NewMergedServiceFormValues,
  ProtocolUser,
  SupplyOrganization,
  SupplyOrganizationAgreement,
} from '../types'
import { fromDateInput, responsibleName, toDateInput } from './helpers'
import { AppDateInput } from '../../../shared/ui/AppDateInput'

type SelectOption = {
  label: string
  value: string
}

const SUPPLY_ORGANIZATION_SEARCH_DEBOUNCE_MS = 300

type NewMergedServiceFieldErrors = Partial<Record<
  | 'accountingExchangeRate'
  | 'agreement'
  | 'exchangeRate'
  | 'grossPrice'
  | 'grossPriceAccounting'
  | 'invoiceNumber'
  | 'name'
  | 'payToDate'
  | 'percent'
  | 'percentAccounting'
  | 'responsibleForPayment'
  | 'supplyOrganization',
  string
>>

type NewMergedServiceValidation = {
  fieldErrors: NewMergedServiceFieldErrors
  summary: string | null
}

function createInitialValues(): NewMergedServiceFormValues {
  return {
    accountDocuments: [],
    accountingExchangeRate: '',
    agreement: null,
    comment: '',
    consumableProduct: null,
    createAccountingTask: false,
    createTask: false,
    exchangeRate: '',
    files: [],
    fromDate: new Date(),
    grossPrice: '',
    grossPriceAccounting: '',
    invoiceNumber: '',
    isIncludeAccountingValue: false,
    isSupplyInformationTask: false,
    name: '',
    payToDate: new Date(),
    percent: '',
    percentAccounting: '',
    responsibleForPayment: null,
    supplyInformationTaskComment: '',
    supplyInformationTaskGrossPrice: '',
    supplyOrganization: null,
  }
}

export function NewMergedServiceForm({
  opened,
  isSaving,
  onClose,
  onSubmit,
}: {
  isSaving: boolean
  onClose: () => void
  onSubmit: (values: NewMergedServiceFormValues) => Promise<void>
  opened: boolean
}) {
  const { t } = useI18n()
  const [values, setValues] = useValueState<NewMergedServiceFormValues>(createInitialValues)
  const [organizations, setOrganizations] = useValueState<SupplyOrganization[]>([])
  const [organizationSearch, setOrganizationSearch] = useValueState('')
  const [debouncedOrganizationSearch] = useDebouncedValue(
    organizationSearch,
    SUPPLY_ORGANIZATION_SEARCH_DEBOUNCE_MS,
  )
  const [products, setProducts] = useValueState<ConsumableProduct[]>([])
  const [users, setUsers] = useValueState<ProtocolUser[]>([])
  const [loadError, setLoadError] = useValueState<string | null>(null)
  const [validationError, setValidationError] = useValueState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useValueState<NewMergedServiceFieldErrors>({})
  const [prevOpened, setPrevOpened] = useValueState(opened)

  if (opened !== prevOpened) {
    setPrevOpened(opened)

    if (opened) {
      setValues(createInitialValues())
      setOrganizations([])
      setOrganizationSearch('')
      setValidationError(null)
      setFieldErrors({})
    }
  }

  useEffect(() => {
    if (!opened) {
      return
    }

    let cancelled = false

    async function loadLookups() {
      setLoadError(null)

      try {
        const [nextProducts, nextUsers] = await Promise.all([
          getSupplyServiceConsumableProducts(''),
          getResponsibleUsers(),
        ])

        if (!cancelled) {
          setProducts(nextProducts)
          setUsers(nextUsers)
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : t('Не вдалося завантажити довідники'))
        }
      }
    }

    void loadLookups()

    return () => {
      cancelled = true
    }
  }, [opened, setLoadError, setProducts, setUsers, t])

  useEffect(() => {
    if (!opened) {
      return
    }

    const value = debouncedOrganizationSearch.trim()

    if (!value) {
      setOrganizations([])
      return
    }

    let cancelled = false

    async function loadOrganizations() {
      try {
        const nextOrganizations = await searchSupplyOrganizations(value)

        if (!cancelled) {
          setOrganizations(nextOrganizations)
        }
      } catch {
        if (!cancelled) {
          setOrganizations([])
        }
      }
    }

    void loadOrganizations()

    return () => {
      cancelled = true
    }
  }, [debouncedOrganizationSearch, opened, setOrganizations])

  const organizationOptions = useMemo(
    () => toSupplyOrganizationOptions(organizations),
    [organizations],
  )

  const agreementOptions = useMemo(() => {
    const agreements = values.supplyOrganization?.SupplyOrganizationAgreements || []

    return toSupplyAgreementOptions(agreements)
  }, [values.supplyOrganization])

  const productOptions = useMemo(
    () => toConsumableProductOptions(products),
    [products],
  )

  const userOptions = useMemo(
    () => toProtocolUserOptions(users),
    [users],
  )
  const willCreatePaymentTask = Number(values.grossPrice) > 0 || Number(values.grossPriceAccounting) > 0

  function update<K extends keyof NewMergedServiceFormValues>(key: K, value: NewMergedServiceFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
    setValidationError(null)
    clearFieldErrors(
      key as keyof NewMergedServiceFieldErrors,
      ...(key === 'grossPrice' || key === 'grossPriceAccounting'
        ? (['grossPrice', 'grossPriceAccounting'] as const)
        : []),
    )
  }

  function clearFieldErrors(...keys: Array<keyof NewMergedServiceFieldErrors>) {
    setFieldErrors((current) => {
      const next = { ...current }

      for (const key of keys) {
        delete next[key]
      }

      return next
    })
  }

  function selectOrganization(netUid: string | null) {
    const organization = organizations.find((item) => item.NetUid === netUid) || null
    setValues((current) => ({ ...current, agreement: null, supplyOrganization: organization }))
    setValidationError(null)
    clearFieldErrors('supplyOrganization')
  }

  function selectAgreement(netUid: string | null) {
    const agreement = (values.supplyOrganization?.SupplyOrganizationAgreements || []).find(
      (item) => item.NetUid === netUid,
    )
    update('agreement', (agreement as SupplyOrganizationAgreement) || null)
  }

  async function handleSubmit() {
    const validation = validateNewMergedService(values, t)

    if (validation.summary) {
      setValidationError(validation.summary)
      setFieldErrors(validation.fieldErrors)

      return
    }

    setValidationError(null)
    setFieldErrors({})
    await onSubmit(values)
  }

  return (
    <AppModal className="app-compact-form payment-service-form" opened={opened} size={960} title={t('Додати')} onClose={onClose}>
      <Stack className="app-compact-form" gap={10}>
        {loadError && (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {loadError}
          </Alert>
        )}
        {validationError && (
          <Alert color="yellow" icon={<CircleAlert size={18} />} variant="light">
            {validationError}
          </Alert>
        )}
        <section className="app-section-card payment-service-form__section">
          <Text className="app-section-title">{t('Послуга')}</Text>
          <div className="payment-service-form__parties">
            <Select
              aria-invalid={Boolean(fieldErrors.supplyOrganization)}
              aria-required="true"
              data={organizationOptions}
              error={fieldErrors.supplyOrganization}
              label={t('Постачальник послуг')}
              nothingFoundMessage={t('Нічого не знайдено')}
              searchable
              searchValue={organizationSearch}
              value={values.supplyOrganization?.NetUid || null}
              withAsterisk
              onChange={(value) => {
                selectOrganization(value)
                setOrganizationSearch('')
              }}
              onSearchChange={setOrganizationSearch}
            />
            <Select
              aria-invalid={Boolean(fieldErrors.agreement)}
              aria-required="true"
              data={agreementOptions}
              disabled={!values.supplyOrganization}
              error={fieldErrors.agreement}
              label={t('Договір')}
              searchable
              value={values.agreement?.NetUid || null}
              withAsterisk
              onChange={selectAgreement}
            />
            <Select
              clearable
              data={productOptions}
              label={t('Тип')}
              searchable
              value={values.consumableProduct?.NetUid || null}
              onChange={(netUid) => update('consumableProduct', products.find((item) => item.NetUid === netUid) || null)}
            />
            <TextInput
              aria-invalid={Boolean(fieldErrors.name)}
              aria-required="true"
              error={fieldErrors.name}
              label={t('Назва')}
              value={values.name}
              withAsterisk
              onChange={(event) => update('name', event.currentTarget.value)}
            />
          </div>
          <div className="payment-service-form__number">
            <TextInput
              aria-invalid={Boolean(fieldErrors.invoiceNumber)}
              aria-required="true"
              error={fieldErrors.invoiceNumber}
              label={t('Номер інвойса')}
              value={values.invoiceNumber}
              withAsterisk
              onChange={(event) => update('invoiceNumber', event.currentTarget.value)}
            />
          </div>
        </section>
        <section className="app-section-card payment-service-form__section">
          <Text className="app-section-title">{t('Розрахунок')}</Text>
          <div className="payment-service-form__amounts">
            <TextInput
              aria-invalid={Boolean(fieldErrors.grossPrice)}
              classNames={{ input: 'app-money' }}
              description={t('Заповніть хоча б одну вартість: управлінську або бухгалтерську')}
              error={fieldErrors.grossPrice}
              label={t('Вартість Брутто')}
              type="number"
              value={values.grossPrice}
              onChange={(event) => update('grossPrice', event.currentTarget.value)}
            />
            <TextInput
              aria-invalid={Boolean(fieldErrors.percent)}
              error={fieldErrors.percent}
              label={t('ПДВ %')}
              type="number"
              value={values.percent}
              onChange={(event) => update('percent', event.currentTarget.value)}
            />
            <TextInput
              aria-invalid={Boolean(fieldErrors.exchangeRate)}
              error={fieldErrors.exchangeRate}
              label={t('Курс валют')}
              type="number"
              value={values.exchangeRate}
              onChange={(event) => update('exchangeRate', event.currentTarget.value)}
            />
            <TextInput
              aria-invalid={Boolean(fieldErrors.grossPriceAccounting)}
              classNames={{ input: 'app-money' }}
              error={fieldErrors.grossPriceAccounting}
              label={`${t('Вартість Брутто')} (${t('Бух.')})`}
              type="number"
              value={values.grossPriceAccounting}
              onChange={(event) => update('grossPriceAccounting', event.currentTarget.value)}
            />
            <TextInput
              aria-invalid={Boolean(fieldErrors.percentAccounting)}
              error={fieldErrors.percentAccounting}
              label={`${t('ПДВ %')} (${t('Бух.')})`}
              type="number"
              value={values.percentAccounting}
              onChange={(event) => update('percentAccounting', event.currentTarget.value)}
            />
            <TextInput
              aria-invalid={Boolean(fieldErrors.accountingExchangeRate)}
              error={fieldErrors.accountingExchangeRate}
              label={`${t('Курс валют')} (${t('Бух.')})`}
              type="number"
              value={values.accountingExchangeRate}
              onChange={(event) => update('accountingExchangeRate', event.currentTarget.value)}
            />
          </div>
          <Checkbox
            checked={values.isIncludeAccountingValue}
            label={t('Включати бух. вартість у ціну брутто')}
            onChange={(event) => update('isIncludeAccountingValue', event.currentTarget.checked)}
          />
        </section>
        <section className="app-section-card payment-service-form__section">
          <Text className="app-section-title">{t('Оплата та доставка')}</Text>
          <div className="payment-service-form__payment">
            <div className="payment-service-form__date">
              <AppDateInput
                label={t('Від якої дати')}
                type="date"
                value={toDateInput(values.fromDate)}
                onChange={(event) => update('fromDate', fromDateInput(event.currentTarget.value))}
              />
            </div>
            <div className="payment-service-form__date">
              <AppDateInput
                aria-invalid={Boolean(fieldErrors.payToDate)}
                aria-required={willCreatePaymentTask}
                error={fieldErrors.payToDate}
                label={t('Сплатити до')}
                type="date"
                value={toDateInput(values.payToDate)}
                withAsterisk={willCreatePaymentTask}
                onChange={(event) => update('payToDate', fromDateInput(event.currentTarget.value))}
              />
            </div>
            <div className="payment-service-form__responsible">
              <Select
                aria-invalid={Boolean(fieldErrors.responsibleForPayment)}
                aria-required={willCreatePaymentTask}
                clearable
                data={userOptions}
                error={fieldErrors.responsibleForPayment}
                label={t('Відповідальний за оплату')}
                searchable
                value={values.responsibleForPayment?.NetUid || null}
                withAsterisk={willCreatePaymentTask}
                onChange={(netUid) => update('responsibleForPayment', users.find((item) => item.NetUid === netUid) || null)}
              />
            </div>
          </div>
          <Checkbox
            checked={values.isSupplyInformationTask}
            label={t('Доставка в межах країни')}
            onChange={(event) => update('isSupplyInformationTask', event.currentTarget.checked)}
          />
          {values.isSupplyInformationTask && (
            <Stack gap="sm">
              <NumberInput
                maw="100%"
                w={220}
                label={t('Вартість доставки в межах країни')}
                value={values.supplyInformationTaskGrossPrice}
                onChange={(value) => update('supplyInformationTaskGrossPrice', String(value))}
              />
              <Textarea
                label={t('Коментар')}
                value={values.supplyInformationTaskComment}
                onChange={(event) => update('supplyInformationTaskComment', event.currentTarget.value)}
              />
            </Stack>
          )}
          <div className="payment-service-form__parties">
            <FileInput
              clearable
              label={t('Інші файли')}
              multiple
              value={values.files}
              onChange={(files) => update('files', files)}
            />
            <Textarea
              label={t('Коментар')}
              value={values.comment}
              onChange={(event) => update('comment', event.currentTarget.value)}
            />
          </div>
        </section>
        <AppModalFooter>
          <Button color="gray" variant="default" onClick={onClose}>{t('Скасувати')}</Button>
          <Button color={CREATE_ACTION_COLOR} loading={isSaving} onClick={handleSubmit}>{t('Зберегти')}</Button>
        </AppModalFooter>
      </Stack>
    </AppModal>
  )
}

function validateNewMergedService(
  values: NewMergedServiceFormValues,
  t: (value: string) => string,
): NewMergedServiceValidation {
  const fieldErrors: NewMergedServiceFieldErrors = {}

  if (!values.supplyOrganization) {
    fieldErrors.supplyOrganization = t('Оберіть постачальника послуг')
  }
  if (!values.agreement) {
    fieldErrors.agreement = t('Оберіть договір')
  }
  if (!values.name.trim()) {
    fieldErrors.name = t('Вкажіть назву')
  }
  if (!values.invoiceNumber.trim()) {
    fieldErrors.invoiceNumber = t('Вкажіть номер інвойса')
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, summary: t('Заповніть обовʼязкові поля') }
  }

  if (!values.grossPrice && !values.grossPriceAccounting) {
    const grossPriceError = t('Заповніть управлінську або бухгалтерську вартість')
    fieldErrors.grossPrice = grossPriceError
    fieldErrors.grossPriceAccounting = grossPriceError
    return { fieldErrors, summary: t('Заповніть управлінські або бухгалтерські витрати') }
  }

  const willCreatePaymentTask = Number(values.grossPrice) > 0 || Number(values.grossPriceAccounting) > 0

  if (willCreatePaymentTask && !values.responsibleForPayment) {
    fieldErrors.responsibleForPayment = t('Вкажіть відповідального за оплату')
  }
  if (willCreatePaymentTask && !values.payToDate) {
    fieldErrors.payToDate = t('Вкажіть дату оплати')
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, summary: t('Заповніть обовʼязкові поля') }
  }

  const numericFields = [
    ['grossPrice', values.grossPrice],
    ['grossPriceAccounting', values.grossPriceAccounting],
    ['percent', values.percent],
    ['percentAccounting', values.percentAccounting],
    ['exchangeRate', values.exchangeRate],
    ['accountingExchangeRate', values.accountingExchangeRate],
  ] as const

  for (const [key, value] of numericFields) {
    if (value !== '' && Number(value) < 0) {
      fieldErrors[key] = t('Значення не може бути відʼємним')
    }
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, summary: t('Значення не можуть бути відʼємними') }
  }

  return { fieldErrors, summary: null }
}

function toSupplyOrganizationOptions(organizations: SupplyOrganization[]): SelectOption[] {
  const options: SelectOption[] = []

  for (const organization of organizations) {
    if (!organization.NetUid || !organization.Name) {
      continue
    }

    options.push({ label: organization.Name, value: organization.NetUid })
  }

  return options
}

function toSupplyAgreementOptions(agreements: SupplyOrganizationAgreement[]): SelectOption[] {
  const options: SelectOption[] = []

  for (const agreement of agreements) {
    if (!agreement.NetUid) {
      continue
    }

    options.push({
      label: `${agreement.Name || ''} (${agreement.Currency?.Code || ''})`,
      value: agreement.NetUid,
    })
  }

  return options
}

function toConsumableProductOptions(products: ConsumableProduct[]): SelectOption[] {
  const options: SelectOption[] = []

  for (const product of products) {
    if (!product.NetUid || !product.Name) {
      continue
    }

    options.push({ label: product.Name, value: product.NetUid })
  }

  return options
}

function toProtocolUserOptions(users: ProtocolUser[]): SelectOption[] {
  const options: SelectOption[] = []

  for (const user of users) {
    if (!user.NetUid) {
      continue
    }

    options.push({ label: responsibleName(user) || user.FullName || '', value: user.NetUid })
  }

  return options
}
