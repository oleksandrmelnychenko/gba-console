import { ActionIcon, Box, Button, Group, Select, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import {
  IconArrowsLeftRight,
  IconFileInvoice,
  IconHistory,
  IconPackage,
  IconPrinter,
} from '@tabler/icons-react'
import { useMemo } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { DataTable } from '../../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../../shared/ui/data-table/types'
import { CREATE_ACTION_COLOR } from '../../../../shared/ui/page-header-actions/PageHeaderActions'
import { getSaleLifecycleStatusKey, getStatusTypeKey } from '../../saleStatus'
import type { SalesUkraineOrderItem, SalesUkraineSale } from '../../types'
import type { WizardSaleRegisterStatistic } from './wizardClientStepApi'
import {
  WIZARD_SALE_REGISTER_STATUS_ALL,
  WIZARD_SALE_REGISTER_STATUS_NEW,
  WIZARD_SALE_REGISTER_STATUS_PACKAGING,
} from './wizardClientStepApi'
import '../../../../shared/ui/data-table/data-table.css'

const amountFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
const itemAmountFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3, minimumFractionDigits: 2 })
const qtyFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 })

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

const WIZARD_REGISTER_TABLE_MIN_WIDTH = 1084
const WIZARD_REGISTER_ITEMS_TABLE_MIN_WIDTH = 900

const WIZARD_REGISTER_TABLE_LAYOUT: DataTableDefaultLayout = {
  columnPinning: {
    right: ['actions'],
  },
  columnSizing: {
    actions: 112,
    amount: 118,
    created: 166,
    document: 260,
    documentType: 116,
    payment: 132,
    qty: 84,
  },
  density: 'compact',
}

const WIZARD_REGISTER_ITEMS_TABLE_LAYOUT: DataTableDefaultLayout = {
  columnSizing: {
    amount: 120,
    created: 160,
    originalNumber: 160,
    product: 320,
    qty: 96,
    vendorCode: 150,
  },
  density: 'compact',
}

export function WizardClientRegistry({
  canEdit,
  dateFrom,
  dateTo,
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
}: {
  canEdit: boolean
  dateFrom: string
  dateTo: string
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

  const columns = useMemo<DataTableColumn<SalesUkraineSale>[]>(
    () => [
      {
        id: 'document',
        header: t('\u0414\u043e\u043a\u0443\u043c\u0435\u043d\u0442'),
        accessor: (sale) => sale.SaleNumber?.Value || '',
        cell: (sale) => <WizardSaleDocumentCell sale={sale} />,
        width: 260,
        minWidth: 210,
        fill: true,
      },
      {
        id: 'documentType',
        header: t('\u0422\u0438\u043f'),
        accessor: (sale) => getSaleLifecycleLabel(sale),
        cell: (sale) => <WizardSaleDocumentTypeCell sale={sale} />,
        width: 116,
        minWidth: 104,
      },
      {
        id: 'payment',
        header: t('\u041e\u043f\u043b\u0430\u0442\u0430'),
        accessor: (sale) => getSalePaymentLabel(sale),
        cell: (sale) => <WizardSalePaymentCell sale={sale} />,
        width: 132,
        minWidth: 112,
      },
      {
        id: 'amount',
        header: t('\u0421\u0443\u043c\u0430'),
        accessor: (sale) => sale.TotalAmountLocal ?? 0,
        cell: (sale) => <WizardSaleAmountCell sale={sale} />,
        width: 118,
        minWidth: 104,
      },
      {
        id: 'qty',
        header: t('\u041a-\u0441\u0442\u044c'),
        accessor: (sale) => sale.TotalCount ?? 0,
        cell: (sale) => <WizardSaleQtyCell sale={sale} />,
        className: 'new-sale-register-qty-column',
        width: 84,
        minWidth: 76,
      },
      {
        id: 'created',
        header: t('\u0421\u0442\u0432\u043e\u0440\u0435\u043d\u043e'),
        accessor: (sale) => getTime(sale.ChangedToInvoice || sale.Created),
        cell: (sale) => <WizardSaleCreatedCell sale={sale} />,
        width: 166,
        minWidth: 142,
      },
      {
        id: 'actions',
        header: t('\u0414\u0456\u0457'),
        cell: (sale) => (
          <WizardSaleActionsCell
            canEdit={canEdit}
            sale={sale}
            onAudit={onAuditRow}
            onDelivery={onDeliveryRow}
            onEdit={onEditRow}
            onPrint={onPrintRow}
          />
        ),
        width: 112,
        minWidth: 104,
        enableSorting: false,
      },
    ],
    [canEdit, onAuditRow, onDeliveryRow, onEditRow, onPrintRow, t],
  )

  return (
    <Stack className="new-sale-register" gap={0}>
      <Box className="new-sale-register-toolbar">
        <Group align="end" className="new-sale-register-toolbar__controls" gap={8} wrap="wrap">
          <Select
            allowDeselect={false}
            className="new-sale-register-control"
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
            className="new-sale-register-search"
            label={t('Пошук по товару')}
            size="xs"
            value={saleSearch}
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
          <Button
            className="new-sale-register-orders-button"
            color={CREATE_ACTION_COLOR}
            size="xs"
            variant="filled"
            onClick={onOpenOrderedProducts}
          >
            {t('Замовлені товари')}
          </Button>
        </Group>

      </Box>

      <Box className="new-sale-register-table">
        <DataTable
          columns={columns}
          data={visibleSales}
          defaultLayout={WIZARD_REGISTER_TABLE_LAYOUT}
          distributeAvailableWidth
          emptyText={t('\u0414\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u0456\u0432 \u043d\u0435 \u0437\u043d\u0430\u0439\u0434\u0435\u043d\u043e')}
          expandColumnLabels={{
            collapseRow: t('\u0417\u0433\u043e\u0440\u043d\u0443\u0442\u0438'),
            expandRow: t('\u0420\u043e\u0437\u0433\u043e\u0440\u043d\u0443\u0442\u0438'),
          }}
          getRowCanExpand={() => true}
          getRowId={(sale, index) => String(sale.NetUid || sale.Id || index)}
          height="100%"
          isLoading={isLoading}
          layoutVersion="new-sale-wizard-register-4"
          minWidth={WIZARD_REGISTER_TABLE_MIN_WIDTH}
          renderExpandedRow={(sale) => <WizardSaleRegistryRowContent sale={sale} />}
          rowClassName={(sale) => getSaleRowClassName(sale)}
          showDensityToggle={false}
          tableId="new-sale-wizard-register"
          onRowClick={onOpenRow}
        />
      </Box>
    </Stack>
  )
}

function WizardSaleDocumentCell({ sale }: { sale: SalesUkraineSale }) {
  return (
    <Box className="new-sale-register-document-cell">
      <Text className="new-sale-register-document-number" title={String(sale.SaleNumber?.Value || '')} truncate>
        {sale.SaleNumber?.Value || '-'}
      </Text>
    </Box>
  )
}

function WizardSaleDocumentTypeCell({ sale }: { sale: SalesUkraineSale }) {
  const { t } = useI18n()
  const lifecycleLabel = getSaleLifecycleLabel(sale)

  return (
    <Text className="new-sale-register-document-type" title={`${sale.IsVatSale ? `${t('\u041f\u0414\u0412')} ` : ''}${t(lifecycleLabel)}`} truncate>
      {sale.IsVatSale ? `${t('\u041f\u0414\u0412')} ` : ''}
      {t(lifecycleLabel)}
    </Text>
  )
}

function WizardSalePaymentCell({ sale }: { sale: SalesUkraineSale }) {
  const { t } = useI18n()
  const label = getSalePaymentLabel(sale)
  const isEdited = (sale.HistoryInvoiceEdit?.length ?? 0) > 0
  const dotLabel = isEdited
    ? t('\u0420\u0430\u0445\u0443\u043d\u043e\u043a \u0440\u0435\u0434\u0430\u0433\u043e\u0432\u0430\u043d\u043e')
    : t(getSaleDotLabel(sale))

  return (
    <Group className="new-sale-register-payment-cell" gap={8} wrap="nowrap">
      <Tooltip label={dotLabel}>
        <span className={`new-sale-register-status-dot ${isEdited ? 'is-edited' : getSaleRowStateClass(sale)}`} />
      </Tooltip>
      <Text className={`new-sale-register-payment ${getSaleRowStateClass(sale)}`} title={label ? t(label) : ''} truncate>
        {label ? t(label) : ''}
      </Text>
    </Group>
  )
}

function WizardSaleAmountCell({ sale }: { sale: SalesUkraineSale }) {
  return (
    <Box className="new-sale-register-value-cell is-inline">
      <Text>{amountFormatter.format(sale.TotalAmountLocal ?? 0)}</Text>
      <Text>{getSaleCurrencyCode(sale)}</Text>
    </Box>
  )
}

function WizardSaleQtyCell({ sale }: { sale: SalesUkraineSale }) {
  const { t } = useI18n()

  return (
    <Box className="new-sale-register-value-cell is-inline">
      <Text>{sale.TotalCount ?? 0}</Text>
      <Text>{t('\u0448\u0442\u0443\u043a')}</Text>
    </Box>
  )
}

function WizardSaleCreatedCell({ sale }: { sale: SalesUkraineSale }) {
  const userName = [sale.User?.LastName, sale.User?.FirstName].filter(Boolean).join(' ')

  return (
    <Box className="new-sale-register-value-cell">
      <Text>{formatDateTime(sale.ChangedToInvoice || sale.Created)}</Text>
      {userName && <Text title={userName}>{userName}</Text>}
    </Box>
  )
}

function WizardSaleActionsCell({
  canEdit,
  sale,
  onAudit,
  onDelivery,
  onEdit,
  onPrint,
}: {
  canEdit: boolean
  sale: SalesUkraineSale
  onAudit: (sale: SalesUkraineSale) => void
  onDelivery: (sale: SalesUkraineSale) => void
  onEdit: (sale: SalesUkraineSale) => void
  onPrint: (sale: SalesUkraineSale) => void
}) {
  const { t } = useI18n()
  const lifecycleKey = getSaleLifecycleKey(sale)
  const paymentKey = getSalePaymentKey(sale)
  const isNew = lifecycleKey === 'New'
  const isShift = Boolean((sale as { ShiftStatus?: unknown }).ShiftStatus)
  const hideActions = lifecycleKey === 'Received' && paymentKey === '0'
  const showEdit = canEdit && (sale.InputSaleMerges?.length ?? 0) === 0 && (sale.TotalCount ?? 0) > 0
  const showAudit = !isNew || isShift

  if (hideActions) {
    return null
  }

  return (
    <Group className="new-sale-register-actions" gap={2} justify="flex-start" wrap="nowrap">
      {showEdit && (
        <Tooltip label={isNew ? t('\u0410\u043a\u0442 \u0440\u0435\u0434\u0430\u0433\u0443\u0432\u0430\u043d\u043d\u044f \u0440\u0430\u0445\u0443\u043d\u043a\u0443') : t('\u0410\u043a\u0442 \u0440\u0435\u0434\u0430\u0433\u0443\u0432\u0430\u043d\u043d\u044f \u043d\u0430\u043a\u043b\u0430\u0434\u043d\u043e\u0457')}>
          <ActionIcon
            aria-label={t('\u0410\u043a\u0442 \u0440\u0435\u0434\u0430\u0433\u0443\u0432\u0430\u043d\u043d\u044f')}
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
        <Tooltip label={t('\u0414\u0440\u0443\u043a')}>
          <ActionIcon
            aria-label={t('\u0414\u0440\u0443\u043a')}
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
        <Tooltip label={t('\u0420\u0443\u0445 \u0442\u043e\u0432\u0430\u0440\u043d\u043e-\u043c\u0430\u0442\u0435\u0440\u0456\u0430\u043b\u044c\u043d\u0438\u0445 \u0446\u0456\u043d\u043d\u043e\u0441\u0442\u0435\u0439')}>
          <ActionIcon
            aria-label={t('\u0420\u0443\u0445 \u0442\u043e\u0432\u0430\u0440\u043d\u043e-\u043c\u0430\u0442\u0435\u0440\u0456\u0430\u043b\u044c\u043d\u0438\u0445 \u0446\u0456\u043d\u043d\u043e\u0441\u0442\u0435\u0439')}
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
        <Tooltip label={t('\u041f\u0435\u0440\u0435\u0432\u0456\u0437\u043d\u0438\u043a')}>
          <ActionIcon
            aria-label={t('\u041f\u0435\u0440\u0435\u0432\u0456\u0437\u043d\u0438\u043a')}
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
  )
}

function WizardSaleRegistryRowContent({ sale }: { sale: SalesUkraineSale }) {
  const { t } = useI18n()
  const orderItems = Array.isArray(sale.Order?.OrderItems) ? sale.Order.OrderItems : []
  const currencyCode = sale.ClientAgreement?.Agreement?.Currency?.Code || ''
  const itemColumns = useMemo<DataTableColumn<SalesUkraineOrderItem>[]>(
    () => [
      {
        id: 'product',
        header: t('\u0422\u043e\u0432\u0430\u0440'),
        accessor: (item) => item.Product?.Name || '',
        cell: (item) => (
          <WizardSaleItemProductCell
            fallbackName={t('\u0422\u043e\u0432\u0430\u0440 \u0431\u0435\u0437 \u043d\u0430\u0437\u0432\u0438')}
            item={item}
          />
        ),
        width: 320,
        minWidth: 260,
        fill: true,
        enableHiding: false,
        enablePinning: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
      },
      {
        id: 'vendorCode',
        header: t('\u041a\u043e\u0434 \u0432\u0438\u0440\u043e\u0431\u043d\u0438\u043a\u0430'),
        accessor: (item) => item.Product?.VendorCode || '',
        cell: (item) => <WizardSaleItemTextCell value={item.Product?.VendorCode || '-'} />,
        width: 150,
        minWidth: 132,
        enableHiding: false,
        enablePinning: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
      },
      {
        id: 'originalNumber',
        header: t('\u041e\u0440\u0438\u0433. \u043d\u043e\u043c\u0435\u0440'),
        accessor: (item) => item.Product?.MainOriginalNumber || '',
        cell: (item) => <WizardSaleItemTextCell value={item.Product?.MainOriginalNumber || '-'} />,
        width: 160,
        minWidth: 142,
        enableHiding: false,
        enablePinning: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
      },
      {
        id: 'amount',
        header: t('\u0421\u0443\u043c\u0430'),
        accessor: (item) => getOrderItemAmount(item),
        cell: (item) => {
          const amount = getOrderItemAmount(item)

          return (
            <WizardSaleItemValueCell
              money
              negative={amount < 0}
              unit={currencyCode}
              value={itemAmountFormatter.format(amount)}
            />
          )
        },
        width: 120,
        minWidth: 108,
        enableHiding: false,
        enablePinning: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
      },
      {
        id: 'qty',
        header: t('\u041a-\u0441\u0442\u044c'),
        accessor: (item) => item.Qty ?? 0,
        cell: (item) => <WizardSaleItemValueCell quantity value={qtyFormatter.format(item.Qty ?? 0)} />,
        className: 'new-sale-register-qty-column',
        width: 96,
        minWidth: 84,
        enableHiding: false,
        enablePinning: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
      },
      {
        id: 'created',
        header: t('\u0421\u0442\u0432\u043e\u0440\u0435\u043d\u043e'),
        accessor: (item) => getTime(item.Created),
        cell: (item) => <WizardSaleItemTextCell value={formatDateTime(item.Created)} />,
        width: 160,
        minWidth: 142,
        enableHiding: false,
        enablePinning: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
      },
    ],
    [currencyCode, t],
  )

  return (
    <Box className="new-sale-register-expanded">
      <Box className="new-sale-register-expanded__panel">
        {orderItems.length === 0 ? (
          <Text className="new-sale-register-expanded__empty">
            {t('\u0422\u043e\u0432\u0430\u0440\u0456\u0432 \u043d\u0435 \u0437\u043d\u0430\u0439\u0434\u0435\u043d\u043e')}
          </Text>
        ) : (
          <Box className="new-sale-register-expanded__items">
            <DataTable
              columns={itemColumns}
              data={orderItems}
              defaultLayout={WIZARD_REGISTER_ITEMS_TABLE_LAYOUT}
              distributeAvailableWidth
              getRowId={(item, index) => String(item.NetUid || item.Id || index)}
              layoutVersion="new-sale-register-items-1"
              minWidth={WIZARD_REGISTER_ITEMS_TABLE_MIN_WIDTH}
              showDensityToggle={false}
              showLayoutControls={false}
              tableId="new-sale-register-items"
            />
          </Box>
        )}
      </Box>
    </Box>
  )
}

function WizardSaleItemProductCell({
  fallbackName,
  item,
}: {
  fallbackName: string
  item: SalesUkraineOrderItem
}) {
  const productName = item.Product?.Name || fallbackName

  return (
    <Group className="new-sale-item-product-cell" gap={9} wrap="nowrap">
      <Box className="new-sale-item-product-icon">
        <IconPackage size={16} />
      </Box>
      <Text className="new-sale-item-product-name" title={productName} truncate>
        {productName}
      </Text>
    </Group>
  )
}

function WizardSaleItemTextCell({ value }: { value: string }) {
  return (
    <Text className="new-sale-item-text-cell" title={value} truncate>
      {value}
    </Text>
  )
}

function WizardSaleItemValueCell({
  money = false,
  negative = false,
  quantity = false,
  unit,
  value,
}: {
  money?: boolean
  negative?: boolean
  quantity?: boolean
  unit?: string
  value: string
}) {
  return (
    <Box className={`new-sale-item-value-cell ${money ? 'is-money' : ''} ${negative ? 'is-negative' : ''} ${quantity ? 'is-quantity' : ''}`}>
      <Text>{value}</Text>
      {unit && <Text>{unit}</Text>}
    </Box>
  )
}

function getSaleLifecycleKey(sale: SalesUkraineSale): string {
  return getSaleLifecycleStatusKey(sale.BaseLifeCycleStatus?.SaleLifeCycleType ?? sale.BaseLifeCycleStatus?.Name)
}

function getSaleLifecycleLabel(sale: SalesUkraineSale): string {
  const lifecycleKey = getSaleLifecycleKey(sale)

  return LIFECYCLE_LABELS[lifecycleKey] || lifecycleKey
}

function getSalePaymentKey(sale: SalesUkraineSale): string {
  return getStatusTypeKey(sale.BaseSalePaymentStatus?.SalePaymentStatusType)
}

function getSalePaymentLabel(sale: SalesUkraineSale): string {
  const lifecycleKey = getSaleLifecycleKey(sale)
  const paymentKey = getSalePaymentKey(sale)

  if (lifecycleKey === 'New') {
    return ''
  }

  return PAYMENT_LABELS[paymentKey] || ''
}

function getSaleDotLabel(sale: SalesUkraineSale): string {
  const paymentKey = getSalePaymentKey(sale)

  return PAYMENT_LABELS[paymentKey] || '\u0421\u0442\u0430\u0442\u0443\u0441 \u043d\u0435 \u0432\u0438\u0437\u043d\u0430\u0447\u0435\u043d\u043e'
}

function getSaleRowStateClass(sale: SalesUkraineSale): string {
  const paymentKey = getSalePaymentKey(sale)

  return paymentKey === '0'
    ? 'is-danger'
    : paymentKey === '1' || paymentKey === '2'
      ? 'is-success'
      : 'is-neutral'
}

function getSaleRowClassName(sale: SalesUkraineSale): string {
  return [
    'new-sale-register-table-row',
    Boolean((sale as { ShiftStatus?: unknown }).ShiftStatus) ? 'is-shift' : '',
  ].filter(Boolean).join(' ')
}

function getSaleCurrencyCode(sale: SalesUkraineSale): string {
  return sale.ClientAgreement?.Agreement?.Currency?.Code || ''
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
