import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Card,
  Group,
  Skeleton,
  Stack,
  Tabs,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { CircleAlert, Pencil, Plus, RefreshCw, RotateCcw, Save, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useReducer, useRef } from 'react'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { UserRoleType } from '../../../shared/auth/types'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { PermissionGate } from '../../auth/components/PermissionGate'
import { useAuth } from '../../auth/useAuth'
import {
  createUserRole,
  deleteUserRole,
  getRoleManagementRoles,
  updateUserRole,
} from '../api/usersApi'
import {
  EventPermissionsCatalog,
  type EventPermissionsCatalogHandle,
} from '../components/EventPermissionsCatalog'
import { RoleFormModal } from '../components/RoleFormModal'
import type { UserRole } from '../types'
import {
  canDeleteUserRole,
  getUserRoleKey,
  getUserRoleName,
} from '../utils'
import '../../../shared/ui/console-table-page.css'
import './user-roles-page.css'

type PendingWorkspaceAction =
  | { type: 'reload' }
  | { role: UserRole; type: 'role' }

export function UserRolesPage() {
  const { t } = useI18n()

  return (
    <PermissionGate
      permissionKey={PermissionKeys.SystemPages.Roles.View}
      fallback={
        <Alert color="red" icon={<CircleAlert size={18} />} title={t('Доступ заборонено')} variant="light">
          {t('Недостатньо прав для перегляду ролей')}
        </Alert>
      }
    >
      <UserRolesPageContent />
    </PermissionGate>
  )
}

function UserRolesPageContent() {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const [roles, setRoles] = useValueState<UserRole[]>([])
  const [selectedRoleKey, setSelectedRoleKey] = useValueState<string | null>(null)
  const [searchDraft, setSearchDraft] = useValueState('')
  const [searchValue, setSearchValue] = useValueState('')
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isSaving, setSaving] = useValueState(false)
  const [eventPermissionsDirty, setEventPermissionsDirty] = useValueState(false)
  const [eventPermissionsSaving, setEventPermissionsSaving] = useValueState(false)
  const [pendingWorkspaceAction, setPendingWorkspaceAction] =
    useValueState<PendingWorkspaceAction | null>(null)
  const [roleModalState, setRoleModalState] = useValueState<{
    open: boolean
    role: UserRole | null
  }>({
    open: false,
    role: null,
  })
  const [deleteRoleTarget, setDeleteRoleTarget] =
    useValueState<UserRole | null>(null)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const selectedRoleKeyRef = useRef<string | null>(null)
  const eventPermissionsRef = useRef<EventPermissionsCatalogHandle | null>(null)

  const canCreateRole = hasPermission(PermissionKeys.Roles.Role.Create)
  const canEditRole = hasPermission(PermissionKeys.Roles.Role.Edit)
  const canDeleteRole = hasPermission(PermissionKeys.Roles.Role.Delete)
  const canEditEventPermissions = hasPermission(PermissionKeys.Roles.EventPermissions.Edit)
  const filteredRoles = useMemo(
    () => filterRoles(roles, searchValue),
    [roles, searchValue],
  )
  const selectedRole = useMemo(
    () => roles.find((role) => getUserRoleKey(role) === selectedRoleKey) || null,
    [roles, selectedRoleKey],
  )

  useEffect(() => {
    selectedRoleKeyRef.current = selectedRoleKey
  }, [selectedRoleKey])

  useEffect(() => {
    if (!eventPermissionsDirty) {
      return
    }

    const preventAccidentalClose = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', preventAccidentalClose)
    return () => window.removeEventListener('beforeunload', preventAccidentalClose)
  }, [eventPermissionsDirty])

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      setLoading(true)
      setError(null)

      try {
        const nextRoles = await getRoleManagementRoles()

        if (!cancelled) {
          const nextRole =
            nextRoles.find(
              (role) => getUserRoleKey(role) === selectedRoleKeyRef.current,
            ) ||
            nextRoles[0] ||
            null
          setRoles(nextRoles)
          setSelectedRoleKey(nextRole ? getUserRoleKey(nextRole) : null)
        }
      } catch (loadError) {
        if (!cancelled) {
          setRoles([])
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
    setRoles,
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

  function applySelectedRole(role: UserRole) {
    setSelectedRoleKey(getUserRoleKey(role))
  }

  function selectRole(role: UserRole) {
    if (
      getUserRoleKey(role) === selectedRoleKey ||
      isWorkspaceSavingNow()
    ) {
      return
    }

    if (hasWorkspaceChangesNow()) {
      setPendingWorkspaceAction({ role, type: 'role' })
      return
    }

    applySelectedRole(role)
  }

  function requestReload() {
    if (isWorkspaceSavingNow()) {
      return
    }

    if (hasWorkspaceChangesNow()) {
      setPendingWorkspaceAction({ type: 'reload' })
      return
    }

    reloadWorkspace()
  }

  function reloadWorkspace() {
    reload()
    eventPermissionsRef.current?.reload()
  }

  function hasWorkspaceChangesNow(): boolean {
    return eventPermissionsRef.current?.hasUnsavedChanges() ?? eventPermissionsDirty
  }

  function isWorkspaceSavingNow(): boolean {
    return isSaving ||
      (eventPermissionsRef.current?.isSaving() ?? eventPermissionsSaving)
  }

  function discardChangesAndContinue() {
    const action = pendingWorkspaceAction
    if (!action) {
      return
    }

    eventPermissionsRef.current?.cancel()
    setPendingWorkspaceAction(null)

    if (action.type === 'role') {
      applySelectedRole(action.role)
    } else {
      reloadWorkspace()
    }
  }

  async function submitRoleForm(values: { Dashboard: string; Name: string }) {
    const requiredPermission = roleModalState.role
      ? PermissionKeys.Roles.Role.Edit
      : PermissionKeys.Roles.Role.Create
    if (!hasPermission(requiredPermission)) {
      setError(t('Недостатньо прав для збереження ролі'))
      return
    }
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
    const roleToDelete = deleteRoleTarget

    if (
      !canDeleteRole ||
      !roleToDelete?.NetUid ||
      !canDeleteUserRole(roleToDelete)
    ) {
      return
    }

    const deleteRoleKey = getUserRoleKey(roleToDelete)

    setSaving(true)
    setError(null)

    try {
      await deleteUserRole(roleToDelete.NetUid)
      notifications.show({ color: 'green', message: t('Видалено') })
      setDeleteRoleTarget(null)
      setRoleModalState({ open: false, role: null })

      if (deleteRoleKey === selectedRoleKey) {
        setSelectedRoleKey(null)
      }

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

  return (
    <Stack className="user-roles-page console-table-page" gap={6}>
      <div className="console-table-shell user-roles-shell">
        <div className="app-filter-bar user-roles-filter-bar">
          <TextInput
            className="user-roles-search-input"
            leftSection={<Search size={16} />}
            label={t('Пошук ролі')}
            value={searchDraft}
            onChange={(event) => updateSearch(event.currentTarget.value)}
          />
          <div className="app-filter-actions user-roles-filter-actions">
            <Tooltip label={t('Скинути')}>
              <ActionIcon
                aria-label={t('Скинути')}
                color="gray"
                size={34}
                variant="light"
                onClick={resetSearch}
              >
                <RotateCcw size={17} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Оновити')}>
              <ActionIcon
                aria-label={t('Оновити')}
                color="gray"
                loading={isLoading || eventPermissionsSaving}
                size={34}
                variant="light"
                onClick={requestReload}
              >
                <RefreshCw size={17} />
              </ActionIcon>
            </Tooltip>
            {canEditEventPermissions && selectedRole ? (
              <>
                <Button
                  color="gray"
                  className="user-roles-cancel-action"
                  disabled={isLoading || eventPermissionsSaving || !eventPermissionsDirty}
                  size="sm"
                  variant="subtle"
                  onClick={() => eventPermissionsRef.current?.cancel()}
                >
                  {t('Скасувати')}
                </Button>
                <Button
                  color={CREATE_ACTION_COLOR}
                  disabled={isLoading || !eventPermissionsDirty}
                  leftSection={<Save size={15} />}
                  loading={eventPermissionsSaving}
                  size="sm"
                  onClick={() => void eventPermissionsRef.current?.save()}
                >
                  {t('Зберегти')}
                </Button>
              </>
            ) : null}
          </div>
          {canCreateRole ? (
            <Button
              className="user-roles-create-button"
              color={CREATE_ACTION_COLOR}
              size="sm"
              leftSection={<Plus size={16} />}
              onClick={() => setRoleModalState({ open: true, role: null })}
            >
              {t('Створити')}
            </Button>
          ) : null}
        </div>

        {error ? (
          <Alert className="console-table-alert" color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        ) : null}

        <Tabs className="user-roles-workspace-tabs" defaultValue="events">
          <Tabs.List className="user-roles-workspace-tabs-list">
            <Tabs.Tab value="events">{t('Подієві права')}</Tabs.Tab>
          </Tabs.List>

          <Box className="user-roles-layout">
            <div className="user-roles-list-pane">
              <RoleList
                canEdit={canEditRole}
                isLoading={isLoading}
                roles={filteredRoles}
                selectedRoleKey={selectedRoleKey}
                onEditRole={(role) => setRoleModalState({ open: true, role })}
                onSelectRole={selectRole}
              />
            </div>

            <Card
              className="app-section-card user-roles-editor-pane"
              withBorder
              radius="md"
              padding="md"
            >
              <Tabs.Panel
                className="user-roles-workspace-tab-panel"
                value="events"
                keepMounted
              >
                <EventPermissionsCatalog
                  key={selectedRole?.NetUid || 'no-role'}
                  ref={eventPermissionsRef}
                  role={selectedRole}
                  readOnly={!canEditEventPermissions}
                  onDirtyChange={setEventPermissionsDirty}
                  onSavingChange={setEventPermissionsSaving}
                />
              </Tabs.Panel>
            </Card>
          </Box>
        </Tabs>
      </div>

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
          canDelete={Boolean(
            canDeleteRole &&
            roleModalState.role &&
            canDeleteUserRole(roleModalState.role),
          )}
          onClose={() => setRoleModalState({ open: false, role: null })}
          onDelete={() => {
            if (roleModalState.role) {
              setDeleteRoleTarget(roleModalState.role)
            }
          }}
          onSubmit={submitRoleForm}
        />
      ) : null}

      <AppModal
        centered
        opened={Boolean(pendingWorkspaceAction)}
        title={t('Незбережені зміни')}
        onClose={() => setPendingWorkspaceAction(null)}
      >
        <Stack gap="md">
          <Text size="sm">
            {t('Є незбережені зміни прав. Відхилити їх і продовжити?')}
          </Text>
          <Group justify="flex-end">
            <Button
              color="gray"
              variant="subtle"
              onClick={() => setPendingWorkspaceAction(null)}
            >
              {t('Залишитися')}
            </Button>
            <Button color="red" onClick={discardChangesAndContinue}>
              {t('Відхилити зміни')}
            </Button>
          </Group>
        </Stack>
      </AppModal>

      <AppModal
        centered
        opened={Boolean(deleteRoleTarget)}
        title={t('Видалити роль')}
        onClose={() => setDeleteRoleTarget(null)}
      >
        <Stack gap="md">
          <Text size="sm">
            {t('Ви впевнені, що хочете видалити?')}{' '}
            {deleteRoleTarget ? getUserRoleName(deleteRoleTarget) : ''}
          </Text>
          <Group justify="flex-end">
            <Button
              color="gray"
              disabled={isSaving}
              variant="subtle"
              onClick={() => setDeleteRoleTarget(null)}
            >
              {t('Ні')}
            </Button>
            <Button
              color="red"
              leftSection={<Trash2 size={16} />}
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
  canEdit: boolean
  isLoading: boolean
  roles: UserRole[]
  selectedRoleKey: string | null
  onEditRole: (role: UserRole) => void
  onSelectRole: (role: UserRole) => void
}

function RoleList({
  canEdit,
  isLoading,
  roles,
  selectedRoleKey,
  onEditRole,
  onSelectRole,
}: RoleListProps) {
  const { t } = useI18n()

  return (
    <Box className="user-roles-list-panel">
      <div className="user-role-list-scroll">
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

              return (
                <div
                  key={roleKey}
                  className={`user-role-list-item${isSelected ? ' is-selected' : ''}`}
                >
                  <button
                    aria-pressed={isSelected}
                    className="user-role-list-select"
                    type="button"
                    onClick={() => onSelectRole(role)}
                  >
                    <span className="user-role-list-main">
                      <Text className="user-role-list-name">
                        {getUserRoleName(role)}
                      </Text>
                    </span>
                  </button>
                  {canEdit ? (
                    <Tooltip label={t('Редагувати')}>
                      <ActionIcon
                        aria-label={t('Редагувати')}
                        className="user-role-list-edit"
                        color="gray"
                        size="sm"
                        variant="subtle"
                        onClick={() => onEditRole(role)}
                      >
                        <Pencil size={16} />
                      </ActionIcon>
                    </Tooltip>
                  ) : null}
                </div>
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
      </div>
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

function filterRoles(roles: UserRole[], value: string): UserRole[] {
  const normalizedValue = value.trim().toLocaleLowerCase('uk')

  if (!normalizedValue) {
    return roles
  }

  return roles.filter((role) =>
    getUserRoleName(role).toLocaleLowerCase('uk').includes(normalizedValue),
  )
}
