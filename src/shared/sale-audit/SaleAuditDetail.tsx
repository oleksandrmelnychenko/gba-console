import { ActionIcon, Alert, Anchor, Box, Card, Divider, Group, Loader, Stack, Text, ThemeIcon, Tooltip } from '@mantine/core'
import {
  IconAlertCircle,
  IconArrowsExchange,
  IconFileInvoice,
  IconFileTypePdf,
  IconFileTypeXls,
  IconReportAnalytics,
} from '@tabler/icons-react'
import { useRef } from 'react'
import { useValueState } from '../hooks/useValueState'
import { useI18n } from '../i18n/useI18n'
import { AppModal } from '../ui/AppModal'
import { getShiftedSaleDocument, getShiftedSaleHistoryDocument } from './saleAuditApi'
import {
  SaleAuditShiftStatusType,
  type SaleAuditLifeCycleLineItem,
  type SaleAuditOrderItem,
  type SaleAuditPrintDocument,
  type SaleAuditShiftStatus,
  type SaleAuditStatistic,
} from './saleAuditTypes'

type AuditPrintKind = 'act' | 'invoice'

type SaleAuditDetailProps = {
  error: string | null
  isLoading: boolean
  statistic: SaleAuditStatistic | null
}

export function SaleAuditDetail({ error, isLoading, statistic }: SaleAuditDetailProps) {
  const { t } = useI18n()
  const sale = statistic?.Sale
  const printRequestRef = useRef(0)
  const [downloadOpened, setDownloadOpened] = useValueState(false)
  const [printKind, setPrintKind] = useValueState<AuditPrintKind | null>(null)
  const [printDocument, setPrintDocument] = useValueState<SaleAuditPrintDocument | null>(null)
  const [isPrinting, setPrinting] = useValueState(false)
  const [printError, setPrintError] = useValueState<string | null>(null)

  function resolveHistoryNetId(orderItem: SaleAuditOrderItem): string | null {
    const historyInvoiceEditId = (orderItem.ShiftStatuses || [])[0]?.HistoryInvoiceEditId

    if (historyInvoiceEditId === undefined) {
      return null
    }

    const historyItem = (sale?.HistoryInvoiceEdit || []).find((item) => item.Id === historyInvoiceEditId)

    return historyItem?.NetUid || null
  }

  function printDocumentFor(kind: AuditPrintKind, orderItem: SaleAuditOrderItem) {
    const netId = sale?.NetUid
    const historyNetId = resolveHistoryNetId(orderItem)

    if (!netId || !historyNetId) {
      return
    }

    setPrintKind(kind)
    setPrintDocument(null)
    setPrintError(null)
    setPrinting(true)
    setDownloadOpened(true)

    const requestId = printRequestRef.current + 1
    printRequestRef.current = requestId

    void (async () => {
      try {
        const document =
          kind === 'invoice'
            ? await getShiftedSaleDocument(netId, historyNetId)
            : await getShiftedSaleHistoryDocument(netId, historyNetId)

        if (printRequestRef.current !== requestId) {
          return
        }

        setPrintDocument(document)
      } catch (documentError) {
        if (printRequestRef.current !== requestId) {
          return
        }

        setPrintError(documentError instanceof Error ? documentError.message : t('Документ недоступний для завантаження'))
      } finally {
        if (printRequestRef.current === requestId) {
          setPrinting(false)
        }
      }
    })()
  }

  function closeDownload() {
    printRequestRef.current += 1
    setDownloadOpened(false)
    setPrintKind(null)
    setPrintDocument(null)
    setPrintError(null)
    setPrinting(false)
  }

  return (
    <Stack gap="md">
      {error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {error}
        </Alert>
      )}

      {isLoading && (
        <Group gap="xs">
          <Loader color="violet" size="sm" />
          <Text c="dimmed" size="sm">
            {t('Завантаження')}
          </Text>
        </Group>
      )}

      <Card withBorder padding="md" radius="md">
        <Group justify="space-between" align="center">
          <Text fw={600}>{t('Логістика')}</Text>
          <Group gap="sm">
            {(statistic?.SaleExchangeRates || []).map((rate, index) => (
              <Group key={rate.NetUid || rate.Id || index} gap={4}>
                <Text c="dimmed" size="xs">
                  {displayValue(rate.ExchangeRate?.Code)}
                </Text>
                <Text fw={600} size="xs">
                  {rate.ExchangeRate?.Amount ?? ''}
                </Text>
              </Group>
            ))}
          </Group>
        </Group>

        <Divider my="sm" />

        <Stack gap="xs">
          {(statistic?.LifeCycleLine || []).map((line, index) => (
            <LifeCycleRow key={index} line={line} />
          ))}
        </Stack>
      </Card>

      <Card withBorder padding="md" radius="md">
        <Text fw={600}>{t('Переміщено')}</Text>
        <Divider my="sm" />
        <Stack gap="sm">
          {(sale?.Order?.OrderItems || []).map((orderItem, index) => (
            <AuditOrderItem
              key={orderItem.NetUid || orderItem.Id || index}
              canPrint={Boolean(resolveHistoryNetId(orderItem))}
              orderItem={orderItem}
              onPrintAct={() => printDocumentFor('act', orderItem)}
              onPrintInvoice={() => printDocumentFor('invoice', orderItem)}
            />
          ))}
        </Stack>
      </Card>

      <AppModal
        centered
        opened={downloadOpened}
        title={printKind === 'act' ? t('Акт редагування') : t('Видаткова накладна')}
        onClose={closeDownload}
      >
        <Stack gap="sm">
          {isPrinting ? (
            <Group justify="center" py="md">
              <Loader color="violet" size="sm" />
            </Group>
          ) : printError ? (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {printError}
            </Alert>
          ) : printDocument?.DocumentURL || printDocument?.PdfDocumentURL ? (
            <>
              {printDocument.DocumentURL && (
                <Anchor className="document-link" href={printDocument.DocumentURL} rel="noreferrer" target="_blank">
                  <span className="document-link-badge document-link-badge-excel">
                    <IconFileTypeXls size={22} stroke={1.8} />
                  </span>
                  <span>{t('Excel документ')}</span>
                </Anchor>
              )}
              {printDocument.PdfDocumentURL && (
                <Anchor className="document-link" href={printDocument.PdfDocumentURL} rel="noreferrer" target="_blank">
                  <span className="document-link-badge document-link-badge-pdf">
                    <IconFileTypePdf size={22} stroke={1.8} />
                  </span>
                  <span>{t('PDF документ')}</span>
                </Anchor>
              )}
            </>
          ) : (
            <Text c="dimmed" size="sm">
              {t('Документ недоступний для завантаження')}
            </Text>
          )}
        </Stack>
      </AppModal>
    </Stack>
  )
}

function LifeCycleRow({ line }: { line: SaleAuditLifeCycleLineItem }) {
  const { t } = useI18n()

  return (
    <Group justify="space-between" align="center">
      <Group gap="xs">
        <ThemeIcon color={line.IsActive ? 'violet' : 'gray'} radius="xl" size="sm" variant="light">
          <IconArrowsExchange size={12} />
        </ThemeIcon>
        <Text fw={line.IsActive ? 600 : 400} size="sm">
          {getLifeCycleLineLabel(line.Value, t)}
        </Text>
      </Group>
      {line.IsActive && line.Updated && (
        <Text c="dimmed" size="xs">
          {formatDateTime(line.Updated)}
        </Text>
      )}
    </Group>
  )
}

function AuditOrderItem({
  canPrint,
  orderItem,
  onPrintAct,
  onPrintInvoice,
}: {
  canPrint: boolean
  orderItem: SaleAuditOrderItem
  onPrintAct: () => void
  onPrintInvoice: () => void
}) {
  const { t } = useI18n()
  const product = orderItem.Product

  return (
    <Box>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Box miw={0}>
          <Text fw={600} size="sm">
            {displayValue(product?.Name)}
          </Text>
          <Group gap="xs">
            <Text c="dimmed" size="xs">
              {displayValue(product?.VendorCode)}
            </Text>
            <Text c="dimmed" size="xs">
              {displayValue(product?.MainOriginalNumber)}
            </Text>
          </Group>
        </Box>
        {canPrint && (
          <Group gap={4} wrap="nowrap">
            <Tooltip label={t('Видаткова накладна')} position="top">
              <ActionIcon aria-label={t('Видаткова накладна')} color="gray" variant="subtle" onClick={onPrintInvoice}>
                <IconFileInvoice size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Акт редагування')} position="top">
              <ActionIcon aria-label={t('Акт редагування')} color="gray" variant="subtle" onClick={onPrintAct}>
                <IconReportAnalytics size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        )}
      </Group>
      <Stack gap={4} mt={4}>
        {(orderItem.ShiftStatuses || []).map((status, index) => (
          <ShiftStatusRow key={status.NetUid || status.Id || index} status={status} />
        ))}
      </Stack>
    </Box>
  )
}

function ShiftStatusRow({ status }: { status: SaleAuditShiftStatus }) {
  const { t } = useI18n()
  const target =
    status.ShiftStatus === SaleAuditShiftStatusType.Store
      ? t('На склад')
      : status.ShiftStatus === SaleAuditShiftStatusType.Bill
        ? t('В рахунок')
        : ''
  const fullName = [status.User?.FirstName, status.User?.LastName].filter(Boolean).join(' ')

  return (
    <Group justify="space-between" align="center">
      <Group gap="xs">
        <Text c="dimmed" size="xs">
          {formatDateTime(status.Created)}
        </Text>
        <Text size="xs">
          {t('Переміщено')} {target}
        </Text>
        {fullName && (
          <Text c="dimmed" size="xs">
            {fullName}
          </Text>
        )}
      </Group>
      <Text fw={600} size="xs">
        {status.Qty ?? 0} {t('Кількість')}
      </Text>
    </Group>
  )
}

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

function getLifeCycleLineLabel(value: string | undefined, t: (key: string) => string): string {
  switch (value) {
    case 'New':
      return t('SaleLifeCycleNew')
    case 'Packaging':
    case 'Packaged':
      return t('SaleLifeCyclePackaging')
    case 'Shipping':
      return t('SaleLifeCycleShipping')
    case 'Received':
      return t('SaleLifeCycleRecevied')
    case 'Await':
      return t('SaleLifeCycleAwait')
    case 'InvoiceChanged':
      return t('InvoiceChanged')
    case 'TransporterChanged':
      return t('TransporterChanged')
    case 'OrderClosed':
      return t('OrderClosed')
    default:
      return value ? t(value) : ''
  }
}

function formatDateTime(value?: Date | string): string {
  const time = getDateTime(value)

  if (time === null) {
    return ''
  }

  return dateTimeFormatter.format(new Date(time))
}

function getDateTime(value?: Date | string): number | null {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getTime()
  }

  const time = Date.parse(value)

  return Number.isNaN(time) ? null : time
}

function displayValue(value?: number | string | null): string {
  if (typeof value === 'number') {
    return String(value)
  }

  const normalized = value?.trim()

  return normalized || '-'
}
