import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Card,
  Collapse,
  Divider,
  Group,
  Loader,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconBuildingStore,
  IconChevronDown,
  IconChevronRight,
  IconEdit,
  IconHistory,
  IconTag,
  IconTruckDelivery,
} from '@tabler/icons-react'
import { useEffect, useRef } from 'react'
import { AppDrawer } from '../../../../shared/ui/AppDrawer'
import { useValueState } from '../../../../shared/hooks/useValueState'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { SaleAuditDetail } from '../../../../shared/sale-audit'
import { getSaleStatisticBySaleId, getSalesByClient } from '../../api/clientSalesApi'
import { SaleLifeCycleType, SaleOrderSource, SalePaymentStatusType } from '../../salesTypes'
import type { Sale, SaleOrderItem, SaleReturnItem, SaleStatistic } from '../../salesTypes'

const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

type SalesPanelProps = {
  netId: string
}

type DetailKind = 'audit' | 'edit' | 'carrier'

export function SalesPanel({ netId }: SalesPanelProps) {
  const { t } = useI18n()
  const [fromDate, setFromDate] = useValueState(() => new Date())
  const [toDate, setToDate] = useValueState(() => new Date())
  const [sales, setSales] = useValueState<SaleStatistic[]>([])
  const [openIndex, setOpenIndex] = useValueState<number | null>(null)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(Boolean(netId))
  const [detailKind, setDetailKind] = useValueState<DetailKind | null>(null)
  const [detailSale, setDetailSale] = useValueState<Sale | null>(null)
  const auditRequestRef = useRef(0)
  const [auditStatistic, setAuditStatistic] = useValueState<SaleStatistic | null>(null)
  const [isAuditLoading, setAuditLoading] = useValueState(false)
  const [auditError, setAuditError] = useValueState<string | null>(null)

  const fromKey = toDateInputValue(fromDate)
  const toKey = toDateInputValue(toDate)

  useEffect(() => {
    if (!netId) {
      return undefined
    }

    let cancelled = false

    async function loadSales() {
      setLoading(true)
      setError(null)

      try {
        const nextSales = await getSalesByClient({
          netId,
          from: parseDateInputValue(fromKey, new Date()),
          to: parseDateInputValue(toKey, new Date()),
        })

        if (!cancelled) {
          setSales(nextSales)
          setOpenIndex(null)
        }
      } catch (loadError) {
        if (!cancelled) {
          setSales([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити продажі клієнта'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadSales()

    return () => {
      cancelled = true
    }
  }, [netId, fromKey, toKey, setSales, setOpenIndex, setLoading, setError, t])

  function toggleExpand(index: number) {
    setOpenIndex((current) => (current === index ? null : index))
  }

  function openCarrier(sale: Sale) {
    setDetailSale(sale)
    setDetailKind('carrier')
  }

  function openEdit(sale: Sale) {
    setDetailSale(sale)
    setDetailKind('edit')
  }

  function openAudit(sale: Sale, fallback: SaleStatistic) {
    setDetailSale(sale)
    setDetailKind('audit')
    setAuditStatistic(fallback)
    setAuditError(null)

    if (!sale.NetUid) {
      return
    }

    setAuditLoading(true)
    const requestId = auditRequestRef.current + 1
    auditRequestRef.current = requestId

    void (async () => {
      try {
        const statistic = await getSaleStatisticBySaleId(sale.NetUid as string)

        if (auditRequestRef.current !== requestId) {
          return
        }

        if (statistic) {
          setAuditStatistic(statistic)
        }
      } catch (loadError) {
        if (auditRequestRef.current !== requestId) {
          return
        }

        setAuditError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити рух товару'))
      } finally {
        if (auditRequestRef.current === requestId) {
          setAuditLoading(false)
        }
      }
    })()
  }

  function closeDetail() {
    auditRequestRef.current += 1
    setDetailKind(null)
    setDetailSale(null)
    setAuditStatistic(null)
    setAuditError(null)
    setAuditLoading(false)
  }

  if (!netId) {
    return (
      <Text c="dimmed" py="xl" ta="center">
        {t('Клієнта не вибрано')}
      </Text>
    )
  }

  return (
    <Stack gap="md">
      <Group gap="sm" align="flex-end" wrap="wrap">
        <DateFilter
          label={t('Дата з')}
          value={fromKey}
          onChange={(value) => setFromDate(parseDateInputValue(value, fromDate))}
        />
        <DateFilter
          label={t('Дата по')}
          value={toKey}
          onChange={(value) => setToDate(parseDateInputValue(value, toDate, true))}
        />
      </Group>

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {error}
        </Alert>
      )}

      {isLoading ? (
        <Group justify="center" py="xl">
          <Loader color="violet" size="sm" />
          <Text c="dimmed" size="sm">
            {t('Завантаження продажів')}
          </Text>
        </Group>
      ) : sales.length === 0 ? (
        <Card withBorder radius="md" padding="lg">
          <Text c="dimmed" size="sm" ta="center">
            {t('Продажів не знайдено')}
          </Text>
        </Card>
      ) : (
        <ScrollArea.Autosize mah="calc(100vh - 260px)" type="auto">
          <Stack gap="sm">
            {sales.map((statistic, index) => (
              <SaleAccordionItem
                key={statistic.NetUid || statistic.Sale?.NetUid || statistic.SaleReturn?.NetUid || index}
                isOpen={openIndex === index}
                statistic={statistic}
                onAudit={openAudit}
                onCarrier={openCarrier}
                onEdit={openEdit}
                onToggle={() => toggleExpand(index)}
              />
            ))}
          </Stack>
        </ScrollArea.Autosize>
      )}

      <AppDrawer
        opened={Boolean(detailKind)}
        position="right"
        size="min(720px, 100vw)"
        title={detailKind ? t(getDetailTitle(detailKind)) : ''}
        onClose={closeDetail}
      >
        {detailKind === 'audit' && (
          <SaleAuditDetail
            error={auditError}
            isLoading={isAuditLoading}
            statistic={auditStatistic}
          />
        )}
        {detailKind === 'edit' && detailSale && <SaleEditDetail sale={detailSale} />}
        {detailKind === 'carrier' && detailSale && <SaleCarrierDetail sale={detailSale} />}
      </AppDrawer>
    </Stack>
  )
}

function DateFilter({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Stack gap={4}>
      <Text c="dimmed" size="xs">
        {label}
      </Text>
      <input
        aria-label={label}
        style={{
          border: '1px solid var(--mantine-color-gray-4)',
          borderRadius: 'var(--mantine-radius-sm)',
          fontSize: 'var(--mantine-font-size-sm)',
          height: 36,
          padding: '0 12px',
        }}
        type="date"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </Stack>
  )
}

function SaleAccordionItem({
  isOpen,
  statistic,
  onAudit,
  onCarrier,
  onEdit,
  onToggle,
}: {
  isOpen: boolean
  statistic: SaleStatistic
  onAudit: (sale: Sale, fallback: SaleStatistic) => void
  onCarrier: (sale: Sale) => void
  onEdit: (sale: Sale) => void
  onToggle: () => void
}) {
  const { t } = useI18n()
  const sale = statistic.Sale
  const saleReturn = statistic.SaleReturn

  if (saleReturn) {
    return (
      <Card withBorder padding="sm" radius="md">
        <Group align="flex-start" gap="sm" wrap="nowrap">
          <ThemeIcon color="red" radius="sm" variant="light">
            <Text fw={700}>X</Text>
          </ThemeIcon>
          <ActionIcon color="gray" variant="subtle" onClick={onToggle}>
            {isOpen ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
          </ActionIcon>
          <Box flex={1} miw={0}>
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Box miw={0}>
                <Text fw={600} size="sm">
                  {displayValue(saleReturn.Number)}
                </Text>
                <Badge color="orange" mt={4} variant="light">
                  {t('Операція повернення')}
                </Badge>
              </Box>
              <Stack align="flex-end" gap={2}>
                <Text fw={700}>
                  {formatAmount(saleReturn.TotalAmountLocal)}{' '}
                  {displayValue(saleReturn.ClientAgreement?.Agreement?.Currency?.Code)}
                </Text>
                <Text c="dimmed" size="xs">
                  {saleReturn.TotalCount ?? 0} {t('Кількість')}
                </Text>
                <CreatedInfo
                  date={saleReturn.Created}
                  firstName={saleReturn.CreatedBy?.FirstName}
                  lastName={saleReturn.CreatedBy?.LastName}
                />
              </Stack>
            </Group>
          </Box>
        </Group>

        <Collapse expanded={isOpen}>
          <Divider my="sm" />
          <Stack gap="xs">
            {(saleReturn.SaleReturnItems || []).map((item, index) => (
              <SaleReturnItemRow
                key={item.NetUid || item.Id || index}
                currencyCode={saleReturn.ClientAgreement?.Agreement?.Currency?.Code}
                item={item}
              />
            ))}
          </Stack>
        </Collapse>
      </Card>
    )
  }

  if (!sale) {
    return null
  }

  const lifeCycle = sale.BaseLifeCycleStatus?.SaleLifeCycleType
  const paymentStatus = sale.BaseSalePaymentStatus?.SalePaymentStatusType
  const isNew = lifeCycle === SaleLifeCycleType.New
  const isReceived = lifeCycle === SaleLifeCycleType.Received
  const isNotPaid = paymentStatus === SalePaymentStatusType.NotPaid
  const currencyCode = sale.ClientAgreement?.Agreement?.Currency?.Code
  const hasMerges = (sale.InputSaleMerges || []).length > 0
  const isEdited = (sale.HistoryInvoiceEdit || []).length > 0
  const showActions = !(isReceived && isNotPaid)

  return (
    <Card withBorder padding="sm" radius="md">
      <Group align="flex-start" gap="sm" wrap="nowrap">
        <Tooltip disabled={!isEdited} label={t('Info.InvoiceEdited')}>
          <ThemeIcon color={getOrderSourceColor(sale)} radius="sm" variant="light">
            <IconBuildingStore size={18} />
          </ThemeIcon>
        </Tooltip>

        <ActionIcon color="gray" variant="subtle" onClick={onToggle}>
          {isOpen ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
        </ActionIcon>

        <Box flex={1} miw={0}>
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <Box miw={0}>
              <Text fw={600} size="sm">
                {displayValue(sale.SaleNumber?.Value)}
              </Text>
              <Group gap="xs" mt={4} wrap="wrap">
                {sale.IsVatSale && (
                  <Badge color="grape" variant="light">
                    {t('Облік ПДВ')}
                  </Badge>
                )}
                <Badge color="blue" variant="light">
                  {getLifeCycleLabel(lifeCycle, t)}
                </Badge>
                {!isNew && (
                  <Badge color={getPaymentStatusColor(paymentStatus)} variant="light">
                    {getPaymentStatusLabel(paymentStatus, t)}
                  </Badge>
                )}
              </Group>
            </Box>

            <Stack align="flex-end" gap={2}>
              <Text fw={700}>
                {formatAmount(sale.TotalAmountLocal)} {displayValue(currencyCode)}
              </Text>
              <Text c="dimmed" size="xs">
                {sale.TotalCount ?? 0} {t('Кількість')}
              </Text>
              <CreatedInfo
                date={sale.ChangedToInvoice || sale.Created}
                firstName={sale.User?.FirstName}
                lastName={sale.User?.LastName}
              />
            </Stack>
          </Group>
        </Box>

        {showActions && (
          <Group gap={4} wrap="nowrap">
            {!hasMerges && sale.TotalCount !== 0 && (
              <Tooltip label={t('Редагувати')}>
                <ActionIcon color="gray" variant="subtle" onClick={() => onEdit(sale)}>
                  <IconEdit size={18} />
                </ActionIcon>
              </Tooltip>
            )}
            {(!isNew || sale.ShiftStatus) && (
              <Tooltip label={t('Рух ТМЦ')}>
                <ActionIcon color="gray" variant="subtle" onClick={() => onAudit(sale, statistic)}>
                  <IconHistory size={18} />
                </ActionIcon>
              </Tooltip>
            )}
            {sale.Transporter && (
              <Tooltip label={sale.Transporter.Name || t('Перевізник')}>
                <ActionIcon color="gray" variant="subtle" onClick={() => onCarrier(sale)}>
                  <IconTruckDelivery size={18} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        )}
      </Group>

      <Collapse expanded={isOpen}>
        <Divider my="sm" />
        <Stack gap="xs">
          {(sale.Order?.OrderItems || []).map((item, index) => (
            <SaleOrderItemRow
              key={item.NetUid || item.Id || index}
              currencyCode={currencyCode}
              item={item}
            />
          ))}
        </Stack>
      </Collapse>
    </Card>
  )
}

function SaleOrderItemRow({
  currencyCode,
  item,
}: {
  currencyCode?: string
  item: SaleOrderItem
}) {
  const { t } = useI18n()
  const product = item.Product

  return (
    <Group align="flex-start" gap="sm" wrap="nowrap">
      <ThemeIcon color="gray" radius="sm" variant="light">
        <IconTag size={16} />
      </ThemeIcon>
      <Box flex={1} miw={0}>
        <Text fw={600} lineClamp={2} size="sm">
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
        <CreatedInfo date={item.Created} lastName={item.User?.LastName} />
      </Box>
      <Stack align="flex-end" gap={2}>
        <Text fw={700} size="sm">
          {roundTotal(item.TotalAmountLocal)} {displayValue(currencyCode)}
        </Text>
        <Text c="dimmed" size="xs">
          {item.Qty ?? 0} {t('Кількість')}
        </Text>
      </Stack>
    </Group>
  )
}

function SaleReturnItemRow({
  currencyCode,
  item,
}: {
  currencyCode?: string
  item: SaleReturnItem
}) {
  const { t } = useI18n()
  const product = item.OrderItem?.Product

  return (
    <Group align="flex-start" gap="sm" wrap="nowrap">
      <ThemeIcon color="gray" radius="sm" variant="light">
        <IconTag size={16} />
      </ThemeIcon>
      <Box flex={1} miw={0}>
        <Text fw={600} lineClamp={2} size="sm">
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
        <CreatedInfo date={item.Created} lastName={item.CreatedBy?.LastName} />
      </Box>
      <Stack align="flex-end" gap={2}>
        <Text fw={700} size="sm">
          {roundTotal(item.AmountLocal)} {displayValue(currencyCode)}
        </Text>
        <Text c="dimmed" size="xs">
          {item.Qty ?? 0} {t('Кількість')}
        </Text>
      </Stack>
    </Group>
  )
}

function SaleEditDetail({ sale }: { sale: Sale }) {
  const { t } = useI18n()
  const currencyCode = sale.ClientAgreement?.Agreement?.Currency?.Code

  return (
    <Stack gap="md">
      <Alert color="blue" icon={<IconAlertCircle size={18} />} variant="light">
        {t('Редагування продажу доступне у застосунку менеджера продажів')}
      </Alert>

      <Card withBorder padding="md" radius="md">
        <Stack gap="xs">
          <DetailRow label={t('Номер')} value={displayValue(sale.SaleNumber?.Value)} />
          <DetailRow label={t('Статус')} value={getLifeCycleLabel(sale.BaseLifeCycleStatus?.SaleLifeCycleType, t)} />
          <DetailRow
            label={t('Сума')}
            value={`${formatAmount(sale.TotalAmountLocal)} ${displayValue(currencyCode)}`}
          />
          <DetailRow label={t('Кількість')} value={String(sale.TotalCount ?? 0)} />
          <DetailRow label={t('Дата')} value={formatDateTime(sale.ChangedToInvoice || sale.Created)} />
        </Stack>
      </Card>

      <Card withBorder padding="md" radius="md">
        <Text fw={600} mb="xs">
          {t('Товари')}
        </Text>
        <Stack gap="xs">
          {(sale.Order?.OrderItems || []).map((item, index) => (
            <SaleOrderItemRow key={item.NetUid || item.Id || index} currencyCode={currencyCode} item={item} />
          ))}
        </Stack>
      </Card>
    </Stack>
  )
}

function SaleCarrierDetail({ sale }: { sale: Sale }) {
  const { t } = useI18n()

  return (
    <Stack gap="md">
      {sale.Transporter && (
        <Card withBorder padding="md" radius="md">
          <Group gap="sm">
            <ThemeIcon color="violet" radius="sm" variant="light">
              <IconTruckDelivery size={18} />
            </ThemeIcon>
            <Text fw={600}>{displayValue(sale.Transporter.Name)}</Text>
          </Group>
        </Card>
      )}

      <Card withBorder padding="md" radius="md">
        <Stack gap="xs">
          <DetailRow label={t('Номер')} value={displayValue(sale.SaleNumber?.Value)} />
          <DetailRow label={t('Дата')} value={formatDateTime(sale.ShipmentDate || sale.Created)} />
          {sale.Comment && <DetailRow label={t('Коментар')} value={sale.Comment} />}
        </Stack>
      </Card>
    </Stack>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between" align="flex-start" wrap="nowrap">
      <Text c="dimmed" size="sm">
        {label}
      </Text>
      <Text fw={500} size="sm" ta="right">
        {value}
      </Text>
    </Group>
  )
}

function CreatedInfo({
  date,
  firstName,
  lastName,
}: {
  date?: Date | string
  firstName?: string
  lastName?: string
}) {
  const fullName = [lastName, firstName].filter(Boolean).join(' ')

  return (
    <Box ta="right">
      <Text c="dimmed" size="xs">
        {formatDateTime(date)}
      </Text>
      {fullName && (
        <Text c="dimmed" size="xs">
          {fullName}
        </Text>
      )}
    </Box>
  )
}

function getDetailTitle(kind: DetailKind): string {
  if (kind === 'audit') {
    return 'Рух товарно-матеріальних цінностей'
  }

  if (kind === 'carrier') {
    return 'Перевізник'
  }

  return 'Акт на редагування'
}

function getOrderSourceColor(sale: Sale): string {
  const source = sale.Order?.OrderSource

  if (source === SaleOrderSource.Shop) {
    return 'blue'
  }

  if (source === SaleOrderSource.Offer) {
    return 'teal'
  }

  return 'violet'
}

function getLifeCycleLabel(value: number | undefined, t: (key: string) => string): string {
  switch (value) {
    case SaleLifeCycleType.New:
      return t('SaleLifeCycleNew')
    case SaleLifeCycleType.Packaging:
    case SaleLifeCycleType.Packaged:
      return t('SaleLifeCyclePackaging')
    case SaleLifeCycleType.Shipping:
      return t('SaleLifeCycleShipping')
    case SaleLifeCycleType.Received:
      return t('SaleLifeCycleRecevied')
    case SaleLifeCycleType.Await:
      return t('SaleLifeCycleAwait')
    case SaleLifeCycleType.InvoiceChanged:
      return t('InvoiceChanged')
    case SaleLifeCycleType.TransporterChanged:
      return t('TransporterChanged')
    case SaleLifeCycleType.OrderClosed:
      return t('OrderClosed')
    default:
      return ''
  }
}

function getPaymentStatusLabel(value: number | undefined, t: (key: string) => string): string {
  switch (value) {
    case SalePaymentStatusType.NotPaid:
      return t('SalePaymentStatusNotPaid')
    case SalePaymentStatusType.Paid:
    case SalePaymentStatusType.Overpaid:
      return t('SalePaymentStatusPaid')
    case SalePaymentStatusType.PartialPaid:
      return t('SalePaymentStatusPartialPaid')
    default:
      return ''
  }
}

function getPaymentStatusColor(value: number | undefined): string {
  switch (value) {
    case SalePaymentStatusType.NotPaid:
      return 'red'
    case SalePaymentStatusType.Paid:
    case SalePaymentStatusType.Overpaid:
      return 'green'
    case SalePaymentStatusType.PartialPaid:
      return 'yellow'
    default:
      return 'gray'
  }
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function parseDateInputValue(value: string, fallback: Date, endOfDay = false): Date {
  if (!value) {
    return fallback
  }

  const date = new Date(`${value}T${endOfDay ? '23:59:59' : '00:00:00'}`)

  return Number.isNaN(date.getTime()) ? fallback : date
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

function roundTotal(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return formatAmount(0)
  }

  return formatAmount(Math.round(value * 1000) / 1000)
}

function formatAmount(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return amountFormatter.format(0)
  }

  return amountFormatter.format(value)
}

function displayValue(value?: number | string | null): string {
  if (typeof value === 'number') {
    return String(value)
  }

  const normalized = value?.trim()

  return normalized || '-'
}
