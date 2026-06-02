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
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconChevronLeft,
  IconDeviceFloppy,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconRestore,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react'
import { useEffect, useMemo, useReducer, useRef } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useNavigate } from 'react-router-dom'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import { CREATE_ACTION_COLOR, PageHeaderActions } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { AppModal } from '../../../shared/ui/AppModal'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import {
  addPermissionToNode,
  changePermissionsToRole,
  createUserRole,
  deleteUserRole,
  getDashboardModules,
  getUserRoles,
  updatePermissionToNode,
  updateUserRole,
} from '../api/usersApi'
import { RoleFormModal } from '../components/RoleFormModal'
import { RolePermissionModal, type RolePermissionSubmit } from '../components/RolePermissionModal'
import { RolePermissionsEditor } from '../components/RolePermissionsEditor'
import { UserRoleType } from '../../../shared/auth/types'
import type { DashboardNode, DashboardNodeModule, UserPermission, UserRole } from '../types'
import {
  canDeleteUserRole,
  displayValue,
  getUserRoleKey,
  getUserRoleName,
  toggleAllPages,
  toggleModuleNodes,
  toggleNodeSelection,
  togglePermissionSelection,
  toggleSubPermissions,
} from '../utils'

const ROLES_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['name'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

type PermissionModalState = {
  node: DashboardNode | null
  permission: UserPermission | null
}

export function UserRolesPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [roles, setRoles] = useValueState<UserRole[]>([])
  const [modules, setModules] = useValueState<DashboardNodeModule[]>([])
  const [selectedRoleKey, setSelectedRoleKey] = useValueState<string | null>(null)
  const [selectedNodes, setSelectedNodes] = useValueState<DashboardNode[]>([])
  const [selectedPermissions, setSelectedPermissions] = useValueState<UserPermission[]>([])
  const [searchDraft, setSearchDraft] = useValueState('')
  const [searchValue, setSearchValue] = useValueState('')
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isSaving, setSaving] = useValueState(false)
  const [roleModalState, setRoleModalState] = useValueState<{ open: boolean; role: UserRole | null }>({
    open: false,
    role: null,
  })
  const [permissionModalState, setPermissionModalState] = useValueState<PermissionModalState | null>(null)
  const [deleteModalOpened, setDeleteModalOpened] = useValueState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const selectedRoleKeyRef = useRef<string | null>(null)
  const filteredRoles = useMemo(() => filterRoles(roles, searchValue), [roles, searchValue])
  const selectedRole = useMemo(
    () => roles.find((role) => getUserRoleKey(role) === selectedRoleKey) || null,
    [roles, selectedRoleKey],
  )
  const visibleSelectedRole = useMemo(
    () => (selectedRole && filteredRoles.some((role) => getUserRoleKey(role) === selectedRoleKey) ? selectedRole : null),
    [filteredRoles, selectedRole, selectedRoleKey],
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
    () =>
      searchValue ? (
        <Text size="xs" c="dimmed">
          {t('пошук')}: {searchValue}
        </Text>
      ) : null,
    [searchValue, t],
  )

  useEffect(() => {
    selectedRoleKeyRef.current = selectedRoleKey
  }, [selectedRoleKey])

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      setLoading(true)
      setError(null)

      try {
        const [nextRoles, nextModules] = await Promise.all([getUserRoles(), getDashboardModules()])

        if (!cancelled) {
          const nextRole = nextRoles.find((role) => getUserRoleKey(role) === selectedRoleKeyRef.current) || nextRoles[0] || null
          setRoles(nextRoles)
          setModules(nextModules)
          setSelectedRoleKey(nextRole ? getUserRoleKey(nextRole) : null)
          applyRoleSelection(nextRole, setSelectedNodes, setSelectedPermissions)
        }
      } catch (loadError) {
        if (!cancelled) {
          setRoles([])
          setModules([])
          setSelectedRoleKey(null)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити ролі'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadData()

    return () => {
      cancelled = true
    }
  }, [reloadKey, setError, setLoading, setModules, setRoles, setSelectedNodes, setSelectedPermissions, setSelectedRoleKey, t])

  function updateSearch(nextSearchValue: string) {
    setSearchDraft(nextSearchValue)
    setSearchValue(nextSearchValue.trim())
  }

  function resetSearch() {
    setSearchDraft('')
    setSearchValue('')
  }

  function selectRole(role: UserRole) {
    setSelectedRoleKey(getUserRoleKey(role))
    applyRoleSelection(role, setSelectedNodes, setSelectedPermissions)
  }

  function cancelSelection() {
    applyRoleSelection(visibleSelectedRole, setSelectedNodes, setSelectedPermissions)
  }

  async function submitRoleForm(values: { Dashboard: string; Name: string }) {
    setSaving(true)
    setError(null)

    try {
      if (roleModalState.role) {
        await updateUserRole({ ...roleModalState.role, Dashboard: values.Dashboard, Name: values.Name })
      } else {
        await createUserRole({
          Dashboard: values.Dashboard,
          Name: values.Name,
          UserRoleType: UserRoleType.Driver,
        })
      }

      notifications.show({ color: 'green', message: t('Збережено') })
      setRoleModalState({ open: false, role: null })
      reload()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteRole() {
    if (!visibleSelectedRole?.NetUid || !canDeleteUserRole(visibleSelectedRole)) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      await deleteUserRole(visibleSelectedRole.NetUid)
      notifications.show({ color: 'green', message: t('Видалено') })
      setDeleteModalOpened(false)
      setSelectedRoleKey(null)
      reload()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t('Не вдалося видалити'))
    } finally {
      setSaving(false)
    }
  }

  async function handleSavePermissions() {
    if (!visibleSelectedRole) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      await changePermissionsToRole({
        ...visibleSelectedRole,
        DashboardNodes: selectedNodes,
        Permissions: selectedPermissions,
      })
      notifications.show({ color: 'green', message: t('Збережено') })
      reload()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти'))
    } finally {
      setSaving(false)
    }
  }

  async function submitPermission(values: RolePermissionSubmit) {
    setSaving(true)
    setError(null)

    try {
      if (permissionModalState?.permission) {
        await updatePermissionToNode(values.permission, values.image)
      } else {
        await addPermissionToNode(values.permission, values.image)
      }

      notifications.show({ color: 'green', message: t('Збережено') })
      setPermissionModalState(null)
      reload()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Stack gap="lg">
      <PageHeaderActions>
        <Button
          color={CREATE_ACTION_COLOR}
          size="sm"
          leftSection={<IconPlus size={16} />}
          onClick={() => setRoleModalState({ open: true, role: null })}
        >
          {t('Створити')}
        </Button>
      </PageHeaderActions>

      <Group justify="space-between">
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
            <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
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
              onRowClick={selectRole}
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
                    <Badge color="gray" mt={4} variant="light">
                      {t('Тип')} {displayValue(visibleSelectedRole.UserRoleType)}
                    </Badge>
                  </Box>
                  <Group gap="xs">
                    <Tooltip label={t('Редагувати')}>
                      <ActionIcon
                        aria-label={t('Редагувати')}
                        color="gray"
                        variant="light"
                        onClick={() => setRoleModalState({ open: true, role: visibleSelectedRole })}
                      >
                        <IconPencil size={16} />
                      </ActionIcon>
                    </Tooltip>
                    {canDeleteUserRole(visibleSelectedRole) ? (
                      <Tooltip label={t('Видалити')}>
                        <ActionIcon
                          aria-label={t('Видалити')}
                          color="red"
                          variant="light"
                          onClick={() => setDeleteModalOpened(true)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    ) : null}
                  </Group>
                </Group>

                <Group justify="flex-end">
                  <Button color="gray" disabled={isSaving} variant="subtle" onClick={cancelSelection}>
                    {t('Скасувати')}
                  </Button>
                  <Button
                    color="violet"
                    leftSection={<IconDeviceFloppy size={16} />}
                    loading={isSaving}
                    onClick={handleSavePermissions}
                  >
                    {t('Зберегти')}
                  </Button>
                </Group>

                <RolePermissionsEditor
                  modules={modules}
                  selectedNodes={selectedNodes}
                  selectedPermissions={selectedPermissions}
                  onAddPermission={(node) => setPermissionModalState({ node, permission: null })}
                  onEditPermission={(node, permission) => setPermissionModalState({ node, permission })}
                  onSelectAllPages={() => setSelectedNodes((current) => toggleAllPages(current, modules))}
                  onSelectModule={(module) => setSelectedNodes((current) => toggleModuleNodes(current, module))}
                  onSelectSubPermissions={(permissions) =>
                    setSelectedPermissions((current) => toggleSubPermissions(current, permissions))
                  }
                  onToggleNode={(node) => setSelectedNodes((current) => toggleNodeSelection(current, node))}
                  onTogglePermission={(permission) =>
                    setSelectedPermissions((current) => togglePermissionSelection(current, permission))
                  }
                />
              </>
            ) : (
              <Text c="dimmed">{t('Оберіть роль зі списку')}</Text>
            )}
          </Stack>
        </Card>
      </SimpleGrid>

      {roleModalState.open ? (
        <RoleFormModal
          key={roleModalState.role ? getUserRoleKey(roleModalState.role) : 'new-role'}
          isSaving={isSaving}
          opened={roleModalState.open}
          role={roleModalState.role}
          onClose={() => setRoleModalState({ open: false, role: null })}
          onSubmit={submitRoleForm}
        />
      ) : null}

      {permissionModalState ? (
        <RolePermissionModal
          key={permissionModalState.permission?.NetUid || `new-${permissionModalState.node?.Id ?? ''}`}
          isSaving={isSaving}
          node={permissionModalState.node}
          opened={Boolean(permissionModalState)}
          permission={permissionModalState.permission}
          onClose={() => setPermissionModalState(null)}
          onSubmit={submitPermission}
        />
      ) : null}

      <AppModal centered opened={deleteModalOpened} title={t('Видалити роль')} onClose={() => setDeleteModalOpened(false)}>
        <Stack gap="md">
          <Text size="sm">
            {t('Ви впевнені, що хочете видалити?')} {visibleSelectedRole ? getUserRoleName(visibleSelectedRole) : ''}
          </Text>
          <Group justify="flex-end">
            <Button color="gray" disabled={isSaving} variant="subtle" onClick={() => setDeleteModalOpened(false)}>
              {t('Ні')}
            </Button>
            <Button color="red" leftSection={<IconTrash size={16} />} loading={isSaving} onClick={handleDeleteRole}>
              {t('Так')}
            </Button>
          </Group>
        </Stack>
      </AppModal>
    </Stack>
  )
}

function applyRoleSelection(
  role: UserRole | null,
  setSelectedNodes: (value: DashboardNode[]) => void,
  setSelectedPermissions: (value: UserPermission[]) => void,
) {
  setSelectedNodes(role?.DashboardNodes ? [...role.DashboardNodes] : [])
  setSelectedPermissions(role?.Permissions ? [...role.Permissions] : [])
}

function filterRoles(roles: UserRole[], value: string): UserRole[] {
  const normalizedValue = value.trim().toLocaleLowerCase('uk')

  if (!normalizedValue) {
    return roles
  }

  return roles.filter((role) => getUserRoleName(role).toLocaleLowerCase('uk').includes(normalizedValue))
}
