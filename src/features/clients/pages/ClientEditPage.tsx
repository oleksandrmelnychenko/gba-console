import {
  Alert,
  Badge,
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
import { AppDrawer } from "../../../shared/ui/AppDrawer"
import { AppModal } from "../../../shared/ui/AppModal"
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconCheck, IconChevronLeft, IconDeviceFloppy, IconTrash } from '@tabler/icons-react'
import { type FormEvent, useEffect, useMemo } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { translate } from '../../../shared/i18n/translate'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useAuth } from '../../auth/useAuth'
import { deleteClient, getClientById, updateClient } from '../api/clientFormApi'
import {
  EDIT_CLIENT_ACTIVE_PERMISSION,
  EDIT_CLIENT_DELETE_PERMISSION,
  EDIT_CLIENT_ECOMMERCE_PERMISSION,
  EDIT_CLIENT_PRICING_PERMISSION,
  EDIT_CLIENT_TYPE_PERMISSION,
} from '../permissions'
import type { Client } from '../types'

const CLIENT_TYPE_BUYER = 0
const CLIENT_TYPE_PROVIDER = 1

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
  setAccountNumber: (value: string) => void
  setBankField: SetClientBankField
  setField: SetClientField
  setIbanNumber: (value: string) => void
  step: string
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
  const routeState = location.state as ClientEditRouteState | null
  const basePath = location.pathname.startsWith('/suppliers/edit') ? '/suppliers/edit' : '/clients/edit'
  const returnPath = routeState?.returnPath || (basePath === '/suppliers/edit' ? '/suppliers' : '/clients')

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

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {error}
        </Alert>
      )}

      <ClientEditBody
        activeStep={activeStep}
        canEditActive={hasPermission(EDIT_CLIENT_ACTIVE_PERMISSION)}
        canViewType={hasPermission(EDIT_CLIENT_TYPE_PERMISSION)}
        client={client}
        firstStep={firstStep}
        isLoading={isLoading}
        selectedStep={step}
        setAccountNumber={setAccountNumber}
        setBankField={setBankField}
        setField={setField}
        setIbanNumber={setIbanNumber}
        steps={steps}
        onGoToStep={goToStep}
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

  return (
    <Group justify="space-between" align="start">
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
      </Group>
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
  firstStep,
  isLoading,
  selectedStep,
  setAccountNumber,
  setBankField,
  setField,
  setIbanNumber,
  steps,
  onGoToStep,
  onSubmit,
}: {
  activeStep?: EditStep
  canEditActive: boolean
  canViewType: boolean
  client: Client | null
  firstStep?: EditStep
  isLoading: boolean
  selectedStep?: string
  setAccountNumber: (value: string) => void
  setBankField: SetClientBankField
  setField: SetClientField
  setIbanNumber: (value: string) => void
  steps: EditStep[]
  onGoToStep: (nextStep: string) => void
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
                setAccountNumber={setAccountNumber}
                setBankField={setBankField}
                setField={setField}
                setIbanNumber={setIbanNumber}
                step={selectedStep || firstStep?.value || ''}
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
  setAccountNumber,
  setBankField,
  setField,
  setIbanNumber,
  step,
}: EditStepContentProps) {
  const { t } = useI18n()

  if (step === 'contact-information') {
    return (
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
        <TextInput label={t('Телефон')} value={client.ClientNumber || ''} onChange={(event) => setField('ClientNumber', event.currentTarget.value)} />
        <TextInput label={t('Мобільний')} value={client.MobileNumber || ''} onChange={(event) => setField('MobileNumber', event.currentTarget.value)} />
        <TextInput label="SMS" value={client.SMSNumber || ''} onChange={(event) => setField('SMSNumber', event.currentTarget.value)} />
        <TextInput label="Email" value={client.EmailAddress || ''} onChange={(event) => setField('EmailAddress', event.currentTarget.value)} />
        <TextInput label={t('Директор')} value={client.DirectorNumber || ''} onChange={(event) => setField('DirectorNumber', event.currentTarget.value)} />
        <TextInput label={t('Бухгалтер')} value={client.AccountantNumber || ''} onChange={(event) => setField('AccountantNumber', event.currentTarget.value)} />
        <TextInput label={t('Фактична адреса')} value={client.ActualAddress || ''} onChange={(event) => setField('ActualAddress', event.currentTarget.value)} />
        <TextInput label={t('Юридична адреса')} value={client.LegalAddress || ''} onChange={(event) => setField('LegalAddress', event.currentTarget.value)} />
        <TextInput label={t('Адреса доставки')} value={client.DeliveryAddress || ''} onChange={(event) => setField('DeliveryAddress', event.currentTarget.value)} />
        <TextInput label={t('Менеджер')} value={client.Manager || ''} onChange={(event) => setField('Manager', event.currentTarget.value)} />
      </SimpleGrid>
    )
  }

  if (step === 'bank-details') {
    return (
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
        <TextInput label={t('Код філії')} value={client.ClientBankDetails?.BranchCode || ''} onChange={(event) => setBankField('BranchCode', event.currentTarget.value)} />
        <TextInput label="SWIFT" value={client.ClientBankDetails?.Swift || ''} onChange={(event) => setBankField('Swift', event.currentTarget.value)} />
        <TextInput label={t('Банк і філія')} value={client.ClientBankDetails?.BankAndBranch || ''} onChange={(event) => setBankField('BankAndBranch', event.currentTarget.value)} />
        <TextInput label={t('Адреса банку')} value={client.ClientBankDetails?.BankAddress || ''} onChange={(event) => setBankField('BankAddress', event.currentTarget.value)} />
        <TextInput label={t('Рахунок')} value={client.ClientBankDetails?.AccountNumber?.AccountNumber || ''} onChange={(event) => setAccountNumber(event.currentTarget.value)} />
        <TextInput label="IBAN" value={client.ClientBankDetails?.ClientBankDetailIbanNo?.IBANNO || ''} onChange={(event) => setIbanNumber(event.currentTarget.value)} />
      </SimpleGrid>
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
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
      <TextInput label={t('Повна назва')} value={client.FullName || ''} onChange={(event) => setField('FullName', event.currentTarget.value)} />
      <TextInput label={t('Назва')} value={client.Name || ''} onChange={(event) => setField('Name', event.currentTarget.value)} />
      <TextInput label={t('Прізвище')} value={client.LastName || ''} onChange={(event) => setField('LastName', event.currentTarget.value)} />
      <TextInput label={t("Ім'я")} value={client.FirstName || ''} onChange={(event) => setField('FirstName', event.currentTarget.value)} />
      <TextInput label={t('По батькові')} value={client.MiddleName || ''} onChange={(event) => setField('MiddleName', event.currentTarget.value)} />
      <TextInput label={t('ЄДРПОУ')} value={client.USREOU || ''} onChange={(event) => setField('USREOU', event.currentTarget.value)} />
      <TextInput label={t('ІПН')} value={client.TIN || ''} onChange={(event) => setField('TIN', event.currentTarget.value)} />
      <TextInput label="SROI" value={client.SROI || ''} onChange={(event) => setField('SROI', event.currentTarget.value)} />
      <TextInput label={t('Постачальник')} value={client.SupplierName || client.Manufacturer || ''} onChange={(event) => setField('SupplierName', event.currentTarget.value)} />
      <TextInput label={t('Код постачальника')} value={client.SupplierCode || ''} onChange={(event) => setField('SupplierCode', event.currentTarget.value)} />
      <TextInput label={t('Бренд')} value={client.Brand || ''} onChange={(event) => setField('Brand', event.currentTarget.value)} />
      <Switch checked={Boolean(client.IsIndividual)} label={t('Фізична особа')} onChange={(event) => setField('IsIndividual', event.currentTarget.checked)} />
      <Switch checked={Boolean(client.IsNotResident)} label={t('Нерезидент')} onChange={(event) => setField('IsNotResident', event.currentTarget.checked)} />
    </SimpleGrid>
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
