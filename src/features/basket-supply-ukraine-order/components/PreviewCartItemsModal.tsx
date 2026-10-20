import { TableChip } from '../../../shared/ui/TableChip'
import { Alert, Button, Group, Stack, Text } from '@mantine/core'
import { AppModal, AppModalFooter } from "../../../shared/ui/AppModal"
import { Check, CircleAlert, Upload } from 'lucide-react'
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
  const validCartItems = useMemo(() => toValidCartItems(previewItems), [previewItems])
  const hasErrors = previewItems.some((item) => item.HasError || item.ZeroAvailable || item.LessAvailable || item.NoCartItem)
  const columns = useMemo<Array<DataTableColumn<PreviewCartItem>>>(
    () => [
      {
        id: 'vendorCode',
        header: t('Код Виробника'),
        accessor: (item) => item.Product?.VendorCode || item.SupplyOrderUkraineCartItem?.Product?.VendorCode || '',
        cell: (item) => <TableChip tone="product" value={item.Product?.VendorCode || item.SupplyOrderUkraineCartItem?.Product?.VendorCode} />,
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
        cell: (item) => getPreviewErrorMessage(item, t) || <TableChip tone="success" value={t('Файл валідний')} />,
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
      <Stack className="app-compact-form" gap="md">
        <Alert
          color={hasErrors ? 'red' : 'green'}
          icon={hasErrors ? <CircleAlert size={16} /> : <Check size={16} />}
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

        <AppModalFooter className="app-modal-footer--split">
          <Text c="dimmed" size="sm">
            {t('Готово до завантаження')}: {validCartItems.length}
          </Text>
          <Group gap={8}>
            <Button variant="default" onClick={onClose}>
              {t('Скасувати')}
            </Button>
            <Button
              disabled={validCartItems.length === 0}
              leftSection={<Upload size={16} />}
              onClick={loadValidItems}
            >
              {t('Завантажити')}
            </Button>
          </Group>
        </AppModalFooter>
      </Stack>
    </AppModal>
  )
}

function toValidCartItems(previewItems: PreviewCartItem[]) {
  return previewItems.reduce<SupplyOrderUkraineCartItem[]>((validItems, item) => {
    if (item.ZeroAvailable || item.NoCartItem || !item.SupplyOrderUkraineCartItem) {
      return validItems
    }

    validItems.push({
      ...item.SupplyOrderUkraineCartItem,
      ChangedQty: item.Qty,
      IsFromFile: true,
      IsSelected: false,
    })

    return validItems
  }, [])
}

function getPreviewErrorMessage(item: PreviewCartItem, t: (key: string) => string) {
  if (item.ZeroAvailable) {
    return <TableChip tone="danger" value={t('Немає товарів на складі')} />
  }

  if (item.LessAvailable) {
    return <TableChip tone="warning" value={t('Недостатня кількість на складі')} />
  }

  if (item.NoCartItem) {
    return <TableChip tone="danger" value={t('Немає в корзині')} />
  }

  return null
}
