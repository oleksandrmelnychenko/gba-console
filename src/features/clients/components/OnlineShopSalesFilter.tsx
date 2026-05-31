import { Loader, Popover, ScrollArea, Stack, Text, TextInput, UnstyledButton } from '@mantine/core'
import { useDebouncedValue, useDisclosure } from '@mantine/hooks'
import { IconSearch } from '@tabler/icons-react'
import { useEffect, useMemo, useRef } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getRetailClients, searchRetailClients } from '../api/onlineShopClientsApi'
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
  const [visibleCount, setVisibleCount] = useValueState(FAST_CLIENT_PAGE_SIZE)
  const [isLoading, setLoading] = useValueState(false)
  const normalizedSearchValue = debouncedSearchValue.trim()
  const onGetAllSalesRef = useRef(onGetAllSales)
  const onClearSalesRef = useRef(onClearSales)

  useEffect(() => {
    onGetAllSalesRef.current = onGetAllSales
    onClearSalesRef.current = onClearSales
  })

  useEffect(() => {
    let cancelled = false

    async function loadFastClients() {
      setLoading(true)

      try {
        const nextClients = normalizedSearchValue
          ? await searchRetailClients(normalizedSearchValue)
          : await (async () => {
              onGetAllSalesRef.current?.()
              return getRetailClients()
            })()

        if (!cancelled) {
          setClients(nextClients)
          setVisibleCount(FAST_CLIENT_PAGE_SIZE)
        }
      } catch {
        if (!cancelled) {
          setClients([])
          setVisibleCount(FAST_CLIENT_PAGE_SIZE)
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
  }, [normalizedSearchValue, setClients, setLoading, setVisibleCount])

  const visibleClients = useMemo(() => clients.slice(0, visibleCount), [clients, visibleCount])

  function loadMore() {
    if (visibleCount >= clients.length) {
      return
    }

    setVisibleCount((count) => count + FAST_CLIENT_PAGE_SIZE)
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
            <Loader color="violet" size="sm" />
          </Stack>
        ) : visibleClients.length > 0 ? (
          <ScrollArea.Autosize mah={280} type="auto" onBottomReached={loadMore}>
            <Stack gap={0} p={4}>
              {visibleClients.map((client, index) => (
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
