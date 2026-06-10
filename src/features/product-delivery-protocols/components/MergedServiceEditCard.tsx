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
import { upgradeHttpToHttps } from '../../../shared/url/upgradeHttpToHttps'
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
import { toMergedServiceDateTimeInput } from '../mergedServiceDateInput'
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

type DraftUpdate = <K extends keyof EditDraft>(key: K, value: EditDraft[K]) => void
type UserDraftKey = 'accountingTaskUser' | 'supplyInformationTaskUser' | 'taskUser'
type SelectOption = { label: string; value: string }
type DeletedDocumentsSetter = (value: (current: Record<string, boolean>) => Record<string, boolean>) => void

function toDraft(service: MergedService): EditDraft {
  const supplyInformationTask = service.SupplyInformationTask
  const supplyPaymentTask = service.SupplyPaymentTask
  const accountingPaymentTask = service.AccountingPaymentTask

  return {
    accountingExchangeRate: service.AccountingExchangeRate ? String(service.AccountingExchangeRate) : '',
    accountingGrossPrice: service.AccountingGrossPrice ? String(service.AccountingGrossPrice) : '',
    accountingPercent: service.AccountingVatPercent ? String(service.AccountingVatPercent) : '',
    accountingTaskComment: accountingPaymentTask?.Comment || '',
    accountingTaskPayToDate: toMergedServiceDateTimeInput(accountingPaymentTask?.PayToDate),
    accountingTaskUser: accountingPaymentTask?.User || null,
    agreement: service.SupplyOrganizationAgreement || null,
    consumableProduct: service.ConsumableProduct || null,
    createAccountingTask: false,
    createInformationTask: Boolean(supplyInformationTask),
    createTask: false,
    exchangeRate: service.ExchangeRate ? String(service.ExchangeRate) : '',
    fromDate: service.FromDate ? toMergedServiceDateTimeInput(service.FromDate) : '',
    grossPrice: service.GrossPrice ? String(service.GrossPrice) : '',
    invoiceNumber: service.Number || '',
    isIncludeAccountingValue: Boolean(service.IsIncludeAccountingValue),
    name: service.Name || '',
    percent: service.VatPercent ? String(service.VatPercent) : '',
    supplyInformationTaskComment: supplyInformationTask?.Comment || '',
    supplyInformationTaskGrossPrice: supplyInformationTask?.GrossPrice ? String(supplyInformationTask.GrossPrice) : '',
    supplyInformationTaskPayToDate: toMergedServiceDateTimeInput(supplyInformationTask?.FromDate),
    supplyInformationTaskUser: supplyInformationTask?.User || null,
    supplyOrganization: service.SupplyOrganization || null,
    taskComment: supplyPaymentTask?.Comment || '',
    taskPayToDate: toMergedServiceDateTimeInput(supplyPaymentTask?.PayToDate),
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
  const [validationError, setValidationError] = useValueState<string | null>(null)
  const [prevOpened, setPrevOpened] = useValueState(opened)
  const { loadError, organizations, products, users } = useMergedServiceLookups(opened, t)

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
    if (isSaving) {
      return
    }

    setDraft((current) => ({ ...current, [key]: value }))
  }

  function selectOrganization(netUid: string | null) {
    if (isSaving) {
      return
    }

    const organization = organizations.find((item) => item.NetUid === netUid) || draft.supplyOrganization
    setDraft((current) => ({ ...current, supplyOrganization: organization || null, agreement: null }))
  }

  function selectAgreement(netUid: string | null) {
    if (isSaving) {
      return
    }

    const agreement = (draft.supplyOrganization?.SupplyOrganizationAgreements || []).find(
      (item) => item.NetUid === netUid,
    )
    update('agreement', (agreement as SupplyOrganizationAgreement) || draft.agreement)
  }

  function selectProduct(netUid: string | null) {
    if (isSaving) {
      return
    }

    update('consumableProduct', products.find((item) => item.NetUid === netUid) || draft.consumableProduct)
  }

  function selectUser(
    key: 'accountingTaskUser' | 'supplyInformationTaskUser' | 'taskUser',
    netUid: string | null,
  ) {
    if (isSaving) {
      return
    }

    update(key, availableUsers.find((item) => item.NetUid === netUid) || null)
  }

  async function handleSave() {
    if (isSaving) {
      return
    }

    const nextValidationError = getMergedServiceValidationError(draft, service, t)

    if (nextValidationError) {
      setValidationError(nextValidationError)
      return
    }

    setValidationError(null)

    const updatedService = buildMergedServiceSavePayload({
      actDocuments,
      deletedAccountDocuments,
      deletedAccountingTaskDocuments,
      deletedActDocuments,
      deletedInvoiceDocuments,
      deletedTaskDocuments,
      draft,
      service,
    })

    await onSave(updatedService, {
      accountDocuments,
      accountingTaskDocuments,
      actDocuments,
      files,
      taskDocuments,
    })
  }

  return (
    <AppDrawer
      opened={opened}
      size="lg"
      title={t('Редагувати')}
      onClose={() => {
        if (!isSaving) {
          onClose()
        }
      }}
    >
      <Stack gap="sm">
        <MergedServiceAlerts loadError={loadError} validationError={validationError} />

        <MergedServicePrimaryFields
          agreementOptions={agreementOptions}
          draft={draft}
          isSaving={isSaving}
          organizationOptions={organizationOptions}
          productOptions={productOptions}
          userOptions={userOptions}
          selectAgreement={selectAgreement}
          selectOrganization={selectOrganization}
          selectProduct={selectProduct}
          selectUser={selectUser}
          update={update}
        />

        <MergedServiceDocumentSections
          accountDocuments={accountDocuments}
          actDocuments={actDocuments}
          deletedAccountDocuments={deletedAccountDocuments}
          deletedActDocuments={deletedActDocuments}
          deletedInvoiceDocuments={deletedInvoiceDocuments}
          disabled={isSaving}
          files={files}
          service={service}
          setAccountDocuments={setAccountDocuments}
          setActDocuments={setActDocuments}
          setDeletedAccountDocuments={setDeletedAccountDocuments}
          setDeletedActDocuments={setDeletedActDocuments}
          setDeletedInvoiceDocuments={setDeletedInvoiceDocuments}
          setFiles={setFiles}
        />

        <Divider />

        <MergedServiceTaskSections
          accountingTaskDocuments={accountingTaskDocuments}
          deletedAccountingTaskDocuments={deletedAccountingTaskDocuments}
          deletedTaskDocuments={deletedTaskDocuments}
          draft={draft}
          isSaving={isSaving}
          service={service}
          taskDocuments={taskDocuments}
          userOptions={userOptions}
          selectUser={selectUser}
          setAccountingTaskDocuments={setAccountingTaskDocuments}
          setDeletedAccountingTaskDocuments={setDeletedAccountingTaskDocuments}
          setDeletedTaskDocuments={setDeletedTaskDocuments}
          setTaskDocuments={setTaskDocuments}
          update={update}
        />

        <MergedServiceFormActions isSaving={isSaving} onCancel={onClose} onSave={handleSave} />
      </Stack>
    </AppDrawer>
  )
}

function useMergedServiceLookups(opened: boolean, t: (value: string) => string) {
  const [organizations, setOrganizations] = useValueState<SupplyOrganization[]>([])
  const [products, setProducts] = useValueState<ConsumableProduct[]>([])
  const [users, setUsers] = useValueState<ProtocolUser[]>([])
  const [loadError, setLoadError] = useValueState<string | null>(null)

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

  return { loadError, organizations, products, users }
}

function MergedServiceAlerts({
  loadError,
  validationError,
}: {
  loadError: string | null
  validationError: string | null
}) {
  return (
    <>
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
    </>
  )
}

function MergedServiceDocumentSections({
  accountDocuments,
  actDocuments,
  deletedAccountDocuments,
  deletedActDocuments,
  deletedInvoiceDocuments,
  disabled,
  files,
  service,
  setAccountDocuments,
  setActDocuments,
  setDeletedAccountDocuments,
  setDeletedActDocuments,
  setDeletedInvoiceDocuments,
  setFiles,
}: {
  accountDocuments: File[]
  actDocuments: File[]
  deletedAccountDocuments: Record<string, boolean>
  deletedActDocuments: Record<string, boolean>
  deletedInvoiceDocuments: Record<string, boolean>
  disabled?: boolean
  files: File[]
  service: MergedService
  setAccountDocuments: (files: File[]) => void
  setActDocuments: (files: File[]) => void
  setDeletedAccountDocuments: DeletedDocumentsSetter
  setDeletedActDocuments: DeletedDocumentsSetter
  setDeletedInvoiceDocuments: DeletedDocumentsSetter
  setFiles: (files: File[]) => void
}) {
  const { t } = useI18n()

  return (
    <>
      <DocumentFileSection
        deletedDocuments={deletedAccountDocuments}
        disabled={disabled}
        documents={service.SupplyServiceAccountDocument ? [service.SupplyServiceAccountDocument] : []}
        files={accountDocuments}
        label={t('Рахунок')}
        onChangeFiles={setAccountDocuments}
        onToggleDeleted={(document, index) => toggleDeletedDocument(document, index, setDeletedAccountDocuments)}
      />
      <DocumentFileSection
        deletedDocuments={deletedActDocuments}
        disabled={disabled}
        documents={service.ActProvidingServiceDocument ? [service.ActProvidingServiceDocument] : []}
        files={actDocuments}
        label={t('Акт надання послуг')}
        onChangeFiles={setActDocuments}
        onToggleDeleted={(document, index) => toggleDeletedDocument(document, index, setDeletedActDocuments)}
      />
      <DocumentFileSection
        deletedDocuments={deletedInvoiceDocuments}
        disabled={disabled}
        documents={service.InvoiceDocuments || []}
        files={files}
        label={t('Документи інвойса')}
        uploadLabel={t('Інші файли')}
        onChangeFiles={setFiles}
        onToggleDeleted={(document, index) => toggleDeletedDocument(document, index, setDeletedInvoiceDocuments)}
      />
    </>
  )
}

function MergedServiceTaskSections({
  accountingTaskDocuments,
  deletedAccountingTaskDocuments,
  deletedTaskDocuments,
  draft,
  isSaving,
  service,
  taskDocuments,
  userOptions,
  selectUser,
  setAccountingTaskDocuments,
  setDeletedAccountingTaskDocuments,
  setDeletedTaskDocuments,
  setTaskDocuments,
  update,
}: {
  accountingTaskDocuments: File[]
  deletedAccountingTaskDocuments: Record<string, boolean>
  deletedTaskDocuments: Record<string, boolean>
  draft: EditDraft
  isSaving: boolean
  service: MergedService
  selectUser: (key: UserDraftKey, netUid: string | null) => void
  setAccountingTaskDocuments: (files: File[]) => void
  setDeletedAccountingTaskDocuments: DeletedDocumentsSetter
  setDeletedTaskDocuments: DeletedDocumentsSetter
  setTaskDocuments: (files: File[]) => void
  taskDocuments: File[]
  update: DraftUpdate
  userOptions: SelectOption[]
}) {
  const { t } = useI18n()

  return (
    <>
      {!service.SupplyPaymentTask && (
        <Checkbox
          checked={draft.createTask}
          disabled={isSaving}
          label={t('Створити платіжну задачу')}
          onChange={(event) => update('createTask', event.currentTarget.checked)}
        />
      )}
      <TaskDocumentsEditor
        comment={draft.taskComment}
        disabled={isSaving}
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
          disabled={isSaving}
          label={`${t('Створити платіжну задачу')} (${t('Бух.')})`}
          onChange={(event) => update('createAccountingTask', event.currentTarget.checked)}
        />
      )}
      <TaskDocumentsEditor
        comment={draft.accountingTaskComment}
        disabled={isSaving}
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
    </>
  )
}

function getMergedServiceValidationError(
  draft: EditDraft,
  service: MergedService,
  t: (value: string) => string,
): string | null {
  if (!draft.supplyOrganization || !draft.agreement || !draft.consumableProduct || !draft.invoiceNumber) {
    return t('Заповніть обовʼязкові поля')
  }

  if (!draft.grossPrice && !draft.accountingGrossPrice) {
    return t('Заповніть управлінські або бухгалтерські витрати')
  }

  const grossPrice = Number(draft.grossPrice) || 0
  const accountingGrossPrice = Number(draft.accountingGrossPrice) || 0

  if (draft.createInformationTask && !draft.supplyInformationTaskUser) {
    return t('Вкажіть відповідального за оплату в межах країни')
  }

  if ((service.SupplyPaymentTask || draft.createTask) && grossPrice > 0 && !draft.taskUser) {
    return t('Вкажіть відповідального за платіжну задачу')
  }

  if ((service.AccountingPaymentTask || draft.createAccountingTask) && accountingGrossPrice > 0 && !draft.accountingTaskUser) {
    return t('Вкажіть відповідального за бухгалтерську платіжну задачу')
  }

  if (!areDateInputsValid([
    draft.fromDate,
    draft.supplyInformationTaskPayToDate,
    draft.taskPayToDate,
    draft.accountingTaskPayToDate,
  ])) {
    return t('Вкажіть коректну дату')
  }

  return null
}

function buildMergedServiceSavePayload({
  actDocuments,
  deletedAccountDocuments,
  deletedAccountingTaskDocuments,
  deletedActDocuments,
  deletedInvoiceDocuments,
  deletedTaskDocuments,
  draft,
  service,
}: {
  actDocuments: File[]
  deletedAccountDocuments: Record<string, boolean>
  deletedAccountingTaskDocuments: Record<string, boolean>
  deletedActDocuments: Record<string, boolean>
  deletedInvoiceDocuments: Record<string, boolean>
  deletedTaskDocuments: Record<string, boolean>
  draft: EditDraft
  service: MergedService
}): MergedService {
  const grossPrice = Number(draft.grossPrice) || 0
  const accountingGrossPrice = Number(draft.accountingGrossPrice) || 0
  const updatedService: MergedService = {
    ...service,
    AccountingExchangeRate: draft.accountingExchangeRate ? Number(draft.accountingExchangeRate) : undefined,
    AccountingGrossPrice: accountingGrossPrice,
    AccountingVatPercent: Number(draft.accountingPercent) || 0,
    ActProvidingServiceDocument: markSingleDocumentDeleted(service.ActProvidingServiceDocument, deletedActDocuments),
    ConsumableProduct: draft.consumableProduct,
    ExchangeRate: draft.exchangeRate ? Number(draft.exchangeRate) : undefined,
    FromDate: draft.fromDate ? formatLocalInputDateTime(draft.fromDate) : service.FromDate,
    GrossPrice: grossPrice,
    InvoiceDocuments: markDeletedDocuments(service.InvoiceDocuments || [], deletedInvoiceDocuments),
    IsIncludeAccountingValue: draft.isIncludeAccountingValue,
    Name: draft.name,
    Number: draft.invoiceNumber,
    SupplyOrganization: draft.supplyOrganization,
    SupplyOrganizationAgreement: draft.agreement,
    SupplyServiceAccountDocument: markSingleDocumentDeleted(service.SupplyServiceAccountDocument, deletedAccountDocuments),
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

  return updatedService
}

function MergedServicePrimaryFields({
  agreementOptions,
  draft,
  isSaving,
  organizationOptions,
  productOptions,
  userOptions,
  selectAgreement,
  selectOrganization,
  selectProduct,
  selectUser,
  update,
}: {
  agreementOptions: SelectOption[]
  draft: EditDraft
  isSaving: boolean
  organizationOptions: SelectOption[]
  productOptions: SelectOption[]
  selectAgreement: (netUid: string | null) => void
  selectOrganization: (netUid: string | null) => void
  selectProduct: (netUid: string | null) => void
  selectUser: (key: UserDraftKey, netUid: string | null) => void
  update: DraftUpdate
  userOptions: SelectOption[]
}) {
  const { t } = useI18n()

  return (
    <>
      <Select
        data={organizationOptions}
        disabled={isSaving}
        label={t('Постачальник послуг')}
        searchable
        value={draft.supplyOrganization?.NetUid || null}
        onChange={selectOrganization}
      />
      <Select
        data={agreementOptions}
        disabled={isSaving}
        label={t('Договір')}
        searchable
        value={draft.agreement?.NetUid || null}
        onChange={selectAgreement}
      />
      <Select
        data={productOptions}
        disabled={isSaving}
        label={t('Тип')}
        searchable
        value={draft.consumableProduct?.NetUid || null}
        onChange={selectProduct}
      />
      <TextInput
        disabled={isSaving}
        label={t('Номер інвойса')}
        value={draft.invoiceNumber}
        onChange={(event) => update('invoiceNumber', event.currentTarget.value)}
      />
      <TextInput
        disabled={isSaving}
        label={t('Назва')}
        value={draft.name}
        onChange={(event) => update('name', event.currentTarget.value)}
      />

      <Group grow>
        <TextInput
          disabled={isSaving}
          label={t('Вартість Брутто')}
          type="number"
          value={draft.grossPrice}
          onChange={(event) => update('grossPrice', event.currentTarget.value)}
        />
        <TextInput
          disabled={isSaving}
          label={t('ПДВ %')}
          type="number"
          value={draft.percent}
          onChange={(event) => update('percent', event.currentTarget.value)}
        />
      </Group>

      <Group grow>
        <TextInput
          disabled={isSaving}
          label={t('Вартість Брутто (Бух.)')}
          type="number"
          value={draft.accountingGrossPrice}
          onChange={(event) => update('accountingGrossPrice', event.currentTarget.value)}
        />
        <TextInput
          disabled={isSaving}
          label={`${t('ПДВ %')} (${t('Бух.')})`}
          type="number"
          value={draft.accountingPercent}
          onChange={(event) => update('accountingPercent', event.currentTarget.value)}
        />
      </Group>

      <Group grow>
        <TextInput
          disabled={isSaving}
          label={t('Курс валют')}
          type="number"
          value={draft.exchangeRate}
          onChange={(event) => update('exchangeRate', event.currentTarget.value)}
        />
        <TextInput
          disabled={isSaving}
          label={t('Курс валют (Бух.)')}
          type="number"
          value={draft.accountingExchangeRate}
          onChange={(event) => update('accountingExchangeRate', event.currentTarget.value)}
        />
      </Group>

      <Checkbox
        checked={draft.isIncludeAccountingValue}
        disabled={isSaving}
        label={t('Включати бух. вартість у ціну брутто')}
        onChange={(event) => update('isIncludeAccountingValue', event.currentTarget.checked)}
      />

      <TextInput
        disabled={isSaving}
        label={t('Від якої дати')}
        type="datetime-local"
        value={draft.fromDate}
        onChange={(event) => update('fromDate', event.currentTarget.value)}
      />

      <Checkbox
        checked={draft.createInformationTask}
        disabled={isSaving}
        label={t('Доставка в межах країни')}
        onChange={(event) => update('createInformationTask', event.currentTarget.checked)}
      />

      {draft.createInformationTask && (
        <Stack gap="sm">
          <NumberInput
            disabled={isSaving}
            label={t('Вартість доставки в межах країни')}
            value={draft.supplyInformationTaskGrossPrice}
            onChange={(value) => update('supplyInformationTaskGrossPrice', String(value))}
          />
          <TextInput
            disabled={isSaving}
            label={t('Сплатити до')}
            type="datetime-local"
            value={draft.supplyInformationTaskPayToDate}
            onChange={(event) => update('supplyInformationTaskPayToDate', event.currentTarget.value)}
          />
          <Select
            data={userOptions}
            disabled={isSaving}
            label={t('Відповідальний за оплату в межах країни')}
            searchable
            value={draft.supplyInformationTaskUser?.NetUid || null}
            onChange={(netUid) => selectUser('supplyInformationTaskUser', netUid)}
          />
          <Textarea
            disabled={isSaving}
            label={t('Коментар')}
            value={draft.supplyInformationTaskComment}
            onChange={(event) => update('supplyInformationTaskComment', event.currentTarget.value)}
          />
        </Stack>
      )}
    </>
  )
}

function MergedServiceFormActions({
  isSaving,
  onCancel,
  onSave,
}: {
  isSaving: boolean
  onCancel: () => void
  onSave: () => void
}) {
  const { t } = useI18n()

  return (
    <Group justify="flex-end" gap="sm">
      <Button color="gray" disabled={isSaving} variant="light" onClick={onCancel}>
        {t('Скасувати')}
      </Button>
      <Button color="violet" disabled={isSaving} loading={isSaving} onClick={onSave}>
        {t('Зберегти')}
      </Button>
    </Group>
  )
}

function DocumentFileSection({
  deletedDocuments,
  disabled,
  documents,
  files,
  label,
  uploadLabel = label,
  onChangeFiles,
  onToggleDeleted,
}: {
  deletedDocuments: Record<string, boolean>
  disabled?: boolean
  documents: SupplyDocument[]
  files: File[]
  label: string
  onChangeFiles: (files: File[]) => void
  onToggleDeleted: (document: SupplyDocument, index: number) => void
  uploadLabel?: string
}) {
  return (
    <>
      <DocumentToggleList
        disabled={disabled}
        deletedDocuments={deletedDocuments}
        documents={documents}
        label={label}
        onToggleDeleted={onToggleDeleted}
      />
      <FileInput clearable disabled={disabled} label={uploadLabel} multiple value={files} onChange={onChangeFiles} />
    </>
  )
}

function TaskDocumentsEditor({
  comment,
  disabled,
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
  disabled?: boolean
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
          disabled={disabled}
          label={t('Сплатити до')}
          type="datetime-local"
          value={taskDate}
          onChange={(event) => onChangeTaskDate(event.currentTarget.value)}
        />
        <Select
          data={userOptions}
          disabled={disabled}
          label={t('Відповідальний')}
          searchable
          value={taskUserValue}
          onChange={onChangeTaskUser}
        />
      </Group>
      <Textarea
        disabled={disabled}
        label={t('Коментар')}
        value={comment}
        onChange={(event) => onChangeComment(event.currentTarget.value)}
      />
      {documents.length > 0 && (
        <Stack gap={4}>
          {documents.map((document, index) => {
            const key = getDocumentKey(document, index)
            const deleted = isDocumentDeleted(document, index, deletedDocuments)

            return (
              <Group key={key} gap="xs" justify="space-between">
                {document.DocumentUrl ? (
                  <Anchor href={upgradeHttpToHttps(document.DocumentUrl)} rel="noreferrer" size="sm" target="_blank">
                    {document.FileName || document.DocumentUrl}
                  </Anchor>
                ) : (
                  <Text size="sm">{document.FileName || '-'}</Text>
                )}
                <Button
                  color={deleted ? 'gray' : 'red'}
                  disabled={disabled}
                  size="xs"
                  variant="subtle"
                  onClick={() => onToggleDeleted(document, index)}
                >
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
      <FileInput clearable disabled={disabled} label={t('Додати файли')} multiple value={files} onChange={onChangeFiles} />
    </Stack>
  )
}

function DocumentToggleList({
  disabled = false,
  deletedDocuments,
  documents,
  label,
  onToggleDeleted,
}: {
  disabled?: boolean
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
        const deleted = isDocumentDeleted(document, index, deletedDocuments)

        return (
          <Group key={key} gap="xs" justify="space-between">
            {document.DocumentUrl ? (
              <Anchor href={upgradeHttpToHttps(document.DocumentUrl)} rel="noreferrer" size="sm" target="_blank">
                {document.FileName || document.DocumentUrl}
              </Anchor>
            ) : (
              <Text size="sm">{document.FileName || '-'}</Text>
            )}
            <Button
              color={deleted ? 'gray' : 'red'}
              disabled={disabled}
              size="xs"
              variant="subtle"
              onClick={() => onToggleDeleted(document, index)}
            >
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

  setDeletedDocuments((current) => ({
    ...current,
    [key]: !(key in current ? current[key] : Boolean(document.Deleted)),
  }))
}

function markDeletedDocuments(documents: SupplyDocument[], deletedDocuments: Record<string, boolean>): SupplyDocument[] {
  return documents.map((document, index) => ({
    ...document,
    Deleted: isDocumentDeleted(document, index, deletedDocuments),
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
    Deleted: isDocumentDeleted(document, 0, deletedDocuments),
  }
}

function isDocumentDeleted(
  document: SupplyDocument,
  index: number,
  deletedDocuments: Record<string, boolean>,
): boolean {
  const key = getDocumentKey(document, index)

  return key in deletedDocuments ? deletedDocuments[key] : Boolean(document.Deleted)
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

function areDateInputsValid(values: string[]): boolean {
  return values.every((value) => !value || isValidDateInputValue(value))
}

function isValidDateInputValue(value: string): boolean {
  const datePart = value.split('T')[0]

  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return false
  }

  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`)

  return !Number.isNaN(date.getTime()) && formatLocalDate(date) === datePart
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
