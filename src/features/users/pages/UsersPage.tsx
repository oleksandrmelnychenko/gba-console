import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import {
  ChevronRight,
  CircleAlert,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { getUsers } from '../api/usersApi'
import type { UserProfile, UserRole } from '../types'
import {
  displayValue,
  getUserFullName,
  getUserRegionName,
  getUserRoleName,
} from '../utils'
import './users-page.css'
import '../../../shared/ui/console-table-page.css'

const USERS_SEARCH_DEBOUNCE_MS = 350
const USER_STATUS_ACTIVE = 'active'
const USER_STATUS_INACTIVE = 'inactive'
const USER_STATUS_DELETED = 'deleted'
const USERS_TABLE_CELL_STYLE = {
  display: 'block',
  lineHeight: '18px',
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const
const USERS_TABLE_SUBTEXT_STYLE = {
  ...USERS_TABLE_CELL_STYLE,
  fontSize: 11,
  lineHeight: '14px',
} as const
const USERS_MONO_STYLE = { fontFamily: 'var(--font-mono)', letterSpacing: 0 } as const
const USERS_TABLE_DEFAULT_LAYOUT = {
  columnOrder: ['status', 'user', 'role', 'contacts', 'region'],
  columnPinning: {
    left: ['status', 'user'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

type UserStatus =
  | typeof USER_STATUS_ACTIVE
  | typeof USER_STATUS_INACTIVE
  | typeof USER_STATUS_DELETED

type RoleNavigationItem = {
  count: number
  label: string
  value: string
}

export function UsersPage() {
  const { t } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)
  const [users, setUsers] = useValueState<UserProfile[]>([])
  const [searchValue, setSearchValue] = useValueState('')
  const [roleFilter, setRoleFilter] = useValueState<string | null>(null)
  const [regionFilter, setRegionFilter] = useValueState<string | null>(null)
  const [statusFilter, setStatusFilter] = useValueState<UserStatus | null>(null)
  const [debouncedSearchValue] = useDebouncedValue(
    searchValue,
    USERS_SEARCH_DEBOUNCE_MS,
  )
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const normalizedSearchValue = debouncedSearchValue.trim()
  const isSearchSettling = searchValue.trim() !== normalizedSearchValue
  const isBusy = isLoading || isSearchSettling
  const roleNavItems = useMemo(() => createRoleNavItems(users), [users])
  const regionOptions = useMemo(() => createRegionOptions(users), [users])
  const statusOptions = useMemo(
    () => [
      { value: USER_STATUS_ACTIVE, label: t('Активні') },
      { value: USER_STATUS_INACTIVE, label: t('Неактивні') },
      { value: USER_STATUS_DELETED, label: t('Видалені') },
    ],
    [t],
  )
  const filteredUsers = useMemo(
    () =>
      users.filter(
        (user) =>
          (!roleFilter || getUserRoleFilterValue(user.UserRole) === roleFilter) &&
          (!regionFilter || getUserRegionFilterValue(user) === regionFilter) &&
          (!statusFilter || getUserStatus(user) === statusFilter),
      ),
    [regionFilter, roleFilter, statusFilter, users],
  )
  const activeFilterCount = [roleFilter, regionFilter, statusFilter].filter(
    Boolean,
  ).length
  const hasActiveFilters = searchValue.trim().length > 0 || activeFilterCount > 0
  const openUser = useCallback(
    (user: UserProfile) => {
      if (!user.NetUid) {
        return
      }

      navigate(`/users/edit/${user.NetUid}`, {
        state: {
          backgroundLocation: location,
          nodeTitle: getUserFullName(user),
          returnPath: `${location.pathname}${location.search}`,
        },
      })
    },
    [location, navigate],
  )
  const columns = useUserColumns()

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false

    async function loadUsers() {
      setLoading(true)
      setError(null)

      try {
        const nextUsers = await getUsers(normalizedSearchValue, controller.signal)

        if (!cancelled) {
          setUsers(nextUsers)
        }
      } catch (loadError) {
        if (isAbortError(loadError)) {
          return
        }

        if (!cancelled) {
          setUsers([])
          setError(
            loadError instanceof Error
              ? loadError.message
              : t('Не вдалося завантажити користувачів'),
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadUsers()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [reloadKey, normalizedSearchValue, setError, setLoading, setUsers, t])

  function resetFilters() {
    setSearchValue('')
    setRoleFilter(null)
    setRegionFilter(null)
    setStatusFilter(null)
  }

  return (
    <Stack className="users-page console-table-page" gap={6}>
      <div className="console-table-shell users-shell">
        <div className="app-filter-bar users-filter-bar">
          <TextInput
            className="users-search-input"
            leftSection={<Search size={15} />}
            label={t('Пошук користувача')}
            placeholder={t('ПІБ, email, телефон')}
            value={searchValue}
            onChange={(event) => setSearchValue(event.currentTarget.value)}
          />
          <Select
            className="users-filter-select"
            clearable
            data={regionOptions}
            label={t('Регіон')}
            placeholder={t('Всі')}
            value={regionFilter}
            onChange={setRegionFilter}
          />
          <Select
            className="users-filter-select"
            clearable
            data={statusOptions}
            label={t('Статус')}
            placeholder={t('Всі')}
            value={statusFilter}
            onChange={(value) => setStatusFilter(value as UserStatus | null)}
          />
          <div className="app-filter-actions users-filter-actions">
            <Tooltip label={t('Очистити')}>
              <ActionIcon
                aria-label={t('Очистити')}
                color="gray"
                disabled={!hasActiveFilters}
                size={34}
                variant="light"
                onClick={resetFilters}
              >
                <RotateCcw size={17} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Оновити')}>
              <ActionIcon
                aria-label={t('Оновити')}
                color="gray"
                loading={isBusy}
                size={34}
                variant="light"
                onClick={() => reload()}
              >
                <RefreshCw size={17} />
              </ActionIcon>
            </Tooltip>
          </div>
          <div ref={setTableToolbarSlot} className="app-filter-table-toolbar-slot users-table-toolbar-slot" />
          <div className="users-create-actions">
            <Button
              className="users-roles-action"
              color="gray"
              leftSection={<Shield size={15} />}
              size="sm"
              variant="light"
              onClick={() => navigate('/users/roles')}
            >
              {t('Ролі')}
            </Button>
            <Button
              className="users-create-button"
              color={CREATE_ACTION_COLOR}
              leftSection={<Plus size={16} />}
              size="sm"
              onClick={() =>
                navigate('/users/new', {
                  state: {
                    backgroundLocation: location,
                    returnPath: `${location.pathname}${location.search}`,
                  },
                })
              }
            >
              {t('Новий користувач')}
            </Button>
          </div>
        </div>

        {error && (
          <Alert className="console-table-alert" color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <div className="users-workspace">
          <aside className="users-role-rail" aria-label={t('Ролі')}>
            <div className="users-role-scroll">
              <div className="users-role-list">
                <button
                  aria-pressed={roleFilter === null}
                  className={`users-role-option${roleFilter === null ? ' is-active' : ''}`}
                  type="button"
                  onClick={() => setRoleFilter(null)}
                >
                  <span className="users-role-option-main">
                    <span className="users-role-option-name">{t('Всі користувачі')}</span>
                    <ChevronRight
                      aria-hidden="true"
                      className="users-role-option-chevron"
                      size={14}
                      strokeWidth={2}
                    />
                  </span>
                  <span className="users-role-option-count">{users.length}</span>
                  <span aria-hidden="true" className="users-role-option-marker" />
                </button>

                {roleNavItems.map((item) => (
                  <button
                    key={item.value}
                    aria-pressed={roleFilter === item.value}
                    className={`users-role-option${roleFilter === item.value ? ' is-active' : ''}`}
                    type="button"
                    onClick={() => setRoleFilter(item.value)}
                  >
                    <span className="users-role-option-main">
                      <span className="users-role-option-name">{item.label}</span>
                      <ChevronRight
                        aria-hidden="true"
                        className="users-role-option-chevron"
                        size={14}
                        strokeWidth={2}
                      />
                    </span>
                    <span className="users-role-option-count">{item.count}</span>
                    <span aria-hidden="true" className="users-role-option-marker" />
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <section className="users-roster console-table-body">
            <DataTable
              columns={columns}
              data={filteredUsers}
              defaultLayout={USERS_TABLE_DEFAULT_LAYOUT}
              emptyText={
                hasActiveFilters
                  ? t('Користувачів за цими фільтрами не знайдено')
                  : t('Користувачів не знайдено')
              }
              fillAvailableWidth={false}
              getRowId={(user, index) => String(user.NetUid || user.Id || index)}
              height="100%"
              isLoading={isBusy}
              layoutVersion="users-table-1"
              loadingText={t('Завантаження користувачів')}
              minWidth={860}
              showLayoutControls
              tableId="users"
              toolbarPortalTarget={tableToolbarSlot}
              onRowClick={openUser}
            />
          </section>
        </div>
      </div>
    </Stack>
  )
}

function useUserColumns(): DataTableColumn<UserProfile>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<UserProfile>[]>(
    () => [
      {
        id: 'status',
        header: '',
        width: 48,
        minWidth: 44,
        accessor: (user) => getUserStatusLabel(user),
        cell: (user) => {
          const status = getUserStatus(user)
          const label = getUserStatusLabel(user)
          return (
            <span className="app-status-dot-wrap" aria-label={label} title={label}>
              <span
                className={
                  status === USER_STATUS_ACTIVE
                    ? 'app-status-dot is-active'
                    : 'app-status-dot is-inactive'
                }
                style={status === USER_STATUS_DELETED ? { background: 'var(--mantine-color-red-5)', boxShadow: '0 0 0 3px rgba(250, 82, 82, 0.14)' } : undefined}
              />
            </span>
          )
        },
      },
      {
        id: 'user',
        header: t('Користувач'),
        width: 260,
        minWidth: 220,
        accessor: getUserFullName,
        cell: (user) => <UserNameCell user={user} />,
      },
      {
        id: 'role',
        header: t('Роль'),
        width: 210,
        minWidth: 160,
        accessor: (user) => getUserRoleName(user.UserRole),
        cell: (user) => {
          const roleName = displayValue(getUserRoleName(user.UserRole))
          return roleName ? (
            <Badge className="app-role-pill" variant="light">
              {roleName}
            </Badge>
          ) : null
        },
      },
      {
        id: 'contacts',
        header: t('Контакти'),
        width: 240,
        minWidth: 200,
        accessor: (user) => [user.Email, user.PhoneNumber].filter(Boolean).join(' '),
        cell: (user) => <UserContactsCell user={user} />,
      },
      {
        id: 'region',
        header: t('Регіон'),
        width: 150,
        minWidth: 120,
        accessor: (user) => getUserRegionName(user.Region),
        cell: (user) => {
          const value = displayValue(getUserRegionName(user.Region))
          return (
            <Text component="span" style={USERS_TABLE_CELL_STYLE} title={value || undefined}>
              {value}
            </Text>
          )
        },
      },
    ],
    [t],
  )
}

/* Name cell per the pattern: last name 600 with the given name as a dimmed
   second line (no decorative avatar in cells). */
function UserNameCell({ user }: { user: UserProfile }) {
  const lastName = displayValue(user.LastName) || displayValue(getUserFullName(user))
  const givenName = getUserGivenName(user)
  const title = [lastName, givenName].filter(Boolean).join(' ')

  return (
    <span style={{ display: 'block', minWidth: 0 }} title={title || undefined}>
      <Text component="span" fw={600} style={USERS_TABLE_CELL_STYLE}>
        {lastName}
      </Text>
      {givenName ? (
        <Text component="span" c="dimmed" style={USERS_TABLE_SUBTEXT_STYLE}>
          {givenName}
        </Text>
      ) : null}
    </span>
  )
}

/* Contacts per §5.1: email primary, phone as a mono second line. */
function UserContactsCell({ user }: { user: UserProfile }) {
  const email = displayValue(user.Email)
  const phone = displayValue(user.PhoneNumber)
  const title = [email, phone].filter(Boolean).join('\n')

  return (
    <span style={{ display: 'block', minWidth: 0 }} title={title || undefined}>
      <Text component="span" style={USERS_TABLE_CELL_STYLE}>
        {email}
      </Text>
      {phone ? (
        <Text component="span" c="dimmed" style={{ ...USERS_TABLE_SUBTEXT_STYLE, ...USERS_MONO_STYLE }}>
          {phone}
        </Text>
      ) : null}
    </span>
  )
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function createRoleNavItems(users: UserProfile[]): RoleNavigationItem[] {
  const counts = new Map<string, number>()

  users.forEach((user) => {
    const roleName = getUserRoleFilterValue(user.UserRole)
    counts.set(roleName, (counts.get(roleName) || 0) + 1)
  })

  return [...counts.entries()]
    .sort(([first], [second]) => first.localeCompare(second, 'uk'))
    .map(([value, count]) => ({ value, label: value, count }))
}

function createRegionOptions(users: UserProfile[]) {
  return [...new Set(users.map(getUserRegionFilterValue))]
    .sort((first, second) =>
      getRegionOptionLabel(first).localeCompare(getRegionOptionLabel(second), 'uk'),
    )
    .map((region) => ({ value: region, label: getRegionOptionLabel(region) }))
}

function getUserRoleFilterValue(role?: UserRole | null) {
  return getUserRoleName(role)
}

function getUserRegionFilterValue(user: UserProfile) {
  return user.Region?.trim() || 'other'
}

function getRegionOptionLabel(region: string) {
  return region === 'other' ? 'Інший' : getUserRegionName(region)
}

function getUserStatus(user: UserProfile): UserStatus {
  if (user.Deleted) {
    return USER_STATUS_DELETED
  }

  return user.IsActive === false ? USER_STATUS_INACTIVE : USER_STATUS_ACTIVE
}

function getUserStatusLabel(user: UserProfile) {
  const status = getUserStatus(user)

  if (status === USER_STATUS_DELETED) {
    return 'Видалений'
  }

  return status === USER_STATUS_INACTIVE ? 'Неактивний' : 'Активний'
}

function getUserGivenName(user: UserProfile) {
  return [user.FirstName, user.MiddleName]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(' ')
}
