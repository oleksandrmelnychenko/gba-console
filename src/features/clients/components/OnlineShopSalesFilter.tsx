import { Loader, Popover, ScrollArea, Stack, Text, TextInput, UnstyledButton } from '@mantine/core'
import { useDebouncedValue, useDisclosure } from '@mantine/hooks'
import { IconSearch } from '@tabler/icons-react'
import { useEffect, useRef } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getRetailClientsPage, searchRetailClientsPage } from '../api/onlineShopClientsApi'
import type { RetailClient } from '../onlineShopTypes'

const FAST_CLIENT_PAGE_SIZE = 20
const FAST_CLIENT_SEARCH_DEBOUNCE_MS = 100

export type OnlineShopSalesFilterProps = {
  onSelectFastClient: (client: RetailClient) => void
  onClearSales?: () => void
  onGetAllSales?: () => void
}

export function OnlineShopSalesFilter({ onClearSales, onGetAllSales, onSelectFastClient }: OnlineShopSalesFilterProps) {
  const { t } = useI18n()
  const [opened, { close, open }] = useDisclosure(false)
  const [searchValue, setSearchValue] = useValueState('')
  const [debouncedSearchValue] = useDebouncedValue(searchValue, FAST_CLIENT_SEARCH_DEBOUNCE_MS)
  const [clients, setClients] = useValueState<RetailClient[]>([])
  const [totalClients, setTotalClients] = useValueState(0)
  const [isLoading, setLoading] = useValueState(false)
  const [isLoadingMore, setLoadingMore] = useValueState(false)
  const normalizedSearchValue = debouncedSearchValue.trim()
  const onGetAllSalesRef = useRef(onGetAllSales)
  const onClearSalesRef = useRef(onClearSales)
  const canLoadMore = clients.length < totalClients

  useEffect(() => {
    onGetAllSalesRef.current = onGetAllSales
    onClearSalesRef.current = onClearSales
  })

  useEffect(() => {
    let cancelled = false

    async function loadFastClients() {
      setLoading(true)
      setLoadingMore(false)

      try {
        const response = normalizedSearchValue
          ? await searchRetailClientsPage(normalizedSearchValue, { limit: FAST_CLIENT_PAGE_SIZE, offset: 0 })
          : await (async () => {
              onGetAllSalesRef.current?.()
              return getRetailClientsPage({ limit: FAST_CLIENT_PAGE_SIZE, offset: 0 })
            })()

        if (!cancelled) {
          setClients(response.Items)
          setTotalClients(response.Total)
        }
      } catch {
        if (!cancelled) {
          setClients([])
          setTotalClients(0)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadFastClients()

    return () => {
      cancelled = true
    }
  }, [normalizedSearchValue, setClients, setLoading, setLoadingMore, setTotalClients])

  async function loadMore() {
    if (!canLoadMore || isLoading || isLoadingMore) {
      return
    }

    setLoadingMore(true)

    try {
      const response = normalizedSearchValue
        ? await searchRetailClientsPage(normalizedSearchValue, { limit: FAST_CLIENT_PAGE_SIZE, offset: clients.length })
        : await getRetailClientsPage({ limit: FAST_CLIENT_PAGE_SIZE, offset: clients.length })

      setClients((currentClients) => [...currentClients, ...response.Items])
      setTotalClients(response.Total)
    } catch {
      setTotalClients(clients.length)
    } finally {
      setLoadingMore(false)
    }
  }

  function selectClient(client: RetailClient) {
    if (getFastClientId(client) > 0) {
      onSelectFastClient(client)
    }

    onClearSalesRef.current?.()
    close()
  }

  return (
    <Popover opened={opened} width="target" position="bottom-start" shadow="md" onClose={close}>
      <Popover.Target>
        <TextInput
          leftSection={<IconSearch size={16} />}
          label={t('Пошук')}
          placeholder={t('Пошук по номеру телефону')}
          value={searchValue}
          onChange={(event) => setSearchValue(event.currentTarget.value)}
          onFocus={open}
          onClick={open}
        />
      </Popover.Target>
      <Popover.Dropdown p={0}>
        {isLoading ? (
          <Stack align="center" gap="xs" py="md">
            <Loader color="orange" size="sm" />
          </Stack>
        ) : clients.length > 0 ? (
          <ScrollArea.Autosize mah={280} type="auto" onBottomReached={loadMore}>
            <Stack gap={0} p={4}>
              {clients.map((client, index) => (
                <UnstyledButton
                  key={getFastClientNetUid(client) || String(getFastClientId(client) || index)}
                  px="sm"
                  py={6}
                  onClick={() => selectClient(client)}
                >
                  <Text size="sm" truncate>
                    {getFastClientLabel(client)}
                  </Text>
                </UnstyledButton>
              ))}
              {isLoadingMore && (
                <Stack align="center" gap="xs" py="sm">
                  <Loader color="orange" size="xs" />
                </Stack>
              )}
            </Stack>
          </ScrollArea.Autosize>
        ) : (
          <Text c="dimmed" size="sm" py="md" ta="center">
            {t('Нічого не знайдено')}
          </Text>
        )}
      </Popover.Dropdown>
    </Popover>
  )
}

function getFastClientLabel(client: RetailClient): string {
  return `${getFastClientPhone(client)} - ${getFastClientName(client)}`
}

function getFastClientPhone(client: RetailClient): string {
  return client.PhoneNumber?.trim() || client.Phone?.trim() || client.MobileNumber?.trim() || ''
}

function getFastClientName(client: RetailClient): string {
  return client.Name?.trim() || client.FullName?.trim() || ''
}

function getFastClientNetUid(client: RetailClient): string {
  return client.NetUid?.trim() || ''
}

function getFastClientId(client: RetailClient): number {
  return typeof client.Id === 'number' ? client.Id : 0
}
