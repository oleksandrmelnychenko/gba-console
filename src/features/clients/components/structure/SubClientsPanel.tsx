import { Alert, Button, Group, Loader, Stack, Text, UnstyledButton } from '@mantine/core'
import { IconAlertCircle, IconPlus } from '@tabler/icons-react'
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useValueState } from '../../../../shared/hooks/useValueState'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { getClientSubClients } from '../../api/clientCabinetApi'
import type { Client, ClientSubClient } from '../../types'

export type SubClientsPanelProps = {
  client: Client
}

function getSubClientName(client?: Client): string {
  return client?.FullName?.trim() || client?.Name?.trim() || ''
}

export function SubClientsPanel({ client }: SubClientsPanelProps) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const netId = client.NetUid
  const [subClients, setSubClients] = useValueState<ClientSubClient[]>(client.SubClients || [])
  const [isLoading, setLoading] = useValueState(false)
  const [error, setError] = useValueState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadSubClients() {
      if (!netId) {
        return
      }

      setLoading(true)
      setError(null)

      try {
        const items = await getClientSubClients(netId)

        if (!cancelled) {
          setSubClients(items)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити субклієнтів'))
          setSubClients([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadSubClients()

    return () => {
      cancelled = true
    }
  }, [netId, setSubClients, setLoading, setError, t])

  function openSubClient(subClientNetId?: string) {
    if (!subClientNetId) {
      return
    }

    navigate(`/clients/edit/${subClientNetId}`)
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

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="center">
        <Text fw={600}>{t('Субклієнти')}</Text>
        <Button
          color="violet"
          leftSection={<IconPlus size={16} />}
          size="xs"
          variant="light"
          onClick={openNewUser}
        >
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
          <Loader color="violet" size="sm" />
          <Text c="dimmed" size="sm">
            {t('Завантаження')}
          </Text>
        </Group>
      ) : subClients.length === 0 ? (
        <Text c="dimmed" size="sm">
          {t('Субклієнтів не додано')}
        </Text>
      ) : (
        <Stack gap="xs">
          {subClients.map((subClient, index) => {
            const sub = subClient.SubClient

            return (
              <UnstyledButton
                key={subClient.NetUid || sub?.NetUid || index}
                p="sm"
                style={{
                  border: '1px solid var(--mantine-color-default-border)',
                  borderRadius: 'var(--mantine-radius-sm)',
                }}
                onClick={() => openSubClient(sub?.NetUid)}
              >
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Stack gap={2}>
                    <Text fw={500}>{getSubClientName(sub) || t('Без назви')}</Text>
                    {sub?.EmailAddress && (
                      <Text c="dimmed" size="sm">
                        {sub.EmailAddress}
                      </Text>
                    )}
                  </Stack>
                  {sub?.Abbreviation && (
                    <Text c="dimmed" size="sm">
                      {sub.Abbreviation}
                    </Text>
                  )}
                </Group>
              </UnstyledButton>
            )
          })}
        </Stack>
      )}
    </Stack>
  )
}
