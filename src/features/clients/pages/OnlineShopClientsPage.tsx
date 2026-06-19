import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Card,
  Group,
  Loader,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { AppDrawer } from "../../../shared/ui/AppDrawer"
import { useDebouncedValue } from '@mantine/hooks'
import { IconAlertCircle, IconChevronLeft, IconChevronRight, IconReceipt, IconRestore, IconSearch } from '@tabler/icons-react'
import { useEffect, useMemo, useRef } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { getRetailClientCart, getRetailClientsPage, searchRetailClientsPage } from '../api/onlineShopClientsApi'
import { OnlineShopOrderItemsList } from '../components/OnlineShopOrderItemsList'
import { OnlineShopSalesFilter } from '../components/OnlineShopSalesFilter'
import { OnlineShopSalesPanel } from '../components/OnlineShopSalesPanel'
import { getRetailItemTotal } from '../onlineShopDisplay'
import type { RetailCartItem, RetailClient } from '../onlineShopTypes'
import './online-shop-clients-page.css'

const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})
const ONLINE_SHOP_CLIENT_SEARCH_DEBOUNCE_MS = 350
const ONLINE_SHOP_CLIENT_PAGE_SIZE_OPTIONS = ['20', '50', '100']
const ONLINE_SHOP_CLIENT_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['client'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const ONLINE_SHOP_CLIENT_TABLE_CELL_STYLE = {
  display: 'block',
  lineHeight: '18px',
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const

export function OnlineShopClientsPage() {
  const { t } = useI18n()
  const [clients, setClients] = useValueState<RetailClient[]>([])
  const [selectedClient, setSelectedClient] = useValueState<RetailClient | null>(null)
  const [cartItems, setCartItems] = useValueState<RetailCartItem[]>([])
  const [searchValue, setSearchValue] = useValueState('')
  const [debouncedSearchValue] = useDebouncedValue(searchValue, ONLINE_SHOP_CLIENT_SEARCH_DEBOUNCE_MS)
  const [totalClients, setTotalClients] = useValueState(0)
  const [page, setPage] = useValueState(1)
  const [pageSize, setPageSize] = useValueState(20)
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
  const canMoveBack = page > 1
  const canMoveForward = page * pageSize < totalClients
  const cartTotal = useMemo(() => cartItems.reduce((total, item) => total + getRetailItemTotal(item), 0), [cartItems])
  const clientColumns = useRetailClientColumns()
  const tableToolbarLeft = useMemo(
    () =>
      normalizedSearchValue ? (
        <Text size="xs" c="dimmed">
          {t('пошук')}: {normalizedSearchValue}
        </Text>
      ) : null,
    [normalizedSearchValue, t],
  )

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

  function selectFastClient(client: RetailClient) {
    void selectClient(client)

    if (getRetailClientNetId(client)) {
      setSalesOpen(true)
    }
  }

  return (
    <Stack className="online-shop-clients-page" gap={6}>
      <Box
        className="online-shop-clients-page__layout"
      >
        <div className="online-shop-clients-page__left">
          <Stack gap="md" className="online-shop-clients-page__left-stack">
            <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
              <TextInput
                leftSection={<IconSearch size={16} />}
                label={t('Пошук')}
                placeholder={t('Клієнт, телефон або email')}
                value={searchValue}
                onChange={(event) => {
                  setPage(1)
                  setSearchValue(event.currentTarget.value)
                }}
                style={{ flex: 1 }}
              />
              <Tooltip label={t('Скинути')}>
                <ActionIcon variant="light" color="violet" size={36} aria-label={t('Скинути')} onClick={resetSearch}>
                  <IconRestore size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>

            {error && (
              <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
                {error}
              </Alert>
            )}

            <Group justify="space-between" gap="sm">
              <Text size="sm" c="dimmed">
                {t('Сторінка')} {page}
                {totalClients ? `, ${t('усього')}: ${totalClients}` : ''}
              </Text>
              <Group gap="xs">
                <Select
                  aria-label={t('Розмір сторінки')}
                  data={ONLINE_SHOP_CLIENT_PAGE_SIZE_OPTIONS}
                  value={String(pageSize)}
                  w={84}
                  onChange={(value) => {
                    setPage(1)
                    setPageSize(Number(value || 20))
                  }}
                />
                <ActionIcon
                  aria-label={t('Попередня сторінка')}
                  color="gray"
                  disabled={!canMoveBack || isTableBusy}
                  variant="light"
                  onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                >
                  <IconChevronLeft size={18} />
                </ActionIcon>
                <ActionIcon
                  aria-label={t('Наступна сторінка')}
                  color="gray"
                  disabled={!canMoveForward || isTableBusy}
                  variant="light"
                  onClick={() => setPage((currentPage) => currentPage + 1)}
                >
                  <IconChevronRight size={18} />
                </ActionIcon>
              </Group>
            </Group>

            <DataTable
              columns={clientColumns}
              data={clients}
              defaultLayout={ONLINE_SHOP_CLIENT_TABLE_DEFAULT_LAYOUT}
              density={ONLINE_SHOP_CLIENT_TABLE_DEFAULT_LAYOUT.density}
              emptyText={t('Клієнтів інтернет-магазину не знайдено')}
              getRowId={(client, index) => getRetailClientRowKey(client, index)}
              height="100%"
              isLoading={isTableBusy}
              layoutVersion="online-shop-clients-table-default-freeze-2"
              loadingText={isSearchSettling ? t('Пошук клієнтів') : t('Завантаження клієнтів')}
              minWidth={880}
              rowClassName={(client) => (isSameRetailClient(client, selectedClient) ? 'is-selected' : undefined)}
              showDensityToggle={false}
              showLayoutControls={false}
              tableId="online-shop-clients"
              toolbarLeft={tableToolbarLeft}
              onRowClick={(client) => {
                void selectClient(client)
              }}
            />
          </Stack>
        </div>

        <Card withBorder radius="md" padding="md" style={{ minWidth: 0, paddingTop: 0 }}>
          <Stack gap="md">
            <OnlineShopSalesFilter onSelectFastClient={selectFastClient} />

            {cartError && (
              <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
                {cartError}
              </Alert>
            )}

            {selectedClient && (
              <Button
                fullWidth
                disabled={!selectedClientNetId}
                leftSection={<IconReceipt size={16} />}
                variant="light"
                onClick={openSalesDrawer}
              >
                {t('Продажі клієнта')}
              </Button>
            )}

            <ScrollArea.Autosize mah="calc(100vh - 390px)" type="auto">
              {isCartLoading ? (
                <Group justify="center" py="xl">
                  <Loader color="violet" size="sm" />
                  <Text size="sm" c="dimmed">
                    {t('Завантаження кошика')}
                  </Text>
                </Group>
              ) : cartItems.length > 0 ? (
                <OnlineShopOrderItemsList emptyText={t('Кошик порожній')} items={cartItems} />
              ) : (
                <Text ta="center" c="dimmed" py="xl">
                  {selectedClient ? t('Кошик порожній') : t('Вибери клієнта в таблиці')}
                </Text>
              )}
            </ScrollArea.Autosize>

            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                {t('Разом')}
              </Text>
              <Text fw={700}>{formatAmount(cartTotal)}</Text>
            </Group>
          </Stack>
        </Card>
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

function useRetailClientColumns(): DataTableColumn<RetailClient>[] {
  return useMemo(
    () => [
      {
        id: 'client',
        header: 'Клієнт',
        accessor: getRetailClientName,
        cell: (client) => <OnlineShopClientTableValue fw={600} value={displayValue(getRetailClientName(client))} />,
        minWidth: 220,
        width: 260,
      },
      {
        id: 'phone',
        header: 'Телефон',
        accessor: getRetailClientPhone,
        cell: (client) => <OnlineShopClientTableValue value={displayValue(getRetailClientPhone(client))} />,
        minWidth: 140,
        width: 160,
      },
      {
        id: 'email',
        header: 'Email',
        accessor: getRetailClientEmail,
        cell: (client) => <OnlineShopClientTableValue value={displayValue(getRetailClientEmail(client))} />,
        minWidth: 180,
        width: 240,
      },
      {
        id: 'city',
        header: 'Місто',
        accessor: getRetailClientCity,
        cell: (client) => <OnlineShopClientTableValue value={displayValue(getRetailClientCity(client))} />,
        minWidth: 150,
        width: 180,
      },
    ],
    [],
  )
}

function OnlineShopClientTableValue({ fw, value }: { fw?: number; value: string }) {
  return (
    <Tooltip label={value} openDelay={350} withArrow>
      <Text component="span" fw={fw} style={ONLINE_SHOP_CLIENT_TABLE_CELL_STYLE}>
        {value}
      </Text>
    </Tooltip>
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

function formatAmount(value: number): string {
  return amountFormatter.format(value)
}

function displayValue(value?: number | string | null): string {
  if (typeof value === 'number') {
    return String(value)
  }

  const normalized = value?.trim()
  return normalized || '-'
}
