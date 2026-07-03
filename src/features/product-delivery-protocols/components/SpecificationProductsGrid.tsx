import { ActionIcon, Anchor, Badge, Group, Text, Tooltip } from '@mantine/core'
import { IconEdit } from '@tabler/icons-react'
import { useMemo } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import type {
  PackingListPackageOrderItem,
  PackingListPackageOrderItemSupplyService,
  SpecificationPackingList,
} from '../specificationTypes'
import { getLatestProductSpecificationFromList } from '../productSpecificationLatest'

type SpecificationRow = {
  customsValue: number
  duty: number
  dutyPercent: number
  grossWeight: number
  index: number
  item: PackingListPackageOrderItem
  measureUnit: string
  name: string
  netPrice: number
  netWeight: number
  productNetId: string
  qty: number
  serviceValues: Record<string, number>
  specificationCode: string
  isImported: boolean
  totalAccountingGrossPrice: number
  totalAccountingGrossPriceEur: number
  totalGrossPrice: number
  totalGrossPriceEur: number
  unitPrice: number
  vatPercent: number
  vatValue: number
  deliveryAmountEur: number
  deliveryAmountUah: number
  vendorCode: string
}

type ServiceColumn = {
  id: string
  name: string
}

type SpecificationProductsGridProps = {
  canEditSpecification?: boolean
  currencyIsEur: boolean
  invoiceDeliveryAmount?: number
  onEditSpecification?: (item: PackingListPackageOrderItem) => void
  onOpenProductCard?: (productNetId: string) => void
  packingList: SpecificationPackingList
  withManagementServices: boolean
}

const priceFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

const weightFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 3,
  minimumFractionDigits: 0,
})

export function SpecificationProductsGrid({
  canEditSpecification = false,
  currencyIsEur,
  invoiceDeliveryAmount,
  onEditSpecification,
  onOpenProductCard,
  packingList,
  withManagementServices,
}: SpecificationProductsGridProps) {
  const { t } = useI18n()
  const items = useMemo(() => packingList.PackingListPackageOrderItems || [], [packingList])
  const hasDeliveryAmount =
    invoiceDeliveryAmount === undefined
      ? items.some((item) => (item.DeliveryAmountUah || 0) > 0 || (item.DeliveryAmountEur || 0) > 0)
      : (invoiceDeliveryAmount || 0) > 0

  const { netServiceColumns, generalServiceColumns, managementServiceColumns } = useMemo(
    () => buildServiceColumns(items, currencyIsEur),
    [currencyIsEur, items],
  )

  const rows = useMemo(
    () => items.map((item, index) => buildRow(item, index, currencyIsEur)),
    [currencyIsEur, items],
  )

  const columns = useMemo<DataTableColumn<SpecificationRow>[]>(() => {
    const baseColumns: DataTableColumn<SpecificationRow>[] = [
      {
        id: 'index',
        header: '#',
        width: 56,
        minWidth: 48,
        align: 'right',
        enableSorting: false,
        enableHiding: false,
        accessor: (row) => row.index,
        cell: (row) => (
          <Text c="dimmed" size="sm">
            {row.index}
          </Text>
        ),
      },
      {
        id: 'vendorCode',
        header: t('Код товару'),
        width: 110,
        minWidth: 90,
        accessor: (row) => row.vendorCode,
        cell: (row) =>
          onOpenProductCard && row.productNetId ? (
            <Anchor
              component="button"
              fw={600}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onOpenProductCard(row.productNetId)
              }}
            >
              {displayText(row.vendorCode)}
            </Anchor>
          ) : (
            <Text fw={600}>{displayText(row.vendorCode)}</Text>
          ),
      },
      {
        id: 'name',
        header: t('Назва товару'),
        minWidth: 220,
        accessor: (row) => row.name,
        cell: (row) =>
          onOpenProductCard && row.productNetId ? (
            <Anchor
              component="button"
              size="sm"
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onOpenProductCard(row.productNetId)
              }}
            >
              {displayText(row.name)}
            </Anchor>
          ) : (
            <Text size="sm" lineClamp={2}>
              {displayText(row.name)}
            </Text>
          ),
      },
      {
        id: 'specificationCode',
        header: t('Митний код'),
        width: 140,
        minWidth: 110,
        accessor: (row) => row.specificationCode,
        cell: (row) => (
          <Group gap={6} wrap="nowrap">
            <Text size="sm">{displayText(row.specificationCode)}</Text>
            {canEditSpecification && onEditSpecification && (
              <Tooltip label={t('Редагувати')}>
                <ActionIcon
                  aria-label={t('Редагувати митний код')}
                  color="gray"
                  size="sm"
                  variant="subtle"
                  onClick={(event) => {
                    event.stopPropagation()
                    onEditSpecification(row.item)
                  }}
                >
                  <IconEdit size={16} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        ),
      },
      {
        id: 'qty',
        header: t('К-сть'),
        width: 80,
        minWidth: 60,
        align: 'right',
        accessor: (row) => row.qty,
        cell: (row) => displayNumber(row.qty),
      },
      {
        id: 'measureUnit',
        header: t('Одиниця виміру'),
        width: 90,
        minWidth: 70,
        accessor: (row) => row.measureUnit,
        cell: (row) => displayText(row.measureUnit),
      },
      {
        id: 'unitPrice',
        header: `${t('Ціна Нетто')} (${t('Інвойса')})`,
        width: 170,
        minWidth: 140,
        align: 'right',
        accessor: (row) => row.unitPrice,
        cell: (row) => formatPrice(row.unitPrice),
      },
      {
        id: 'netPrice',
        header: `${t('Сума нетто')} (${t('Інвойса')})`,
        width: 160,
        minWidth: 130,
        align: 'right',
        accessor: (row) => row.netPrice,
        cell: (row) => formatPrice(row.netPrice),
      },
      {
        id: 'isImported',
        header: t('Імпорт'),
        width: 90,
        minWidth: 70,
        align: 'center',
        accessor: (row) => row.isImported,
        cell: (row) =>
          row.isImported ? (
            <Badge className="app-role-pill" variant="light">
              {t('Так')}
            </Badge>
          ) : (
            <Text c="dimmed" size="sm">
              -
            </Text>
          ),
      },
      {
        id: 'netWeight',
        header: t('Вага Нетто'),
        width: 130,
        minWidth: 100,
        align: 'right',
        accessor: (row) => row.netWeight,
        cell: (row) => formatWeight(row.netWeight),
      },
      {
        id: 'grossWeight',
        header: t('Вага Брутто'),
        width: 130,
        minWidth: 100,
        align: 'right',
        accessor: (row) => row.grossWeight,
        cell: (row) => formatWeight(row.grossWeight),
      },
      {
        id: 'customsValue',
        header: t('Митна вартість'),
        width: 130,
        minWidth: 100,
        align: 'right',
        accessor: (row) => row.customsValue,
        cell: (row) => displayNumber(row.customsValue),
      },
      {
        id: 'dutyPercent',
        header: `% ${t('Мита')}`,
        width: 90,
        minWidth: 70,
        align: 'right',
        accessor: (row) => row.dutyPercent,
        cell: (row) => displayNumber(row.dutyPercent),
      },
      {
        id: 'duty',
        header: t('Мито'),
        width: 90,
        minWidth: 70,
        align: 'right',
        accessor: (row) => row.duty,
        cell: (row) => displayNumber(row.duty),
      },
      {
        id: 'vatPercent',
        header: `% ${t('ПДВ')}`,
        width: 90,
        minWidth: 70,
        align: 'right',
        accessor: (row) => row.vatPercent,
        cell: (row) => displayNumber(row.vatPercent),
      },
      {
        id: 'vatValue',
        header: t('ПДВ'),
        width: 90,
        minWidth: 70,
        align: 'right',
        accessor: (row) => row.vatValue,
        cell: (row) => displayNumber(row.vatValue),
      },
    ]

    const accountingServiceColumns = [...netServiceColumns, ...generalServiceColumns]
    const serviceColumns: DataTableColumn<SpecificationRow>[] = accountingServiceColumns.map((service) =>
      buildServiceColumn(service),
    )

    if (withManagementServices) {
      managementServiceColumns.forEach((service) => serviceColumns.push(buildServiceColumn(service)))
    }

    const totalColumns: DataTableColumn<SpecificationRow>[] = []

    if (hasDeliveryAmount) {
      totalColumns.push({
        id: 'deliveryAmount',
        header: t('Сума доставки'),
        width: 120,
        minWidth: 90,
        align: 'right',
        accessor: (row) => (currencyIsEur ? row.deliveryAmountEur : row.deliveryAmountUah),
        cell: (row) => formatPrice(currencyIsEur ? row.deliveryAmountEur : row.deliveryAmountUah),
      })
    }

    totalColumns.push({
      id: 'accountingGrossPrice',
      header: `${t('Сума брутто БО')} (${currencyIsEur ? t('EUR') : t('UAH')})`,
      width: 180,
      minWidth: 140,
      align: 'right',
      accessor: (row) => (currencyIsEur ? row.totalAccountingGrossPriceEur : row.totalAccountingGrossPrice),
      cell: (row) => formatPrice(currencyIsEur ? row.totalAccountingGrossPriceEur : row.totalAccountingGrossPrice),
    })

    if (withManagementServices) {
      totalColumns.push({
        id: 'grossPrice',
        header: `${t('Сума брутто УО')} (${currencyIsEur ? t('EUR') : t('UAH')})`,
        width: 180,
        minWidth: 140,
        align: 'right',
        accessor: (row) => (currencyIsEur ? row.totalGrossPriceEur : row.totalGrossPrice),
        cell: (row) => formatPrice(currencyIsEur ? row.totalGrossPriceEur : row.totalGrossPrice),
      })
    }

    return [...baseColumns, ...serviceColumns, ...totalColumns]
  }, [
    currencyIsEur,
    canEditSpecification,
    generalServiceColumns,
    hasDeliveryAmount,
    managementServiceColumns,
    netServiceColumns,
    onEditSpecification,
    onOpenProductCard,
    t,
    withManagementServices,
  ])

  return (
    <DataTable
      columns={columns}
      data={rows}
      emptyText={t('Немає даних')}
      getRowId={(row) => String(row.item.NetUid || row.item.Id || row.index)}
      layoutVersion="protocol-specification-grid-1"
      maxHeight="calc(100vh - 420px)"
      minWidth={1600}
      tableId="protocol-specification-grid"
    />
  )
}

function buildServiceColumn(service: ServiceColumn): DataTableColumn<SpecificationRow> {
  return {
    id: service.id,
    header: service.name,
    width: 220,
    minWidth: 160,
    align: 'right',
    enableSorting: false,
    accessor: (row) => row.serviceValues[service.id] || 0,
    cell: (row) => formatPrice(row.serviceValues[service.id] || 0),
  }
}

function buildServiceColumns(items: PackingListPackageOrderItem[], currencyIsEur: boolean) {
  const netServiceColumns: ServiceColumn[] = []
  const generalServiceColumns: ServiceColumn[] = []
  const managementServiceColumns: ServiceColumn[] = []
  const seen = new Set<string>()

  items.forEach((item) => {
    const services = item.PackingListPackageOrderItemSupplyServices || []

    services.forEach((service, index) => {
      if (service.NetValue) {
        const id = buildServiceColumnId(service, 'net', index)

        if (!seen.has(id)) {
          seen.add(id)
          netServiceColumns.push({
            id,
            name: buildServiceName(service, 'net', currencyIsEur),
          })
        }
      } else if (service.GeneralValue) {
        const id = buildServiceColumnId(service, 'general', index)

        if (!seen.has(id)) {
          seen.add(id)
          generalServiceColumns.push({
            id,
            name: buildServiceName(service, 'general', currencyIsEur),
          })
        }
      }

      if (service.ManagementValue) {
        const id = buildServiceColumnId(service, 'management', index)

        if (!seen.has(id)) {
          seen.add(id)
          managementServiceColumns.push({
            id,
            name: buildServiceName(service, 'management', currencyIsEur),
          })
        }
      }
    })
  })

  return { generalServiceColumns, managementServiceColumns, netServiceColumns }
}

function buildServiceColumnId(
  service: PackingListPackageOrderItemSupplyService,
  kind: 'general' | 'management' | 'net',
  fallbackIndex: number,
): string {
  const sourceKey =
    getEntityKey(service.MergedService, 'merged') ||
    getEntityKey(service.BillOfLadingService, 'bill-of-lading') ||
    getEntityKey(service.ContainerService, 'container') ||
    getEntityKey(service.VehicleService, 'vehicle') ||
    service.Name ||
    getEntityKey(service, 'service') ||
    String(fallbackIndex)

  return `service-${kind}-${sourceKey}`
}

function getEntityKey(entity: EntityWithKey | null | undefined, prefix: string): string {
  if (!entity) {
    return ''
  }

  return entity.NetUid ? `${prefix}-${entity.NetUid}` : entity.Id ? `${prefix}-${entity.Id}` : ''
}

function buildServiceName(
  service: PackingListPackageOrderItemSupplyService,
  kind: 'general' | 'management' | 'net',
  currencyIsEur: boolean,
): string {
  let name = service.Name || ''

  const source =
    service.MergedService?.ConsumableProduct?.Name ||
    service.BillOfLadingService?.SupplyOrganization?.Name ||
    service.ContainerService?.ContainerOrganization?.Name ||
    service.VehicleService?.VehicleOrganization?.Name

  if (source) {
    name = `${source} `

    const totalValue = currencyIsEur
      ? kind === 'net'
        ? service.TotalNetPriceForServiceEur
        : kind === 'general'
        ? service.TotalGeneralPriceForServiceEur
        : service.TotalManagementPriceForServiceEur
      : kind === 'net'
      ? service.TotalNetPriceForServiceUah
      : kind === 'general'
      ? service.TotalGeneralPriceForServiceUah
      : service.TotalManagementPriceForServiceUah

    name += priceFormatter.format(totalValue || 0)
  }

  return `${name} ${currencyIsEur ? 'EUR' : 'UAH'}`.trim()
}

function buildRow(item: PackingListPackageOrderItem, index: number, currencyIsEur: boolean): SpecificationRow {
  const product = item.SupplyInvoiceOrderItem?.Product
  const lastSpecification = getLatestProductSpecificationFromList(product?.ProductSpecifications)
  const services = item.PackingListPackageOrderItemSupplyServices || []
  const serviceValues: Record<string, number> = {}

  services.forEach((service, serviceIndex) => {
    if (service.NetValue) {
      addServiceValue(
        serviceValues,
        buildServiceColumnId(service, 'net', serviceIndex),
        currencyIsEur ? service.NetValueEur || 0 : service.NetValueUah || 0,
      )
    } else if (service.GeneralValue) {
      addServiceValue(
        serviceValues,
        buildServiceColumnId(service, 'general', serviceIndex),
        currencyIsEur ? service.GeneralValueEur || 0 : service.GeneralValueUah || 0,
      )
    }

    if (service.ManagementValue) {
      addServiceValue(
        serviceValues,
        buildServiceColumnId(service, 'management', serviceIndex),
        currencyIsEur ? service.ManagementValueEur || 0 : service.ManagementValueUah || 0,
      )
    }
  })

  return {
    customsValue: lastSpecification?.CustomsValue || 0,
    deliveryAmountEur: item.DeliveryAmountEur || 0,
    deliveryAmountUah: item.DeliveryAmountUah || 0,
    duty: lastSpecification?.Duty || 0,
    dutyPercent: lastSpecification?.DutyPercent || 0,
    grossWeight: roundTo(item.TotalGrossWeight || 0, 1000),
    index: index + 1,
    isImported: Boolean(item.ProductIsImported),
    item,
    measureUnit: product?.MeasureUnit?.Name || '',
    name: product?.Name || '',
    netPrice: item.TotalNetPrice || 0,
    netWeight: roundTo(item.TotalNetWeight || 0, 1000),
    productNetId: product?.NetUid || '',
    qty: item.Qty || 0,
    serviceValues,
    specificationCode: lastSpecification?.SpecificationCode || '',
    totalAccountingGrossPrice: roundTo(item.AccountingTotalGrossPrice || 0, 100),
    totalAccountingGrossPriceEur: roundTo(item.AccountingTotalGrossPriceEur || 0, 100),
    totalGrossPrice: roundTo(item.TotalGrossPrice || 0, 100),
    totalGrossPriceEur: roundTo(item.TotalGrossPriceEur || 0, 100),
    unitPrice: item.UnitPrice || 0,
    vatPercent: lastSpecification?.VATPercent || 0,
    vatValue: lastSpecification?.VATValue || 0,
    vendorCode: product?.VendorCode || '',
  }
}

type EntityWithKey = {
  Id?: number
  NetUid?: string
}

function addServiceValue(values: Record<string, number>, id: string, value: number) {
  values[id] = (values[id] || 0) + value
}

function roundTo(value: number, factor: number): number {
  return Math.round(value * factor) / factor
}

function formatPrice(value: number): string {
  return priceFormatter.format(value || 0)
}

function formatWeight(value: number): string {
  return weightFormatter.format(value || 0)
}

function displayNumber(value: number): string {
  return String(value ?? 0)
}

function displayText(value: string): string {
  return value ? value : '-'
}
