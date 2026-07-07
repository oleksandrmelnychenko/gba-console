import { Alert, Button, Group, Select, Stack, Text, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { CircleAlert, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { formatLocalDate, formatLocalDateTime } from '../../../shared/date/dateTime'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import {
  getSupplyOrderOrganizations,
  getSupplyOrderSuppliers,
} from '../../supply-ukraine-orders/api/supplyUkraineOrdersApi'
import type {
  Client,
  ClientAgreement,
  Organization,
  SupplyOrderUkraine,
} from '../../supply-ukraine-orders/types'
import { createSupplyOrderFromSad } from '../api/sadApi'
import type { Sad } from '../types'

type SadSupplyOrderFromSadModalProps = {
  opened: boolean
  sad: Sad | null
  onClose: () => void
  onCreated?: (netUid: string) => void
}

export function SadSupplyOrderFromSadModal({
  onClose,
  onCreated,
  opened,
  sad,
}: SadSupplyOrderFromSadModalProps) {
  const { t } = useI18n()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [suppliers, setSuppliers] = useState<Client[]>([])
  const [supplierSearch, setSupplierSearch] = useState('')
  const [orderDate, setOrderDate] = useState(() => formatLocalDate(new Date()))
  const [selectedOrganizationNetUid, setSelectedOrganizationNetUid] = useState<string | null>(null)
  const [selectedSupplierNetUid, setSelectedSupplierNetUid] = useState<string | null>(null)
  const [selectedAgreementNetUid, setSelectedAgreementNetUid] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setLoading] = useState(false)
  const [isSaving, setSaving] = useState(false)

  const selectedOrganization = useMemo(
    () => organizations.find((organization) => getEntityValue(organization) === selectedOrganizationNetUid) || null,
    [organizations, selectedOrganizationNetUid],
  )
  const selectedSupplier = useMemo(
    () => suppliers.find((supplier) => getEntityValue(supplier) === selectedSupplierNetUid) || null,
    [selectedSupplierNetUid, suppliers],
  )
  const agreements = useMemo(
    () => filterAgreementsByOrganization(selectedSupplier?.ClientAgreements || [], selectedOrganization),
    [selectedOrganization, selectedSupplier],
  )
  const effectiveAgreementNetUid = useMemo(() => {
    if (selectedAgreementNetUid && agreements.some((agreement) => getEntityValue(agreement) === selectedAgreementNetUid)) {
      return selectedAgreementNetUid
    }

    return getEntityValue(agreements[0]) || null
  }, [agreements, selectedAgreementNetUid])

  const filteredSuppliers = useMemo(() => {
    const normalizedSearch = supplierSearch.trim().toLowerCase()
    const visibleSuppliers = normalizedSearch
      ? suppliers.filter((supplier) => getClientLabel(supplier).toLowerCase().includes(normalizedSearch))
      : suppliers

    return visibleSuppliers.slice(0, 50)
  }, [supplierSearch, suppliers])

  useEffect(() => {
    if (!opened) {
      return
    }

    let cancelled = false

    async function loadDictionaries() {
      setError(null)
      setLoading(true)
      setOrderDate(formatLocalDate(new Date()))
      setSupplierSearch('')
      setSelectedSupplierNetUid(null)
      setSelectedAgreementNetUid(null)

      try {
        const [nextOrganizations, nextSuppliers] = await Promise.all([
          getSupplyOrderOrganizations(),
          getSupplyOrderSuppliers(),
        ])

        if (cancelled) {
          return
        }

        const organizationNetUid = getEntityValue(nextOrganizations[0]) || null
        const preferredSupplierNetUid = pickPreferredSupplierNetUid(sad, nextSuppliers)

        setOrganizations(nextOrganizations)
        setSuppliers(nextSuppliers)
        setSelectedOrganizationNetUid(organizationNetUid)
        setSelectedSupplierNetUid(preferredSupplierNetUid)
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити довідники'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadDictionaries()

    return () => {
      cancelled = true
    }
  }, [opened, sad, t])

  async function createOrder() {
    if (!sad?.NetUid) {
      return
    }

    const supplier = selectedSupplier
    const clientAgreement = agreements.find((agreement) => getEntityValue(agreement) === effectiveAgreementNetUid) || agreements[0]

    if (!selectedOrganization || !supplier || !clientAgreement) {
      setError(t('Оберіть постачальника, організацію та договір'))
      return
    }

    const order: Partial<SupplyOrderUkraine> = {
      ClientAgreement: clientAgreement,
      FromDate: toLocalDateTime(orderDate),
      Number: '',
      Organization: selectedOrganization,
      Supplier: supplier,
    }

    setSaving(true)
    setError(null)

    try {
      const createdOrder = await createSupplyOrderFromSad(sad.NetUid, order)
      notifications.show({ color: 'green', message: t('Замовлення створено') })
      onCreated?.(createdOrder?.NetUid || '')
      onClose()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося створити замовлення'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppModal centered opened={opened} size="lg" title={t('Створити замовлення постачання з SAD')} onClose={onClose}>
      <Stack>
        {error && (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <Text size="sm">
          {t('SAD')}: <b>{sad?.Number || '-'}</b>, {t('дата')}: {formatDisplayDate(sad?.FromDate)}
        </Text>

        <TextInput
          leftSection={<Search size={16} />}
          label={t('Пошук постачальника')}
          value={supplierSearch}
          onChange={(event) => setSupplierSearch(event.currentTarget.value)}
        />

        <Select
          data={filteredSuppliers.reduce<{ label: string; value: string }[]>((acc, supplier) => {
            const option = {
              label: getClientLabel(supplier),
              value: getEntityValue(supplier),
            }
            if (option.value) {
              acc.push(option)
            }
            return acc
          }, [])}
          disabled={isLoading}
          label={t('Постачальник')}
          searchable
          value={selectedSupplierNetUid}
          onChange={(value) => {
            const supplier = suppliers.find((item) => getEntityValue(item) === value)
            setSelectedSupplierNetUid(value)
            setSelectedAgreementNetUid(getEntityValue(
              filterAgreementsByOrganization(supplier?.ClientAgreements || [], selectedOrganization)[0],
            ) || null)
          }}
        />

        <Select
          data={organizations.reduce<{ label: string; value: string }[]>((acc, organization) => {
            const option = {
              label: getEntityName(organization) || t('Організація'),
              value: getEntityValue(organization),
            }
            if (option.value) {
              acc.push(option)
            }
            return acc
          }, [])}
          disabled={isLoading}
          label={t('Організація')}
          searchable
          value={selectedOrganizationNetUid}
          onChange={(value) => {
            setSelectedOrganizationNetUid(value)
            setSelectedAgreementNetUid(null)
          }}
        />

        <Select
          data={agreements.reduce<{ label: string; value: string }[]>((acc, agreement) => {
            const option = {
              label: getClientAgreementLabel(agreement),
              value: getEntityValue(agreement),
            }
            if (option.value) {
              acc.push(option)
            }
            return acc
          }, [])}
          disabled={!selectedSupplier || isLoading}
          label={t('Договір')}
          value={effectiveAgreementNetUid}
          onChange={setSelectedAgreementNetUid}
        />

        <TextInput
          disabled={isLoading || isSaving}
          label={t('Дата приходу')}
          type="date"
          value={orderDate}
          onChange={(event) => setOrderDate(event.currentTarget.value)}
        />

        <Group justify="flex-end">
          <Button disabled={isSaving} variant="subtle" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button disabled={isLoading} loading={isSaving} onClick={() => void createOrder()}>
            {t('Створити')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function filterAgreementsByOrganization(agreements: ClientAgreement[], organization: Organization | null): ClientAgreement[] {
  if (!organization?.Id) {
    return agreements
  }

  const matchedAgreements = agreements.filter((agreement) => agreement.Agreement?.OrganizationId === organization.Id)

  return matchedAgreements.length ? matchedAgreements : agreements
}

function pickPreferredSupplierNetUid(sad: Sad | null, suppliers: Client[]): string | null {
  const supplierIds = new Set(
    (sad?.SadItems || [])
      .map((item) => item.Supplier?.NetUid || item.SupplyOrderUkraineCartItem?.Supplier?.NetUid)
      .filter((netUid): netUid is string => Boolean(netUid)),
  )

  if (supplierIds.size !== 1) {
    return null
  }

  const [supplierNetUid] = Array.from(supplierIds)

  return suppliers.some((supplier) => supplier.NetUid === supplierNetUid) ? supplierNetUid : null
}

function getEntityValue(entity?: { Id?: number; NetUid?: string } | null): string {
  return String(entity?.NetUid || entity?.Id || '')
}

function getEntityName(entity?: { FullName?: string; Name?: string } | null): string {
  return entity?.FullName || entity?.Name || ''
}

function getClientLabel(client: Client): string {
  const name = getEntityName(client)

  return client.USREOU ? `${name} - ${client.USREOU}` : name
}

function getClientAgreementLabel(clientAgreement: ClientAgreement): string {
  const agreement = clientAgreement.Agreement
  const currency = agreement?.Currency?.Code || agreement?.Currency?.Name
  const name = agreement?.Name || agreement?.FullName || clientAgreement.NetUid || ''

  return currency ? `${name} (${currency})` : name
}

function toLocalDateTime(dateValue: string): string {
  const date = new Date(`${dateValue || formatLocalDate(new Date())}T00:00:00`)

  return Number.isNaN(date.getTime()) ? formatLocalDateTime(new Date()) : formatLocalDateTime(date)
}

function formatDisplayDate(value?: Date | string): string {
  if (!value) {
    return '-'
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('uk-UA')
}
