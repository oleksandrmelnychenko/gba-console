import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  Group,
  Loader,
  PasswordInput,
  Stack,
  Text,
} from '@mantine/core'
import { AppDrawer } from "../../../shared/ui/AppDrawer"
import { AppModal } from "../../../shared/ui/AppModal"
import { CREATE_ACTION_COLOR } from "../../../shared/ui/page-header-actions/PageHeaderActions"
import { notifications } from '@mantine/notifications'
import { Check, CircleAlert, Key, Save, Trash2 } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  deleteUser,
  getUser,
  getUserRoles,
  resetUserPassword,
  updateUser,
} from '../api/usersApi'
import { UserForm } from '../components/UserForm'
import type { UserProfile, UserRole } from '../types'
import {
  getIdentityResponseError,
  getUserFullName,
  normalizeUserForSave,
  validatePasswordPair,
  validateUserProfile,
} from '../utils'
import './user-edit-page.css'

type UserEditRouteState = {
  returnPath?: string
}

type UserFieldChangeHandler = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => void
type UserEditStatus = {
  isDeleting: boolean
  isLoading: boolean
  isResettingPassword: boolean
  isSaving: boolean
}

export function UserEditPage() {
  const { t } = useI18n()
  const { netid } = useParams<{ netid?: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const routeState = location.state as UserEditRouteState | null
  const returnPath = routeState?.returnPath || '/users'
  const [user, setUser] = useValueState<UserProfile | null>(null)
  const [roles, setRoles] = useValueState<UserRole[]>([])
  const [password, setPassword] = useValueState('')
  const [confirmPassword, setConfirmPassword] = useValueState('')
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isSaving, setSaving] = useValueState(false)
  const [isDeleting, setDeleting] = useValueState(false)
  const [isResettingPassword, setResettingPassword] = useValueState(false)
  const [deleteModalOpened, setDeleteModalOpened] = useValueState(false)

  useEffect(() => {
    let cancelled = false

    async function loadUser() {
      if (!netid) {
        return
      }

      setLoading(true)
      setError(null)

      try {
        const [nextUser, nextRoles] = await Promise.all([getUser(netid), getUserRoles()])

        if (!cancelled) {
          setUser(nextUser)
          setRoles(nextRoles)
        }
      } catch (loadError) {
        if (!cancelled) {
          setUser(null)
          setRoles([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити користувача'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadUser()

    return () => {
      cancelled = true
    }
  }, [netid, setError, setLoading, setRoles, setUser, t])

  if (!netid) {
    return <Navigate to="/users" replace />
  }

  function setField<K extends keyof UserProfile>(key: K, value: UserProfile[K]) {
    setUser((currentUser) =>
      currentUser
        ? {
            ...currentUser,
            [key]: value,
          }
        : currentUser,
    )
  }

  function closeSheet() {
    if (isSaving || isDeleting || isResettingPassword) {
      return
    }

    navigate(returnPath, { replace: true })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!user) {
      return
    }

    const payload = normalizeUserForSave(user)
    const validationError = validateUserProfile(payload)

    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError(null)

    try {
      const updatedUser = await updateUser(payload)
      setUser(updatedUser || payload)
      notifications.show({
        color: 'green',
        message: t('Користувача збережено'),
      })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти користувача'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!user?.NetUid) {
      return
    }

    setDeleting(true)
    setError(null)

    try {
      await deleteUser(user.NetUid)
      notifications.show({
        color: 'green',
        message: t('Користувача видалено'),
      })
      navigate(returnPath, { replace: true })
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t('Не вдалося видалити користувача'))
    } finally {
      setDeleting(false)
      setDeleteModalOpened(false)
    }
  }

  async function handlePasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!netid) {
      return
    }

    const validationError = validatePasswordPair(password, confirmPassword)

    if (validationError) {
      setError(validationError)
      return
    }

    setResettingPassword(true)
    setError(null)

    try {
      const response = await resetUserPassword(netid, password)
      const responseError = getIdentityResponseError(response)

      if (response?.Succeeded === false || responseError) {
        throw new Error(responseError || t('Не вдалося змінити пароль'))
      }

      setPassword('')
      setConfirmPassword('')
      notifications.show({
        color: 'green',
        message: t('Пароль змінено'),
      })
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : t('Не вдалося змінити пароль'))
    } finally {
      setResettingPassword(false)
    }
  }

  return (
    <AppDrawer
      opened
      closeOnClickOutside={!isSaving && !isDeleting && !isResettingPassword}
      keepMounted={false}
      position="right"
      size="min(780px, 100vw)"
      aria-label={user ? getUserFullName(user) : t('Користувач')}
      onClose={closeSheet}
      footer={
        <UserEditActions
          isDeleting={isDeleting}
          isSaving={isSaving}
          user={user}
          onDelete={() => setDeleteModalOpened(true)}
        />
      }
    >
      <Stack className="user-sheet" gap="md">
        {error && (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <UserEditContent
          confirmPassword={confirmPassword}
          password={password}
          roles={roles}
          status={{
            isDeleting,
            isLoading,
            isResettingPassword,
            isSaving,
          }}
          user={user}
          onChangeConfirmPassword={setConfirmPassword}
          onChangePassword={setPassword}
          onFieldChange={setField}
          onPasswordReset={handlePasswordReset}
          onSubmit={handleSubmit}
        />

        <DeleteUserModal
          isDeleting={isDeleting}
          opened={deleteModalOpened}
          user={user}
          onClose={() => setDeleteModalOpened(false)}
          onDelete={handleDelete}
        />
      </Stack>
    </AppDrawer>
  )
}

function UserEditActions({
  isDeleting,
  isSaving,
  user,
  onDelete,
}: {
  isDeleting: boolean
  isSaving: boolean
  user: UserProfile | null
  onDelete: () => void
}) {
  const { t } = useI18n()

  return (
    <Group gap="xs">
      <Button
        color="red"
        disabled={!user}
        leftSection={<Trash2 size={16} />}
        loading={isDeleting}
        variant="light"
        onClick={onDelete}
      >
        {t('Видалити')}
      </Button>
      <Button
        color={CREATE_ACTION_COLOR}
        disabled={!user}
        form="user-edit-form"
        leftSection={<Save size={16} />}
        loading={isSaving}
        type="submit"
      >
        {t('Зберегти')}
      </Button>
    </Group>
  )
}

function UserEditContent({
  confirmPassword,
  password,
  roles,
  status,
  user,
  onChangeConfirmPassword,
  onChangePassword,
  onFieldChange,
  onPasswordReset,
  onSubmit,
}: {
  confirmPassword: string
  password: string
  roles: UserRole[]
  status: UserEditStatus
  user: UserProfile | null
  onChangeConfirmPassword: (value: string) => void
  onChangePassword: (value: string) => void
  onFieldChange: UserFieldChangeHandler
  onPasswordReset: (event: FormEvent<HTMLFormElement>) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile')

  if (status.isLoading) {
    return (
      <Card withBorder radius="md" padding="lg">
        <Group justify="center" py="xl">
          <Loader color="orange" size="sm" />
          <Text c="dimmed" size="sm">
            {t('Завантаження користувача')}
          </Text>
        </Group>
      </Card>
    )
  }

  if (!user) {
    return (
      <Card withBorder radius="md" padding="lg">
        <Text c="dimmed">{t('Користувача не знайдено')}</Text>
      </Card>
    )
  }

  return (
    <div>
      <div className="pill-tabs" style={{ width: 'fit-content' }}>
        <button
          type="button"
          className={`pill-tab${activeTab === 'profile' ? ' is-active' : ''}`}
          aria-pressed={activeTab === 'profile'}
          onClick={() => setActiveTab('profile')}
        >
          {t('Загальна інформація')}
        </button>
        <button
          type="button"
          className={`pill-tab${activeTab === 'password' ? ' is-active' : ''}`}
          aria-pressed={activeTab === 'password'}
          onClick={() => setActiveTab('password')}
        >
          <Key size={15} strokeWidth={1.8} style={{ marginRight: 6, verticalAlign: '-2px' }} />
          {t('Зміна пароля')}
        </button>
      </div>

      {activeTab === 'profile' && (
        <Box pt="md">
          <form id="user-edit-form" onSubmit={onSubmit}>
            <div className="user-sheet-card">
              <div className="user-sheet-card-head">
                <span className="user-sheet-card-dot" aria-hidden="true" />
                {t('Профіль')}
              </div>
              <div className="user-sheet-card-body">
                <UserForm
                  disabled={status.isSaving || status.isDeleting}
                  roles={roles}
                  user={user}
                  onFieldChange={onFieldChange}
                />
              </div>
            </div>
          </form>
        </Box>
      )}

      {activeTab === 'password' && (
        <Box pt="md">
          <UserPasswordPanel
            confirmPassword={confirmPassword}
            isResettingPassword={status.isResettingPassword}
            password={password}
            onChangeConfirmPassword={onChangeConfirmPassword}
            onChangePassword={onChangePassword}
            onSubmit={onPasswordReset}
          />
        </Box>
      )}
    </div>
  )
}

function UserPasswordPanel({
  confirmPassword,
  isResettingPassword,
  password,
  onChangeConfirmPassword,
  onChangePassword,
  onSubmit,
}: {
  confirmPassword: string
  isResettingPassword: boolean
  password: string
  onChangeConfirmPassword: (value: string) => void
  onChangePassword: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const { t } = useI18n()
  const [isPasswordChangeEnabled, setPasswordChangeEnabled] = useState(false)

  return (
    <form onSubmit={onSubmit}>
      <div className="user-sheet-card">
        <div className="user-sheet-card-head">
          <span className="user-sheet-card-dot" aria-hidden="true" />
          {t('Безпека')}
        </div>
        <div className="user-sheet-card-body">
          <Stack gap="md">
            <Group grow align="end">
            <PasswordInput
              disabled={!isPasswordChangeEnabled || isResettingPassword}
              label={t('Новий пароль')}
              placeholder="*** *** ***"
              required
              value={password}
              onChange={(event) => onChangePassword(event.currentTarget.value)}
            />
            <PasswordInput
              disabled={!isPasswordChangeEnabled || isResettingPassword}
              label={t('Підтвердження пароля')}
              placeholder="*** *** ***"
              required
              value={confirmPassword}
              onChange={(event) => onChangeConfirmPassword(event.currentTarget.value)}
            />
          </Group>
          <Checkbox
            checked={isPasswordChangeEnabled}
            disabled={isResettingPassword}
            label={t('Дозволити зміну пароля?')}
            onChange={(event) => setPasswordChangeEnabled(event.currentTarget.checked)}
          />
          {isPasswordChangeEnabled && (
            <Group justify="flex-end">
              <Button
                color={CREATE_ACTION_COLOR}
                leftSection={<Key size={16} />}
                loading={isResettingPassword}
                type="submit"
              >
                {t('Змінити пароль')}
              </Button>
            </Group>
            )}
          </Stack>
        </div>
      </div>
    </form>
  )
}

function DeleteUserModal({
  isDeleting,
  opened,
  user,
  onClose,
  onDelete,
}: {
  isDeleting: boolean
  opened: boolean
  user: UserProfile | null
  onClose: () => void
  onDelete: () => void
}) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={opened} title={t('Видалити користувача')} onClose={onClose}>
      <Stack gap="md">
        <Text size="sm">{t('Підтвердити видалення')}: {user ? getUserFullName(user) : ''}</Text>
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button color="red" leftSection={<Check size={16} />} loading={isDeleting} onClick={onDelete}>
            {t('Видалити')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}
