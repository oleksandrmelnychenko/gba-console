import {
  Alert,
  Button,
  Group,
  Select,
  Stack,
  TextInput,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconArrowLeft, IconDeviceFloppy } from '@tabler/icons-react'
import { type FormEvent, useEffect, useMemo, useReducer } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
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

type ConsumableStorageFormPageState = {
  error: string | null
  form: StorageFormState
  isLoading: boolean
  organizations: Organization[]
  storage: ConsumablesStorage
  users: UserProfile[]
}

function pageStateReducer(
  state: ConsumableStorageFormPageState,
  patch: Partial<ConsumableStorageFormPageState>,
): ConsumableStorageFormPageState {
  return {
    ...state,
    ...patch,
  }
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
  const [pageState, dispatchPageState] = useReducer(pageStateReducer, true, createInitialPageState)
  const [userSearchValue, setUserSearchValue] = useValueState('')
  const [isSaving, setSaving] = useValueState(false)
  const { error, form, isLoading, organizations, storage, users } = pageState
  const [debouncedUserSearchValue] = useDebouncedValue(userSearchValue, USER_SEARCH_DEBOUNCE_MS)
  const canSave = hasPermission(isEditMode ? CONSUMABLE_STORAGE_EDIT_PERMISSION : CONSUMABLE_STORAGE_CREATE_PERMISSION)

  useEffect(() => {
    const controller = new AbortController()

    dispatchPageState({ error: null, isLoading: true })

    void Promise.all([
      getConsumableStorageOrganizations(),
      searchConsumableStorageUsers(''),
      id ? getConsumableStorage(id) : Promise.resolve(null),
    ])
      .then(([nextOrganizations, nextUsers, nextStorage]) => {
        if (controller.signal.aborted) {
          return
        }

        const initialStorage = nextStorage || createEmptyStorage()
        const initialOrganization = initialStorage.Organization || nextOrganizations[0] || null
        const initialUser = initialStorage.ResponsibleUser || null
        dispatchPageState({
          error: null,
          form: {
            description: initialStorage.Description || '',
            name: initialStorage.Name || '',
            organizationNetUid: getEntityValue(initialOrganization) || '',
            responsibleUserNetUid: getEntityValue(initialUser) || '',
          },
          isLoading: false,
          organizations: includeEntity(nextOrganizations, initialOrganization),
          storage: initialStorage,
          users: includeEntity(nextUsers, initialUser),
        })
      })
      .catch((loadError: unknown) => {
        if (!isAbortError(loadError) && !controller.signal.aborted) {
          dispatchPageState({
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити склад'),
            isLoading: false,
          })
        }
      })

    return () => controller.abort()
  }, [id, t])

  useEffect(() => {
    const responsibleUser = storage.ResponsibleUser || null
    let isActive = true

    async function loadUsers() {
      try {
        const nextUsers = await searchConsumableStorageUsers(debouncedUserSearchValue.trim())

        if (isActive) {
          dispatchPageState({ users: includeEntity(nextUsers, responsibleUser) })
        }
      } catch (loadError) {
        if (isActive) {
          dispatchPageState({
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити користувачів'),
          })
        }
      }
    }

    void loadUsers()

    return () => {
      isActive = false
    }
  }, [debouncedUserSearchValue, storage.ResponsibleUser, t])

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
      dispatchPageState({ error: t('Немає прав для збереження складу') })
      return
    }

    if (!name) {
      dispatchPageState({ error: t('Вкажіть назву складу') })
      return
    }

    if (!selectedOrganization) {
      dispatchPageState({ error: t('Оберіть організацію') })
      return
    }

    if (!selectedUser) {
      dispatchPageState({ error: t('Оберіть відповідального') })
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
    dispatchPageState({ error: null })

    try {
      const savedStorage = isEditMode
        ? await updateConsumableStorage(payload)
        : await createConsumableStorage(payload)

      dispatchPageState({ storage: savedStorage || payload })
      notifications.show({
        color: 'green',
        message: isEditMode ? t('Склад оновлено') : t('Склад створено'),
      })
      navigate(returnPath, { replace: true })
    } catch (saveError) {
      dispatchPageState({
        error: saveError instanceof Error ? saveError.message : t('Не вдалося зберегти склад'),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppDrawer
      opened
      position="right"
      size="standard"
      title={isEditMode ? t('Редагування складу') : t('Новий склад')}
      onClose={handleCancel}
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <Group justify="flex-end" gap="xs" wrap="wrap">
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
              onChange={(event) =>
                dispatchPageState({
                  form: { ...form, name: event.currentTarget.value },
                })
              }
            />
            <TextInput
              disabled={isLoading || isSaving}
              label={t('Опис')}
              placeholder={t('Вкажіть опис')}
              value={form.description}
              onChange={(event) =>
                dispatchPageState({
                  form: { ...form, description: event.currentTarget.value },
                })
              }
            />
            <Select
              clearable
              searchable
              data={userOptions}
              disabled={isLoading || isSaving}
              label={t('Відповідальний')}
              placeholder={t('Оберіть відповідального')}
              required
              searchValue={userSearchValue}
              value={form.responsibleUserNetUid || null}
              onChange={(value) =>
                dispatchPageState({
                  form: { ...form, responsibleUserNetUid: value || '' },
                })
              }
              onSearchChange={setUserSearchValue}
            />
            <Select
              data={organizationOptions}
              disabled={isLoading || isSaving || isEditMode}
              label={t('Організація')}
              placeholder={t('Оберіть організацію')}
              required
              value={form.organizationNetUid || null}
              onChange={(value) =>
                dispatchPageState({
                  form: { ...form, organizationNetUid: value || '' },
                })
              }
            />
          </Stack>
        </form>
    </AppDrawer>
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

function createInitialPageState(isLoading: boolean): ConsumableStorageFormPageState {
  return {
    error: null,
    form: createEmptyForm(),
    isLoading,
    organizations: [],
    storage: createEmptyStorage(),
    users: [],
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
