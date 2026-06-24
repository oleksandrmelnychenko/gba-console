import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Checkbox,
  Divider,
  FileInput,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconArrowLeft,
  IconDeviceFloppy,
  IconFile,
  IconFileTypePdf,
  IconFileTypeXls,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconUpload,
  IconX,
} from '@tabler/icons-react'
import { type FormEvent, useEffect, useMemo, useRef } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { PermissionGate } from '../../auth/components/PermissionGate'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import type { TranslateFunction } from '../../../shared/i18n/types'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getDocumentHref } from '../../../shared/url/getDocumentHref'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import {
  createSupplyOrganization,
  createSupplyOrganizationAgreement,
  deleteSupplyOrganization,
  getSupplierOrganizationCurrencies,
  getSupplierOrganizationsOwners,
  getSupplyOrganization,
  updateSupplyOrganization,
  updateSupplyOrganizationAgreement,
} from '../api/supplierOrganizationsApi'
import type {
  Currency,
  Organization,
  SupplyOrganization,
  SupplyOrganizationAgreement,
  SupplyOrganizationAgreementFormValues,
  SupplyOrganizationBankFormValues,
  SupplyOrganizationContactFormValues,
  SupplyOrganizationDocument,
  SupplyOrganizationGeneralFormValues,
} from '../types'

const AGREEMENTS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['name'],
    right: ['documents'],
  },
  density: 'compact',
} satisfies DataTableDefaultLayout

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

const DRAWER_TRANSITION_MS = 220

type SupplierOrganizationRouteState = {
  backgroundLocation?: unknown
  returnPath?: string
}

export function SupplierOrganizationEditPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams()
  const routeState = location.state as SupplierOrganizationRouteState | null
  const returnPath = routeState?.returnPath || '/accounting/supplier-organizations'
  const isNew = !id
  const [organization, setOrganization] = useValueState<SupplyOrganization>(() => createEmptySupplyOrganization())
  const [organizationRevision, setOrganizationRevision] = useValueState(0)
  const [currencies, setCurrencies] = useValueState<Currency[]>([])
  const [ownerOrganizations, setOwnerOrganizations] = useValueState<Organization[]>([])
  const [activeTab, setActiveTab] = useValueState<string | null>('general')
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(false)
  const [isSaving, setSaving] = useValueState(false)
  const [isDeleting, setDeleting] = useValueState(false)
  const [deleteOpened, setDeleteOpened] = useValueState(false)
  const [drawerOpened, setDrawerOpened] = useValueState(false)
  const requestRef = useRef(0)

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => setDrawerOpened(true))

    return () => window.cancelAnimationFrame(frameId)
  }, [setDrawerOpened])

  useEffect(() => {
    const requestId = requestRef.current + 1
    requestRef.current = requestId
    setLoading(true)
    setError(null)

    async function load() {
      try {
        const [nextCurrencies, nextOwnerOrganizations, nextOrganization] = await Promise.all([
          getSupplierOrganizationCurrencies(),
          getSupplierOrganizationsOwners(),
          id ? getSupplyOrganization(id) : Promise.resolve(createEmptySupplyOrganization()),
        ])

        if (requestRef.current === requestId) {
          setCurrencies(nextCurrencies)
          setOwnerOrganizations(nextOwnerOrganizations)
          setOrganization(nextOrganization || createEmptySupplyOrganization())
          setOrganizationRevision((current) => current + 1)
        }
      } catch (loadError) {
        if (requestRef.current === requestId) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити постачальника послуг'))
        }
      } finally {
        if (requestRef.current === requestId) {
          setLoading(false)
        }
      }
    }

    void load()
  }, [id, setCurrencies, setError, setLoading, setOrganization, setOrganizationRevision, setOwnerOrganizations, t])

  async function reloadOrganization() {
    if (!id) {
      return
    }

    const requestId = requestRef.current + 1
    requestRef.current = requestId
    setLoading(true)
    setError(null)

    try {
      const nextOrganization = await getSupplyOrganization(id)

      if (requestRef.current === requestId && nextOrganization) {
        setOrganization(nextOrganization)
        setOrganizationRevision((current) => current + 1)
      }
    } catch (loadError) {
      if (requestRef.current === requestId) {
        setError(loadError instanceof Error ? loadError.message : t('Не вдалося оновити постачальника послуг'))
      }
    } finally {
      if (requestRef.current === requestId) {
        setLoading(false)
      }
    }
  }

  async function saveGeneral(values: SupplyOrganizationGeneralFormValues) {
    const validationError = validateGeneralForm(values)

    if (validationError) {
      setError(t(validationError))
      return
    }

    await saveOrganizationPayload(values)
  }

  async function saveBank(values: SupplyOrganizationBankFormValues) {
    await saveOrganizationPayload(values)
  }

  async function saveContact(values: SupplyOrganizationContactFormValues) {
    const validationError = validateContactForm(values)

    if (validationError) {
      setError(t(validationError))
      return
    }

    await saveOrganizationPayload(values)
  }

  async function saveOrganizationPayload(values: Partial<SupplyOrganization>) {
    setSaving(true)
    setError(null)

    try {
      const payload: SupplyOrganization = {
        ...organization,
        ...values,
      }
      const savedOrganization = isNew ? await createSupplyOrganization(payload) : await updateSupplyOrganization(payload)

      notifications.show({ color: 'green', message: t('Постачальника послуг збережено') })

      if (savedOrganization) {
        setOrganization(savedOrganization)
        setOrganizationRevision((current) => current + 1)

        if (isNew && savedOrganization.NetUid) {
          navigate(`/accounting/supplier-organizations/edit/${savedOrganization.NetUid}`, { replace: true, state: routeState })
        }
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти постачальника послуг'))
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!organization.NetUid) {
      setError(t('Постачальник не має NetUid для видалення'))
      setDeleteOpened(false)
      return
    }

    setDeleting(true)
    setError(null)

    try {
      await deleteSupplyOrganization(organization.NetUid)
      notifications.show({ color: 'green', message: t('Постачальника послуг видалено') })
      navigate(returnPath, { replace: true })
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t('Не вдалося видалити постачальника послуг'))
    } finally {
      setDeleting(false)
      setDeleteOpened(false)
    }
  }

  const tabsDisabled = !organization.Id
  const organizationFormKey = `${organization.NetUid || organization.Id || 'new'}-${organizationRevision}`

  function closeDrawer() {
    setDrawerOpened(false)
    window.setTimeout(() => navigate(returnPath, { replace: true }), DRAWER_TRANSITION_MS)
  }

  return (
    <AppDrawer
      opened={drawerOpened}
      position="right"
      size="wide"
      transitionProps={{ duration: DRAWER_TRANSITION_MS }}
      onClose={closeDrawer}
    >
      <Stack gap="md">
      <Group justify="space-between" align="center" gap="sm">
        <Group gap="xs">
          <Tooltip label={t('Назад')}>
            <ActionIcon aria-label={t('Назад')} color="gray" size={38} variant="light" onClick={closeDrawer}>
              <IconArrowLeft size={18} />
            </ActionIcon>
          </Tooltip>
          <Stack gap={0}>
            <Text fw={700} size="lg">
              {organization.Id ? t('Редагувати постачальника послуг') : t('Новий постачальник послуг')}
            </Text>
            <Text c="dimmed" size="sm">
              {displayValue(organization.Name)}
            </Text>
          </Stack>
        </Group>
        <Group gap="xs">
          {!isNew && (
            <Tooltip label={t('Оновити')}>
              <ActionIcon aria-label={t('Оновити')} color="gray" loading={isLoading} size={38} variant="light" onClick={() => void reloadOrganization()}>
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
          )}
          <PermissionGate permissionKey="SERVICE_Accounting_Supplier_Organizations_DelBtn_PKEY">
            {!isNew && (
              <Button color="red" leftSection={<IconTrash size={16} />} loading={isDeleting} variant="light" onClick={() => setDeleteOpened(true)}>
                {t('Видалити')}
              </Button>
            )}
          </PermissionGate>
        </Group>
      </Group>

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {error}
        </Alert>
      )}

      <Tabs color={CREATE_ACTION_COLOR} value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="general">{t('Загальна інформація')}</Tabs.Tab>
          <Tabs.Tab value="agreements" disabled={tabsDisabled}>
            {t('Договори')}
          </Tabs.Tab>
          <Tabs.Tab value="bank" disabled={tabsDisabled}>
            {t('Банківські реквізити')}
          </Tabs.Tab>
          <Tabs.Tab value="contact" disabled={tabsDisabled}>
            {t('Контактна особа')}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="general" pt="md">
          <GeneralInfoForm key={`general-${organizationFormKey}`} isSaving={isSaving} organization={organization} onSubmit={saveGeneral} />
        </Tabs.Panel>

        <Tabs.Panel value="agreements" pt="md">
          {activeTab === 'agreements' ? (
            <AgreementsPanel
              currencies={currencies}
              isLoading={isLoading}
              isSaving={isSaving}
              organization={organization}
              ownerOrganizations={ownerOrganizations}
              onError={setError}
              onReload={reloadOrganization}
              setSaving={setSaving}
            />
          ) : null}
        </Tabs.Panel>

        <Tabs.Panel value="bank" pt="md">
          <BankDetailsForm key={`bank-${organizationFormKey}`} isSaving={isSaving} organization={organization} onSubmit={saveBank} />
        </Tabs.Panel>

        <Tabs.Panel value="contact" pt="md">
          <ContactPersonForm key={`contact-${organizationFormKey}`} isSaving={isSaving} organization={organization} onSubmit={saveContact} />
        </Tabs.Panel>
      </Tabs>

      <DeleteModal
        isSubmitting={isDeleting}
        opened={deleteOpened}
        organization={organization}
        onClose={() => setDeleteOpened(false)}
        onConfirm={confirmDelete}
      />
      </Stack>
    </AppDrawer>
  )
}

function GeneralInfoForm({
  isSaving,
  organization,
  onSubmit,
}: {
  isSaving: boolean
  organization: SupplyOrganization
  onSubmit: (values: SupplyOrganizationGeneralFormValues) => void
}) {
  const { t } = useI18n()
  const [values, setValues] = useValueState(() => toGeneralFormValues(organization))

  function setField<K extends keyof SupplyOrganizationGeneralFormValues>(key: K, value: SupplyOrganizationGeneralFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit(values)
  }

  return (
    <form onSubmit={submit}>
      <Stack gap="md">
        <SimpleGrid cols={{ base: 1, md: 2 }}>
          <TextInput label={t('Назва')} required value={values.Name} onChange={(event) => setField('Name', event.currentTarget.value)} />
          <TextInput label={t('Адреса')} value={values.Address} onChange={(event) => setField('Address', event.currentTarget.value)} />
          <TextInput label={t('Email')} type="email" value={values.EmailAddress} onChange={(event) => setField('EmailAddress', event.currentTarget.value)} />
          <TextInput label={t('Телефон')} value={values.PhoneNumber} onChange={(event) => setField('PhoneNumber', event.currentTarget.value)} />
          <TextInput label={t('ПДВ номер')} value={values.SROI} onChange={(event) => setField('SROI', event.currentTarget.value)} />
          <TextInput label={t('ІПН')} value={values.TIN} onChange={(event) => setField('TIN', event.currentTarget.value)} />
          <TextInput label={t('ЄДРПОУ')} value={values.USREOU} onChange={(event) => setField('USREOU', event.currentTarget.value)} />
        </SimpleGrid>
        <Group gap="lg">
          <Checkbox
            checked={values.IsAgreementReceived}
            label={t('Договір отримано')}
            onChange={(event) => setField('IsAgreementReceived', event.currentTarget.checked)}
          />
          <Checkbox
            checked={values.IsBillReceived}
            label={t('Рахунок отримано')}
            onChange={(event) => setField('IsBillReceived', event.currentTarget.checked)}
          />
          <Checkbox
            checked={values.IsNotResident}
            label={t('Нерезидент')}
            onChange={(event) => setField('IsNotResident', event.currentTarget.checked)}
          />
        </Group>
        <Group justify="flex-end">
          <Button color={CREATE_ACTION_COLOR} leftSection={<IconDeviceFloppy size={16} />} loading={isSaving} type="submit">
            {t('Зберегти')}
          </Button>
        </Group>
      </Stack>
    </form>
  )
}

function BankDetailsForm({
  isSaving,
  organization,
  onSubmit,
}: {
  isSaving: boolean
  organization: SupplyOrganization
  onSubmit: (values: SupplyOrganizationBankFormValues) => void
}) {
  const { t } = useI18n()
  const [values, setValues] = useValueState(() => toBankFormValues(organization))

  function setField<K extends keyof SupplyOrganizationBankFormValues>(key: K, value: SupplyOrganizationBankFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit(values)
  }

  return (
    <form onSubmit={submit}>
      <Stack gap="md">
        <SimpleGrid cols={{ base: 1, md: 2 }}>
          <TextInput label={t('Банківські реквізити')} value={values.Requisites} onChange={(event) => setField('Requisites', event.currentTarget.value)} />
          <TextInput label={t('Номер рахунку')} value={values.AccountNumber} onChange={(event) => setField('AccountNumber', event.currentTarget.value)} />
          <TextInput label={t('Банк')} value={values.Bank} onChange={(event) => setField('Bank', event.currentTarget.value)} />
          <TextInput label="BankAccount" value={values.BankAccount} onChange={(event) => setField('BankAccount', event.currentTarget.value)} />
          <TextInput label="Swift" value={values.Swift} onChange={(event) => setField('Swift', event.currentTarget.value)} />
          <TextInput label={t('Swift/BIC')} value={values.SwiftBic} onChange={(event) => setField('SwiftBic', event.currentTarget.value)} />
          <TextInput label={t('Банк бенефіціара')} value={values.BeneficiaryBank} onChange={(event) => setField('BeneficiaryBank', event.currentTarget.value)} />
          <TextInput label={t('Банк-посередник')} value={values.IntermediaryBank} onChange={(event) => setField('IntermediaryBank', event.currentTarget.value)} />
          <TextInput label={t('Бенефіціар')} value={values.Beneficiary} onChange={(event) => setField('Beneficiary', event.currentTarget.value)} />
          <TextInput label="BankAccountEUR" value={values.BankAccountEUR} onChange={(event) => setField('BankAccountEUR', event.currentTarget.value)} />
        </SimpleGrid>
        <Group justify="flex-end">
          <Button color={CREATE_ACTION_COLOR} leftSection={<IconDeviceFloppy size={16} />} loading={isSaving} type="submit">
            {t('Зберегти')}
          </Button>
        </Group>
      </Stack>
    </form>
  )
}

function ContactPersonForm({
  isSaving,
  organization,
  onSubmit,
}: {
  isSaving: boolean
  organization: SupplyOrganization
  onSubmit: (values: SupplyOrganizationContactFormValues) => void
}) {
  const { t } = useI18n()
  const [values, setValues] = useValueState(() => toContactFormValues(organization))

  function setField<K extends keyof SupplyOrganizationContactFormValues>(key: K, value: SupplyOrganizationContactFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit(values)
  }

  return (
    <form onSubmit={submit}>
      <Stack gap="md">
        <SimpleGrid cols={{ base: 1, md: 2 }}>
          <TextInput label={t('ПІБ')} value={values.ContactPersonName} onChange={(event) => setField('ContactPersonName', event.currentTarget.value)} />
          <TextInput label={t('Телефон')} value={values.ContactPersonPhone} onChange={(event) => setField('ContactPersonPhone', event.currentTarget.value)} />
          <TextInput label={t('Email')} type="email" value={values.ContactPersonEmail} onChange={(event) => setField('ContactPersonEmail', event.currentTarget.value)} />
          <TextInput label="Viber" value={values.ContactPersonViber} onChange={(event) => setField('ContactPersonViber', event.currentTarget.value)} />
          <TextInput label="Skype" value={values.ContactPersonSkype} onChange={(event) => setField('ContactPersonSkype', event.currentTarget.value)} />
          <TextInput label={t('Коментар')} value={values.ContactPersonComment} onChange={(event) => setField('ContactPersonComment', event.currentTarget.value)} />
        </SimpleGrid>
        <Group justify="flex-end">
          <Button color={CREATE_ACTION_COLOR} leftSection={<IconDeviceFloppy size={16} />} loading={isSaving} type="submit">
            {t('Зберегти')}
          </Button>
        </Group>
      </Stack>
    </form>
  )
}

function AgreementsPanel({
  currencies,
  isLoading,
  isSaving,
  organization,
  ownerOrganizations,
  onError,
  onReload,
  setSaving,
}: {
  currencies: Currency[]
  isLoading: boolean
  isSaving: boolean
  organization: SupplyOrganization
  ownerOrganizations: Organization[]
  onError: (value: string | null) => void
  onReload: () => Promise<void>
  setSaving: (value: boolean) => void
}) {
  const { t } = useI18n()
  const [editor, setEditorState] = useValueState<SupplyOrganizationAgreement | null>(null)
  const [editorRevision, setEditorRevision] = useValueState(0)
  const agreements = organization.SupplyOrganizationAgreements || []
  const columns = useAgreementColumns((agreement) => setEditor(agreement))

  function setEditor(nextEditor: SupplyOrganizationAgreement | null) {
    setEditorState(nextEditor)
    setEditorRevision((current) => current + 1)
  }

  async function saveAgreement(values: SupplyOrganizationAgreementFormValues) {
    if (!values.name.trim()) {
      onError(t('Вкажіть назву договору'))
      return
    }

    const selectedOrganization = findEntity(ownerOrganizations, values.organizationId)
    const selectedCurrency = findEntity(currencies, values.currencyId)

    if (!selectedOrganization || !selectedCurrency) {
      onError(t('Оберіть організацію і валюту'))
      return
    }

    setSaving(true)
    onError(null)

    try {
      const payload: SupplyOrganizationAgreement = {
        ...(editor || {}),
        Currency: selectedCurrency,
        ExistFrom: values.existFrom,
        ExistTo: values.existTo,
        Name: values.name.trim(),
        Number: values.number.trim(),
        Organization: selectedOrganization,
        SupplyOrganizationId: organization.Id,
        SupplyOrganizationDocuments: editor?.SupplyOrganizationDocuments || [],
      }

      if (editor?.Id) {
        await updateSupplyOrganizationAgreement(payload, values.files)
      } else {
        await createSupplyOrganizationAgreement(payload, values.files)
      }

      notifications.show({ color: 'green', message: t('Договір збережено') })
      setEditor(null)
      await onReload()
    } catch (saveError) {
      onError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти договір'))
    } finally {
      setSaving(false)
    }
  }

  async function markDocumentDeleted(agreement: SupplyOrganizationAgreement, document: SupplyOrganizationDocument) {
    setSaving(true)
    onError(null)

    try {
      await updateSupplyOrganizationAgreement({
        ...agreement,
        SupplyOrganizationDocuments: (agreement.SupplyOrganizationDocuments || []).map((item) =>
          documentMatches(item, document) ? { ...item, Deleted: true } : item,
        ),
      })
      notifications.show({ color: 'green', message: t('Документ видалено') })
      await onReload()
    } catch (deleteError) {
      onError(deleteError instanceof Error ? deleteError.message : t('Не вдалося видалити документ'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group gap="xs">
          <Badge color="blue" variant="light">
            {t('Договорів')}: {agreements.length}
          </Badge>
        </Group>
        <Button color={CREATE_ACTION_COLOR} leftSection={<IconPlus size={16} />} onClick={() => setEditor(createEmptyAgreement())}>
          {t('Новий договір')}
        </Button>
      </Group>
      <DataTable
        columns={columns}
        data={agreements}
        defaultLayout={AGREEMENTS_TABLE_DEFAULT_LAYOUT}
        emptyText={t('Договорів немає')}
        getRowId={(agreement, index) => String(agreement.NetUid || agreement.Id || index)}
        isLoading={isLoading}
        layoutVersion="supplier-organization-agreements-1"
        maxHeight={420}
        minWidth={900}
        tableId={`supplier-organization-agreements-${organization.NetUid || organization.Id || 'new'}`}
        onRowClick={setEditor}
      />
      <AgreementDrawer
        key={`agreement-${editorRevision}-${getLookupKey(ownerOrganizations)}-${getLookupKey(currencies)}`}
        currencies={currencies}
        editor={editor}
        isSubmitting={isSaving}
        ownerOrganizations={ownerOrganizations}
        onClose={() => setEditor(null)}
        onDeleteDocument={markDocumentDeleted}
        onSubmit={saveAgreement}
      />
    </Stack>
  )
}

function useAgreementColumns(onEdit: (agreement: SupplyOrganizationAgreement) => void): DataTableColumn<SupplyOrganizationAgreement>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<SupplyOrganizationAgreement>[]>(
    () => [
      {
        id: 'name',
        header: t('Назва'),
        width: 230,
        minWidth: 180,
        accessor: (agreement) => agreement.Name,
        cell: (agreement) => <Text fw={600}>{displayValue(agreement.Name)}</Text>,
      },
      {
        id: 'number',
        header: t('Номер'),
        width: 150,
        minWidth: 120,
        accessor: (agreement) => agreement.Number,
        cell: (agreement) => displayValue(agreement.Number),
      },
      {
        id: 'organization',
        header: t('Організація'),
        width: 190,
        minWidth: 150,
        accessor: (agreement) => agreement.Organization?.Name,
        cell: (agreement) => displayValue(agreement.Organization?.Name),
      },
      {
        id: 'currency',
        header: t('Валюта'),
        width: 110,
        minWidth: 90,
        accessor: (agreement) => agreement.Currency?.Code,
        cell: (agreement) => displayValue(agreement.Currency?.Code || agreement.Currency?.Name),
      },
      {
        id: 'amount',
        header: t('Сума'),
        width: 125,
        minWidth: 110,
        align: 'right',
        accessor: (agreement) => agreement.CurrentAmount,
        cell: (agreement) => formatMoney(agreement.CurrentAmount),
      },
      {
        id: 'amountEuro',
        header: t('Сума EUR'),
        width: 125,
        minWidth: 110,
        align: 'right',
        accessor: (agreement) => agreement.CurrentEuroAmount,
        cell: (agreement) => formatMoney(agreement.CurrentEuroAmount),
      },
      {
        id: 'documents',
        header: t('Документи'),
        width: 120,
        minWidth: 105,
        align: 'right',
        enableSorting: false,
        cell: (agreement) => (
          <Button size="xs" variant="subtle" onClick={() => onEdit(agreement)}>
            {(agreement.SupplyOrganizationDocuments || []).filter((document) => !document.Deleted).length}
          </Button>
        ),
      },
    ],
    [onEdit, t],
  )
}

function AgreementDrawer({
  currencies,
  editor,
  isSubmitting,
  ownerOrganizations,
  onClose,
  onDeleteDocument,
  onSubmit,
}: {
  currencies: Currency[]
  editor: SupplyOrganizationAgreement | null
  isSubmitting: boolean
  ownerOrganizations: Organization[]
  onClose: () => void
  onDeleteDocument: (agreement: SupplyOrganizationAgreement, document: SupplyOrganizationDocument) => void
  onSubmit: (values: SupplyOrganizationAgreementFormValues) => void
}) {
  const { t } = useI18n()
  const [values, setValues] = useValueState(() => toAgreementFormValues(editor, ownerOrganizations, currencies, t))

  function setField<K extends keyof SupplyOrganizationAgreementFormValues>(
    key: K,
    value: SupplyOrganizationAgreementFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit(values)
  }

  const documents = (editor?.SupplyOrganizationDocuments || []).filter((document) => !document.Deleted)

  return (
    <AppDrawer
      opened={Boolean(editor)}
      padding="md"
      size="lg"
      title={editor?.Id ? `${t('Редагувати договір')}: ${displayValue(editor.Name)}` : t('Новий договір')}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <Stack gap="md">
          <TextInput label={t('Назва')} required value={values.name} onChange={(event) => setField('name', event.currentTarget.value)} />
          <TextInput label={t('Номер договору')} value={values.number} onChange={(event) => setField('number', event.currentTarget.value)} />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Select
              data={ownerOrganizations.map((organization) => ({
                label: displayValue(organization.Name),
                value: entityKey(organization),
              }))}
              label={t('Організація')}
              searchable
              value={values.organizationId || null}
              onChange={(value) => setField('organizationId', value || '')}
            />
            <Select
              data={currencies.map((currency) => ({
                label: getCurrencyLabel(currency),
                value: entityKey(currency),
              }))}
              label={t('Валюта')}
              searchable
              value={values.currencyId || null}
              onChange={(value) => setField('currencyId', value || '')}
            />
            <TextInput
              label={t('Діє з')}
              max={values.existTo || undefined}
              type="date"
              value={values.existFrom}
              onChange={(event) => setField('existFrom', event.currentTarget.value)}
            />
            <TextInput
              label={t('Діє до')}
              min={values.existFrom || undefined}
              type="date"
              value={values.existTo}
              onChange={(event) => setField('existTo', event.currentTarget.value)}
            />
          </SimpleGrid>

          <Divider label={t('Документи')} />
          <Stack gap="xs">
            {documents.map((document) => {
              const documentUrl = getSupplierAgreementDocumentUrl(document)
              const documentPdfUrl = getSupplierAgreementDocumentPdfUrl(document)
              const documentName = getDocumentName(document)

              return (
                <Group key={getSupplierAgreementDocumentKey(document, documentName)} justify="space-between" wrap="nowrap">
                  <Group gap="xs" wrap="nowrap">
                    <IconFile size={16} />
                    <Text size="sm">{displayValue(documentName)}</Text>
                  </Group>
                  <Group gap={4} wrap="nowrap">
                    {documentUrl && (
                      <Tooltip label={t('Документ')}>
                        <ActionIcon component="a" href={getDocumentHref(documentUrl)} target="_blank" rel="noreferrer" aria-label={t('Документ')} size="sm" variant="subtle">
                          <IconFileTypeXls size={16} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                    {documentPdfUrl && (
                      <Tooltip label={t('PDF')}>
                        <ActionIcon component="a" href={getDocumentHref(documentPdfUrl)} target="_blank" rel="noreferrer" aria-label={t('PDF')} size="sm" variant="subtle">
                          <IconFileTypePdf size={16} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                    {editor && (
                      <Tooltip label={t('Видалити')}>
                        <ActionIcon aria-label={t('Видалити документ')} color="red" size="sm" variant="subtle" onClick={() => onDeleteDocument(editor, document)}>
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Group>
                </Group>
              )
            })}
            {documents.length === 0 && <Text c="dimmed" size="sm">{t('Документів немає')}</Text>}
          </Stack>

          <FileInput
            clearable
            label={t('Додати файли')}
            leftSection={<IconUpload size={16} />}
            multiple
            value={values.files}
            onChange={(files) => setField('files', files || [])}
          />

          <Group justify="flex-end">
            <Button color="gray" leftSection={<IconX size={16} />} variant="subtle" onClick={onClose}>
              {t('Скасувати')}
            </Button>
            <Button color={CREATE_ACTION_COLOR} leftSection={<IconDeviceFloppy size={16} />} loading={isSubmitting} type="submit">
              {t('Зберегти')}
            </Button>
          </Group>
        </Stack>
      </form>
    </AppDrawer>
  )
}

function DeleteModal({
  isSubmitting,
  opened,
  organization,
  onClose,
  onConfirm,
}: {
  isSubmitting: boolean
  opened: boolean
  organization: SupplyOrganization
  onClose: () => void
  onConfirm: () => void
}) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={opened} title={t('Видалити постачальника послуг')} onClose={onClose}>
      <Stack gap="md">
        <Text>
          {t('Видалити')} <Text span fw={700}>{displayValue(organization.Name)}</Text>?
        </Text>
        <Group justify="flex-end">
          <Button color="gray" variant="subtle" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button color="red" loading={isSubmitting} onClick={onConfirm}>
            {t('Видалити')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function createEmptySupplyOrganization(): SupplyOrganization {
  return {
    Address: '',
    EmailAddress: '',
    IsAgreementReceived: false,
    IsBillReceived: false,
    IsNotResident: false,
    Name: '',
    PhoneNumber: '',
    SROI: '',
    SupplyOrganizationAgreements: [],
    TIN: '',
    USREOU: '',
  }
}

function createEmptyAgreement(): SupplyOrganizationAgreement {
  const now = new Date()
  const to = new Date()
  to.setFullYear(to.getFullYear() + 1)

  return {
    ExistFrom: formatLocalDate(now),
    ExistTo: formatLocalDate(to),
    Name: '',
    Number: '',
    SupplyOrganizationDocuments: [],
  }
}

function toGeneralFormValues(organization: SupplyOrganization): SupplyOrganizationGeneralFormValues {
  return {
    Address: organization.Address || '',
    EmailAddress: organization.EmailAddress || '',
    IsAgreementReceived: Boolean(organization.IsAgreementReceived),
    IsBillReceived: Boolean(organization.IsBillReceived),
    IsNotResident: Boolean(organization.IsNotResident),
    Name: organization.Name || '',
    PhoneNumber: organization.PhoneNumber || '',
    SROI: organization.SROI || '',
    TIN: organization.TIN || '',
    USREOU: organization.USREOU || '',
  }
}

function toBankFormValues(organization: SupplyOrganization): SupplyOrganizationBankFormValues {
  return {
    AccountNumber: organization.AccountNumber || '',
    Bank: organization.Bank || '',
    BankAccount: organization.BankAccount || '',
    BankAccountEUR: organization.BankAccountEUR || '',
    Beneficiary: organization.Beneficiary || '',
    BeneficiaryBank: organization.BeneficiaryBank || '',
    IntermediaryBank: organization.IntermediaryBank || '',
    Requisites: organization.Requisites || '',
    Swift: organization.Swift || '',
    SwiftBic: organization.SwiftBic || '',
  }
}

function toContactFormValues(organization: SupplyOrganization): SupplyOrganizationContactFormValues {
  return {
    ContactPersonComment: organization.ContactPersonComment || '',
    ContactPersonEmail: organization.ContactPersonEmail || '',
    ContactPersonName: organization.ContactPersonName || '',
    ContactPersonPhone: organization.ContactPersonPhone || '',
    ContactPersonSkype: organization.ContactPersonSkype || '',
    ContactPersonViber: organization.ContactPersonViber || '',
  }
}

function toAgreementFormValues(
  agreement: SupplyOrganizationAgreement | null,
  organizations: Organization[],
  currencies: Currency[],
  t: TranslateFunction,
): SupplyOrganizationAgreementFormValues {
  const emptyAgreement = createEmptyAgreement()

  return {
    currencyId: entityKey(agreement?.Currency) || entityKey(currencies[0]),
    existFrom: normalizeDateInput(agreement?.ExistFrom) || emptyAgreement.ExistFrom || '',
    existTo: normalizeDateInput(agreement?.ExistTo) || emptyAgreement.ExistTo || '',
    files: [],
    name: agreement?.Name || (agreement?.Id ? '' : t('Основний договір')),
    number: agreement?.Number || '',
    organizationId: entityKey(agreement?.Organization) || entityKey(organizations[0]),
  }
}

function validateGeneralForm(values: SupplyOrganizationGeneralFormValues): string | null {
  if (!values.Name.trim()) {
    return 'Вкажіть назву'
  }

  if (values.EmailAddress && !isEmail(values.EmailAddress)) {
    return 'Некоректний email'
  }

  return null
}

function validateContactForm(values: SupplyOrganizationContactFormValues): string | null {
  if (values.ContactPersonEmail && !isEmail(values.ContactPersonEmail)) {
    return 'Некоректний email'
  }

  return null
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function findEntity<TEntity extends { Id?: number; NetUid?: string }>(items: TEntity[], key: string): TEntity | null {
  return items.find((item) => entityKey(item) === key) || null
}

function getLookupKey<TEntity extends { Id?: number; NetUid?: string }>(items: TEntity[]): string {
  return items.map(entityKey).join('|')
}

function entityKey(entity?: { Id?: number; NetUid?: string } | null): string {
  if (!entity) {
    return ''
  }

  return entity.NetUid || (entity.Id ? String(entity.Id) : '')
}

function getCurrencyLabel(currency: Currency): string {
  return [currency.Code, currency.Name].filter(Boolean).join(' - ') || displayValue(currency.Id)
}

function documentMatches(left: SupplyOrganizationDocument, right: SupplyOrganizationDocument): boolean {
  if (left.NetUid && right.NetUid) {
    return left.NetUid === right.NetUid
  }

  if (left.Id && right.Id) {
    return left.Id === right.Id
  }

  const leftUrl = getSupplierAgreementDocumentUrl(left)
  const rightUrl = getSupplierAgreementDocumentUrl(right)

  return Boolean(leftUrl && leftUrl === rightUrl)
}

function getDocumentName(document: SupplyOrganizationDocument): string {
  return document.Name || document.FileName || getSupplierAgreementDocumentUrl(document) || getSupplierAgreementDocumentPdfUrl(document) || ''
}

function getSupplierAgreementDocumentUrl(document: SupplyOrganizationDocument): string | undefined {
  return document.DocumentURL || document.DocumentUrl || document.URL || document.Url || document.url
}

function getSupplierAgreementDocumentPdfUrl(document: SupplyOrganizationDocument): string | undefined {
  return document.PdfDocumentURL || document.PdfDocumentUrl
}

function getSupplierAgreementDocumentKey(document: SupplyOrganizationDocument, documentName: string): string {
  return document.NetUid
    || (document.Id ? String(document.Id) : undefined)
    || getSupplierAgreementDocumentUrl(document)
    || getSupplierAgreementDocumentPdfUrl(document)
    || documentName
}

function normalizeDateInput(value?: string): string {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''
  }

  return formatLocalDate(date)
}

function formatMoney(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? moneyFormatter.format(value) : '—'
}

function displayValue(value?: string | number | null): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '—'
  }

  return value || '—'
}
