import { useBusyState } from '../../../shared/hooks/useBusyState'
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
import { AppModal, AppModalFooter } from "../../../shared/ui/AppModal"
import { CREATE_ACTION_COLOR } from "../../../shared/ui/page-header-actions/PageHeaderActions"
import { notifications } from '@mantine/notifications'
import { Check, CircleAlert, Key, Save, Trash2, UserRound } from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../../shared/api/apiClient'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { PermissionGate } from '../../auth/components/PermissionGate'
import { useAuth } from '../../auth/useAuth'
import {
  deleteUser,
  getUser,
  getUserRolesForEdit,
  resetUserPassword,
  updateUser,
} from '../api/usersApi'
import { UserForm } from '../components/UserForm'
import type { UserProfile, UserRole } from '../types'
import {
  getIdentityResponseError,
  getUserFullName,
  getUserSaveErrorMessage,
  normalizeUserForSave,
  validatePasswordPair,
  validateUserProfile,
} from '../utils'
import './user-edit-page.css'

type UserEditRouteState = {
  returnPath?: string
}

type UserEditTab = 'profile' | 'password'

type PasswordField = 'password' | 'confirmPassword'
type PasswordFieldError = { field: PasswordField; message: string }

type UserFieldChangeHandler = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => void
type UserEditStatus = {
  isDeleting: boolean
  isLoading: boolean
  isResettingPassword: boolean
  isSaving: boolean
}

export function UserEditPage() {
  const { t } = useI18n()

  return (
    <PermissionGate
      permissionKey={PermissionKeys.SystemPages.Users.View}
      fallback={
        <Alert color="red" icon={<CircleAlert size={18} />} title={t('Доступ заборонено')} variant="light">
          {t('Недостатньо прав для перегляду користувачів')}
        </Alert>
      }
    >
      <PermissionGate
        permissionKey={PermissionKeys.Users.User.OpenDetails}
        fallback={
          <Alert color="red" icon={<CircleAlert size={18} />} title={t('Доступ заборонено')} variant="light">
            {t('Недостатньо прав для відкриття користувача')}
          </Alert>
        }
      >
        <UserEditPageContent />
      </PermissionGate>
    </PermissionGate>
  )
}

function UserEditPageContent() {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const { netid } = useParams<{ netid?: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  // Set after a save or password reset so the users list reloads when this sheet closes.
  const hasMutatedRef = useRef(false)
  const routeState = location.state as UserEditRouteState | null
  const returnPath = routeState?.returnPath || '/users'
  const [user, setUser] = useValueState<UserProfile | null>(null)
  // The profile as last loaded or saved: the sheet asks before dropping edits made since.
  const [savedUser, setSavedUser] = useValueState<UserProfile | null>(null)
  const [roles, setRoles] = useValueState<UserRole[]>([])
  const [password, setPassword] = useValueState('')
  const [confirmPassword, setConfirmPassword] = useValueState('')
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isSaving, setSaving, tryStartSaving] = useBusyState()
  const [isDeleting, setDeleting, tryStartDeleting] = useBusyState()
  const [isResettingPassword, setResettingPassword, tryStartResettingPassword] = useBusyState()
  const [deleteModalOpened, setDeleteModalOpened] = useValueState(false)
  const [confirmCloseOpened, setConfirmCloseOpened] = useValueState(false)
  const [passwordFieldError, setPasswordFieldError] = useValueState<PasswordFieldError | null>(null)
  const [activeTab, setActiveTab] = useState<UserEditTab>('profile')
  const saveControllerRef = useRef<AbortController | null>(null)
  const canEdit = hasPermission(PermissionKeys.Users.User.Edit)
  const canDelete = hasPermission(PermissionKeys.Users.User.Delete)
  const canResetPassword = hasPermission(PermissionKeys.Users.User.ResetPassword)

  useEffect(() => {
    let cancelled = false

    async function loadUser() {
      if (!netid) {
        return
      }

      setLoading(true)
      setError(null)

      try {
        const [nextUser, nextRoles] = await Promise.all([
          getUser(netid),
          canEdit ? getUserRolesForEdit() : Promise.resolve([]),
        ])

        if (!cancelled) {
          setUser(nextUser)
          setSavedUser(nextUser)
          setRoles(nextRoles)
        }
      } catch (loadError) {
        if (!cancelled) {
          setUser(null)
          setRoles([])
          // An unknown user (400/404 'User not found') is shown only by the Ukrainian not-found card below.
          setError(isUserNotFoundError(loadError)
            ? null
            : loadError instanceof Error ? loadError.message : t('Не вдалося завантажити користувача'))
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
  }, [canEdit, netid, setError, setLoading, setRoles, setSavedUser, setUser, t])

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
    if (isDeleting || isResettingPassword) {
      return
    }

    // Cancel always works while a profile save is pending: the request is aborted.
    saveControllerRef.current?.abort()
    saveControllerRef.current = null
    navigate(returnPath, { replace: true, state: { mutated: hasMutatedRef.current } })
  }

  const hasUnsavedChanges =
    (canEdit && user !== null && savedUser !== null && JSON.stringify(user) !== JSON.stringify(savedUser)) ||
    password !== '' ||
    confirmPassword !== ''

  // Escape, the close button, a click outside and Скасувати ask before dropping unsaved edits.
  function requestClose() {
    if (isDeleting || isResettingPassword) {
      return
    }

    if (!isSaving && hasUnsavedChanges) {
      // Deferred: opened synchronously from the sheet's Escape handler, the confirmation would
      // register its own Escape listener while the same keydown is still dispatching and close at once.
      window.setTimeout(() => setConfirmCloseOpened(true), 0)
      return
    }

    closeSheet()
  }

  function changePassword(field: PasswordField, value: string) {
    if (field === 'password') setPassword(value)
    else setConfirmPassword(value)
    setPasswordFieldError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canEdit) {
      setError(t('Недостатньо прав для редагування користувача'))
      return
    }

    if (!user) {
      return
    }

    const payload = normalizeUserForSave(user)
    const validationError = validateUserProfile(payload)

    if (validationError) {
      setError(validationError)
      return
    }

    if (!tryStartSaving()) {
      return
    }
    setError(null)
    const controller = new AbortController()
    saveControllerRef.current = controller

    try {
      const updatedUser = await updateUser(payload, controller.signal)
      if (controller.signal.aborted) {
        return
      }
      setUser(updatedUser || payload)
      setSavedUser(updatedUser || payload)
      hasMutatedRef.current = true
      notifications.show({
        color: 'green',
        message: t('Користувача збережено'),
      })
    } catch (saveError) {
      if (!controller.signal.aborted) {
        setError(getUserSaveErrorMessage(saveError, t('Не вдалося зберегти користувача')))
      }
    } finally {
      if (saveControllerRef.current === controller) {
        saveControllerRef.current = null
      }
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!canDelete) {
      setError(t('Недостатньо прав для видалення користувача'))
      return
    }

    if (!user?.NetUid) {
      return
    }

    if (!tryStartDeleting()) {
      return
    }
    setError(null)

    try {
      await deleteUser(user.NetUid)
      notifications.show({
        color: 'green',
        message: t('Користувача видалено'),
      })
      navigate(returnPath, { replace: true, state: { mutated: true } })
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t('Не вдалося видалити користувача'))
    } finally {
      setDeleting(false)
      setDeleteModalOpened(false)
    }
  }

  async function handlePasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canResetPassword) {
      setError(t('Недостатньо прав для зміни пароля користувача'))
      return
    }

    if (!netid) {
      return
    }

    const validationError = validatePasswordPair(password, confirmPassword)

    if (validationError) {
      // The message is attached to the field it is about (aria-invalid + text under the input).
      setPasswordFieldError({ field: getInvalidPasswordField(password, confirmPassword), message: validationError })
      return
    }
    setPasswordFieldError(null)

    if (!tryStartResettingPassword()) {
      return
    }
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
    <AppModal className="app-compact-form"
      opened
      // A nested confirmation owns Escape / outside clicks while it is open.
      closeOnClickOutside={!isSaving && !isDeleting && !isResettingPassword && !deleteModalOpened && !confirmCloseOpened}
      closeOnEscape={!deleteModalOpened && !confirmCloseOpened}
      keepMounted={false}
      size={780}
      aria-label={user ? getUserFullName(user) : t('Користувач')}
      title={
        <span style={{ fontFamily: 'var(--font-mono)', letterSpacing: 0 }}>
          {user ? `${t('Редагування користувача')} · ${getUserFullName(user)}` : t('Редагування користувача')}
        </span>
      }
      onClose={requestClose}
    >
      <Stack className="user-sheet" gap={10}>
        {error && (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <UserEditContent
          activeTab={activeTab}
          canEdit={canEdit}
          canResetPassword={canResetPassword}
          confirmPassword={confirmPassword}
          password={password}
          passwordFieldError={passwordFieldError}
          roles={roles}
          status={{
            isDeleting,
            isLoading,
            isResettingPassword,
            isSaving,
          }}
          user={user}
          onChangeConfirmPassword={(value) => changePassword('confirmPassword', value)}
          onChangePassword={(value) => changePassword('password', value)}
          onChangeTab={setActiveTab}
          onFieldChange={setField}
          onPasswordReset={handlePasswordReset}
          onSubmit={handleSubmit}
        />

        {canDelete && (
          <DeleteUserModal
            isDeleting={isDeleting}
            opened={deleteModalOpened}
            user={user}
            onClose={() => setDeleteModalOpened(false)}
            onDelete={handleDelete}
          />
        )}

        <AppModal
          centered
          opened={confirmCloseOpened}
          title={t('Є незбережені зміни')}
          onClose={() => setConfirmCloseOpened(false)}
        >
          <Stack gap={10}>
            <Text size="sm">{t('Якщо закрити вікно, зміни користувача не будуть збережені.')}</Text>
            <AppModalFooter>
              <Button variant="default" color="gray" onClick={() => setConfirmCloseOpened(false)}>
                {t('Залишитися')}
              </Button>
              <Button
                color="red"
                onClick={() => {
                  setConfirmCloseOpened(false)
                  closeSheet()
                }}
              >
                {t('Закрити без збереження')}
              </Button>
            </AppModalFooter>
          </Stack>
        </AppModal>
      </Stack>
      <AppModalFooter>
        <Button color="gray" variant="default" disabled={isDeleting || isResettingPassword} onClick={requestClose}>{t('Скасувати')}</Button>
        <UserEditActions
          canDelete={canDelete}
          // The password tab has its own primary action (Змінити пароль); the profile Зберегти is shown only on the profile tab.
          canEdit={canEdit && activeTab === 'profile'}
          isDeleting={isDeleting}
          isSaving={isSaving}
          user={user}
          onDelete={() => setDeleteModalOpened(true)}
        />
      </AppModalFooter>
    </AppModal>
  )
}

function UserEditActions({
  canDelete,
  canEdit,
  isDeleting,
  isSaving,
  user,
  onDelete,
}: {
  canDelete: boolean
  canEdit: boolean
  isDeleting: boolean
  isSaving: boolean
  user: UserProfile | null
  onDelete: () => void
}) {
  const { t } = useI18n()

  return (
    <Group gap="xs">
      {canDelete && (
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
      )}
      {canEdit && (
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
      )}
    </Group>
  )
}

function UserEditContent({
  activeTab,
  canEdit,
  canResetPassword,
  confirmPassword,
  password,
  passwordFieldError,
  roles,
  status,
  user,
  onChangeConfirmPassword,
  onChangePassword,
  onChangeTab: setActiveTab,
  onFieldChange,
  onPasswordReset,
  onSubmit,
}: {
  activeTab: UserEditTab
  canEdit: boolean
  canResetPassword: boolean
  confirmPassword: string
  password: string
  passwordFieldError: PasswordFieldError | null
  roles: UserRole[]
  status: UserEditStatus
  user: UserProfile | null
  onChangeConfirmPassword: (value: string) => void
  onChangePassword: (value: string) => void
  onChangeTab: (tab: UserEditTab) => void
  onFieldChange: UserFieldChangeHandler
  onPasswordReset: (event: FormEvent<HTMLFormElement>) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const { t } = useI18n()

  if (status.isLoading) {
    return (
      <Card withBorder radius="md" padding={12}>
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
      <Card withBorder radius="md" padding={12}>
        <Text c="dimmed">{t('Користувача не знайдено')}</Text>
      </Card>
    )
  }

  return (
    <div>
      <div className="pill-tabs user-edit-tabs">
        <button
          type="button"
          className={`pill-tab${activeTab === 'profile' ? ' is-active' : ''}`}
          aria-pressed={activeTab === 'profile'}
          onClick={() => setActiveTab('profile')}
        >
          <UserRound size={16} aria-hidden="true" />
          {t('Загальна інформація')}
        </button>
        {canResetPassword && (
          <button
            type="button"
            className={`pill-tab${activeTab === 'password' ? ' is-active' : ''}`}
            aria-pressed={activeTab === 'password'}
            onClick={() => setActiveTab('password')}
          >
            <Key size={16} aria-hidden="true" />
            {t('Зміна пароля')}
          </button>
        )}
      </div>

      {activeTab === 'profile' && (
        <Box pt={10}>
          <form id="user-edit-form" onSubmit={onSubmit}>
            <div className="user-sheet-card">
              <div className="user-sheet-card-head">
                <span className="user-sheet-card-dot" aria-hidden="true" />
                {t('Профіль')}
              </div>
              <div className="user-sheet-card-body">
                <UserForm
                  disabled={!canEdit || status.isSaving || status.isDeleting}
                  middleNameRequired={false}
                  roles={roles}
                  user={user}
                  onFieldChange={onFieldChange}
                />
              </div>
            </div>
          </form>
        </Box>
      )}

      {canResetPassword && activeTab === 'password' && (
        <Box pt={10}>
          <UserPasswordPanel
            confirmPassword={confirmPassword}
            isResettingPassword={status.isResettingPassword}
            password={password}
            passwordFieldError={passwordFieldError}
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
  passwordFieldError,
  onChangeConfirmPassword,
  onChangePassword,
  onSubmit,
}: {
  confirmPassword: string
  isResettingPassword: boolean
  password: string
  passwordFieldError: PasswordFieldError | null
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
          <Stack gap={10}>
            <Group grow align="end">
            <PasswordInput
              disabled={!isPasswordChangeEnabled || isResettingPassword}
              label={t('Новий пароль')}
              placeholder="*** *** ***"
              required
              error={passwordFieldError?.field === 'password' ? passwordFieldError.message : undefined}
              aria-invalid={passwordFieldError?.field === 'password' || undefined}
              value={password}
              onChange={(event) => onChangePassword(event.currentTarget.value)}
            />
            <PasswordInput
              disabled={!isPasswordChangeEnabled || isResettingPassword}
              label={t('Підтвердження пароля')}
              placeholder="*** *** ***"
              required
              error={passwordFieldError?.field === 'confirmPassword' ? passwordFieldError.message : undefined}
              aria-invalid={passwordFieldError?.field === 'confirmPassword' || undefined}
              value={confirmPassword}
              onChange={(event) => onChangeConfirmPassword(event.currentTarget.value)}
            />
          </Group>
          <Checkbox
            checked={isPasswordChangeEnabled}
            description={isPasswordChangeEnabled ? undefined : t('Поставте позначку, щоб розблокувати поля пароля')}
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
      <Stack gap={10}>
        <Text size="sm">{t('Підтвердити видалення')}: {user ? getUserFullName(user) : ''}</Text>
        <AppModalFooter>
          <Button variant="default" color="gray" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button color="red" leftSection={<Check size={16} />} loading={isDeleting} onClick={onDelete}>
            {t('Видалити')}
          </Button>
        </AppModalFooter>
      </Stack>
    </AppModal>
  )
}

function getInvalidPasswordField(password: string, confirmPassword: string): PasswordField {
  if (!password) return 'password'
  if (!confirmPassword || password !== confirmPassword) return 'confirmPassword'
  return 'password'
}

function isUserNotFoundError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 400)
}
