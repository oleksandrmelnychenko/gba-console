import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconChevronLeft,
  IconRefresh,
  IconRestore,
  IconSearch,
} from '@tabler/icons-react'
import { useEffect, useMemo, useReducer } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useNavigate } from 'react-router-dom'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { getUserRoles } from '../api/usersApi'
import type { DashboardNode, UserPermission, UserRole } from '../types'
import { displayValue, getUserRoleKey, getUserRoleName } from '../utils'

const ROLES_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['name'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

export function UserRolesPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [roles, setRoles] = useValueState<UserRole[]>([])
  const [selectedRole, setSelectedRole] = useValueState<UserRole | null>(null)
  const [searchDraft, setSearchDraft] = useValueState('')
  const [searchValue, setSearchValue] = useValueState('')
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const filteredRoles = useMemo(() => filterRoles(roles, searchValue), [roles, searchValue])
  const visibleSelectedRole = useMemo(
    () => selectedRole && filteredRoles.some((role) => isSameUserRole(role, selectedRole)) ? selectedRole : null,
    [filteredRoles, selectedRole],
  )
  const selectedPermissions = useMemo(
    () => visibleSelectedRole?.Permissions?.filter((permission) => !permission.Deleted) || [],
    [visibleSelectedRole],
  )
  const selectedNodes = useMemo(
    () => visibleSelectedRole?.DashboardNodes?.filter((node) => !node.Deleted) || [],
    [visibleSelectedRole],
  )
  const columns = useMemo<DataTableColumn<UserRole>[]>(
    () => [
      {
        id: 'name',
        header: 'Назва',
        width: 240,
        minWidth: 180,
        accessor: getUserRoleName,
        cell: (role) => <Text fw={600}>{getUserRoleName(role)}</Text>,
      },
      {
        id: 'dashboard',
        header: 'Dashboard',
        width: 180,
        minWidth: 140,
        accessor: (role) => role.Dashboard,
        cell: (role) => displayValue(role.Dashboard),
      },
      {
        id: 'type',
        header: 'Тип',
        width: 96,
        minWidth: 84,
        align: 'right',
        accessor: (role) => role.UserRoleType,
        cell: (role) => displayValue(role.UserRoleType),
      },
      {
        id: 'pages',
        header: 'Сторінки',
        width: 112,
        minWidth: 96,
        align: 'right',
        accessor: (role) => role.DashboardNodes?.length || 0,
        cell: (role) => displayValue(role.DashboardNodes?.length || 0),
      },
      {
        id: 'permissions',
        header: 'Права',
        width: 104,
        minWidth: 92,
        align: 'right',
        accessor: (role) => role.Permissions?.length || 0,
        cell: (role) => displayValue(role.Permissions?.length || 0),
      },
    ],
    [],
  )
  const toolbarLeft = useMemo(
    () => (
      <Text size="xs" c="dimmed">
        {t('Показано')} {filteredRoles.length}
        {searchValue ? `, ${t('пошук')}: ${searchValue}` : ''}
      </Text>
    ),
    [filteredRoles.length, searchValue, t],
  )

  useEffect(() => {
    let cancelled = false

    async function loadRoles() {
      setLoading(true)
      setError(null)

      try {
        const nextRoles = await getUserRoles()

        if (!cancelled) {
          setRoles(nextRoles)
          setSelectedRole((currentRole) =>
            nextRoles.find((role) => getUserRoleKey(role) === (currentRole ? getUserRoleKey(currentRole) : ''))
              || nextRoles[0]
              || null,
          )
        }
      } catch (loadError) {
        if (!cancelled) {
          setRoles([])
          setSelectedRole(null)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити ролі'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadRoles()

    return () => {
      cancelled = true
    }
  }, [reloadKey, setError, setLoading, setRoles, setSelectedRole, t])

  function updateSearch(nextSearchValue: string) {
    setSearchDraft(nextSearchValue)
    setSearchValue(nextSearchValue.trim())
  }

  function resetSearch() {
    setSearchDraft('')
    setSearchValue('')
  }

  return (
    <Stack gap="lg">
      <Group justify="flex-start">
        <Button
          color="gray"
          leftSection={<IconChevronLeft size={16} />}
          variant="subtle"
          size="sm"
          px="xs"
          onClick={() => navigate('/users')}
        >
          {t('Назад')}
        </Button>
      </Group>

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {error}
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        <Card withBorder radius="md" padding="md">
          <Stack gap="md">
            <Group align="end" gap="sm" wrap="nowrap">
              <TextInput
                leftSection={<IconSearch size={16} />}
                label={t('Пошук')}
                placeholder={t('Назва ролі')}
                value={searchDraft}
                onChange={(event) => updateSearch(event.currentTarget.value)}
                style={{ flex: '1 1 auto', minWidth: 160 }}
              />
              <Tooltip label={t('Скинути')}>
                <ActionIcon
                  aria-label={t('Скинути')}
                  color="gray"
                  size={36}
                  style={{ flex: '0 0 auto' }}
                  variant="light"
                  onClick={resetSearch}
                >
                  <IconRestore size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={t('Оновити')}>
                <ActionIcon
                  aria-label={t('Оновити')}
                  color="gray"
                  loading={isLoading}
                  size={36}
                  style={{ flex: '0 0 auto' }}
                  variant="light"
                  onClick={() => reload()}
                >
                  <IconRefresh size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>

            <DataTable
              columns={columns}
              data={filteredRoles}
              defaultLayout={ROLES_TABLE_DEFAULT_LAYOUT}
              emptyText="Ролей не знайдено"
              getRowId={(role, index) => String(role.NetUid || role.Id || index)}
              isLoading={isLoading}
              layoutVersion="user-roles-table-1"
              loadingText="Завантаження ролей"
              maxHeight="calc(100vh - 330px)"
              minWidth={760}
              tableId="user-roles"
              toolbarLeft={toolbarLeft}
              onRowClick={(role) => setSelectedRole(role)}
            />
          </Stack>
        </Card>

        <Card withBorder radius="md" padding="md">
          <Stack gap="md">
            {visibleSelectedRole ? (
              <>
                <Group justify="space-between" align="start">
                  <Box>
                    <Text fw={700}>{getUserRoleName(visibleSelectedRole)}</Text>
                  </Box>
                  <Badge color="gray" variant="light">
                    {t('Тип')} {displayValue(visibleSelectedRole.UserRoleType)}
                  </Badge>
                </Group>

                <RoleItems title={t('Сторінки')} items={selectedNodes.map(formatNode)} emptyText={t("Сторінки не прив'язані")} />
                <RoleItems title={t('Права')} items={selectedPermissions.map(formatPermission)} emptyText={t("Права не прив'язані")} />
              </>
            ) : (
              <Text c="dimmed">{t('Оберіть роль зі списку')}</Text>
            )}
          </Stack>
        </Card>
      </SimpleGrid>
    </Stack>
  )
}

type RoleItemsProps = {
  emptyText: string
  items: string[]
  title: string
}

function RoleItems({ emptyText, items, title }: RoleItemsProps) {
  const { t } = useI18n()

  return (
    <Stack gap="xs">
      <Text fw={600} size="sm">
        {title}
      </Text>
      {items.length > 0 ? (
        <Stack gap={6}>
          {items.slice(0, 24).map((item) => (
            <Badge key={item} color="gray" radius="sm" variant="light" style={{ alignSelf: 'flex-start' }}>
              {item}
            </Badge>
          ))}
          {items.length > 24 && (
            <Text c="dimmed" size="xs">
              {t('Ще')} {items.length - 24}
            </Text>
          )}
        </Stack>
      ) : (
        <Text c="dimmed" size="sm">
          {emptyText}
        </Text>
      )}
    </Stack>
  )
}

function filterRoles(roles: UserRole[], value: string): UserRole[] {
  const normalizedValue = value.trim().toLocaleLowerCase('uk')

  if (!normalizedValue) {
    return roles
  }

  return roles.filter((role) => getUserRoleName(role).toLocaleLowerCase('uk').includes(normalizedValue))
}

function isSameUserRole(left: UserRole, right: UserRole): boolean {
  if (left.NetUid && right.NetUid) {
    return left.NetUid === right.NetUid
  }

  if (typeof left.Id === 'number' && typeof right.Id === 'number') {
    return left.Id === right.Id
  }

  return false
}

function formatNode(node: DashboardNode): string {
  return joinTrimmedParts([node.Module, node.Route], ' / ') || '—'
}

function formatPermission(permission: UserPermission): string {
  return joinTrimmedParts([permission.Name, permission.ControlId], ' / ') || '—'
}

function joinTrimmedParts(parts: Array<string | undefined | null>, separator: string): string {
  return parts.reduce<string[]>((values, part) => {
    const value = part?.trim()

    if (value) {
      values.push(value)
    }

    return values
  }, []).join(separator)
}
