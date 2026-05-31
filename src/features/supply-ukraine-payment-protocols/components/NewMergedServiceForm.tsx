import {
  Alert,
  Button,
  Checkbox,
  FileInput,
  Group,
  NumberInput,
  Select,
  Stack,
  Textarea,
  TextInput,
} from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useEffect, useMemo } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import {
  getResponsibleUsers,
  getSupplyOrganizations,
  getSupplyServiceConsumableProducts,
} from '../api/paymentProtocolsApi'
import type {
  ConsumableProduct,
  NewMergedServiceFormValues,
  ProtocolUser,
  SupplyOrganization,
  SupplyOrganizationAgreement,
} from '../types'
import { fromDateInput, responsibleName, toDateInput } from './helpers'

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
  const [products, setProducts] = useValueState<ConsumableProduct[]>([])
  const [users, setUsers] = useValueState<ProtocolUser[]>([])
  const [loadError, setLoadError] = useValueState<string | null>(null)
  const [validationError, setValidationError] = useValueState<string | null>(null)
  const [prevOpened, setPrevOpened] = useValueState(opened)

  if (opened !== prevOpened) {
    setPrevOpened(opened)

    if (opened) {
      setValues(createInitialValues())
      setValidationError(null)
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
        const [nextOrganizations, nextProducts, nextUsers] = await Promise.all([
          getSupplyOrganizations(),
          getSupplyServiceConsumableProducts(''),
          getResponsibleUsers(),
        ])

        if (!cancelled) {
          setOrganizations(nextOrganizations)
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
  }, [opened, setLoadError, setOrganizations, setProducts, setUsers, t])

  const organizationOptions = useMemo(
    () =>
      organizations
        .filter((organization) => organization.NetUid && organization.Name)
        .map((organization) => ({ label: organization.Name || '', value: organization.NetUid || '' })),
    [organizations],
  )

  const agreementOptions = useMemo(() => {
    const agreements = values.supplyOrganization?.SupplyOrganizationAgreements || []

    return agreements
      .filter((agreement) => agreement.NetUid)
      .map((agreement) => ({
        label: `${agreement.Name || ''} (${agreement.Currency?.Code || ''})`,
        value: agreement.NetUid || '',
      }))
  }, [values.supplyOrganization])

  const productOptions = useMemo(
    () =>
      products
        .filter((product) => product.NetUid && product.Name)
        .map((product) => ({ label: product.Name || '', value: product.NetUid || '' })),
    [products],
  )

  const userOptions = useMemo(
    () =>
      users
        .filter((user) => user.NetUid)
        .map((user) => ({ label: responsibleName(user) || user.FullName || '', value: user.NetUid || '' })),
    [users],
  )

  function update<K extends keyof NewMergedServiceFormValues>(key: K, value: NewMergedServiceFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function selectOrganization(netUid: string | null) {
    const organization = organizations.find((item) => item.NetUid === netUid) || null
    setValues((current) => ({ ...current, agreement: null, supplyOrganization: organization }))
  }

  function selectAgreement(netUid: string | null) {
    const agreement = (values.supplyOrganization?.SupplyOrganizationAgreements || []).find(
      (item) => item.NetUid === netUid,
    )
    update('agreement', (agreement as SupplyOrganizationAgreement) || null)
  }

  async function handleSubmit() {
    if (!values.supplyOrganization || !values.agreement || !values.name || !values.invoiceNumber) {
      setValidationError(t('Заповніть обовʼязкові поля'))

      return
    }

    if (!values.grossPrice && !values.grossPriceAccounting) {
      setValidationError(t('Заповніть управлінські або бухгалтерські витрати'))

      return
    }

    setValidationError(null)
    await onSubmit(values)
  }

  return (
    <AppDrawer opened={opened} size="lg" title={t('Додати')} onClose={onClose}>
      <Stack gap="sm">
        {loadError && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {loadError}
          </Alert>
        )}
        {validationError && (
          <Alert color="yellow" icon={<IconAlertCircle size={18} />} variant="light">
            {validationError}
          </Alert>
        )}

        <Select
          data={organizationOptions}
          label={t('Постачальник послуг')}
          searchable
          value={values.supplyOrganization?.NetUid || null}
          onChange={selectOrganization}
        />
        <Select
          data={agreementOptions}
          disabled={!values.supplyOrganization}
          label={t('Договір')}
          searchable
          value={values.agreement?.NetUid || null}
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
          label={t('Назва')}
          value={values.name}
          onChange={(event) => update('name', event.currentTarget.value)}
        />
        <TextInput
          label={t('Номер інвойса')}
          value={values.invoiceNumber}
          onChange={(event) => update('invoiceNumber', event.currentTarget.value)}
        />

        <Group grow>
          <TextInput
            label={t('Вартість Брутто')}
            type="number"
            value={values.grossPrice}
            onChange={(event) => update('grossPrice', event.currentTarget.value)}
          />
          <TextInput
            label={t('ПДВ %')}
            type="number"
            value={values.percent}
            onChange={(event) => update('percent', event.currentTarget.value)}
          />
        </Group>

        <Group grow>
          <TextInput
            label={`${t('Вартість Брутто')} (${t('Бух.')})`}
            type="number"
            value={values.grossPriceAccounting}
            onChange={(event) => update('grossPriceAccounting', event.currentTarget.value)}
          />
          <TextInput
            label={`${t('ПДВ %')} (${t('Бух.')})`}
            type="number"
            value={values.percentAccounting}
            onChange={(event) => update('percentAccounting', event.currentTarget.value)}
          />
        </Group>

        <Group grow>
          <TextInput
            label={t('Курс валют')}
            type="number"
            value={values.exchangeRate}
            onChange={(event) => update('exchangeRate', event.currentTarget.value)}
          />
          <TextInput
            label={`${t('Курс валют')} (${t('Бух.')})`}
            type="number"
            value={values.accountingExchangeRate}
            onChange={(event) => update('accountingExchangeRate', event.currentTarget.value)}
          />
        </Group>

        <Checkbox
          checked={values.isIncludeAccountingValue}
          label={t('Включати бух. вартість у ціну брутто')}
          onChange={(event) => update('isIncludeAccountingValue', event.currentTarget.checked)}
        />

        <TextInput
          label={t('Від якої дати')}
          type="date"
          value={toDateInput(values.fromDate)}
          onChange={(event) => update('fromDate', fromDateInput(event.currentTarget.value))}
        />

        <Checkbox
          checked={values.isSupplyInformationTask}
          label={t('Доставка в межах країни')}
          onChange={(event) => update('isSupplyInformationTask', event.currentTarget.checked)}
        />

        {values.isSupplyInformationTask && (
          <Stack gap="sm">
            <NumberInput
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

        <FileInput
          clearable
          label={t('Інші файли')}
          multiple
          value={values.files}
          onChange={(files) => update('files', files)}
        />

        <TextInput
          label={t('Сплатити до')}
          type="date"
          value={toDateInput(values.payToDate)}
          onChange={(event) => update('payToDate', fromDateInput(event.currentTarget.value))}
        />
        <Select
          clearable
          data={userOptions}
          label={t('Відповідальний за оплату')}
          searchable
          value={values.responsibleForPayment?.NetUid || null}
          onChange={(netUid) => update('responsibleForPayment', users.find((item) => item.NetUid === netUid) || null)}
        />
        <Textarea
          label={t('Коментар')}
          value={values.comment}
          onChange={(event) => update('comment', event.currentTarget.value)}
        />

        <Group justify="flex-end" gap="sm">
          <Button color="gray" disabled={isSaving} variant="light" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button color="violet" loading={isSaving} onClick={handleSubmit}>
            {t('Зберегти')}
          </Button>
        </Group>
      </Stack>
    </AppDrawer>
  )
}
