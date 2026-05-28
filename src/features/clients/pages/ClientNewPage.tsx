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
  Switch,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { AppModal } from "../../../shared/ui/AppModal"
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconCheck, IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { type FormEvent, useEffect, useMemo } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { translate } from '../../../shared/i18n/translate'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useAuth } from '../../auth/useAuth'
import { getClientTypes } from '../api/clientsApi'
import { createClient } from '../api/clientFormApi'
import { getClientTypePermission, getClientTypeRolePermission } from '../permissions'
import { PerfectClientPanel } from '../components/perfect-client/PerfectClientPanel'
import { PricingPanel } from '../components/pricing/PricingPanel'
import type { Client, ClientType, ClientTypeRole } from '../types'

const CLIENT_TYPE_BUYER = 0
const CLIENT_TYPE_PROVIDER = 1
const NEW_CLIENT_STEPS = ['role', 'general-information', 'contact-information', 'bank-details', 'perfect-client', 'pricing'] as const

type NewClientStep = (typeof NEW_CLIENT_STEPS)[number]

type ClientNewRouteState = {
  clientType?: 'supplier' | 'client'
  moduleTitle?: string
  parentClientId?: string
  returnPath?: string
}

type ClientDraft = Client & {
  ClientInRole: {
    ClientType?: ClientType
    ClientTypeRole?: ClientTypeRole
  }
}

type SetClientDraftField = <K extends keyof ClientDraft>(key: K, value: ClientDraft[K]) => void

type NewStepContentProps = {
  clientTypes: ClientType[]
  draft: ClientDraft
  hasPermission: (permissionKey: string) => boolean
  setDraftField: SetClientDraftField
  setRole: (clientType: ClientType, role: ClientTypeRole) => void
  onDraftChange: (client: Client) => void
  onPricingValidityChange: (isValid: boolean) => void
  step: NewClientStep
}

export function ClientNewPage() {
  const { t } = useI18n()
  const { step } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { hasPermission } = useAuth()
  const routeState = location.state as ClientNewRouteState | null
  const [clientTypes, setClientTypes] = useValueState<ClientType[]>([])
  const [draft, setDraft] = useValueState<ClientDraft>(() => createEmptyDraft())
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isSaving, setSaving] = useValueState(false)
  const [isPricingValid, setPricingValid] = useValueState(false)
  const requestedStep = normalizeStep(step)
  const visibleSteps = useMemo(() => buildVisibleNewSteps(draft), [draft])
  const currentStep = requestedStep || 'role'
  const firstUnavailableStep = currentStep !== 'role' && !draft.ClientInRole.ClientTypeRole
  const returnPath = getNewClientReturnPath(routeState)

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

  if (!requestedStep) {
    return <Navigate to="/clients/new/role" replace state={location.state} />
  }

  if (firstUnavailableStep || !visibleSteps.includes(currentStep)) {
    return <Navigate to="/clients/new/role" replace state={location.state} />
  }

  function setDraftField<K extends keyof ClientDraft>(key: K, value: ClientDraft[K]) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [key]: value,
      ...(key === 'SupplierName' ? { Manufacturer: String(value || '') } : {}),
    }))
  }

  function setRole(clientType: ClientType, role: ClientTypeRole) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      ClientInRole: {
        ClientType: clientType,
        ClientTypeRole: role,
      },
    }))
  }

  function setDraftClient(updatedClient: Client) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      ...updatedClient,
      ClientInRole: currentDraft.ClientInRole,
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

    navigate(returnPath, { replace: true })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!draft.ClientInRole.ClientTypeRole) {
      setError(t('Оберіть роль'))
      return
    }

    if ((draft.ClientAgreements || []).length === 0) {
      setError(t('Додайте договір'))
      return
    }

    setSaving(true)
    setError(null)

    try {
      const createdClient = await createClient(buildCreatePayload(draft), routeState?.parentClientId)
      notifications.show({
        color: 'green',
        message: t('Клієнта створено'),
      })
      navigate(getClientType(draft) === CLIENT_TYPE_PROVIDER ? '/suppliers' : '/clients', {
        replace: true,
        state: createdClient
          ? {
              nodeTitle: getClientDisplayName(createdClient),
            }
          : undefined,
      })
    } catch (saveError) {
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
        {error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}

        {isLoading ? (
          <Card withBorder radius="md" padding="lg">
            <Group justify="center" py="xl">
              <Loader color="violet" size="sm" />
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
                        color={item === currentStep ? 'violet' : 'gray'}
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
                    hasPermission={hasPermission}
                    setDraftField={setDraftField}
                    setRole={setRole}
                    step={currentStep}
                    onDraftChange={setDraftClient}
                    onPricingValidityChange={setPricingValid}
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
                  color="violet"
                  disabled={!isPricingValid}
                  leftSection={<IconCheck size={16} />}
                  loading={isSaving}
                >
                  {t('Створити')}
                </Button>
              ) : (
                <Button
                  color="violet"
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
  hasPermission,
  setDraftField,
  setRole,
  step,
  onDraftChange,
  onPricingValidityChange,
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
            (clientType.ClientTypeRoles || []).flatMap((role) => {
              if (!canSelectRole(clientType, role, hasPermission)) {
                return []
              }

              const isSelected = isSameRole(draft.ClientInRole.ClientTypeRole, role)

              return [
                <Button
                  key={`${clientType.Id || clientType.NetUid || clientType.Name}-${role.Id || role.NetUid || role.Name}`}
                  type="button"
                  fullWidth
                  h="auto"
                  justify="space-between"
                  color={isSelected ? 'violet' : 'gray'}
                  variant={isSelected ? 'light' : 'default'}
                  onClick={() => setRole(clientType, role)}
                >
                  <Group justify="space-between" w="100%" py={4}>
                    <Box ta="left">
                      <Text fw={600}>{role.Name || t('Без назви')}</Text>
                      <Text size="xs" c="dimmed">
                        {clientType.Name || '-'}
                      </Text>
                    </Box>
                    {isSelected && <Badge color="violet">{t('Обрано')}</Badge>}
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
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
          <TextInput label={t('Телефон')} value={draft.ClientNumber || ''} onChange={(event) => setDraftField('ClientNumber', event.currentTarget.value)} />
          <TextInput label={t('Мобільний')} value={draft.MobileNumber || ''} onChange={(event) => setDraftField('MobileNumber', event.currentTarget.value)} />
          <TextInput label="SMS" value={draft.SMSNumber || ''} onChange={(event) => setDraftField('SMSNumber', event.currentTarget.value)} />
          <TextInput label="Email" value={draft.EmailAddress || ''} onChange={(event) => setDraftField('EmailAddress', event.currentTarget.value)} />
          <TextInput label={t('Фактична адреса')} value={draft.ActualAddress || ''} onChange={(event) => setDraftField('ActualAddress', event.currentTarget.value)} />
          <TextInput label={t('Юридична адреса')} value={draft.LegalAddress || ''} onChange={(event) => setDraftField('LegalAddress', event.currentTarget.value)} />
          <TextInput label={t('Адреса доставки')} value={draft.DeliveryAddress || ''} onChange={(event) => setDraftField('DeliveryAddress', event.currentTarget.value)} />
          <TextInput label={t('Менеджер')} value={draft.Manager || ''} onChange={(event) => setDraftField('Manager', event.currentTarget.value)} />
        </SimpleGrid>
      </Stack>
    )
  }

  if (step === 'bank-details') {
    return (
      <Stack gap="md">
        <Title order={3} size="h4">
          {t('Банківські дані')}
        </Title>
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
          <TextInput label={t('Код філії')} value={draft.ClientBankDetails?.BranchCode || ''} onChange={(event) => setDraftField('ClientBankDetails', { ...draft.ClientBankDetails, BranchCode: event.currentTarget.value })} />
          <TextInput label="SWIFT" value={draft.ClientBankDetails?.Swift || ''} onChange={(event) => setDraftField('ClientBankDetails', { ...draft.ClientBankDetails, Swift: event.currentTarget.value })} />
          <TextInput label={t('Банк і філія')} value={draft.ClientBankDetails?.BankAndBranch || ''} onChange={(event) => setDraftField('ClientBankDetails', { ...draft.ClientBankDetails, BankAndBranch: event.currentTarget.value })} />
          <TextInput label={t('Адреса банку')} value={draft.ClientBankDetails?.BankAddress || ''} onChange={(event) => setDraftField('ClientBankDetails', { ...draft.ClientBankDetails, BankAddress: event.currentTarget.value })} />
        </SimpleGrid>
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
          onValidityChange={onPricingValidityChange}
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
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
        <TextInput label={t('Повна назва')} value={draft.FullName || ''} onChange={(event) => setDraftField('FullName', event.currentTarget.value)} />
        <TextInput label={t('Назва')} value={draft.Name || ''} onChange={(event) => setDraftField('Name', event.currentTarget.value)} />
        <TextInput label={t('Прізвище')} value={draft.LastName || ''} onChange={(event) => setDraftField('LastName', event.currentTarget.value)} />
        <TextInput label={t("Ім'я")} value={draft.FirstName || ''} onChange={(event) => setDraftField('FirstName', event.currentTarget.value)} />
        <TextInput label={t('По батькові')} value={draft.MiddleName || ''} onChange={(event) => setDraftField('MiddleName', event.currentTarget.value)} />
        <TextInput label={t('ЄДРПОУ')} value={draft.USREOU || ''} onChange={(event) => setDraftField('USREOU', event.currentTarget.value)} />
        <TextInput label={t('ІПН')} value={draft.TIN || ''} onChange={(event) => setDraftField('TIN', event.currentTarget.value)} />
        <TextInput label="SROI" value={draft.SROI || ''} onChange={(event) => setDraftField('SROI', event.currentTarget.value)} />
        <TextInput label={t('Постачальник')} value={draft.SupplierName || ''} onChange={(event) => setDraftField('SupplierName', event.currentTarget.value)} />
        <TextInput label={t('Код постачальника')} value={draft.SupplierCode || ''} onChange={(event) => setDraftField('SupplierCode', event.currentTarget.value)} />
        <TextInput label={t('Бренд')} value={draft.Brand || ''} onChange={(event) => setDraftField('Brand', event.currentTarget.value)} />
        <Switch checked={Boolean(draft.IsIndividual)} label={t('Фізична особа')} onChange={(event) => setDraftField('IsIndividual', event.currentTarget.checked)} />
        <Switch checked={Boolean(draft.IsNotResident)} label={t('Нерезидент')} onChange={(event) => setDraftField('IsNotResident', event.currentTarget.checked)} />
      </SimpleGrid>
    </Stack>
  )
}

function createEmptyDraft(): ClientDraft {
  return {
    IsActive: true,
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

function buildCreatePayload(draft: ClientDraft): Client {
  return {
    ...draft,
    Manufacturer: draft.SupplierName || draft.Manufacturer,
    ClientInRole: {
      ClientType: draft.ClientInRole.ClientType,
      ClientTypeRole: draft.ClientInRole.ClientTypeRole,
    },
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
