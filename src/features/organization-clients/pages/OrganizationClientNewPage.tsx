import {
  Alert,
  Button,
  Group,
  Loader,
  Stack,
  Text,
} from '@mantine/core'
import { AppDrawer } from "../../../shared/ui/AppDrawer"
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconChevronLeft, IconDeviceFloppy } from '@tabler/icons-react'
import { type FormEvent, useEffect } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useLocation, useNavigate } from 'react-router-dom'
import { useI18n } from '../../../shared/i18n/useI18n'
import { createOrganizationClient, getCurrencies } from '../api/organizationClientsApi'
import { OrganizationClientAgreementsPanel } from '../components/OrganizationClientAgreementsPanel'
import { OrganizationClientForm } from '../components/OrganizationClientForm'
import type { Currency, OrganizationClient, OrganizationClientAgreement } from '../types'
import {
  createEmptyOrganizationClient,
  getOrganizationClientName,
  normalizeClientForSave,
  validateOrganizationClient,
} from '../utils'

type OrganizationClientNewRouteState = {
  returnPath?: string
}

export function OrganizationClientNewPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const routeState = location.state as OrganizationClientNewRouteState | null
  const returnPath = routeState?.returnPath || '/organization-clients'
  const [client, setClient] = useValueState<OrganizationClient>(() => createEmptyOrganizationClient())
  const [currencies, setCurrencies] = useValueState<Currency[]>([])
  const [error, setError] = useValueState<string | null>(null)
  const [isLoadingCurrencies, setLoadingCurrencies] = useValueState(true)
  const [isSaving, setSaving] = useValueState(false)

  useEffect(() => {
    let cancelled = false

    async function loadCurrencies() {
      setLoadingCurrencies(true)

      try {
        const nextCurrencies = await getCurrencies()

        if (!cancelled) {
          setCurrencies(nextCurrencies)
        }
      } catch (loadError) {
        if (!cancelled) {
          setCurrencies([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити валюти'))
        }
      } finally {
        if (!cancelled) {
          setLoadingCurrencies(false)
        }
      }
    }

    void loadCurrencies()

    return () => {
      cancelled = true
    }
  }, [setCurrencies, setError, setLoadingCurrencies, t])

  function setField<K extends keyof OrganizationClient>(key: K, value: OrganizationClient[K]) {
    setClient((currentClient) => ({
      ...currentClient,
      [key]: value,
    }))
  }

  function addAgreement(agreement: OrganizationClientAgreement) {
    setClient((currentClient) => ({
      ...currentClient,
      OrganizationClientAgreements: [...(currentClient.OrganizationClientAgreements || []), agreement],
    }))
  }

  function removeAgreement(agreement: OrganizationClientAgreement, index: number) {
    void agreement

    setClient((currentClient) => ({
      ...currentClient,
      OrganizationClientAgreements: (currentClient.OrganizationClientAgreements || []).filter(
        (_currentAgreement, currentIndex) => currentIndex !== index,
      ),
    }))
  }

  function closeSheet() {
    if (isSaving) {
      return
    }

    navigate(returnPath)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const payload = normalizeClientForSave(client)
    const validationError = validateOrganizationClient(payload)

    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError(null)

    try {
      const createdClient = await createOrganizationClient(payload)
      notifications.show({
        color: 'green',
        message: t('Організацію створено'),
      })
      navigate(returnPath, {
        replace: true,
        state: createdClient
          ? {
              nodeTitle: getOrganizationClientName(createdClient),
            }
          : undefined,
      })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося створити організацію'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppDrawer
      opened
      keepMounted={false}
      position="right"
      size="min(760px, 100vw)"
      aria-label={t('Нова організація')}
      onClose={closeSheet}
    >
      <Stack gap="md">
        {error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <form id="organization-client-new-form" onSubmit={handleSubmit}>
          <Stack gap="lg">
            <OrganizationClientForm client={client} disabled={isSaving} onFieldChange={setField} />

            <OrganizationClientAgreementsPanel
              agreements={client.OrganizationClientAgreements || []}
              currencies={currencies}
              disabled={isSaving}
              isLoadingCurrencies={isLoadingCurrencies}
              onAddAgreement={addAgreement}
              onRemoveAgreement={removeAgreement}
            />

            {isLoadingCurrencies && (
              <Group gap="xs">
                <Loader color="violet" size="xs" />
                <Text c="dimmed" size="sm">
                  {t('Завантаження валют')}
                </Text>
              </Group>
            )}
          </Stack>
        </form>

        <Group justify="space-between">
          <Button
            color="gray"
            leftSection={<IconChevronLeft size={16} />}
            variant="light"
            onClick={closeSheet}
          >
            {t('Скасувати')}
          </Button>
          <Button
            color="violet"
            form="organization-client-new-form"
            leftSection={<IconDeviceFloppy size={16} />}
            loading={isSaving}
            type="submit"
          >
            {t('Створити')}
          </Button>
        </Group>
      </Stack>
    </AppDrawer>
  )
}
