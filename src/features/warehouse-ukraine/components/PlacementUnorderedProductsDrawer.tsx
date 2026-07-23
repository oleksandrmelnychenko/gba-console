import {
  Box,
  Button,
  Group,
  Loader,
  NumberInput,
  ScrollArea,
  Stack,
  Table,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { Plus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { TableRowAction } from '../../../shared/ui/table-row-action'
import { searchPlacementProducts, updateSupplyOrderUkraine } from '../api/orderPlacementsApi'
import type { PlacementOrderItem, PlacementProduct, PlacementSupplyOrder } from '../placementsTypes'

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'
const numberFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3, minimumFractionDigits: 0 })

export function PlacementUnorderedProductsDrawer({
  order,
  opened,
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: (order: PlacementSupplyOrder) => void
  opened: boolean
  order: PlacementSupplyOrder | null
}) {
  const { t } = useI18n()

  return (
    <AppDrawer
      opened={opened}
      position="right"
      size="min(960px, 100vw)"
      title={t('Інший товар / більша кількість')}
      onClose={onClose}
    >
      {order && <PlacementUnorderedProductsContent order={order} onSaved={onSaved} />}
    </AppDrawer>
  )
}

function PlacementUnorderedProductsContent({
  order,
  onSaved,
}: {
  onSaved: (order: PlacementSupplyOrder) => void
  order: PlacementSupplyOrder
}) {
  const { t } = useI18n()
  const items = Array.isArray(order.SupplyOrderUkraineItems) ? order.SupplyOrderUkraineItems : []
  const unorderedItems = items.filter((item) => item.NotOrdered)
  const [isSaving, setSaving] = useState(false)
  const [isAdding, setAdding] = useState(false)

  async function persist(nextItems: PlacementOrderItem[]) {
    setSaving(true)

    try {
      const updated = await updateSupplyOrderUkraine({ ...order, SupplyOrderUkraineItems: nextItems })
      notifications.show({ color: 'green', message: t('Збережено') })
      onSaved(updated)
      setAdding(false)
    } catch {
      notifications.show({ color: 'red', message: t('Не вдалося зберегти') })
    } finally {
      setSaving(false)
    }
  }

  async function addItem(product: PlacementProduct, qty: number, unitPrice: number, netWeight: number) {
    const newItem: PlacementOrderItem = {
      Id: 0,
      NetUid: EMPTY_GUID,
      Deleted: false,
      NotOrdered: true,
      Product: product,
      ProductId: product.Id,
      Qty: qty,
      UnitPrice: unitPrice,
      NetWeight: netWeight,
    }

    await persist([...items, newItem])
  }

  async function deleteItem(target: PlacementOrderItem) {
    await persist(items.filter((item) => item !== target))
  }

  return (
    <Stack gap="md">
      <ScrollArea.Autosize mah="calc(100vh - 280px)" type="auto">
        <Table withColumnBorders highlightOnHover horizontalSpacing="sm" stickyHeader verticalSpacing={6}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={48}>#</Table.Th>
              <Table.Th>{t('Код Виробника')}</Table.Th>
              <Table.Th>{t('Назва')}</Table.Th>
              <Table.Th ta="right">{t('К-сть')}</Table.Th>
              <Table.Th ta="right">{t('Ціна')}</Table.Th>
              <Table.Th ta="right">{t('Вага Нетто')}</Table.Th>
              <Table.Th w={56} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {unorderedItems.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={7}>
                  <Text c="dimmed" size="sm" ta="center" py="sm">
                    {t('Немає позицій')}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              unorderedItems.map((item, index) => (
                <Table.Tr key={String(item.NetUid || item.Id || index)}>
                  <Table.Td>{index + 1}</Table.Td>
                  <Table.Td>{displayValue(item.Product?.VendorCode)}</Table.Td>
                  <Table.Td>{displayValue(item.Product?.NameUA || item.Product?.Name)}</Table.Td>
                  <Table.Td ta="right">{formatNumber(item.Qty)}</Table.Td>
                  <Table.Td ta="right">{formatNumber(item.UnitPrice)}</Table.Td>
                  <Table.Td ta="right">{formatNumber(item.NetWeight)}</Table.Td>
                  <Table.Td>
                    <TableRowAction
                      action="delete"
                      disabled={isSaving}
                      label={t('Видалити')}
                      onClick={() => deleteItem(item)}
                    />
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </ScrollArea.Autosize>

      {isAdding ? (
        <AddUnorderedProductForm isSaving={isSaving} onCancel={() => setAdding(false)} onCreate={addItem} />
      ) : (
        <Group justify="flex-end">
          <Button leftSection={<Plus size={16} />} variant="outline" onClick={() => setAdding(true)}>
            {t('Додати товар')}
          </Button>
        </Group>
      )}
    </Stack>
  )
}

function AddUnorderedProductForm({
  isSaving,
  onCancel,
  onCreate,
}: {
  isSaving: boolean
  onCancel: () => void
  onCreate: (product: PlacementProduct, qty: number, unitPrice: number, netWeight: number) => void
}) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlacementProduct[]>([])
  const [isSearching, setSearching] = useState(false)
  const [selected, setSelected] = useState<PlacementProduct | null>(null)
  const [qty, setQty] = useState<number | string>('')
  const [unitPrice, setUnitPrice] = useState<number | string>('')
  const [netWeight, setNetWeight] = useState<number | string>('')

  const numericQty = toNumber(qty)
  const isValid = Boolean(selected) && numericQty > 0

  useEffect(() => {
    const value = query.trim()

    if (value.length < 2) {
      return
    }

    let cancelled = false
    const handle = setTimeout(async () => {
      setSearching(true)

      try {
        const next = await searchPlacementProducts(value)

        if (!cancelled) {
          setResults(next)
        }
      } catch {
        if (!cancelled) {
          setResults([])
        }
      } finally {
        if (!cancelled) {
          setSearching(false)
        }
      }
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [query])

  function create() {
    if (!selected || !isValid) {
      notifications.show({ color: 'red', message: t('Оберіть товар і кількість') })

      return
    }

    onCreate(selected, numericQty, toNumber(unitPrice), toNumber(netWeight))
  }

  return (
    <Stack gap="sm">
      <TextInput
        autoFocus
        label={t('Пошук по товару')}
        leftSection={<Search size={16} />}
        placeholder={t('Код Виробника')}
        rightSection={isSearching ? <Loader size="xs" /> : null}
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
      />

      {!selected && (
        <ScrollArea.Autosize mah={220}>
          <Stack gap={4}>
            {results.length === 0 ? (
              <Text c="dimmed" size="sm">
                {query.trim().length < 2 ? t('Введіть мінімум 2 символи') : t('Нічого не знайдено')}
              </Text>
            ) : (
              results.map((product, index) => (
                <UnstyledButton
                  key={product.Id || index}
                  p="xs"
                  style={{ borderRadius: 6 }}
                  onClick={() => setSelected(product)}
                >
                  <Text fw={600} size="sm">
                    {displayValue(product.VendorCode)}
                  </Text>
                  <Text c="dimmed" size="xs">
                    {displayValue(product.NameUA || product.Name)}
                  </Text>
                </UnstyledButton>
              ))
            )}
          </Stack>
        </ScrollArea.Autosize>
      )}

      {selected && (
        <Box>
          <Group justify="space-between" wrap="nowrap">
            <Box>
              <Text fw={600} size="sm">
                {displayValue(selected.VendorCode)}
              </Text>
              <Text c="dimmed" size="xs">
                {displayValue(selected.NameUA || selected.Name)}
              </Text>
            </Box>
            <Button color="gray" size="xs" variant="subtle" onClick={() => setSelected(null)}>
              {t('Змінити')}
            </Button>
          </Group>
        </Box>
      )}

      <Group grow>
        <NumberInput
          allowNegative={false}
          decimalScale={2}
          label={t('Кількість')}
          min={0}
          value={qty}
          onChange={setQty}
        />
        <NumberInput
          allowNegative={false}
          decimalScale={2}
          label={t('Ціна')}
          min={0}
          value={unitPrice}
          onChange={setUnitPrice}
        />
        <NumberInput
          allowNegative={false}
          decimalScale={3}
          label={t('Вага Нетто')}
          min={0}
          value={netWeight}
          onChange={setNetWeight}
        />
      </Group>

      <Group justify="flex-end">
        <Button color="gray" disabled={isSaving} variant="subtle" onClick={onCancel}>
          {t('Скасувати')}
        </Button>
        <Button disabled={!isValid} loading={isSaving} onClick={create}>
          {t('Створити')}
        </Button>
      </Group>
    </Stack>
  )
}

function toNumber(value: number | string): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  const parsed = Number(String(value).replace(',', '.'))

  return Number.isFinite(parsed) ? parsed : 0
}

function formatNumber(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? numberFormatter.format(value) : '—'
}

function displayValue(value?: string | null): string {
  return value?.trim() || '—'
}
