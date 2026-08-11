import { ActionIcon, Alert, Group, Loader, Skeleton, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { CircleAlert, RefreshCw, RotateCcw, Search } from 'lucide-react'
import { useEffect, useMemo, useReducer } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useValueState } from '../../../shared/hooks/useValueState'
import { ListTreeItem, ListTreeLayout } from '../../../shared/ui/tree/ListTreeLayout'
import { ClientCommercialStructureView } from '../components/structure/ClientCommercialStructureView'
import { getClientCommercialStructure, getClients } from '../api/clientsApi'
import type { Client, ClientCommercialStructure } from '../types'
import '../../../shared/ui/console-table-page.css'
import './clients-structure-tree-page.css'

const SEARCH_DEBOUNCE_MS = 300
const CLIENTS_PAGE_SIZE = 50

/**
 * «Структура клієнтів» — the reusable list+tree pattern applied to clients:
 * left = source client cards, right = a non-destructive commercial projection:
 * commercial group → legal-party candidates → persisted cards → raw 1C evidence.
 * Rendered at 90% screen width.
 */
export function ClientsStructureTreePage() {
  const { t } = useI18n()
  const [clients, setClients] = useValueState<Client[]>([])
  const [selectedNetUid, setSelectedNetUid] = useValueState<string | null>(null)
  const [searchDraft, setSearchDraft] = useValueState('')
  const [searchValue] = useDebouncedValue(searchDraft.trim(), SEARCH_DEBOUNCE_MS)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [structure, setStructure] = useValueState<ClientCommercialStructure | null>(null)
  const [structureError, setStructureError] = useValueState<string | null>(null)
  const [isStructureLoading, setStructureLoading] = useValueState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false
    setLoading(true)
    setError(null)

    void getClients({ limit: CLIENTS_PAGE_SIZE, offset: 0, value: searchValue }, controller.signal)
      .then((result) => {
        if (cancelled) {
          return
        }
        setClients(result)
        setSelectedNetUid((current) =>
          current && result.some((client) => client.NetUid === current) ? current : result[0]?.NetUid || null,
        )
      })
      .catch((loadError: unknown) => {
        if (!cancelled && !(loadError instanceof DOMException && loadError.name === 'AbortError')) {
          setClients([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити клієнтів'))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [reloadKey, searchValue, setClients, setError, setLoading, setSelectedNetUid, t])

  useEffect(() => {
    if (!selectedNetUid) {
      setStructure(null)
      setStructureError(null)
      return
    }

    const controller = new AbortController()
    let cancelled = false
    setStructureLoading(true)
    setStructureError(null)

    void getClientCommercialStructure(selectedNetUid, controller.signal)
      .then((result) => {
        if (cancelled) {
          return
        }
        setStructure(result)
        if (!result) {
          setStructureError(t('Сервер повернув неповну структуру клієнта'))
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled && !(loadError instanceof DOMException && loadError.name === 'AbortError')) {
          setStructure(null)
          setStructureError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити структуру клієнта'))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setStructureLoading(false)
        }
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [reloadKey, selectedNetUid, setStructure, setStructureError, setStructureLoading, t])

  const selectedClient = useMemo(
    () => clients.find((client) => client.NetUid === selectedNetUid) || null,
    [clients, selectedNetUid],
  )
  return (
    <Stack className="clients-structure-page console-table-page" gap={6}>
      <div className="clients-structure-shell console-table-shell">
        <div className="app-filter-bar clients-structure-filter-bar">
          <TextInput
            className="clients-structure-search"
            label={t('Пошук клієнта')}
            leftSection={<Search size={16} />}
            placeholder={t('Назва клієнта')}
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.currentTarget.value)}
          />
          <div className="app-filter-actions clients-structure-filter-actions">
            <Tooltip label={t('Скинути')}>
              <ActionIcon
                aria-label={t('Скинути')}
                color="gray"
                disabled={!searchDraft}
                size={34}
                type="button"
                variant="light"
                onClick={() => setSearchDraft('')}
              >
                <RotateCcw size={17} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Оновити')}>
              <ActionIcon
                aria-label={t('Оновити')}
                color="gray"
                loading={isLoading}
                size={34}
                type="button"
                variant="light"
                onClick={() => reload()}
              >
                <RefreshCw size={17} />
              </ActionIcon>
            </Tooltip>
          </div>
        </div>

        {error ? (
          <Alert className="console-table-alert" color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        ) : null}

        <div className="clients-structure-workspace">
          <ListTreeLayout
            className="clients-structure-layout"
            list={
              <Stack className="clients-structure-list" gap={6}>
            {isLoading ? (
              <Stack gap={5}>
                {Array.from({ length: 7 }, (_, index) => (
                  <Skeleton key={index} height={46} radius={7} />
                ))}
              </Stack>
            ) : clients.length > 0 ? (
              <div className="list-tree-list">
                {clients.map((client, index) => (
                  <ListTreeItem
                    key={getClientKey(client)}
                    index={index}
                    metrics={client.RegionCode?.Value ? [{ value: client.RegionCode.Value, label: '' }] : undefined}
                    name={getClientName(client, t)}
                    selected={client.NetUid === selectedNetUid}
                    onSelect={() => setSelectedNetUid(client.NetUid || null)}
                  />
                ))}
              </div>
            ) : (
              <div className="list-tree-empty">
                <Text c="dimmed" size="sm">
                  {t('Клієнтів не знайдено')}
                </Text>
              </div>
            )}
              </Stack>
            }
            detail={
              isStructureLoading ? (
                <Stack className="clients-structure-detail-skeleton" gap="sm">
                  <Skeleton height={62} radius="md" />
                  <Skeleton height={90} radius="md" />
                  <Skeleton height={180} radius="md" />
                </Stack>
              ) : structureError ? (
                <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
                  {structureError}
                </Alert>
              ) : selectedClient && structure ? (
                <ClientCommercialStructureView structure={structure} t={t} />
              ) : isLoading ? (
                <Group justify="center" gap="xs" py="lg">
                  <Loader size="sm" />
                </Group>
              ) : (
                <Text c="dimmed">{t('Оберіть клієнта зі списку')}</Text>
              )
            }
          />
        </div>
      </div>
    </Stack>
  )
}

function getClientName(client: Client, t: (value: string) => string): string {
  return (
    client.FullName?.trim()
    || client.Name?.trim()
    || [client.LastName, client.FirstName, client.MiddleName].filter(Boolean).join(' ').trim()
    || client.RegionCode?.Value?.trim()
    || t('Без назви')
  )
}

function getClientKey(client: Client): string {
  if (client.NetUid) {
    return `net:${client.NetUid}`
  }
  if (client.Id) {
    return `id:${client.Id}`
  }

  return [
    'source',
    client.ClientNumber || '',
    client.OriginalRegionCode || client.RegionCode?.Value || '',
    client.FullName || client.Name || '',
    client.USREOU || client.TIN || '',
  ].join(':')
}
