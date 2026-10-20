import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  FileInput,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { CircleAlert, ListChecks, ListTree, Paperclip, Save, Trash2, Undo2, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useValueState } from '../../../shared/hooks/useValueState'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal, AppModalFooter } from '../../../shared/ui/AppModal'
import { ProtocolMoneyValue } from './ProtocolMoneyValue'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { TableChip } from '../../../shared/ui/TableChip'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { upgradeHttpToHttps } from '../../../shared/url/upgradeHttpToHttps'
import { useAuth } from '../../auth/useAuth'
import { getApprovedInvoices, getSupplyInvoiceWithSpendings } from '../api/protocolDetailApi'
import type {
  ProtocolDetail,
  SupplyDocument,
  SupplyInvoice,
  SupplyInvoiceBillOfLadingService,
  SupplyInvoiceMergedService,
} from '../detailTypes'
import {
  getProtocolInvoiceAssignmentKey,
  getSelectedProtocolInvoices,
  mergeProtocolInvoiceAssignmentCandidates,
} from '../protocolInvoiceAssignment'
import { InvoiceSelectList } from './InvoiceSelectList'
import { LabelValueRow } from './LabelValueRow'
import { formatDateTime, formatMoney, getInvoiceCurrencyCode, getInvoiceTotalNetPrice } from './protocolDetailHelpers'

const MANAGE_INVOICES_PERMISSION = PermissionKeys.ProductDeliveryProtocols.InvoiceManagement.Open

type InvoicesSectionPermissions = {
  canEditAssignments: boolean
  canEditDeliveryDocuments: boolean
}

type InvoicesSectionStatus = {
  isAssigning: boolean
  isSavingInvoiceDocuments: boolean
}

function getDocumentKey(document: SupplyDocument, index: number): string {
  return String(document.NetUid || document.Id || document.DocumentUrl || document.FileName || index)
}

function getInvoiceCardKey(invoice: SupplyInvoice): string {
  const documents = invoice.SupplyInvoiceDeliveryDocuments || []
  const parts = [String(invoice.NetUid || invoice.Id || ''), String(documents.length)]

  documents.forEach((document, index) => {
    parts.push(`${getDocumentKey(document, index)}:${document.Deleted ? '1' : '0'}`)
  })

  return parts.join('|')
}

function InvoiceViewCard({
  actionsTarget,
  invoice,
  canOpenExpenses,
  canEditDeliveryDocuments,
  isSaving,
  onSaveDocuments,
}: {
  actionsTarget?: HTMLDivElement | null
  canEditDeliveryDocuments: boolean
  canOpenExpenses: boolean
  invoice: SupplyInvoice
  isSaving: boolean
  onSaveDocuments: (invoice: SupplyInvoice, documents: File[]) => Promise<void>
}) {
  const { t } = useI18n()
  const currencyCode = getInvoiceCurrencyCode(invoice)
  const invoiceNetPrice = getInvoiceTotalNetPrice(invoice)
  const totalNetPrice =
    invoiceNetPrice + (invoice.DeliveryAmount || 0) - (invoice.DiscountAmount || 0)
  const invoiceNumber = [
    invoice.Number,
    ...(invoice.MergedSupplyInvoices || []).map((mergedInvoice) => mergedInvoice.Number),
  ].filter(Boolean).join(' / ')
  const [deliveryDocuments, setDeliveryDocuments] = useValueState<SupplyDocument[]>(
    invoice.SupplyInvoiceDeliveryDocuments || [],
  )
  const [files, setFiles] = useValueState<File[]>([])
  const [expensesOpened, setExpensesOpened] = useValueState(false)

  function toggleDeleted(document: SupplyDocument, index: number) {
    if (!canEditDeliveryDocuments || isSaving) {
      return
    }

    const key = getDocumentKey(document, index)

    setDeliveryDocuments((items) =>
      items.map((item, itemIndex) =>
        getDocumentKey(item, itemIndex) === key ? { ...item, Deleted: !item.Deleted } : item,
      ),
    )
  }

  async function handleSaveDocuments() {
    if (!canEditDeliveryDocuments || isSaving) {
      return
    }

    try {
      await onSaveDocuments({ ...invoice, SupplyInvoiceDeliveryDocuments: deliveryDocuments }, files)
      setFiles([])
    } catch {
      // Parent already shows the concrete API error; keep the draft open.
    }
  }

  function handleChangeFiles(nextFiles: File[] | null) {
    if (!canEditDeliveryDocuments || isSaving) {
      return
    }

    const nextFileList = nextFiles || []

    setFiles(nextFileList)

    if (nextFileList.length > 0) {
      notifications.show({
        color: 'yellow',
        message: t('Файли будуть завантажені після збереження'),
      })
    }
  }

  const actions = (
    <Group justify="flex-end" gap="sm">
      {canOpenExpenses && (
        <Button
          disabled={isSaving}
          leftSection={<ListTree size={16} />}
          variant="default"
          onClick={() => setExpensesOpened(true)}
        >
          {t('Детальні витрати')}
        </Button>
      )}
      {canEditDeliveryDocuments && (
        <Button
          color={CREATE_ACTION_COLOR}
          disabled={isSaving}
          leftSection={<Save size={16} />}
          loading={isSaving}
          onClick={handleSaveDocuments}
        >
          {t('Зберегти')}
        </Button>
      )}
    </Group>
  )

  return (
    <Card className="protocol-invoice-card" withBorder radius="md" padding={12}>
      <Stack gap={10}>
        {actionsTarget ? createPortal(actions, actionsTarget) : actions}
        <div className="protocol-detail-grid">
          <LabelValueRow label={t('Номер документу')} mono><TableChip tone="document" value={invoice.ServiceNumber || '—'} /></LabelValueRow>
          <LabelValueRow label={t('Номер інвойса')} mono><TableChip tone="document" value={invoiceNumber || '—'} /></LabelValueRow>
          <LabelValueRow label={t('Дата інвойса')} mono>{formatDateTime(invoice.DateFrom)}</LabelValueRow>
          <LabelValueRow label={t('Постачальник')}><TableChip tone="document" value={invoice.SupplyOrder?.Client?.FullName} /></LabelValueRow>
          <LabelValueRow label={t('Заг. вартість нетто')} mono><ProtocolMoneyValue value={invoiceNetPrice} currency={currencyCode} /></LabelValueRow>
          <LabelValueRow label={t('Сума доставки')} mono><ProtocolMoneyValue value={invoice.DeliveryAmount} currency={currencyCode} /></LabelValueRow>
          <LabelValueRow label={t('Сума знижки')} mono><ProtocolMoneyValue value={invoice.DiscountAmount} currency={currencyCode} /></LabelValueRow>
          <LabelValueRow label={t('Кінцева вартість Нетто')} mono><ProtocolMoneyValue value={totalNetPrice} currency={currencyCode} /></LabelValueRow>
          <LabelValueRow label={t('Витрати')} mono><ProtocolMoneyValue value={invoice.TotalSpending} currency={'EUR'} /></LabelValueRow>
          <LabelValueRow label={`${t('Витрати')} (${t('Бух.')})`} mono>
            <ProtocolMoneyValue value={invoice.AccountingTotalSpending} currency={'EUR'} />
          </LabelValueRow>
          <LabelValueRow label={t('Номер митної декларації')} mono><TableChip tone="document" value={invoice.NumberCustomDeclaration} /></LabelValueRow>
          <LabelValueRow label={t('Дата митної декларації')} mono>{formatDateTime(invoice.DateCustomDeclaration)}</LabelValueRow>
        </div>
        <LabelValueRow label={t('Документи доставки')}>
          {deliveryDocuments.length > 0 ? (
            <Stack gap={6}>
              {deliveryDocuments.map((document, index) => (
                <Group
                  key={getDocumentKey(document, index)}
                  gap="xs"
                  justify="space-between"
                  opacity={document.Deleted ? 0.55 : 1}
                  wrap="nowrap"
                >
                  {document.DocumentUrl ? (
                    <Anchor
                      href={upgradeHttpToHttps(document.DocumentUrl)}
                      rel="noreferrer"
                      target="_blank"
                      td={document.Deleted ? 'line-through' : undefined}
                    >
                      {document.FileName || document.DocumentUrl}
                    </Anchor>
                  ) : (
                    <Text size="sm" td={document.Deleted ? 'line-through' : undefined}>
                      {document.FileName || ''}
                    </Text>
                  )}
                  <Group gap={6} wrap="nowrap">
                    {document.Deleted && (
                      <Badge color="red" size="sm" variant="light">
                        {t('Видалено')}
                      </Badge>
                    )}
                    {canEditDeliveryDocuments && (
                      <Tooltip label={document.Deleted ? t('Відновити') : t('Видалити')}>
                        <ActionIcon
                          aria-label={document.Deleted ? t('Відновити файл') : t('Видалити файл')}
                          color={document.Deleted ? 'gray' : 'red'}
                          disabled={isSaving}
                          size="sm"
                          variant="light"
                          onClick={() => toggleDeleted(document, index)}
                        >
                          {document.Deleted ? <Undo2 size={14} /> : <Trash2 size={14} />}
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Group>
                </Group>
              ))}
            </Stack>
          ) : (
            <Text c="dimmed" size="xs">{t('Документи ще не додані')}</Text>
          )}
        </LabelValueRow>
        {canEditDeliveryDocuments && (
          <div className="protocol-document-upload">
            <div className="protocol-document-upload__copy">
              <Paperclip size={18} aria-hidden="true" />
              <div>
                <Text className="protocol-document-upload__title">{t('Додати документи доставки')}</Text>
                <Text className="protocol-document-upload__hint">{t('Оберіть один або кілька файлів. Вони додадуться після збереження.')}</Text>
              </div>
            </div>
            <FileInput
              clearable
              aria-label={t('Додати документи доставки')}
              placeholder={t('Обрати файли')}
              leftSection={<Upload size={16} />}
              multiple
              disabled={isSaving}
              value={files}
              onChange={handleChangeFiles}
            />
          </div>
        )}
      </Stack>
      <InvoiceExpensesDrawer
        invoiceSummary={invoice}
        invoiceNetUid={invoice.NetUid || ''}
        opened={expensesOpened && canOpenExpenses}
        onClose={() => setExpensesOpened(false)}
      />
    </Card>
  )
}

function InvoiceExpensesDrawer({
  invoiceSummary,
  invoiceNetUid,
  opened,
  onClose,
}: {
  invoiceSummary: SupplyInvoice
  invoiceNetUid: string
  onClose: () => void
  opened: boolean
}) {
  const { t } = useI18n()
  const [invoice, setInvoice] = useValueState<SupplyInvoice | null>(null)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(false)

  useEffect(() => {
    if (!opened || !invoiceNetUid) {
      return
    }

    let cancelled = false

    async function loadInvoice() {
      setLoading(true)
      setError(null)

      try {
        const result = await getSupplyInvoiceWithSpendings(invoiceNetUid)

        if (!cancelled) {
          setInvoice(result)
        }
      } catch (loadError) {
        if (!cancelled) {
          setInvoice(null)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити витрати'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadInvoice()

    return () => {
      cancelled = true
    }
  }, [invoiceNetUid, opened, setError, setInvoice, setLoading, t])

  const billOfLadingServices = invoice?.SupplyInvoiceBillOfLadingServices || []
  const mergedServices = invoice?.SupplyInvoiceMergedServices || []

  return (
    <AppDrawer
      opened={opened}
      size="lg"
      title={`${t('Витрати')}. ${t('Інвойс')} ${invoice?.Number || invoiceSummary.Number || ''}`.trim()}
      onClose={onClose}
    >
      <Stack gap="md">
        {error && (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}
        {isLoading ? (
          <Text c="dimmed" size="sm">
            {t('Завантаження')}
          </Text>
        ) : !invoice ? (
          <Text c="dimmed" size="sm">
            {t('Даних не знайдено')}
          </Text>
        ) : (
          <>
            <InvoiceExpenseSummary invoice={invoiceSummary} />
            {billOfLadingServices.map((service) => (
              <BillOfLadingExpenseCard key={service.NetUid || service.Id} service={service} />
            ))}
            {mergedServices.map((service) => (
              <MergedServiceExpenseCard key={service.NetUid || service.Id} service={service} />
            ))}
            {billOfLadingServices.length === 0 && mergedServices.length === 0 && (
              <Text c="dimmed" size="sm">
                {t('Витрат не знайдено')}
              </Text>
            )}
          </>
        )}
      </Stack>
    </AppDrawer>
  )
}

function InvoiceExpenseSummary({ invoice }: { invoice: SupplyInvoice }) {
  const { t } = useI18n()
  const currencyCode = getInvoiceCurrencyCode(invoice)

  return (
    <Card aria-label={t('Інформація про інвойс')} withBorder radius="md" padding="md">
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }} spacing="xs">
        <LabelValueRow label={t('Постачальник')}><TableChip tone="document" value={invoice.SupplyOrder?.Client?.FullName} /></LabelValueRow>
        <LabelValueRow label={t('Номер інвойса')} mono>{invoice.Number || ''}</LabelValueRow>
        <LabelValueRow label={t('Дата інвойса')} mono>{formatDateTime(invoice.DateFrom)}</LabelValueRow>
        <LabelValueRow label={t('Сума інвойса')} mono>{formatMoney(getInvoiceTotalNetPrice(invoice))}</LabelValueRow>
        <LabelValueRow label={t('Валюта інвойса')} mono><TableChip tone="source" value={currencyCode} /></LabelValueRow>
      </SimpleGrid>
    </Card>
  )
}

function BillOfLadingExpenseCard({ service }: { service: SupplyInvoiceBillOfLadingService }) {
  const { t } = useI18n()
  const organization = service.BillOfLadingService?.SupplyOrganization?.Name || ''
  const currencyCode = service.BillOfLadingService?.SupplyOrganizationAgreement?.Currency?.Code || ''

  return (
    <Card withBorder radius="md" padding="md">
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
        <LabelValueRow label={t('Коносамент')}>{organization}</LabelValueRow>
        <LabelValueRow label={t('Витрати')} mono><ProtocolMoneyValue value={service.Value} currency={currencyCode} /></LabelValueRow>
        <LabelValueRow label={`${t('Витрати')} (${t('Бух.')})`} mono>
          <ProtocolMoneyValue value={service.AccountingValue} currency={currencyCode} />
        </LabelValueRow>
      </SimpleGrid>
    </Card>
  )
}

function MergedServiceExpenseCard({ service }: { service: SupplyInvoiceMergedService }) {
  const { t } = useI18n()
  const mergedService = service.MergedService
  const currencyCode = mergedService?.SupplyOrganizationAgreement?.Currency?.Code || ''

  return (
    <Card withBorder radius="md" padding="md">
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
        <LabelValueRow label={t('Сервіс')}>{mergedService?.ConsumableProduct?.Name || ''}</LabelValueRow>
        <LabelValueRow label={t('Постачальник')}>{mergedService?.SupplyOrganization?.Name || ''}</LabelValueRow>
        <LabelValueRow label={t('Витрати')} mono><ProtocolMoneyValue value={service.Value} currency={currencyCode} /></LabelValueRow>
        <LabelValueRow label={`${t('Витрати')} (${t('Бух.')})`} mono>
          <ProtocolMoneyValue value={service.AccountingValue} currency={currencyCode} />
        </LabelValueRow>
        <LabelValueRow label={`${t('Курс')} EUR -> ${currencyCode || ''}`} mono>
          <ProtocolMoneyValue value={service.ExchangeRateEurToAgreementCurrency} currency={currencyCode} />
        </LabelValueRow>
        <LabelValueRow label={`${t('Курс')} EUR -> UAH`} mono>
          <ProtocolMoneyValue value={service.ExchangeRateEurToUah} currency={'UAH'} />
        </LabelValueRow>
      </SimpleGrid>
    </Card>
  )
}

function AssignInvoicesDrawer({
  opened,
  protocol,
  isSaving,
  onAssign,
  onClose,
}: {
  isSaving: boolean
  onAssign: (invoices: SupplyInvoice[]) => void
  onClose: () => void
  opened: boolean
  protocol: ProtocolDetail
}) {
  const { t } = useI18n()
  const [invoices, setInvoices] = useValueState<SupplyInvoice[]>([])
  const [selected, setSelected] = useValueState<Record<string, boolean>>({})
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(false)

  useEffect(() => {
    if (!opened) {
      return
    }

    let cancelled = false
    const organizationNetId = protocol.Organization?.NetUid || ''
    const protocolNetId = protocol.NetUid || ''

    const initialSelected = (protocol.SupplyInvoices || []).reduce<Record<string, boolean>>((records, invoice) => {
      const key = getProtocolInvoiceAssignmentKey(invoice)

      if (key) {
        records[key] = true
      }

      return records
    }, {})
    setSelected(initialSelected)

    async function loadInvoices() {
      setLoading(true)
      setError(null)

      try {
        const result = await getApprovedInvoices(organizationNetId, protocol.TransportationType ?? 0, protocolNetId)

        if (!cancelled) {
          setInvoices(mergeProtocolInvoiceAssignmentCandidates(result, protocol.SupplyInvoices || []))
        }
      } catch (loadError) {
        if (!cancelled) {
          setInvoices([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити інвойси'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadInvoices()

    return () => {
      cancelled = true
    }
  }, [opened, protocol, setError, setInvoices, setLoading, setSelected, t])

  function toggle(invoice: SupplyInvoice) {
    if (isSaving) {
      return
    }

    const key = getProtocolInvoiceAssignmentKey(invoice)

    if (key) {
      setSelected((records) => ({ ...records, [key]: !records[key] }))
    }
  }

  function handleAssign() {
    if (isSaving) {
      return
    }

    onAssign(getSelectedProtocolInvoices(invoices, selected))
  }

  return (
    <AppModal className="invoice-assignment-modal"
      opened={opened}
      size={800}
      title={`${t('Додати')} ${t('Інвойси').toLowerCase()}`}
      onClose={() => {
        if (!isSaving) {
          onClose()
        }
      }}

    >
      <Stack className="app-compact-form" gap={12}>
      <div className="invoice-assignment-modal__list">
        {error && (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}
        {isLoading ? (
          <Text c="dimmed" size="sm">
            {t('Завантаження')}
          </Text>
        ) : (
          <InvoiceSelectList disabled={isSaving} invoices={invoices} selected={selected} onToggle={toggle} />
        )}
      </div>
      <AppModalFooter>
        <Button variant="default" disabled={isSaving} onClick={onClose}>{t('Скасувати')}</Button>
        <Button color={CREATE_ACTION_COLOR} leftSection={<Save size={16} />} disabled={isLoading || isSaving} loading={isSaving} onClick={handleAssign}>{t('Зберегти')}</Button>
      </AppModalFooter>
      </Stack>
    </AppModal>
  )
}

export function InvoicesSection({
  protocol,
  permissions,
  status,
  onAssignInvoices,
  onSaveInvoiceDocuments,
}: {
  onAssignInvoices: (invoices: SupplyInvoice[]) => Promise<void>
  onSaveInvoiceDocuments: (invoice: SupplyInvoice, documents: File[]) => Promise<void>
  permissions: InvoicesSectionPermissions
  protocol: ProtocolDetail
  status: InvoicesSectionStatus
}) {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const [drawerOpened, setDrawerOpened] = useValueState(false)
  const [actionsTarget, setActionsTarget] = useState<HTMLDivElement | null>(null)
  const invoices = protocol.SupplyInvoices || []
  const canOpenInvoices = hasPermission(MANAGE_INVOICES_PERMISSION)
  const canManageInvoices = permissions.canEditAssignments && canOpenInvoices

  const managementAction = canManageInvoices ? (
          <Button
            color={CREATE_ACTION_COLOR}
            disabled={status.isAssigning}
            variant="default"
            leftSection={<ListChecks size={16} />}
            onClick={() => setDrawerOpened(true)}
          >
            {t('Управління інвойсами')}
          </Button>
  ) : null

  async function handleAssign(selectedInvoices: SupplyInvoice[]) {
    if (!canManageInvoices) {
      return
    }

    try {
      await onAssignInvoices(selectedInvoices)
      setDrawerOpened(false)
    } catch {
      // Parent reports the API error; keep selection open for retry.
    }
  }

  return (
    <Stack className="protocol-invoices-section" gap={10}>
      <Group justify="space-between" align="center">
        <Text className="app-section-title" fw={600} size="sm">
          {t('Інвойси')}
        </Text>
        <Group gap="sm">
          {managementAction}
          {invoices.length === 1 && <div ref={setActionsTarget} />}
        </Group>
      </Group>

      {invoices.length === 0 ? (
        <Text c="dimmed" size="sm">
          {t('Інвойсів не знайдено')}
        </Text>
      ) : (
        <Stack gap={10}>
          {invoices.map((invoice) => (
            <InvoiceViewCard
              key={getInvoiceCardKey(invoice)}
              canEditDeliveryDocuments={permissions.canEditDeliveryDocuments}
              canOpenExpenses={canOpenInvoices}
              invoice={invoice}
              actionsTarget={invoices.length === 1 ? actionsTarget : undefined}
              isSaving={status.isSavingInvoiceDocuments}
              onSaveDocuments={onSaveInvoiceDocuments}
            />
          ))}
        </Stack>
      )}

      <AssignInvoicesDrawer
        isSaving={status.isAssigning}
        opened={drawerOpened && canManageInvoices}
        protocol={protocol}
        onAssign={handleAssign}
        onClose={() => {
          if (!status.isAssigning) {
            setDrawerOpened(false)
          }
        }}
      />
    </Stack>
  )
}
