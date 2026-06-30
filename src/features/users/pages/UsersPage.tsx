import {
  ActionIcon,
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import {
  IconAlertCircle,
  IconBriefcase,
  IconBuildingWarehouse,
  IconCalculator,
  IconCar,
  IconChartLine,
  IconCoins,
  IconCrown,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconRestore,
  IconSearch,
  IconShieldLock,
  IconShoppingCart,
  IconTruckDelivery,
  IconUserShield,
  IconUsersGroup,
} from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import {
  CREATE_ACTION_COLOR,
  PageHeaderActions,
} from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type {
  DataTableColumn,
  DataTableDefaultLayout,
} from '../../../shared/ui/data-table/types'
import { getUsers } from '../api/usersApi'
import type { UserProfile, UserRole } from '../types'
import {
  displayValue,
  getUserFullName,
  getUserRegionName,
  getUserRoleName,
} from '../utils'
import './users-page.css'

const USERS_SEARCH_DEBOUNCE_MS = 350
const USER_STATUS_ACTIVE = 'active'
const USER_STATUS_INACTIVE = 'inactive'
const USER_STATUS_DELETED = 'deleted'

type UserStatus =
  | typeof USER_STATUS_ACTIVE
  | typeof USER_STATUS_INACTIVE
  | typeof USER_STATUS_DELETED

const USERS_TABLE_LAYOUT_VERSION = 'users-table-1'
const USERS_TABLE_MIN_WIDTH = 900
const USERS_TABLE_DEFAULT_LAYOUT = {
  columnOrder: ['profile', 'role', 'contacts', 'region', 'status', 'actions'],
  columnPinning: {
    left: ['profile'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

type RoleNavigationItem = {
  count: number
  label: string
  value: string
}

export function UsersPage() {
  const { t } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()
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
  const userColumns = useUserColumns(openUser)

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
    <Stack className="users-page" gap="md">
      <PageHeaderActions>
        <Button
          color={CREATE_ACTION_COLOR}
          leftSection={<IconPlus size={15} />}
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
      </PageHeaderActions>

      <Box className="users-shell">
        <div className="users-command-bar">
          <TextInput
            className="users-search-input"
            leftSection={<IconSearch size={15} />}
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
          <div className="users-toolbar-actions">
            <Tooltip label={t('Очистити')}>
              <ActionIcon
                aria-label={t('Очистити')}
                color="gray"
                disabled={!hasActiveFilters}
                size={34}
                variant="light"
                onClick={resetFilters}
              >
                <IconRestore size={17} />
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
                <IconRefresh size={17} />
              </ActionIcon>
            </Tooltip>
            <Button
              className="users-roles-action"
              color="gray"
              leftSection={<IconShieldLock size={15} />}
              size="sm"
              variant="light"
              onClick={() => navigate('/users/roles')}
            >
              {t('Ролі')}
            </Button>
          </div>
        </div>

        {error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <div className="users-layout">
          <aside className="users-role-rail" aria-label={t('Ролі')}>
            <div className="users-rail-header">
              <span>{t('Навігація ролей')}</span>
            </div>

            <button
              className={`users-role-option${roleFilter === null ? ' is-active' : ''}`}
              type="button"
              onClick={() => setRoleFilter(null)}
            >
              <span className="users-role-option-index" aria-hidden="true">
                —
              </span>
              <span className="users-role-option-name">{t('Всі користувачі')}</span>
              <span className="users-role-option-count">{users.length}</span>
            </button>

            <ScrollArea.Autosize mah="calc(100vh - 330px)" type="auto">
              <div className="users-role-list">
                {roleNavItems.map((item, index) => (
                  <button
                    key={item.value}
                    className={`users-role-option${roleFilter === item.value ? ' is-active' : ''}`}
                    type="button"
                    onClick={() => setRoleFilter(item.value)}
                  >
                    <span className="users-role-option-index" aria-hidden="true">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="users-role-option-name">{item.label}</span>
                    <span className="users-role-option-count">{item.count}</span>
                  </button>
                ))}
              </div>
            </ScrollArea.Autosize>
          </aside>

          <Card
            className="app-data-card users-card"
            withBorder
            radius="md"
            padding={0}
          >
            <DataTable
              columns={userColumns}
              data={filteredUsers}
              defaultLayout={USERS_TABLE_DEFAULT_LAYOUT}
              density="normal"
              emptyText={
                hasActiveFilters
                  ? t('Користувачів за цими фільтрами не знайдено')
                  : t('Користувачів не знайдено')
              }
              getRowId={(user, index) =>
                String(user.NetUid || user.Id || index)
              }
              isLoading={isBusy}
              layoutVersion={USERS_TABLE_LAYOUT_VERSION}
              loadingText={t('Завантаження користувачів')}
              maxHeight="calc(100vh - 360px)"
              minWidth={USERS_TABLE_MIN_WIDTH}
              rowClassName={(user) => {
                const status = getUserStatus(user)
                return status === USER_STATUS_ACTIVE
                  ? undefined
                  : `users-row-${status}`
              }}
              showDensityToggle={false}
              showLayoutControls={false}
              tableId="users"
              onRowClick={openUser}
            />
          </Card>
        </div>
      </Box>
    </Stack>
  )
}

function useUserColumns(
  onEdit: (user: UserProfile) => void,
): DataTableColumn<UserProfile>[] {
  return useMemo<DataTableColumn<UserProfile>[]>(
    () => [
      {
        id: 'profile',
        header: 'Профіль',
        width: 260,
        minWidth: 235,
        fill: true,
        accessor: (user) => getUserFullName(user),
        cell: (user) => (
          <div className="users-profile-cell">
            <Avatar className="users-avatar" radius="xl" size={34}>
              {getUserInitials(user)}
            </Avatar>
            <div className="users-profile-copy">
              <Text className="users-profile-last-name">
                {displayValue(user.LastName)}
              </Text>
              <Text className="users-profile-first-name">
                {getUserGivenName(user)}
              </Text>
            </div>
          </div>
        ),
      },
      {
        id: 'role',
        header: 'Роль',
        width: 200,
        minWidth: 180,
        accessor: (user) => getUserRoleName(user.UserRole),
        cell: (user) => (
          <div className="users-role-cell">
            <span className="users-role-marker" aria-hidden="true">
              {renderRoleIcon(user.UserRole)}
            </span>
            <strong>{displayValue(getUserRoleName(user.UserRole))}</strong>
          </div>
        ),
      },
      {
        id: 'contacts',
        header: 'Контакти',
        width: 240,
        minWidth: 220,
        accessor: (user) => user.Email,
        cell: (user) => (
          <div className="users-contact-cell">
            <Text className="users-contact-primary">
              {displayValue(user.Email)}
            </Text>
            <Text className="users-contact-secondary">
              {displayValue(user.PhoneNumber)}
            </Text>
          </div>
        ),
      },
      {
        id: 'region',
        header: 'Регіон',
        width: 132,
        minWidth: 108,
        accessor: (user) => getUserRegionName(user.Region),
        cell: (user) => (
          <span className="users-region-tag">
            {getUserRegionName(user.Region)}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Стан',
        width: 132,
        minWidth: 112,
        accessor: (user) => getUserStatusLabel(user),
        cell: (user) => <UserStatusTag user={user} />,
      },
      {
        id: 'actions',
        header: '',
        width: 56,
        minWidth: 56,
        maxWidth: 56,
        align: 'center',
        enableHiding: false,
        enablePinning: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
        cell: (user) => (
          <Tooltip label="Редагувати">
            <ActionIcon
              aria-label="Редагувати"
              className="users-row-action"
              color="gray"
              size="sm"
              variant="subtle"
              onClick={(event) => {
                event.stopPropagation()
                onEdit(user)
              }}
            >
              <IconPencil size={15} />
            </ActionIcon>
          </Tooltip>
        ),
      },
    ],
    [onEdit],
  )
}

function UserStatusTag({ user }: { user: UserProfile }) {
  const status = getUserStatus(user)

  return (
    <span className={`users-status-tag is-${status}`}>
      {getUserStatusLabel(user)}
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

function renderRoleIcon(role?: UserRole | null) {
  const roleName = getUserRoleName(role).toLocaleLowerCase('uk')

  if (roleName.includes('gba') || roleName.includes('топ')) {
    return <IconCrown size={13} />
  }

  if (roleName.includes('адміністратор') || roleName.includes('admin')) {
    return <IconUserShield size={13} />
  }

  if (roleName.includes('керівник')) {
    return <IconBriefcase size={13} />
  }

  if (roleName.includes('аналітик') && roleName.includes('закуп')) {
    return <IconShoppingCart size={13} />
  }

  if (roleName.includes('аналітик')) {
    return <IconChartLine size={13} />
  }

  if (roleName.includes('бухгалтер')) {
    return <IconCalculator size={13} />
  }

  if (roleName.includes('фінанс')) {
    return <IconCoins size={13} />
  }

  if (
    roleName.includes('завсклад') ||
    roleName.includes('кладов') ||
    roleName.includes('склад')
  ) {
    return <IconBuildingWarehouse size={13} />
  }

  if (roleName.includes('водій')) {
    return <IconCar size={13} />
  }

  if (roleName.includes('логіст')) {
    return <IconTruckDelivery size={13} />
  }

  if (roleName.includes('client')) {
    return <IconUsersGroup size={13} />
  }

  return <IconShieldLock size={13} />
}

function getUserInitials(user: UserProfile) {
  if (user.Abbreviation?.trim()) {
    return user.Abbreviation.trim().slice(0, 2).toLocaleUpperCase('uk')
  }

  const parts = [user.FirstName, user.LastName, user.FullName]
    .flatMap((value) => value?.trim().split(/\s+/) || [])
    .filter(Boolean)

  return (
    parts
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toLocaleUpperCase('uk') || '?'
  )
}

function getUserGivenName(user: UserProfile) {
  const givenName = [user.FirstName, user.MiddleName]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(' ')

  return displayValue(givenName)
}
