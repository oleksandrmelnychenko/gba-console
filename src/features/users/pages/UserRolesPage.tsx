import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  ScrollArea,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
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
import { Link } from 'react-router-dom'
import {
  CREATE_ACTION_COLOR,
  PageContentHeader,
} from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { AppModal } from '../../../shared/ui/AppModal'
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
import {
  RolePermissionModal,
  type RolePermissionSubmit,
} from '../components/RolePermissionModal'
import { RolePermissionsEditor } from '../components/RolePermissionsEditor'
import { UserRoleType } from '../../../shared/auth/types'
import type {
  DashboardNode,
  DashboardNodeModule,
  UserPermission,
  UserRole,
} from '../types'
import {
  canDeleteUserRole,
  displayValue,
  getDashboardModuleNodes,
  getDashboardModulePermissions,
  getDashboardNodePermissions,
  getDashboardNodeTree,
  getUserRoleKey,
  getUserRoleName,
  isNodeSelected,
  isPermissionSelected,
  toggleAllPages,
  togglePermissionSelection,
} from '../utils'
import './user-roles-page.css'

type PermissionModalState = {
  node: DashboardNode | null
  permission: UserPermission | null
}

export function UserRolesPage() {
  const { t } = useI18n()
  const [roles, setRoles] = useValueState<UserRole[]>([])
  const [modules, setModules] = useValueState<DashboardNodeModule[]>([])
  const [selectedRoleKey, setSelectedRoleKey] = useValueState<string | null>(
    null,
  )
  const [selectedNodes, setSelectedNodes] = useValueState<DashboardNode[]>([])
  const [selectedPermissions, setSelectedPermissions] = useValueState<
    UserPermission[]
  >([])
  const [searchDraft, setSearchDraft] = useValueState('')
  const [searchValue, setSearchValue] = useValueState('')
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isSaving, setSaving] = useValueState(false)
  const [roleModalState, setRoleModalState] = useValueState<{
    open: boolean
    role: UserRole | null
  }>({
    open: false,
    role: null,
  })
  const [permissionModalState, setPermissionModalState] =
    useValueState<PermissionModalState | null>(null)
  const [deleteModalOpened, setDeleteModalOpened] = useValueState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const selectedRoleKeyRef = useRef<string | null>(null)
  const filteredRoles = useMemo(
    () => filterRoles(roles, searchValue),
    [roles, searchValue],
  )
  const selectedRole = useMemo(
    () =>
      roles.find((role) => getUserRoleKey(role) === selectedRoleKey) || null,
    [roles, selectedRoleKey],
  )
  const visibleSelectedRole = useMemo(
    () =>
      selectedRole &&
      filteredRoles.some((role) => getUserRoleKey(role) === selectedRoleKey)
        ? selectedRole
        : null,
    [filteredRoles, selectedRole, selectedRoleKey],
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
        const [nextRoles, nextModules] = await Promise.all([
          getUserRoles(),
          getDashboardModules(),
        ])

        if (!cancelled) {
          const nextRole =
            nextRoles.find(
              (role) => getUserRoleKey(role) === selectedRoleKeyRef.current,
            ) ||
            nextRoles[0] ||
            null
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
          setError(
            loadError instanceof Error
              ? loadError.message
              : t('Не вдалося завантажити ролі'),
          )
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
  }, [
    reloadKey,
    setError,
    setLoading,
    setModules,
    setRoles,
    setSelectedNodes,
    setSelectedPermissions,
    setSelectedRoleKey,
    t,
  ])

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
    applyRoleSelection(
      visibleSelectedRole,
      setSelectedNodes,
      setSelectedPermissions,
    )
  }

  async function submitRoleForm(values: { Dashboard: string; Name: string }) {
    setSaving(true)
    setError(null)

    try {
      if (roleModalState.role) {
        await updateUserRole({
          ...roleModalState.role,
          Dashboard: values.Dashboard,
          Name: values.Name,
        })
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
      setError(
        saveError instanceof Error
          ? saveError.message
          : t('Не вдалося зберегти'),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteRole() {
    if (
      !visibleSelectedRole?.NetUid ||
      !canDeleteUserRole(visibleSelectedRole)
    ) {
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
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : t('Не вдалося видалити'),
      )
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
      setError(
        saveError instanceof Error
          ? saveError.message
          : t('Не вдалося зберегти'),
      )
    } finally {
      setSaving(false)
    }
  }

  function handleToggleModule(module: DashboardNodeModule) {
    const nodes = getDashboardModuleNodes(module)
    const permissions = getDashboardModulePermissions(module)
    const allSelected =
      nodes.length > 0 &&
      nodes.every((node) => isNodeSelected(selectedNodes, node)) &&
      permissions.every((permission) =>
        isPermissionSelected(selectedPermissions, permission),
      )

    setSelectedNodes((current) =>
      allSelected
        ? removeNodes(current, nodes)
        : addMissingNodes(current, nodes),
    )
    setSelectedPermissions((current) =>
      allSelected
        ? removePermissions(current, permissions)
        : addMissingPermissions(current, permissions),
    )
  }

  function handleToggleNode(node: DashboardNode) {
    const nodes = getDashboardNodeTree(node)
    const permissions = getDashboardNodePermissions(node)
    const allSelected =
      nodes.every((item) => isNodeSelected(selectedNodes, item)) &&
      permissions.every((permission) =>
        isPermissionSelected(selectedPermissions, permission),
      )

    setSelectedNodes((current) =>
      allSelected
        ? removeNodes(current, nodes)
        : addMissingNodes(current, nodes),
    )
    setSelectedPermissions((current) =>
      allSelected
        ? removePermissions(current, permissions)
        : addMissingPermissions(current, permissions),
    )
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
      setError(
        saveError instanceof Error
          ? saveError.message
          : t('Не вдалося зберегти'),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Stack gap="lg">
      <PageContentHeader>
        <div className="user-roles-content-header">
          <nav aria-label="breadcrumb" className="user-roles-breadcrumbs">
            <Link className="user-roles-breadcrumb-link" to="/users">
              {t('Користувачі')}
            </Link>
            <Text>{t('Ролі')}</Text>
          </nav>
          <Button
            color={CREATE_ACTION_COLOR}
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => setRoleModalState({ open: true, role: null })}
          >
            {t('Створити')}
          </Button>
        </div>
      </PageContentHeader>

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {error}
        </Alert>
      )}

      <Box className="user-roles-layout">
        <Card withBorder radius="md" padding="md">
          <Stack gap="md">
            <Group
              align="end"
              gap="sm"
              wrap="nowrap"
              className="clients-filter-row"
            >
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

            <RoleList
              isLoading={isLoading}
              roles={filteredRoles}
              searchValue={searchValue}
              selectedRoleKey={selectedRoleKey}
              totalRoles={roles.length}
              onSelectRole={selectRole}
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
                      {t('Тип')}{' '}
                      {displayValue(visibleSelectedRole.UserRoleType)}
                    </Badge>
                  </Box>
                  <Group gap="xs">
                    <Tooltip label={t('Редагувати')}>
                      <ActionIcon
                        aria-label={t('Редагувати')}
                        color="gray"
                        variant="light"
                        onClick={() =>
                          setRoleModalState({
                            open: true,
                            role: visibleSelectedRole,
                          })
                        }
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
                  <Button
                    color="gray"
                    disabled={isSaving}
                    variant="subtle"
                    onClick={cancelSelection}
                  >
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
                  onAddPermission={(node) =>
                    setPermissionModalState({ node, permission: null })
                  }
                  onEditPermission={(node, permission) =>
                    setPermissionModalState({ node, permission })
                  }
                  onSelectAllPages={() =>
                    setSelectedNodes((current) =>
                      toggleAllPages(current, modules),
                    )
                  }
                  onToggleModule={handleToggleModule}
                  onToggleNode={handleToggleNode}
                  onTogglePermission={(permission) =>
                    setSelectedPermissions((current) =>
                      togglePermissionSelection(current, permission),
                    )
                  }
                />
              </>
            ) : (
              <Text c="dimmed">{t('Оберіть роль зі списку')}</Text>
            )}
          </Stack>
        </Card>
      </Box>

      {roleModalState.open ? (
        <RoleFormModal
          key={
            roleModalState.role
              ? getUserRoleKey(roleModalState.role)
              : 'new-role'
          }
          isSaving={isSaving}
          opened={roleModalState.open}
          role={roleModalState.role}
          onClose={() => setRoleModalState({ open: false, role: null })}
          onSubmit={submitRoleForm}
        />
      ) : null}

      {permissionModalState ? (
        <RolePermissionModal
          key={
            permissionModalState.permission?.NetUid ||
            `new-${permissionModalState.node?.Id ?? ''}`
          }
          isSaving={isSaving}
          node={permissionModalState.node}
          opened={Boolean(permissionModalState)}
          permission={permissionModalState.permission}
          onClose={() => setPermissionModalState(null)}
          onSubmit={submitPermission}
        />
      ) : null}

      <AppModal
        centered
        opened={deleteModalOpened}
        title={t('Видалити роль')}
        onClose={() => setDeleteModalOpened(false)}
      >
        <Stack gap="md">
          <Text size="sm">
            {t('Ви впевнені, що хочете видалити?')}{' '}
            {visibleSelectedRole ? getUserRoleName(visibleSelectedRole) : ''}
          </Text>
          <Group justify="flex-end">
            <Button
              color="gray"
              disabled={isSaving}
              variant="subtle"
              onClick={() => setDeleteModalOpened(false)}
            >
              {t('Ні')}
            </Button>
            <Button
              color="red"
              leftSection={<IconTrash size={16} />}
              loading={isSaving}
              onClick={handleDeleteRole}
            >
              {t('Так')}
            </Button>
          </Group>
        </Stack>
      </AppModal>
    </Stack>
  )
}

type RoleListProps = {
  isLoading: boolean
  roles: UserRole[]
  searchValue: string
  selectedRoleKey: string | null
  totalRoles: number
  onSelectRole: (role: UserRole) => void
}

function RoleList({
  isLoading,
  roles,
  searchValue,
  selectedRoleKey,
  totalRoles,
  onSelectRole,
}: RoleListProps) {
  const { t } = useI18n()

  return (
    <Box className="user-roles-list-panel">
      <Group
        className="user-roles-list-header"
        justify="space-between"
        wrap="nowrap"
      >
        <Box>
          <Text className="user-roles-list-title">{t('Ролі')}</Text>
          {searchValue ? (
            <Text className="user-roles-list-search">
              {t('Пошук')}: {searchValue}
            </Text>
          ) : null}
        </Box>
        <Badge color="gray" variant="light">
          {roles.length}/{totalRoles}
        </Badge>
      </Group>

      <ScrollArea.Autosize mah="calc(100vh - 330px)" type="auto">
        {isLoading ? (
          <Stack gap="xs" className="user-roles-list">
            {Array.from({ length: 6 }, (_, index) => (
              <RoleListSkeleton key={index} />
            ))}
          </Stack>
        ) : roles.length > 0 ? (
          <Stack gap="xs" className="user-roles-list">
            {roles.map((role, index) => {
              const roleKey = getUserRoleKey(role) || String(role.Id || index)
              const isSelected = roleKey === selectedRoleKey
              const pageCount = role.DashboardNodes?.length || 0
              const permissionCount = role.Permissions?.length || 0

              return (
                <button
                  key={roleKey}
                  aria-pressed={isSelected}
                  className={`user-role-list-item${isSelected ? ' is-selected' : ''}`}
                  type="button"
                  onClick={() => onSelectRole(role)}
                >
                  <span className="user-role-list-content">
                    <Text className="user-role-list-name">
                      {getUserRoleName(role)}
                    </Text>
                    <span className="user-role-list-meta">
                      <span className="user-role-list-pill">
                        <span>{t('Тип')}</span>
                        <strong>{displayValue(role.UserRoleType)}</strong>
                      </span>
                      <span className="user-role-list-stat">
                        <span>{t('Стор.')}</span>
                        <strong>{pageCount}</strong>
                      </span>
                      <span className="user-role-list-stat">
                        <span>{t('Прав')}</span>
                        <strong>{permissionCount}</strong>
                      </span>
                    </span>
                  </span>
                </button>
              )
            })}
          </Stack>
        ) : (
          <Box className="user-roles-list-empty">
            <Text c="dimmed" size="sm">
              {t('Ролей не знайдено')}
            </Text>
          </Box>
        )}
      </ScrollArea.Autosize>
    </Box>
  )
}

function RoleListSkeleton() {
  return (
    <Box className="user-role-list-skeleton">
      <Box style={{ flex: 1 }}>
        <Skeleton height={13} width="82%" />
      </Box>
    </Box>
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

function addMissingNodes(
  current: DashboardNode[],
  nodes: DashboardNode[],
): DashboardNode[] {
  const missing = nodes.filter((node) => !isNodeSelected(current, node))

  return missing.length > 0 ? [...current, ...missing] : current
}

function removeNodes(
  current: DashboardNode[],
  nodes: DashboardNode[],
): DashboardNode[] {
  return current.filter(
    (node) => !nodes.some((item) => item.NetUid === node.NetUid),
  )
}

function addMissingPermissions(
  current: UserPermission[],
  permissions: UserPermission[],
): UserPermission[] {
  const missing = permissions.filter(
    (permission) => !isPermissionSelected(current, permission),
  )

  return missing.length > 0 ? [...current, ...missing] : current
}

function removePermissions(
  current: UserPermission[],
  permissions: UserPermission[],
): UserPermission[] {
  return current.filter(
    (permission) =>
      !permissions.some((item) => item.NetUid === permission.NetUid),
  )
}

function filterRoles(roles: UserRole[], value: string): UserRole[] {
  const normalizedValue = value.trim().toLocaleLowerCase('uk')

  if (!normalizedValue) {
    return roles
  }

  return roles.filter((role) =>
    getUserRoleName(role).toLocaleLowerCase('uk').includes(normalizedValue),
  )
}
