import {
  Alert,
  Box,
  Button,
  Card,
  Group,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconAlertCircle } from '@tabler/icons-react'
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
  const [isSubmitting, setSubmitting] = useState(false)
  const form = useForm({
    initialValues: {
      username: '',
      password: '',
    },
  })

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <Box className="login-page">
      <Card withBorder radius="md" shadow="sm" p="xl" className="login-card">
        <Stack gap="lg">
          <Group gap="sm" align="center" wrap="nowrap">
            <Box className="login-logo-mark">
              <img src={logoUrl} alt="GBA" />
            </Box>
            <Box>
              <Title order={1} size="h2">
                GBA CONSOLE
              </Title>
              <Text size="sm" fw={600} c="gray.7" className="login-subtitle">
                {t('Вхід у систему')}
              </Text>
            </Box>
          </Group>

          {error && (
            <Alert
              key={error}
              className="login-alert"
              color="red"
              variant="light"
              icon={<IconAlertCircle size={18} />}
              title={t('Перевірте дані')}
            >
              {error}
            </Alert>
          )}

          <form
            onSubmit={form.onSubmit(async (values) => {
              setError(null)

              if (!values.username.trim() || !values.password) {
                setError(t('Вкажіть логін і пароль'))
                return
              }

              setSubmitting(true)

              try {
                await login(values.username, values.password)
              } catch (loginError) {
                setError(loginError instanceof Error ? loginError.message : t('Не вдалося увійти'))
              } finally {
                setSubmitting(false)
              }
            })}
          >
            <Stack gap="md">
              <TextInput
                label={t('Логін')}
                placeholder={t('ел. пошта або телефон')}
                autoFocus
                {...form.getInputProps('username')}
              />
              <PasswordInput label={t('Пароль')} placeholder={t('пароль')} {...form.getInputProps('password')} />
              <Button type="submit" color="violet" loading={isSubmitting} mt="xs">
                {t('Увійти')}
              </Button>
            </Stack>
          </form>
        </Stack>
      </Card>
    </Box>
  )
}
