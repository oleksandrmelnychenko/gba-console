import { ActionIcon, Badge, Box, Button, Group, Loader, Select, Stack, Table, Text, TextInput, Tooltip } from '@mantine/core'
import {
  IconArrowsLeftRight,
  IconBrandEdge,
  IconChevronDown,
  IconChevronRight,
  IconFileInvoice,
  IconHistory,
  IconPrinter,
  IconReceipt2,
  IconTag,
} from '@tabler/icons-react'
import { Fragment } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { getSaleLifecycleStatusKey, getStatusTypeKey } from '../../saleStatus'
import type { SalesUkraineOrderItem, SalesUkraineSale } from '../../types'
import type { WizardSaleRegisterStatistic } from './wizardClientStepApi'
import {
  WIZARD_SALE_REGISTER_STATUS_ALL,
  WIZARD_SALE_REGISTER_STATUS_NEW,
  WIZARD_SALE_REGISTER_STATUS_PACKAGING,
} from './wizardClientStepApi'

const amountFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
const itemAmountFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3, minimumFractionDigits: 2 })

const LIFECYCLE_LABELS: Record<string, string> = {
  Await: 'Очікування',
  New: 'Рахунок',
  Packaged: 'Накладна',
  Packaging: 'Накладна',
  Received: 'Отримано',
  Shipping: 'Відправлено',
}

const PAYMENT_LABELS: Record<string, string> = {
  0: 'Неоплачено',
  1: 'Оплачено',
  2: 'Оплачено',
  3: 'Оплачено частково',
}

const PAYMENT_COLORS: Record<string, string> = {
  0: 'red',
  1: 'green',
  2: 'green',
  3: 'orange',
}

export function WizardClientRegistry({
  canEdit,
  dateFrom,
  dateTo,
  expandedKey,
  isLoading,
  items,
  saleSearch,
  selectedAgreementClientId,
  status,
  onAuditRow,
  onChangeDateFrom,
  onChangeDateTo,
  onChangeSaleSearch,
  onChangeStatus,
  onDeliveryRow,
  onEditRow,
  onOpenOrderedProducts,
  onOpenRow,
  onPrintRow,
  onToggleExpand,
}: {
  canEdit: boolean
  dateFrom: string
  dateTo: string
  expandedKey: string | null
  isLoading: boolean
  items: WizardSaleRegisterStatistic[]
  saleSearch: string
  selectedAgreementClientId: number | undefined
  status: number
  onAuditRow: (sale: SalesUkraineSale) => void
  onChangeDateFrom: (value: string) => void
  onChangeDateTo: (value: string) => void
  onChangeSaleSearch: (value: string) => void
  onChangeStatus: (value: number) => void
  onDeliveryRow: (sale: SalesUkraineSale) => void
  onEditRow: (sale: SalesUkraineSale) => void
  onOpenOrderedProducts: () => void
  onOpenRow: (sale: SalesUkraineSale) => void
  onPrintRow: (sale: SalesUkraineSale) => void
  onToggleExpand: (key: string) => void
}) {
  const { t } = useI18n()

  const visibleSales = items
    .reduce<SalesUkraineSale[]>((acc, item) => {
      if (item.Sale && getClientAgreementClientId(item.Sale) === selectedAgreementClientId) {
        acc.push(item.Sale)
      }

      return acc
    }, [])
    .sort((a, b) => getTime(b.Created) - getTime(a.Created))

  return (
    <Stack gap="xs" style={{ flex: 1, minHeight: 0 }}>
      <Group align="end" gap="sm" wrap="wrap">
        <Select
          allowDeselect={false}
          data={[
            { label: t('Всі'), value: String(WIZARD_SALE_REGISTER_STATUS_ALL) },
            { label: t('Рахунок'), value: String(WIZARD_SALE_REGISTER_STATUS_NEW) },
            { label: t('Накладна'), value: String(WIZARD_SALE_REGISTER_STATUS_PACKAGING) },
          ]}
          label={t('Статус')}
          size="xs"
          value={String(status)}
          w={130}
          onChange={(value) => onChangeStatus(Number(value ?? WIZARD_SALE_REGISTER_STATUS_ALL))}
        />
        <TextInput
          label={t('Пошук по товару')}
          placeholder={t('Пошук по товару')}
          size="xs"
          value={saleSearch}
          w={200}
          onChange={(event) => onChangeSaleSearch(event.currentTarget.value)}
        />
        <TextInput
          label={t('Початкова дата')}
          max={dateTo || undefined}
          size="xs"
          type="date"
          value={dateFrom}
          onChange={(event) => onChangeDateFrom(event.currentTarget.value)}
        />
        <TextInput
          label={t('Кінцева дата')}
          min={dateFrom || undefined}
          size="xs"
          type="date"
          value={dateTo}
          onChange={(event) => onChangeDateTo(event.currentTarget.value)}
        />
        <Button size="xs" variant="light" onClick={onOpenOrderedProducts}>
          {t('Замовлені товари')}
        </Button>
      </Group>

      <Text fw={700} size="sm">
        {t('Реєстр документів')}
      </Text>

      <Box style={{ flex: 1, minHeight: 120, overflowY: 'auto' }}>
        {isLoading ? (
          <Group gap="xs" justify="center" py="md">
            <Loader size="sm" />
            <Text c="dimmed" size="sm">
              {t('Завантаження')}
            </Text>
          </Group>
        ) : visibleSales.length === 0 ? (
          <Text c="dimmed" py="md" size="sm" ta="center">
            {t('Документів не знайдено')}
          </Text>
        ) : (
          <Stack gap={4}>
            {visibleSales.map((sale, index) => {
              const key = String(sale.NetUid || sale.Id || index)
              const isOpen = expandedKey === key

              return (
                <Fragment key={key}>
                  <WizardSaleRegistryRow
                    canEdit={canEdit}
                    isOpen={isOpen}
                    sale={sale}
                    onAudit={onAuditRow}
                    onDelivery={onDeliveryRow}
                    onEdit={onEditRow}
                    onOpen={onOpenRow}
                    onPrint={onPrintRow}
                    onToggleExpand={() => onToggleExpand(key)}
                  />
                  {isOpen && <WizardSaleRegistryRowContent sale={sale} />}
                </Fragment>
              )
            })}
          </Stack>
        )}
      </Box>
    </Stack>
  )
}

function WizardSaleRegistryRow({
  canEdit,
  isOpen,
  sale,
  onAudit,
  onDelivery,
  onEdit,
  onOpen,
  onPrint,
  onToggleExpand,
}: {
  canEdit: boolean
  isOpen: boolean
  sale: SalesUkraineSale
  onAudit: (sale: SalesUkraineSale) => void
  onDelivery: (sale: SalesUkraineSale) => void
  onEdit: (sale: SalesUkraineSale) => void
  onOpen: (sale: SalesUkraineSale) => void
  onPrint: (sale: SalesUkraineSale) => void
  onToggleExpand: () => void
}) {
  const { t } = useI18n()
  const lifecycleKey = getSaleLifecycleStatusKey(sale.BaseLifeCycleStatus?.SaleLifeCycleType ?? sale.BaseLifeCycleStatus?.Name)
  const paymentKey = getStatusTypeKey(sale.BaseSalePaymentStatus?.SalePaymentStatusType)
  const isNew = lifecycleKey === 'New'
  const isEdited = (sale.HistoryInvoiceEdit?.length ?? 0) > 0
  const isShift = Boolean((sale as { ShiftStatus?: unknown }).ShiftStatus)
  const hideActions = lifecycleKey === 'Received' && paymentKey === '0'
  const showEdit = canEdit && (sale.InputSaleMerges?.length ?? 0) === 0 && (sale.TotalCount ?? 0) > 0
  const showAudit = !isNew || isShift
  const createdDate = sale.ChangedToInvoice || sale.Created
  const currencyCode = sale.ClientAgreement?.Agreement?.Currency?.Code || ''
  const userName = [sale.User?.LastName, sale.User?.FirstName].filter(Boolean).join(' ')

  return (
    <Box
      aria-label={t('Відкрити продаж')}
      px={8}
      py={6}
      role="button"
      style={{
        background: isOpen
          ? 'var(--mantine-color-violet-light)'
          : isShift
            ? 'var(--mantine-color-yellow-light)'
            : undefined,
        border: '1px solid var(--mantine-color-gray-3)',
        borderRadius: 8,
        cursor: 'pointer',
        width: '100%',
      }}
      tabIndex={-1}
      onClick={(event) => {
        if (!(event.target as HTMLElement).closest('button, a')) {
          onOpen(sale)
        }
      }}
    >
      <Group gap={8} wrap="nowrap">
        <Box style={{ flexShrink: 0, height: 8, width: 8 }}>
          {isEdited && (
            <Tooltip label={t('Рахунок редаговано')}>
              <Box style={{ background: 'var(--mantine-color-red-6)', borderRadius: '50%', height: 8, width: 8 }} />
            </Tooltip>
          )}
        </Box>

        <WizardSaleSourceIcon lifecycleKey={lifecycleKey} sale={sale} />

        <ActionIcon
          aria-label={isOpen ? t('Згорнути') : t('Розгорнути')}
          color="gray"
          size="sm"
          variant="subtle"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onToggleExpand()
          }}
        >
          {isOpen ? <IconChevronDown size={15} /> : <IconChevronRight size={15} />}
        </ActionIcon>

        <Text fw={600} size="sm" style={{ flexShrink: 0, minWidth: 110 }}>
          {sale.SaleNumber?.Value}
        </Text>

        <Box style={{ flexShrink: 0, minWidth: 120 }}>
          {!isNew && PAYMENT_LABELS[paymentKey] && (
            <Badge color={PAYMENT_COLORS[paymentKey] || 'gray'} size="sm" variant="light">
              {t(PAYMENT_LABELS[paymentKey])}
            </Badge>
          )}
        </Box>

        <Text size="sm" style={{ flexShrink: 0, minWidth: 110 }}>
          {sale.IsVatSale ? `(${t('ПДВ')}) ` : ''}
          {t(LIFECYCLE_LABELS[lifecycleKey] || lifecycleKey)}
        </Text>

        <Group gap={4} style={{ flex: 1, minWidth: 0 }} wrap="nowrap">
          <Text fw={600} size="sm">
            {amountFormatter.format(sale.TotalAmountLocal ?? 0)}
          </Text>
          <Text c="dimmed" size="xs">
            {currencyCode}
          </Text>
          <Text fw={600} ml="xs" size="sm">
            {sale.TotalCount ?? 0}
          </Text>
          <Text c="dimmed" size="xs">
            {t('штук')}
          </Text>
        </Group>

        <Box style={{ flexShrink: 0, textAlign: 'right' }}>
          <Text size="xs">{formatDateTime(createdDate)}</Text>
          <Text c="dimmed" size="xs">
            {userName}
          </Text>
        </Box>

        {!hideActions && (
          <Group gap={2} style={{ flexShrink: 0 }} wrap="nowrap">
            {showEdit && (
              <Tooltip label={isNew ? t('Акт редагування рахунку') : t('Акт редагування накладної')}>
                <ActionIcon
                  aria-label={t('Акт редагування')}
                  color="gray"
                  size="sm"
                  variant="subtle"
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    onEdit(sale)
                  }}
                >
                  <IconArrowsLeftRight size={15} />
                </ActionIcon>
              </Tooltip>
            )}
            {!isNew && (
              <Tooltip label={t('Друк')}>
                <ActionIcon
                  aria-label={t('Друк')}
                  color="gray"
                  size="sm"
                  variant="subtle"
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    onPrint(sale)
                  }}
                >
                  <IconPrinter size={15} />
                </ActionIcon>
              </Tooltip>
            )}
            {showAudit && (
              <Tooltip label={t('Рух товарно-матеріальних цінностей')}>
                <ActionIcon
                  aria-label={t('Рух товарно-матеріальних цінностей')}
                  color="gray"
                  size="sm"
                  variant="subtle"
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    onAudit(sale)
                  }}
                >
                  <IconHistory size={15} />
                </ActionIcon>
              </Tooltip>
            )}
            {sale.Transporter && (
              <Tooltip label={t('Перевізник')}>
                <ActionIcon
                  aria-label={t('Перевізник')}
                  color="gray"
                  size="sm"
                  variant="subtle"
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    onDelivery(sale)
                  }}
                >
                  {sale.Transporter.ImageUrl ? (
                    <Box
                      style={{
                        backgroundImage: `url(${sale.Transporter.ImageUrl})`,
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat',
                        backgroundSize: 'contain',
                        height: 15,
                        width: 15,
                      }}
                    />
                  ) : (
                    <IconFileInvoice size={15} />
                  )}
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        )}
      </Group>
    </Box>
  )
}

function WizardSaleRegistryRowContent({ sale }: { sale: SalesUkraineSale }) {
  const { t } = useI18n()
  const orderItems = Array.isArray(sale.Order?.OrderItems) ? sale.Order.OrderItems : []
  const currencyCode = sale.ClientAgreement?.Agreement?.Currency?.Code || ''

  return (
    <Box px="md" py={4}>
      <Table highlightOnHover verticalSpacing={4} withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th w={120}>{t('Код Виробника')}</Table.Th>
            <Table.Th w={140}>{t('Ориг. номер')}</Table.Th>
            <Table.Th>{t('Назва товару')}</Table.Th>
            <Table.Th ta="right" w={120}>
              {t('Сума')}
            </Table.Th>
            <Table.Th ta="right" w={90}>
              {t('К-сть')}
            </Table.Th>
            <Table.Th w={180}>{t('Створено')}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {orderItems.map((item, index) => (
            <Table.Tr key={String(item.NetUid || item.Id || index)}>
              <Table.Td>{item.Product?.VendorCode}</Table.Td>
              <Table.Td>{item.Product?.MainOriginalNumber}</Table.Td>
              <Table.Td>{item.Product?.Name}</Table.Td>
              <Table.Td ta="right">
                {itemAmountFormatter.format(getOrderItemAmount(item))} {currencyCode}
              </Table.Td>
              <Table.Td ta="right">
                {item.Qty ?? 0} {t('штук')}
              </Table.Td>
              <Table.Td>
                {formatDateTime(item.Created)} {item.User?.LastName || ''}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Box>
  )
}

function WizardSaleSourceIcon({ lifecycleKey, sale }: { lifecycleKey: string; sale: SalesUkraineSale }) {
  const { t } = useI18n()
  const source = sale.Order?.OrderSource
  const isInvoiceStage = lifecycleKey === 'Packaging' || lifecycleKey === 'Packaged'
  const indicator =
    source === 0
      ? { icon: <IconBrandEdge size={14} />, label: t('Інтернет-магазин') }
      : source === 2
        ? { icon: <IconTag size={14} />, label: t('Оферта') }
        : isInvoiceStage
          ? { icon: <IconFileInvoice size={14} />, label: t('Накладна') }
          : { icon: <IconReceipt2 size={14} />, label: t('Рахунок') }

  return (
    <Tooltip label={indicator.label}>
      <Box c="gray.6" style={{ display: 'inline-flex', flexShrink: 0 }}>
        {indicator.icon}
      </Box>
    </Tooltip>
  )
}

function getClientAgreementClientId(sale: SalesUkraineSale): number | undefined {
  const clientId = (sale.ClientAgreement as { ClientId?: number } | undefined)?.ClientId

  return typeof clientId === 'number' ? clientId : sale.ClientAgreement?.Client?.Id
}

function getOrderItemAmount(item: SalesUkraineOrderItem): number {
  return item.TotalAmountLocal ?? item.TotalAmount ?? 0
}

function getTime(value?: Date | string): number {
  if (!value) {
    return 0
  }

  const time = value instanceof Date ? value.getTime() : Date.parse(value)

  return Number.isNaN(time) ? 0 : time
}

function formatDateTime(value?: Date | string): string {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${day}.${month}.${date.getFullYear()} ${hours}:${minutes}`
}
