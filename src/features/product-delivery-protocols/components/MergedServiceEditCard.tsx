import {
  Alert,
  Anchor,
  Badge,
  Button,
  Checkbox,
  Divider,
  FileInput,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useEffect, useMemo } from 'react'
import { formatLocalDate, formatLocalInputDateTime } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { getResponsibleUsers, getSupplyOrganizations, getSupplyServiceConsumableProducts } from '../api/protocolDetailApi'
import type {
  ActProvidingService,
  ConsumableProduct,
  MergedService,
  SupplyDocument,
  SupplyInformationTask,
  SupplyOrganization,
  SupplyOrganizationAgreement,
  SupplyPaymentTask,
} from '../detailTypes'
import type { ProtocolUser } from '../types'
import { responsibleName } from './protocolDetailHelpers'

export type MergedServiceEditFiles = {
  accountDocuments: File[]
  accountingTaskDocuments: File[]
  actDocuments: File[]
  files: File[]
  taskDocuments: File[]
}

type EditDraft = {
  accountingExchangeRate: string
  accountingGrossPrice: string
  accountingPercent: string
  accountingTaskComment: string
  accountingTaskPayToDate: string
  accountingTaskUser: ProtocolUser | null
  agreement: SupplyOrganizationAgreement | null
  consumableProduct: ConsumableProduct | null
  createAccountingTask: boolean
  createInformationTask: boolean
  createTask: boolean
  exchangeRate: string
  fromDate: string
  grossPrice: string
  invoiceNumber: string
  isIncludeAccountingValue: boolean
  name: string
  percent: string
  supplyInformationTaskComment: string
  supplyInformationTaskGrossPrice: string
  supplyInformationTaskPayToDate: string
  supplyInformationTaskUser: ProtocolUser | null
  supplyOrganization: SupplyOrganization | null
  taskComment: string
  taskPayToDate: string
  taskUser: ProtocolUser | null
}

function toDraft(service: MergedService): EditDraft {
  const supplyInformationTask = service.SupplyInformationTask
  const supplyPaymentTask = service.SupplyPaymentTask
  const accountingPaymentTask = service.AccountingPaymentTask

  return {
    accountingExchangeRate: service.AccountingExchangeRate ? String(service.AccountingExchangeRate) : '',
    accountingGrossPrice: service.AccountingGrossPrice ? String(service.AccountingGrossPrice) : '',
    accountingPercent: service.AccountingVatPercent ? String(service.AccountingVatPercent) : '',
    accountingTaskComment: accountingPaymentTask?.Comment || '',
    accountingTaskPayToDate: toLocalDateInput(accountingPaymentTask?.PayToDate),
    accountingTaskUser: accountingPaymentTask?.User || null,
    agreement: service.SupplyOrganizationAgreement || null,
    consumableProduct: service.ConsumableProduct || null,
    createAccountingTask: false,
    createInformationTask: Boolean(supplyInformationTask),
    createTask: false,
    exchangeRate: service.ExchangeRate ? String(service.ExchangeRate) : '',
    fromDate: service.FromDate ? formatLocalDate(new Date(service.FromDate)) : '',
    grossPrice: service.GrossPrice ? String(service.GrossPrice) : '',
    invoiceNumber: service.Number || '',
    isIncludeAccountingValue: Boolean(service.IsIncludeAccountingValue),
    name: service.Name || '',
    percent: service.VatPercent ? String(service.VatPercent) : '',
    supplyInformationTaskComment: supplyInformationTask?.Comment || '',
    supplyInformationTaskGrossPrice: supplyInformationTask?.GrossPrice ? String(supplyInformationTask.GrossPrice) : '',
    supplyInformationTaskPayToDate: toLocalDateInput(supplyInformationTask?.FromDate),
    supplyInformationTaskUser: supplyInformationTask?.User || null,
    supplyOrganization: service.SupplyOrganization || null,
    taskComment: supplyPaymentTask?.Comment || '',
    taskPayToDate: toLocalDateInput(supplyPaymentTask?.PayToDate),
    taskUser: supplyPaymentTask?.User || null,
  }
}

export function MergedServiceEditCard({
  opened,
  service,
  isSaving,
  onClose,
  onSave,
}: {
  isSaving: boolean
  onClose: () => void
  onSave: (service: MergedService, files: MergedServiceEditFiles) => Promise<void>
  opened: boolean
  service: MergedService
}) {
  const { t } = useI18n()
  const [draft, setDraft] = useValueState<EditDraft>(() => toDraft(service))
  const [accountDocuments, setAccountDocuments] = useValueState<File[]>([])
  const [actDocuments, setActDocuments] = useValueState<File[]>([])
  const [files, setFiles] = useValueState<File[]>([])
  const [taskDocuments, setTaskDocuments] = useValueState<File[]>([])
  const [accountingTaskDocuments, setAccountingTaskDocuments] = useValueState<File[]>([])
  const [deletedInvoiceDocuments, setDeletedInvoiceDocuments] = useValueState<Record<string, boolean>>({})
  const [deletedActDocuments, setDeletedActDocuments] = useValueState<Record<string, boolean>>({})
  const [deletedAccountDocuments, setDeletedAccountDocuments] = useValueState<Record<string, boolean>>({})
  const [deletedTaskDocuments, setDeletedTaskDocuments] = useValueState<Record<string, boolean>>({})
  const [deletedAccountingTaskDocuments, setDeletedAccountingTaskDocuments] = useValueState<Record<string, boolean>>({})
  const [organizations, setOrganizations] = useValueState<SupplyOrganization[]>([])
  const [products, setProducts] = useValueState<ConsumableProduct[]>([])
  const [users, setUsers] = useValueState<ProtocolUser[]>([])
  const [loadError, setLoadError] = useValueState<string | null>(null)
  const [validationError, setValidationError] = useValueState<string | null>(null)
  const [prevOpened, setPrevOpened] = useValueState(opened)

  if (opened !== prevOpened) {
    setPrevOpened(opened)

    if (opened) {
      setDraft(toDraft(service))
      setAccountDocuments([])
      setActDocuments([])
      setFiles([])
      setTaskDocuments([])
      setAccountingTaskDocuments([])
      setDeletedInvoiceDocuments({})
      setDeletedActDocuments({})
      setDeletedAccountDocuments({})
      setDeletedTaskDocuments({})
      setDeletedAccountingTaskDocuments({})
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

  const organizationOptions = useMemo(() => {
    const list = [...organizations]

    if (draft.supplyOrganization && !list.some((item) => item.NetUid === draft.supplyOrganization?.NetUid)) {
      list.push(draft.supplyOrganization)
    }

    return list.reduce<Array<{ label: string; value: string }>>((options, organization) => {
      if (organization.NetUid && organization.Name) {
        options.push({ label: organization.Name, value: organization.NetUid })
      }

      return options
    }, [])
  }, [draft.supplyOrganization, organizations])

  const agreementOptions = useMemo(() => {
    const agreements = draft.supplyOrganization?.SupplyOrganizationAgreements || []
    const list = [...agreements]

    if (draft.agreement && !list.some((item) => item.NetUid === draft.agreement?.NetUid)) {
      list.push(draft.agreement)
    }

    return list.reduce<Array<{ label: string; value: string }>>((options, agreement) => {
      if (agreement.NetUid) {
        options.push({
          label: `${agreement.Name || ''} (${agreement.Currency?.Code || ''})`,
          value: agreement.NetUid,
        })
      }

      return options
    }, [])
  }, [draft.agreement, draft.supplyOrganization])

  const productOptions = useMemo(() => {
    const list = [...products]

    if (draft.consumableProduct && !list.some((item) => item.NetUid === draft.consumableProduct?.NetUid)) {
      list.push(draft.consumableProduct)
    }

    return list.reduce<Array<{ label: string; value: string }>>((options, product) => {
      if (product.NetUid && product.Name) {
        options.push({ label: product.Name, value: product.NetUid })
      }

      return options
    }, [])
  }, [draft.consumableProduct, products])

  const availableUsers = useMemo(
    () => mergeUsers(users, [draft.supplyInformationTaskUser, draft.taskUser, draft.accountingTaskUser, service.User]),
    [draft.accountingTaskUser, draft.supplyInformationTaskUser, draft.taskUser, service.User, users],
  )
  const userOptions = useMemo(
    () =>
      availableUsers.reduce<Array<{ label: string; value: string }>>((options, user) => {
        if (user.NetUid) {
          options.push({ label: responsibleName(user) || user.FullName || '', value: user.NetUid })
        }

        return options
      }, []),
    [availableUsers],
  )

  function update<K extends keyof EditDraft>(key: K, value: EditDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function selectOrganization(netUid: string | null) {
    const organization = organizations.find((item) => item.NetUid === netUid) || draft.supplyOrganization
    setDraft((current) => ({ ...current, supplyOrganization: organization || null, agreement: null }))
  }

  function selectAgreement(netUid: string | null) {
    const agreement = (draft.supplyOrganization?.SupplyOrganizationAgreements || []).find(
      (item) => item.NetUid === netUid,
    )
    update('agreement', (agreement as SupplyOrganizationAgreement) || draft.agreement)
  }

  function selectProduct(netUid: string | null) {
    update('consumableProduct', products.find((item) => item.NetUid === netUid) || draft.consumableProduct)
  }

  function selectUser(
    key: 'accountingTaskUser' | 'supplyInformationTaskUser' | 'taskUser',
    netUid: string | null,
  ) {
    update(key, availableUsers.find((item) => item.NetUid === netUid) || null)
  }

  async function handleSave() {
    if (!draft.supplyOrganization || !draft.agreement || !draft.consumableProduct || !draft.invoiceNumber) {
      setValidationError(t('Заповніть обовʼязкові поля'))

      return
    }

    if (!draft.grossPrice && !draft.accountingGrossPrice) {
      setValidationError(t('Заповніть управлінські або бухгалтерські витрати'))

      return
    }

    const grossPrice = Number(draft.grossPrice) || 0
    const accountingGrossPrice = Number(draft.accountingGrossPrice) || 0

    if (draft.createInformationTask && !draft.supplyInformationTaskUser) {
      setValidationError(t('Вкажіть відповідального за оплату в межах країни'))

      return
    }

    if ((service.SupplyPaymentTask || draft.createTask) && grossPrice > 0 && !draft.taskUser) {
      setValidationError(t('Вкажіть відповідального за платіжну задачу'))

      return
    }

    if ((service.AccountingPaymentTask || draft.createAccountingTask) && accountingGrossPrice > 0 && !draft.accountingTaskUser) {
      setValidationError(t('Вкажіть відповідального за бухгалтерську платіжну задачу'))

      return
    }

    setValidationError(null)

    const updatedService: MergedService = {
      ...service,
      AccountingExchangeRate: draft.accountingExchangeRate ? Number(draft.accountingExchangeRate) : undefined,
      AccountingGrossPrice: accountingGrossPrice,
      AccountingVatPercent: Number(draft.accountingPercent) || 0,
      ConsumableProduct: draft.consumableProduct,
      ExchangeRate: draft.exchangeRate ? Number(draft.exchangeRate) : undefined,
      FromDate: draft.fromDate ? formatLocalInputDateTime(draft.fromDate) : service.FromDate,
      GrossPrice: grossPrice,
      InvoiceDocuments: markDeletedDocuments(service.InvoiceDocuments || [], deletedInvoiceDocuments),
      IsIncludeAccountingValue: draft.isIncludeAccountingValue,
      Name: draft.name,
      Number: draft.invoiceNumber,
      SupplyServiceAccountDocument: markSingleDocumentDeleted(service.SupplyServiceAccountDocument, deletedAccountDocuments),
      ActProvidingServiceDocument: markSingleDocumentDeleted(service.ActProvidingServiceDocument, deletedActDocuments),
      SupplyOrganization: draft.supplyOrganization,
      SupplyOrganizationAgreement: draft.agreement,
      VatPercent: Number(draft.percent) || 0,
    }

    if (service.SupplyPaymentTask || draft.createTask) {
      updatedService.SupplyPaymentTask = buildPaymentTask({
        baseTask: service.SupplyPaymentTask,
        comment: draft.taskComment,
        deletedDocuments: deletedTaskDocuments,
        documents: service.SupplyPaymentTask?.SupplyPaymentTaskDocuments || [],
        grossPrice,
        payToDate: draft.taskPayToDate,
        user: draft.taskUser,
      })

      if (grossPrice <= 0) {
        updatedService.SupplyPaymentTask.Deleted = true
      }
    }

    if (service.AccountingPaymentTask || draft.createAccountingTask) {
      updatedService.AccountingPaymentTask = buildPaymentTask({
        baseTask: service.AccountingPaymentTask,
        comment: draft.accountingTaskComment,
        deletedDocuments: deletedAccountingTaskDocuments,
        documents: service.AccountingPaymentTask?.SupplyPaymentTaskDocuments || [],
        grossPrice: accountingGrossPrice,
        payToDate: draft.accountingTaskPayToDate,
        user: draft.accountingTaskUser,
      })

      if (accountingGrossPrice <= 0) {
        updatedService.AccountingPaymentTask.Deleted = true
      }
    }

    if (draft.createInformationTask) {
      updatedService.SupplyInformationTask = buildInformationTask({
        baseTask: service.SupplyInformationTask,
        comment: draft.supplyInformationTaskComment,
        fromDate: draft.supplyInformationTaskPayToDate,
        grossPrice: Number(draft.supplyInformationTaskGrossPrice) || 0,
        user: draft.supplyInformationTaskUser,
      })
    } else if (service.SupplyInformationTask) {
      updatedService.SupplyInformationTask = { ...service.SupplyInformationTask, Deleted: true }
    } else {
      updatedService.SupplyInformationTask = undefined
    }

    if (updatedService.ActProvidingService) {
      if (grossPrice <= 0) {
        updatedService.ActProvidingService = { ...updatedService.ActProvidingService, Deleted: true }
      }
    } else if (grossPrice > 0) {
      updatedService.ActProvidingService = createActProvidingService()
    }

    if (updatedService.AccountingActProvidingService) {
      if (accountingGrossPrice <= 0 || !hasActiveActDocument(updatedService.ActProvidingServiceDocument, actDocuments)) {
        updatedService.AccountingActProvidingService = { ...updatedService.AccountingActProvidingService, Deleted: true }
      }
    } else if (accountingGrossPrice > 0 && hasActiveActDocument(updatedService.ActProvidingServiceDocument, actDocuments)) {
      updatedService.AccountingActProvidingService = createActProvidingService()
    }

    await onSave(updatedService, {
      accountDocuments,
      accountingTaskDocuments,
      actDocuments,
      files,
      taskDocuments,
    })
  }

  return (
    <AppDrawer opened={opened} size="lg" title={t('Редагувати')} onClose={onClose}>
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
          value={draft.supplyOrganization?.NetUid || null}
          onChange={selectOrganization}
        />
        <Select
          data={agreementOptions}
          label={t('Договір')}
          searchable
          value={draft.agreement?.NetUid || null}
          onChange={selectAgreement}
        />
        <Select
          data={productOptions}
          label={t('Тип')}
          searchable
          value={draft.consumableProduct?.NetUid || null}
          onChange={selectProduct}
        />
        <TextInput
          label={t('Номер інвойса')}
          value={draft.invoiceNumber}
          onChange={(event) => update('invoiceNumber', event.currentTarget.value)}
        />
        <TextInput
          label={t('Назва')}
          value={draft.name}
          onChange={(event) => update('name', event.currentTarget.value)}
        />

        <Group grow>
          <TextInput
            label={t('Вартість Брутто')}
            type="number"
            value={draft.grossPrice}
            onChange={(event) => update('grossPrice', event.currentTarget.value)}
          />
          <TextInput
            label={t('ПДВ %')}
            type="number"
            value={draft.percent}
            onChange={(event) => update('percent', event.currentTarget.value)}
          />
        </Group>

        <Group grow>
          <TextInput
            label={t('Вартість Брутто (Бух.)')}
            type="number"
            value={draft.accountingGrossPrice}
            onChange={(event) => update('accountingGrossPrice', event.currentTarget.value)}
          />
          <TextInput
            label={`${t('ПДВ %')} (${t('Бух.')})`}
            type="number"
            value={draft.accountingPercent}
            onChange={(event) => update('accountingPercent', event.currentTarget.value)}
          />
        </Group>

        <Group grow>
          <TextInput
            label={t('Курс валют')}
            type="number"
            value={draft.exchangeRate}
            onChange={(event) => update('exchangeRate', event.currentTarget.value)}
          />
          <TextInput
            label={t('Курс валют (Бух.)')}
            type="number"
            value={draft.accountingExchangeRate}
            onChange={(event) => update('accountingExchangeRate', event.currentTarget.value)}
          />
        </Group>

        <Checkbox
          checked={draft.isIncludeAccountingValue}
          label={t('Включати бух. вартість у ціну брутто')}
          onChange={(event) => update('isIncludeAccountingValue', event.currentTarget.checked)}
        />

        <TextInput
          label={t('Від якої дати')}
          type="date"
          value={draft.fromDate}
          onChange={(event) => update('fromDate', event.currentTarget.value)}
        />

        <Checkbox
          checked={draft.createInformationTask}
          label={t('Доставка в межах країни')}
          onChange={(event) => update('createInformationTask', event.currentTarget.checked)}
        />

        {draft.createInformationTask && (
          <Stack gap="sm">
            <NumberInput
              label={t('Вартість доставки в межах країни')}
              value={draft.supplyInformationTaskGrossPrice}
              onChange={(value) => update('supplyInformationTaskGrossPrice', String(value))}
            />
            <TextInput
              label={t('Сплатити до')}
              type="date"
              value={draft.supplyInformationTaskPayToDate}
              onChange={(event) => update('supplyInformationTaskPayToDate', event.currentTarget.value)}
            />
            <Select
              data={userOptions}
              label={t('Відповідальний за оплату в межах країни')}
              searchable
              value={draft.supplyInformationTaskUser?.NetUid || null}
              onChange={(netUid) => selectUser('supplyInformationTaskUser', netUid)}
            />
            <Textarea
              label={t('Коментар')}
              value={draft.supplyInformationTaskComment}
              onChange={(event) => update('supplyInformationTaskComment', event.currentTarget.value)}
            />
          </Stack>
        )}

        <DocumentToggleList
          deletedDocuments={deletedAccountDocuments}
          documents={service.SupplyServiceAccountDocument ? [service.SupplyServiceAccountDocument] : []}
          label={t('Рахунок')}
          onToggleDeleted={(document, index) => toggleDeletedDocument(document, index, setDeletedAccountDocuments)}
        />
        <FileInput
          clearable
          label={t('Рахунок')}
          multiple
          value={accountDocuments}
          onChange={setAccountDocuments}
        />
        <DocumentToggleList
          deletedDocuments={deletedActDocuments}
          documents={service.ActProvidingServiceDocument ? [service.ActProvidingServiceDocument] : []}
          label={t('Акт надання послуг')}
          onToggleDeleted={(document, index) => toggleDeletedDocument(document, index, setDeletedActDocuments)}
        />
        <FileInput
          clearable
          label={t('Акт надання послуг')}
          multiple
          value={actDocuments}
          onChange={setActDocuments}
        />
        <DocumentToggleList
          deletedDocuments={deletedInvoiceDocuments}
          documents={service.InvoiceDocuments || []}
          label={t('Документи інвойса')}
          onToggleDeleted={(document, index) => toggleDeletedDocument(document, index, setDeletedInvoiceDocuments)}
        />
        <FileInput clearable label={t('Інші файли')} multiple value={files} onChange={setFiles} />

        <Divider />

        {!service.SupplyPaymentTask && (
          <Checkbox
            checked={draft.createTask}
            label={t('Створити платіжну задачу')}
            onChange={(event) => update('createTask', event.currentTarget.checked)}
          />
        )}
        <TaskDocumentsEditor
          comment={draft.taskComment}
          deletedDocuments={deletedTaskDocuments}
          documents={service.SupplyPaymentTask?.SupplyPaymentTaskDocuments || []}
          files={taskDocuments}
          hasTask={Boolean(service.SupplyPaymentTask || draft.createTask)}
          label={t('Документи платіжної задачі')}
          taskDate={draft.taskPayToDate}
          taskUserValue={draft.taskUser?.NetUid || null}
          userOptions={userOptions}
          onChangeComment={(value) => update('taskComment', value)}
          onChangeFiles={setTaskDocuments}
          onChangeTaskDate={(value) => update('taskPayToDate', value)}
          onChangeTaskUser={(netUid) => selectUser('taskUser', netUid)}
          onToggleDeleted={(document, index) => toggleDeletedDocument(document, index, setDeletedTaskDocuments)}
        />

        {!service.AccountingPaymentTask && (
          <Checkbox
            checked={draft.createAccountingTask}
            label={`${t('Створити платіжну задачу')} (${t('Бух.')})`}
            onChange={(event) => update('createAccountingTask', event.currentTarget.checked)}
          />
        )}
        <TaskDocumentsEditor
          comment={draft.accountingTaskComment}
          deletedDocuments={deletedAccountingTaskDocuments}
          documents={service.AccountingPaymentTask?.SupplyPaymentTaskDocuments || []}
          files={accountingTaskDocuments}
          hasTask={Boolean(service.AccountingPaymentTask || draft.createAccountingTask)}
          label={`${t('Документи платіжної задачі')} (${t('Бух.')})`}
          taskDate={draft.accountingTaskPayToDate}
          taskUserValue={draft.accountingTaskUser?.NetUid || null}
          userOptions={userOptions}
          onChangeComment={(value) => update('accountingTaskComment', value)}
          onChangeFiles={setAccountingTaskDocuments}
          onChangeTaskDate={(value) => update('accountingTaskPayToDate', value)}
          onChangeTaskUser={(netUid) => selectUser('accountingTaskUser', netUid)}
          onToggleDeleted={(document, index) => toggleDeletedDocument(document, index, setDeletedAccountingTaskDocuments)}
        />

        <Group justify="flex-end" gap="sm">
          <Button color="gray" disabled={isSaving} variant="light" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button color="violet" loading={isSaving} onClick={handleSave}>
            {t('Зберегти')}
          </Button>
        </Group>
      </Stack>
    </AppDrawer>
  )
}

function TaskDocumentsEditor({
  comment,
  deletedDocuments,
  documents,
  files,
  hasTask,
  label,
  taskDate,
  taskUserValue,
  userOptions,
  onChangeComment,
  onChangeFiles,
  onChangeTaskDate,
  onChangeTaskUser,
  onToggleDeleted,
}: {
  comment: string
  deletedDocuments: Record<string, boolean>
  documents: SupplyDocument[]
  files: File[]
  hasTask: boolean
  label: string
  onChangeComment: (value: string) => void
  onChangeFiles: (files: File[]) => void
  onChangeTaskDate: (value: string) => void
  onChangeTaskUser: (value: string | null) => void
  onToggleDeleted: (document: SupplyDocument, index: number) => void
  taskDate: string
  taskUserValue: string | null
  userOptions: Array<{ label: string; value: string }>
}) {
  const { t } = useI18n()

  if (!hasTask) {
    return null
  }

  return (
    <Stack gap="xs">
      <Text fw={700} size="sm">
        {label}
      </Text>
      <Group grow>
        <TextInput
          label={t('Сплатити до')}
          type="date"
          value={taskDate}
          onChange={(event) => onChangeTaskDate(event.currentTarget.value)}
        />
        <Select
          data={userOptions}
          label={t('Відповідальний')}
          searchable
          value={taskUserValue}
          onChange={onChangeTaskUser}
        />
      </Group>
      <Textarea label={t('Коментар')} value={comment} onChange={(event) => onChangeComment(event.currentTarget.value)} />
      {documents.length > 0 && (
        <Stack gap={4}>
          {documents.map((document, index) => {
            const key = getDocumentKey(document, index)
            const deleted = Boolean(deletedDocuments[key])

            return (
              <Group key={key} gap="xs" justify="space-between">
                {document.DocumentUrl ? (
                  <Anchor href={document.DocumentUrl} rel="noreferrer" size="sm" target="_blank">
                    {document.FileName || document.DocumentUrl}
                  </Anchor>
                ) : (
                  <Text size="sm">{document.FileName || '-'}</Text>
                )}
                <Button color={deleted ? 'gray' : 'red'} size="xs" variant="subtle" onClick={() => onToggleDeleted(document, index)}>
                  {deleted ? t('Відновити') : t('Видалити')}
                </Button>
                {deleted && (
                  <Badge color="red" variant="light">
                    {t('Видалено')}
                  </Badge>
                )}
              </Group>
            )
          })}
        </Stack>
      )}
      <FileInput clearable label={t('Додати файли')} multiple value={files} onChange={onChangeFiles} />
    </Stack>
  )
}

function DocumentToggleList({
  deletedDocuments,
  documents,
  label,
  onToggleDeleted,
}: {
  deletedDocuments: Record<string, boolean>
  documents: SupplyDocument[]
  label: string
  onToggleDeleted: (document: SupplyDocument, index: number) => void
}) {
  const { t } = useI18n()

  if (documents.length === 0) {
    return null
  }

  return (
    <Stack gap={4}>
      <Text fw={700} size="sm">
        {label}
      </Text>
      {documents.map((document, index) => {
        const key = getDocumentKey(document, index)
        const deleted = Boolean(deletedDocuments[key])

        return (
          <Group key={key} gap="xs" justify="space-between">
            {document.DocumentUrl ? (
              <Anchor href={document.DocumentUrl} rel="noreferrer" size="sm" target="_blank">
                {document.FileName || document.DocumentUrl}
              </Anchor>
            ) : (
              <Text size="sm">{document.FileName || '-'}</Text>
            )}
            <Button color={deleted ? 'gray' : 'red'} size="xs" variant="subtle" onClick={() => onToggleDeleted(document, index)}>
              {deleted ? t('Відновити') : t('Видалити')}
            </Button>
            {deleted && (
              <Badge color="red" variant="light">
                {t('Видалено')}
              </Badge>
            )}
          </Group>
        )
      })}
    </Stack>
  )
}

function toggleDeletedDocument(
  document: SupplyDocument,
  index: number,
  setDeletedDocuments: (value: (current: Record<string, boolean>) => Record<string, boolean>) => void,
) {
  const key = getDocumentKey(document, index)

  setDeletedDocuments((current) => ({ ...current, [key]: !current[key] }))
}

function markDeletedDocuments(documents: SupplyDocument[], deletedDocuments: Record<string, boolean>): SupplyDocument[] {
  return documents.map((document, index) => ({
    ...document,
    Deleted: Boolean(deletedDocuments[getDocumentKey(document, index)]),
  }))
}

function getDocumentKey(document: SupplyDocument, index: number): string {
  return String(document.NetUid || document.Id || document.FileName || index)
}

function markSingleDocumentDeleted(document: SupplyDocument | null | undefined, deletedDocuments: Record<string, boolean>) {
  if (!document) {
    return document
  }

  return {
    ...document,
    Deleted: Boolean(deletedDocuments[getDocumentKey(document, 0)]),
  }
}

function buildPaymentTask({
  baseTask,
  comment,
  deletedDocuments,
  documents,
  grossPrice,
  payToDate,
  user,
}: {
  baseTask?: SupplyPaymentTask | null
  comment: string
  deletedDocuments: Record<string, boolean>
  documents: SupplyDocument[]
  grossPrice: number
  payToDate: string
  user: ProtocolUser | null
}): SupplyPaymentTask {
  return {
    ...(baseTask || {}),
    Comment: comment,
    GrossPrice: grossPrice,
    PayToDate: payToDate ? formatLocalInputDateTime(payToDate) : baseTask?.PayToDate,
    SupplyPaymentTaskDocuments: markDeletedDocuments(documents, deletedDocuments),
    User: user,
  }
}

function buildInformationTask({
  baseTask,
  comment,
  fromDate,
  grossPrice,
  user,
}: {
  baseTask?: SupplyInformationTask | null
  comment: string
  fromDate: string
  grossPrice: number
  user: ProtocolUser | null
}): SupplyInformationTask {
  return {
    ...(baseTask || {}),
    Comment: comment,
    FromDate: fromDate ? formatLocalInputDateTime(fromDate) : baseTask?.FromDate,
    GrossPrice: grossPrice,
    User: user,
  }
}

function createActProvidingService(): ActProvidingService {
  return {}
}

function hasActiveActDocument(document: SupplyDocument | null | undefined, newDocuments: File[]): boolean {
  return Boolean(newDocuments.length > 0 || (document && !document.Deleted))
}

function toLocalDateInput(value?: Date | string): string {
  if (!value) {
    return formatLocalDate(new Date())
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? formatLocalDate(new Date()) : formatLocalDate(date)
}

function mergeUsers(users: ProtocolUser[], extraUsers: Array<ProtocolUser | null | undefined>): ProtocolUser[] {
  const userMap = new Map<string, ProtocolUser>()

  for (const user of users) {
    if (user.NetUid) {
      userMap.set(user.NetUid, user)
    }
  }

  for (const user of extraUsers) {
    if (user?.NetUid && !userMap.has(user.NetUid)) {
      userMap.set(user.NetUid, user)
    }
  }

  return Array.from(userMap.values())
}
