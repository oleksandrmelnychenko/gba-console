import { useBusyState } from '../../shared/hooks/useBusyState'
import { Alert, Button, PasswordInput, Stack, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { ArrowRight, CircleAlert } from 'lucide-react'
import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import logoUrl from '../../assets/brand/gba-logo.svg'
import { useAuth } from '../../features/auth/useAuth'
import { useI18n } from '../../shared/i18n/useI18n'
import './login.css'

export function LoginPage() {
  const { isAuthenticated, isLoading, login } = useAuth()
  const { t } = useI18n()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setSubmitting, tryStartSubmitting] = useBusyState()
  const [passwordVisible, setPasswordVisible] = useState(false)
  const form = useForm({
    initialValues: { username: '', password: '' },
    validate: {
      username: value => value.trim() ? null : t('Вкажіть логін'),
      password: value => value ? null : t('Вкажіть пароль'),
    },
  })

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <main className="login-page">
      <div className="login-content">
        <header className="login-brand">
          <img className="login-logo" src={logoUrl} alt="GBA" width={128} height={128} />
          <p className="login-brand-caption">Global Business Assistant</p>
        </header>

        <section className="login-card" aria-labelledby="login-title">
          <div className="login-heading">
            <h1 id="login-title">{t('Вхід у систему')}</h1>
            <p>{t('Введіть логін і пароль, щоб розпочати роботу.')}</p>
          </div>

          <form
            aria-label={t('Вхід у систему')}
            aria-busy={isSubmitting}
            onSubmit={form.onSubmit(async values => {
              if (isSubmitting || isLoading) return
              setError(null)
              if (!tryStartSubmitting()) {
                return
              }
              try {
                await login(values.username.trim(), values.password)
              } catch (loginError) {
                setError(loginError instanceof Error ? loginError.message : t('Не вдалося увійти'))
              } finally {
                setSubmitting(false)
              }
            })}
          >
            <Stack gap={14}>
              <TextInput
                aria-label={t('Логін')}
                placeholder={t('Електронна пошта або телефон')}
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                disabled={isSubmitting}
                aria-required="true"
                {...form.getInputProps('username')}
              />
              <PasswordInput
                aria-label={t('Пароль')}
                placeholder={t('Пароль')}
                name="password"
                autoComplete="current-password"
                disabled={isSubmitting}
                visibilityToggleFocusable
                visible={passwordVisible}
                onVisibilityChange={setPasswordVisible}
                visibilityToggleButtonProps={{ 'aria-label': t(passwordVisible ? 'Приховати пароль' : 'Показати пароль') }}
                aria-required="true"
                {...form.getInputProps('password')}
              />
              {error && (
                <Alert className="login-alert" role="alert" color="red" variant="light" icon={<CircleAlert size={18} />}>
                  {error}
                </Alert>
              )}
              <Button
                className="login-submit"
                type="submit"
                color="dark"
                fullWidth
                loading={isSubmitting}
                disabled={isLoading}
                rightSection={<ArrowRight size={20} strokeWidth={1.7} aria-hidden="true" />}
              >
                {t('Увійти')}
              </Button>
            </Stack>
          </form>

          <div className="login-help">
            <p>{t('Потрібен доступ?')}</p>
            <span>{t('Зверніться до адміністратора вашої команди.')}</span>
          </div>
        </section>
      </div>
    </main>
  )
}
