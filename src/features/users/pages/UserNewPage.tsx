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
import { CREATE_ACTION_COLOR } from "../../../shared/ui/page-header-actions/PageHeaderActions"
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconDeviceFloppy } from '@tabler/icons-react'
import { type FormEvent, useEffect } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useLocation, useNavigate } from 'react-router-dom'
import { createUser, getUserRoles } from '../api/usersApi'
import { UserForm } from '../components/UserForm'
import type { UserProfile, UserRole } from '../types'
import {
  createEmptyUserProfile,
  getIdentityResponseError,
  normalizeUserForSave,
  validateUserProfile,
} from '../utils'

type UserNewRouteState = {
  returnPath?: string
}

const USER_NEW_MONO_STYLE = { fontFamily: 'var(--font-mono)', letterSpacing: 0 } as const

export function UserNewPage() {
  const { t } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()
  const routeState = location.state as UserNewRouteState | null
  const returnPath = routeState?.returnPath || '/users'
  const [user, setUser] = useValueState<UserProfile>(() => createEmptyUserProfile())
  const [roles, setRoles] = useValueState<UserRole[]>([])
  const [password, setPassword] = useValueState('')
  const [confirmPassword, setConfirmPassword] = useValueState('')
  const [error, setError] = useValueState<string | null>(null)
  const [isLoadingRoles, setLoadingRoles] = useValueState(true)
  const [isSaving, setSaving] = useValueState(false)

  useEffect(() => {
    let cancelled = false

    async function loadRoles() {
      setLoadingRoles(true)
      setError(null)

      try {
        const nextRoles = await getUserRoles()

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
    setUser((currentUser) => ({
      ...currentUser,
      [key]: value,
    }))
  }

  function setPasswordField(field: 'password' | 'confirmPassword', value: string) {
    if (field === 'password') {
      setPassword(value)
      return
    }

    setConfirmPassword(value)
  }

  function closeSheet() {
    if (isSaving) {
      return
    }

    navigate(returnPath, { replace: true })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const payload = normalizeUserForSave(user)
    const validationError = validateUserProfile(payload, {
      confirmPassword,
      password,
      requirePassword: true,
    })

    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError(null)

    try {
      const response = await createUser(payload, password)
      const responseError = getIdentityResponseError(response)

      if (response?.Succeeded === false || responseError) {
        throw new Error(responseError || t('Не вдалося створити користувача'))
      }

      notifications.show({
        color: 'green',
        message: t('Користувача створено'),
      })
      navigate(returnPath, { replace: true })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося створити користувача'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppDrawer
      opened
      closeOnClickOutside={!isSaving}
      keepMounted={false}
      position="right"
      size="standard"
      title={<span style={USER_NEW_MONO_STYLE}>{t('Новий користувач')}</span>}
      onClose={closeSheet}
      footer={
        <Group gap="xs" justify="flex-end">
          <Button
            color="gray"
            disabled={isSaving}
            styles={{ label: USER_NEW_MONO_STYLE }}
            variant="subtle"
            onClick={closeSheet}
          >
            {t('Скасувати')}
          </Button>
          <Button
            color={CREATE_ACTION_COLOR}
            form="user-new-form"
            leftSection={<IconDeviceFloppy size={16} />}
            loading={isSaving}
            styles={{ label: USER_NEW_MONO_STYLE }}
            type="submit"
          >
            {t('Створити')}
          </Button>
        </Group>
      }
    >
      <Stack gap="md">
        {error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <form id="user-new-form" onSubmit={handleSubmit}>
          <Card className="app-section-card" withBorder radius="md" padding="md">
            <Stack gap="md">
              <Text className="app-section-title" fw={600}>
                {t('Дані користувача')}
              </Text>
              <UserForm
                confirmPassword={confirmPassword}
                disabled={isSaving || isLoadingRoles}
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
    </AppDrawer>
  )
}
