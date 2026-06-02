import { ActionIcon, Anchor, Box, Group, Loader, NumberInput, ScrollArea, Stack, Table, Text, TextInput, Tooltip } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconSearch, IconTrash } from '@tabler/icons-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { realtimeEvents, useRealtimeEvent } from '../../../../shared/realtime/events'
import { ProductCardModal } from '../../../products/components/ProductCardModal'
import { ProductPickerCarousel } from '../../../products/components/ProductPickerCarousel'
import { addOrderItem, deleteOrderItem, searchSaleProducts, updateOrderItem } from '../../api/salesUkraineApi'
import { FutureReservationModal } from './FutureReservationModal'
import { getProductReservationsByAgreement, type WizardProductReservation } from './newSaleWizardApi'
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
  const [futureProduct, setFutureProduct] = useState<SalesUkraineProduct | null>(null)
  const busyRef = useRef(false)

  const [reservations, setReservations] = useState<Map<string, WizardProductReservation>>(new Map())
  const [reservationReload, setReservationReload] = useState(0)

  const orderItems = Array.isArray(sale?.Order?.OrderItems) ? sale.Order.OrderItems : []
  const localCurrencyCode = sale?.ClientAgreement?.Agreement?.Currency?.Code || ''
  const isVatSale = Boolean(sale?.IsVatSale)
  const totalLocal =
    getNumber(sale?.Order?.TotalAmountLocal) ??
    orderItems.reduce((sum, item) => sum + (getNumber(item.TotalAmountLocal) ?? getNumber(item.TotalAmount) ?? 0), 0)
  const totalVat = getNumber(sale?.Order?.TotalVat) ?? 0

  const cartNetIdRef = useRef<string | undefined>(undefined)
  const onCartChangedRef = useRef(onCartChanged)

  useEffect(() => {
    cartNetIdRef.current = sale?.NetUid
    onCartChangedRef.current = onCartChanged
  })

  const handleRealtimeSale = useCallback((payload: unknown) => {
    const netId = resolveSaleNetId(payload)

    if (netId && netId === cartNetIdRef.current) {
      onCartChangedRef.current()
      setReservationReload((key) => key + 1)
    }
  }, [])

  const handleReservationSignal = useCallback(() => {
    setReservationReload((key) => key + 1)
  }, [])

  useRealtimeEvent(realtimeEvents.saleUpdated, handleRealtimeSale)
  useRealtimeEvent(realtimeEvents.saleAdded, handleRealtimeSale)
  useRealtimeEvent(realtimeEvents.productReservationUpdated, handleReservationSignal)

  useEffect(() => {
    if (!agreementNetId) {
      return
    }

    let cancelled = false

    async function load(id: string) {
      try {
        const list = await getProductReservationsByAgreement(id)

        if (!cancelled) {
          const map = new Map<string, WizardProductReservation>()
          list.forEach((reservation) => {
            if (reservation.ProductNetUid) {
              map.set(reservation.ProductNetUid, reservation)
            }
          })
          setReservations(map)
        }
      } catch {
        /* availability is best-effort */
      }
    }

    void load(agreementNetId)

    return () => {
      cancelled = true
    }
  }, [agreementNetId, reservationReload])

  const getProductMeta = useCallback(
    (product: SalesUkraineProduct) => {
      const reservation = product.NetUid ? reservations.get(product.NetUid) : undefined

      if (!reservation) {
        return undefined
      }

      return {
        available: reservation.AvailableQty ?? reservation.AvailableQtyUk,
        price: reservation.Price ?? reservation.PricePerItem,
      }
    },
    [reservations],
  )

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

    const meta = getProductMeta(product)
    const alreadyInCart = orderItems.some((item) => item.Product?.NetUid === product.NetUid)

    if (!alreadyInCart && typeof meta?.available === 'number' && meta.available <= 0) {
      setFutureProduct(product)

      return
    }

    if (!beginBusy()) {
      return
    }

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
      endBusy()
    }
  }

  async function changeQty(netId: string | undefined, item: (typeof orderItems)[number], qty: number) {
    if (!netId || !Number.isFinite(qty) || qty <= 0) {
      return
    }

    if (!beginBusy()) {
      return
    }

    try {
      await updateOrderItem({ ...item, Qty: qty })
      onCartChanged()
    } catch {
      notifications.show({ color: 'red', message: t('Не вдалося оновити кількість') })
    } finally {
      endBusy()
    }
  }

  async function removeItem(netId: string | undefined) {
    if (!netId) {
      return
    }

    if (!beginBusy()) {
      return
    }

    try {
      await deleteOrderItem(netId)
      onCartChanged()
    } catch {
      notifications.show({ color: 'red', message: t('Не вдалося видалити товар') })
    } finally {
      endBusy()
    }
  }

  function beginBusy(): boolean {
    if (busyRef.current) {
      return false
    }

    busyRef.current = true
    setBusy(true)
    return true
  }

  function endBusy() {
    busyRef.current = false
    setBusy(false)
  }

  function handleQueryChange(value: string) {
    setQuery(value)

    if (value.trim().length < 2) {
      setResults([])
      setSearching(false)
    }
  }

  return (
    <Stack gap="md">
      <TextInput
        autoFocus
        label={t('Пошук по товару')}
        leftSection={<IconSearch size={16} />}
        placeholder={t('Код Виробника')}
        rightSection={isSearching ? <Loader size="xs" /> : null}
        value={query}
        onChange={(event) => handleQueryChange(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && query) {
            event.preventDefault()
            event.stopPropagation()
            handleQueryChange('')
          }
        }}
      />

      <ProductPickerCarousel
        products={results}
        disabled={busy || !agreementNetId || !sale?.NetUid}
        isLoading={isSearching}
        emptyText={query.trim().length < 2 ? t('Введіть мінімум 2 символи') : t('Нічого не знайдено')}
        getMeta={getProductMeta}
        onPick={(product) => addProduct(product)}
        onOpenCard={setProductCardNetId}
      />

      <Box>
        <Text fw={600} mb={4} size="sm">
          {t('Кошик')}
        </Text>
        <ScrollArea.Autosize mah={360} type="auto">
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

        {orderItems.length > 0 && (
          <Group justify="flex-end" gap="xl" mt="xs">
            {isVatSale && (
              <Text size="sm">
                {t('ПДВ')}: <Text span fw={600}>{amountFormatter.format(totalVat)}</Text>
              </Text>
            )}
            <Text size="sm">
              {t('Разом')}:{' '}
              <Text span fw={700}>
                {amountFormatter.format(totalLocal)} {localCurrencyCode}
              </Text>
            </Text>
          </Group>
        )}
      </Box>

      <ProductCardModal productNetId={productCardNetId} onClose={() => setProductCardNetId(null)} />

      <FutureReservationModal
        clientNetId={sale?.ClientAgreement?.Client?.NetUid ?? null}
        product={futureProduct}
        onClose={() => setFutureProduct(null)}
        onReserved={() => {
          setFutureProduct(null)
          onCartChanged()
        }}
      />
    </Stack>
  )
}

function resolveSaleNetId(payload: unknown): string | undefined {
  let value = payload

  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return undefined
    }
  }

  if (!value || typeof value !== 'object') {
    return undefined
  }

  const record = value as Record<string, unknown>
  const sale = (record.Sale && typeof record.Sale === 'object' ? record.Sale : record) as Record<string, unknown>
  const netId = sale.NetUid

  return typeof netId === 'string' ? netId : undefined
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
