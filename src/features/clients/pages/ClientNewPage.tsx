import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Grid,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { AppModal } from "../../../shared/ui/AppModal"
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconCheck, IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { type FormEvent, useEffect, useMemo, useRef } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { translate } from '../../../shared/i18n/translate'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useAuth } from '../../auth/useAuth'
import { getClientTypes } from '../api/clientsApi'
import { createClient } from '../api/clientFormApi'
import { uploadClientContract } from '../api/clientCabinetApi'
import {
  checkRegionCodeAvailability,
  createCountry,
  createIncoterm,
  createRegion,
  getAvailableRegionCode,
} from '../api/clientLookupsApi'
import { useClientFormLookups } from '../hooks/useClientFormLookups'
import { getClientTypePermission, getClientTypeRolePermission } from '../permissions'
import { BankDetailsFields } from '../components/form/BankDetailsFields'
import { ContactInfoFields } from '../components/form/ContactInfoFields'
import { GeneralInfoFields, type ClientFormRole } from '../components/form/GeneralInfoFields'
import { PerfectClientPanel } from '../components/perfect-client/PerfectClientPanel'
import { PricingPanel } from '../components/pricing/PricingPanel'
import { applyPendingDiscountDraft } from '../components/pricing/pendingDiscountDraft'
import type { DiscountsTreeDraft } from '../components/pricing/DiscountsTree'
import { type ClientFormErrors, validateClientForm, validateRegionCodeSubmitState } from '../components/form/validateClientForm'
import type { Client, ClientContractDocument, ClientType, ClientTypeRole, Currency, Region } from '../types'

const CLIENT_TYPE_BUYER = 0
const CLIENT_TYPE_PROVIDER = 1
const NEW_CLIENT_SESSION_STORAGE_KEY = 'gba_console:new_client_session:v1'
const NEW_CLIENT_STEPS = ['role', 'general-information', 'contact-information', 'bank-details', 'perfect-client', 'pricing'] as const

type NewClientStep = (typeof NEW_CLIENT_STEPS)[number]

const NEW_CLIENT_FIELD_STEPS: Partial<Record<string, NewClientStep>> = {
  FullName: 'general-information',
  Brand: 'general-information',
  SupplierCode: 'general-information',
  SupplierName: 'general-information',
  IncotermsElse: 'general-information',
  Name: 'general-information',
  SROI: 'general-information',
  TIN: 'general-information',
  USREOU: 'general-information',
  EmailAddress: 'contact-information',
  FaxNumber: 'contact-information',
  ICQ: 'contact-information',
  SMSNumber: 'contact-information',
  AccountantNumber: 'contact-information',
  DirectorNumber: 'contact-information',
  Manager: 'contact-information',
  DeliveryAddress: 'contact-information',
  LegalAddress: 'contact-information',
  ActualAddress: 'contact-information',
}

type ClientNewRouteState = {
  clientType?: 'supplier' | 'client'
  moduleTitle?: string
  parentClientId?: string
  returnPath?: string
  returnState?: unknown
}

type ClientDraft = Client & {
  ClientInRole: {
    ClientType?: ClientType
    ClientTypeRole?: ClientTypeRole
  }
}

type NewClientSessionState = {
  draft?: ClientDraft
  routeState?: ClientNewRouteState | null
  version: 1
}

type SetClientDraftField = <K extends keyof ClientDraft>(key: K, value: ClientDraft[K]) => void

type NewStepContentProps = {
  clientTypes: ClientType[]
  draft: ClientDraft
  errors: ClientFormErrors
  role: ClientFormRole
  hasPermission: (permissionKey: string) => boolean
  lookups: ReturnType<typeof useClientFormLookups>['lookups']
  isLoadingRegionCode: boolean
  regionCodeError?: string
  setDraftField: SetClientDraftField
  setRole: (clientType: ClientType, role: ClientTypeRole) => void
  setBankField: (key: 'BranchCode' | 'Swift' | 'BankAndBranch' | 'BankAddress', value: string) => void
  setAccountNumber: (value: string) => void
  setAccountNumberCurrency: (currency: Currency | null) => void
  setIbanNumber: (value: string) => void
  setIbanNumberCurrency: (currency: Currency | null) => void
  onRegionChange: (region: Region | null) => void
  onRegionCodeFieldChange: (key: 'Value' | 'City' | 'District', value: string) => void
  onAddDocuments: (files: File[]) => void
  onRemoveDocument: (document: ClientContractDocument) => void
  onCreateIncoterm: (name: string) => void
  onCreateCountry: (name: string, code: string) => void
  onCreateRegion: (name: string) => void
  onDraftChange: (client: Client) => void
  onPendingDiscountDraftChange: (draft: DiscountsTreeDraft | null) => void
  step: NewClientStep
}

function getDraftRole(draft: ClientDraft): ClientFormRole {
  const type = draft.ClientInRole.ClientType?.Type
  return {
    isProvider: type === CLIENT_TYPE_PROVIDER,
    isBuyer: type !== CLIENT_TYPE_PROVIDER,
    isSubClient: Boolean(draft.IsSubClient || draft.IsTradePoint),
  }
}

function readNewClientSession(): NewClientSessionState | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const rawSession = window.sessionStorage.getItem(NEW_CLIENT_SESSION_STORAGE_KEY)

    if (!rawSession) {
      return null
    }

    const session = JSON.parse(rawSession) as Partial<NewClientSessionState>

    return session && session.version === 1 ? session as NewClientSessionState : null
  } catch {
    clearNewClientSession()

    return null
  }
}

function writeNewClientSession(session: NewClientSessionState) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.sessionStorage.setItem(
      NEW_CLIENT_SESSION_STORAGE_KEY,
      JSON.stringify({
        ...session,
        draft: sanitizeNewClientDraft(session.draft),
      }),
    )
  } catch {
    // Session persistence is best-effort; the form must keep working if storage is unavailable.
  }
}

function clearNewClientSession() {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.sessionStorage.removeItem(NEW_CLIENT_SESSION_STORAGE_KEY)
  } catch {
    // Ignore storage failures.
  }
}

function sanitizeNewClientDraft(draft?: ClientDraft): ClientDraft | undefined {
  if (!draft) {
    return undefined
  }

  return {
    ...draft,
    ClientContractDocuments: [],
  }
}

function restoreClientDraftFromSession(draft: ClientDraft, routeState: ClientNewRouteState | null): ClientDraft {
  return {
    ...createEmptyDraft(Boolean(routeState?.parentClientId)),
    ...sanitizeNewClientDraft(draft),
    ClientInRole: draft.ClientInRole || {},
  }
}

function sanitizeNewClientRouteState(routeState: ClientNewRouteState | null): ClientNewRouteState | null {
  if (!routeState) {
    return null
  }

  return {
    clientType: routeState.clientType,
    moduleTitle: routeState.moduleTitle,
    parentClientId: routeState.parentClientId,
    returnPath: routeState.returnPath,
    returnState: isJsonSerializable(routeState.returnState) ? routeState.returnState : undefined,
  }
}

function isJsonSerializable(value: unknown): boolean {
  if (typeof value === 'undefined') {
    return true
  }

  try {
    JSON.stringify(value)

    return true
  } catch {
    return false
  }
}

function isSameNewClientSessionContext(
  savedRouteState: ClientNewRouteState | null,
  explicitRouteState: ClientNewRouteState | null,
): boolean {
  if (!explicitRouteState) {
    return true
  }

  return (
    (savedRouteState?.clientType || undefined) === (explicitRouteState.clientType || undefined)
    && (savedRouteState?.parentClientId || undefined) === (explicitRouteState.parentClientId || undefined)
    && (savedRouteState?.returnPath || undefined) === (explicitRouteState.returnPath || undefined)
  )
}

export function ClientNewPage() {
  const { t } = useI18n()
  const { step } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { hasPermission } = useAuth()
  const explicitRouteState = location.state as ClientNewRouteState | null
  const savedSession = useMemo(() => readNewClientSession(), [])
  const canRestoreSession = Boolean(savedSession && isSameNewClientSessionContext(savedSession.routeState || null, explicitRouteState))
  const routeState = explicitRouteState || (canRestoreSession ? savedSession?.routeState || null : null)
  const [clientTypes, setClientTypes] = useValueState<ClientType[]>([])
  const [draft, setDraft] = useValueState<ClientDraft>(() =>
    canRestoreSession && savedSession?.draft
      ? restoreClientDraftFromSession(savedSession.draft, routeState)
      : createEmptyDraft(Boolean(routeState?.parentClientId)),
  )
  const [error, setError] = useValueState<string | null>(null)
  const [formErrors, setFormErrors] = useValueState<ClientFormErrors>({})
  const [isLoading, setLoading] = useValueState(true)
  const [isSaving, setSaving] = useValueState(false)
  const [isLoadingRegionCode, setLoadingRegionCode] = useValueState(false)
  const [regionCodeError, setRegionCodeError] = useValueState<string | undefined>(undefined)
  const pendingDocumentsRef = useRef<File[]>([])
  const pendingDiscountDraftRef = useRef<DiscountsTreeDraft | null>(null)
  const regionCodeRequestRef = useRef(0)
  const [isSubmitted, setSubmitted] = useValueState(false)
  const requestedStep = normalizeStep(step)
  const visibleSteps = useMemo(() => buildVisibleNewSteps(draft), [draft])
  const currentStep = requestedStep || 'role'
  const firstUnavailableStep = currentStep !== 'role' && !draft.ClientInRole.ClientTypeRole
  const returnPath = getNewClientReturnPath(routeState)
  const role = useMemo(() => getDraftRole(draft), [draft])
  const isPricingValid = (draft.ClientAgreements?.length || 0) > 0
  const { lookups, error: lookupsError, reloadCountries, reloadIncoterms, reloadRegions } = useClientFormLookups({
    needsProviderLookups: role.isProvider,
    needsBuyerLookups: role.isBuyer,
  })

  useEffect(() => {
    writeNewClientSession({ draft, routeState: sanitizeNewClientRouteState(routeState), version: 1 })
  }, [draft, routeState])

  useEffect(() => {
    let cancelled = false

    async function loadClientTypes() {
      setLoading(true)
      setError(null)

      try {
        const nextClientTypes = await getClientTypes()

        if (!cancelled) {
          setClientTypes(nextClientTypes)
          setDraft((currentDraft) => initializeDraftRole(currentDraft, nextClientTypes, routeState?.clientType))
        }
      } catch (loadError) {
        if (!cancelled) {
          setClientTypes([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити ролі'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadClientTypes()

    return () => {
      cancelled = true
    }
  }, [routeState?.clientType, setClientTypes, setDraft, setError, setLoading, t])

  useEffect(() => {
    if (!role.isProvider) {
      return
    }

    const defaultCurrency = lookups.currencies[0]

    if (!defaultCurrency) {
      return
    }

    setDraft((currentDraft) => {
      const bankDetails = currentDraft.ClientBankDetails
      const hasAccountNumberCurrency = Boolean(bankDetails?.AccountNumber?.Currency)
      const hasIbanCurrency = Boolean(bankDetails?.ClientBankDetailIbanNo?.Currency)

      if (hasAccountNumberCurrency && hasIbanCurrency) {
        return currentDraft
      }

      return {
        ...currentDraft,
        ClientBankDetails: {
          ...bankDetails,
          AccountNumber: {
            ...bankDetails?.AccountNumber,
            Currency: bankDetails?.AccountNumber?.Currency || defaultCurrency,
          },
          ClientBankDetailIbanNo: {
            ...bankDetails?.ClientBankDetailIbanNo,
            Currency: bankDetails?.ClientBankDetailIbanNo?.Currency || defaultCurrency,
          },
        },
      }
    })
  }, [lookups.currencies, role.isProvider, setDraft])

  // After a successful create we navigate away from the wizard. Suppress the
  // redirect guards below so the (now reset) draft cannot bounce the user back
  // into a fresh "/clients/new/role" form while the closing navigation settles.
  if (isSubmitted) {
    return null
  }

  if (!requestedStep) {
    return <Navigate to="/clients/new/role" replace state={location.state} />
  }

  if (firstUnavailableStep || !visibleSteps.includes(currentStep)) {
    return <Navigate to="/clients/new/role" replace state={location.state} />
  }

  function setDraftField<K extends keyof ClientDraft>(key: K, value: ClientDraft[K]) {
    setFormErrors((currentErrors) => {
      const field = String(key)

      if (!currentErrors[field]) {
        return currentErrors
      }

      const nextErrors = { ...currentErrors }
      delete nextErrors[field]

      return nextErrors
    })

    setDraft((currentDraft) => ({
      ...currentDraft,
      [key]: value,
      ...(key === 'SupplierName' ? { Manufacturer: String(value || '') } : {}),
    }))
  }

  function setRole(clientType: ClientType, nextRole: ClientTypeRole) {
    setFormErrors({})

    setDraft((currentDraft) => {
      const isTypeChanged = !isSameClientType(currentDraft.ClientInRole.ClientType, clientType)

      if (isTypeChanged) {
        pendingDocumentsRef.current = []
        pendingDiscountDraftRef.current = null
      }

      return {
        ...currentDraft,
        ...(clientType.Type === CLIENT_TYPE_PROVIDER ? { SROI: undefined, TIN: undefined, USREOU: undefined } : {}),
        ...(isTypeChanged
          ? {
              ClientAgreements: [],
              ClientBankDetails: undefined,
              ClientContractDocuments: [],
              ClientManagers: [],
              PerfectClients: [],
              ServicePayers: [],
            }
          : {}),
        ClientInRole: {
          ClientType: clientType,
          ClientTypeRole: nextRole,
        },
      }
    })
  }

  function setDraftClient(updatedClient: Client) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      ...updatedClient,
      ClientInRole: currentDraft.ClientInRole,
    }))
  }

  function setBankField(key: 'BranchCode' | 'Swift' | 'BankAndBranch' | 'BankAddress', value: string) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      ClientBankDetails: {
        ...currentDraft.ClientBankDetails,
        [key]: value,
      },
    }))
  }

  function setAccountNumber(value: string) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      ClientBankDetails: {
        ...currentDraft.ClientBankDetails,
        AccountNumber: {
          ...currentDraft.ClientBankDetails?.AccountNumber,
          AccountNumber: value,
        },
      },
    }))
  }

  function setAccountNumberCurrency(currency: Currency | null) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      ClientBankDetails: {
        ...currentDraft.ClientBankDetails,
        AccountNumber: {
          ...currentDraft.ClientBankDetails?.AccountNumber,
          Currency: currency || undefined,
        },
      },
    }))
  }

  function setIbanNumber(value: string) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      ClientBankDetails: {
        ...currentDraft.ClientBankDetails,
        ClientBankDetailIbanNo: {
          ...currentDraft.ClientBankDetails?.ClientBankDetailIbanNo,
          IBANNO: value,
        },
      },
    }))
  }

  function setIbanNumberCurrency(currency: Currency | null) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      ClientBankDetails: {
        ...currentDraft.ClientBankDetails,
        ClientBankDetailIbanNo: {
          ...currentDraft.ClientBankDetails?.ClientBankDetailIbanNo,
          Currency: currency || undefined,
        },
      },
    }))
  }

  async function handleRegionChange(region: Region | null) {
    setRegionCodeError(undefined)

    if (!region) {
      setDraft((currentDraft) => ({
        ...currentDraft,
        Region: undefined,
        RegionCode: undefined,
      }))
      return
    }

    setDraft((currentDraft) => ({
      ...currentDraft,
      Region: region,
    }))

    setLoadingRegionCode(true)
    setError(null)

    try {
      const regionCode = await getAvailableRegionCode(region)

      if (regionCode) {
        setDraft((currentDraft) => ({
          ...currentDraft,
          RegionCode: regionCode,
        }))
      }
    } catch (regionCodeError) {
      setError(regionCodeError instanceof Error ? regionCodeError.message : t('Не вдалося отримати код регіону'))
    } finally {
      setLoadingRegionCode(false)
    }
  }

  function handleRegionCodeFieldChange(key: 'Value' | 'City' | 'District', value: string) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      RegionCode: {
        ...currentDraft.RegionCode,
        [key]: value,
      },
    }))

    if (key === 'Value') {
      void verifyRegionCode(value)
    }
  }

  async function verifyRegionCode(value: string) {
    const regionNetUid = draft.Region?.NetUid
    const requestId = regionCodeRequestRef.current + 1
    regionCodeRequestRef.current = requestId

    if (!regionNetUid || !value) {
      setRegionCodeError(undefined)
      setLoadingRegionCode(false)
      return
    }

    setLoadingRegionCode(true)
    setRegionCodeError(undefined)

    try {
      const isAvailable = await checkRegionCodeAvailability(regionNetUid, value)
      if (regionCodeRequestRef.current === requestId) {
        setRegionCodeError(isAvailable ? undefined : t('Код по регіону вже використовується'))
      }
    } catch {
      if (regionCodeRequestRef.current === requestId) {
        setRegionCodeError(undefined)
      }
    } finally {
      if (regionCodeRequestRef.current === requestId) {
        setLoadingRegionCode(false)
      }
    }
  }

  async function handleCreateIncoterm(name: string) {
    setError(null)

    try {
      const created = await createIncoterm({ IncotermName: name })
      await reloadIncoterms()

      if (created) {
        setDraftField('Incoterm', created)
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
        setDraftField('Country', created)
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

  function handleAddDocuments(files: File[]) {
    pendingDocumentsRef.current = [...pendingDocumentsRef.current, ...files]
    setDraft((currentDraft) => ({
      ...currentDraft,
      ClientContractDocuments: [
        ...(currentDraft.ClientContractDocuments || []),
        ...files.map(toPendingContractDocument),
      ],
    }))
  }

  function handleRemoveDocument(document: ClientContractDocument) {
    pendingDocumentsRef.current = pendingDocumentsRef.current.filter((file) => file.name !== document.FileName)
    setDraft((currentDraft) => ({
      ...currentDraft,
      ClientContractDocuments: (currentDraft.ClientContractDocuments || []).filter((item) => item !== document),
    }))
  }

  function goToStep(nextStep: NewClientStep) {
    navigate(`/clients/new/${nextStep}`, {
      state: location.state,
    })
  }

  function goNext() {
    const currentIndex = visibleSteps.indexOf(currentStep)
    const nextStep = visibleSteps[currentIndex + 1]

    if (nextStep) {
      goToStep(nextStep)
    }
  }

  function goPrevious() {
    const currentIndex = visibleSteps.indexOf(currentStep)
    const previousStep = visibleSteps[currentIndex - 1]

    if (previousStep) {
      goToStep(previousStep)
    }
  }

  function closeWizard() {
    if (isSaving) {
      return
    }

    clearNewClientSession()
    setDraft(createEmptyDraft())
    navigate(returnPath, { replace: true, state: routeState?.returnState })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!draft.ClientInRole.ClientTypeRole) {
      setError(t('Оберіть роль'))
      return
    }

    const draftToSubmit = applyPendingDiscountDraft(draft, pendingDiscountDraftRef.current) as ClientDraft
    const validationErrors = validateClientForm(draftToSubmit, role, t('Забагато символів'))
    setFormErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      const errorStep = getFirstNewClientErrorStep(validationErrors, visibleSteps)

      if (errorStep && errorStep !== currentStep) {
        goToStep(errorStep)
      }

      setError(t('Перевірте правильність заповнення форми'))
      return
    }

    const regionCodeSubmitError = validateRegionCodeSubmitState(
      isLoadingRegionCode,
      regionCodeError,
      t('Дочекайтеся перевірки коду регіону'),
    )

    if (regionCodeSubmitError) {
      setError(regionCodeSubmitError)
      return
    }

    if ((draftToSubmit.ClientAgreements || []).length === 0) {
      setError(t('Додайте договір'))
      return
    }

    setSaving(true)
    setError(null)

    try {
      const createdClient = await createClient(buildCreatePayload(draftToSubmit), routeState?.parentClientId)
      const pendingDocuments = pendingDocumentsRef.current
      let documentsWereSaved = true

      if (!createdClient && pendingDocuments.length > 0) {
        documentsWereSaved = false
      } else if (createdClient && pendingDocuments.length > 0) {
        try {
          await uploadClientContract(
            {
              ...createdClient,
              ClientContractDocuments: [
                ...(createdClient.ClientContractDocuments || []),
                ...(draftToSubmit.ClientContractDocuments || []),
              ],
            },
            pendingDocuments,
          )
        } catch (uploadError) {
          documentsWereSaved = false
          notifications.show({
            color: 'red',
            message: uploadError instanceof Error ? uploadError.message : t('Клієнта створено, але документи не збережено'),
          })
        }
      }

      notifications.show({
        color: documentsWereSaved ? 'green' : 'yellow',
        message: documentsWereSaved ? t('Клієнта створено') : t('Клієнта створено без документів'),
      })
      setSubmitted(true)
      clearNewClientSession()
      setDraft(createEmptyDraft())
      pendingDocumentsRef.current = []
      pendingDiscountDraftRef.current = null
      navigate(returnPath, {
        replace: true,
        state: routeState?.returnState ?? (createdClient
          ? {
              nodeTitle: getClientDisplayName(createdClient),
            }
          : undefined),
      })
    } catch (saveError) {
      const serverValidationErrors = getNewClientServerValidationErrors(saveError, role, t('Забагато символів'))

      if (serverValidationErrors) {
        setFormErrors(serverValidationErrors)

        const errorStep = getFirstNewClientErrorStep(serverValidationErrors, visibleSteps)

        if (errorStep && errorStep !== currentStep) {
          goToStep(errorStep)
        }

        setError(t('Перевірте правильність заповнення форми'))
        return
      }

      setError(saveError instanceof Error ? saveError.message : t('Не вдалося створити клієнта'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppModal
      centered
      closeOnClickOutside={!isSaving}
      opened
      padding="md"
      size="min(1120px, calc(100vw - 32px))"
      aria-label={routeState?.moduleTitle || t('Новий клієнт')}
      onClose={closeWizard}
    >
      <Stack gap="md">
        {(error || lookupsError) && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error || lookupsError}
          </Alert>
        )}

        {isLoading ? (
          <Card withBorder radius="md" padding="lg">
            <Group justify="center" py="xl">
              <Loader color="orange" size="sm" />
              <Text c="dimmed" size="sm">
                {t('Завантаження ролей')}
              </Text>
            </Group>
          </Card>
        ) : (
          <form onSubmit={handleSubmit}>
            <Grid gap="md">
              <Grid.Col span={{ base: 12, md: 3 }}>
                <Card withBorder radius="md" padding="md">
                  <Stack gap="xs">
                    {visibleSteps.map((item) => (
                      <Button
                        key={item}
                        justify="flex-start"
                        variant={item === currentStep ? 'light' : 'subtle'}
                        color={item === currentStep ? 'orange' : 'gray'}
                        disabled={item !== 'role' && !draft.ClientInRole.ClientTypeRole}
                        onClick={() => goToStep(item)}
                      >
                        {getNewStepLabel(item)}
                      </Button>
                    ))}
                  </Stack>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 9 }}>
                <Card withBorder radius="md" padding="md">
                  <NewStepContent
                    clientTypes={clientTypes}
                    draft={draft}
                    errors={formErrors}
                    role={role}
                    hasPermission={hasPermission}
                    lookups={lookups}
                    isLoadingRegionCode={isLoadingRegionCode}
                    regionCodeError={regionCodeError}
                    setDraftField={setDraftField}
                    setRole={setRole}
                    setBankField={setBankField}
                    setAccountNumber={setAccountNumber}
                    setAccountNumberCurrency={setAccountNumberCurrency}
                    setIbanNumber={setIbanNumber}
                    setIbanNumberCurrency={setIbanNumberCurrency}
                    step={currentStep}
                    onRegionChange={handleRegionChange}
                    onRegionCodeFieldChange={handleRegionCodeFieldChange}
                    onAddDocuments={handleAddDocuments}
                    onRemoveDocument={handleRemoveDocument}
                    onCreateIncoterm={handleCreateIncoterm}
                    onCreateCountry={handleCreateCountry}
                    onCreateRegion={handleCreateRegion}
                    onDraftChange={setDraftClient}
                    onPendingDiscountDraftChange={(discountDraft) => {
                      pendingDiscountDraftRef.current = discountDraft
                    }}
                  />
                </Card>
              </Grid.Col>
            </Grid>

            <Group justify="space-between" mt="md">
              <Button
                variant="light"
                color="gray"
                leftSection={<IconChevronLeft size={16} />}
                disabled={visibleSteps.indexOf(currentStep) <= 0}
                onClick={goPrevious}
              >
                {t('Назад')}
              </Button>
              {visibleSteps.indexOf(currentStep) === visibleSteps.length - 1 ? (
                <Button
                  type="submit"
                  color={CREATE_ACTION_COLOR}
                  disabled={!isPricingValid || isLoadingRegionCode || Boolean(regionCodeError)}
                  leftSection={<IconCheck size={16} />}
                  loading={isSaving}
                >
                  {t('Створити')}
                </Button>
              ) : (
                <Button
                  color={CREATE_ACTION_COLOR}
                  rightSection={<IconChevronRight size={16} />}
                  disabled={currentStep === 'role' && !draft.ClientInRole.ClientTypeRole}
                  onClick={goNext}
                >
                  {t('Далі')}
                </Button>
              )}
            </Group>
          </form>
        )}
      </Stack>
    </AppModal>
  )
}

function NewStepContent({
  clientTypes,
  draft,
  errors,
  role,
  hasPermission,
  lookups,
  isLoadingRegionCode,
  regionCodeError,
  setDraftField,
  setRole,
  setBankField,
  setAccountNumber,
  setAccountNumberCurrency,
  setIbanNumber,
  setIbanNumberCurrency,
  step,
  onRegionChange,
  onRegionCodeFieldChange,
  onAddDocuments,
  onRemoveDocument,
  onCreateIncoterm,
  onCreateCountry,
  onCreateRegion,
  onDraftChange,
  onPendingDiscountDraftChange,
}: NewStepContentProps) {
  const { t } = useI18n()

  if (step === 'role') {
    return (
      <Stack gap="md">
        <Title order={3} size="h4">
          {t('Роль')}
        </Title>
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
          {clientTypes.flatMap((clientType) =>
            (clientType.ClientTypeRoles || []).flatMap((clientRole) => {
              if (!canSelectRole(clientType, clientRole, hasPermission)) {
                return []
              }

              const isSelected = isSameRole(draft.ClientInRole.ClientTypeRole, clientRole)

              return [
                <Button
                  key={`${clientType.Id || clientType.NetUid || clientType.Name}-${clientRole.Id || clientRole.NetUid || clientRole.Name}`}
                  type="button"
                  fullWidth
                  h="auto"
                  justify="space-between"
                  color={isSelected ? 'orange' : 'gray'}
                  variant={isSelected ? 'light' : 'default'}
                  onClick={() => setRole(clientType, clientRole)}
                >
                  <Group justify="space-between" w="100%" py={4}>
                    <Box ta="left">
                      <Text fw={600}>{clientRole.Name || t('Без назви')}</Text>
                      <Text size="xs" c="dimmed">
                        {clientType.Name || '-'}
                      </Text>
                    </Box>
                    {isSelected && <Badge className="app-role-pill">{t('Обрано')}</Badge>}
                  </Group>
                </Button>,
              ]
            }),
          )}
        </SimpleGrid>
      </Stack>
    )
  }

  if (step === 'contact-information') {
    return (
      <Stack gap="md">
        <Title order={3} size="h4">
          {t('Контакти')}
        </Title>
        <ContactInfoFields client={draft} errors={errors} role={role} onChange={setDraftField} />
      </Stack>
    )
  }

  if (step === 'bank-details') {
    return (
      <Stack gap="md">
        <Title order={3} size="h4">
          {t('Банківські дані')}
        </Title>
        <BankDetailsFields
          client={draft}
          currencies={lookups.currencies}
          onAccountNumberChange={setAccountNumber}
          onAccountNumberCurrencyChange={setAccountNumberCurrency}
          onBankFieldChange={setBankField}
          onIbanNumberChange={setIbanNumber}
          onIbanNumberCurrencyChange={setIbanNumberCurrency}
        />
      </Stack>
    )
  }

  if (step === 'pricing') {
    return (
      <Stack gap="md">
        <Title order={3} size="h4">
          {getNewStepLabel(step)}
        </Title>
        <PricingPanel
          client={draft}
          isProvider={getClientType(draft) === CLIENT_TYPE_PROVIDER}
          mode="new"
          onChange={onDraftChange}
          onAddContractDocuments={onAddDocuments}
          onPendingDiscountDraftChange={onPendingDiscountDraftChange}
          onRemoveContractDocument={onRemoveDocument}
        />
      </Stack>
    )
  }

  if (step === 'perfect-client') {
    return <PerfectClientPanel client={draft} onChange={onDraftChange} />
  }

  return (
    <Stack gap="md">
      <Title order={3} size="h4">
        {t('Загальна інформація')}
      </Title>
      <GeneralInfoFields
        client={draft}
        countries={lookups.countries}
        errors={errors}
        incoterms={lookups.incoterms}
        isLoadingRegionCode={isLoadingRegionCode}
        packingMarkingPayments={lookups.packingMarkingPayments}
        packingMarkings={lookups.packingMarkings}
        regionCodeError={regionCodeError}
        regions={lookups.regions}
        role={role}
        canSaveDocuments={false}
        isNew
        onAddDocuments={onAddDocuments}
        onChange={setDraftField}
        onCreateCountry={onCreateCountry}
        onCreateIncoterm={onCreateIncoterm}
        onCreateRegion={onCreateRegion}
        onRegionChange={onRegionChange}
        onRegionCodeFieldChange={onRegionCodeFieldChange}
        onRemoveDocument={onRemoveDocument}
        onSaveDocuments={() => undefined}
      />
    </Stack>
  )
}

function createEmptyDraft(isSubClient = false): ClientDraft {
  return {
    IsActive: true,
    IsSubClient: isSubClient,
    ClientAgreements: [],
    ClientManagers: [],
    ClientInRole: {},
    PerfectClients: [],
    ServicePayers: [],
  }
}

function initializeDraftRole(draft: ClientDraft, clientTypes: ClientType[], preferredType?: 'supplier' | 'client'): ClientDraft {
  if (draft.ClientInRole.ClientType) {
    return draft
  }

  const typeToSelect = clientTypes.find((clientType) =>
    preferredType === 'supplier' ? clientType.Type === CLIENT_TYPE_PROVIDER : clientType.Type === CLIENT_TYPE_BUYER,
  ) || clientTypes[0]

  return {
    ...draft,
    ClientInRole: {
      ...draft.ClientInRole,
      ClientType: typeToSelect,
    },
  }
}

function getNewClientReturnPath(routeState: ClientNewRouteState | null): string {
  return routeState?.returnPath || (routeState?.clientType === 'supplier' ? '/suppliers' : '/clients')
}

function buildVisibleNewSteps(draft: ClientDraft): NewClientStep[] {
  const type = getClientType(draft)
  const steps: NewClientStep[] = ['role', 'general-information', 'contact-information']

  if (type === CLIENT_TYPE_PROVIDER) {
    steps.push('bank-details')
  }

  if (type !== CLIENT_TYPE_PROVIDER) {
    steps.push('perfect-client')
  }

  steps.push('pricing')

  return steps
}

function getFirstNewClientErrorStep(errors: ClientFormErrors, visibleSteps: NewClientStep[]): NewClientStep | null {
  for (const field of Object.keys(errors)) {
    const step = NEW_CLIENT_FIELD_STEPS[field]

    if (step && visibleSteps.includes(step)) {
      return step
    }
  }

  return null
}

function getNewClientServerValidationErrors(
  error: unknown,
  role: ClientFormRole,
  tooManyMessage: string,
): ClientFormErrors | null {
  if (!role.isBuyer || !(error instanceof Error)) {
    return null
  }

  const message = error.message.toLocaleLowerCase('uk-UA')
  const isTinLengthError =
    (message.includes('інн') || message.includes('іпн') || message.includes('tin'))
    && message.includes('30')

  return isTinLengthError ? { TIN: tooManyMessage } : null
}

function buildCreatePayload(draft: ClientDraft): Client {
  const payload: Client = {
    ...draft,
    Manufacturer: draft.SupplierName || draft.Manufacturer,
    ClientInRole: {
      ClientType: draft.ClientInRole.ClientType,
      ClientTypeRole: draft.ClientInRole.ClientTypeRole,
    },
  }

  delete payload.ClientContractDocuments

  return payload
}

function toPendingContractDocument(file: File): ClientContractDocument {
  return {
    FileName: file.name,
    ContentType: file.type,
  }
}

function canSelectRole(clientType: ClientType, role: ClientTypeRole, hasPermission: (permissionKey: string) => boolean): boolean {
  const clientTypePermission = getClientTypePermission(clientType.ClientTypeIcon)
  const rolePermission = getClientTypeRolePermission(role.Name)

  return (!clientTypePermission || hasPermission(clientTypePermission)) && (!rolePermission || hasPermission(rolePermission))
}

function isSameRole(currentRole: ClientTypeRole | undefined, nextRole: ClientTypeRole): boolean {
  if (!currentRole) {
    return false
  }

  if (typeof currentRole.Id === 'number' && typeof nextRole.Id === 'number') {
    return currentRole.Id === nextRole.Id
  }

  return Boolean(currentRole.NetUid && currentRole.NetUid === nextRole.NetUid)
}

function isSameClientType(currentType: ClientType | undefined, nextType: ClientType): boolean {
  if (!currentType) {
    return false
  }

  if (typeof currentType.Id === 'number' && typeof nextType.Id === 'number') {
    return currentType.Id === nextType.Id
  }

  if (currentType.NetUid && nextType.NetUid) {
    return currentType.NetUid === nextType.NetUid
  }

  return currentType.Type === nextType.Type
}

function normalizeStep(step?: string): NewClientStep | null {
  return NEW_CLIENT_STEPS.includes(step as NewClientStep) ? (step as NewClientStep) : null
}

function getNewStepLabel(step: NewClientStep): string {
  const labels: Record<NewClientStep, string> = {
    role: 'Роль',
    'general-information': 'Загальна інформація',
    'contact-information': 'Контакти',
    'bank-details': 'Банківські дані',
    'perfect-client': 'Ідеальний клієнт',
    pricing: 'Ціноутворення',
  }

  return translate(labels[step])
}

function getClientType(client: ClientDraft): number | undefined {
  return client.ClientInRole.ClientType?.Type
}

function getClientDisplayName(client: Client): string {
  const fullName = client.FullName?.trim() || client.Name?.trim()

  if (fullName) {
    return fullName
  }

  return [client.FirstName, client.LastName, client.MiddleName].filter(Boolean).join(' ') || translate('Без назви')
}
