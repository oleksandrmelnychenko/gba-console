import { Alert, Button, Card, Group, SimpleGrid, Stack, Text, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconArrowLeft, IconDeviceFloppy } from '@tabler/icons-react'
import { type FormEvent, useEffect } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useAuth } from '../../auth/useAuth'
import { createCurrencyTrader, getCurrencyTrader, updateCurrencyTrader } from '../api/currencyConvertorsApi'
import { CURRENCY_CONVERTOR_CREATE_PERMISSION, CURRENCY_CONVERTOR_EDIT_PERMISSION } from '../permissions'
import type { CurrencyTrader, CurrencyTraderPayload } from '../types'

type LocationState = {
  returnPath?: string
}

type CurrencyTraderFormState = {
  firstName: string
  lastName: string
  middleName: string
  phoneNumber: string
}

const CONVERTORS_PATH = '/accounting/currency-convertors'

export function CurrencyConvertorFormPage() {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const { id } = useParams<{ id?: string }>()
  const routeLocation = useLocation()
  const navigate = useNavigate()
  const locationState = routeLocation.state as LocationState | null
  const returnPath = locationState?.returnPath || CONVERTORS_PATH
  const isEditMode = Boolean(id)
  const [trader, setTrader] = useValueState<CurrencyTrader>(() => createEmptyTrader())
  const [form, setForm] = useValueState<CurrencyTraderFormState>(() => createEmptyForm())
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(isEditMode)
  const [isSaving, setSaving] = useValueState(false)
  const canSave = hasPermission(isEditMode ? CURRENCY_CONVERTOR_EDIT_PERMISSION : CURRENCY_CONVERTOR_CREATE_PERMISSION)

  useEffect(() => {
    if (!id) {
      return
    }

    const controller = new AbortController()

    async function loadTrader() {
      setLoading(true)
      setError(null)

      try {
        const nextTrader = await getCurrencyTrader(id as string)

        if (controller.signal.aborted) {
          return
        }

        const initialTrader = nextTrader || createEmptyTrader()
        setTrader(initialTrader)
        setForm(toFormState(initialTrader))
      } catch (loadError) {
        if (!isAbortError(loadError)) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити валютного трейдера'))
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadTrader()

    return () => controller.abort()
  }, [id, setError, setForm, setLoading, setTrader, t])

  if (isEditMode && !id) {
    return <Navigate replace to={CONVERTORS_PATH} />
  }

  function updateForm(patch: Partial<CurrencyTraderFormState>) {
    setForm((current) => ({ ...current, ...patch }))
  }

  function handleCancel() {
    if (isSaving) {
      return
    }

    navigate(returnPath, { replace: true })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canSave) {
      setError(t('Немає прав для збереження валютного трейдера'))
      return
    }

    const payload = toPayload(trader, form)
    setSaving(true)
    setError(null)

    try {
      const saved = isEditMode ? await updateCurrencyTrader(payload) : await createCurrencyTrader(payload)
      setTrader(saved || payload)
      notifications.show({
        color: 'green',
        message: isEditMode ? t('Валютного трейдера оновлено') : t('Валютного трейдера створено'),
      })
      navigate(returnPath, { replace: true })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти валютного трейдера'))
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
              <Text fw={700} size="xl">
                {isEditMode ? t('Редагування валютного трейдера') : t('Створення валютного трейдера')}
              </Text>
              <Group gap="xs">
                <Button
                  color="gray"
                  leftSection={<IconArrowLeft size={16} />}
                  type="button"
                  variant="light"
                  onClick={handleCancel}
                >
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
                {t('Немає прав для збереження валютного трейдера')}
              </Alert>
            )}

            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <TextInput
                disabled={isLoading || isSaving}
                label={t("Ім'я")}
                value={form.firstName}
                onChange={(event) => updateForm({ firstName: event.currentTarget.value })}
              />
              <TextInput
                disabled={isLoading || isSaving}
                label={t('Прізвище')}
                value={form.lastName}
                onChange={(event) => updateForm({ lastName: event.currentTarget.value })}
              />
              <TextInput
                disabled={isLoading || isSaving}
                label={t('По батькові')}
                value={form.middleName}
                onChange={(event) => updateForm({ middleName: event.currentTarget.value })}
              />
              <TextInput
                disabled={isLoading || isSaving}
                label={t('Телефон')}
                value={form.phoneNumber}
                onChange={(event) => updateForm({ phoneNumber: event.currentTarget.value })}
              />
            </SimpleGrid>
          </Stack>
        </form>
      </Card>
    </Stack>
  )
}

function createEmptyTrader(): CurrencyTrader {
  return {
    CurrencyTraderExchangeRates: [],
  }
}

function createEmptyForm(): CurrencyTraderFormState {
  return {
    firstName: '',
    lastName: '',
    middleName: '',
    phoneNumber: '',
  }
}

function toFormState(trader: CurrencyTrader): CurrencyTraderFormState {
  return {
    firstName: trader.FirstName || '',
    lastName: trader.LastName || '',
    middleName: trader.MiddleName || '',
    phoneNumber: trader.PhoneNumber || '',
  }
}

function toPayload(trader: CurrencyTrader, form: CurrencyTraderFormState): CurrencyTraderPayload {
  return {
    ...trader,
    CurrencyTraderExchangeRates: trader.CurrencyTraderExchangeRates || [],
    FirstName: form.firstName.trim(),
    LastName: form.lastName.trim(),
    MiddleName: form.middleName.trim(),
    PhoneNumber: form.phoneNumber.trim(),
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
