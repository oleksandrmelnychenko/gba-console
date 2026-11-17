import { useBusyState } from '../../../shared/hooks/useBusyState'
import {
  Alert,
  Button,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { CircleAlert, Save, Trash2 } from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useReducer, useRef } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { DocumentDetailChip, DocumentDetailLayout, DocumentDetailSummary, DocumentDetailMetric, DocumentDetailSection } from '../../../shared/ui/document-detail/DocumentDetail'
import './company-car-form-page.css'
import { AppModal, AppModalFooter } from '../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useAuth } from '../../auth/useAuth'
import { PermissionGate } from '../../auth/components/PermissionGate'
import { ApiError } from '../../../shared/api/apiClient'
import { isRecordGuid } from '../../../shared/guid/isRecordGuid'
import { DiscardChangesModal } from '../../../shared/ui/DiscardChangesModal'
import {
  COMPANY_CAR_LIMITS,
  formatCarMetric,
  parseCarNumber,
  validateCompanyCarForm,
} from '../companyCarFormValidation'
import {
  createCompanyCar,
  deleteCompanyCar,
  getCompanyCarForEdit,
  getCompanyCarOrganizations,
  updateCompanyCar,
} from '../api/companyCarsApi'
import {
  COMPANY_CAR_CREATE_PERMISSION,
  COMPANY_CAR_DELETE_PERMISSION,
  COMPANY_CAR_EDIT_PERMISSION,
} from '../permissions'
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
  isNotFound: boolean
  organizations: Organization[]
  showRequired: boolean
}

type CompanyCarFormPageAction =
  | { type: 'failed'; error: string }
  | { type: 'not-found' }
  | { type: 'show-required' }
  | { type: 'loaded'; companyCar: CompanyCar; form: CompanyCarFormState; organizations: Organization[] }
  | { type: 'patch-form'; patch: Partial<CompanyCarFormState> }
  | { type: 'set-company-car'; companyCar: CompanyCar }
  | { type: 'set-error'; error: string | null }
  | { type: 'start-loading' }

const COMPANY_CARS_PATH = '/accounting/company-cars'

export function CompanyCarFormPage() {
  const { id } = useParams<{ id?: string }>()
  const permissionKey = id ? COMPANY_CAR_EDIT_PERMISSION : COMPANY_CAR_CREATE_PERMISSION

  return (
    <PermissionGate permissionKey={permissionKey} fallback={<CompanyCarFormPermissionDenied />}>
      <CompanyCarFormPageContent />
    </PermissionGate>
  )
}

function CompanyCarFormPermissionDenied() {
  const { t } = useI18n()

  return (
    <Alert color="red" icon={<CircleAlert size={18} />} title={t('Доступ заборонено')} variant="light">
      {t('У вашої ролі немає права на цю дію з автомобілем компанії.')}
    </Alert>
  )
}

function CompanyCarFormPageContent() {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const { id } = useParams<{ id?: string }>()
  const routeLocation = useLocation()
  const navigate = useNavigate()
  const locationState = routeLocation.state as LocationState | null
  const returnPath = locationState?.returnPath || COMPANY_CARS_PATH
  const isEditMode = Boolean(id)
  const [pageState, dispatchPageState] = useReducer(companyCarFormPageReducer, undefined, createCompanyCarFormPageState)
  const { companyCar, error, form, isLoading, isNotFound, organizations, showRequired } = pageState
  const [isSaving, setSaving, tryStartSaving] = useBusyState()
  const [isDeleting, setDeleting, tryStartDeleting] = useBusyState()
  const [deleteModalOpened, setDeleteModalOpened] = useValueState(false)
  const canSave = hasPermission(isEditMode ? COMPANY_CAR_EDIT_PERMISSION : COMPANY_CAR_CREATE_PERMISSION)
  const canDelete = isEditMode && hasPermission(COMPANY_CAR_DELETE_PERMISSION)
  const [discardOpened, setDiscardOpened] = useValueState(false)
  const firstFieldRef = useRef<HTMLInputElement>(null)

  /* Марка takes the dialog's initial focus (data-autofocus; read-only, not disabled, while loading). */
  useEffect(() => {
    if (!isLoading && document.activeElement !== firstFieldRef.current) {
      firstFieldRef.current?.focus()
    }
  }, [isLoading])

  useEffect(() => {
    const controller = new AbortController()

    if (id !== undefined && !isRecordGuid(id)) {
      dispatchPageState({ type: 'not-found' })
      return () => controller.abort()
    }

    dispatchPageState({ type: 'start-loading' })

    void Promise.all([
      getCompanyCarOrganizations(),
      id ? getCompanyCarForEdit(id).catch(nullWhenNotFound) : Promise.resolve(null),
    ])
      .then(([nextOrganizations, nextCompanyCar]) => {
        if (controller.signal.aborted) {
          return
        }

        if (id && !nextCompanyCar?.NetUid && !nextCompanyCar?.Id) {
          dispatchPageState({ type: 'not-found' })
          return
        }

        const initialCompanyCar = nextCompanyCar || createEmptyCompanyCar()
        /* A single organisation is preselected; the field is required either way. */
        const initialOrganization = initialCompanyCar.Organization
          || (!id && nextOrganizations.length === 1 ? nextOrganizations[0] : null)
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

  const fieldErrors = useMemo(() => validateCompanyCarForm(form, t, showRequired), [form, showRequired, t])

  function updateForm(patch: Partial<CompanyCarFormState>) {
    dispatchPageState({ patch, type: 'patch-form' })
  }

  const loadedForm = useMemo(() => toFormState(companyCar, companyCar.Organization || null), [companyCar])
  const hasUnsavedInput = !isLoading && !isNotFound && (Object.keys(loadedForm) as Array<keyof CompanyCarFormState>)
    .some((key) => (key !== 'organizationNetUid' || isEditMode) && form[key] !== loadedForm[key])

  function closeForm() {
    navigate(returnPath, { replace: true })
  }

  function handleCancel() {
    if (isSaving || isDeleting) {
      return
    }

    if (hasUnsavedInput) {
      setDiscardOpened(true)
      return
    }

    closeForm()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const savePermission = isEditMode ? COMPANY_CAR_EDIT_PERMISSION : COMPANY_CAR_CREATE_PERMISSION
    if (!hasPermission(savePermission)) {
      dispatchPageState({ error: t('Немає прав для збереження автомобіля компанії'), type: 'set-error' })
      return
    }

    const submitErrors = validateCompanyCarForm(form, t, true)

    if (Object.keys(submitErrors).length > 0 || !selectedOrganization) {
      dispatchPageState({ type: 'show-required' })
      dispatchPageState({ error: t('Перевірте виділені поля'), type: 'set-error' })
      return
    }

    const payload: CompanyCarPayload = {
      ...companyCar,
      CarBrand: form.carBrand.trim(),
      FuelAmount: readNumber(form.fuelAmount),
      InCityConsumption: readNumber(form.inCityConsumption),
      LicensePlate: form.licensePlate.trim(),
      Mileage: readNumber(form.mileage),
      MixedModeConsumption: readNumber(form.mixedModeConsumption),
      Organization: selectedOrganization,
      OutsideCityConsumption: readNumber(form.outsideCityConsumption),
      TankCapacity: readNumber(form.tankCapacity),
    }

    if (!tryStartSaving()) {
      return
    }
    dispatchPageState({ error: null, type: 'set-error' })

    try {
      const savedCompanyCar = isEditMode ? await updateCompanyCar(payload) : await createCompanyCar(payload)

      dispatchPageState({ companyCar: savedCompanyCar || payload, type: 'set-company-car' })
      notifications.show({
        color: 'green',
        message: isEditMode ? t('Автомобіль компанії оновлено') : t('Автомобіль компанії створено'),
      })
      /* The lock stays on after success: the dialog is still mounted while
         the route changes and must not save the car a second time. */
      navigate(returnPath, { replace: true, state: { mutated: true } })
    } catch (saveError) {
      setSaving(false)
      dispatchPageState({
        error: saveError instanceof Error ? saveError.message : t('Не вдалося зберегти автомобіль компанії'),
        type: 'set-error',
      })
    }
  }

  async function handleDelete() {
    if (!hasPermission(COMPANY_CAR_DELETE_PERMISSION)) {
      dispatchPageState({ error: t('Немає прав для видалення автомобіля компанії'), type: 'set-error' })
      return
    }

    if (!companyCar.NetUid) {
      return
    }

    if (!tryStartDeleting()) {
      return
    }
    dispatchPageState({ error: null, type: 'set-error' })

    try {
      await deleteCompanyCar(companyCar.NetUid)
      notifications.show({ color: 'green', message: t('Автомобіль компанії видалено') })
      navigate(returnPath, { replace: true, state: { mutated: true } })
    } catch (deleteError) {
      dispatchPageState({
        error: deleteError instanceof Error ? deleteError.message : t('Не вдалося видалити автомобіль компанії'),
        type: 'set-error',
      })
    } finally {
      setDeleting(false)
    }
  }

  if (isNotFound) {
    return (
      <AppModal opened size={480} className="company-car-form-sheet app-compact-form" title={t('Автомобіль компанії')} onClose={handleCancel}>
        <Stack gap={10}>
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {t('Автомобіль не знайдено.')}
          </Alert>
          <AppModalFooter>
            <Button color="gray" variant="default" onClick={handleCancel}>{t('Закрити')}</Button>
          </AppModalFooter>
        </Stack>
      </AppModal>
    )
  }

  return (
    <AppModal
      opened
      size={860}
      className="company-car-form-sheet app-compact-form"
      title={isEditMode ? t('Автомобіль компанії') : t('Завести нову машину компанії')}
      onClose={handleCancel}
    >
      <form id="company-car-form" onSubmit={handleSubmit}>
        <Stack className="app-compact-form" gap={10}>
          {error && (
            <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
              {error}
            </Alert>
          )}

          {!canSave && (
            <Alert color="yellow" icon={<CircleAlert size={18} />} variant="light">
              {t('Немає прав для збереження автомобіля компанії')}
            </Alert>
          )}

          <DocumentDetailLayout
            variant="inventory"
            summary={
              <DocumentDetailSummary
                variant="inventory"
                eyebrow={t('Автомобіль компанії')}
                title={form.licensePlate || t('Нове авто')}
                meta={form.carBrand ? <DocumentDetailChip>{form.carBrand}</DocumentDetailChip> : null}
                metrics={<>
                  <DocumentDetailMetric label={t('Показники одометра')} value={formatCarMetric(form.mileage)} suffix="км" />
                  <DocumentDetailMetric label={t('Кількість пального')} value={formatCarMetric(form.fuelAmount)} suffix="л" />
                </>}
              />
            }
          >
            <DocumentDetailSection title={t('Автомобіль та організація')} stacked>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={10}>
                <div className="company-car-form-organization"><Select
            clearable
            searchable
            data={organizationOptions}
            disabled={isLoading || isSaving}
            error={showRequired && !selectedOrganization ? t('Оберіть організацію') : undefined}
            label={t('Організація')}
            placeholder={t('Оберіть організацію')}
            required
            value={form.organizationNetUid || null}
            onChange={(value) => updateForm({ organizationNetUid: value || '' })}
          /></div>
                <TextInput
              data-autofocus
              disabled={isSaving}
              error={fieldErrors.carBrand}
              label={t('Марка автомобіля')}
              maxLength={COMPANY_CAR_LIMITS.carBrandMaxLength}
              readOnly={isLoading}
              ref={firstFieldRef}
              value={form.carBrand}
              onChange={(event) => updateForm({ carBrand: event.currentTarget.value })}
            />
                <TextInput
              disabled={isLoading || isSaving}
              error={fieldErrors.licensePlate}
              label={t('№ Авто')}
              maxLength={COMPANY_CAR_LIMITS.licensePlateMaxLength}
              required
              value={form.licensePlate}
              onChange={(event) => updateForm({ licensePlate: event.currentTarget.value })}
            />
              </SimpleGrid>
            </DocumentDetailSection>
            <DocumentDetailSection title={t('Пальне та пробіг')} stacked>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={10}>
                <TextInput
              inputMode="decimal"
              disabled={isLoading || isSaving}
              error={fieldErrors.tankCapacity}
              label={t('Вмістимість баку')}
              required
              value={form.tankCapacity}
              onChange={(event) => updateForm({ tankCapacity: event.currentTarget.value })}
            />
                <TextInput
              inputMode="decimal"
              disabled={isLoading || isSaving}
              error={fieldErrors.fuelAmount}
              label={t('Кількість пального')}
              required
              value={form.fuelAmount}
              onChange={(event) => updateForm({ fuelAmount: event.currentTarget.value })}
            />
                <TextInput
              inputMode="decimal"
              disabled={isLoading || isSaving}
              error={fieldErrors.mileage}
              label={t('Показники одометра')}
              required
              value={form.mileage}
              onChange={(event) => updateForm({ mileage: event.currentTarget.value })}
            />
              </SimpleGrid>
            </DocumentDetailSection>
            <DocumentDetailSection title={t('Витрати пального')} stacked>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={10}>
                <TextInput
              inputMode="decimal"
              disabled={isLoading || isSaving}
              error={fieldErrors.inCityConsumption}
              label={t('Розхід по місту на 100 км')}
              value={form.inCityConsumption}
              onChange={(event) => updateForm({ inCityConsumption: event.currentTarget.value })}
            />
                <TextInput
              inputMode="decimal"
              disabled={isLoading || isSaving}
              error={fieldErrors.outsideCityConsumption}
              label={t('Розхід по трасі на 100 км')}
              value={form.outsideCityConsumption}
              onChange={(event) => updateForm({ outsideCityConsumption: event.currentTarget.value })}
            />
                <TextInput
              inputMode="decimal"
              disabled={isLoading || isSaving}
              error={fieldErrors.mixedModeConsumption}
              label={t('Змішаний розхід')}
              value={form.mixedModeConsumption}
              onChange={(event) => updateForm({ mixedModeConsumption: event.currentTarget.value })}
            />
              </SimpleGrid>
            </DocumentDetailSection>
          </DocumentDetailLayout>
        </Stack>
      </form>
      <AppModalFooter>
        <Group gap="xs">
          <Button color="gray" variant="default" disabled={isSaving || isDeleting} onClick={handleCancel}>{t('Скасувати')}</Button>
          {isEditMode && canDelete && (
            <Button
              color="red"
              disabled={isLoading || !companyCar.NetUid}
              leftSection={<Trash2 size={16} />}
              loading={isDeleting}
              type="button"
              variant="light"
              onClick={() => setDeleteModalOpened(true)}
            >
              {t('Видалити')}
            </Button>
          )}
          <Button
            color={CREATE_ACTION_COLOR}
            disabled={isLoading || !canSave}
            form="company-car-form"
            leftSection={<Save size={16} />}
            loading={isSaving}
            type="submit"
          >
            {t('Зберегти')}
          </Button>
        </Group>
      </AppModalFooter>

      <AppModal
        centered
        opened={deleteModalOpened}
        title={t('Видалити автомобіль компанії')}
        onClose={() => setDeleteModalOpened(false)}
      >
        <Stack gap={10}>
          <Text>
            {t('Видалити автомобіль')} <Text span fw={600}>{form.carBrand || form.licensePlate || t('Без назви')}</Text>?
          </Text>
          <AppModalFooter>
            <Button color="gray" disabled={isDeleting} variant="default" onClick={() => setDeleteModalOpened(false)}>
              {t('Скасувати')}
            </Button>
            <Button color="red" leftSection={<Trash2 size={16} />} loading={isDeleting} onClick={handleDelete}>
              {t('Видалити')}
            </Button>
          </AppModalFooter>
        </Stack>
      </AppModal>
      <DiscardChangesModal opened={discardOpened} onDiscard={closeForm} onKeep={() => setDiscardOpened(false)} />
    </AppModal>
  )
}

function createCompanyCarFormPageState(): CompanyCarFormPageState {
  return {
    companyCar: createEmptyCompanyCar(),
    error: null,
    form: createEmptyForm(),
    isLoading: true,
    isNotFound: false,
    organizations: [],
    showRequired: false,
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
        ...state,
        companyCar: action.companyCar,
        error: null,
        form: action.form,
        isLoading: false,
        isNotFound: false,
        organizations: action.organizations,
      }
    case 'not-found':
      return {
        ...state,
        error: null,
        isLoading: false,
        isNotFound: true,
      }
    case 'show-required':
      return {
        ...state,
        showRequired: true,
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
  /* A saved car may really have 0 l of fuel; a new car starts with empty fields. */
  const isSaved = Boolean(companyCar.NetUid || companyCar.Id)
  const formatField = (value?: number) => formatNumberField(value, isSaved)

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

function formatNumberField(value: number | undefined, keepZero: boolean): string {
  return typeof value === 'number' && Number.isFinite(value) && (keepZero || value !== 0) ? String(value) : ''
}

/** Only called after validation passed: empty optional values are sent as 0. */
function readNumber(value: string): number {
  return parseCarNumber(value) ?? 0
}

function nullWhenNotFound(loadError: unknown): null {
  if (loadError instanceof ApiError && loadError.status === 404) {
    return null
  }

  throw loadError
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
