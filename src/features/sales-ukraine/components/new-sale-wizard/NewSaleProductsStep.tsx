import { ActionIcon, Anchor, Box, Group, Loader, NumberInput, ScrollArea, Stack, Table, Text, TextInput, Tooltip } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconSearch, IconTrash } from '@tabler/icons-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { FocusEvent as ReactFocusEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { realtimeEvents, useRealtimeEvent } from '../../../../shared/realtime/events'
import { ProductCardModal } from '../../../products/components/ProductCardModal'
import { ProductPickerCarousel } from '../../../products/components/ProductPickerCarousel'
import { ProductInterestModal } from '../../../sales-preorders'
import { addOrderItem, deleteOrderItem, searchSaleProducts, updateOrderItem } from '../../api/salesUkraineApi'
import { getSaleLocalCurrencyCode, isNonVatEurSale, roundMoney } from '../../saleMoney'
import { FutureReservationModal } from './FutureReservationModal'
import {
  getProductCalculatedPricingsByAgreement,
  getProductCurrentPriceByAgreement,
  getProductReservationsByAgreement,
  type WizardCalculatedProductPricing,
  type WizardProductReservation,
} from './newSaleWizardApi'
import type { SalesUkraineProduct, SalesUkraineSale } from '../../types'

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'
const amountFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })

type ProductPricingSnapshot = {
  calculatedPricings: WizardCalculatedProductPricing[]
  currentPrice: number | null
  reservation?: WizardProductReservation
}

type ProductPricingLoadResult = ProductPricingSnapshot & {
  product: SalesUkraineProductWithPricing
}

type SalesUkraineProductWithPricing = SalesUkraineProduct & {
  CalculatedPrices?: WizardCalculatedProductPricing[]
  CurrentPrice?: number
}

const EMPTY_PRODUCT_PRICING = new Map<string, ProductPricingSnapshot>()
const EMPTY_RESERVATIONS = new Map<string, WizardProductReservation>()

export function NewSaleProductsStep({
  agreementNetId,
  clientNetId,
  sale,
  onCartChanged,
}: {
  agreementNetId: string | null
  clientNetId: string | null
  onCartChanged: () => void | Promise<void>
  sale: SalesUkraineSale | null
}) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SalesUkraineProduct[]>([])
  const [isSearching, setSearching] = useState(false)
  const [busy, setBusy] = useState(false)
  const [productCardNetId, setProductCardNetId] = useState<string | null>(null)
  const [interestProduct, setInterestProduct] = useState<SalesUkraineProduct | null>(null)
  const [futureProduct, setFutureProduct] = useState<SalesUkraineProduct | null>(null)
  const [focusedItemNetUid, setFocusedItemNetUid] = useState<string | null>(null)
  const [cartFocused, setCartFocused] = useState(false)
  const busyRef = useRef(false)
  const cartBoxRef = useRef<HTMLDivElement>(null)
  const qtyInputRefs = useRef<Map<string, HTMLInputElement | null> | null>(null)

  if (qtyInputRefs.current === null) {
    qtyInputRefs.current = new Map()
  }

  const qtyInputs = qtyInputRefs.current

  const [reservationsState, setReservationsState] = useState<{ agreementNetId: string | null; values: Map<string, WizardProductReservation> }>({
    agreementNetId: null,
    values: EMPTY_RESERVATIONS,
  })
  const [productPricingState, setProductPricingState] = useState<{ agreementNetId: string | null; values: Map<string, ProductPricingSnapshot> }>({
    agreementNetId: null,
    values: EMPTY_PRODUCT_PRICING,
  })

  const orderItems = Array.isArray(sale?.Order?.OrderItems) ? sale.Order.OrderItems : []
  const cartCount = orderItems.length
  const focusedIndexByNetUid = focusedItemNetUid ? orderItems.findIndex((item) => item.NetUid === focusedItemNetUid) : -1
  const focusedRow = cartCount === 0 ? -1 : focusedIndexByNetUid >= 0 ? focusedIndexByNetUid : 0
  const isVatSale = Boolean(sale?.IsVatSale)
  const useEurToUah = isNonVatEurSale(sale)
  const localCurrencyCode = getSaleLocalCurrencyCode(sale)
  const productPricing = productPricingState.agreementNetId === agreementNetId ? productPricingState.values : EMPTY_PRODUCT_PRICING
  const reservations = reservationsState.agreementNetId === agreementNetId ? reservationsState.values : EMPTY_RESERVATIONS
  const totalLocal = useEurToUah
    ? roundMoney(orderItems.reduce((sum, item) => sum + (getNumber(item.TotalAmountEurToUah) ?? 0), 0))
    : getNumber(sale?.Order?.TotalAmountLocal) ??
      orderItems.reduce((sum, item) => sum + (getNumber(item.TotalAmountLocal) ?? getNumber(item.TotalAmount) ?? 0), 0)
  const totalVat = getNumber(sale?.Order?.TotalVat) ?? 0

  const cartNetIdRef = useRef<string | undefined>(undefined)
  const onCartChangedRef = useRef(onCartChanged)
  const pricingCacheGenerationRef = useRef(0)

  const clearProductPricingCache = useCallback(() => {
    pricingCacheGenerationRef.current += 1
    setReservationsState((previous) => ({ agreementNetId: previous.agreementNetId, values: EMPTY_RESERVATIONS }))
    setProductPricingState((previous) => ({ agreementNetId: previous.agreementNetId, values: EMPTY_PRODUCT_PRICING }))
  }, [])

  useEffect(() => {
    cartNetIdRef.current = sale?.NetUid
    onCartChangedRef.current = onCartChanged
  })

  const handleRealtimeSale = useCallback((payload: unknown) => {
    const netId = resolveSaleNetId(payload)

    if (netId && netId === cartNetIdRef.current) {
      clearProductPricingCache()
      void onCartChangedRef.current()
    }
  }, [clearProductPricingCache])

  const handleReservationSignal = useCallback(() => {
    clearProductPricingCache()
  }, [clearProductPricingCache])

  useRealtimeEvent(realtimeEvents.saleUpdated, handleRealtimeSale)
  useRealtimeEvent(realtimeEvents.saleAdded, handleRealtimeSale)
  useRealtimeEvent(realtimeEvents.productReservationUpdated, handleReservationSignal)

  const getProductMeta = useCallback(
    (product: SalesUkraineProduct) => {
      const reservation = product.NetUid ? reservations.get(product.NetUid) : undefined
      const pricing = product.NetUid ? productPricing.get(product.NetUid) : undefined
      const preciseReservation = pricing?.reservation

      if (!reservation && !pricing) {
        return undefined
      }

      return {
        available: getReservationAvailableQty(preciseReservation) ?? getReservationAvailableQty(reservation),
        price: pricing?.currentPrice ?? getReservationPrice(preciseReservation) ?? getReservationPrice(reservation),
      }
    },
    [productPricing, reservations],
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

    const alreadyInCart = orderItems.some((item) => item.Product?.NetUid === product.NetUid)

    if (!beginBusy()) {
      return
    }

    const existing = orderItems.find((item) => item.Product?.NetUid === product.NetUid)

    try {
      const pricing = await loadProductPricing(product, agreementNetId)
      const meta = getProductMeta(pricing.product)
      const available = getReservationAvailableQty(pricing.reservation) ?? meta?.available

      if (!alreadyInCart && typeof available === 'number' && available <= 0) {
        setFutureProduct(pricing.product)

        return
      }

      if (existing) {
        await updateOrderItem({ ...existing, Qty: (getNumber(existing.Qty) || 0) + 1 })
      } else {
        await addOrderItem(agreementNetId, sale.NetUid, { Deleted: false, Id: 0, NetUid: EMPTY_GUID, Product: pricing.product, Qty: 1 })
      }

      await onCartChanged()
    } catch {
      notifications.show({ color: 'red', message: t('Не вдалося додати товар') })
    } finally {
      endBusy()
    }
  }

  async function loadProductPricing(product: SalesUkraineProduct, clientAgreementNetId: string): Promise<ProductPricingLoadResult> {
    if (!product.NetUid) {
      return { calculatedPricings: [], currentPrice: null, product }
    }

    const requestGeneration = pricingCacheGenerationRef.current
    const [currentPrice, calculatedPricings, productReservations] = await Promise.all([
      getProductCurrentPriceByAgreement(product.NetUid, clientAgreementNetId),
      getProductCalculatedPricingsByAgreement(product.NetUid, clientAgreementNetId),
      getProductReservationsByAgreement(clientAgreementNetId, product.NetUid),
    ])

    if (requestGeneration !== pricingCacheGenerationRef.current) {
      return loadProductPricing(product, clientAgreementNetId)
    }

    const reservation = findReservationForProduct(product.NetUid, productReservations)

    setProductPricingState((previous) => {
      const next = new Map(previous.agreementNetId === clientAgreementNetId ? previous.values : EMPTY_PRODUCT_PRICING)
      const snapshot: ProductPricingSnapshot = { calculatedPricings, currentPrice }

      if (reservation) {
        snapshot.reservation = reservation
      }

      next.set(product.NetUid as string, snapshot)

      return { agreementNetId: clientAgreementNetId, values: next }
    })

    if (reservation) {
      setReservationsState((previous) => {
        const next = new Map(previous.agreementNetId === clientAgreementNetId ? previous.values : EMPTY_RESERVATIONS)
        next.set(product.NetUid as string, { ...reservation, ProductNetUid: reservation.ProductNetUid || product.NetUid })

        return { agreementNetId: clientAgreementNetId, values: next }
      })
    }

    const pricedProduct: SalesUkraineProductWithPricing = {
      ...product,
      CalculatedPrices: calculatedPricings,
    }

    if (currentPrice != null) {
      pricedProduct.CurrentPrice = currentPrice
    }

    const result: ProductPricingLoadResult = { calculatedPricings, currentPrice, product: pricedProduct }

    if (reservation) {
      result.reservation = reservation
    }

    return result
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
      await onCartChanged()
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
      await onCartChanged()
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

  function handleCartBlur(event: ReactFocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setCartFocused(false)
    }
  }

  function focusFocusedRowQty() {
    const item = orderItems[focusedRow]
    const input = item?.NetUid ? qtyInputs.get(item.NetUid) : null

    if (input) {
      input.focus()
      input.select()
    }
  }

  function handleCartKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement
    const inEditable = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

    if (inEditable) {
      if (event.key === 'Enter' || event.key === 'Escape') {
        event.preventDefault()
        target.blur()
        cartBoxRef.current?.focus()
      }

      return
    }

    if (cartCount === 0) {
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setFocusedItemNetUid(orderItems[(focusedRow + 1) % cartCount]?.NetUid ?? null)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setFocusedItemNetUid(orderItems[(focusedRow - 1 + cartCount) % cartCount]?.NetUid ?? null)
    } else if (event.key === 'Delete') {
      event.preventDefault()

      if (!busy) {
        void removeItem(orderItems[focusedRow]?.NetUid)
      }
    } else if (event.key === 'F2' || event.key === 'Enter') {
      event.preventDefault()
      focusFocusedRowQty()
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
        onProductInterest={agreementNetId ? (product) => setInterestProduct(product) : undefined}
      />

      <Box
        ref={cartBoxRef}
        aria-label={t('Кошик')}
        role="group"
        style={{
          borderRadius: 'var(--mantine-radius-sm)',
          outline: cartFocused ? '2px solid var(--mantine-color-blue-4)' : 'none',
          outlineOffset: 2,
        }}
        tabIndex={cartCount > 0 ? 0 : -1}
        onBlur={handleCartBlur}
        onFocus={() => setCartFocused(true)}
        onKeyDown={handleCartKeyDown}
      >
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
                  <Table.Tr
                    key={String(item.NetUid || item.Id || index)}
                    style={cartFocused && index === focusedRow ? { background: 'var(--mantine-color-blue-light)' } : undefined}
                    onMouseDown={() => setFocusedItemNetUid(item.NetUid ?? null)}
                  >
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
                        ref={(el) => {
                          if (item.NetUid) {
                            if (el) {
                              qtyInputs.set(item.NetUid, el)
                            } else {
                              qtyInputs.delete(item.NetUid)
                            }
                          }
                        }}
                        allowNegative={false}
                        decimalScale={2}
                        disabled={busy}
                        hideControls
                        min={0}
                        size="xs"
                        value={getNumber(item.Qty) ?? 0}
                        onBlur={(event) => {
                          const next = Number(event.currentTarget.value.replace(',', '.'))
                          if (!Number.isFinite(next) || next <= 0) {
                            event.currentTarget.value = String(getNumber(item.Qty) ?? 0)

                            return
                          }
                          if (next !== getNumber(item.Qty)) {
                            void changeQty(item.NetUid, item, next)
                          }
                        }}
                      />
                    </Table.Td>
                    <Table.Td ta="right">
                      {amountFormatter.format(
                        (useEurToUah ? getNumber(item.TotalAmountEurToUah) : getNumber(item.TotalAmountLocal) ?? getNumber(item.TotalAmount)) ?? 0,
                      )}{' '}
                      {localCurrencyCode}
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

      <ProductInterestModal
        clientAgreementNetId={agreementNetId ?? ''}
        opened={Boolean(interestProduct?.NetUid && agreementNetId)}
        productNetId={interestProduct?.NetUid ?? ''}
        onClose={() => setInterestProduct(null)}
        onCreated={() => setInterestProduct(null)}
      />

      <FutureReservationModal
        clientNetId={clientNetId}
        product={futureProduct}
        onClose={() => setFutureProduct(null)}
        onReserved={() => {
          setFutureProduct(null)
          void onCartChanged()
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

function findReservationForProduct(
  productNetUid: string,
  reservations: WizardProductReservation[],
): WizardProductReservation | undefined {
  return reservations.find((reservation) => reservation.ProductNetUid === productNetUid) ?? (reservations.length === 1 ? reservations[0] : undefined)
}

function getReservationAvailableQty(reservation?: WizardProductReservation): number | undefined {
  return reservation?.AvailableQty ?? reservation?.AvailableQtyUk
}

function getReservationPrice(reservation?: WizardProductReservation): number | undefined {
  return reservation?.Price ?? reservation?.PricePerItem
}
