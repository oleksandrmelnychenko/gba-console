import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Card,
  Drawer,
  Group,
  Loader,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { IconAlertCircle, IconReceipt, IconRestore, IconSearch } from '@tabler/icons-react'
import { useEffect, useMemo, useRef } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { getRetailClientCart, getRetailClients, searchRetailClients } from '../api/onlineShopClientsApi'
import { OnlineShopOrderItemsList } from '../components/OnlineShopOrderItemsList'
import { OnlineShopSalesPanel } from '../components/OnlineShopSalesPanel'
import { getRetailItemTotal } from '../onlineShopDisplay'
import type { RetailCartItem, RetailClient } from '../onlineShopTypes'

const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})
const ONLINE_SHOP_CLIENT_SEARCH_DEBOUNCE_MS = 350
const ONLINE_SHOP_CLIENT_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['client'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

export function OnlineShopClientsPage() {
  const { t } = useI18n()
  const [clients, setClients] = useValueState<RetailClient[]>([])
  const [selectedClient, setSelectedClient] = useValueState<RetailClient | null>(null)
  const [cartItems, setCartItems] = useValueState<RetailCartItem[]>([])
  const [searchValue, setSearchValue] = useValueState('')
  const [debouncedSearchValue] = useDebouncedValue(searchValue, ONLINE_SHOP_CLIENT_SEARCH_DEBOUNCE_MS)
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
  const cartTotal = useMemo(() => cartItems.reduce((total, item) => total + getRetailItemTotal(item), 0), [cartItems])
  const clientColumns = useRetailClientColumns()
  const tableToolbarLeft = useMemo(
    () => (
      <Text size="xs" c="dimmed">
        {t('Записів')}: {clients.length}
        {normalizedSearchValue ? `, ${t('пошук')}: ${normalizedSearchValue}` : ''}
      </Text>
    ),
    [clients.length, normalizedSearchValue, t],
  )

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
        const nextClients = normalizedSearchValue ? await searchRetailClients(normalizedSearchValue) : await getRetailClients()

        if (!cancelled) {
          setClients(nextClients)
        }
      } catch (loadError) {
        if (!cancelled) {
          setClients([])
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
  }, [normalizedSearchValue, setCartError, setCartItems, setCartLoading, setClients, setError, setLoading, setSelectedClient, t])

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
  }

  function openSalesDrawer() {
    if (selectedClientNetId) {
      setSalesOpen(true)
    }
  }

  return (
    <Stack gap="lg">
      <Box
        style={{
          alignItems: 'start',
          display: 'grid',
          gap: 'var(--mantine-spacing-lg)',
          gridTemplateColumns: 'minmax(0, 7fr) minmax(320px, 3fr)',
        }}
      >
        <Card withBorder radius="md" padding="md" style={{ minWidth: 0 }}>
          <Stack gap="md">
            <Group align="end" gap="sm" wrap="nowrap">
              <TextInput
                leftSection={<IconSearch size={16} />}
                label={t('Пошук')}
                placeholder={t('Клієнт, телефон або email')}
                value={searchValue}
                onChange={(event) => setSearchValue(event.currentTarget.value)}
                style={{ flex: 1 }}
              />
              <Tooltip label={t('Скинути')}>
                <ActionIcon variant="light" color="gray" size={36} aria-label={t('Скинути')} onClick={resetSearch}>
                  <IconRestore size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>

            {error && (
              <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
                {error}
              </Alert>
            )}

            <DataTable
              columns={clientColumns}
              data={clients}
              defaultLayout={ONLINE_SHOP_CLIENT_TABLE_DEFAULT_LAYOUT}
              emptyText={t('Клієнтів інтернет-магазину не знайдено')}
              getRowId={(client, index) => getRetailClientRowKey(client, index)}
              height="calc(100vh - 282px)"
              isLoading={isTableBusy}
              layoutVersion="online-shop-clients-table-default-freeze-1"
              loadingText={isSearchSettling ? t('Пошук клієнтів') : t('Завантаження клієнтів')}
              minWidth={880}
              rowClassName={(client) => (isSameRetailClient(client, selectedClient) ? 'is-selected' : undefined)}
              tableId="online-shop-clients"
              toolbarLeft={tableToolbarLeft}
              onRowClick={(client) => {
                void selectClient(client)
              }}
            />
          </Stack>
        </Card>

        <Card withBorder radius="md" padding="md" style={{ minWidth: 0 }}>
          <Stack gap="md">
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

      <Drawer
        opened={isSalesOpen}
        position="right"
        size="calc(100% - 100px)"
        title={t('Продажі')}
        onClose={() => setSalesOpen(false)}
      >
        <OnlineShopSalesPanel netUid={selectedClientNetId} />
      </Drawer>
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
        cell: (client) => <Text fw={700}>{displayValue(getRetailClientName(client))}</Text>,
        minWidth: 220,
        width: 300,
      },
      {
        id: 'phone',
        header: 'Телефон',
        accessor: getRetailClientPhone,
        cell: (client) => displayValue(getRetailClientPhone(client)),
        minWidth: 140,
        width: 160,
      },
      {
        id: 'email',
        header: 'Email',
        accessor: getRetailClientEmail,
        cell: (client) => displayValue(getRetailClientEmail(client)),
        minWidth: 180,
        width: 240,
      },
      {
        id: 'city',
        header: 'Місто',
        accessor: getRetailClientCity,
        cell: (client) => displayValue(getRetailClientCity(client)),
        minWidth: 150,
        width: 180,
      },
    ],
    [],
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
