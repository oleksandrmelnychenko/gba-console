import { ActionIcon, Alert, Group, Loader, Skeleton, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { CircleAlert, RefreshCw, RotateCcw, Search, User, Users } from 'lucide-react'
import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useValueState } from '../../../shared/hooks/useValueState'
import { ListTreeItem, ListTreeLayout } from '../../../shared/ui/tree/ListTreeLayout'
import { TreeView, type TreeViewNode } from '../../../shared/ui/tree/TreeView'
import { getClientSubClients } from '../api/clientCabinetApi'
import { getClients } from '../api/clientsApi'
import type { Client } from '../types'
import '../../../shared/ui/console-table-page.css'
import './clients-structure-tree-page.css'

const SEARCH_DEBOUNCE_MS = 300
const CLIENTS_PAGE_SIZE = 50

/**
 * «Структура клієнтів» — the reusable list+tree pattern applied to clients:
 * left = client list, right = the selected client's sub-client hierarchy as a
 * lazily-loaded expand/collapse tree (sub-clients fetched per node on expand).
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
  const [childrenByKey, setChildrenByKey] = useValueState<Record<string, Client[]>>({})
  const [loadingKeys, setLoadingKeys] = useValueState<ReadonlySet<string>>(() => new Set())
  const [loadedKeys, setLoadedKeys] = useValueState<ReadonlySet<string>>(() => new Set())
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

  const loadChildren = useCallback(
    (netId: string) => {
      if (!netId || loadedKeys.has(netId) || loadingKeys.has(netId)) {
        return
      }
      setLoadingKeys((current) => new Set(current).add(netId))

      void getClientSubClients(netId)
        .then((links) => {
          const children = links.reduce<Client[]>((acc, link) => {
            if (link.SubClient) {
              acc.push(link.SubClient)
            }
            return acc
          }, [])
          setChildrenByKey((current) => ({ ...current, [netId]: children }))
        })
        .catch(() => {
          setChildrenByKey((current) => ({ ...current, [netId]: current[netId] || [] }))
        })
        .finally(() => {
          setLoadedKeys((current) => new Set(current).add(netId))
          setLoadingKeys((current) => {
            const next = new Set(current)
            next.delete(netId)
            return next
          })
        })
    },
    [loadedKeys, loadingKeys, setChildrenByKey, setLoadedKeys, setLoadingKeys],
  )

  // Auto-load the selected client's direct sub-clients so the tree isn't empty.
  useEffect(() => {
    if (selectedNetUid) {
      loadChildren(selectedNetUid)
    }
  }, [selectedNetUid, loadChildren])

  const buildNode = useCallback(
    function build(client: Client): TreeViewNode {
      const key = clientKey(client)
      const loaded = loadedKeys.has(key)
      const childClients = childrenByKey[key] || []

      return {
        id: key,
        label: getClientName(client, t),
        meta: getClientMeta(client),
        icon: childClients.length > 0 ? <Users size={15} /> : <User size={15} />,
        active: key === selectedNetUid,
        hasChildren: loaded ? childClients.length > 0 : true,
        loading: loadingKeys.has(key),
        onExpand: () => loadChildren(key),
        children: childClients.map(build),
      }
    },
    [childrenByKey, loadChildren, loadedKeys, loadingKeys, selectedNetUid, t],
  )

  const selectedClient = useMemo(
    () => clients.find((client) => client.NetUid === selectedNetUid) || null,
    [clients, selectedNetUid],
  )
  const treeNodes = useMemo(() => (selectedClient ? [buildNode(selectedClient)] : []), [buildNode, selectedClient])

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
                    key={client.NetUid || client.Id || index}
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
              selectedClient ? (
                <TreeView
                  key={selectedNetUid}
                  defaultExpandedDepth={0}
                  emptyText={t('Немає суб-клієнтів')}
                  nodes={treeNodes}
                />
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

function clientKey(client: Client): string {
  return client.NetUid || String(client.Id || '')
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

function getClientMeta(client: Client): string {
  return [client.RegionCode?.Value, client.RegionCode?.City].filter(Boolean).join(' · ')
}
