import { Alert, Badge, Button, Group, Stack, Text } from '@mantine/core'
import { AppModal } from "../../../shared/ui/AppModal"
import { IconAlertCircle, IconCheck, IconUpload } from '@tabler/icons-react'
import { useMemo } from 'react'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import type { PreviewCartItem, SupplyOrderUkraineCartItem } from '../types'

type PreviewCartItemsModalProps = {
  opened: boolean
  previewItems: PreviewCartItem[]
  t: (key: string) => string
  onClose: () => void
  onLoadValidItems: (items: SupplyOrderUkraineCartItem[]) => void
}

const PREVIEW_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['vendorCode'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

export function PreviewCartItemsModal({
  opened,
  previewItems,
  t,
  onClose,
  onLoadValidItems,
}: PreviewCartItemsModalProps) {
  const validCartItems = useMemo(() => {
    return previewItems
      .filter((item) => !item.ZeroAvailable && !item.NoCartItem && item.SupplyOrderUkraineCartItem)
      .map((item) => ({
        ...item.SupplyOrderUkraineCartItem,
        ChangedQty: item.Qty,
        IsFromFile: true,
        IsSelected: false,
      })) as SupplyOrderUkraineCartItem[]
  }, [previewItems])
  const hasErrors = previewItems.some((item) => item.HasError || item.ZeroAvailable || item.LessAvailable || item.NoCartItem)
  const columns = useMemo<Array<DataTableColumn<PreviewCartItem>>>(
    () => [
      {
        id: 'vendorCode',
        header: t('Код Виробника'),
        accessor: (item) => item.Product?.VendorCode || item.SupplyOrderUkraineCartItem?.Product?.VendorCode || '',
        width: 150,
      },
      {
        id: 'availableQty',
        header: t('Доступна К-сть'),
        accessor: (item) => item.AvailableQty ?? '',
        width: 130,
        align: 'right',
      },
      {
        id: 'qty',
        header: t('К-сть'),
        accessor: (item) => item.Qty ?? '',
        width: 130,
        align: 'right',
      },
      {
        id: 'product',
        header: t('Назва товару'),
        accessor: (item) => item.Product?.Name || item.SupplyOrderUkraineCartItem?.Product?.Name || '',
        minWidth: 260,
      },
      {
        id: 'status',
        header: t('Опис'),
        cell: (item) => getPreviewErrorMessage(item, t) || <Badge color="green">{t('Файл валідний')}</Badge>,
        minWidth: 220,
      },
    ],
    [t],
  )

  function loadValidItems() {
    onLoadValidItems(validCartItems)
    onClose()
  }

  return (
    <AppModal centered opened={opened} size="80rem" title={t('Попередній перегляд замовлення')} onClose={onClose}>
      <Stack gap="md">
        <Alert
          color={hasErrors ? 'red' : 'green'}
          icon={hasErrors ? <IconAlertCircle size={16} /> : <IconCheck size={16} />}
          variant="light"
        >
          {hasErrors ? t('Файл містить помилки') : t('Файл валідний')}
        </Alert>

        <DataTable
          columns={columns}
          data={previewItems}
          defaultLayout={PREVIEW_TABLE_DEFAULT_LAYOUT}
          emptyText={t('Даних не знайдено')}
          getRowId={(item, index) => `${item.Product?.VendorCode || item.SupplyOrderUkraineCartItem?.NetUid || index}`}
          maxHeight={520}
          minWidth={900}
          tableId="basket-supply-ukraine-order-preview"
        />

        <Group justify="space-between">
          <Text c="dimmed" size="sm">
            {t('Готово до завантаження')}: {validCartItems.length}
          </Text>
          <Group>
            <Button variant="subtle" onClick={onClose}>
              {t('Скасувати')}
            </Button>
            <Button
              disabled={validCartItems.length === 0}
              leftSection={<IconUpload size={16} />}
              onClick={loadValidItems}
            >
              {t('Завантажити')}
            </Button>
          </Group>
        </Group>
      </Stack>
    </AppModal>
  )
}

function getPreviewErrorMessage(item: PreviewCartItem, t: (key: string) => string) {
  if (item.ZeroAvailable) {
    return <Badge color="red">{t('Немає товарів на складі')}</Badge>
  }

  if (item.LessAvailable) {
    return <Badge color="orange">{t('Недостатня кількість на складі')}</Badge>
  }

  if (item.NoCartItem) {
    return <Badge color="red">{t('Немає в корзині')}</Badge>
  }

  return null
}
