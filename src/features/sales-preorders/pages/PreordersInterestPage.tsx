import { ActionIcon, Badge, Group, Stack, Text, Title, Tooltip } from '@mantine/core'
import { IconRefresh } from '@tabler/icons-react'
import { useEffect, useMemo } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { getPreorders } from '../api/salesPreordersApi'
import type { PreOrder } from '../types'

const PREORDERS_LIMIT = 30

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
  const [isLoading, setLoading] = useValueState(true)
  const [reloadToken, setReloadToken] = useValueState(0)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)

      try {
        const result = await getPreorders({ limit: PREORDERS_LIMIT, offset: 0 })

        if (!cancelled) {
          setPreOrders(result)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [reloadToken, setLoading, setPreOrders])

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
        cell: (preOrder) => preOrder.Product?.VendorCode || '',
        width: 140,
      },
      {
        id: 'productName',
        header: t('Назва товару'),
        accessor: (preOrder) => preOrder.Product?.NameUA || preOrder.Product?.Name || '',
        cell: (preOrder) => preOrder.Product?.NameUA || preOrder.Product?.Name || '',
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
    <Stack gap="lg">
      <Group justify="space-between" align="center">
        <Title order={3}>{t('Передзамовлення')}</Title>
        <Group gap="sm" align="center">
          <Badge color="gray" variant="light">
            {isLoading ? t('Завантаження') : `${t('Записів')}: ${preOrders.length}`}
          </Badge>
          <Tooltip label={t('Оновити')}>
            <ActionIcon
              aria-label={t('Оновити')}
              color="gray"
              loading={isLoading}
              size="lg"
              variant="subtle"
              onClick={() => setReloadToken((token) => token + 1)}
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      <DataTable
        columns={columns}
        data={preOrders}
        defaultLayout={PREORDERS_TABLE_DEFAULT_LAYOUT}
        emptyText={t('Передзамовлень не знайдено')}
        getRowId={(preOrder, index) => String(preOrder.NetUid || preOrder.Id || index)}
        isLoading={isLoading}
        layoutVersion="sales-preorders-table-1"
        tableId="sales-preorders"
      />
    </Stack>
  )
}
