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
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconCheck, IconChevronLeft, IconDeviceFloppy, IconTrash } from '@tabler/icons-react'
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
import { GeneralInfoFields, type ClientFormRole } from '../components/form/GeneralInfoFields'
import { type ClientFormErrors, validateClientForm } from '../components/form/validateClientForm'
import {
  EDIT_CLIENT_ACTIVE_PERMISSION,
  EDIT_CLIENT_DELETE_PERMISSION,
  EDIT_CLIENT_ECOMMERCE_PERMISSION,
  EDIT_CLIENT_PRICING_PERMISSION,
  EDIT_CLIENT_TYPE_PERMISSION,
} from '../permissions'
import type { Client, ClientContractDocument, Currency, Region } from '../types'

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
  step: string
}

function getClientRole(client: Client | null): ClientFormRole {
  const type = client?.ClientInRole?.ClientType?.Type
  return {
    isProvider: type === CLIENT_TYPE_PROVIDER,
    isBuyer: type !== CLIENT_TYPE_PROVIDER,
    isSubClient: Boolean(client?.IsSubClient || client?.IsTradePoint),
  }
}

export function ClientEditPage() {
  const { t } = useI18n()
  const { netid, step } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const [client, setClient] = useValueState<Client | null>(null)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isSaving, setSaving] = useValueState(false)
  const [isDeleting, setDeleting] = useValueState(false)
  const [deleteModalOpened, setDeleteModalOpened] = useValueState(false)
  const [isLoadingRegionCode, setLoadingRegionCode] = useValueState(false)
  const [isUploadingDocuments, setUploadingDocuments] = useValueState(false)
  const [formErrors, setFormErrors] = useValueState<ClientFormErrors>({})
  const [pendingDocuments, setPendingDocuments] = useValueState<File[]>([])
  const originalRegionRef = useRef<{ regionNetUid?: string; regionCode?: Client['RegionCode'] }>({})
  const routeState = location.state as ClientEditRouteState | null
  const basePath = location.pathname.startsWith('/suppliers/edit') ? '/suppliers/edit' : '/clients/edit'
  const returnPath = routeState?.returnPath || (basePath === '/suppliers/edit' ? '/suppliers' : '/clients')
  const role = useMemo(() => getClientRole(client), [client])
  const {
    lookups,
    error: lookupsError,
    reloadCountries,
    reloadIncoterms,
    reloadRegions,
  } = useClientFormLookups({
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

  if (!netid) {
    return <Navigate to="/clients" replace />
  }

  if (!isLoading && client && firstStep && (!step || !activeStep)) {
    return <Navigate to={`${basePath}/${netid}/${firstStep.value}`} replace />
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
    navigate(`${basePath}/${netid}/${nextStep}`, {
      state: location.state,
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!client) {
      return
    }

    const errors = validateClientForm(client, role, t('Забагато символів'))
    setFormErrors(errors)

    if (Object.keys(errors).length > 0) {
      setError(t('Перевірте правильність заповнення форми'))
      return
    }

    setSaving(true)
    setError(null)

    try {
      const updatedClient = await updateClient(client)
      setClient(updatedClient || client)
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
      size="min(980px, 100vw)"
      onClose={closeSheet}
    >
    <Stack gap="lg">
      <ClientEditHeader
        canDelete={hasPermission(EDIT_CLIENT_DELETE_PERMISSION)}
        client={client}
        isDeleting={isDeleting}
        isSaving={isSaving}
        onClose={closeSheet}
        onDelete={() => setDeleteModalOpened(true)}
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
        isLoading={isLoading}
        isLoadingRegionCode={isLoadingRegionCode}
        isUploadingDocuments={isUploadingDocuments}
        lookups={lookups}
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
        onCreateCountry={handleCreateCountry}
        onCreateIncoterm={handleCreateIncoterm}
        onCreateRegion={handleCreateRegion}
        onGoToStep={goToStep}
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
    </Stack>
    </AppDrawer>
  )
}

function ClientEditHeader({
  canDelete,
  client,
  isDeleting,
  isSaving,
  onClose,
  onDelete,
}: {
  canDelete: boolean
  client: Client | null
  isDeleting: boolean
  isSaving: boolean
  onClose: () => void
  onDelete: () => void
}) {
  const { t } = useI18n()
  const regionCodeValue = client?.RegionCode?.Value

  return (
    <Group justify="space-between" align="start">
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
          {client?.ClientInRole?.ClientTypeRole?.Name && (
            <Badge color="violet" variant="light">
              {client.ClientInRole.ClientTypeRole.Name}
            </Badge>
          )}
          {client?.IsTemporaryClient && (
            <Badge color="blue" variant="light">
              {t('З інтернет-магазину')}
            </Badge>
          )}
        </Group>
      </Stack>
      <Group gap="xs">
        <Button color="gray" leftSection={<IconChevronLeft size={16} />} variant="light" onClick={onClose}>
          {t('Скасувати')}
        </Button>
        {canDelete && (
          <Button color="red" leftSection={<IconTrash size={16} />} loading={isDeleting} variant="light" onClick={onDelete}>
            {t('Видалити')}
          </Button>
        )}
        <Button
          color="violet"
          disabled={!client}
          form="client-edit-form"
          leftSection={<IconDeviceFloppy size={16} />}
          loading={isSaving}
          type="submit"
        >
          {t('Зберегти')}
        </Button>
      </Group>
    </Group>
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
  onCreateCountry,
  onCreateIncoterm,
  onCreateRegion,
  onGoToStep,
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
  onCreateCountry: (name: string, code: string) => void
  onCreateIncoterm: (name: string) => void
  onCreateRegion: (name: string) => void
  onGoToStep: (nextStep: string) => void
  onRegionChange: (region: Region | null) => void
  onRegionCodeFieldChange: (key: 'Value' | 'City' | 'District', value: string) => void
  onRemoveDocument: (document: ClientContractDocument) => void
  onSaveDocuments: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const { t } = useI18n()

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
            <Stack gap="xs">
              {steps.map((item) => (
                <Button
                  key={item.value}
                  color={item.value === selectedStep ? 'violet' : 'gray'}
                  justify="flex-start"
                  variant={item.value === selectedStep ? 'light' : 'subtle'}
                  onClick={() => onGoToStep(item.value)}
                >
                  {item.label}
                </Button>
              ))}
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
                role={role}
                setAccountNumber={setAccountNumber}
                setAccountNumberCurrency={setAccountNumberCurrency}
                setBankField={setBankField}
                setField={setField}
                setIbanNumber={setIbanNumber}
                setIbanNumberCurrency={setIbanNumberCurrency}
                step={selectedStep || firstStep?.value || ''}
                onAddDocuments={onAddDocuments}
                onCreateCountry={onCreateCountry}
                onCreateIncoterm={onCreateIncoterm}
                onCreateRegion={onCreateRegion}
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
  role,
  setAccountNumber,
  setAccountNumberCurrency,
  setBankField,
  setField,
  setIbanNumber,
  setIbanNumberCurrency,
  onAddDocuments,
  onCreateCountry,
  onCreateIncoterm,
  onCreateRegion,
  onRegionChange,
  onRegionCodeFieldChange,
  onRemoveDocument,
  onSaveDocuments,
  step,
}: EditStepContentProps) {
  if (step === 'contact-information') {
    return <ContactInfoFields client={client} errors={errors} role={role} onChange={setField} />
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
