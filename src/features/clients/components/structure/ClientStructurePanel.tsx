import { Alert, Button, Card, Group, Stack, Tabs } from '@mantine/core'
import { Building2, CircleAlert, FolderTree, Monitor, UserPlus, Users } from 'lucide-react'
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useValueState } from '../../../../shared/hooks/useValueState'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { PermissionKeys } from '../../../../shared/auth/permissionKeys'
import { CREATE_ACTION_COLOR } from '../../../../shared/ui/page-header-actions/PageHeaderActions'
import { getClientGroups, getClientWorkplaces } from '../../api/clientLookupsApi'
import {
  createClientWorkplace,
  removeClientWorkplace,
  updateClientWorkplace,
} from '../../api/clientCabinetApi'
import { ServicePayersPanel } from '../pricing/ServicePayersPanel'
import type { Client, ClientGroup, ClientWorkplace, ServicePayer } from '../../types'
import { DeliveryRecipientsPanel } from './DeliveryRecipientsPanel'
import { GroupsModal } from './GroupsModal'
import { SubClientsPanel } from './SubClientsPanel'
import { WorkplacesPanel } from './WorkplacesPanel'
import { useAuth } from '../../../auth/useAuth'

export type ClientStructurePanelProps = {
  client: Client
  onChange: (client: Client) => void
}

export function ClientStructurePanel({ client, onChange }: ClientStructurePanelProps) {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const netId = client.NetUid
  const clientId = typeof client.Id === 'number' ? client.Id : 0

  const [groups, setGroups] = useValueState<ClientGroup[]>([])
  const [workplaces, setWorkplaces] = useValueState<ClientWorkplace[]>([])
  const [isLoading, setLoading] = useValueState(false)
  const [isSaving, setSaving] = useValueState(false)
  const [isRemoving, setRemoving] = useValueState(false)
  const [error, setError] = useValueState<string | null>(null)
  const [groupsModalOpened, setGroupsModalOpened] = useValueState(false)
  const canViewStructure = hasPermission(PermissionKeys.Clients.Structure.Open)
  const canCreateClient = hasPermission(PermissionKeys.Clients.Client.Create)
  const canOpenClientDetails = hasPermission(PermissionKeys.Clients.Details.Open)
  const canEditClient = hasPermission(PermissionKeys.Clients.Client.Edit)
  const canManageGroups = hasPermission(PermissionKeys.Clients.Structure.ManageGroups)
  const canManageWorkplaces = hasPermission(PermissionKeys.Clients.Structure.ManageWorkplaces)
  const canDeleteWorkplace = hasPermission(PermissionKeys.Clients.Structure.DeleteWorkplace)
  const canCreateDeliveryRecipient = hasPermission(PermissionKeys.Clients.Structure.CreateDeliveryRecipient)
  const canDeleteDeliveryRecipient = hasPermission(PermissionKeys.Clients.Structure.DeleteDeliveryRecipient)

  useEffect(() => {
    if (!canViewStructure || !netId) {
      return
    }

    let cancelled = false

    async function loadStructure(id: string) {
      setLoading(true)
      setError(null)

      try {
        const [loadedGroups, loadedWorkplaces] = await Promise.all([
          getClientGroups(id),
          getClientWorkplaces(id),
        ])

        if (!cancelled) {
          setGroups(loadedGroups)
          setWorkplaces(loadedWorkplaces)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити структуру клієнта'))
          setGroups([])
          setWorkplaces([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadStructure(netId)

    return () => {
      cancelled = true
    }
  }, [canViewStructure, netId, setGroups, setWorkplaces, setLoading, setError, t])

  async function reloadGroups() {
    if (!canViewStructure || !netId) {
      return
    }

    try {
      const loadedGroups = await getClientGroups(netId)
      setGroups(loadedGroups)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити групи'))
    }
  }

  async function reloadWorkplaces() {
    if (!canViewStructure || !netId) {
      return
    }

    try {
      const loadedWorkplaces = await getClientWorkplaces(netId)
      setWorkplaces(loadedWorkplaces)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити робочі місця'))
    }
  }

  async function handleCreateWorkplace(workplace: ClientWorkplace) {
    if (!canManageWorkplaces) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      await createClientWorkplace(workplace)
      await reloadWorkplaces()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : t('Не вдалося створити робоче місце'))
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateWorkplace(workplace: ClientWorkplace) {
    if (!canManageWorkplaces) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      await updateClientWorkplace(workplace)
      await reloadWorkplaces()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : t('Не вдалося оновити робоче місце'))
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveWorkplace(workplace: ClientWorkplace) {
    if (!canDeleteWorkplace || !workplace.NetUid) {
      return
    }

    setRemoving(true)
    setError(null)

    try {
      await removeClientWorkplace(workplace.NetUid)
      await reloadWorkplaces()
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : t('Не вдалося заблокувати робоче місце'))
    } finally {
      setRemoving(false)
    }
  }

  function handleGroupsChange() {
    void reloadWorkplaces()
    void reloadGroups()
  }

  function openNewUser() {
    if (!canCreateClient) {
      return
    }

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

  function handleServicePayersChange(payers: ServicePayer[]) {
    onChange({
      ...client,
      ServicePayers: payers,
    })
  }

  return (
    <Stack className="client-structure-editor" gap="sm">
      {error && (
        <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
          {error}
        </Alert>
      )}

      <Card className="app-section-card client-structure-card" withBorder padding={0} radius="md">
        <Tabs className="client-structure-tabs-root" defaultValue="structuralUnits" keepMounted={false}>
          <Tabs.List className="pill-tabs client-structure-tabs">
            <Tabs.Tab leftSection={<Building2 size={16} />} value="structuralUnits">{t('Структурні підрозділи')}</Tabs.Tab>
            <Tabs.Tab leftSection={<Users size={16} />} value="subClients">{t('Сабклієнти')}</Tabs.Tab>
            <Tabs.Tab leftSection={<Monitor size={16} />} value="workplaces">{t('Робочі місця')}</Tabs.Tab>
          </Tabs.List>

          <Group className="app-filter-bar client-structure-toolbar" justify="flex-end" align="center">
            {canManageGroups && (
              <Button color="gray" variant="default" leftSection={<FolderTree size={16} />} onClick={() => setGroupsModalOpened(true)}>
                {t('Підгрупи')}
              </Button>
            )}
            {canCreateClient && (
              <Button color={CREATE_ACTION_COLOR} leftSection={<UserPlus size={16} />} onClick={openNewUser}>
                {t('Новий клієнт')}
              </Button>
            )}
          </Group>

          <Tabs.Panel className="client-structure-panel" value="structuralUnits">
            <SubClientsPanel
              canCreateClient={false}
              canOpenDetails={canOpenClientDetails}
              client={client}
              relationKind="structural-unit"
            />
          </Tabs.Panel>

          <Tabs.Panel className="client-structure-panel" value="subClients">
            <SubClientsPanel
              canCreateClient={canCreateClient}
              canOpenDetails={canOpenClientDetails}
              client={client}
              relationKind="subclient"
            />
          </Tabs.Panel>

          <Tabs.Panel className="client-structure-panel" value="workplaces">
            <WorkplacesPanel
              client={client}
              error={null}
              groups={groups}
              isLoading={isLoading}
              isRemoving={isRemoving}
              isSaving={isSaving}
              workplaces={workplaces}
              canDelete={canDeleteWorkplace}
              canManage={canManageWorkplaces}
              onCreate={(workplace) => void handleCreateWorkplace(workplace)}
              onRemove={(workplace) => void handleRemoveWorkplace(workplace)}
              onUpdate={(workplace) => void handleUpdateWorkplace(workplace)}
            />
          </Tabs.Panel>
        </Tabs>
      </Card>

      <div className="client-structure-related">
        <div>
            <ServicePayersPanel
              disabled={!canEditClient}
              payers={client.ServicePayers || []}
              onChange={handleServicePayersChange}
            />
        </div>
        <div>
            <DeliveryRecipientsPanel
              canCreate={canCreateDeliveryRecipient}
              canDelete={canDeleteDeliveryRecipient}
              clientId={clientId}
              clientNetId={netId || ''}
            />
        </div>
      </div>

      <GroupsModal
        canManage={canManageGroups}
        clientId={clientId}
        clientNetId={netId || ''}
        opened={groupsModalOpened}
        onChange={handleGroupsChange}
        onClose={() => setGroupsModalOpened(false)}
      />
    </Stack>
  )
}
