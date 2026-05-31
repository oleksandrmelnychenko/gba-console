import { Badge, Box, Button, Group, Loader, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import { useEffect } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useAuth } from '../../auth/useAuth'
import { getClientTypes } from '../api/clientsApi'
import { getClientTypePermission, getClientTypeRolePermission } from '../permissions'
import type { ClientType, ClientTypeRole } from '../types'

type EditClientTypePanelProps = {
  opened: boolean
  currentTypeNetUid?: string
  currentRoleNetUid?: string
  currentRoleId?: number
  onClose: () => void
  onSelect: (clientType: ClientType, role: ClientTypeRole) => void
}

export function EditClientTypePanel({
  opened,
  currentTypeNetUid,
  currentRoleNetUid,
  currentRoleId,
  onClose,
  onSelect,
}: EditClientTypePanelProps) {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const [clientTypes, setClientTypes] = useValueState<ClientType[]>([])
  const [isLoading, setLoading] = useValueState(false)
  const [error, setError] = useValueState<string | null>(null)

  useEffect(() => {
    if (!opened) {
      return
    }

    let cancelled = false

    async function loadClientTypes() {
      setLoading(true)
      setError(null)

      try {
        const nextClientTypes = await getClientTypes()

        if (!cancelled) {
          setClientTypes(nextClientTypes)
        }
      } catch (loadError) {
        if (!cancelled) {
          setClientTypes([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити ролі'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadClientTypes()

    return () => {
      cancelled = true
    }
  }, [opened, setClientTypes, setError, setLoading, t])

  return (
    <AppDrawer opened={opened} position="right" size="min(520px, 100vw)" title={t('Тип клієнта')} onClose={onClose}>
      <Stack gap="md">
        {error && (
          <Text c="red" size="sm">
            {error}
          </Text>
        )}

        {isLoading ? (
          <Group justify="center" py="xl">
            <Loader color="violet" size="sm" />
            <Text c="dimmed" size="sm">
              {t('Завантаження ролей')}
            </Text>
          </Group>
        ) : (
          <Stack gap="lg">
            {clientTypes.map((clientType) => {
              const roles = (clientType.ClientTypeRoles || []).filter((clientRole) =>
                canSelectRole(clientType, clientRole, hasPermission),
              )

              if (!roles.length) {
                return null
              }

              return (
                <Stack key={clientType.Id || clientType.NetUid || clientType.Name} gap="xs">
                  <Title order={4} size="h5">
                    {clientType.Name || '-'}
                  </Title>
                  <SimpleGrid cols={1} spacing="sm">
                    {roles.map((clientRole) => {
                      const isSelected =
                        isSameType(clientType.NetUid, currentTypeNetUid)
                        && isSameRole(clientRole, currentRoleNetUid, currentRoleId)

                      return (
                        <Button
                          key={clientRole.Id || clientRole.NetUid || clientRole.Name}
                          type="button"
                          fullWidth
                          h="auto"
                          justify="space-between"
                          color={isSelected ? 'violet' : 'gray'}
                          variant={isSelected ? 'light' : 'default'}
                          onClick={() => {
                            onSelect(clientType, clientRole)
                            onClose()
                          }}
                        >
                          <Group justify="space-between" w="100%" py={4}>
                            <Box ta="left">
                              <Text fw={600}>{clientRole.Name || t('Без назви')}</Text>
                            </Box>
                            {isSelected && <Badge color="violet">{t('Обрано')}</Badge>}
                          </Group>
                        </Button>
                      )
                    })}
                  </SimpleGrid>
                </Stack>
              )
            })}
          </Stack>
        )}
      </Stack>
    </AppDrawer>
  )
}

function canSelectRole(
  clientType: ClientType,
  role: ClientTypeRole,
  hasPermission: (permissionKey: string) => boolean,
): boolean {
  const clientTypePermission = getClientTypePermission(clientType.ClientTypeIcon)
  const rolePermission = getClientTypeRolePermission(role.Name)

  return (!clientTypePermission || hasPermission(clientTypePermission)) && (!rolePermission || hasPermission(rolePermission))
}

function isSameType(typeNetUid?: string, currentTypeNetUid?: string): boolean {
  return Boolean(typeNetUid && currentTypeNetUid && typeNetUid === currentTypeNetUid)
}

function isSameRole(role: ClientTypeRole, currentRoleNetUid?: string, currentRoleId?: number): boolean {
  if (typeof role.Id === 'number' && typeof currentRoleId === 'number') {
    return role.Id === currentRoleId
  }

  return Boolean(role.NetUid && currentRoleNetUid && role.NetUid === currentRoleNetUid)
}
