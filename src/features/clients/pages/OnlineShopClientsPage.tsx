import {
  ActionIcon,
  Alert,
  Box,
  Button,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { AppDrawer } from "../../../shared/ui/AppDrawer"
import { useDebouncedValue } from '@mantine/hooks'
import { IconAlertCircle, IconReceipt, IconRestore, IconSearch, IconShoppingCart } from '@tabler/icons-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { DEFAULT_PAGINATOR_PAGE_SIZE } from '../../../shared/ui/paginator/paginatorPageSize'
import { getRetailClientCart, getRetailClientsPage, searchRetailClientsPage } from '../api/onlineShopClientsApi'
import { OnlineShopOrderItemsList } from '../components/OnlineShopOrderItemsList'
import { OnlineShopSalesPanel } from '../components/OnlineShopSalesPanel'
import { getRetailItemTotal } from '../onlineShopDisplay'
import type { RetailCartItem, RetailClient } from '../onlineShopTypes'
import '../../../shared/ui/console-table-page.css'
import './online-shop-clients-page.css'

const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})
const ONLINE_SHOP_CLIENT_SEARCH_DEBOUNCE_MS = 350
const ONLINE_SHOP_CLIENTS_TABLE_MIN_WIDTH = 1000
const ONLINE_SHOP_CLIENTS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['client'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

export function OnlineShopClientsPage() {
  const { t } = useI18n()
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)
  const [clients, setClients] = useValueState<RetailClient[]>([])
  const [selectedClient, setSelectedClient] = useValueState<RetailClient | null>(null)
  const [cartItems, setCartItems] = useValueState<RetailCartItem[]>([])
  const [searchValue, setSearchValue] = useValueState('')
  const [debouncedSearchValue] = useDebouncedValue(searchValue, ONLINE_SHOP_CLIENT_SEARCH_DEBOUNCE_MS)
  const [totalClients, setTotalClients] = useValueState(0)
  const [page, setPage] = useValueState(1)
  const [pageSize, setPageSize] = useValueState(DEFAULT_PAGINATOR_PAGE_SIZE)
  const [error, setError] = useValueState<string | null>(null)
  const [cartError, setCartError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isCartLoading, setCartLoading] = useValueState(false)
  const [isSalesOpen, setSalesOpen] = useValueState(false)
  const cartRequestRef = useRef(0)
  const selectedClientNetId = selectedClient ? getRetailClientNetId(selectedClient) : ''
  const normalizedSearchValue = debouncedSearchValue.trim()
  const isSearchSettling = searchValue.trim() !== normalizedSearchValue
  const isTableBusy = isLoading || isSearchSettling
  const offset = (page - 1) * pageSize
  const totalPages = totalClients > 0 ? Math.max(1, Math.ceil(totalClients / pageSize)) : page
  const cartTotal = useMemo(() => cartItems.reduce((total, item) => total + getRetailItemTotal(item), 0), [cartItems])
  const hasActiveSearch = Boolean(searchValue.trim())
  const visibleFrom = totalClients === 0 ? 0 : offset + 1
  const visibleTo = totalClients === 0 ? 0 : offset + clients.length
  const columns = useOnlineShopClientColumns()

  useEffect(() => {
    setPage(1)
  }, [normalizedSearchValue, setPage])

  useEffect(() => {
    let cancelled = false

    async function loadClients() {
      cartRequestRef.current += 1
      setSelectedClient(null)
      setCartItems([])
      setCartError(null)
      setCartLoading(false)
      setLoading(true)
      setError(null)

      try {
        const response = normalizedSearchValue
          ? await searchRetailClientsPage(normalizedSearchValue, { limit: pageSize, offset })
          : await getRetailClientsPage({ limit: pageSize, offset })

        if (!cancelled) {
          setClients(response.Items)
          setTotalClients(response.Total)
        }
      } catch (loadError) {
        if (!cancelled) {
          setClients([])
          setTotalClients(0)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити клієнтів інтернет-магазину'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadClients()

    return () => {
      cancelled = true
    }
  }, [normalizedSearchValue, offset, pageSize, setCartError, setCartItems, setCartLoading, setClients, setError, setLoading, setSelectedClient, setTotalClients, t])

  async function selectClient(client: RetailClient) {
    const netId = getRetailClientNetId(client)
    const requestId = cartRequestRef.current + 1

    cartRequestRef.current = requestId

    setSelectedClient(client)
    setCartItems([])
    setCartError(null)

    if (!netId) {
      setCartLoading(false)
      return
    }

    setCartLoading(true)

    try {
      const nextCartItems = await getRetailClientCart(netId)

      if (requestId === cartRequestRef.current) {
        setCartItems(nextCartItems)
      }
    } catch (loadError) {
      if (requestId === cartRequestRef.current) {
        setCartError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити кошик клієнта'))
      }
    } finally {
      if (requestId === cartRequestRef.current) {
        setCartLoading(false)
      }
    }
  }

  function resetSearch() {
    cartRequestRef.current += 1
    setSelectedClient(null)
    setCartItems([])
    setCartError(null)
    setCartLoading(false)
    setSearchValue('')
    setPage(1)
  }

  function openSalesDrawer() {
    if (selectedClientNetId) {
      setSalesOpen(true)
    }
  }

  return (
    <Stack className="online-shop-clients-page console-table-page" gap={6}>
      <Box className="online-shop-clients-shell console-table-shell">
        <div className="app-filter-bar online-shop-clients-filter-bar">
          <TextInput
            className="online-shop-clients-search"
            leftSection={<IconSearch size={16} />}
            label={t('Пошук клієнта')}
            placeholder={t('Клієнт, телефон або email')}
            value={searchValue}
            onChange={(event) => {
              setPage(1)
              setSearchValue(event.currentTarget.value)
            }}
          />

          <div className="app-filter-actions online-shop-clients-filter-actions">
            <span className="online-shop-clients-summary">
              {visibleFrom}-{visibleTo} / {totalClients}
            </span>
            <Tooltip label={t('Скинути')}>
              <ActionIcon
                aria-label={t('Скинути')}
                color="gray"
                disabled={!hasActiveSearch}
                size={38}
                variant="light"
                onClick={resetSearch}
              >
                <IconRestore size={18} />
              </ActionIcon>
            </Tooltip>
            <Paginator
              isLoading={isTableBusy}
              page={page}
              pageSize={pageSize}
              totalPages={totalPages}
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPage(1)
                setPageSize(nextPageSize)
              }}
            />
          </div>
          <div ref={setTableToolbarSlot} className="online-shop-clients-table-toolbar-slot" />
        </div>

        {error && (
          <Alert className="console-table-alert" color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <Box className="online-shop-clients-page__layout">
          <section className="online-shop-clients-table console-table-body">
            <DataTable
              columns={columns}
              data={clients}
              defaultLayout={ONLINE_SHOP_CLIENTS_TABLE_DEFAULT_LAYOUT}
              emptyText={t('Клієнтів інтернет-магазину не знайдено')}
              getRowId={(client, index) => getRetailClientRowKey(client, index)}
              height="100%"
              isLoading={isTableBusy}
              layoutVersion="online-shop-clients-table-2"
              minWidth={ONLINE_SHOP_CLIENTS_TABLE_MIN_WIDTH}
              rowClassName={(client) => (isSameRetailClient(client, selectedClient) ? 'is-selected' : undefined)}
              showLayoutControls
              tableId="online-shop-clients"
              toolbarPortalTarget={tableToolbarSlot}
              onRowClick={(client) => {
                void selectClient(client)
              }}
            />
          </section>

          <aside className={`online-shop-clients-side-panel${selectedClient ? ' is-selected' : ''}`}>
            <section className="online-shop-clients-cart-card">
              <div className="online-shop-clients-cart-header">
                <div className="online-shop-clients-cart-heading">
                  <div>
                    <Text className="app-section-title online-shop-clients-cart-eyebrow">{t('Кошик')}</Text>
                    <Text className="online-shop-clients-cart-title">
                      {selectedClient ? displayValue(getRetailClientName(selectedClient)) : t('Клієнта не вибрано')}
                    </Text>
                  </div>
                </div>
                <span className="online-shop-clients-cart-count">
                  {cartItems.length}
                </span>
              </div>

              {cartError && (
                <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
                  {cartError}
                </Alert>
              )}

              {selectedClient && (
                <Button
                  className="online-shop-clients-sales-button"
                  fullWidth
                  disabled={!selectedClientNetId}
                  leftSection={<IconReceipt size={16} />}
                  variant="light"
                  onClick={openSalesDrawer}
                >
                  {t('Продажі клієнта')}
                </Button>
              )}

              <ScrollArea className="online-shop-clients-cart-scroll" type="auto">
                <div className="online-shop-clients-cart-body">
                  {isCartLoading ? (
                    <CartItemsSkeleton />
                  ) : cartItems.length > 0 ? (
                    <OnlineShopOrderItemsList emptyText={t('Кошик порожній')} items={cartItems} />
                  ) : (
                    <div className="online-shop-clients-cart-empty">
                      <IconShoppingCart size={22} />
                      <Text>
                        {selectedClient ? t('Кошик порожній') : t('Вибери клієнта в таблиці')}
                      </Text>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="online-shop-clients-cart-total">
                <Text>{t('Разом')}</Text>
                <strong>{formatAmount(cartTotal)}</strong>
              </div>
            </section>
          </aside>
        </Box>
      </Box>

      <AppDrawer
        opened={isSalesOpen}
        position="right"
        size="calc(100% - 100px)"
        title={t('Продажі')}
        onClose={() => setSalesOpen(false)}
      >
        <OnlineShopSalesPanel netUid={selectedClientNetId} />
      </AppDrawer>
    </Stack>
  )
}

function useOnlineShopClientColumns(): DataTableColumn<RetailClient>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<RetailClient>[]>(
    () => [
      {
        id: 'client',
        header: t('Клієнт'),
        width: 300,
        minWidth: 260,
        accessor: getRetailClientName,
        cell: (client) => <OnlineShopClientCell client={client} />,
      },
      {
        id: 'phone',
        header: t('Телефон'),
        width: 156,
        minWidth: 132,
        accessor: getRetailClientPhone,
        cell: (client) => <OnlineShopContactCell value={getRetailClientPhone(client)} />,
      },
      {
        id: 'email',
        header: t('Email'),
        width: 240,
        minWidth: 180,
        accessor: getRetailClientEmail,
        cell: (client) => <OnlineShopContactCell value={getRetailClientEmail(client)} />,
      },
      {
        id: 'city',
        header: t('Місто'),
        width: 168,
        minWidth: 132,
        accessor: getRetailClientCity,
        cell: (client) => <OnlineShopCityCell value={getRetailClientCity(client)} />,
      },
      {
        id: 'created',
        header: t('Створено'),
        width: 136,
        minWidth: 116,
        accessor: (client) => getDateTime(client.Created),
        cell: (client) => <OnlineShopCreatedCell value={client.Created} />,
      },
    ],
    [t],
  )
}

function OnlineShopClientCell({ client }: { client: RetailClient }) {
  const name = displayValue(getRetailClientName(client))

  return (
    <div className="online-shop-clients-profile-cell">
      <div className="online-shop-clients-profile-copy">
        <Text className="online-shop-clients-profile-name" title={nativeTitle(name)}>
          {name}
        </Text>
        <Text className="online-shop-clients-profile-subtitle" title={getRetailClientSourceLabel(client)}>
          {getRetailClientSourceLabel(client)}
        </Text>
      </div>
    </div>
  )
}

function OnlineShopContactCell({ value }: { value: string }) {
  const displayedValue = displayValue(value)

  return (
    <div className="online-shop-clients-contact-cell">
      <Text title={nativeTitle(displayedValue)}>{displayedValue}</Text>
    </div>
  )
}

function OnlineShopCityCell({ value }: { value: string }) {
  const displayedValue = displayValue(value)

  return (
    <div className="online-shop-clients-city-cell">
      <Text title={nativeTitle(displayedValue)}>{displayedValue}</Text>
    </div>
  )
}

function OnlineShopCreatedCell({ value }: { value?: Date | string }) {
  const created = formatRetailClientCreated(value)

  return (
    <div className="online-shop-clients-created-cell" title={nativeTitle(created.tooltip)}>
      <span>{created.date}</span>
      <small>{created.time}</small>
    </div>
  )
}

function CartItemsSkeleton() {
  return (
    <div className="online-shop-clients-cart-skeleton" aria-busy="true">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="online-shop-clients-cart-skeleton-row">
          <span className="online-shop-clients-cart-skeleton-image" />
          <span className="online-shop-clients-cart-skeleton-copy">
            <span className="online-shop-clients-cart-skeleton-line is-title" />
            <span className="online-shop-clients-cart-skeleton-line is-meta" />
          </span>
          <span className="online-shop-clients-cart-skeleton-total" />
        </div>
      ))}
    </div>
  )
}

function getRetailClientNetId(client: RetailClient): string {
  return client.NetUid?.trim() || client.Client?.NetUid?.trim() || ''
}

function getRetailClientRowKey(client: RetailClient, index: number): string {
  return getRetailClientNetId(client) || String(client.Id || client.Client?.Id || index)
}

function isSameRetailClient(client: RetailClient, selectedClient: RetailClient | null): boolean {
  if (!selectedClient) {
    return false
  }

  const clientNetId = getRetailClientNetId(client)
  const selectedClientNetId = getRetailClientNetId(selectedClient)

  if (clientNetId || selectedClientNetId) {
    return clientNetId === selectedClientNetId
  }

  return Boolean(client.Id && selectedClient.Id && client.Id === selectedClient.Id) || client === selectedClient
}

function getRetailClientName(client: RetailClient): string {
  const nestedClient = client.Client
  const directName = client.FullName?.trim() || client.Name?.trim()

  if (directName) {
    return directName
  }

  const nestedName = nestedClient?.FullName?.trim() || nestedClient?.Name?.trim()

  if (nestedName) {
    return nestedName
  }

  return [client.FirstName || nestedClient?.FirstName, client.LastName || nestedClient?.LastName, client.MiddleName || nestedClient?.MiddleName]
    .filter(Boolean)
    .join(' ')
}

function getRetailClientPhone(client: RetailClient): string {
  return (
    client.PhoneNumber?.trim()
    || client.Phone?.trim()
    || client.MobileNumber?.trim()
    || client.Client?.ClientNumber?.trim()
    || client.Client?.MobileNumber?.trim()
    || ''
  )
}

function getRetailClientEmail(client: RetailClient): string {
  return client.Email?.trim() || client.EmailAddress?.trim() || client.Client?.EmailAddress?.trim() || ''
}

function getRetailClientCity(client: RetailClient): string {
  return client.City?.trim() || client.EcommerceRegion?.NameUa?.trim() || client.Client?.RegionCode?.City?.trim() || ''
}

function getRetailClientSourceLabel(client: RetailClient): string {
  return client.Client ? 'Інтернет магазин / клієнт' : 'Інтернет магазин'
}

function formatRetailClientCreated(value?: Date | string): { date: string; time: string; tooltip: string } {
  if (!value) {
    return { date: '', time: '', tooltip: '' }
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    const fallback = String(value)

    return { date: fallback, time: '', tooltip: fallback }
  }

  const datePart = date.toLocaleDateString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
  const timePart = date.toLocaleTimeString('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return {
    date: datePart,
    time: timePart,
    tooltip: `${datePart}, ${timePart}`,
  }
}

function getDateTime(value: unknown): number {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? 0 : value.getTime()
  }

  if (typeof value !== 'string' || !value) {
    return 0
  }

  const parsed = new Date(value)

  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime()
}

function formatAmount(value: number): string {
  return amountFormatter.format(value)
}

function displayValue(value?: number | string | null): string {
  if (typeof value === 'number') {
    return String(value)
  }

  const normalized = value?.trim()
  return normalized || ''
}

function nativeTitle(value: string): string | undefined {
  return value ? value : undefined
}
