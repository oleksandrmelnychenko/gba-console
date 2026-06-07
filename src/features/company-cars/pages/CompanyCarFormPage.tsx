import {
  Alert,
  Button,
  Card,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconArrowLeft, IconDeviceFloppy, IconTrash } from '@tabler/icons-react'
import { type FormEvent, useEffect, useMemo, useReducer } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useAuth } from '../../auth/useAuth'
import {
  createCompanyCar,
  deleteCompanyCar,
  getCompanyCar,
  getCompanyCarOrganizations,
  updateCompanyCar,
} from '../api/companyCarsApi'
import { COMPANY_CAR_CREATE_PERMISSION } from '../permissions'
import type { CompanyCar, CompanyCarPayload, Organization } from '../types'

type LocationState = {
  returnPath?: string
}

type CompanyCarFormState = {
  carBrand: string
  fuelAmount: string
  inCityConsumption: string
  licensePlate: string
  mileage: string
  mixedModeConsumption: string
  organizationNetUid: string
  outsideCityConsumption: string
  tankCapacity: string
}

type CompanyCarFormPageState = {
  companyCar: CompanyCar
  error: string | null
  form: CompanyCarFormState
  isLoading: boolean
  organizations: Organization[]
}

type CompanyCarFormPageAction =
  | { type: 'failed'; error: string }
  | { type: 'loaded'; companyCar: CompanyCar; form: CompanyCarFormState; organizations: Organization[] }
  | { type: 'patch-form'; patch: Partial<CompanyCarFormState> }
  | { type: 'set-company-car'; companyCar: CompanyCar }
  | { type: 'set-error'; error: string | null }
  | { type: 'start-loading' }

const COMPANY_CARS_PATH = '/accounting/company-cars'

export function CompanyCarFormPage() {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const { id } = useParams<{ id?: string }>()
  const routeLocation = useLocation()
  const navigate = useNavigate()
  const locationState = routeLocation.state as LocationState | null
  const returnPath = locationState?.returnPath || COMPANY_CARS_PATH
  const isEditMode = Boolean(id)
  const [pageState, dispatchPageState] = useReducer(companyCarFormPageReducer, undefined, createCompanyCarFormPageState)
  const { companyCar, error, form, isLoading, organizations } = pageState
  const [isSaving, setSaving] = useValueState(false)
  const [isDeleting, setDeleting] = useValueState(false)
  const canSave = isEditMode || hasPermission(COMPANY_CAR_CREATE_PERMISSION)

  useEffect(() => {
    const controller = new AbortController()
    dispatchPageState({ type: 'start-loading' })

    void Promise.all([
      getCompanyCarOrganizations(),
      id ? getCompanyCar(id) : Promise.resolve(null),
    ])
      .then(([nextOrganizations, nextCompanyCar]) => {
        if (controller.signal.aborted) {
          return
        }

        const initialCompanyCar = nextCompanyCar || createEmptyCompanyCar()
        const initialOrganization = initialCompanyCar.Organization || null
        dispatchPageState({
          companyCar: initialCompanyCar,
          form: toFormState(initialCompanyCar, initialOrganization),
          organizations: includeEntity(nextOrganizations, initialOrganization),
          type: 'loaded',
        })
      })
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted && !isAbortError(loadError)) {
          dispatchPageState({
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити автомобіль компанії'),
            type: 'failed',
          })
        }
      })

    return () => controller.abort()
  }, [id, t])

  const organizationOptions = useMemo(
    () => toSelectOptions(organizations, (organization) => organization.Name || organization.FullName),
    [organizations],
  )
  const selectedOrganization = useMemo(
    () => organizations.find((organization) => getEntityValue(organization) === form.organizationNetUid) || null,
    [form.organizationNetUid, organizations],
  )

  function updateForm(patch: Partial<CompanyCarFormState>) {
    dispatchPageState({ patch, type: 'patch-form' })
  }

  function handleCancel() {
    if (isSaving || isDeleting) {
      return
    }

    navigate(returnPath, { replace: true })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canSave) {
      dispatchPageState({ error: t('Немає прав для збереження автомобіля компанії'), type: 'set-error' })
      return
    }

    const mileage = parseDecimal(form.mileage)
    const fuelAmount = parseDecimal(form.fuelAmount)
    const tankCapacity = parseDecimal(form.tankCapacity)

    if (!fuelAmount) {
      dispatchPageState({ error: t('Введіть кількість пального'), type: 'set-error' })
      return
    }

    if (!mileage) {
      dispatchPageState({ error: t('Введіть пробіг'), type: 'set-error' })
      return
    }

    if (tankCapacity > 0 && tankCapacity < fuelAmount) {
      dispatchPageState({ error: t('Вміст баку менший ніж кількість топлива'), type: 'set-error' })
      return
    }

    const payload: CompanyCarPayload = {
      ...companyCar,
      CarBrand: form.carBrand,
      FuelAmount: fuelAmount,
      InCityConsumption: parseDecimal(form.inCityConsumption),
      LicensePlate: form.licensePlate,
      Mileage: mileage,
      MixedModeConsumption: parseDecimal(form.mixedModeConsumption),
      Organization: selectedOrganization,
      OutsideCityConsumption: parseDecimal(form.outsideCityConsumption),
      TankCapacity: tankCapacity,
    }

    setSaving(true)
    dispatchPageState({ error: null, type: 'set-error' })

    try {
      const savedCompanyCar = isEditMode ? await updateCompanyCar(payload) : await createCompanyCar(payload)

      dispatchPageState({ companyCar: savedCompanyCar || payload, type: 'set-company-car' })
      notifications.show({
        color: 'green',
        message: isEditMode ? t('Автомобіль компанії оновлено') : t('Автомобіль компанії створено'),
      })
      navigate(returnPath, { replace: true })
    } catch (saveError) {
      dispatchPageState({
        error: saveError instanceof Error ? saveError.message : t('Не вдалося зберегти автомобіль компанії'),
        type: 'set-error',
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!companyCar.NetUid) {
      return
    }

    setDeleting(true)
    dispatchPageState({ error: null, type: 'set-error' })

    try {
      await deleteCompanyCar(companyCar.NetUid)
      notifications.show({ color: 'green', message: t('Автомобіль компанії видалено') })
      navigate(returnPath, { replace: true })
    } catch (deleteError) {
      dispatchPageState({
        error: deleteError instanceof Error ? deleteError.message : t('Не вдалося видалити автомобіль компанії'),
        type: 'set-error',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Stack gap="md">
      <Card withBorder radius="md" shadow="sm">
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <Group justify="space-between" wrap="wrap">
              <Text fw={700} size="xl">
                {isEditMode ? t('Автомобіль компанії') : t('Завести нову машину компанії')}
              </Text>

              <Group gap="xs">
                <Button color="gray" leftSection={<IconArrowLeft size={16} />} type="button" variant="light" onClick={handleCancel}>
                  {t('Назад')}
                </Button>
                {isEditMode && (
                  <Button
                    color="red"
                    disabled={isLoading || !companyCar.NetUid}
                    leftSection={<IconTrash size={16} />}
                    loading={isDeleting}
                    type="button"
                    variant="light"
                    onClick={handleDelete}
                  >
                    {t('Видалити')}
                  </Button>
                )}
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
                {t('Немає прав для збереження автомобіля компанії')}
              </Alert>
            )}

            <Select
              clearable
              searchable
              data={organizationOptions}
              disabled={isLoading || isSaving}
              label={t('Організація')}
              placeholder={t('Оберіть організацію')}
              value={form.organizationNetUid || null}
              onChange={(value) => updateForm({ organizationNetUid: value || '' })}
            />

            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                disabled={isLoading || isSaving}
                label={t('Марка автомобіля')}
                value={form.carBrand}
                onChange={(event) => updateForm({ carBrand: event.currentTarget.value })}
              />
              <TextInput
                disabled={isLoading || isSaving}
                label={t('№ Авто')}
                value={form.licensePlate}
                onChange={(event) => updateForm({ licensePlate: event.currentTarget.value })}
              />
              <TextInput
                disabled={isLoading || isSaving}
                label={t('Вмістимість баку')}
                value={form.tankCapacity}
                onChange={(event) => updateForm({ tankCapacity: event.currentTarget.value })}
              />
              <TextInput
                disabled={isLoading || isSaving}
                label={t('Кількість пального')}
                value={form.fuelAmount}
                onChange={(event) => updateForm({ fuelAmount: event.currentTarget.value })}
              />
              <TextInput
                disabled={isLoading || isSaving}
                label={t('Показники одометра')}
                value={form.mileage}
                onChange={(event) => updateForm({ mileage: event.currentTarget.value })}
              />
              <TextInput
                disabled={isLoading || isSaving}
                label={t('Розхід по місту на 100 км')}
                value={form.inCityConsumption}
                onChange={(event) => updateForm({ inCityConsumption: event.currentTarget.value })}
              />
              <TextInput
                disabled={isLoading || isSaving}
                label={t('Розхід по трасі на 100 км')}
                value={form.outsideCityConsumption}
                onChange={(event) => updateForm({ outsideCityConsumption: event.currentTarget.value })}
              />
              <TextInput
                disabled={isLoading || isSaving}
                label={t('Змішаний розхід')}
                value={form.mixedModeConsumption}
                onChange={(event) => updateForm({ mixedModeConsumption: event.currentTarget.value })}
              />
            </SimpleGrid>
          </Stack>
        </form>
      </Card>
    </Stack>
  )
}

function createCompanyCarFormPageState(): CompanyCarFormPageState {
  return {
    companyCar: createEmptyCompanyCar(),
    error: null,
    form: createEmptyForm(),
    isLoading: true,
    organizations: [],
  }
}

function companyCarFormPageReducer(
  state: CompanyCarFormPageState,
  action: CompanyCarFormPageAction,
): CompanyCarFormPageState {
  switch (action.type) {
    case 'failed':
      return {
        ...state,
        error: action.error,
        isLoading: false,
      }
    case 'loaded':
      return {
        companyCar: action.companyCar,
        error: null,
        form: action.form,
        isLoading: false,
        organizations: action.organizations,
      }
    case 'patch-form':
      return {
        ...state,
        form: {
          ...state.form,
          ...action.patch,
        },
      }
    case 'set-company-car':
      return {
        ...state,
        companyCar: action.companyCar,
      }
    case 'set-error':
      return {
        ...state,
        error: action.error,
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

function createEmptyCompanyCar(): CompanyCar {
  return {
    CompanyCarFuelings: [],
    CompanyCarRoadLists: [],
    FuelAmount: 0,
    InCityConsumption: 0,
    InitialMileage: 0,
    Mileage: 0,
    MixedModeConsumption: 0,
    OutsideCityConsumption: 0,
    TankCapacity: 0,
  }
}

function createEmptyForm(): CompanyCarFormState {
  return {
    carBrand: '',
    fuelAmount: '',
    inCityConsumption: '',
    licensePlate: '',
    mileage: '',
    mixedModeConsumption: '',
    organizationNetUid: '',
    outsideCityConsumption: '',
    tankCapacity: '',
  }
}

function toFormState(companyCar: CompanyCar, organization: Organization | null): CompanyCarFormState {
  return {
    carBrand: companyCar.CarBrand || '',
    fuelAmount: formatField(companyCar.FuelAmount),
    inCityConsumption: formatField(companyCar.InCityConsumption),
    licensePlate: companyCar.LicensePlate || '',
    mileage: formatField(companyCar.Mileage),
    mixedModeConsumption: formatField(companyCar.MixedModeConsumption),
    organizationNetUid: getEntityValue(organization) || '',
    outsideCityConsumption: formatField(companyCar.OutsideCityConsumption),
    tankCapacity: formatField(companyCar.TankCapacity),
  }
}

function formatField(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) && value !== 0 ? String(value) : ''
}

function parseDecimal(value: string): number {
  const parsed = parseFloat(value.replace(/,/g, '.'))

  return Number.isFinite(parsed) ? parsed : 0
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

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
