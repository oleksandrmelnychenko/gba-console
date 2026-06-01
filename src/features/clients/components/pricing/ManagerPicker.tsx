import {
  Alert,
  Avatar,
  Badge,
  Card,
  Group,
  Loader,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core'
import { IconAlertCircle, IconSearch } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { getPurchaseManagers, getSaleManagers } from '../../api/clientLookupsApi'
import type { Client, ClientUserProfile, Manager } from '../../types'

export type ManagerPickerRole = 'buyer' | 'provider'

export type ManagerPickerProps = {
  client: Client
  role: ManagerPickerRole
  onChange: (client: Client) => void
  disabled?: boolean
}

function getSelectedManagerNetUid(client: Client): string | undefined {
  const managers = client.ClientManagers || []

  for (const clientManager of managers) {
    if (clientManager.UserProfile && clientManager.UserProfile.NetUid) {
      return clientManager.UserProfile.NetUid
    }
  }

  return undefined
}

function getManagerFullName(manager: Manager): string {
  return [manager.LastName, manager.FirstName, manager.MiddleName]
    .filter((part) => Boolean(part))
    .join(' ')
}

export function ManagerPicker({ client, role, onChange, disabled = false }: ManagerPickerProps) {
  const { t } = useI18n()
  const [managers, setManagers] = useState<Manager[]>([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadManagers() {
      setLoading(true)
      setError(null)

      try {
        const loaded = role === 'provider' ? await getPurchaseManagers() : await getSaleManagers()

        if (!cancelled) {
          setManagers(loaded)
        }
      } catch (loadError) {
        if (!cancelled) {
          setManagers([])
          setError(
            loadError instanceof Error
              ? loadError.message
              : t('Не вдалося завантажити менеджерів'),
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadManagers()

    return () => {
      cancelled = true
    }
  }, [role, t])

  const selectedNetUid = useMemo(() => getSelectedManagerNetUid(client), [client])

  const filteredManagers = useMemo(() => {
    const term = search.trim().toLowerCase()

    if (!term) {
      return managers
    }

    return managers.filter((manager) => (manager.LastName || '').toLowerCase().indexOf(term) !== -1)
  }, [managers, search])

  function handleSelect(manager: Manager) {
    if (disabled) {
      return
    }

    if (selectedNetUid && manager.NetUid === selectedNetUid) {
      onChange({
        ...client,
        ClientManagers: [],
      })
      return
    }

    const existing = client.ClientManagers || []
    let nextManagers: ClientUserProfile[]

    if (existing.length) {
      nextManagers = existing.map((clientManager, index) =>
        index === 0 ? { ...clientManager, UserProfile: manager } : clientManager,
      )
    } else {
      nextManagers = [{ UserProfile: manager }]
    }

    onChange({
      ...client,
      ClientManagers: nextManagers,
    })
  }

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="center">
        <Title order={5}>{t('Аналітики')}</Title>
        <TextInput
          disabled={disabled}
          leftSection={<IconSearch size={16} />}
          placeholder={t('Пошук')}
          size="xs"
          value={search}
          w={220}
          onChange={(event) => setSearch(event.currentTarget.value)}
        />
      </Group>

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={16} />} variant="light">
          {error}
        </Alert>
      )}

      {isLoading ? (
        <Group justify="center" py="md">
          <Loader size="sm" />
        </Group>
      ) : filteredManagers.length === 0 ? (
        <Text c="dimmed" size="sm">
          {managers.length === 0 ? t('Менеджерів не знайдено') : t('Нічого не знайдено')}
        </Text>
      ) : (
        <ScrollArea.Autosize mah={360} type="auto">
          <Stack gap="xs">
            {filteredManagers.map((manager, index) => {
              const isSelected = Boolean(selectedNetUid && manager.NetUid === selectedNetUid)
              const isMainManager =
                typeof client.MainManagerId === 'number' && client.MainManagerId === manager.Id
              const cardBorder = isSelected
                ? '2px solid var(--mantine-color-violet-6)'
                : isMainManager
                  ? '2px solid var(--mantine-color-yellow-5)'
                  : undefined
              const cardBackground = isSelected ? 'var(--mantine-color-violet-light)' : undefined

              return (
                <UnstyledButton
                  key={manager.NetUid || manager.Id || index}
                  disabled={disabled}
                  onClick={() => handleSelect(manager)}
                >
                  <Card
                    bd={cardBorder}
                    bg={cardBackground}
                    padding="sm"
                    radius="md"
                    withBorder
                  >
                    <Group gap="sm" align="flex-start" wrap="nowrap">
                      <Avatar
                        color={manager.IsActive ? 'teal' : 'gray'}
                        fw={600}
                        fz="sm"
                        radius="xl"
                        size={40}
                        variant="filled"
                      >
                        {manager.Abbreviation}
                      </Avatar>

                      <Stack flex={1} gap={2} miw={0}>
                        <Group gap="xs" wrap="nowrap">
                          <Text fw={600} size="sm" truncate>
                            {getManagerFullName(manager)}
                          </Text>
                          {isMainManager && (
                            <Badge color="yellow" size="xs" variant="light">
                              {t('Головний')}
                            </Badge>
                          )}
                        </Group>
                        {manager.UserRole?.Name && (
                          <Text c="dimmed" size="xs">
                            {manager.UserRole.Name}
                          </Text>
                        )}
                      </Stack>
                    </Group>
                  </Card>
                </UnstyledButton>
              )
            })}
          </Stack>
        </ScrollArea.Autosize>
      )}
    </Stack>
  )
}
