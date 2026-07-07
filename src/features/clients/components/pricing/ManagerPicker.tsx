import {
  Alert,
  Avatar,
  Badge,
  Box,
  Group,
  Loader,
  Stack,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core'
import { CircleAlert, Search, User } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { getPurchaseManagers, getSaleManagers } from '../../api/clientLookupsApi'
import type { Client, ClientUserProfile, Manager } from '../../types'
import './manager-picker.css'

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

    return managers.filter((manager) =>
      [
        getManagerFullName(manager),
        manager.Abbreviation,
        manager.UserRole?.Name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term),
    )
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
    <Stack className="manager-pick" gap="sm">
      <Stack gap={6}>
        <Group justify="space-between" align="center">
          <Title className="manager-pick-title client-section-title" order={5}>
            {t('Аналітики')}
          </Title>
          <Badge className="manager-pick-pill" color="gray" variant="light">
            {filteredManagers.length}
          </Badge>
        </Group>
        <TextInput
          className="manager-pick-search"
          disabled={disabled}
          leftSection={<Search size={16} />}
          placeholder={t('Пошук')}
          size="sm"
          value={search}
          w="100%"
          onChange={(event) => setSearch(event.currentTarget.value)}
        />
      </Stack>

      {error && (
        <Alert color="red" icon={<CircleAlert size={16} />} variant="light">
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
        <Box className="manager-pick-scroll">
          <Stack className="manager-pick-list" gap="xs">
            {filteredManagers.map((manager, index) => {
              const isSelected = Boolean(selectedNetUid && manager.NetUid === selectedNetUid)
              const isMainManager =
                typeof client.MainManagerId === 'number' && client.MainManagerId === manager.Id

              return (
                <UnstyledButton
                  key={manager.NetUid || manager.Id || index}
                  aria-pressed={isSelected}
                  className="manager-pick-button"
                  disabled={disabled}
                  onClick={() => handleSelect(manager)}
                >
                  <div className={`manager-pick-item${isSelected ? ' is-selected' : ''}`}>
                    <Group gap="sm" align="center" wrap="nowrap" w="100%">
                      <Avatar
                        className="manager-pick-avatar"
                        color="gray"
                        radius="xl"
                        size={46}
                        variant="light"
                      >
                        <User size={22} strokeWidth={1.6} />
                      </Avatar>

                      <Stack flex={1} gap={4} miw={0}>
                        <Group gap="xs" miw={0} wrap="nowrap">
                          <Text className="manager-pick-name" fw={600} size="sm" truncate>
                            {getManagerFullName(manager)}
                          </Text>
                          {isMainManager && (
                            <Badge
                              className="manager-pick-pill"
                              color="yellow"
                              size="xs"
                              variant="light"
                            >
                              {t('Головний')}
                            </Badge>
                          )}
                        </Group>
                        {manager.UserRole?.Name && (
                          <Badge
                            className="manager-pick-pill manager-pick-role"
                            color="gray"
                            radius="sm"
                            size="sm"
                            variant="light"
                          >
                            {manager.UserRole.Name}
                          </Badge>
                        )}
                      </Stack>
                    </Group>
                  </div>
                </UnstyledButton>
              )
            })}
          </Stack>
        </Box>
      )}
    </Stack>
  )
}
