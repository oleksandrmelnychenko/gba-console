import { Alert, Button, Card, Group, SimpleGrid, Stack, Text, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconArrowLeft, IconDeviceFloppy } from '@tabler/icons-react'
import { type FormEvent, useEffect, useReducer } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
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

type CurrencyTraderFormPageState = {
  error: string | null
  form: CurrencyTraderFormState
  isLoading: boolean
  trader: CurrencyTrader
}

type CurrencyTraderFormPageAction =
  | { type: 'failed'; error: string }
  | { type: 'loaded'; form: CurrencyTraderFormState; trader: CurrencyTrader }
  | { type: 'patch-form'; patch: Partial<CurrencyTraderFormState> }
  | { type: 'set-error'; error: string | null }
  | { type: 'set-trader'; trader: CurrencyTrader }
  | { type: 'start-loading' }

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
  const [pageState, dispatchPageState] = useReducer(
    currencyTraderFormPageReducer,
    isEditMode,
    createCurrencyTraderFormPageState,
  )
  const { error, form, isLoading, trader } = pageState
  const [isSaving, setSaving] = useValueState(false)
  const canSave = hasPermission(isEditMode ? CURRENCY_CONVERTOR_EDIT_PERMISSION : CURRENCY_CONVERTOR_CREATE_PERMISSION)

  useEffect(() => {
    if (!id) {
      return
    }

    const controller = new AbortController()
    dispatchPageState({ type: 'start-loading' })

    void getCurrencyTrader(id)
      .then((nextTrader) => {
        if (controller.signal.aborted) {
          return
        }

        const initialTrader = nextTrader || createEmptyTrader()
        dispatchPageState({
          form: toFormState(initialTrader),
          trader: initialTrader,
          type: 'loaded',
        })
      })
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted && !isAbortError(loadError)) {
          dispatchPageState({
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити валютного трейдера'),
            type: 'failed',
          })
        }
      })

    return () => controller.abort()
  }, [id, t])

  if (isEditMode && !id) {
    return <Navigate replace to={CONVERTORS_PATH} />
  }

  function updateForm(patch: Partial<CurrencyTraderFormState>) {
    dispatchPageState({ patch, type: 'patch-form' })
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
      dispatchPageState({ error: t('Немає прав для збереження валютного трейдера'), type: 'set-error' })
      return
    }

    const payload = toPayload(trader, form)
    setSaving(true)
    dispatchPageState({ error: null, type: 'set-error' })

    try {
      const saved = isEditMode ? await updateCurrencyTrader(payload) : await createCurrencyTrader(payload)
      dispatchPageState({ trader: saved || payload, type: 'set-trader' })
      notifications.show({
        color: 'green',
        message: isEditMode ? t('Валютного трейдера оновлено') : t('Валютного трейдера створено'),
      })
      navigate(returnPath, { replace: true })
    } catch (saveError) {
      dispatchPageState({
        error: saveError instanceof Error ? saveError.message : t('Не вдалося зберегти валютного трейдера'),
        type: 'set-error',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppDrawer opened position="right" size="standard" onClose={handleCancel}>
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
    </AppDrawer>
  )
}

function createCurrencyTraderFormPageState(isEditMode: boolean): CurrencyTraderFormPageState {
  return {
    error: null,
    form: createEmptyForm(),
    isLoading: isEditMode,
    trader: createEmptyTrader(),
  }
}

function currencyTraderFormPageReducer(
  state: CurrencyTraderFormPageState,
  action: CurrencyTraderFormPageAction,
): CurrencyTraderFormPageState {
  switch (action.type) {
    case 'failed':
      return {
        ...state,
        error: action.error,
        isLoading: false,
      }
    case 'loaded':
      return {
        error: null,
        form: action.form,
        isLoading: false,
        trader: action.trader,
      }
    case 'patch-form':
      return {
        ...state,
        form: {
          ...state.form,
          ...action.patch,
        },
      }
    case 'set-error':
      return {
        ...state,
        error: action.error,
      }
    case 'set-trader':
      return {
        ...state,
        trader: action.trader,
      }
    case 'start-loading':
      return {
        ...state,
        error: null,
        isLoading: true,
      }
    default:
      return state
  }
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
