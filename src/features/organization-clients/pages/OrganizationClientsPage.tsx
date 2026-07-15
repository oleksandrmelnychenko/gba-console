import {
  ActionIcon,
  Alert,
  Button,
  Stack,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { CircleAlert, ExternalLink, Pencil, Plus, RefreshCw, RotateCcw, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useLocation, useNavigate } from 'react-router-dom'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { getOrganizationClients } from '../api/organizationClientsApi'
import type { OrganizationClient } from '../types'
import { getOrganizationClientName } from '../utils'
import '../../../shared/ui/console-table-page.css'
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
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)
  const [clients, setClients] = useValueState<OrganizationClient[]>([])
  const [searchDraft, setSearchDraft] = useValueState('')
  const [searchValue, setSearchValue] = useValueState('')
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [actionsClient, setActionsClient] = useValueState<OrganizationClient | null>(null)
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
  const openClientActions = useCallback(
    (client: OrganizationClient) => {
      setActionsClient(client)
    },
    [setActionsClient],
  )
  const closeClientActions = useCallback(() => setActionsClient(null), [setActionsClient])
  const openSelectedClient = useCallback(
    (client: OrganizationClient) => {
      closeClientActions()
      openClient(client)
    },
    [closeClientActions, openClient],
  )
  const columns = useMemo<DataTableColumn<OrganizationClient>[]>(
    () => [
      {
        id: 'fullName',
        header: t('Назва'),
        width: 280,
        minWidth: 220,
        accessor: getOrganizationClientName,
        cell: (client) => <OrganizationNameCell client={client} />,
      },
      {
        id: 'nip',
        header: 'NIP',
        width: 160,
        minWidth: 120,
        accessor: (client) => client.NIP,
        cell: (client) => <OrganizationTextCell value={client.NIP} />,
      },
      {
        id: 'country',
        header: t('Країна'),
        width: 160,
        minWidth: 120,
        accessor: (client) => client.Country,
        cell: (client) => <OrganizationTextCell value={client.Country} />,
      },
      {
        id: 'city',
        header: t('Місто'),
        width: 160,
        minWidth: 120,
        accessor: (client) => client.City,
        cell: (client) => <OrganizationTextCell value={client.City} />,
      },
      {
        id: 'address',
        header: t('Адреса'),
        width: 240,
        minWidth: 180,
        fill: true,
        accessor: (client) => client.Address,
        cell: (client) => <OrganizationTextCell value={client.Address} />,
      },
      {
        id: 'marginAmount',
        header: t('Маржа'),
        width: 120,
        minWidth: 96,
        align: 'right',
        accessor: (client) => client.MarginAmount,
        cell: (client) => <OrganizationNumberCell money value={client.MarginAmount} />,
      },
      {
        id: 'agreements',
        header: t('Договори'),
        width: 112,
        minWidth: 96,
        align: 'right',
        accessor: (client) => client.OrganizationClientAgreements?.length || 0,
        cell: (client) => <OrganizationNumberCell value={client.OrganizationClientAgreements?.length || 0} />,
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
          <div className="organization-clients-row-actions" onClick={(event) => event.stopPropagation()}>
            <ActionIcon
              aria-label={t('Відкрити')}
              color="gray"
              title={t('Відкрити')}
              variant="subtle"
              onClick={() => openClientActions(client)}
            >
              <Pencil size={18} />
            </ActionIcon>
          </div>
        ),
      },
    ],
    [openClientActions, t],
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

  function openCreateClient() {
    navigate('/organization-clients/new', {
      state: {
        backgroundLocation: location,
        returnPath: `${location.pathname}${location.search}`,
      },
    })
  }

  return (
    <Stack className="organization-clients-page console-table-page" gap={6}>
      <div className="organization-clients-card console-table-shell">
        <div className="app-filter-bar organization-clients-filter-bar">
          <TextInput
            className="organization-clients-search-input"
            leftSection={<Search size={16} />}
            label={t('Пошук')}
            placeholder={t('Назва організації')}
            value={searchDraft}
            onChange={(event) => updateSearch(event.currentTarget.value)}
          />
          <div className="app-filter-actions organization-clients-filter-actions">
            <Tooltip label={t('Оновити')}>
              <ActionIcon
                aria-label={t('Оновити')}
                color="gray"
                loading={isLoading}
                size={34}
                type="button"
                variant="light"
                onClick={() => reload()}
              >
                <RefreshCw size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Скинути')}>
              <ActionIcon
                aria-label={t('Скинути')}
                color="gray"
                disabled={!searchDraft.trim()}
                size={34}
                variant="light"
                onClick={resetSearch}
              >
                <RotateCcw size={17} />
              </ActionIcon>
            </Tooltip>
          </div>
          <div ref={setTableToolbarSlot} className="organization-clients-table-toolbar-slot" />
          <div className="organization-clients-create-actions">
            <Button
              color={CREATE_ACTION_COLOR}
              leftSection={<Plus size={16} />}
              size="sm"
              type="button"
              onClick={openCreateClient}
            >
              {t('Нова організація')}
            </Button>
          </div>
        </div>

        {error && (
          <Alert
            className="console-table-alert"
            color="red"
            icon={<CircleAlert size={18} />}
            variant="light"
          >
            {error}
          </Alert>
        )}

        <div className="organization-clients-page__table console-table-body">
          <DataTable
            columns={columns}
            data={clients}
            defaultLayout={ORGANIZATION_CLIENT_TABLE_DEFAULT_LAYOUT}
            distributeAvailableWidth
            emptyText={t('Організацій не знайдено')}
            getRowId={(client, index) => String(client.NetUid || client.Id || index)}
            height="100%"
            isLoading={isLoading}
            layoutVersion="organization-clients-table-2"
            minWidth={1120}
            showLayoutControls
            tableId="organization-clients"
            toolbarPortalTarget={tableToolbarSlot}
            onRowClick={openClientActions}
          />
        </div>
      </div>
      <OrganizationClientActionsModal
        client={actionsClient}
        onClose={closeClientActions}
        onOpen={openSelectedClient}
      />
    </Stack>
  )
}

function OrganizationClientActionsModal({
  client,
  onClose,
  onOpen,
}: {
  client: OrganizationClient | null
  onClose: () => void
  onOpen: (client: OrganizationClient) => void
}) {
  const { t } = useI18n()
  const isActive = client?.Deleted !== true

  return (
    <AppModal
      centered
      opened={Boolean(client)}
      size={496}
      title={
        <span className="organization-clients-action-title">
          <span className={`organization-clients-action-status-dot${isActive ? ' is-active' : ''}`} />
          {client ? getOrganizationClientName(client) : t('Організація')}
        </span>
      }
      onClose={onClose}
    >
      {client && (
        <Stack gap="md">
          <Stack className="app-modal-actions" gap="xs">
            <Button
              fullWidth
              color="dark"
              justify="flex-start"
              leftSection={
                <span className="app-action-icon">
                  <ExternalLink size={20} color="var(--mantine-color-gray-7)" />
                </span>
              }
              size="md"
              variant="subtle"
              onClick={() => onOpen(client)}
            >
              {t('Відкрити картку')}
            </Button>
          </Stack>
        </Stack>
      )}
    </AppModal>
  )
}

function OrganizationNameCell({ client }: { client: OrganizationClient }) {
  const name = getOrganizationClientName(client)

  return (
    <span className="organization-clients-name-cell" title={nativeTitle(name)}>
      {name}
    </span>
  )
}

function OrganizationTextCell({ value }: { value?: string | null }) {
  const display = displayTableValue(value)

  return (
    <span className="organization-clients-text-cell" title={nativeTitle(display)}>
      {display}
    </span>
  )
}

function OrganizationNumberCell({ money = false, value }: { money?: boolean; value?: number | null }) {
  const display = displayTableValue(value)
  const moneyClass = money ? ` app-money${typeof value === 'number' && value < 0 ? ' is-negative' : ''}` : ''

  return (
    <span className={`organization-clients-number-cell${moneyClass}`} title={nativeTitle(display)}>
      {display}
    </span>
  )
}

function displayTableValue(value?: number | string | null): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : ''
  }

  return value?.trim() || ''
}

function nativeTitle(value: string): string | undefined {
  const title = value.trim()

  return title ? title : undefined
}
