import { Alert, Anchor, Badge, Button, Checkbox, FileInput, Group, Select, Stack, Text, TextInput } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useEffect, useMemo } from 'react'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { getSupplyOrganizations, getSupplyServiceConsumableProducts } from '../api/protocolDetailApi'
import type {
  ConsumableProduct,
  MergedService,
  SupplyDocument,
  SupplyOrganization,
  SupplyOrganizationAgreement,
} from '../detailTypes'
import { formatDate, responsibleName } from './protocolDetailHelpers'

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
  agreement: SupplyOrganizationAgreement | null
  consumableProduct: ConsumableProduct | null
  exchangeRate: string
  fromDate: string
  grossPrice: string
  invoiceNumber: string
  isIncludeAccountingValue: boolean
  name: string
  percent: string
  supplyOrganization: SupplyOrganization | null
}

function toDraft(service: MergedService): EditDraft {
  return {
    accountingExchangeRate: service.AccountingExchangeRate ? String(service.AccountingExchangeRate) : '',
    accountingGrossPrice: service.AccountingGrossPrice ? String(service.AccountingGrossPrice) : '',
    accountingPercent: service.AccountingVatPercent ? String(service.AccountingVatPercent) : '',
    agreement: service.SupplyOrganizationAgreement || null,
    consumableProduct: service.ConsumableProduct || null,
    exchangeRate: service.ExchangeRate ? String(service.ExchangeRate) : '',
    fromDate: service.FromDate ? formatLocalDate(new Date(service.FromDate)) : '',
    grossPrice: service.GrossPrice ? String(service.GrossPrice) : '',
    invoiceNumber: service.Number || '',
    isIncludeAccountingValue: Boolean(service.IsIncludeAccountingValue),
    name: service.Name || '',
    percent: service.VatPercent ? String(service.VatPercent) : '',
    supplyOrganization: service.SupplyOrganization || null,
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
  const [deletedTaskDocuments, setDeletedTaskDocuments] = useValueState<Record<string, boolean>>({})
  const [deletedAccountingTaskDocuments, setDeletedAccountingTaskDocuments] = useValueState<Record<string, boolean>>({})
  const [organizations, setOrganizations] = useValueState<SupplyOrganization[]>([])
  const [products, setProducts] = useValueState<ConsumableProduct[]>([])
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
        const [nextOrganizations, nextProducts] = await Promise.all([
          getSupplyOrganizations(),
          getSupplyServiceConsumableProducts(''),
        ])

        if (!cancelled) {
          setOrganizations(nextOrganizations)
          setProducts(nextProducts)
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
  }, [opened, setLoadError, setOrganizations, setProducts, t])

  const organizationOptions = useMemo(() => {
    const list = [...organizations]

    if (draft.supplyOrganization && !list.some((item) => item.NetUid === draft.supplyOrganization?.NetUid)) {
      list.push(draft.supplyOrganization)
    }

    return list
      .filter((organization) => organization.NetUid && organization.Name)
      .map((organization) => ({ label: organization.Name || '', value: organization.NetUid || '' }))
  }, [draft.supplyOrganization, organizations])

  const agreementOptions = useMemo(() => {
    const agreements = draft.supplyOrganization?.SupplyOrganizationAgreements || []
    const list = [...agreements]

    if (draft.agreement && !list.some((item) => item.NetUid === draft.agreement?.NetUid)) {
      list.push(draft.agreement)
    }

    return list
      .filter((agreement) => agreement.NetUid)
      .map((agreement) => ({
        label: `${agreement.Name || ''} (${agreement.Currency?.Code || ''})`,
        value: agreement.NetUid || '',
      }))
  }, [draft.agreement, draft.supplyOrganization])

  const productOptions = useMemo(() => {
    const list = [...products]

    if (draft.consumableProduct && !list.some((item) => item.NetUid === draft.consumableProduct?.NetUid)) {
      list.push(draft.consumableProduct)
    }

    return list
      .filter((product) => product.NetUid && product.Name)
      .map((product) => ({ label: product.Name || '', value: product.NetUid || '' }))
  }, [draft.consumableProduct, products])

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

  async function handleSave() {
    if (!draft.grossPrice && !draft.accountingGrossPrice) {
      setValidationError(t('Заповніть управлінські або бухгалтерські витрати'))

      return
    }

    setValidationError(null)

    const updatedService: MergedService = {
      ...service,
      AccountingExchangeRate: draft.accountingExchangeRate ? Number(draft.accountingExchangeRate) : undefined,
      AccountingGrossPrice: Number(draft.accountingGrossPrice) || 0,
      AccountingVatPercent: Number(draft.accountingPercent) || 0,
      ConsumableProduct: draft.consumableProduct,
      ExchangeRate: draft.exchangeRate ? Number(draft.exchangeRate) : undefined,
      FromDate: draft.fromDate ? new Date(draft.fromDate).toISOString() : service.FromDate,
      GrossPrice: Number(draft.grossPrice) || 0,
      IsIncludeAccountingValue: draft.isIncludeAccountingValue,
      Name: draft.name,
      Number: draft.invoiceNumber,
      SupplyOrganization: draft.supplyOrganization,
      SupplyOrganizationAgreement: draft.agreement,
      VatPercent: Number(draft.percent) || 0,
    }

    if (updatedService.SupplyPaymentTask) {
      updatedService.SupplyPaymentTask = {
        ...updatedService.SupplyPaymentTask,
        SupplyPaymentTaskDocuments: markDeletedDocuments(
          updatedService.SupplyPaymentTask.SupplyPaymentTaskDocuments || [],
          deletedTaskDocuments,
        ),
      }
    }

    if (updatedService.AccountingPaymentTask) {
      updatedService.AccountingPaymentTask = {
        ...updatedService.AccountingPaymentTask,
        SupplyPaymentTaskDocuments: markDeletedDocuments(
          updatedService.AccountingPaymentTask.SupplyPaymentTaskDocuments || [],
          deletedAccountingTaskDocuments,
        ),
      }
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

        <FileInput
          clearable
          label={t('Рахунок')}
          multiple
          value={accountDocuments}
          onChange={setAccountDocuments}
        />
        <FileInput
          clearable
          label={t('Акт надання послуг')}
          multiple
          value={actDocuments}
          onChange={setActDocuments}
        />
        <FileInput clearable label={t('Інші файли')} multiple value={files} onChange={setFiles} />

        <TaskDocumentsEditor
          deletedDocuments={deletedTaskDocuments}
          documents={service.SupplyPaymentTask?.SupplyPaymentTaskDocuments || []}
          files={taskDocuments}
          hasTask={Boolean(service.SupplyPaymentTask)}
          label={t('Документи платіжної задачі')}
          taskComment={service.SupplyPaymentTask?.Comment}
          taskDate={service.SupplyPaymentTask?.PayToDate}
          taskUser={responsibleName(service.SupplyPaymentTask?.User)}
          onChangeFiles={setTaskDocuments}
          onToggleDeleted={(document) => toggleDeletedDocument(document, setDeletedTaskDocuments)}
        />

        <TaskDocumentsEditor
          deletedDocuments={deletedAccountingTaskDocuments}
          documents={service.AccountingPaymentTask?.SupplyPaymentTaskDocuments || []}
          files={accountingTaskDocuments}
          hasTask={Boolean(service.AccountingPaymentTask)}
          label={`${t('Документи платіжної задачі')} (${t('Бух.')})`}
          taskComment={service.AccountingPaymentTask?.Comment}
          taskDate={service.AccountingPaymentTask?.PayToDate}
          taskUser={responsibleName(service.AccountingPaymentTask?.User)}
          onChangeFiles={setAccountingTaskDocuments}
          onToggleDeleted={(document) => toggleDeletedDocument(document, setDeletedAccountingTaskDocuments)}
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
  deletedDocuments,
  documents,
  files,
  hasTask,
  label,
  taskComment,
  taskDate,
  taskUser,
  onChangeFiles,
  onToggleDeleted,
}: {
  deletedDocuments: Record<string, boolean>
  documents: SupplyDocument[]
  files: File[]
  hasTask: boolean
  label: string
  onChangeFiles: (files: File[]) => void
  onToggleDeleted: (document: SupplyDocument) => void
  taskComment?: string
  taskDate?: Date | string
  taskUser?: string
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
      <Group gap="xs">
        <Text c="dimmed" size="sm">
          {t('Відповідальний')}: {taskUser || '-'}
        </Text>
        <Text c="dimmed" size="sm">
          {t('Сплатити до')}: {formatDate(taskDate)}
        </Text>
      </Group>
      {taskComment && (
        <Text c="dimmed" size="sm">
          {taskComment}
        </Text>
      )}
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
                <Button color={deleted ? 'gray' : 'red'} size="xs" variant="subtle" onClick={() => onToggleDeleted(document)}>
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

function toggleDeletedDocument(
  document: SupplyDocument,
  setDeletedDocuments: (value: (current: Record<string, boolean>) => Record<string, boolean>) => void,
) {
  const key = getDocumentKey(document, 0)

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
