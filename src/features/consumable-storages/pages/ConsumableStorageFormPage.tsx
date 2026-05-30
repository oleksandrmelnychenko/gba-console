import {
  Alert,
  Button,
  Card,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconArrowLeft, IconDeviceFloppy } from '@tabler/icons-react'
import { type FormEvent, useEffect, useMemo } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useAuth } from '../../auth/useAuth'
import {
  createConsumableStorage,
  getConsumableStorage,
  getConsumableStorageOrganizations,
  searchConsumableStorageUsers,
  updateConsumableStorage,
} from '../api/consumableStoragesApi'
import {
  CONSUMABLE_STORAGE_CREATE_PERMISSION,
  CONSUMABLE_STORAGE_EDIT_PERMISSION,
} from '../permissions'
import type { ConsumablesStorage, ConsumablesStoragePayload, NamedEntity, Organization, UserProfile } from '../types'

type LocationState = {
  returnPath?: string
}

type StorageFormState = {
  description: string
  name: string
  organizationNetUid: string
  responsibleUserNetUid: string
}

const STORAGES_PATH = '/accounting/storages'
const USER_SEARCH_DEBOUNCE_MS = 300

export function ConsumableStorageFormPage() {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const { id } = useParams<{ id?: string }>()
  const routeLocation = useLocation()
  const navigate = useNavigate()
  const locationState = routeLocation.state as LocationState | null
  const returnPath = locationState?.returnPath || STORAGES_PATH
  const isEditMode = Boolean(id)
  const [storage, setStorage] = useValueState<ConsumablesStorage>(() => createEmptyStorage())
  const [form, setForm] = useValueState<StorageFormState>(() => createEmptyForm())
  const [organizations, setOrganizations] = useValueState<Organization[]>([])
  const [users, setUsers] = useValueState<UserProfile[]>([])
  const [userSearchValue, setUserSearchValue] = useValueState('')
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isSaving, setSaving] = useValueState(false)
  const [debouncedUserSearchValue] = useDebouncedValue(userSearchValue, USER_SEARCH_DEBOUNCE_MS)
  const canSave = hasPermission(isEditMode ? CONSUMABLE_STORAGE_EDIT_PERMISSION : CONSUMABLE_STORAGE_CREATE_PERMISSION)

  useEffect(() => {
    const controller = new AbortController()

    async function loadResources() {
      setLoading(true)
      setError(null)

      try {
        const [nextOrganizations, nextUsers, nextStorage] = await Promise.all([
          getConsumableStorageOrganizations(),
          searchConsumableStorageUsers(''),
          id ? getConsumableStorage(id) : Promise.resolve(null),
        ])

        if (controller.signal.aborted) {
          return
        }

        const initialStorage = nextStorage || createEmptyStorage()
        const initialOrganization = initialStorage.Organization || nextOrganizations[0] || null
        const initialUser = initialStorage.ResponsibleUser || null
        setOrganizations(includeEntity(nextOrganizations, initialOrganization))
        setUsers(includeEntity(nextUsers, initialUser))
        setStorage(initialStorage)
        setForm({
          description: initialStorage.Description || '',
          name: initialStorage.Name || '',
          organizationNetUid: getEntityValue(initialOrganization) || '',
          responsibleUserNetUid: getEntityValue(initialUser) || '',
        })
      } catch (loadError) {
        if (!isAbortError(loadError)) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити склад'))
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadResources()

    return () => controller.abort()
  }, [id, setError, setForm, setLoading, setOrganizations, setStorage, setUsers, t])

  useEffect(() => {
    const responsibleUser = storage.ResponsibleUser || null
    let isActive = true

    async function loadUsers() {
      try {
        const nextUsers = await searchConsumableStorageUsers(debouncedUserSearchValue.trim())

        if (isActive) {
          setUsers(includeEntity(nextUsers, responsibleUser))
        }
      } catch (loadError) {
        if (isActive) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити користувачів'))
        }
      }
    }

    void loadUsers()

    return () => {
      isActive = false
    }
  }, [debouncedUserSearchValue, setError, setUsers, storage.ResponsibleUser, t])

  const organizationOptions = useMemo(
    () => toSelectOptions(organizations, (organization) => organization.Name || organization.FullName),
    [organizations],
  )
  const userOptions = useMemo(
    () => toSelectOptions(users, (user) => getEntityName(user)),
    [users],
  )
  const selectedOrganization = useMemo(
    () => organizations.find((organization) => getEntityValue(organization) === form.organizationNetUid) || null,
    [form.organizationNetUid, organizations],
  )
  const selectedUser = useMemo(
    () => users.find((user) => getEntityValue(user) === form.responsibleUserNetUid) || null,
    [form.responsibleUserNetUid, users],
  )

  if (isEditMode && !id) {
    return <Navigate replace to={STORAGES_PATH} />
  }

  function handleCancel() {
    if (isSaving) {
      return
    }

    navigate(returnPath, { replace: true })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const name = form.name.trim()

    if (!canSave) {
      setError(t('Немає прав для збереження складу'))
      return
    }

    if (!name) {
      setError(t('Вкажіть назву складу'))
      return
    }

    if (!selectedOrganization) {
      setError(t('Оберіть організацію'))
      return
    }

    const payload: ConsumablesStoragePayload = {
      ...storage,
      Description: form.description.trim(),
      Name: name,
      Organization: selectedOrganization,
      ResponsibleUser: selectedUser,
    }

    setSaving(true)
    setError(null)

    try {
      const savedStorage = isEditMode
        ? await updateConsumableStorage(payload)
        : await createConsumableStorage(payload)

      setStorage(savedStorage || payload)
      notifications.show({
        color: 'green',
        message: isEditMode ? t('Склад оновлено') : t('Склад створено'),
      })
      navigate(returnPath, { replace: true })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти склад'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Stack gap="md">
      <Card withBorder radius="md" shadow="sm">
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <Group justify="space-between" wrap="wrap">
              <div>
                <Text fw={700} size="xl">
                  {isEditMode ? t('Редагування складу') : t('Новий склад')}
                </Text>
              </div>

              <Group gap="xs">
                <Button color="gray" leftSection={<IconArrowLeft size={16} />} type="button" variant="light" onClick={handleCancel}>
                  {t('Назад')}
                </Button>
                <Button
                  color="violet"
                  disabled={isLoading || !canSave}
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

            {!canSave && (
              <Alert color="yellow" icon={<IconAlertCircle size={18} />} variant="light">
                {t('Немає прав для збереження складу')}
              </Alert>
            )}

            <TextInput
              disabled={isLoading || isSaving}
              label={t('Назва')}
              placeholder={t('Вкажіть назву')}
              required
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.currentTarget.value }))}
            />
            <TextInput
              disabled={isLoading || isSaving}
              label={t('Опис')}
              placeholder={t('Вкажіть опис')}
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.currentTarget.value }))}
            />
            <Select
              clearable
              searchable
              data={userOptions}
              disabled={isLoading || isSaving}
              label={t('Відповідальний')}
              placeholder={t('Оберіть відповідального')}
              searchValue={userSearchValue}
              value={form.responsibleUserNetUid || null}
              onChange={(value) => setForm((current) => ({ ...current, responsibleUserNetUid: value || '' }))}
              onSearchChange={setUserSearchValue}
            />
            <Select
              data={organizationOptions}
              disabled={isLoading || isSaving || isEditMode}
              label={t('Організація')}
              placeholder={t('Оберіть організацію')}
              required
              value={form.organizationNetUid || null}
              onChange={(value) => setForm((current) => ({ ...current, organizationNetUid: value || '' }))}
            />
          </Stack>
        </form>
      </Card>
    </Stack>
  )
}

function createEmptyStorage(): ConsumablesStorage {
  return {
    ConsumableProducts: [],
    ConsumablesOrders: [],
    Description: '',
    Name: '',
    PriceTotals: [],
  }
}

function createEmptyForm(): StorageFormState {
  return {
    description: '',
    name: '',
    organizationNetUid: '',
    responsibleUserNetUid: '',
  }
}

function toSelectOptions<T extends { NetUid?: string; Id?: number }>(items: T[], getLabel: (item: T) => string | undefined) {
  return items.reduce<Array<{ label: string; value: string }>>((options, item) => {
    const value = getEntityValue(item)

    if (!value) {
      return options
    }

    options.push({
      label: getLabel(item) || value,
      value,
    })

    return options
  }, [])
}

function includeEntity<T extends { Id?: number; NetUid?: string }>(items: T[], entity?: T | null): T[] {
  const entityValue = getEntityValue(entity)

  if (!entity || !entityValue || items.some((item) => getEntityValue(item) === entityValue)) {
    return items
  }

  return [entity, ...items]
}

function getEntityValue(entity?: { Id?: number; NetUid?: string } | null): string {
  return entity?.NetUid || (typeof entity?.Id === 'number' ? String(entity.Id) : '')
}

function getEntityName(entity?: NamedEntity | null): string | undefined {
  return entity?.LastName || entity?.FullName || entity?.Name || entity?.Code
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
