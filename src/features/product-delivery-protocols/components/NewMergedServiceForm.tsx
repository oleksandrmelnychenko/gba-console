import {
  Alert,
  Button,
  Checkbox,
  Divider,
  FileInput,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useEffect, useMemo } from 'react'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import {
  getResponsibleUsers,
  getSupplyOrganizations,
  getSupplyServiceConsumableProducts,
} from '../api/protocolDetailApi'
import type {
  ConsumableProduct,
  NewMergedServiceFormValues,
  SupplyOrganization,
  SupplyOrganizationAgreement,
} from '../detailTypes'
import type { ProtocolUser } from '../types'
import { responsibleName } from './protocolDetailHelpers'

function createInitialValues(): NewMergedServiceFormValues {
  return {
    accountDocuments: [],
    accountingExchangeRate: '',
    accountingTaskComment: '',
    accountingTaskFiles: [],
    accountingTaskPayToDate: new Date(),
    accountingTaskUser: null,
    actDocuments: [],
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
    supplyInformationTaskComment: '',
    supplyInformationTaskGrossPrice: '',
    supplyInformationTaskUser: null,
    supplyOrganization: null,
    taskComment: '',
    taskFiles: [],
    taskPayToDate: new Date(),
    taskUser: null,
  }
}

function toDateInput(value: Date | null): string {
  return value ? formatLocalDate(value) : ''
}

function fromDateInput(value: string): Date | null {
  if (!value) {
    return null
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? null : date
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
      organizations.reduce<Array<{ label: string; value: string }>>((options, organization) => {
        if (organization.NetUid && organization.Name) {
          options.push({ label: organization.Name, value: organization.NetUid })
        }

        return options
      }, []),
    [organizations],
  )

  const agreementOptions = useMemo(() => {
    const agreements = values.supplyOrganization?.SupplyOrganizationAgreements || []

    return agreements.reduce<Array<{ label: string; value: string }>>((options, agreement) => {
      if (agreement.NetUid) {
        options.push({
          label: `${agreement.Name || ''} (${agreement.Currency?.Code || ''})`,
          value: agreement.NetUid,
        })
      }

      return options
    }, [])
  }, [values.supplyOrganization])

  const productOptions = useMemo(
    () =>
      products.reduce<Array<{ label: string; value: string }>>((options, product) => {
        if (product.NetUid && product.Name) {
          options.push({ label: product.Name, value: product.NetUid })
        }

        return options
      }, []),
    [products],
  )

  const userOptions = useMemo(
    () =>
      users.reduce<Array<{ label: string; value: string }>>((options, user) => {
        if (user.NetUid) {
          options.push({ label: responsibleName(user) || user.FullName || '', value: user.NetUid })
        }

        return options
      }, []),
    [users],
  )

  function update<K extends keyof NewMergedServiceFormValues>(key: K, value: NewMergedServiceFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function selectOrganization(netUid: string | null) {
    const organization = organizations.find((item) => item.NetUid === netUid) || null
    setValues((current) => ({ ...current, supplyOrganization: organization, agreement: null }))
  }

  function selectAgreement(netUid: string | null) {
    const agreement = (values.supplyOrganization?.SupplyOrganizationAgreements || []).find(
      (item) => item.NetUid === netUid,
    )
    update('agreement', (agreement as SupplyOrganizationAgreement) || null)
  }

  function selectProduct(netUid: string | null) {
    update('consumableProduct', products.find((item) => item.NetUid === netUid) || null)
  }

  function selectUser(key: 'accountingTaskUser' | 'supplyInformationTaskUser' | 'taskUser', netUid: string | null) {
    update(key, users.find((item) => item.NetUid === netUid) || null)
  }

  async function handleSubmit() {
    if (!values.supplyOrganization || !values.agreement || !values.consumableProduct || !values.invoiceNumber) {
      setValidationError(t('Заповніть обовʼязкові поля'))

      return
    }

    if (!values.grossPrice && !values.grossPriceAccounting) {
      setValidationError(t('Заповніть управлінські або бухгалтерські витрати'))

      return
    }

    if (values.isSupplyInformationTask && !values.supplyInformationTaskUser) {
      setValidationError(t('Вкажіть відповідального за оплату в межах країни'))

      return
    }

    if (values.createTask && !values.taskUser) {
      setValidationError(t('Вкажіть відповідального за платіжну задачу'))

      return
    }

    if (values.createAccountingTask && !values.accountingTaskUser) {
      setValidationError(t('Вкажіть відповідального за бухгалтерську платіжну задачу'))

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
          data={productOptions}
          label={t('Тип')}
          searchable
          value={values.consumableProduct?.NetUid || null}
          onChange={selectProduct}
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
            label={t('Вартість Брутто (Бух.)')}
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
            label={t('Курс валют (Бух.)')}
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
            <Select
              data={userOptions}
              label={t('Відповідальний за оплату в межах країни')}
              searchable
              value={values.supplyInformationTaskUser?.NetUid || null}
              onChange={(netUid) => selectUser('supplyInformationTaskUser', netUid)}
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
          label={t('Рахунок')}
          multiple
          value={values.accountDocuments}
          onChange={(files) => update('accountDocuments', files)}
        />
        <FileInput
          clearable
          label={t('Акт надання послуг')}
          multiple
          value={values.actDocuments}
          onChange={(files) => update('actDocuments', files)}
        />
        <FileInput
          clearable
          label={t('Інші файли')}
          multiple
          value={values.files}
          onChange={(files) => update('files', files)}
        />

        <Group grow>
          <TextInput
            label={t('Сплатити до')}
            type="date"
            value={toDateInput(values.payToDate)}
            onChange={(event) => update('payToDate', fromDateInput(event.currentTarget.value))}
          />
        </Group>
        <Textarea
          label={t('Коментар')}
          value={values.comment}
          onChange={(event) => update('comment', event.currentTarget.value)}
        />

        <Divider />

        <Checkbox
          checked={values.createTask}
          label={t('Створити платіжну задачу')}
          onChange={(event) => update('createTask', event.currentTarget.checked)}
        />
        {values.createTask && (
          <Stack gap="sm">
            <TextInput
              label={t('Сплатити до')}
              type="date"
              value={toDateInput(values.taskPayToDate)}
              onChange={(event) => update('taskPayToDate', fromDateInput(event.currentTarget.value))}
            />
            <Select
              data={userOptions}
              label={t('Відповідальний')}
              searchable
              value={values.taskUser?.NetUid || null}
              onChange={(netUid) => selectUser('taskUser', netUid)}
            />
            <Textarea
              label={t('Коментар')}
              value={values.taskComment}
              onChange={(event) => update('taskComment', event.currentTarget.value)}
            />
            <FileInput
              clearable
              label={t('Інші файли')}
              multiple
              value={values.taskFiles}
              onChange={(files) => update('taskFiles', files)}
            />
          </Stack>
        )}

        <Checkbox
          checked={values.createAccountingTask}
          label={`${t('Створити платіжну задачу')} (${t('Бух.')})`}
          onChange={(event) => update('createAccountingTask', event.currentTarget.checked)}
        />
        {values.createAccountingTask && (
          <Stack gap="sm">
            <TextInput
              label={t('Сплатити до')}
              type="date"
              value={toDateInput(values.accountingTaskPayToDate)}
              onChange={(event) => update('accountingTaskPayToDate', fromDateInput(event.currentTarget.value))}
            />
            <Select
              data={userOptions}
              label={t('Відповідальний')}
              searchable
              value={values.accountingTaskUser?.NetUid || null}
              onChange={(netUid) => selectUser('accountingTaskUser', netUid)}
            />
            <Textarea
              label={t('Коментар')}
              value={values.accountingTaskComment}
              onChange={(event) => update('accountingTaskComment', event.currentTarget.value)}
            />
            <FileInput
              clearable
              label={t('Інші файли')}
              multiple
              value={values.accountingTaskFiles}
              onChange={(files) => update('accountingTaskFiles', files)}
            />
          </Stack>
        )}

        <Group justify="flex-end" gap="sm">
          <Button color="gray" disabled={isSaving} variant="light" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button color="violet" loading={isSaving} onClick={handleSubmit}>
            {t('Зберегти')}
          </Button>
        </Group>

        {productOptions.length === 0 && !loadError && (
          <Text c="dimmed" size="xs">
            {t('Завантаження')}
          </Text>
        )}
      </Stack>
    </AppDrawer>
  )
}
