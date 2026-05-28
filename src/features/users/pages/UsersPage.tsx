import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconRestore,
  IconSearch,
  IconShieldLock,
} from '@tabler/icons-react'
import { useDebouncedValue } from '@mantine/hooks'
import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useLocation, useNavigate } from 'react-router-dom'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { getUsers } from '../api/usersApi'
import type { UserProfile } from '../types'
import { displayValue, getUserFullName, getUserRegionName, getUserRoleName } from '../utils'

const USERS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['lastName', 'firstName'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout
const USERS_SEARCH_DEBOUNCE_MS = 350

export function UsersPage() {
  const { t } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()
  const [users, setUsers] = useValueState<UserProfile[]>([])
  const [searchValue, setSearchValue] = useValueState('')
  const [debouncedSearchValue] = useDebouncedValue(searchValue, USERS_SEARCH_DEBOUNCE_MS)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const normalizedSearchValue = debouncedSearchValue.trim()
  const isSearchSettling = searchValue.trim() !== normalizedSearchValue
  const isTableBusy = isLoading || isSearchSettling
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
  const columns = useMemo<DataTableColumn<UserProfile>[]>(
    () => [
      {
        id: 'lastName',
        header: 'Прізвище',
        width: 180,
        minWidth: 140,
        accessor: (user) => user.LastName,
        cell: (user) => <Text fw={600}>{displayValue(user.LastName)}</Text>,
      },
      {
        id: 'firstName',
        header: "Ім'я",
        width: 180,
        minWidth: 140,
        accessor: (user) => user.FirstName,
        cell: (user) => displayValue(user.FirstName),
      },
      {
        id: 'middleName',
        header: 'По батькові',
        width: 180,
        minWidth: 140,
        accessor: (user) => user.MiddleName,
        cell: (user) => displayValue(user.MiddleName),
      },
      {
        id: 'email',
        header: 'Email',
        width: 240,
        minWidth: 180,
        accessor: (user) => user.Email,
        cell: (user) => displayValue(user.Email),
      },
      {
        id: 'phone',
        header: 'Телефон',
        width: 150,
        minWidth: 124,
        accessor: (user) => user.PhoneNumber,
        cell: (user) => displayValue(user.PhoneNumber),
      },
      {
        id: 'role',
        header: 'Роль',
        width: 200,
        minWidth: 160,
        accessor: (user) => getUserRoleName(user.UserRole),
        cell: (user) => displayValue(getUserRoleName(user.UserRole)),
      },
      {
        id: 'region',
        header: 'Регіон',
        width: 118,
        minWidth: 104,
        accessor: (user) => getUserRegionName(user.Region),
        cell: (user) => (
          <Badge color={user.Region === 'pl' ? 'blue' : 'green'} variant="light">
            {getUserRegionName(user.Region)}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: '',
        width: 58,
        minWidth: 58,
        maxWidth: 58,
        align: 'center',
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
        cell: (user) => (
          <Box onClick={(event) => event.stopPropagation()}>
            <Tooltip label={t('Відкрити')}>
              <ActionIcon
                aria-label={t('Відкрити')}
                color="gray"
                variant="subtle"
                onClick={() => openUser(user)}
              >
                <IconPencil size={18} />
              </ActionIcon>
            </Tooltip>
          </Box>
        ),
      },
    ],
    [openUser, t],
  )
  const toolbarLeft = useMemo(
    () => (
      <Text size="xs" c="dimmed">
        {t('Показано')} {users.length}
        {normalizedSearchValue ? `, ${t('пошук')}: ${normalizedSearchValue}` : ''}
      </Text>
    ),
    [normalizedSearchValue, t, users.length],
  )

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
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити користувачів'))
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

  function resetSearch() {
    setSearchValue('')
  }

  return (
    <Stack gap="lg">
      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
            <TextInput
              leftSection={<IconSearch size={16} />}
              label={t('Пошук')}
              placeholder={t('ПІБ, email або телефон')}
              value={searchValue}
              onChange={(event) => setSearchValue(event.currentTarget.value)}
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
                loading={isTableBusy}
                size={36}
                style={{ flex: '0 0 auto' }}
                variant="light"
                onClick={() => reload()}
              >
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
            <Button
              color="gray"
              leftSection={<IconShieldLock size={16} />}
              variant="light"
              onClick={() => navigate('/users/roles')}
              style={{ flex: '0 0 auto' }}
            >
              {t('Ролі')}
            </Button>
            <Button
              color="violet"
              leftSection={<IconPlus size={16} />}
              onClick={() =>
                navigate('/users/new', {
                  state: {
                    backgroundLocation: location,
                    returnPath: `${location.pathname}${location.search}`,
                  },
                })
              }
              style={{ flex: '0 0 auto' }}
            >
              {t('Новий користувач')}
            </Button>
          </Group>

          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {error}
            </Alert>
          )}

          <DataTable
            columns={columns}
            data={users}
            defaultLayout={USERS_TABLE_DEFAULT_LAYOUT}
            emptyText="Користувачів не знайдено"
            getRowId={(user, index) => String(user.NetUid || user.Id || index)}
            isLoading={isTableBusy}
            layoutVersion="users-table-1"
            loadingText="Завантаження користувачів"
            maxHeight="calc(100vh - 260px)"
            minWidth={1340}
            tableId="users"
            toolbarLeft={toolbarLeft}
            onRowClick={openUser}
          />
        </Stack>
      </Card>
    </Stack>
  )
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
