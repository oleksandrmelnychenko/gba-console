import {
  Alert,
  Button,
  Checkbox,
  FileInput,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { IconAlertCircle } from '@tabler/icons-react'
import { useEffect, useMemo, type ReactNode } from 'react'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import {
  getResponsibleUsers,
  getSupplyServiceConsumableProducts,
  searchSupplyOrganizations,
} from '../api/protocolDetailApi'
import type {
  ConsumableProduct,
  NewMergedServiceFormValues,
  SupplyOrganization,
  SupplyOrganizationAgreement,
} from '../detailTypes'
import type { ProtocolUser } from '../types'
import { responsibleName } from './protocolDetailHelpers'
import './new-merged-service-form.css'

const SUPPLY_ORGANIZATION_SEARCH_DEBOUNCE_MS = 300

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
  const [organizationSearch, setOrganizationSearch] = useValueState('')
  const [debouncedOrganizationSearch] = useDebouncedValue(
    organizationSearch,
    SUPPLY_ORGANIZATION_SEARCH_DEBOUNCE_MS,
  )
  const [products, setProducts] = useValueState<ConsumableProduct[]>([])
  const [users, setUsers] = useValueState<ProtocolUser[]>([])
  const [loadError, setLoadError] = useValueState<string | null>(null)
  const [validationError, setValidationError] = useValueState<string | null>(null)
  const [prevOpened, setPrevOpened] = useValueState(opened)

  if (opened !== prevOpened) {
    setPrevOpened(opened)

    if (opened) {
      setValues(createInitialValues())
      setOrganizations([])
      setOrganizationSearch('')
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
    if (isSaving) {
      return
    }

    setValues((current) => ({ ...current, [key]: value }))
  }

  function selectOrganization(netUid: string | null) {
    if (isSaving) {
      return
    }

    const organization = organizations.find((item) => item.NetUid === netUid) || null
    setValues((current) => ({ ...current, supplyOrganization: organization, agreement: null }))
  }

  function selectAgreement(netUid: string | null) {
    if (isSaving) {
      return
    }

    const agreement = (values.supplyOrganization?.SupplyOrganizationAgreements || []).find(
      (item) => item.NetUid === netUid,
    )
    update('agreement', (agreement as SupplyOrganizationAgreement) || null)
  }

  function selectProduct(netUid: string | null) {
    if (isSaving) {
      return
    }

    update('consumableProduct', products.find((item) => item.NetUid === netUid) || null)
  }

  function selectUser(key: 'accountingTaskUser' | 'supplyInformationTaskUser' | 'taskUser', netUid: string | null) {
    if (isSaving) {
      return
    }

    update(key, users.find((item) => item.NetUid === netUid) || null)
  }

  async function handleSubmit() {
    if (isSaving) {
      return
    }

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
    <AppModal
      centered
      closeOnClickOutside={!isSaving}
      opened={opened}
      size="min(1280px, calc(100vw - 32px))"
      title={<span className="new-merged-service-title">{t('Додати об’єднаний сервіс')}</span>}
      onClose={() => {
        if (!isSaving) {
          onClose()
        }
      }}
    >
      <Stack className="new-merged-service-modal" gap={12}>
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

        <NewMergedServiceSection title={t('Основне')}>
          <div className="new-merged-service-grid">
            <Select
              className="new-merged-service-control is-wide"
              data={organizationOptions}
              disabled={isSaving}
              label={t('Постачальник послуг')}
              nothingFoundMessage={t('Нічого не знайдено')}
              searchable
              searchValue={organizationSearch}
              value={values.supplyOrganization?.NetUid || null}
              onChange={(value) => {
                selectOrganization(value)
                setOrganizationSearch('')
              }}
              onSearchChange={setOrganizationSearch}
            />
            <Select
              className="new-merged-service-control"
              data={agreementOptions}
              disabled={isSaving || !values.supplyOrganization}
              label={t('Договір')}
              searchable
              value={values.agreement?.NetUid || null}
              onChange={selectAgreement}
            />
            <Select
              className="new-merged-service-control"
              data={productOptions}
              disabled={isSaving}
              label={t('Тип')}
              searchable
              value={values.consumableProduct?.NetUid || null}
              onChange={selectProduct}
            />
            <TextInput
              className="new-merged-service-control"
              disabled={isSaving}
              label={t('Номер інвойса')}
              value={values.invoiceNumber}
              onChange={(event) => update('invoiceNumber', event.currentTarget.value)}
            />
            <TextInput
              className="new-merged-service-control is-wide"
              disabled={isSaving}
              label={t('Назва')}
              value={values.name}
              onChange={(event) => update('name', event.currentTarget.value)}
            />
            <TextInput
              className="new-merged-service-control"
              disabled={isSaving}
              label={t('Від якої дати')}
              type="date"
              value={toDateInput(values.fromDate)}
              onChange={(event) => update('fromDate', fromDateInput(event.currentTarget.value))}
            />
          </div>
        </NewMergedServiceSection>

        <NewMergedServiceSection title={t('Витрати')}>
          <div className="new-merged-service-grid">
            <TextInput
              className="new-merged-service-control is-number"
              disabled={isSaving}
              label={t('Вартість Брутто')}
              type="number"
              value={values.grossPrice}
              onChange={(event) => update('grossPrice', event.currentTarget.value)}
            />
            <TextInput
              className="new-merged-service-control is-number"
              disabled={isSaving}
              label={t('ПДВ %')}
              type="number"
              value={values.percent}
              onChange={(event) => update('percent', event.currentTarget.value)}
            />
            <TextInput
              className="new-merged-service-control is-number"
              disabled={isSaving}
              label={t('Курс валют')}
              type="number"
              value={values.exchangeRate}
              onChange={(event) => update('exchangeRate', event.currentTarget.value)}
            />
            <TextInput
              className="new-merged-service-control is-number"
              disabled={isSaving}
              label={t('Вартість Брутто (Бух.)')}
              type="number"
              value={values.grossPriceAccounting}
              onChange={(event) => update('grossPriceAccounting', event.currentTarget.value)}
            />
            <TextInput
              className="new-merged-service-control is-number"
              disabled={isSaving}
              label={`${t('ПДВ %')} (${t('Бух.')})`}
              type="number"
              value={values.percentAccounting}
              onChange={(event) => update('percentAccounting', event.currentTarget.value)}
            />
            <TextInput
              className="new-merged-service-control is-number"
              disabled={isSaving}
              label={t('Курс валют (Бух.)')}
              type="number"
              value={values.accountingExchangeRate}
              onChange={(event) => update('accountingExchangeRate', event.currentTarget.value)}
            />
          </div>
          <Checkbox
            checked={values.isIncludeAccountingValue}
            className="new-merged-service-checkbox"
            disabled={isSaving}
            label={t('Включати бух. вартість у ціну брутто')}
            onChange={(event) => update('isIncludeAccountingValue', event.currentTarget.checked)}
          />
        </NewMergedServiceSection>

        <NewMergedServiceSection title={t('Доставка в межах країни')}>
          <Checkbox
            checked={values.isSupplyInformationTask}
            className="new-merged-service-checkbox"
            disabled={isSaving}
            label={t('Доставка в межах країни')}
            onChange={(event) => update('isSupplyInformationTask', event.currentTarget.checked)}
          />

          {values.isSupplyInformationTask && (
            <div className="new-merged-service-grid">
              <NumberInput
                className="new-merged-service-control is-number"
                disabled={isSaving}
                label={t('Вартість доставки в межах країни')}
                value={values.supplyInformationTaskGrossPrice}
                onChange={(value) => update('supplyInformationTaskGrossPrice', String(value))}
              />
              <Select
                className="new-merged-service-control"
                data={userOptions}
                disabled={isSaving}
                label={t('Відповідальний за оплату в межах країни')}
                searchable
                value={values.supplyInformationTaskUser?.NetUid || null}
                onChange={(netUid) => selectUser('supplyInformationTaskUser', netUid)}
              />
              <Textarea
                className="new-merged-service-control is-wide"
                disabled={isSaving}
                label={t('Коментар')}
                value={values.supplyInformationTaskComment}
                onChange={(event) => update('supplyInformationTaskComment', event.currentTarget.value)}
              />
            </div>
          )}
        </NewMergedServiceSection>

        <NewMergedServiceSection title={t('Документи')}>
          <div className="new-merged-service-grid">
            <FileInput
              clearable
              className="new-merged-service-control"
              disabled={isSaving}
              label={t('Рахунок')}
              multiple
              value={values.accountDocuments}
              onChange={(files) => update('accountDocuments', files)}
            />
            <FileInput
              clearable
              className="new-merged-service-control"
              disabled={isSaving}
              label={t('Акт надання послуг')}
              multiple
              value={values.actDocuments}
              onChange={(files) => update('actDocuments', files)}
            />
            <FileInput
              clearable
              className="new-merged-service-control"
              disabled={isSaving}
              label={t('Інші файли')}
              multiple
              value={values.files}
              onChange={(files) => update('files', files)}
            />
            <TextInput
              className="new-merged-service-control"
              disabled={isSaving}
              label={t('Сплатити до')}
              type="date"
              value={toDateInput(values.payToDate)}
              onChange={(event) => update('payToDate', fromDateInput(event.currentTarget.value))}
            />
            <Textarea
              className="new-merged-service-control is-wide"
              disabled={isSaving}
              label={t('Коментар')}
              value={values.comment}
              onChange={(event) => update('comment', event.currentTarget.value)}
            />
          </div>
        </NewMergedServiceSection>

        <NewMergedServiceSection title={t('Платіжні задачі')}>
          <Stack gap={10}>
            <Checkbox
              checked={values.createTask}
              className="new-merged-service-checkbox"
              disabled={isSaving}
              label={t('Створити платіжну задачу')}
              onChange={(event) => update('createTask', event.currentTarget.checked)}
            />
            {values.createTask && (
              <div className="new-merged-service-grid">
                <TextInput
                  className="new-merged-service-control"
                  disabled={isSaving}
                  label={t('Сплатити до')}
                  type="date"
                  value={toDateInput(values.taskPayToDate)}
                  onChange={(event) => update('taskPayToDate', fromDateInput(event.currentTarget.value))}
                />
                <Select
                  className="new-merged-service-control"
                  data={userOptions}
                  disabled={isSaving}
                  label={t('Відповідальний')}
                  searchable
                  value={values.taskUser?.NetUid || null}
                  onChange={(netUid) => selectUser('taskUser', netUid)}
                />
                <Textarea
                  className="new-merged-service-control is-wide"
                  disabled={isSaving}
                  label={t('Коментар')}
                  value={values.taskComment}
                  onChange={(event) => update('taskComment', event.currentTarget.value)}
                />
                <FileInput
                  clearable
                  className="new-merged-service-control is-wide"
                  disabled={isSaving}
                  label={t('Інші файли')}
                  multiple
                  value={values.taskFiles}
                  onChange={(files) => update('taskFiles', files)}
                />
              </div>
            )}

            <Checkbox
              checked={values.createAccountingTask}
              className="new-merged-service-checkbox"
              disabled={isSaving}
              label={`${t('Створити платіжну задачу')} (${t('Бух.')})`}
              onChange={(event) => update('createAccountingTask', event.currentTarget.checked)}
            />
            {values.createAccountingTask && (
              <div className="new-merged-service-grid">
                <TextInput
                  className="new-merged-service-control"
                  disabled={isSaving}
                  label={t('Сплатити до')}
                  type="date"
                  value={toDateInput(values.accountingTaskPayToDate)}
                  onChange={(event) => update('accountingTaskPayToDate', fromDateInput(event.currentTarget.value))}
                />
                <Select
                  className="new-merged-service-control"
                  data={userOptions}
                  disabled={isSaving}
                  label={t('Відповідальний')}
                  searchable
                  value={values.accountingTaskUser?.NetUid || null}
                  onChange={(netUid) => selectUser('accountingTaskUser', netUid)}
                />
                <Textarea
                  className="new-merged-service-control is-wide"
                  disabled={isSaving}
                  label={t('Коментар')}
                  value={values.accountingTaskComment}
                  onChange={(event) => update('accountingTaskComment', event.currentTarget.value)}
                />
                <FileInput
                  clearable
                  className="new-merged-service-control is-wide"
                  disabled={isSaving}
                  label={t('Інші файли')}
                  multiple
                  value={values.accountingTaskFiles}
                  onChange={(files) => update('accountingTaskFiles', files)}
                />
              </div>
            )}
          </Stack>
        </NewMergedServiceSection>

        {productOptions.length === 0 && !loadError && (
          <Text c="dimmed" size="xs">
            {t('Завантаження')}
          </Text>
        )}

        <Group className="new-merged-service-footer" justify="flex-end" gap={8}>
          <Button disabled={isSaving} variant="default" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button color={CREATE_ACTION_COLOR} disabled={isSaving} loading={isSaving} onClick={handleSubmit}>
            {t('Зберегти')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function NewMergedServiceSection({
  children,
  title,
}: {
  children: ReactNode
  title: string
}) {
  return (
    <section className="new-merged-service-section">
      <Text className="app-section-title" fw={600} size="sm">
        {title}
      </Text>
      <div className="new-merged-service-section-body">{children}</div>
    </section>
  )
}
