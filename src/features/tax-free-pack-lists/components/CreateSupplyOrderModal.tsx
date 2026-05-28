import { Alert, Button, Group, Modal, Select, Stack, Text, TextInput } from '@mantine/core'
import { IconAlertCircle, IconSearch } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useEffect, useMemo, useState } from 'react'
import { formatLocalDateTime } from '../../../shared/date/dateTime'
import { useI18n } from '../../../shared/i18n/useI18n'
import {
  createSupplyOrderFromPackList,
  getOrganizations,
  getSupplierClients,
} from '../api/taxFreePackListsApi'
import type { Client, Organization, TaxFreePackList } from '../types'
import { formatDateTime, getClientAgreementLabel, getClientLabel } from '../utils'

type CreateSupplyOrderModalProps = {
  opened: boolean
  packList: TaxFreePackList | null
  onClose: () => void
  onCreated?: (netUid: string) => void
}

export function CreateSupplyOrderModal({ opened, packList, onClose, onCreated }: CreateSupplyOrderModalProps) {
  const { t } = useI18n()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [suppliers, setSuppliers] = useState<Client[]>([])
  const [supplierSearch, setSupplierSearch] = useState('')
  const [selectedOrganizationNetUid, setSelectedOrganizationNetUid] = useState<string | null>(null)
  const [selectedSupplierNetUid, setSelectedSupplierNetUid] = useState<string | null>(null)
  const [selectedAgreementNetUid, setSelectedAgreementNetUid] = useState<string | null>(null)
  const [isSaving, setSaving] = useState(false)
  const [isLoading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedSupplier = useMemo(
    () => suppliers.find((supplier) => supplier.NetUid === selectedSupplierNetUid) || null,
    [selectedSupplierNetUid, suppliers],
  )
  const agreements = useMemo(() => selectedSupplier?.ClientAgreements || [], [selectedSupplier])

  useEffect(() => {
    if (!opened) {
      return
    }

    async function loadDictionaries() {
      setError(null)
      setLoading(true)

      try {
        const [nextOrganizations, nextSuppliers] = await Promise.all([getOrganizations(), getSupplierClients()])
        setOrganizations(nextOrganizations)
        setSuppliers(nextSuppliers)
        setSelectedOrganizationNetUid(nextOrganizations[0]?.NetUid || null)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити довідники'))
      } finally {
        setLoading(false)
      }
    }

    loadDictionaries()
  }, [opened, t])

  const filteredSuppliers = useMemo(() => {
    const normalizedSearch = supplierSearch.trim().toLowerCase()

    if (!normalizedSearch) {
      return suppliers.slice(0, 50)
    }

    return suppliers
      .filter((supplier) => getClientLabel(supplier).toLowerCase().includes(normalizedSearch))
      .slice(0, 50)
  }, [supplierSearch, suppliers])

  async function createOrder() {
    if (!packList?.NetUid) {
      return
    }

    const organization = organizations.find((item) => item.NetUid === selectedOrganizationNetUid)
    const supplier = selectedSupplier
    const effectiveAgreementNetUid = selectedAgreementNetUid || agreements[0]?.NetUid || null
    const clientAgreement = agreements.find((item) => item.NetUid === effectiveAgreementNetUid)

    if (!organization || !supplier || !clientAgreement) {
      setError(t('Оберіть постачальника, організацію та договір'))
      return
    }

    setSaving(true)
    setError(null)

    try {
      const createdOrder = await createSupplyOrderFromPackList(packList.NetUid, {
        ClientAgreement: clientAgreement,
        FromDate: formatLocalDateTime(new Date()),
        Number: '',
        Organization: organization,
        Supplier: supplier,
      })

      notifications.show({ color: 'green', message: t('Замовлення створено') })
      if (createdOrder?.NetUid) {
        onCreated?.(createdOrder.NetUid)
      }
      onClose()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося створити замовлення'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal centered opened={opened} size="lg" title={t('Створити замовлення з пакувального листа')} onClose={onClose}>
      <Stack>
        {error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <Text size="sm">
          {t('Пакувальний лист')}: <b>{packList?.Number || '-'}</b>, {t('дата')}: {formatDateTime(packList?.FromDate)}
        </Text>
        <TextInput
          leftSection={<IconSearch size={16} />}
          label={t('Пошук постачальника')}
          value={supplierSearch}
          onChange={(event) => setSupplierSearch(event.currentTarget.value)}
        />
        <Select
          searchable
          data={filteredSuppliers.map((supplier) => ({
            label: getClientLabel(supplier),
            value: supplier.NetUid || String(supplier.Id || ''),
          })).filter((item) => item.value)}
          disabled={isLoading}
          label={t('Постачальник')}
          value={selectedSupplierNetUid}
          onChange={(value) => {
            const supplier = suppliers.find((item) => item.NetUid === value)
            setSelectedSupplierNetUid(value)
            setSelectedAgreementNetUid(supplier?.ClientAgreements?.[0]?.NetUid || null)
          }}
        />
        <Select
          searchable
          data={organizations.map((organization) => ({
            label: organization.Name || organization.FullName || t('Організація'),
            value: organization.NetUid || String(organization.Id || ''),
          })).filter((item) => item.value)}
          disabled={isLoading}
          label={t('Організація')}
          value={selectedOrganizationNetUid}
          onChange={setSelectedOrganizationNetUid}
        />
        <Select
          data={agreements.map((agreement) => ({
            label: getClientAgreementLabel(agreement),
            value: agreement.NetUid || String(agreement.Id || agreement.AgreementId || ''),
          })).filter((item) => item.value)}
          disabled={!selectedSupplier || isLoading}
          label={t('Договір')}
          value={selectedAgreementNetUid || agreements[0]?.NetUid || null}
          onChange={setSelectedAgreementNetUid}
        />

        <Group justify="flex-end">
          <Button disabled={isSaving} variant="subtle" onClick={onClose}>{t('Скасувати')}</Button>
          <Button loading={isSaving} onClick={createOrder}>{t('Створити')}</Button>
        </Group>
      </Stack>
    </Modal>
  )
}
