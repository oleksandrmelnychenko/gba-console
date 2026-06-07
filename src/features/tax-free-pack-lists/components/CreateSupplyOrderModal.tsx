import { Alert, Button, Group, Select, Stack, Text, TextInput } from '@mantine/core'
import { AppModal } from "../../../shared/ui/AppModal"
import { IconAlertCircle, IconSearch } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useEffect, useMemo, useReducer } from 'react'
import { formatLocalDateTime, formatLocalInputDateTime } from '../../../shared/date/dateTime'
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

type CreateSupplyOrderState = {
  error: string | null
  incomeDate: string
  isLoading: boolean
  isSaving: boolean
  organizations: Organization[]
  selectedAgreementNetUid: string | null
  selectedOrganizationNetUid: string | null
  selectedSupplierNetUid: string | null
  supplierSearch: string
  suppliers: Client[]
}

type CreateSupplyOrderAction =
  | { type: 'agreementSelected'; value: string | null }
  | { type: 'incomeDateChanged'; value: string }
  | { type: 'loadDictionariesFailed'; error: string }
  | { type: 'loadDictionariesStarted' }
  | { type: 'loadDictionariesSucceeded'; organizations: Organization[]; suppliers: Client[] }
  | { type: 'organizationSelected'; value: string | null }
  | { type: 'saveFailed'; error: string }
  | { type: 'saveFinished' }
  | { type: 'saveStarted' }
  | { type: 'setError'; error: string }
  | { type: 'supplierSearchChanged'; value: string }
  | { type: 'supplierSelected'; value: string | null }

export function CreateSupplyOrderModal({ opened, packList, onClose, onCreated }: CreateSupplyOrderModalProps) {
  const { t } = useI18n()
  const [state, dispatch] = useReducer(createSupplyOrderReducer, undefined, createInitialCreateSupplyOrderState)
  const {
    error,
    incomeDate,
    isLoading,
    isSaving,
    organizations,
    selectedAgreementNetUid,
    selectedOrganizationNetUid,
    selectedSupplierNetUid,
    supplierSearch,
    suppliers,
  } = state

  const selectedSupplier = useMemo(
    () => suppliers.find((supplier) => supplier.NetUid === selectedSupplierNetUid) || null,
    [selectedSupplierNetUid, suppliers],
  )
  const selectedOrganization = useMemo(
    () => organizations.find((item) => item.NetUid === selectedOrganizationNetUid) || null,
    [organizations, selectedOrganizationNetUid],
  )
  const agreements = useMemo(
    () => getAgreementsForOrganization(selectedSupplier, selectedOrganization),
    [selectedOrganization, selectedSupplier],
  )
  const effectiveAgreementValue = getEffectiveAgreementValue(selectedAgreementNetUid, agreements)

  useEffect(() => {
    let isActive = true

    async function loadDictionaries() {
      dispatch({ type: 'loadDictionariesStarted' })

      try {
        const [nextOrganizations, nextSuppliers] = await Promise.all([getOrganizations(), getSupplierClients()])

        if (isActive) {
          dispatch({ organizations: nextOrganizations, suppliers: nextSuppliers, type: 'loadDictionariesSucceeded' })
        }
      } catch (loadError) {
        if (isActive) {
          dispatch({
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити довідники'),
            type: 'loadDictionariesFailed',
          })
        }
      }
    }

    void loadDictionaries()

    return () => {
      isActive = false
    }
  }, [t])

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

    const organization = selectedOrganization
    const supplier = selectedSupplier
    const clientAgreement = agreements.find((item) => getAgreementValue(item) === effectiveAgreementValue)

    if (!organization || !supplier || !clientAgreement) {
      dispatch({ error: t('Оберіть постачальника, організацію та договір'), type: 'setError' })
      return
    }

    if (!incomeDate) {
      dispatch({ error: t('Оберіть дату приходу'), type: 'setError' })
      return
    }

    dispatch({ type: 'saveStarted' })

    try {
      const createdOrder = await createSupplyOrderFromPackList(packList.NetUid, {
        ClientAgreement: clientAgreement,
        FromDate: formatLocalInputDateTime(incomeDate),
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
      dispatch({
        error: saveError instanceof Error ? saveError.message : t('Не вдалося створити замовлення'),
        type: 'saveFailed',
      })
    } finally {
      dispatch({ type: 'saveFinished' })
    }
  }

  return (
    <AppModal centered opened={opened} size="lg" title={t('Створити замовлення з пакувального листа')} onClose={onClose}>
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
          onChange={(event) => dispatch({ type: 'supplierSearchChanged', value: event.currentTarget.value })}
        />
        <Select
          searchable
          data={filteredSuppliers.reduce<{ label: string; value: string }[]>((acc, supplier) => {
            const value = supplier.NetUid || String(supplier.Id || '')
            if (value) {
              acc.push({ label: getClientLabel(supplier), value })
            }
            return acc
          }, [])}
          disabled={isLoading}
          label={t('Постачальник')}
          value={selectedSupplierNetUid}
          onChange={(value) => dispatch({ type: 'supplierSelected', value })}
        />
        <Select
          searchable
          data={organizations.reduce<{ label: string; value: string }[]>((acc, organization) => {
            const value = organization.NetUid || String(organization.Id || '')
            if (value) {
              acc.push({ label: organization.Name || organization.FullName || t('Організація'), value })
            }
            return acc
          }, [])}
          disabled={isLoading}
          label={t('Організація')}
          value={selectedOrganizationNetUid}
          onChange={(value) => dispatch({ type: 'organizationSelected', value })}
        />
        <Select
          data={agreements.reduce<{ label: string; value: string }[]>((acc, agreement) => {
            const value = getAgreementValue(agreement)
            if (value) {
              acc.push({ label: getClientAgreementLabel(agreement), value })
            }
            return acc
          }, [])}
          disabled={!selectedSupplier || isLoading}
          label={t('Договір')}
          value={effectiveAgreementValue}
          onChange={(value) => dispatch({ type: 'agreementSelected', value })}
        />
        <TextInput
          disabled={isLoading || isSaving}
          label={t('Дата приходу')}
          type="datetime-local"
          value={incomeDate}
          onChange={(event) => dispatch({ type: 'incomeDateChanged', value: event.currentTarget.value })}
        />

        <Group justify="flex-end">
          <Button disabled={isSaving} variant="subtle" onClick={onClose}>{t('Скасувати')}</Button>
          <Button loading={isSaving} onClick={createOrder}>{t('Створити')}</Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function createInitialCreateSupplyOrderState(): CreateSupplyOrderState {
  return {
    error: null,
    incomeDate: toDateTimeInputValue(new Date()),
    isLoading: false,
    isSaving: false,
    organizations: [],
    selectedAgreementNetUid: null,
    selectedOrganizationNetUid: null,
    selectedSupplierNetUid: null,
    supplierSearch: '',
    suppliers: [],
  }
}

function createSupplyOrderReducer(
  state: CreateSupplyOrderState,
  action: CreateSupplyOrderAction,
): CreateSupplyOrderState {
  switch (action.type) {
    case 'agreementSelected':
      return { ...state, selectedAgreementNetUid: action.value }
    case 'incomeDateChanged':
      return { ...state, incomeDate: action.value }
    case 'loadDictionariesFailed':
      return { ...state, error: action.error, isLoading: false }
    case 'loadDictionariesStarted':
      return { ...state, error: null, isLoading: true }
    case 'loadDictionariesSucceeded':
      return {
        ...state,
        error: null,
        isLoading: false,
        organizations: action.organizations,
        selectedOrganizationNetUid: state.selectedOrganizationNetUid || action.organizations[0]?.NetUid || null,
        suppliers: action.suppliers,
      }
    case 'organizationSelected':
      return { ...state, selectedAgreementNetUid: null, selectedOrganizationNetUid: action.value }
    case 'saveFailed':
      return { ...state, error: action.error, isSaving: false }
    case 'saveFinished':
      return { ...state, isSaving: false }
    case 'saveStarted':
      return { ...state, error: null, isSaving: true }
    case 'setError':
      return { ...state, error: action.error }
    case 'supplierSearchChanged':
      return { ...state, supplierSearch: action.value }
    case 'supplierSelected':
      return { ...state, selectedAgreementNetUid: null, selectedSupplierNetUid: action.value }
  }
}

function getAgreementsForOrganization(
  supplier: Client | null,
  organization: Organization | null,
): NonNullable<Client['ClientAgreements']> {
  if (!supplier || !organization?.Id) {
    return []
  }

  return (supplier.ClientAgreements || []).filter((agreement) => agreement.Agreement?.OrganizationId === organization.Id)
}

function getAgreementValue(agreement?: NonNullable<Client['ClientAgreements']>[number]): string {
  return agreement?.NetUid || String(agreement?.Id || agreement?.AgreementId || '')
}

function getEffectiveAgreementValue(
  selectedAgreementNetUid: string | null,
  agreements: NonNullable<Client['ClientAgreements']>,
): string | null {
  const selectedAgreementExists = agreements.some((agreement) => getAgreementValue(agreement) === selectedAgreementNetUid)

  return selectedAgreementExists ? selectedAgreementNetUid : getAgreementValue(agreements[0]) || null
}

function toDateTimeInputValue(date: Date): string {
  return formatLocalDateTime(date).slice(0, 16)
}
