import { Alert, Button, Group, Loader, Stack, Text } from '@mantine/core'
import { IconAlertCircle, IconPlus, IconUser, IconUsersGroup } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useValueState } from '../../../../shared/hooks/useValueState'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { CREATE_ACTION_COLOR } from '../../../../shared/ui/page-header-actions/PageHeaderActions'
import { TreeView, type TreeViewNode } from '../../../../shared/ui/tree/TreeView'
import { getClientSubClients } from '../../api/clientCabinetApi'
import type { Client } from '../../types'

export type SubClientsPanelProps = {
  client: Client
}

/**
 * Sub-client structure as a lazily-loaded expand/collapse tree (the reusable
 * tree pattern). The current client's direct sub-clients are the top level;
 * each node lazy-loads its own sub-clients on expand.
 */
export function SubClientsPanel({ client }: SubClientsPanelProps) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const netId = client.NetUid
  const [rootChildren, setRootChildren] = useValueState<Client[]>(() => extractSubClients(client))
  const [childrenByKey, setChildrenByKey] = useValueState<Record<string, Client[]>>({})
  const [loadingKeys, setLoadingKeys] = useValueState<ReadonlySet<string>>(() => new Set())
  const [loadedKeys, setLoadedKeys] = useValueState<ReadonlySet<string>>(() => new Set())
  const [isLoading, setLoading] = useValueState(false)
  const [error, setError] = useValueState<string | null>(null)

  useEffect(() => {
    if (!netId) {
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    void getClientSubClients(netId)
      .then((items) => {
        if (!cancelled) {
          setRootChildren(items.reduce<Client[]>((acc, link) => (link.SubClient ? [...acc, link.SubClient] : acc), []))
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити субклієнтів'))
          setRootChildren([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [netId, setError, setLoading, setRootChildren, t])

  const loadChildren = useCallback(
    (subNetId: string) => {
      if (!subNetId || loadedKeys.has(subNetId) || loadingKeys.has(subNetId)) {
        return
      }
      setLoadingKeys((current) => new Set(current).add(subNetId))

      void getClientSubClients(subNetId)
        .then((links) => {
          setChildrenByKey((current) => ({
            ...current,
            [subNetId]: links.reduce<Client[]>((acc, link) => (link.SubClient ? [...acc, link.SubClient] : acc), []),
          }))
        })
        .catch(() => {
          setChildrenByKey((current) => ({ ...current, [subNetId]: current[subNetId] || [] }))
        })
        .finally(() => {
          setLoadedKeys((current) => new Set(current).add(subNetId))
          setLoadingKeys((current) => {
            const next = new Set(current)
            next.delete(subNetId)
            return next
          })
        })
    },
    [loadedKeys, loadingKeys, setChildrenByKey, setLoadedKeys, setLoadingKeys],
  )

  const openSubClient = useCallback(
    (subClientNetId?: string) => {
      if (subClientNetId) {
        navigate(`/clients/edit/${subClientNetId}`)
      }
    },
    [navigate],
  )

  function openNewUser() {
    navigate('/clients/new/role', {
      state: {
        ...(location.state && typeof location.state === 'object' ? location.state : {}),
        backgroundLocation: location,
        parentClientId: netId,
        returnPath: `${location.pathname}${location.search}`,
        returnState: location.state,
      },
    })
  }

  const buildNode = useCallback(
    function build(subClient: Client): TreeViewNode {
      const key = subClient.NetUid || String(subClient.Id || '')
      const loaded = loadedKeys.has(key)
      const childClients = childrenByKey[key] || []

      return {
        id: key,
        label: getSubClientName(subClient, t),
        meta: getSubClientMeta(subClient),
        icon: childClients.length > 0 ? <IconUsersGroup size={15} /> : <IconUser size={15} />,
        hasChildren: loaded ? childClients.length > 0 : true,
        loading: loadingKeys.has(key),
        onExpand: () => loadChildren(key),
        onActivate: () => openSubClient(subClient.NetUid),
        children: childClients.map(build),
      }
    },
    [childrenByKey, loadChildren, loadedKeys, loadingKeys, openSubClient, t],
  )

  const nodes = useMemo(() => rootChildren.map(buildNode), [buildNode, rootChildren])

  return (
    <Stack gap="sm">
      <Group justify="flex-end" align="center">
        <Button color={CREATE_ACTION_COLOR} leftSection={<IconPlus size={16} />} size="xs" onClick={openNewUser}>
          {t('Новий користувач')}
        </Button>
      </Group>

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {error}
        </Alert>
      )}

      {isLoading ? (
        <Group justify="center" py="md">
          <Loader size="sm" />
          <Text c="dimmed" size="sm">
            {t('Завантаження')}
          </Text>
        </Group>
      ) : (
        <TreeView defaultExpandedDepth={0} emptyText={t('Субклієнтів не додано')} nodes={nodes} />
      )}
    </Stack>
  )
}

function extractSubClients(client: Client): Client[] {
  return (client.SubClients || []).reduce<Client[]>((acc, link) => (link.SubClient ? [...acc, link.SubClient] : acc), [])
}

function getSubClientName(client: Client, t: (value: string) => string): string {
  return (
    client.FullName?.trim()
    || client.Name?.trim()
    || [client.LastName, client.FirstName, client.MiddleName].filter(Boolean).join(' ').trim()
    || t('Без назви')
  )
}

function getSubClientMeta(client: Client): string {
  return [client.RegionCode?.Value, client.EmailAddress, client.Abbreviation].filter(Boolean).join(' · ')
}
