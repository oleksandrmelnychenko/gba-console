import {
  Alert,
  Button,
  Group,
  Select,
  SimpleGrid,
  Stack,
  TextInput,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconDeviceFloppy, IconTrash } from '@tabler/icons-react'
import { type FormEvent, useEffect, useMemo } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
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
  const [companyCar, setCompanyCar] = useValueState<CompanyCar>(() => createEmptyCompanyCar())
  const [form, setForm] = useValueState<CompanyCarFormState>(() => createEmptyForm())
  const [organizations, setOrganizations] = useValueState<Organization[]>([])
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isSaving, setSaving] = useValueState(false)
  const [isDeleting, setDeleting] = useValueState(false)
  const canSave = hasPermission(COMPANY_CAR_CREATE_PERMISSION)

  useEffect(() => {
    const controller = new AbortController()

    async function loadResources() {
      setLoading(true)
      setError(null)

      try {
        const [nextOrganizations, nextCompanyCar] = await Promise.all([
          getCompanyCarOrganizations(),
          id ? getCompanyCar(id) : Promise.resolve(null),
        ])

        if (controller.signal.aborted) {
          return
        }

        const initialCompanyCar = nextCompanyCar || createEmptyCompanyCar()
        const initialOrganization = initialCompanyCar.Organization || null
        setOrganizations(includeEntity(nextOrganizations, initialOrganization))
        setCompanyCar(initialCompanyCar)
        setForm(toFormState(initialCompanyCar, initialOrganization))
      } catch (loadError) {
        if (!isAbortError(loadError)) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити автомобіль компанії'))
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadResources()

    return () => controller.abort()
  }, [id, setCompanyCar, setError, setForm, setLoading, setOrganizations, t])

  const organizationOptions = useMemo(
    () => toSelectOptions(organizations, (organization) => organization.Name || organization.FullName),
    [organizations],
  )
  const selectedOrganization = useMemo(
    () => organizations.find((organization) => getEntityValue(organization) === form.organizationNetUid) || null,
    [form.organizationNetUid, organizations],
  )

  function handleCancel() {
    if (isSaving || isDeleting) {
      return
    }

    navigate(returnPath, { replace: true })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canSave) {
      setError(t('Немає прав для збереження автомобіля компанії'))
      return
    }

    const mileage = parseDecimal(form.mileage)
    const fuelAmount = parseDecimal(form.fuelAmount)
    const tankCapacity = parseDecimal(form.tankCapacity)

    if (!fuelAmount) {
      setError(t('Введіть кількість пального'))
      return
    }

    if (!mileage) {
      setError(t('Введіть пробіг'))
      return
    }

    if (tankCapacity > 0 && tankCapacity < fuelAmount) {
      setError(t('Вміст баку менший ніж кількість топлива'))
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
    setError(null)

    try {
      const savedCompanyCar = isEditMode ? await updateCompanyCar(payload) : await createCompanyCar(payload)

      setCompanyCar(savedCompanyCar || payload)
      notifications.show({
        color: 'green',
        message: isEditMode ? t('Автомобіль компанії оновлено') : t('Автомобіль компанії створено'),
      })
      navigate(returnPath, { replace: true })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти автомобіль компанії'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!companyCar.NetUid) {
      return
    }

    setDeleting(true)
    setError(null)

    try {
      await deleteCompanyCar(companyCar.NetUid)
      notifications.show({ color: 'green', message: t('Автомобіль компанії видалено') })
      navigate(returnPath, { replace: true })
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t('Не вдалося видалити автомобіль компанії'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AppDrawer
      opened
      closeOnClickOutside={!isSaving && !isDeleting}
      keepMounted={false}
      padding="lg"
      position="right"
      size="min(720px, 100vw)"
      title={isEditMode ? t('Автомобіль компанії') : t('Завести нову машину компанії')}
      onClose={handleCancel}
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
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
              onChange={(value) => setForm((current) => ({ ...current, organizationNetUid: value || '' }))}
            />

            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                disabled={isLoading || isSaving}
                label={t('Марка автомобіля')}
                value={form.carBrand}
                onChange={(event) => setForm((current) => ({ ...current, carBrand: event.currentTarget.value }))}
              />
              <TextInput
                disabled={isLoading || isSaving}
                label={t('№ Авто')}
                value={form.licensePlate}
                onChange={(event) => setForm((current) => ({ ...current, licensePlate: event.currentTarget.value }))}
              />
              <TextInput
                disabled={isLoading || isSaving}
                label={t('Вмістимість баку')}
                value={form.tankCapacity}
                onChange={(event) => setForm((current) => ({ ...current, tankCapacity: event.currentTarget.value }))}
              />
              <TextInput
                disabled={isLoading || isSaving}
                label={t('Кількість пального')}
                value={form.fuelAmount}
                onChange={(event) => setForm((current) => ({ ...current, fuelAmount: event.currentTarget.value }))}
              />
              <TextInput
                disabled={isLoading || isSaving}
                label={t('Показники одометра')}
                value={form.mileage}
                onChange={(event) => setForm((current) => ({ ...current, mileage: event.currentTarget.value }))}
              />
              <TextInput
                disabled={isLoading || isSaving}
                label={t('Розхід по місту на 100 км')}
                value={form.inCityConsumption}
                onChange={(event) => setForm((current) => ({ ...current, inCityConsumption: event.currentTarget.value }))}
              />
              <TextInput
                disabled={isLoading || isSaving}
                label={t('Розхід по трасі на 100 км')}
                value={form.outsideCityConsumption}
                onChange={(event) => setForm((current) => ({ ...current, outsideCityConsumption: event.currentTarget.value }))}
              />
              <TextInput
                disabled={isLoading || isSaving}
                label={t('Змішаний розхід')}
                value={form.mixedModeConsumption}
                onChange={(event) => setForm((current) => ({ ...current, mixedModeConsumption: event.currentTarget.value }))}
              />
            </SimpleGrid>

            <Group justify="flex-end" gap="xs">
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
        </Stack>
      </form>
    </AppDrawer>
  )
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
