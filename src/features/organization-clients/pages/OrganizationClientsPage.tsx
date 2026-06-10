import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Group,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { IconAlertCircle, IconPencil, IconPlus, IconRefresh, IconRestore, IconSearch } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useLocation, useNavigate } from 'react-router-dom'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import { CREATE_ACTION_COLOR, PageHeaderActions } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { getOrganizationClients } from '../api/organizationClientsApi'
import type { OrganizationClient } from '../types'
import { displayValue, getOrganizationClientName } from '../utils'
import './organization-clients-page.css'

const ORGANIZATION_CLIENT_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['fullName'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

export function OrganizationClientsPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const [clients, setClients] = useValueState<OrganizationClient[]>([])
  const [searchDraft, setSearchDraft] = useValueState('')
  const [searchValue, setSearchValue] = useValueState('')
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const openClient = useCallback(
    (client: OrganizationClient) => {
      if (!client.NetUid) {
        return
      }

      navigate(`/organization-clients/edit/${client.NetUid}`, {
        state: {
          backgroundLocation: location,
          nodeTitle: getOrganizationClientName(client),
          returnPath: `${location.pathname}${location.search}`,
        },
      })
    },
    [location, navigate],
  )
  const columns = useMemo<DataTableColumn<OrganizationClient>[]>(
    () => [
      {
        id: 'fullName',
        header: 'Назва',
        width: 280,
        minWidth: 220,
        accessor: getOrganizationClientName,
        cell: (client) => (
          <Text fw={600}>{getOrganizationClientName(client)}</Text>
        ),
      },
      {
        id: 'nip',
        header: 'NIP',
        width: 160,
        minWidth: 120,
        accessor: (client) => client.NIP,
        cell: (client) => displayValue(client.NIP),
      },
      {
        id: 'country',
        header: 'Країна',
        width: 160,
        minWidth: 120,
        accessor: (client) => client.Country,
        cell: (client) => displayValue(client.Country),
      },
      {
        id: 'city',
        header: 'Місто',
        width: 160,
        minWidth: 120,
        accessor: (client) => client.City,
        cell: (client) => displayValue(client.City),
      },
      {
        id: 'address',
        header: 'Адреса',
        width: 240,
        minWidth: 180,
        accessor: (client) => client.Address,
        cell: (client) => displayValue(client.Address),
      },
      {
        id: 'marginAmount',
        header: 'Маржа',
        width: 120,
        minWidth: 96,
        align: 'right',
        accessor: (client) => client.MarginAmount,
        cell: (client) => displayValue(client.MarginAmount),
      },
      {
        id: 'agreements',
        header: 'Договори',
        width: 112,
        minWidth: 96,
        align: 'right',
        accessor: (client) => client.OrganizationClientAgreements?.length || 0,
        cell: (client) => displayValue(client.OrganizationClientAgreements?.length || 0),
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
        cell: (client) => (
          <Box onClick={(event) => event.stopPropagation()}>
            <Tooltip label={t('Відкрити')}>
              <ActionIcon
                aria-label={t('Відкрити')}
                color="gray"
                variant="subtle"
                onClick={() => openClient(client)}
              >
                <IconPencil size={18} />
              </ActionIcon>
            </Tooltip>
          </Box>
        ),
      },
    ],
    [openClient, t],
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
    const state = location.state as { mutated?: boolean } | null

    if (state?.mutated) {
      navigate(`${location.pathname}${location.search}`, { replace: true, state: null })
      reload()
    }
  }, [location.pathname, location.search, location.state, navigate])

  useEffect(() => {
    let cancelled = false

    async function loadOrganizationClients() {
      setLoading(true)
      setError(null)

      try {
        const nextClients = await getOrganizationClients(searchValue)

        if (!cancelled) {
          setClients(nextClients)
        }
      } catch (loadError) {
        if (!cancelled) {
          setClients([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити організації'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadOrganizationClients()

    return () => {
      cancelled = true
    }
  }, [reloadKey, searchValue, setClients, setError, setLoading, t])

  function updateSearch(nextSearchValue: string) {
    setSearchDraft(nextSearchValue)
    setSearchValue(nextSearchValue.trim())
  }

  function resetSearch() {
    setSearchDraft('')
    setSearchValue('')
  }

  return (
    <Stack className="organization-clients-page" gap={6}>
      <PageHeaderActions>
        <Tooltip label={t('Оновити')}>
          <ActionIcon
            aria-label={t('Оновити')}
            color="gray"
            loading={isLoading}
            size={38}
            type="button"
            variant="light"
            onClick={() => reload()}
          >
            <IconRefresh size={18} />
          </ActionIcon>
        </Tooltip>
        <Button
          color={CREATE_ACTION_COLOR}
          size="sm"
          leftSection={<IconPlus size={16} />}
          type="button"
          onClick={() =>
            navigate('/organization-clients/new', {
              state: {
                backgroundLocation: location,
                returnPath: `${location.pathname}${location.search}`,
              },
            })
          }
        >
          {t('Нова організація')}
        </Button>
      </PageHeaderActions>
      <Stack gap={6}>
        <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
          <TextInput
            leftSection={<IconSearch size={16} />}
            label={t('Пошук')}
            placeholder={t('Назва організації')}
            value={searchDraft}
            onChange={(event) => updateSearch(event.currentTarget.value)}
            style={{ flex: '1 1 auto', minWidth: 160 }}
          />
          <Tooltip label={t('Скинути')}>
            <ActionIcon
              aria-label={t('Скинути')}
              color="violet"
              size={36}
              style={{ flex: '0 0 auto' }}
              variant="light"
              onClick={resetSearch}
            >
              <IconRestore size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>

        {error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <div className="organization-clients-page__table">
          <DataTable
            columns={columns}
            data={clients}
            defaultLayout={ORGANIZATION_CLIENT_TABLE_DEFAULT_LAYOUT}
            density={ORGANIZATION_CLIENT_TABLE_DEFAULT_LAYOUT.density}
            emptyText={t('Організацій не знайдено')}
            getRowId={(client, index) => String(client.NetUid || client.Id || index)}
            height="100%"
            isLoading={isLoading}
            layoutVersion="organization-clients-table-1"
            loadingText={t('Завантаження організацій')}
            minWidth={1120}
            showDensityToggle={false}
            tableId="organization-clients"
            toolbarLeft={toolbarLeft}
            onRowClick={openClient}
          />
        </div>
      </Stack>
    </Stack>
  )
}
