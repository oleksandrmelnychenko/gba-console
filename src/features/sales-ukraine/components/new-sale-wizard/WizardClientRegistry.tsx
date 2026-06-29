import { ActionIcon, Badge, Box, Button, Group, Loader, Select, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import {
  IconArrowsLeftRight,
  IconBarcode,
  IconBrandEdge,
  IconCalendarTime,
  IconChevronDown,
  IconChevronRight,
  IconCoins,
  IconFileInvoice,
  IconHistory,
  IconPackage,
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
            placeholder={t('Пошук по товару')}
            size="xs"
            value={saleSearch}
            w={220}
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
          <Button className="new-sale-register-orders-button" size="xs" variant="light" onClick={onOpenOrderedProducts}>
            {t('Замовлені товари')}
          </Button>
        </Group>

        <Box className="new-sale-register-toolbar__summary">
          <Text className="new-sale-register-toolbar__title">{t('Реєстр документів')}</Text>
          <Text className="new-sale-register-toolbar__count">{visibleSales.length}</Text>
        </Box>
      </Box>

      <Box className="new-sale-register-list">
        {isLoading ? (
          <Group className="new-sale-register-state" gap="xs" justify="center">
            <Loader size="sm" />
            <Text c="dimmed" size="sm">
              {t('Завантаження')}
            </Text>
          </Group>
        ) : visibleSales.length === 0 ? (
          <Text className="new-sale-register-state" c="dimmed" size="sm" ta="center">
            {t('Документів не знайдено')}
          </Text>
        ) : (
          <>
            <Box className="new-sale-register-head">
              <Text>{t('Документ')}</Text>
              <Text>{t('Оплата')}</Text>
              <Text>{t('Сума')}</Text>
              <Text>{t('К-сть')}</Text>
              <Text>{t('Створено')}</Text>
              <Text>{t('Дії')}</Text>
            </Box>
            <Stack className="new-sale-register-rows" gap={0}>
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
          </>
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
  const rowClassName = [
    'new-sale-register-row',
    isOpen ? 'is-open' : '',
    isShift ? 'is-shift' : '',
  ].filter(Boolean).join(' ')

  return (
    <Box
      aria-label={t('Відкрити продаж')}
      className={rowClassName}
      role="button"
      tabIndex={-1}
      onClick={(event) => {
        if (!(event.target as HTMLElement).closest('button, a')) {
          onOpen(sale)
        }
      }}
    >
      <Box className="new-sale-register-row__grid">
        <Box className="new-sale-register-row__document">
          <Box className="new-sale-register-row__edited">
            {isEdited && (
              <Tooltip label={t('Рахунок редаговано')}>
                <Box />
              </Tooltip>
            )}
          </Box>

          <WizardSaleSourceIcon lifecycleKey={lifecycleKey} sale={sale} />

          <ActionIcon
            aria-label={isOpen ? t('Згорнути') : t('Розгорнути')}
            className="new-sale-register-row__expand"
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

          <Box className="new-sale-register-row__document-copy">
            <Text className="new-sale-register-row__number" title={String(sale.SaleNumber?.Value || '')} truncate>
              {sale.SaleNumber?.Value}
            </Text>
            <Text className="new-sale-register-row__lifecycle" truncate>
              {sale.IsVatSale ? `(${t('ПДВ')}) ` : ''}
              {t(LIFECYCLE_LABELS[lifecycleKey] || lifecycleKey)}
            </Text>
          </Box>
        </Box>

        <Box className="new-sale-register-row__payment">
          {!isNew && PAYMENT_LABELS[paymentKey] && (
            <Badge color={PAYMENT_COLORS[paymentKey] || 'gray'} size="sm" variant="light">
              {t(PAYMENT_LABELS[paymentKey])}
            </Badge>
          )}
        </Box>

        <Box className="new-sale-register-row__amount">
          <Text className="new-sale-register-row__amount-value">
            {amountFormatter.format(sale.TotalAmountLocal ?? 0)}
          </Text>
          <Text className="new-sale-register-row__amount-code">{currencyCode}</Text>
        </Box>

        <Box className="new-sale-register-row__qty">
          <Text className="new-sale-register-row__qty-value">{sale.TotalCount ?? 0}</Text>
          <Text className="new-sale-register-row__qty-label">{t('штук')}</Text>
        </Box>

        <Box className="new-sale-register-row__date">
          <Text>{formatDateTime(createdDate)}</Text>
          <Text>{userName}</Text>
        </Box>

        <Box className="new-sale-register-row__actions">
          {!hideActions && (
            <Group gap={2} wrap="nowrap">
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
        </Box>
      </Box>
    </Box>
  )
}

function WizardSaleRegistryRowContent({ sale }: { sale: SalesUkraineSale }) {
  const { t } = useI18n()
  const orderItems = Array.isArray(sale.Order?.OrderItems) ? sale.Order.OrderItems : []
  const currencyCode = sale.ClientAgreement?.Agreement?.Currency?.Code || ''
  const totalQty = orderItems.reduce((sum, item) => sum + (item.Qty ?? 0), 0)
  const totalAmount = orderItems.reduce((sum, item) => sum + getOrderItemAmount(item), 0)

  return (
    <Box className="new-sale-register-expanded">
      <Box className="new-sale-register-expanded__panel">
        <Box className="new-sale-register-expanded__header">
          <Group gap={8} wrap="nowrap">
            <Box className="new-sale-register-expanded__header-icon">
              <IconPackage size={16} />
            </Box>
            <Box className="new-sale-register-expanded__header-copy">
              <Text>{t('Склад документа')}</Text>
              <Text>
                {orderItems.length} {t('позицій')}
              </Text>
            </Box>
          </Group>

          <Group className="new-sale-register-expanded__totals" gap={8} justify="flex-end" wrap="nowrap">
            <Box>
              <Text>{t('Сума')}</Text>
              <Text>
                {itemAmountFormatter.format(totalAmount)} {currencyCode}
              </Text>
            </Box>
            <Box>
              <Text>{t('К-сть')}</Text>
              <Text>
                {totalQty} {t('штук')}
              </Text>
            </Box>
          </Group>
        </Box>

        {orderItems.length === 0 ? (
          <Text className="new-sale-register-expanded__empty">{t('Товарів не знайдено')}</Text>
        ) : (
          <Stack className="new-sale-register-expanded__items" gap={0}>
            {orderItems.map((item, index) => {
              const vendorCode = item.Product?.VendorCode || ''
              const originalNumber = item.Product?.MainOriginalNumber || ''
              const productName = item.Product?.Name || t('Товар без назви')
              const createdUser = [item.User?.LastName, item.User?.FirstName].filter(Boolean).join(' ')

              return (
                <Box className="new-sale-register-expanded-item" key={String(item.NetUid || item.Id || index)}>
                  <Box className="new-sale-register-expanded-item__product">
                    <Box className="new-sale-register-expanded-item__icon">
                      <IconPackage size={16} />
                    </Box>
                    <Box className="new-sale-register-expanded-item__copy">
                      <Text className="new-sale-register-expanded-item__name" title={productName}>
                        {productName}
                      </Text>
                      <Group className="new-sale-register-expanded-item__codes" gap={6} wrap="wrap">
                        {vendorCode && (
                          <span>
                            <IconBarcode size={12} />
                            {t('Код виробника')} {vendorCode}
                          </span>
                        )}
                        {originalNumber && (
                          <span>
                            <IconTag size={12} />
                            {t('Ориг. номер')} {originalNumber}
                          </span>
                        )}
                        {!vendorCode && !originalNumber && <span>{t('Коди не вказані')}</span>}
                      </Group>
                    </Box>
                  </Box>

                  <Box className="new-sale-register-expanded-item__stat">
                    <IconCoins size={14} />
                    <Text>{itemAmountFormatter.format(getOrderItemAmount(item))}</Text>
                    <Text>{currencyCode}</Text>
                  </Box>

                  <Box className="new-sale-register-expanded-item__stat">
                    <IconPackage size={14} />
                    <Text>{item.Qty ?? 0}</Text>
                    <Text>{t('штук')}</Text>
                  </Box>

                  <Box className="new-sale-register-expanded-item__date">
                    <IconCalendarTime size={14} />
                    <Box>
                      <Text>{formatDateTime(item.Created)}</Text>
                      {createdUser && <Text>{createdUser}</Text>}
                    </Box>
                  </Box>
                </Box>
              )
            })}
          </Stack>
        )}
      </Box>
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
      <Box className="new-sale-register-row__source">
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
