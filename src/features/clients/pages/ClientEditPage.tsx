import {
  Alert,
  Badge,
  Button,
  Card,
  Grid,
  Group,
  Loader,
  Stack,
  Switch,
  Text,
  Title,
} from '@mantine/core'
import { AppDrawer } from "../../../shared/ui/AppDrawer"
import { AppModal } from "../../../shared/ui/AppModal"
import { CREATE_ACTION_COLOR } from "../../../shared/ui/page-header-actions/PageHeaderActions"
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconCheck, IconChevronRight, IconDeviceFloppy, IconTrash } from '@tabler/icons-react'
import { type FormEvent, useEffect, useMemo, useRef } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { translate } from '../../../shared/i18n/translate'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useAuth } from '../../auth/useAuth'
import { deleteClient, getClientById, updateClient } from '../api/clientFormApi'
import { uploadClientContract } from '../api/clientCabinetApi'
import {
  createCountry,
  createIncoterm,
  createRegion,
  getAvailableRegionCode,
} from '../api/clientLookupsApi'
import { useClientFormLookups } from '../hooks/useClientFormLookups'
import { BankDetailsFields } from '../components/form/BankDetailsFields'
import { ContactInfoFields } from '../components/form/ContactInfoFields'
import { EditClientTypePanel } from '../components/EditClientTypePanel'
import { EcommercePanel } from '../components/ecommerce/EcommercePanel'
import { GeneralInfoFields, type ClientFormRole } from '../components/form/GeneralInfoFields'
import { PerfectClientPanel } from '../components/perfect-client/PerfectClientPanel'
import { PricingPanel } from '../components/pricing/PricingPanel'
import { applyPendingDiscountDraft } from '../components/pricing/pendingDiscountDraft'
import type { DiscountsTreeDraft } from '../components/pricing/DiscountsTree'
import { RecommendationsPanel } from '../components/recommendations/RecommendationsPanel'
import { SolvencyPanel } from '../components/solvency/SolvencyPanel'
import { SalesPanel } from '../components/sales/SalesPanel'
import { ClientStructurePanel } from '../components/structure/ClientStructurePanel'
import { type ClientFormErrors, validateClientForm } from '../components/form/validateClientForm'
import {
  EDIT_CLIENT_ACTIVE_PERMISSION,
  EDIT_CLIENT_DELETE_PERMISSION,
  EDIT_CLIENT_ECOMMERCE_PERMISSION,
  EDIT_CLIENT_PRICING_PERMISSION,
  EDIT_CLIENT_TYPE_PERMISSION,
} from '../permissions'
import type { Client, ClientContractDocument, ClientType, ClientTypeRole, Currency, Region } from '../types'
import './client-edit-page.css'

const CLIENT_TYPE_BUYER = 0
const CLIENT_TYPE_PROVIDER = 1
const DEFAULT_UKRAINIAN_REGION_CODE = 'XM007'
const DEFAULT_POLAND_REGION_CODE = 'PL007'

type EditStep = {
  label: string
  value: string
}

type SetClientField = <K extends keyof Client>(key: K, value: Client[K]) => void
type SetClientBankField = (key: 'BranchCode' | 'Swift' | 'BankAndBranch' | 'BankAddress', value: string) => void

type ClientEditRouteState = {
  returnPath?: string
}

type EditStepContentProps = {
  client: Client
  errors: ClientFormErrors
  role: ClientFormRole
  isLoadingRegionCode: boolean
  isUploadingDocuments: boolean
  lookups: ReturnType<typeof useClientFormLookups>['lookups']
  setAccountNumber: (value: string) => void
  setAccountNumberCurrency: (currency: Currency | null) => void
  setBankField: SetClientBankField
  setField: SetClientField
  setIbanNumber: (value: string) => void
  setIbanNumberCurrency: (currency: Currency | null) => void
  onRegionChange: (region: Region | null) => void
  onRegionCodeFieldChange: (key: 'Value' | 'City' | 'District', value: string) => void
  onAddDocuments: (files: File[]) => void
  onRemoveDocument: (document: ClientContractDocument) => void
  onSaveDocuments: () => void
  onCreateIncoterm: (name: string) => void
  onCreateCountry: (name: string, code: string) => void
  onCreateRegion: (name: string) => void
  onClientChange: (client: Client) => void
  onPendingDiscountDraftChange: (draft: DiscountsTreeDraft | null) => void
  step: string
  productNetId?: string
}

function getClientRole(client: Client | null): ClientFormRole {
  const type = client?.ClientInRole?.ClientType?.Type
  return {
    isProvider: type === CLIENT_TYPE_PROVIDER,
    isBuyer: Boolean(client) && type !== CLIENT_TYPE_PROVIDER,
    isSubClient: Boolean(client?.IsSubClient || client?.IsTradePoint),
  }
}

export function ClientEditPage() {
  const { t } = useI18n()
  const { netid, step, productNetId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const [client, setClient] = useValueState<Client | null>(null)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isSaving, setSaving] = useValueState(false)
  const [isDeleting, setDeleting] = useValueState(false)
  const [deleteModalOpened, setDeleteModalOpened] = useValueState(false)
  const [typePanelOpened, setTypePanelOpened] = useValueState(false)
  const [isLoadingRegionCode, setLoadingRegionCode] = useValueState(false)
  const [isUploadingDocuments, setUploadingDocuments] = useValueState(false)
  const [formErrors, setFormErrors] = useValueState<ClientFormErrors>({})
  const [pendingDocuments, setPendingDocuments] = useValueState<File[]>([])
  const originalRegionRef = useRef<{ regionNetUid?: string; regionCode?: Client['RegionCode'] }>({})
  const pendingDiscountDraftRef = useRef<DiscountsTreeDraft | null>(null)
  const routeState = location.state as ClientEditRouteState | null
  const basePath = location.pathname.startsWith('/suppliers/edit') ? '/suppliers/edit' : '/clients/edit'
  const returnPath = routeState?.returnPath || (basePath === '/suppliers/edit' ? '/suppliers' : '/clients')
  const role = useMemo(() => getClientRole(client), [client])
  const {
    isLoading: isLoadingLookups,
    lookups,
    error: lookupsError,
    reloadCountries,
    reloadIncoterms,
    reloadRegions,
  } = useClientFormLookups({
    enabled: Boolean(client),
    needsProviderLookups: role.isProvider,
    needsBuyerLookups: role.isBuyer,
  })

  useEffect(() => {
    let cancelled = false

    async function loadClient() {
      if (!netid) {
        return
      }

      setLoading(true)
      setError(null)

      try {
        const nextClient = await getClientById(netid)

        if (!cancelled) {
          setClient(nextClient)
          originalRegionRef.current = {
            regionNetUid: nextClient?.Region?.NetUid,
            regionCode: nextClient?.RegionCode,
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити картку'))
          setClient(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadClient()

    return () => {
      cancelled = true
    }
  }, [netid, setClient, setError, setLoading, t])

  const steps = useMemo(() => buildEditSteps(client, hasPermission), [client, hasPermission])
  const activeStep = steps.find((item) => item.value === step)
  const firstStep = steps[0]
  const selectedStepValue = step || firstStep?.value || ''
  const isBodyLoading = isLoading || (isLoadingLookups && isLookupBackedEditStep(selectedStepValue))

  if (!netid) {
    return <Navigate to="/clients" replace />
  }

  // Redirect to the first step on the very first render (before the drawer
  // paints) so the editor mounts directly at the step route once — avoids the
  // open → close → reopen flicker that a post-load redirect would cause.
  if (firstStep && !step) {
    return <Navigate to={`${basePath}/${netid}/${firstStep.value}${location.search}`} state={location.state} replace />
  }

  // Invalid/stale step in the URL once the client (and its real steps) loaded.
  if (!isLoading && client && firstStep && !activeStep) {
    return <Navigate to={`${basePath}/${netid}/${firstStep.value}${location.search}`} state={location.state} replace />
  }

  function setField<K extends keyof Client>(key: K, value: Client[K]) {
    setClient((currentClient) =>
      currentClient
        ? {
            ...currentClient,
            [key]: value,
            ...(key === 'SupplierName' ? { Manufacturer: String(value || '') } : {}),
          }
        : currentClient,
    )
  }

  function handleClientChange(updatedClient: Client) {
    setClient(updatedClient)
  }

  function setClientTypeRole(clientType: ClientType, clientTypeRole: ClientTypeRole) {
    setClient((currentClient) =>
      currentClient
        ? {
            ...currentClient,
            ClientInRole: {
              ...currentClient.ClientInRole,
              ClientType: clientType,
              ClientTypeRole: clientTypeRole,
            },
          }
        : currentClient,
    )
  }

  function setBankField(key: 'BranchCode' | 'Swift' | 'BankAndBranch' | 'BankAddress', value: string) {
    setClient((currentClient) =>
      currentClient
        ? {
            ...currentClient,
            ClientBankDetails: {
              ...currentClient.ClientBankDetails,
              [key]: value,
            },
          }
        : currentClient,
    )
  }

  function setAccountNumber(value: string) {
    setClient((currentClient) =>
      currentClient
        ? {
            ...currentClient,
            ClientBankDetails: {
              ...currentClient.ClientBankDetails,
              AccountNumber: {
                ...currentClient.ClientBankDetails?.AccountNumber,
                AccountNumber: value,
              },
            },
          }
        : currentClient,
    )
  }

  function setIbanNumber(value: string) {
    setClient((currentClient) =>
      currentClient
        ? {
            ...currentClient,
            ClientBankDetails: {
              ...currentClient.ClientBankDetails,
              ClientBankDetailIbanNo: {
                ...currentClient.ClientBankDetails?.ClientBankDetailIbanNo,
                IBANNO: value,
              },
            },
          }
        : currentClient,
    )
  }

  function setAccountNumberCurrency(currency: Currency | null) {
    setClient((currentClient) =>
      currentClient
        ? {
            ...currentClient,
            ClientBankDetails: {
              ...currentClient.ClientBankDetails,
              AccountNumber: {
                ...currentClient.ClientBankDetails?.AccountNumber,
                Currency: currency || undefined,
              },
            },
          }
        : currentClient,
    )
  }

  function setIbanNumberCurrency(currency: Currency | null) {
    setClient((currentClient) =>
      currentClient
        ? {
            ...currentClient,
            ClientBankDetails: {
              ...currentClient.ClientBankDetails,
              ClientBankDetailIbanNo: {
                ...currentClient.ClientBankDetails?.ClientBankDetailIbanNo,
                Currency: currency || undefined,
              },
            },
          }
        : currentClient,
    )
  }

  function setRegionCodeField(key: 'Value' | 'City' | 'District', value: string) {
    setClient((currentClient) =>
      currentClient
        ? {
            ...currentClient,
            RegionCode: {
              ...currentClient.RegionCode,
              [key]: value,
            },
          }
        : currentClient,
    )
  }

  async function handleRegionChange(region: Region | null) {
    if (!region) {
      setClient((currentClient) =>
        currentClient
          ? {
              ...currentClient,
              Region: undefined,
              RegionCode: undefined,
            }
          : currentClient,
      )
      return
    }

    setClient((currentClient) =>
      currentClient
        ? {
            ...currentClient,
            Region: region,
          }
        : currentClient,
    )

    const original = originalRegionRef.current
    const originalCodeValue = original.regionCode?.Value
    const isDefaultRegionCode =
      originalCodeValue === DEFAULT_UKRAINIAN_REGION_CODE || originalCodeValue === DEFAULT_POLAND_REGION_CODE

    if (
      !isDefaultRegionCode
      && original.regionNetUid
      && region.NetUid === original.regionNetUid
      && client?.RegionCodeId
      && original.regionCode
    ) {
      setClient((currentClient) =>
        currentClient
          ? {
              ...currentClient,
              Region: region,
              RegionCode: original.regionCode,
            }
          : currentClient,
      )
      return
    }

    setLoadingRegionCode(true)
    setError(null)

    try {
      const regionCode = await getAvailableRegionCode(region)

      if (regionCode) {
        setClient((currentClient) =>
          currentClient
            ? {
                ...currentClient,
                RegionCode: regionCode,
              }
            : currentClient,
        )
      }
    } catch (regionCodeError) {
      setError(regionCodeError instanceof Error ? regionCodeError.message : t('Не вдалося отримати код регіону'))
    } finally {
      setLoadingRegionCode(false)
    }
  }

  function handleAddDocuments(files: File[]) {
    setPendingDocuments((current) => [...current, ...files])
    setClient((currentClient) =>
      currentClient
        ? {
            ...currentClient,
            ClientContractDocuments: [
              ...(currentClient.ClientContractDocuments || []),
              ...files.map((file) => ({
                FileName: file.name,
                ContentType: file.type,
              })),
            ],
          }
        : currentClient,
    )
  }

  function handleRemoveDocument(document: ClientContractDocument) {
    if (document.Id && document.Id > 0) {
      setClient((currentClient) =>
        currentClient
          ? {
              ...currentClient,
              ClientContractDocuments: (currentClient.ClientContractDocuments || []).map((item) =>
                item === document ? { ...item, Deleted: true } : item,
              ),
            }
          : currentClient,
      )
      return
    }

    setPendingDocuments((current) => current.filter((file) => file.name !== document.FileName))
    setClient((currentClient) =>
      currentClient
        ? {
            ...currentClient,
            ClientContractDocuments: (currentClient.ClientContractDocuments || []).filter((item) => item !== document),
          }
        : currentClient,
    )
  }

  async function handleSaveDocuments() {
    if (!client || !(client.ClientContractDocuments || []).length) {
      return
    }

    setUploadingDocuments(true)
    setError(null)

    try {
      const updatedClient = await uploadClientContract(client, pendingDocuments)

      if (updatedClient) {
        setClient(updatedClient)
      }

      setPendingDocuments([])
      notifications.show({
        color: 'green',
        message: t('Документи збережено'),
      })
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : t('Не вдалося зберегти документи'))
    } finally {
      setUploadingDocuments(false)
    }
  }

  async function handleCreateIncoterm(name: string) {
    setError(null)

    try {
      const created = await createIncoterm({ IncotermName: name })
      await reloadIncoterms()

      if (created) {
        setField('Incoterm', created)
      }
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : t('Не вдалося створити Incoterms'))
    }
  }

  async function handleCreateCountry(name: string, code: string) {
    setError(null)

    try {
      const created = await createCountry({ Name: name, Code: code })
      await reloadCountries()

      if (created) {
        setField('Country', created)
      }
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : t('Не вдалося створити країну'))
    }
  }

  async function handleCreateRegion(name: string) {
    setError(null)

    try {
      const created = await createRegion({ Name: name })
      await reloadRegions()

      if (created) {
        await handleRegionChange(created)
      }
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : t('Не вдалося створити регіон'))
    }
  }

  function goToStep(nextStep: string) {
    navigate(`${basePath}/${netid}/${nextStep}${location.search}`, {
      state: location.state,
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!client) {
      return
    }

    const clientToSave = applyPendingDiscountDraft(client, pendingDiscountDraftRef.current)
    const errors = validateClientForm(clientToSave, role, t('Забагато символів'))
    setFormErrors(errors)

    if (Object.keys(errors).length > 0) {
      setError(t('Перевірте правильність заповнення форми'))
      return
    }

    setSaving(true)
    setError(null)

    try {
      const updatedClient = await updateClient(clientToSave)
      pendingDiscountDraftRef.current = null
      setClient(updatedClient || clientToSave)
      notifications.show({
        color: 'green',
        message: t('Картку збережено'),
      })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти картку'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!client?.NetUid) {
      return
    }

    setDeleting(true)
    setError(null)

    try {
      await deleteClient(client.NetUid)
      notifications.show({
        color: 'green',
        message: t('Картку видалено'),
      })
      navigate(returnPath || (getClientType(client) === CLIENT_TYPE_PROVIDER ? '/suppliers' : '/clients'), { replace: true })
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t('Не вдалося видалити картку'))
    } finally {
      setDeleting(false)
      setDeleteModalOpened(false)
    }
  }

  function closeSheet() {
    if (isSaving || isDeleting) {
      return
    }

    navigate(returnPath, { replace: true })
  }

  return (
    <AppDrawer
      opened
      closeOnClickOutside={!isSaving && !isDeleting}
      keepMounted={false}
      position="right"
      size="full"
      onClose={closeSheet}
      footer={
        <ClientEditActions
          canDelete={hasPermission(EDIT_CLIENT_DELETE_PERMISSION)}
          client={client}
          isDeleting={isDeleting}
          isSaving={isSaving}
          onDelete={() => setDeleteModalOpened(true)}
        />
      }
    >
    <Stack gap="lg">
      <ClientEditHeader
        canEditType={hasPermission(EDIT_CLIENT_TYPE_PERMISSION)}
        client={client}
        onTypeClick={() => setTypePanelOpened(true)}
      />

      {(error || lookupsError) && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {error || lookupsError}
        </Alert>
      )}

      <ClientEditBody
        activeStep={activeStep}
        canEditActive={hasPermission(EDIT_CLIENT_ACTIVE_PERMISSION)}
        canViewType={hasPermission(EDIT_CLIENT_TYPE_PERMISSION)}
        client={client}
        errors={formErrors}
        firstStep={firstStep}
        isLoading={isBodyLoading}
        isLoadingRegionCode={isLoadingRegionCode}
        isUploadingDocuments={isUploadingDocuments}
        lookups={lookups}
        productNetId={productNetId}
        role={role}
        selectedStep={step}
        setAccountNumber={setAccountNumber}
        setAccountNumberCurrency={setAccountNumberCurrency}
        setBankField={setBankField}
        setField={setField}
        setIbanNumber={setIbanNumber}
        setIbanNumberCurrency={setIbanNumberCurrency}
        steps={steps}
        onAddDocuments={handleAddDocuments}
        onClientChange={handleClientChange}
        onCreateCountry={handleCreateCountry}
        onCreateIncoterm={handleCreateIncoterm}
        onCreateRegion={handleCreateRegion}
        onGoToStep={goToStep}
        onPendingDiscountDraftChange={(draft) => {
          pendingDiscountDraftRef.current = draft
        }}
        onRegionChange={handleRegionChange}
        onRegionCodeFieldChange={setRegionCodeField}
        onRemoveDocument={handleRemoveDocument}
        onSaveDocuments={handleSaveDocuments}
        onSubmit={handleSubmit}
      />

      <DeleteClientModal
        client={client}
        isDeleting={isDeleting}
        opened={deleteModalOpened}
        onClose={() => setDeleteModalOpened(false)}
        onConfirm={handleDelete}
      />

      <EditClientTypePanel
        currentRoleId={client?.ClientInRole?.ClientTypeRole?.Id}
        currentRoleNetUid={client?.ClientInRole?.ClientTypeRole?.NetUid}
        currentTypeNetUid={client?.ClientInRole?.ClientType?.NetUid}
        opened={typePanelOpened}
        onClose={() => setTypePanelOpened(false)}
        onSelect={setClientTypeRole}
      />
    </Stack>
    </AppDrawer>
  )
}

function ClientEditActions({
  canDelete,
  client,
  isDeleting,
  isSaving,
  onDelete,
}: {
  canDelete: boolean
  client: Client | null
  isDeleting: boolean
  isSaving: boolean
  onDelete: () => void
}) {
  const { t } = useI18n()

  return (
    <Group gap="xs">
      {canDelete && (
        <Button color="red" leftSection={<IconTrash size={16} />} loading={isDeleting} variant="light" onClick={onDelete}>
          {t('Видалити')}
        </Button>
      )}
      <Button
        color={CREATE_ACTION_COLOR}
        disabled={!client}
        form="client-edit-form"
        leftSection={<IconDeviceFloppy size={16} />}
        loading={isSaving}
        type="submit"
      >
        {t('Зберегти')}
      </Button>
    </Group>
  )
}

function ClientEditHeader({
  canEditType,
  client,
  onTypeClick,
}: {
  canEditType: boolean
  client: Client | null
  onTypeClick: () => void
}) {
  const { t } = useI18n()
  const regionCodeValue = client?.RegionCode?.Value

  return (
    <Stack gap="xs">
      {client && (regionCodeValue || client.FullName) && (
        <Group gap="xs">
          {regionCodeValue && (
            <Text fw={600} size="sm">
              {regionCodeValue}
            </Text>
          )}
          {client.FullName && (
            <Text fw={600} size="sm">
              {client.FullName}
            </Text>
          )}
        </Group>
      )}
      <Group gap="xs">
        {client && (
          <Badge color={client.IsActive === false ? 'gray' : 'green'} variant="light">
            {client.IsActive === false ? t('Неактивний') : t('Активний')}
          </Badge>
        )}
        {client && (client.ClientInRole?.ClientTypeRole?.Name || canEditType) && (
          <Badge
            color="violet"
            variant="light"
            style={canEditType ? { cursor: 'pointer' } : undefined}
            onClick={canEditType ? onTypeClick : undefined}
          >
            {client.ClientInRole?.ClientTypeRole?.Name || t('Тип клієнта')}
          </Badge>
        )}
        {client?.IsTemporaryClient && (
          <Badge color="violet" variant="light">
            {t('З інтернет-магазину')}
          </Badge>
        )}
      </Group>
    </Stack>
  )
}

function ClientEditBody({
  activeStep,
  canEditActive,
  canViewType,
  client,
  errors,
  firstStep,
  isLoading,
  isLoadingRegionCode,
  isUploadingDocuments,
  lookups,
  productNetId,
  role,
  selectedStep,
  setAccountNumber,
  setAccountNumberCurrency,
  setBankField,
  setField,
  setIbanNumber,
  setIbanNumberCurrency,
  steps,
  onAddDocuments,
  onClientChange,
  onCreateCountry,
  onCreateIncoterm,
  onCreateRegion,
  onGoToStep,
  onPendingDiscountDraftChange,
  onRegionChange,
  onRegionCodeFieldChange,
  onRemoveDocument,
  onSaveDocuments,
  onSubmit,
}: {
  activeStep?: EditStep
  canEditActive: boolean
  canViewType: boolean
  client: Client | null
  errors: ClientFormErrors
  firstStep?: EditStep
  isLoading: boolean
  isLoadingRegionCode: boolean
  isUploadingDocuments: boolean
  lookups: ReturnType<typeof useClientFormLookups>['lookups']
  productNetId?: string
  role: ClientFormRole
  selectedStep?: string
  setAccountNumber: (value: string) => void
  setAccountNumberCurrency: (currency: Currency | null) => void
  setBankField: SetClientBankField
  setField: SetClientField
  setIbanNumber: (value: string) => void
  setIbanNumberCurrency: (currency: Currency | null) => void
  steps: EditStep[]
  onAddDocuments: (files: File[]) => void
  onClientChange: (client: Client) => void
  onCreateCountry: (name: string, code: string) => void
  onCreateIncoterm: (name: string) => void
  onCreateRegion: (name: string) => void
  onGoToStep: (nextStep: string) => void
  onPendingDiscountDraftChange: (draft: DiscountsTreeDraft | null) => void
  onRegionChange: (region: Region | null) => void
  onRegionCodeFieldChange: (key: 'Value' | 'City' | 'District', value: string) => void
  onRemoveDocument: (document: ClientContractDocument) => void
  onSaveDocuments: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const { t } = useI18n()
  const selectedStepValue = selectedStep || firstStep?.value || ''

  if (isLoading) {
    return (
      <Card withBorder radius="md" padding="lg">
        <Group justify="center" py="xl">
          <Loader color="violet" size="sm" />
          <Text c="dimmed" size="sm">
            {t('Завантаження картки')}
          </Text>
        </Group>
      </Card>
    )
  }

  if (!client) {
    return (
      <Card withBorder radius="md" padding="lg">
        <Text c="dimmed">{t('Картку не знайдено')}</Text>
      </Card>
    )
  }

  return (
    <form id="client-edit-form" onSubmit={onSubmit}>
      <Grid gap="md">
        <Grid.Col span={{ base: 12, lg: 3 }}>
          <Card withBorder radius="md" padding="md">
            <Stack gap={5} className="client-edit-nav" component="nav">
              {steps.map((item) => {
                const isActive = item.value === selectedStep

                return (
                  <Button
                    key={item.value}
                    className={`client-edit-nav-item${isActive ? ' is-active' : ''}`}
                    color="gray"
                    fullWidth
                    justify="space-between"
                    rightSection={<IconChevronRight size={16} stroke={2} />}
                    size="sm"
                    variant="subtle"
                    onClick={() => onGoToStep(item.value)}
                  >
                    {item.label}
                  </Button>
                )
              })}
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 9 }}>
          <Card withBorder radius="md" padding="md">
            <Stack gap="md">
              <Group justify="space-between" align="center">
                <Title order={3} size="h4">
                  {activeStep?.label || firstStep?.label}
                </Title>
                {canEditActive && (
                  <Switch
                    checked={client.IsActive !== false}
                    label={t('Активний')}
                    onChange={(event) => setField('IsActive', event.currentTarget.checked)}
                  />
                )}
              </Group>

              {canViewType && (
                <Text size="sm" c="dimmed">
                  {displayValue(client.ClientInRole?.ClientType?.Name)} / {displayValue(client.ClientInRole?.ClientTypeRole?.Name)}
                </Text>
              )}

              <EditStepContent
                client={client}
                errors={errors}
                isLoadingRegionCode={isLoadingRegionCode}
                isUploadingDocuments={isUploadingDocuments}
                lookups={lookups}
                productNetId={productNetId}
                role={role}
                setAccountNumber={setAccountNumber}
                setAccountNumberCurrency={setAccountNumberCurrency}
                setBankField={setBankField}
                setField={setField}
                setIbanNumber={setIbanNumber}
                setIbanNumberCurrency={setIbanNumberCurrency}
                step={selectedStepValue}
                onAddDocuments={onAddDocuments}
                onClientChange={onClientChange}
                onCreateCountry={onCreateCountry}
                onCreateIncoterm={onCreateIncoterm}
                onCreateRegion={onCreateRegion}
                onPendingDiscountDraftChange={onPendingDiscountDraftChange}
                onRegionChange={onRegionChange}
                onRegionCodeFieldChange={onRegionCodeFieldChange}
                onRemoveDocument={onRemoveDocument}
                onSaveDocuments={onSaveDocuments}
              />
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>
    </form>
  )
}

function DeleteClientModal({
  client,
  isDeleting,
  opened,
  onClose,
  onConfirm,
}: {
  client: Client | null
  isDeleting: boolean
  opened: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={opened} title={t('Видалити картку')} onClose={onClose}>
      <Stack gap="md">
        <Text size="sm">{t('Підтвердити видалення')}: {client ? getClientDisplayName(client) : ''}</Text>
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button color="red" leftSection={<IconCheck size={16} />} loading={isDeleting} onClick={onConfirm}>
            {t('Видалити')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function buildEditSteps(client: Client | null, hasPermission: (permissionKey: string) => boolean): EditStep[] {
  const steps: EditStep[] = [
    { value: 'general-information', label: translate('Загальна інформація') },
    { value: 'contact-information', label: translate('Контакти') },
  ]

  if (hasPermission(EDIT_CLIENT_PRICING_PERMISSION)) {
    steps.push({ value: 'pricing', label: translate('Ціноутворення') })
  }

  if (getClientType(client) === CLIENT_TYPE_BUYER) {
    steps.push(
      { value: 'sales', label: translate('Продажі') },
      { value: 'perfect-client', label: translate('Ідеальний клієнт') },
      { value: 'client-types', label: translate('Структура клієнта') },
    )

    if (hasPermission(EDIT_CLIENT_ECOMMERCE_PERMISSION)) {
      steps.push({ value: 'e-commerce', label: translate('Інтернет-магазин') })
    }

    steps.push({ value: 'most-purchased-products', label: translate('Рекомендації') })
  }

  if (getClientType(client) === CLIENT_TYPE_PROVIDER) {
    steps.push({ value: 'bank-details', label: translate('Банківські дані') })
  }

  return steps
}

function EditStepContent({
  client,
  errors,
  isLoadingRegionCode,
  isUploadingDocuments,
  lookups,
  productNetId,
  role,
  setAccountNumber,
  setAccountNumberCurrency,
  setBankField,
  setField,
  setIbanNumber,
  setIbanNumberCurrency,
  onAddDocuments,
  onClientChange,
  onCreateCountry,
  onCreateIncoterm,
  onCreateRegion,
  onPendingDiscountDraftChange,
  onRegionChange,
  onRegionCodeFieldChange,
  onRemoveDocument,
  onSaveDocuments,
  step,
}: EditStepContentProps) {
  if (step === 'contact-information') {
    return <ContactInfoFields client={client} errors={errors} role={role} onChange={setField} />
  }

  if (step === 'pricing') {
    return (
      <PricingPanel
        client={client}
        isProvider={role.isProvider}
        mode="edit"
        onChange={onClientChange}
        onPendingDiscountDraftChange={onPendingDiscountDraftChange}
      />
    )
  }

  if (step === 'bank-details') {
    return (
      <BankDetailsFields
        client={client}
        currencies={lookups.currencies}
        onAccountNumberChange={setAccountNumber}
        onAccountNumberCurrencyChange={setAccountNumberCurrency}
        onBankFieldChange={setBankField}
        onIbanNumberChange={setIbanNumber}
        onIbanNumberCurrencyChange={setIbanNumberCurrency}
      />
    )
  }

  if (step === 'client-types') {
    return <ClientStructurePanel client={client} onChange={onClientChange} />
  }

  if (step === 'perfect-client') {
    return <PerfectClientPanel client={client} onChange={onClientChange} />
  }

  if (step === 'e-commerce') {
    return <EcommercePanel client={client} onChange={onClientChange} />
  }

  if (step === 'sales') {
    return <SalesPanel netId={client.NetUid ?? ''} />
  }

  if (step === 'most-purchased-products') {
    return (
      <Stack gap="lg">
        <RecommendationsPanel client={client} productNetId={productNetId} />
        <Card withBorder radius="md" padding="md">
          <SolvencyPanel clientNetId={client.NetUid} />
        </Card>
      </Stack>
    )
  }

  if (step !== 'general-information') {
    return (
      <Stack gap="xs">
        <Text size="sm" c="dimmed">
          {displayValue(getClientDisplayName(client))}
        </Text>
      </Stack>
    )
  }

  return (
    <GeneralInfoFields
      client={client}
      countries={lookups.countries}
      errors={errors}
      incoterms={lookups.incoterms}
      isLoadingRegionCode={isLoadingRegionCode}
      isUploadingDocuments={isUploadingDocuments}
      packingMarkingPayments={lookups.packingMarkingPayments}
      packingMarkings={lookups.packingMarkings}
      regions={lookups.regions}
      role={role}
      onAddDocuments={onAddDocuments}
      onChange={setField}
      onCreateCountry={onCreateCountry}
      onCreateIncoterm={onCreateIncoterm}
      onCreateRegion={onCreateRegion}
      onRegionChange={onRegionChange}
      onRegionCodeFieldChange={onRegionCodeFieldChange}
      onRemoveDocument={onRemoveDocument}
      onSaveDocuments={onSaveDocuments}
    />
  )
}

function getClientType(client: Client | null): number | undefined {
  return client?.ClientInRole?.ClientType?.Type
}

function isLookupBackedEditStep(step: string): boolean {
  return step === 'general-information' || step === 'bank-details'
}

function getClientDisplayName(client: Client): string {
  const fullName = client.FullName?.trim() || client.Name?.trim()

  if (fullName) {
    return fullName
  }

  return [client.FirstName, client.LastName, client.MiddleName].filter(Boolean).join(' ') || translate('Без назви')
}

function displayValue(value?: number | string | null): string {
  if (typeof value === 'number') {
    return String(value)
  }

  const normalized = value?.trim()
  return normalized || '-'
}
