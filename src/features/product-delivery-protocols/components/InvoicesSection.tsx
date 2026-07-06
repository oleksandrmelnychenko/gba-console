import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Divider,
  FileInput,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconArrowBackUp,
  IconDeviceFloppy,
  IconListDetails,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react'
import { useEffect } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
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

const MANAGE_INVOICES_PERMISSION = 'ProductDeliveryProtocols_logistic_path_card_invoices_infoBtn_PKEY'

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
  invoice,
  canEditDeliveryDocuments,
  isSaving,
  onSaveDocuments,
}: {
  canEditDeliveryDocuments: boolean
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
    if (isSaving) {
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
    if (isSaving) {
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

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="xs">
        <Group justify="flex-end" gap="sm">
          <Button
            disabled={isSaving}
            leftSection={<IconListDetails size={16} />}
            size="xs"
            variant="default"
            onClick={() => setExpensesOpened(true)}
          >
            {t('Детальні витрати')}
          </Button>
          {canEditDeliveryDocuments && (
            <Button
              color={CREATE_ACTION_COLOR}
              disabled={isSaving}
              leftSection={<IconDeviceFloppy size={16} />}
              loading={isSaving}
              size="xs"
              onClick={handleSaveDocuments}
            >
              {t('Зберегти')}
            </Button>
          )}
        </Group>
        <LabelValueRow label={t('Номер документу')} mono>{invoice.ServiceNumber || ''}</LabelValueRow>
        <LabelValueRow label={t('Номер інвойса')} mono>{invoiceNumber || ''}</LabelValueRow>
        <LabelValueRow label={t('Дата інвойса')} mono>{formatDateTime(invoice.DateFrom)}</LabelValueRow>
        <LabelValueRow label={t('Постачальник')}>{invoice.SupplyOrder?.Client?.FullName || ''}</LabelValueRow>
        <LabelValueRow label={t('Заг. вартість нетто')} mono>{formatMoney(invoiceNetPrice, currencyCode)}</LabelValueRow>
        <LabelValueRow label={t('Сума доставки')} mono>{formatMoney(invoice.DeliveryAmount, currencyCode)}</LabelValueRow>
        <LabelValueRow label={t('Сума знижки')} mono>{formatMoney(invoice.DiscountAmount, currencyCode)}</LabelValueRow>
        <LabelValueRow label={t('Кінцева вартість Нетто')} mono>{formatMoney(totalNetPrice, currencyCode)}</LabelValueRow>
        <LabelValueRow label={t('Витрати')} mono>{formatMoney(invoice.TotalSpending, 'EUR')}</LabelValueRow>
        <LabelValueRow label={`${t('Витрати')} (${t('Бух.')})`} mono>
          {formatMoney(invoice.AccountingTotalSpending, 'EUR')}
        </LabelValueRow>
        <LabelValueRow label={t('Номер митної декларації')} mono>{invoice.NumberCustomDeclaration || ''}</LabelValueRow>
        <LabelValueRow label={t('Дата митної декларації')} mono>{formatDateTime(invoice.DateCustomDeclaration)}</LabelValueRow>
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
                          {document.Deleted ? <IconArrowBackUp size={14} /> : <IconTrash size={14} />}
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Group>
                </Group>
              ))}
            </Stack>
          ) : (
            ''
          )}
        </LabelValueRow>
        {canEditDeliveryDocuments && (
          <>
            <Divider />
            <FileInput
              clearable
              leftSection={<IconUpload size={16} />}
              label={t('Додати документи доставки')}
              multiple
              disabled={isSaving}
              value={files}
              onChange={handleChangeFiles}
            />
          </>
        )}
      </Stack>
      <InvoiceExpensesDrawer
        invoiceNetUid={invoice.NetUid || ''}
        opened={expensesOpened}
        onClose={() => setExpensesOpened(false)}
      />
    </Card>
  )
}

function InvoiceExpensesDrawer({
  invoiceNetUid,
  opened,
  onClose,
}: {
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
    <AppDrawer opened={opened} size="lg" title={<span style={{ fontFamily: 'var(--font-mono)', letterSpacing: 0 }}>{`${t('Витрати')}. ${t('Інвойс')} ${invoice?.Number || ''}`}</span>} onClose={onClose}>
      <Stack gap="md">
        {error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
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

function BillOfLadingExpenseCard({ service }: { service: SupplyInvoiceBillOfLadingService }) {
  const { t } = useI18n()
  const organization = service.BillOfLadingService?.SupplyOrganization?.Name || ''
  const currencyCode = service.BillOfLadingService?.SupplyOrganizationAgreement?.Currency?.Code || ''

  return (
    <Card withBorder radius="md" padding="md">
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
        <LabelValueRow label={t('Коносамент')}>{organization}</LabelValueRow>
        <LabelValueRow label={t('Витрати')} mono>{formatMoney(service.Value, currencyCode)}</LabelValueRow>
        <LabelValueRow label={`${t('Витрати')} (${t('Бух.')})`} mono>
          {formatMoney(service.AccountingValue, currencyCode)}
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
        <LabelValueRow label={t('Витрати')} mono>{formatMoney(service.Value, currencyCode)}</LabelValueRow>
        <LabelValueRow label={`${t('Витрати')} (${t('Бух.')})`} mono>
          {formatMoney(service.AccountingValue, currencyCode)}
        </LabelValueRow>
        <LabelValueRow label={`${t('Курс')} EUR -> ${currencyCode || ''}`} mono>
          {formatMoney(service.ExchangeRateEurToAgreementCurrency, currencyCode)}
        </LabelValueRow>
        <LabelValueRow label={`${t('Курс')} EUR -> UAH`} mono>
          {formatMoney(service.ExchangeRateEurToUah, 'UAH')}
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
    <AppDrawer
      opened={opened}
      size="md"
      title={<span style={{ fontFamily: 'var(--font-mono)', letterSpacing: 0 }}>{`${t('Додати')} ${t('Інвойси').toLowerCase()}`}</span>}
      onClose={() => {
        if (!isSaving) {
          onClose()
        }
      }}
      footer={
        <Button color={CREATE_ACTION_COLOR} disabled={isLoading || isSaving} loading={isSaving} onClick={handleAssign}>
          {t('Зберегти')}
        </Button>
      }
    >
      <Stack gap="md">
        {error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
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
      </Stack>
    </AppDrawer>
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
  const invoices = protocol.SupplyInvoices || []
  const canManageInvoices = permissions.canEditAssignments && hasPermission(MANAGE_INVOICES_PERMISSION)

  async function handleAssign(selectedInvoices: SupplyInvoice[]) {
    try {
      await onAssignInvoices(selectedInvoices)
      setDrawerOpened(false)
    } catch {
      // Parent reports the API error; keep selection open for retry.
    }
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Text className="app-section-title" fw={600} size="sm">
          {t('Інвойси')}
        </Text>
        {canManageInvoices && (
          <Button
            color={CREATE_ACTION_COLOR}
            disabled={status.isAssigning}
            variant="outline"
            onClick={() => setDrawerOpened(true)}
          >
            {t('Управління інвойсами')}
          </Button>
        )}
      </Group>

      {invoices.length === 0 ? (
        <Text c="dimmed" size="sm">
          {t('Інвойсів не знайдено')}
        </Text>
      ) : (
        <Stack gap="md">
          {invoices.map((invoice) => (
            <InvoiceViewCard
              key={getInvoiceCardKey(invoice)}
              canEditDeliveryDocuments={permissions.canEditDeliveryDocuments}
              invoice={invoice}
              isSaving={status.isSavingInvoiceDocuments}
              onSaveDocuments={onSaveInvoiceDocuments}
            />
          ))}
        </Stack>
      )}

      <AssignInvoicesDrawer
        isSaving={status.isAssigning}
        opened={drawerOpened}
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
