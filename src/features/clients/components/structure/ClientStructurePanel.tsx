import { ActionIcon, Alert, Card, Grid, Group, Stack, Tabs, Text, Tooltip } from '@mantine/core'
import { IconAlertCircle, IconUserPlus, IconUsersGroup } from '@tabler/icons-react'
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useValueState } from '../../../../shared/hooks/useValueState'
import { useI18n } from '../../../../shared/i18n/useI18n'
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

export type ClientStructurePanelProps = {
  client: Client
  onChange: (client: Client) => void
}

export function ClientStructurePanel({ client, onChange }: ClientStructurePanelProps) {
  const { t } = useI18n()
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

  useEffect(() => {
    if (!netId) {
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
  }, [netId, setGroups, setWorkplaces, setLoading, setError, t])

  async function reloadGroups() {
    if (!netId) {
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
    if (!netId) {
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
    if (!workplace.NetUid) {
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
    <Stack gap="lg">
      {error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {error}
        </Alert>
      )}

      <Card withBorder padding="md" radius="md">
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Text fw={600}>{t('Структура клієнта')}</Text>
            <Group gap="xs">
              <Tooltip label={t('Підгрупи')}>
                <ActionIcon
                  color="violet"
                  size="lg"
                  variant="light"
                  onClick={() => setGroupsModalOpened(true)}
                >
                  <IconUsersGroup size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={t('Новий користувач')}>
                <ActionIcon color="violet" size="lg" variant="light" onClick={openNewUser}>
                  <IconUserPlus size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>

          <Tabs defaultValue="subClients" keepMounted={false}>
            <Tabs.List>
              <Tabs.Tab value="subClients">{t('Субклієнти')}</Tabs.Tab>
              <Tabs.Tab value="workplaces">{t('Робочі місця')}</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="subClients" pt="md">
              <SubClientsPanel client={client} />
            </Tabs.Panel>

            <Tabs.Panel value="workplaces" pt="md">
              <WorkplacesPanel
                client={client}
                error={null}
                groups={groups}
                isLoading={isLoading}
                isRemoving={isRemoving}
                isSaving={isSaving}
                workplaces={workplaces}
                onCreate={(workplace) => void handleCreateWorkplace(workplace)}
                onRemove={(workplace) => void handleRemoveWorkplace(workplace)}
                onUpdate={(workplace) => void handleUpdateWorkplace(workplace)}
              />
            </Tabs.Panel>
          </Tabs>
        </Stack>
      </Card>

      <Grid gap="lg">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder padding="md" radius="md">
            <ServicePayersPanel
              payers={client.ServicePayers || []}
              onChange={handleServicePayersChange}
            />
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder padding="md" radius="md">
            <DeliveryRecipientsPanel clientId={clientId} clientNetId={netId || ''} />
          </Card>
        </Grid.Col>
      </Grid>

      <GroupsModal
        clientId={clientId}
        clientNetId={netId || ''}
        opened={groupsModalOpened}
        onChange={handleGroupsChange}
        onClose={() => setGroupsModalOpened(false)}
      />
    </Stack>
  )
}
