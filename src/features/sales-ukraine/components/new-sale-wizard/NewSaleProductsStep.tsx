import { ActionIcon, Anchor, Box, Group, Loader, NumberInput, ScrollArea, Stack, Table, Text, TextInput, Tooltip, UnstyledButton } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconSearch, IconTrash } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { ProductCardModal } from '../../../products/components/ProductCardModal'
import { addOrderItem, deleteOrderItem, searchSaleProducts, updateOrderItem } from '../../api/salesUkraineApi'
import type { SalesUkraineProduct, SalesUkraineSale } from '../../types'

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'
const amountFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })

export function NewSaleProductsStep({
  agreementNetId,
  sale,
  onCartChanged,
}: {
  agreementNetId: string | null
  onCartChanged: () => void
  sale: SalesUkraineSale | null
}) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SalesUkraineProduct[]>([])
  const [isSearching, setSearching] = useState(false)
  const [busy, setBusy] = useState(false)
  const [productCardNetId, setProductCardNetId] = useState<string | null>(null)

  const orderItems = Array.isArray(sale?.Order?.OrderItems) ? sale.Order.OrderItems : []
  const localCurrencyCode = sale?.ClientAgreement?.Agreement?.Currency?.Code || ''

  useEffect(() => {
    const value = query.trim()

    if (value.length < 2) {
      return
    }

    let cancelled = false
    const handle = setTimeout(async () => {
      setSearching(true)

      try {
        const next = await searchSaleProducts(value)

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

  async function addProduct(product: SalesUkraineProduct) {
    if (!agreementNetId || !sale?.NetUid) {
      return
    }

    setBusy(true)

    const existing = orderItems.find((item) => item.Product?.NetUid === product.NetUid)

    try {
      if (existing) {
        await updateOrderItem({ ...existing, Qty: (getNumber(existing.Qty) || 0) + 1 })
      } else {
        await addOrderItem(agreementNetId, sale.NetUid, { Deleted: false, Id: 0, NetUid: EMPTY_GUID, Product: product, Qty: 1 })
      }

      onCartChanged()
    } catch {
      notifications.show({ color: 'red', message: t('Не вдалося додати товар') })
    } finally {
      setBusy(false)
    }
  }

  async function changeQty(netId: string | undefined, item: (typeof orderItems)[number], qty: number) {
    if (!netId || !Number.isFinite(qty) || qty <= 0) {
      return
    }

    setBusy(true)

    try {
      await updateOrderItem({ ...item, Qty: qty })
      onCartChanged()
    } catch {
      notifications.show({ color: 'red', message: t('Не вдалося оновити кількість') })
    } finally {
      setBusy(false)
    }
  }

  async function removeItem(netId: string | undefined) {
    if (!netId) {
      return
    }

    setBusy(true)

    try {
      await deleteOrderItem(netId)
      onCartChanged()
    } catch {
      notifications.show({ color: 'red', message: t('Не вдалося видалити товар') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Group align="flex-start" gap="md" wrap="nowrap" style={{ minHeight: 360 }}>
      <Stack gap="xs" style={{ flex: '0 0 360px' }}>
        <TextInput
          autoFocus
          label={t('Пошук по товару')}
          leftSection={<IconSearch size={16} />}
          placeholder={t('Код Виробника')}
          rightSection={isSearching ? <Loader size="xs" /> : null}
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
        <ScrollArea.Autosize mah={360}>
          <Stack gap={4}>
            {results.length === 0 ? (
              <Text c="dimmed" size="sm">
                {query.trim().length < 2 ? t('Введіть мінімум 2 символи') : t('Нічого не знайдено')}
              </Text>
            ) : (
              results.map((product, index) => (
                <UnstyledButton
                  key={product.NetUid || product.Id || index}
                  disabled={busy}
                  p="xs"
                  style={{ borderRadius: 6 }}
                  onClick={() => addProduct(product)}
                >
                  <Text fw={600} size="sm">
                    {product.VendorCode || product.Articul || '—'}
                  </Text>
                  <Text c="dimmed" size="xs">
                    {product.NameUA || product.Name || ''}
                  </Text>
                </UnstyledButton>
              ))
            )}
          </Stack>
        </ScrollArea.Autosize>
      </Stack>

      <Box style={{ flex: 1, minWidth: 0 }}>
        <ScrollArea.Autosize mah={420} type="auto">
          <Table withColumnBorders highlightOnHover stickyHeader verticalSpacing={6}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('Код Виробника')}</Table.Th>
                <Table.Th>{t('Назва товару')}</Table.Th>
                <Table.Th ta="right">{t('Ціна')}</Table.Th>
                <Table.Th ta="right" style={{ minWidth: 110 }}>{t('К-сть')}</Table.Th>
                <Table.Th ta="right">{t('Сума')}</Table.Th>
                <Table.Th w={48} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {orderItems.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={6}>
                    <Text c="dimmed" size="sm" ta="center" py="sm">
                      {t('Кошик порожній')}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                orderItems.map((item, index) => (
                  <Table.Tr key={String(item.NetUid || item.Id || index)}>
                    <Table.Td>
                      {item.Product?.NetUid ? (
                        <Anchor component="button" fw={600} type="button" onClick={() => setProductCardNetId(item.Product?.NetUid as string)}>
                          {item.Product?.VendorCode || item.Product?.Articul || '—'}
                        </Anchor>
                      ) : (
                        <Text fw={600}>{item.Product?.VendorCode || item.Product?.Articul || '—'}</Text>
                      )}
                    </Table.Td>
                    <Table.Td>{item.Product?.NameUA || item.Product?.Name || '—'}</Table.Td>
                    <Table.Td ta="right">{amountFormatter.format(getNumber(item.PricePerItem) ?? 0)}</Table.Td>
                    <Table.Td>
                      <NumberInput
                        allowNegative={false}
                        decimalScale={2}
                        disabled={busy}
                        hideControls
                        min={0}
                        size="xs"
                        value={getNumber(item.Qty) ?? 0}
                        onBlur={(event) => {
                          const next = Number(event.currentTarget.value.replace(',', '.'))
                          if (next !== getNumber(item.Qty)) {
                            void changeQty(item.NetUid, item, next)
                          }
                        }}
                      />
                    </Table.Td>
                    <Table.Td ta="right">
                      {amountFormatter.format(getNumber(item.TotalAmountLocal) ?? getNumber(item.TotalAmount) ?? 0)} {localCurrencyCode}
                    </Table.Td>
                    <Table.Td>
                      <Tooltip label={t('Видалити')}>
                        <ActionIcon aria-label={t('Видалити')} color="red" disabled={busy} variant="subtle" onClick={() => removeItem(item.NetUid)}>
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea.Autosize>
      </Box>

      <ProductCardModal productNetId={productCardNetId} onClose={() => setProductCardNetId(null)} />
    </Group>
  )
}

function getNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const parsed = Number(value)

    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}
