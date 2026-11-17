import { useBusyState } from '../../../shared/hooks/useBusyState'
import {
  Alert,
  Button,
  Card,
  Group,
  Loader,
  Stack,
  Text,
} from '@mantine/core'
import { AppModal, AppModalFooter } from '../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR } from "../../../shared/ui/page-header-actions/PageHeaderActions"
import { notifications } from '@mantine/notifications'
import { CircleAlert, Save } from 'lucide-react'
import { type FormEvent, useEffect, useRef } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useLocation, useNavigate } from 'react-router-dom'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { PermissionGate } from '../../auth/components/PermissionGate'
import { useAuth } from '../../auth/useAuth'
import { createUser, getUserRolesForCreate } from '../api/usersApi'
import { UserForm } from '../components/UserForm'
import type { UserProfile, UserRole } from '../types'
import {
  createEmptyUserProfile,
  getIdentityResponseError,
  getUserProfileFieldError,
  getUserSaveErrorMessage,
  normalizeUserForSave,
  type UserFieldError,
} from '../utils'

type UserNewRouteState = {
  returnPath?: string
}

const USER_NEW_MONO_STYLE = { fontFamily: 'var(--font-mono)', letterSpacing: 0 } as const

export function UserNewPage() {
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
        permissionKey={PermissionKeys.Users.User.Create}
        fallback={
          <Alert color="red" icon={<CircleAlert size={18} />} title={t('Доступ заборонено')} variant="light">
            {t('Недостатньо прав для створення користувача')}
          </Alert>
        }
      >
        <UserNewPageContent />
      </PermissionGate>
    </PermissionGate>
  )
}

function UserNewPageContent() {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const routeState = location.state as UserNewRouteState | null
  const returnPath = routeState?.returnPath || '/users'
  const [user, setUser] = useValueState<UserProfile>(() => createEmptyUserProfile())
  const [roles, setRoles] = useValueState<UserRole[]>([])
  const [password, setPassword] = useValueState('')
  const [confirmPassword, setConfirmPassword] = useValueState('')
  const [error, setError] = useValueState<string | null>(null)
  const [fieldError, setFieldError] = useValueState<UserFieldError | null>(null)
  const [isLoadingRoles, setLoadingRoles] = useValueState(true)
  const [isSaving, setSaving, tryStartSaving] = useBusyState()
  const saveControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadRoles() {
      setLoadingRoles(true)
      setError(null)

      try {
        const nextRoles = await getUserRolesForCreate()

        if (!cancelled) {
          setRoles(nextRoles)
        }
      } catch (loadError) {
        if (!cancelled) {
          setRoles([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити ролі'))
        }
      } finally {
        if (!cancelled) {
          setLoadingRoles(false)
        }
      }
    }

    void loadRoles()

    return () => {
      cancelled = true
    }
  }, [setError, setLoadingRoles, setRoles, t])

  function setField<K extends keyof UserProfile>(key: K, value: UserProfile[K]) {
    setFieldError((current) => (current?.field === key ? null : current))
    setUser((currentUser) => ({
      ...currentUser,
      [key]: value,
    }))
  }

  function setPasswordField(field: 'password' | 'confirmPassword', value: string) {
    setFieldError((current) => (current?.field === 'password' || current?.field === 'confirmPassword' ? null : current))
    if (field === 'password') {
      setPassword(value)
      return
    }

    setConfirmPassword(value)
  }

  function closeSheet() {
    // Cancel always works: a pending create is aborted.
    saveControllerRef.current?.abort()
    saveControllerRef.current = null
    navigate(returnPath, { replace: true })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!hasPermission(PermissionKeys.Users.User.Create)) {
      setError(t('Недостатньо прав для створення користувача'))
      return
    }

    const payload = normalizeUserForSave(user)
    // По батькові is optional (same rule as edit); a message goes under its field, not into a browser tooltip.
    const validationError = getUserProfileFieldError(payload, {
      confirmPassword,
      password,
      requirePassword: true,
    })

    setFieldError(validationError)
    if (validationError) {
      return
    }

    if (!tryStartSaving()) {
      return
    }
    setError(null)
    const controller = new AbortController()
    saveControllerRef.current = controller

    try {
      const response = await createUser(payload, password, controller.signal)
      const responseError = getIdentityResponseError(response)

      if (response?.Succeeded === false || responseError) {
        throw new Error(responseError || t('Не вдалося створити користувача'))
      }

      if (controller.signal.aborted) {
        return
      }

      notifications.show({
        color: 'green',
        message: t('Користувача створено'),
      })
      // The busy lock stays taken after success: the sheet is closing, and releasing it would let
      // a fast extra click submit the same user again before the navigation unmounts the form.
      navigate(returnPath, { replace: true, state: { mutated: true } })
    } catch (saveError) {
      if (!controller.signal.aborted) {
        setError(getUserSaveErrorMessage(saveError, t('Не вдалося створити користувача')))
        setSaving(false)
      }
    } finally {
      if (saveControllerRef.current === controller) {
        saveControllerRef.current = null
      }
    }
  }

  return (
    <AppModal className="app-compact-form"
      opened
      closeOnClickOutside={!isSaving}
      keepMounted={false}
      size={800}
      title={<span style={USER_NEW_MONO_STYLE}>{t('Новий користувач')}</span>}
      onClose={closeSheet}

    >
      <Stack gap={10}>
        {error && (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <form autoComplete="off" id="user-new-form" noValidate onSubmit={handleSubmit}>
          <Card className="app-section-card" withBorder radius="md" padding={12}>
            <Stack gap={10}>
              <Text className="app-section-title" fw={600}>
                {t('Дані користувача')}
              </Text>
              <UserForm
                confirmPassword={confirmPassword}
                disabled={isSaving || isLoadingRoles}
                fieldError={fieldError}
                includePassword
                password={password}
                roles={roles}
                user={user}
                onFieldChange={setField}
                onPasswordChange={setPasswordField}
              />

              {isLoadingRoles && (
                <Group gap="xs">
                  <Loader color="orange" size="xs" />
                  <Text c="dimmed" size="sm">
                    {t('Завантаження ролей')}
                  </Text>
                </Group>
              )}
            </Stack>
          </Card>
        </form>
      </Stack>
      <AppModalFooter>
          <Button
            color="gray"
            styles={{ label: USER_NEW_MONO_STYLE }}
            variant="default"
            onClick={closeSheet}
          >
            {t('Скасувати')}
          </Button>
          <Button
            color={CREATE_ACTION_COLOR}
            form="user-new-form"
            leftSection={<Save size={16} />}
            loading={isSaving}
            styles={{ label: USER_NEW_MONO_STYLE }}
            type="submit"
          >
            {t('Створити')}
          </Button>
        </AppModalFooter>
    </AppModal>
  )
}
