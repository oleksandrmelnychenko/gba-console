import { ActionIcon, Alert, Badge, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { CircleAlert, RotateCcw, Search } from 'lucide-react'
import { useEffect, useMemo, useReducer, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { DEFAULT_PAGINATOR_PAGE_SIZE } from '../../../shared/ui/paginator/paginatorPageSize'
import { getNewEcommerceClients } from '../api/ecommerceClientsApi'
import type { Client } from '../types'
import '../../../shared/ui/console-table-page.css'
import './new-ecommerce-clients-page.css'

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: '2-digit',
  year: 'numeric',
})
const NEW_ECOMMERCE_CLIENTS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: [],
    right: [],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

export function NewEcommerceClientsPage() {
  const { t } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [searchValue, setSearchValue] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGINATOR_PAGE_SIZE)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setLoading] = useState(true)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const normalizedSearchValue = normalizeSearchValue(searchValue)
  const filteredClients = useMemo(
    () => normalizedSearchValue
      ? clients.filter((client) => getClientSearchText(client).includes(normalizedSearchValue))
      : clients,
    [clients, normalizedSearchValue],
  )
  const totalPages = Math.max(1, Math.ceil(filteredClients.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageOffset = (currentPage - 1) * pageSize
  const visibleClients = filteredClients.slice(pageOffset, pageOffset + pageSize)
  const visibleFrom = filteredClients.length === 0 ? 0 : pageOffset + 1
  const visibleTo = filteredClients.length === 0 ? 0 : pageOffset + visibleClients.length
  const hasActiveSearch = Boolean(searchValue.trim())

  useEffect(() => {
    let cancelled = false

    async function loadClients() {
      setLoading(true)
      setError(null)

      try {
        const nextClients = await getNewEcommerceClients()

        if (!cancelled) {
          setClients(nextClients)
        }
      } catch (loadError) {
        if (!cancelled) {
          setClients([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити e-commerce клієнтів'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadClients()

    return () => {
      cancelled = true
    }
  }, [reloadKey, t])

  const columns = useMemo<DataTableColumn<Client>[]>(
    () => [
      {
        id: 'created',
        header: 'Дата створення',
        width: 160,
        minWidth: 140,
        accessor: (client) => getDateTime(client.Created),
        cell: (client) => <NewEcommerceClientTableValue value={displayValue(formatDateTime(client.Created))} />,
      },
      {
        id: 'status',
        header: 'Статус',
        width: 140,
        minWidth: 120,
        accessor: (client) => (client.IsIndividual ? t('Фізична особа') : t('Юридична особа')),
        cell: (client) => (
          <Badge color={client.IsIndividual ? 'teal' : 'indigo'} variant="light">
            {client.IsIndividual ? t('Фізична особа') : t('Юридична особа')}
          </Badge>
        ),
      },
      {
        id: 'fullName',
        header: 'Повна назва',
        width: 260,
        minWidth: 220,
        accessor: getClientDisplayName,
        cell: (client) => <NewEcommerceClientTableValue fw={600} value={displayValue(getClientDisplayName(client))} />,
      },
      {
        id: 'lastName',
        header: 'Прізвище',
        width: 160,
        minWidth: 120,
        accessor: (client) => client.LastName,
        cell: (client) => <NewEcommerceClientTableValue value={displayValue(client.LastName)} />,
      },
      {
        id: 'firstName',
        header: "Ім'я",
        width: 140,
        minWidth: 110,
        accessor: (client) => client.FirstName,
        cell: (client) => <NewEcommerceClientTableValue value={displayValue(client.FirstName)} />,
      },
      {
        id: 'phone',
        header: 'Телефон',
        width: 150,
        minWidth: 130,
        accessor: getClientPhone,
        cell: (client) => <NewEcommerceClientTableValue value={displayValue(getClientPhone(client))} />,
      },
      {
        id: 'email',
        header: 'Email',
        width: 220,
        minWidth: 160,
        accessor: (client) => client.EmailAddress,
        cell: (client) => <NewEcommerceClientTableValue value={displayValue(client.EmailAddress)} />,
      },
      {
        id: 'role',
        header: 'Роль',
        width: 180,
        minWidth: 140,
        accessor: (client) => client.ClientInRole?.ClientTypeRole?.Name,
        cell: (client) => <NewEcommerceClientTableValue value={displayValue(client.ClientInRole?.ClientTypeRole?.Name || t('Новий клієнт'))} />,
      },
    ],
    [t],
  )

  function openClient(client: Client) {
    if (!client.NetUid) {
      return
    }

    navigate(`/clients/edit/${client.NetUid}`, {
      state: {
        backgroundLocation: location,
        moduleTitle: t('Нові клієнти з e-commerce'),
        nodeTitle: getClientDisplayName(client),
        returnPath: `${location.pathname}${location.search}`,
      },
    })
  }

  return (
    <Stack className="new-ecommerce-clients-page console-table-page" gap={6}>
      <div className="new-ecommerce-clients-card console-table-shell">
        <div className="app-filter-bar new-ecommerce-clients-filter-bar">
          <TextInput
            className="new-ecommerce-clients-search"
            label={t('Пошук')}
            leftSection={<Search size={16} />}
            placeholder={t('ПІБ, телефон або email')}
            value={searchValue}
            onChange={(event) => {
              setPage(1)
              setSearchValue(event.currentTarget.value)
            }}
          />

          <div className="app-filter-actions">
            <span className="console-table-summary">
              {visibleFrom}-{visibleTo} / {filteredClients.length}
            </span>
            <Tooltip label={t('Скинути')}>
              <ActionIcon
                aria-label={t('Скинути')}
                color="gray"
                disabled={!hasActiveSearch}
                size={34}
                variant="light"
                onClick={() => {
                  setSearchValue('')
                  setPage(1)
                }}
              >
                <RotateCcw size={17} />
              </ActionIcon>
            </Tooltip>
            <Paginator
              isLoading={isLoading}
              page={currentPage}
              pageSize={pageSize}
              totalPages={totalPages}
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPage(1)
                setPageSize(nextPageSize)
              }}
              onRefresh={reload}
            />
          </div>
          <div ref={setTableToolbarSlot} className="app-filter-table-toolbar-slot new-ecommerce-clients-table-toolbar-slot" />
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

        <div className="new-ecommerce-clients-page__table console-table-body">
          <DataTable
            key="new-ecommerce-clients-table-default-freeze-4"
            columns={columns}
            data={visibleClients}
            defaultLayout={NEW_ECOMMERCE_CLIENTS_TABLE_DEFAULT_LAYOUT}
            distributeAvailableWidth
            emptyText={t('Нових e-commerce клієнтів не знайдено')}
            getRowId={(client, index) => String(client.NetUid || client.Id || index)}
            height="100%"
            isLoading={isLoading}
            layoutVersion="new-ecommerce-clients-table-default-freeze-4"
            loadingText={t('Завантаження клієнтів')}
            minWidth={1280}
            showLayoutControls
            tableId="new-ecommerce-clients"
            toolbarPortalTarget={tableToolbarSlot}
            onRowClick={openClient}
          />
        </div>
      </div>
    </Stack>
  )
}

function NewEcommerceClientTableValue({ fw, value }: { fw?: number; value: string }) {
  return (
    <Text className="new-ecommerce-clients-table-value" component="span" fw={fw} title={value}>
      {value}
    </Text>
  )
}

function formatDateTime(value?: Date | string): string {
  const time = getDateTime(value)

  if (time === null) {
    return ''
  }

  return dateTimeFormatter.format(new Date(time))
}

function getDateTime(value?: Date | string): number | null {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getTime()
  }

  const time = Date.parse(value)

  return Number.isNaN(time) ? null : time
}

function getClientDisplayName(client: Client): string {
  const fullName = client.FullName?.trim() || client.Name?.trim()

  if (fullName) {
    return fullName
  }

  return [client.FirstName, client.LastName, client.MiddleName].filter(Boolean).join(' ') || ''
}

function getClientPhone(client: Client): string {
  return client.MobileNumber?.trim() || client.ClientNumber?.trim() || ''
}

function getClientSearchText(client: Client): string {
  return normalizeSearchValue([
    client.FullName,
    client.Name,
    client.FirstName,
    client.LastName,
    client.MiddleName,
    getClientPhone(client),
    client.EmailAddress,
    client.ClientInRole?.ClientTypeRole?.Name,
  ].filter(Boolean).join(' '))
}

function normalizeSearchValue(value: string): string {
  return value.trim().toLocaleLowerCase('uk-UA')
}

function displayValue(value?: number | string | null): string {
  if (typeof value === 'number') {
    return String(value)
  }

  const normalized = value?.trim()
  return normalized || '-'
}
