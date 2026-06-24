import { ActionIcon, Anchor, Button, Card, Center, Stack, Text, Tooltip } from '@mantine/core'
import { IconRefresh } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import { DataTableDensityToggle } from '../../../shared/ui/data-table/DataTableDensityToggle'
import { useDataTableDensity } from '../../../shared/ui/data-table/useDataTableDensity'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { ProductCardModal } from '../../products/components/ProductCardModal'
import { getPreorders } from '../api/salesPreordersApi'
import type { PreOrder } from '../types'
import './preorders-interest-page.css'

const PREORDERS_PAGE_SIZE = 30

const PREORDERS_TABLE_DEFAULT_LAYOUT = {
  density: 'normal',
} satisfies DataTableDefaultLayout

function composeContact(preOrder: PreOrder): string {
  const client = preOrder.Client

  if (client?.FullName?.trim()) {
    return client.FullName.trim()
  }

  if (client) {
    const composed = [client.LastName, client.FirstName, client.MiddleName]
      .map((part) => part?.trim())
      .filter((part) => part)
      .join(' ')

    if (composed) {
      return composed
    }

    if (client.MobileNumber?.trim()) {
      return client.MobileNumber.trim()
    }
  }

  return preOrder.MobileNumber?.trim() || ''
}

function formatCreated(value: string | null | undefined): { date: string; time: string } {
  if (!value) {
    return { date: '', time: '' }
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return { date: '', time: '' }
  }

  const day = String(parsed.getDate()).padStart(2, '0')
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const year = parsed.getFullYear()
  const hours = String(parsed.getHours()).padStart(2, '0')
  const minutes = String(parsed.getMinutes()).padStart(2, '0')

  return { date: `${day}.${month}.${year}`, time: `${hours}:${minutes}` }
}

export function PreordersInterestPage() {
  const { t } = useI18n()
  const [preOrders, setPreOrders] = useValueState<PreOrder[]>([])
  const [offset, setOffset] = useValueState(0)
  const [isLoading, setLoading] = useValueState(true)
  const [isLoadingMore, setLoadingMore] = useValueState(false)
  const [hasMore, setHasMore] = useValueState(false)
  const [reloadToken, setReloadToken] = useValueState(0)
  const [productCardNetId, setProductCardNetId] = useState<string | null>(null)
  const { density, toggleDensity } = useDataTableDensity('sales-preorders', PREORDERS_TABLE_DEFAULT_LAYOUT.density)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (offset === 0) {
        setLoading(true)
      } else {
        setLoadingMore(true)
      }

      try {
        const result = await getPreorders({ limit: PREORDERS_PAGE_SIZE, offset })

        if (!cancelled) {
          setPreOrders((previous) => (offset === 0 ? result : [...previous, ...result]))
          setHasMore(result.length === PREORDERS_PAGE_SIZE)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
          setLoadingMore(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [offset, reloadToken, setHasMore, setLoading, setLoadingMore, setPreOrders])

  const refresh = () => {
    setOffset(0)
    setReloadToken((token) => token + 1)
  }

  const loadMore = () => {
    setOffset((current) => current + PREORDERS_PAGE_SIZE)
  }

  const columns = useMemo<DataTableColumn<PreOrder>[]>(
    () => [
      {
        id: 'contact',
        header: t('Контакт'),
        accessor: (preOrder) => composeContact(preOrder),
        cell: (preOrder) => composeContact(preOrder),
        minWidth: 200,
      },
      {
        id: 'created',
        header: t('Дата'),
        accessor: (preOrder) => preOrder.Created || '',
        cell: (preOrder) => {
          const { date, time } = formatCreated(preOrder.Created)

          return (
            <Stack gap={0}>
              <Text size="sm">{date}</Text>
              <Text c="dimmed" size="xs">
                {time}
              </Text>
            </Stack>
          )
        },
        width: 120,
      },
      {
        id: 'vendorCode',
        header: t('Код Виробника'),
        accessor: (preOrder) => preOrder.Product?.VendorCode || '',
        cell: (preOrder) => {
          const netId = preOrder.Product?.NetUid
          const code = preOrder.Product?.VendorCode || ''

          return netId && code ? (
            <Anchor
              component="button"
              fw={600}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setProductCardNetId(netId)
              }}
            >
              {code}
            </Anchor>
          ) : (
            code
          )
        },
        width: 140,
      },
      {
        id: 'productName',
        header: t('Назва товару'),
        accessor: (preOrder) => preOrder.Product?.NameUA || preOrder.Product?.Name || '',
        cell: (preOrder) => {
          const netId = preOrder.Product?.NetUid
          const name = preOrder.Product?.NameUA || preOrder.Product?.Name || ''

          return netId && name ? (
            <Anchor
              component="button"
              size="sm"
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setProductCardNetId(netId)
              }}
            >
              {name}
            </Anchor>
          ) : (
            name
          )
        },
        minWidth: 240,
      },
      {
        id: 'comment',
        header: t('Коментар'),
        accessor: (preOrder) => preOrder.Comment || '',
        cell: (preOrder) => preOrder.Comment || '',
        minWidth: 200,
      },
      {
        id: 'qty',
        header: t('К-сть'),
        accessor: (preOrder) => preOrder.Qty ?? 0,
        cell: (preOrder) => preOrder.Qty ?? 0,
        align: 'right',
        width: 90,
      },
    ],
    [t],
  )

  return (
    <Stack className="preorders-interest-page" gap={6}>
      <Card className="app-data-card" withBorder radius="md" padding={0}>
        <div className="app-filter-bar">
          <div className="app-filter-actions">
            <Tooltip label={t('Оновити')}>
              <ActionIcon
                aria-label={t('Оновити')}
                color="gray"
                loading={isLoading}
                size={34}
                variant="light"
                onClick={refresh}
              >
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
            <DataTableDensityToggle density={density} onToggle={toggleDensity} size={34} />
          </div>
        </div>

        <div className="preorders-interest-page__table">
          <DataTable
            columns={columns}
            data={preOrders}
            defaultLayout={PREORDERS_TABLE_DEFAULT_LAYOUT}
            density={density}
            emptyText={t('Передзамовлень не знайдено')}
            getRowId={(preOrder, index) => String(preOrder.NetUid || preOrder.Id || index)}
            height="100%"
            isLoading={isLoading}
            layoutVersion="sales-preorders-table-1"
            tableId="sales-preorders"
          />
        </div>

        {hasMore && (
          <Center p="md">
            <Button
              color="gray"
              loading={isLoadingMore}
              variant="light"
              onClick={loadMore}
            >
              {t('Завантажити ще')}
            </Button>
          </Center>
        )}
      </Card>

      <ProductCardModal productNetId={productCardNetId} onClose={() => setProductCardNetId(null)} />
    </Stack>
  )
}
