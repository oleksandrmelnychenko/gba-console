import { Alert, Badge, Card, Stack, Text } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { getNewEcommerceClients } from '../api/ecommerceClientsApi'
import type { Client } from '../types'

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: '2-digit',
  year: 'numeric',
})
const NEW_ECOMMERCE_CLIENTS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['created', 'status', 'fullName'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

export function NewEcommerceClientsPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [clients, setClients] = useState<Client[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setLoading] = useState(true)

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
  }, [t])

  const columns = useMemo<DataTableColumn<Client>[]>(
    () => [
      {
        id: 'created',
        header: 'Дата створення',
        width: 160,
        minWidth: 140,
        accessor: (client) => getDateTime(client.Created),
        cell: (client) => displayValue(formatDateTime(client.Created)),
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
        width: 240,
        minWidth: 180,
        accessor: getClientDisplayName,
        cell: (client) => <Text fw={600}>{displayValue(getClientDisplayName(client))}</Text>,
      },
      {
        id: 'lastName',
        header: 'Прізвище',
        width: 160,
        minWidth: 120,
        accessor: (client) => client.LastName,
        cell: (client) => displayValue(client.LastName),
      },
      {
        id: 'firstName',
        header: "Ім'я",
        width: 140,
        minWidth: 110,
        accessor: (client) => client.FirstName,
        cell: (client) => displayValue(client.FirstName),
      },
      {
        id: 'phone',
        header: 'Телефон',
        width: 150,
        minWidth: 130,
        accessor: getClientPhone,
        cell: (client) => displayValue(getClientPhone(client)),
      },
      {
        id: 'email',
        header: 'Email',
        width: 220,
        minWidth: 160,
        accessor: (client) => client.EmailAddress,
        cell: (client) => displayValue(client.EmailAddress),
      },
      {
        id: 'role',
        header: 'Роль',
        width: 180,
        minWidth: 140,
        accessor: (client) => client.ClientInRole?.ClientTypeRole?.Name,
        cell: (client) => displayValue(client.ClientInRole?.ClientTypeRole?.Name || t('Новий клієнт')),
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
        moduleTitle: t('Нові клієнти з e-commerce'),
        nodeTitle: getClientDisplayName(client),
      },
    })
  }

  return (
    <Stack gap="lg">
      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {error}
            </Alert>
          )}

          <DataTable
            columns={columns}
            data={clients}
            defaultLayout={NEW_ECOMMERCE_CLIENTS_TABLE_DEFAULT_LAYOUT}
            emptyText={t('Нових e-commerce клієнтів не знайдено')}
            getRowId={(client, index) => String(client.NetUid || client.Id || index)}
            height="calc(100vh - 220px)"
            isLoading={isLoading}
            layoutVersion="new-ecommerce-clients-table-default-freeze-1"
            loadingText={t('Завантаження клієнтів')}
            minWidth={1280}
            tableId="new-ecommerce-clients"
            onRowClick={openClient}
          />
        </Stack>
      </Card>
    </Stack>
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

function displayValue(value?: number | string | null): string {
  if (typeof value === 'number') {
    return String(value)
  }

  const normalized = value?.trim()
  return normalized || '-'
}
