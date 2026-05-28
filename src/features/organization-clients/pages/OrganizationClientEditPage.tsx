import {
  Alert,
  Button,
  Card,
  Group,
  Loader,
  Stack,
  Text,
} from '@mantine/core'
import { AppDrawer } from "../../../shared/ui/AppDrawer"
import { AppModal } from "../../../shared/ui/AppModal"
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconCheck,
  IconChevronLeft,
  IconDeviceFloppy,
  IconTrash,
} from '@tabler/icons-react'
import { type FormEvent, useEffect } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useI18n } from '../../../shared/i18n/useI18n'
import {
  deleteOrganizationClient,
  getCurrencies,
  getOrganizationClient,
  updateOrganizationClient,
} from '../api/organizationClientsApi'
import { OrganizationClientAgreementsPanel } from '../components/OrganizationClientAgreementsPanel'
import { OrganizationClientForm } from '../components/OrganizationClientForm'
import type { Currency, OrganizationClient, OrganizationClientAgreement } from '../types'
import {
  getOrganizationClientName,
  normalizeClientForSave,
  validateOrganizationClient,
} from '../utils'

type OrganizationClientEditRouteState = {
  returnPath?: string
}

export function OrganizationClientEditPage() {
  const { t } = useI18n()
  const { netId } = useParams<{ netId?: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const routeState = location.state as OrganizationClientEditRouteState | null
  const returnPath = routeState?.returnPath || '/organization-clients'
  const [client, setClient] = useValueState<OrganizationClient | null>(null)
  const [currencies, setCurrencies] = useValueState<Currency[]>([])
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isLoadingCurrencies, setLoadingCurrencies] = useValueState(true)
  const [isSaving, setSaving] = useValueState(false)
  const [isDeleting, setDeleting] = useValueState(false)
  const [deleteModalOpened, setDeleteModalOpened] = useValueState(false)

  useEffect(() => {
    let cancelled = false

    async function loadClient() {
      if (!netId) {
        return
      }

      setLoading(true)
      setError(null)

      try {
        const nextClient = await getOrganizationClient(netId)

        if (!cancelled) {
          setClient(nextClient)
        }
      } catch (loadError) {
        if (!cancelled) {
          setClient(null)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити організацію'))
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
  }, [netId, setClient, setError, setLoading, t])

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

  if (!netId) {
    return <Navigate to="/organization-clients" replace />
  }

  function setField<K extends keyof OrganizationClient>(key: K, value: OrganizationClient[K]) {
    setClient((currentClient) =>
      currentClient
        ? {
            ...currentClient,
            [key]: value,
          }
        : currentClient,
    )
  }

  function addAgreement(agreement: OrganizationClientAgreement) {
    setClient((currentClient) =>
      currentClient
        ? {
            ...currentClient,
            OrganizationClientAgreements: [...(currentClient.OrganizationClientAgreements || []), agreement],
          }
        : currentClient,
    )
  }

  function removeAgreement(agreement: OrganizationClientAgreement, index: number) {
    void agreement

    const agreements = client?.OrganizationClientAgreements || []

    if (!client || agreements.length <= 1) {
      setError(t('Має залишитися хоча б один договір'))
      return
    }

    setClient((currentClient) =>
      currentClient
        ? {
            ...currentClient,
            OrganizationClientAgreements: (currentClient.OrganizationClientAgreements || []).filter(
              (_currentAgreement, currentIndex) => currentIndex !== index,
            ),
          }
        : currentClient,
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!client) {
      return
    }

    const payload = normalizeClientForSave(client)
    const validationError = validateOrganizationClient(payload)

    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError(null)

    try {
      const updatedClient = await updateOrganizationClient(payload)
      setClient(updatedClient || payload)
      notifications.show({
        color: 'green',
        message: t('Організацію збережено'),
      })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти організацію'))
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
      await deleteOrganizationClient(client.NetUid)
      notifications.show({
        color: 'green',
        message: t('Організацію видалено'),
      })
      navigate(returnPath, { replace: true })
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t('Не вдалося видалити організацію'))
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
      size="min(900px, 100vw)"
      onClose={closeSheet}
    >
    <Stack gap="lg">
      <Group justify="space-between" align="start">
        <div />
        <Group gap="xs">
          <Button
            color="gray"
            leftSection={<IconChevronLeft size={16} />}
            variant="light"
            onClick={closeSheet}
          >
            {t('Скасувати')}
          </Button>
          <Button
            color="red"
            disabled={!client}
            leftSection={<IconTrash size={16} />}
            loading={isDeleting}
            variant="light"
            onClick={() => setDeleteModalOpened(true)}
          >
            {t('Видалити')}
          </Button>
          <Button
            color="violet"
            disabled={!client}
            form="organization-client-edit-form"
            leftSection={<IconDeviceFloppy size={16} />}
            loading={isSaving}
            type="submit"
          >
            {t('Зберегти')}
          </Button>
        </Group>
      </Group>

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
              {t('Завантаження організації')}
            </Text>
          </Group>
        </Card>
      ) : client ? (
        <form id="organization-client-edit-form" onSubmit={handleSubmit}>
          <Card withBorder radius="md" padding="md">
            <Stack gap="lg">
              <OrganizationClientForm client={client} disabled={isSaving || isDeleting} onFieldChange={setField} />

              <OrganizationClientAgreementsPanel
                agreements={client.OrganizationClientAgreements || []}
                allowRemovingLast={false}
                currencies={currencies}
                disabled={isSaving || isDeleting}
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
          </Card>
        </form>
      ) : (
        <Card withBorder radius="md" padding="lg">
          <Text c="dimmed">{t('Організацію не знайдено')}</Text>
        </Card>
      )}

      <AppModal centered opened={deleteModalOpened} title={t('Видалити організацію')} onClose={() => setDeleteModalOpened(false)}>
        <Stack gap="md">
          <Text size="sm">{t('Підтвердити видалення')}: {client ? getOrganizationClientName(client) : ''}</Text>
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setDeleteModalOpened(false)}>
              {t('Скасувати')}
            </Button>
            <Button color="red" leftSection={<IconCheck size={16} />} loading={isDeleting} onClick={handleDelete}>
              {t('Видалити')}
            </Button>
          </Group>
        </Stack>
      </AppModal>
    </Stack>
    </AppDrawer>
  )
}
