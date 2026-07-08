import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Chip,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { CircleAlert, Save, X } from 'lucide-react'
import { useEffect, useMemo, useReducer } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { useAuth } from '../../auth/useAuth'
import {
  calculateCompanyCarRoadList,
  createCompanyCarRoadList,
  getOutcomeOrdersByCompanyCar,
  searchCompanyCarUsers,
  updateCompanyCarRoadList,
} from '../api/companyCarsApi'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import type {
  CompanyCar,
  CompanyCarRoadList,
  CompanyCarRoadListDriver,
  CompanyCarRoadListPayload,
  OutcomePaymentOrder,
  UserProfile,
} from '../types'

const USER_SEARCH_DEBOUNCE_MS = 300
const CALCULATE_DEBOUNCE_MS = 600

type RoadListFormState = {
  comment: string
  inCityKilometers: string
  mileage: string
  mixedModeKilometers: string
  outsideCityKilometers: string
}

type RoadListModalState = {
  calculated: CompanyCarRoadList | null
  drivers: CompanyCarRoadListDriver[]
  error: string | null
  form: RoadListFormState
  isSaving: boolean
  outcomeOrders: OutcomePaymentOrder[]
  selectedOutcomeNetUid: string
  userSearchValue: string
  users: UserProfile[]
}

type RoadListModalAction =
  | { type: 'add-driver'; driver: CompanyCarRoadListDriver }
  | { type: 'calculated'; calculated: CompanyCarRoadList | null }
  | { type: 'failed'; error: string }
  | { type: 'finished-saving' }
  | { type: 'loaded-outcome-orders'; outcomeOrders: OutcomePaymentOrder[] }
  | { type: 'loaded-users'; users: UserProfile[] }
  | { type: 'patch-form'; patch: Partial<RoadListFormState> }
  | { type: 'remove-driver'; driver: CompanyCarRoadListDriver }
  | { type: 'reset'; roadList: CompanyCarRoadList | null }
  | { type: 'restore-driver'; driver: CompanyCarRoadListDriver }
  | { type: 'selected-outcome-changed'; selectedOutcomeNetUid: string }
  | { type: 'started-saving' }
  | { type: 'user-search-changed'; userSearchValue: string }

export function CompanyCarRoadListFormModal({
  canSave = true,
  companyCar,
  onClose,
  opened,
  roadList,
  onSaved,
}: {
  canSave?: boolean
  companyCar: CompanyCar
  onClose: () => void
  opened: boolean
  roadList?: CompanyCarRoadList | null
  onSaved: (roadList: CompanyCarRoadList) => void
}) {
  const { t } = useI18n()
  const {
    activeDrivers,
    calculated,
    error,
    effectiveCompanyCar,
    effectiveResponsible,
    form,
    handleSave,
    isEditMode,
    isMileageOnly,
    isMixedDisabled,
    isSaving,
    outcomeError,
    outcomeOptions,
    selectedOutcomeNetUid,
    userOptions,
    userSearchValue,
    addDriver,
    patchForm,
    removeDriver,
    selectOutcome,
    setUserSearchValue,
  } = useRoadListFormModel({ canSave, companyCar, onSaved, opened, roadList: roadList || null })

  return (
    <AppModal
      centered
      opened={opened}
      size="lg"
      title={`${isEditMode ? t('Редагування шляхового листа') : t('Створення шляхового листа')} ${t('для автомобіля')} ${effectiveCompanyCar.LicensePlate || ''}`.trim()}
      onClose={onClose}
    >
      <Stack gap="md">
        {error && (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}

        {!canSave && (
          <Alert color="yellow" icon={<CircleAlert size={18} />} variant="light">
            {t('Немає прав для зміни шляхового листа')}
          </Alert>
        )}

        <RoadListSummary companyCar={effectiveCompanyCar} calculated={calculated} responsible={effectiveResponsible} />

        <Select
          data={outcomeOptions}
          error={outcomeError}
          label={t('Виберіть вихідну статтю бюджету')}
          placeholder={t('Видаткова стаття бюджету')}
          value={selectedOutcomeNetUid || null}
          withAsterisk={isEditMode}
          onChange={selectOutcome}
        />

        <RoadListKilometerFields
          form={form}
          isMileageOnly={isMileageOnly}
          isMixedDisabled={isMixedDisabled}
          onPatch={patchForm}
        />

        <TextInput
          label={t('Коментар')}
          value={form.comment}
          onChange={(event) => patchForm({ comment: event.currentTarget.value })}
        />

        <RoadListDriversEditor
          activeDrivers={activeDrivers}
          userOptions={userOptions}
          userSearchValue={userSearchValue}
          onAddDriver={addDriver}
          onRemoveDriver={removeDriver}
          onSearchChange={setUserSearchValue}
        />

        <RoadListFormFooter
          calculated={calculated}
          isSaveDisabled={!canSave || Boolean(outcomeError) || !calculated}
          isSaving={isSaving}
          onClose={onClose}
          onSave={handleSave}
        />
      </Stack>
    </AppModal>
  )
}

function useRoadListFormModel({
  canSave,
  companyCar,
  onSaved,
  opened,
  roadList,
}: {
  canSave: boolean
  companyCar: CompanyCar
  onSaved: (roadList: CompanyCarRoadList) => void
  opened: boolean
  roadList: CompanyCarRoadList | null
}) {
  const { t } = useI18n()
  const { user } = useAuth()
  const [state, dispatchState] = useReducer(roadListModalReducer, undefined, createRoadListModalState)
  const {
    calculated,
    drivers,
    error,
    form,
    isSaving,
    outcomeOrders,
    selectedOutcomeNetUid,
    userSearchValue,
    users,
  } = state
  const [debouncedUserSearchValue] = useDebouncedValue(userSearchValue, USER_SEARCH_DEBOUNCE_MS)
  const [debouncedForm] = useDebouncedValue(form, CALCULATE_DEBOUNCE_MS)

  const editedRoadList = roadList
  const isEditMode = Boolean(editedRoadList?.Id || editedRoadList?.NetUid)
  const fallbackResponsible = useMemo(() => toUserProfile(user), [user])
  const effectiveCompanyCar = useMemo(
    () => ({ ...companyCar, ...(editedRoadList?.CompanyCar || {}) }),
    [companyCar, editedRoadList],
  )
  const effectiveResponsible = editedRoadList?.Responsible || fallbackResponsible
  const activeDrivers = useMemo(() => drivers.filter((driver) => !driver.Deleted), [drivers])
  const companyCarNetUid = effectiveCompanyCar.NetUid || ''
  const isMileageOnly = parseDecimal(form.mixedModeKilometers) !== 0
  const isMixedDisabled = parseDecimal(form.inCityKilometers) !== 0 || parseDecimal(form.outsideCityKilometers) !== 0
  const selectedOutcomeOrder = useMemo(
    () => resolveSelectedOutcomeOrder(outcomeOrders, selectedOutcomeNetUid, editedRoadList?.OutcomePaymentOrder),
    [editedRoadList, outcomeOrders, selectedOutcomeNetUid],
  )
  const outcomeError = isEditMode && !selectedOutcomeOrder ? t('Виберіть вихідну статтю бюджету') : null

  useEffect(() => {
    if (!opened) {
      return
    }

    dispatchState({ roadList: editedRoadList, type: 'reset' })
  }, [editedRoadList, opened])

  useEffect(() => {
    if (!opened || !companyCarNetUid) {
      return
    }

    let cancelled = false

    void getOutcomeOrdersByCompanyCar(companyCarNetUid)
      .then((nextOrders) => {
        if (!cancelled) {
          dispatchState({ outcomeOrders: mergeOutcomeOrders(editedRoadList?.OutcomePaymentOrder, nextOrders), type: 'loaded-outcome-orders' })
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          dispatchState({
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити видаткові статті'),
            type: 'failed',
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [companyCarNetUid, editedRoadList, opened, t])

  useEffect(() => {
    if (!opened) {
      return
    }

    let cancelled = false

    void searchCompanyCarUsers(debouncedUserSearchValue.trim())
      .then((nextUsers) => {
        if (!cancelled) {
          dispatchState({ type: 'loaded-users', users: nextUsers })
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          dispatchState({
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити користувачів'),
            type: 'failed',
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [debouncedUserSearchValue, opened, t])

  useEffect(() => {
    if (!opened || !companyCarNetUid) {
      return
    }

    const mileage = parseDecimal(debouncedForm.mileage)
    const inCity = parseDecimal(debouncedForm.inCityKilometers)
    const outsideCity = parseDecimal(debouncedForm.outsideCityKilometers)
    const mixed = parseDecimal(debouncedForm.mixedModeKilometers)

    if (!mileage && !inCity && !outsideCity && !mixed) {
      return
    }

    let cancelled = false

    void calculateCompanyCarRoadList(
      buildRoadListPayload({
        baseRoadList: editedRoadList,
        companyCar: effectiveCompanyCar,
        drivers,
        form: debouncedForm,
        outcomeOrder: selectedOutcomeOrder,
        responsible: effectiveResponsible,
      }),
    )
      .then((result) => {
        if (!cancelled) {
          dispatchState({ calculated: result, type: 'calculated' })
        }
      })
      .catch((calculateError: unknown) => {
        if (!cancelled) {
          dispatchState({
            error: calculateError instanceof Error ? calculateError.message : t('Не вдалося розрахувати шляховий лист'),
            type: 'failed',
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [companyCar, companyCarNetUid, debouncedForm, drivers, editedRoadList, effectiveCompanyCar, effectiveResponsible, isEditMode, opened, selectedOutcomeOrder, t])

  const outcomeOptions = useMemo(
    () => toSelectOptions(outcomeOrders, (order) => order.Number),
    [outcomeOrders],
  )
  const userOptions = useMemo(
    () => toSelectOptions(users, (profile) => getEntityName(profile)),
    [users],
  )

  function patchForm(patch: Partial<RoadListFormState>) {
    dispatchState({ patch, type: 'patch-form' })
  }

  function selectOutcome(value: string | null) {
    dispatchState({ selectedOutcomeNetUid: value || '', type: 'selected-outcome-changed' })
  }

  function setUserSearchValue(value: string) {
    dispatchState({ type: 'user-search-changed', userSearchValue: value })
  }

  function addDriver(netUid: string | null) {
    if (!netUid) {
      return
    }

    const profile = users.find((candidate) => getEntityValue(candidate) === netUid)

    if (!profile || drivers.some((driver) => !driver.Deleted && getEntityValue(driver.User) === netUid)) {
      return
    }

    const removedDriver = drivers.find((driver) => driver.Deleted && getEntityValue(driver.User) === netUid)

    if (removedDriver) {
      dispatchState({ driver: removedDriver, type: 'restore-driver' })
      return
    }

    dispatchState({ driver: { User: profile }, type: 'add-driver' })
  }

  function removeDriver(driver: CompanyCarRoadListDriver) {
    dispatchState({ driver, type: 'remove-driver' })
  }

  async function handleSave() {
    if (!canSave) {
      dispatchState({ error: t('Немає прав для зміни шляхового листа'), type: 'failed' })
      return
    }

    if (!companyCarNetUid) {
      return
    }

    if (outcomeError) {
      dispatchState({ error: outcomeError, type: 'failed' })
      return
    }

    dispatchState({ type: 'started-saving' })

    try {
      const payload = buildRoadListPayload({
        baseRoadList: editedRoadList,
        calculated,
        companyCar: effectiveCompanyCar,
        drivers,
        form,
        outcomeOrder: selectedOutcomeOrder,
        responsible: effectiveResponsible,
      })
      const saved = isEditMode ? await updateCompanyCarRoadList(payload) : await createCompanyCarRoadList(payload)

      if (saved) {
        onSaved(saved)
      }
    } catch (saveError) {
      dispatchState({
        error: saveError instanceof Error ? saveError.message : t('Не вдалося зберегти шляховий лист'),
        type: 'failed',
      })
    } finally {
      dispatchState({ type: 'finished-saving' })
    }
  }

  return {
    activeDrivers,
    calculated,
    effectiveCompanyCar,
    effectiveResponsible,
    error,
    form,
    handleSave,
    isEditMode,
    isMileageOnly,
    isMixedDisabled,
    isSaving,
    outcomeError,
    outcomeOptions,
    selectedOutcomeNetUid,
    userOptions,
    userSearchValue,
    addDriver,
    patchForm,
    removeDriver,
    selectOutcome,
    setUserSearchValue,
  }
}

function RoadListSummary({
  calculated,
  companyCar,
  responsible,
}: {
  calculated: CompanyCarRoadList | null
  companyCar: CompanyCar
  responsible: UserProfile | null
}) {
  const { t } = useI18n()

  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }}>
      <ReadonlyItem label={t('Показники одометра')} value={formatNumber(companyCar.Mileage)} />
      <ReadonlyItem label={t('Кількість пального')} value={formatNumber(companyCar.FuelAmount)} />
      <ReadonlyItem label={t('Відповідальний')} value={displayValue(responsible?.LastName)} />
      <ReadonlyItem label={t('Кількість пального')} value={formatNumber(calculated?.FuelAmount ?? 0)} />
      <ReadonlyItem label={t('Загальний кілометраж')} value={formatNumber(calculated?.TotalKilometers ?? 0)} />
    </SimpleGrid>
  )
}

function RoadListKilometerFields({
  form,
  isMileageOnly,
  isMixedDisabled,
  onPatch,
}: {
  form: RoadListFormState
  isMileageOnly: boolean
  isMixedDisabled: boolean
  onPatch: (patch: Partial<RoadListFormState>) => void
}) {
  const { t } = useI18n()

  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }}>
      <TextInput
        label={t('Показники одометра')}
        value={form.mileage}
        onChange={(event) => onPatch({ mileage: event.currentTarget.value })}
      />
      <TextInput
        disabled={isMileageOnly}
        label={t('По місту')}
        value={form.inCityKilometers}
        onChange={(event) => onPatch({ inCityKilometers: event.currentTarget.value })}
      />
      <TextInput
        disabled={isMileageOnly}
        label={t('За містом')}
        value={form.outsideCityKilometers}
        onChange={(event) => onPatch({ outsideCityKilometers: event.currentTarget.value })}
      />
      <TextInput
        disabled={isMixedDisabled}
        label={t('Змішаний режим')}
        value={form.mixedModeKilometers}
        onChange={(event) => onPatch({ mixedModeKilometers: event.currentTarget.value })}
      />
    </SimpleGrid>
  )
}

function RoadListDriversEditor({
  activeDrivers,
  userOptions,
  userSearchValue,
  onAddDriver,
  onRemoveDriver,
  onSearchChange,
}: {
  activeDrivers: CompanyCarRoadListDriver[]
  userOptions: Array<{ label: string; value: string }>
  userSearchValue: string
  onAddDriver: (netUid: string | null) => void
  onRemoveDriver: (driver: CompanyCarRoadListDriver) => void
  onSearchChange: (value: string) => void
}) {
  const { t } = useI18n()

  return (
    <>
      <Select
        clearable
        searchable
        data={userOptions}
        label={t('Кому видано')}
        placeholder={t('Місце вводу для пошуку')}
        searchValue={userSearchValue}
        value={null}
        onChange={onAddDriver}
        onSearchChange={onSearchChange}
      />

      {activeDrivers.length > 0 && (
        <Group gap="xs">
          {activeDrivers.map((driver, index) => (
            <Chip key={getEntityValue(driver.User) || index} checked={false} variant="light">
              <Group gap={4} wrap="nowrap">
                <Text size="sm">{displayValue(getEntityName(driver.User))}</Text>
                <ActionIcon
                  aria-label={t('Видалити')}
                  color="red"
                  size="xs"
                  variant="subtle"
                  onClick={() => onRemoveDriver(driver)}
                >
                  <X size={12} />
                </ActionIcon>
              </Group>
            </Chip>
          ))}
        </Group>
      )}
    </>
  )
}

function RoadListFormFooter({
  calculated,
  isSaveDisabled,
  isSaving,
  onClose,
  onSave,
}: {
  calculated: CompanyCarRoadList | null
  isSaveDisabled: boolean
  isSaving: boolean
  onClose: () => void
  onSave: () => void
}) {
  const { t } = useI18n()

  return (
    <Group justify="space-between">
      <Badge color="gray" variant="light">
        {t('Загальний кілометраж')}: {formatNumber(calculated?.TotalKilometers ?? 0)}
      </Badge>
      <Group gap="xs">
        <Button color="gray" disabled={isSaving} variant="light" onClick={onClose}>
          {t('Скасувати')}
        </Button>
        <Button color={CREATE_ACTION_COLOR} disabled={isSaveDisabled} leftSection={<Save size={16} />} loading={isSaving} onClick={onSave}>
          {t('Зберегти')}
        </Button>
      </Group>
    </Group>
  )
}

function ReadonlyItem({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={2}>
      <Text c="dimmed" size="xs" tt="uppercase">
        {label}
      </Text>
      <Text size="sm">{value}</Text>
    </Stack>
  )
}

function createRoadListModalState(): RoadListModalState {
  return createRoadListModalStateFrom(null)
}

function createRoadListModalStateFrom(roadList: CompanyCarRoadList | null): RoadListModalState {
  return {
    calculated: roadList,
    drivers: Array.isArray(roadList?.CompanyCarRoadListDrivers) ? roadList.CompanyCarRoadListDrivers : [],
    error: null,
    form: createFormFromRoadList(roadList),
    isSaving: false,
    outcomeOrders: roadList?.OutcomePaymentOrder ? [roadList.OutcomePaymentOrder] : [],
    selectedOutcomeNetUid: getRoadListOutcomeValue(roadList),
    userSearchValue: '',
    users: [],
  }
}

function roadListModalReducer(state: RoadListModalState, action: RoadListModalAction): RoadListModalState {
  switch (action.type) {
    case 'add-driver':
      return {
        ...state,
        drivers: [...state.drivers, action.driver],
        userSearchValue: '',
      }
    case 'calculated':
      return {
        ...state,
        calculated: action.calculated,
      }
    case 'failed':
      return {
        ...state,
        error: action.error,
      }
    case 'finished-saving':
      return {
        ...state,
        isSaving: false,
      }
    case 'loaded-outcome-orders':
      return {
        ...state,
        outcomeOrders: action.outcomeOrders,
        selectedOutcomeNetUid:
          resolveOutcomeSelection(state.selectedOutcomeNetUid, action.outcomeOrders) || getEntityValue(action.outcomeOrders[0]) || '',
      }
    case 'loaded-users':
      return {
        ...state,
        users: action.users,
      }
    case 'patch-form':
      return {
        ...state,
        calculated: null,
        form: {
          ...state.form,
          ...action.patch,
        },
      }
    case 'remove-driver':
      if (!action.driver.Id && !action.driver.NetUid) {
        return {
          ...state,
          drivers: state.drivers.filter((candidate) => candidate !== action.driver),
        }
      }

      return {
        ...state,
        drivers: state.drivers.map((candidate) => (candidate === action.driver ? { ...candidate, Deleted: true } : candidate)),
      }
    case 'reset':
      return createRoadListModalStateFrom(action.roadList)
    case 'restore-driver':
      return {
        ...state,
        drivers: state.drivers.map((candidate) => (candidate === action.driver ? { ...candidate, Deleted: false } : candidate)),
      }
    case 'selected-outcome-changed':
      return {
        ...state,
        selectedOutcomeNetUid: action.selectedOutcomeNetUid,
      }
    case 'started-saving':
      return {
        ...state,
        error: null,
        isSaving: true,
      }
    case 'user-search-changed':
      return {
        ...state,
        userSearchValue: action.userSearchValue,
      }
    default:
      return state
  }
}

function buildRoadListPayload({
  baseRoadList,
  calculated,
  companyCar,
  drivers,
  form,
  outcomeOrder,
  responsible,
}: {
  baseRoadList?: CompanyCarRoadList | null
  calculated?: CompanyCarRoadList | null
  companyCar: CompanyCar
  drivers: CompanyCarRoadListDriver[]
  form: RoadListFormState
  outcomeOrder: OutcomePaymentOrder | null
  responsible: UserProfile | null
}): CompanyCarRoadListPayload {
  return {
    ...(baseRoadList || {}),
    ...(calculated || {}),
    Comment: form.comment,
    CompanyCar: companyCar,
    CompanyCarRoadListDrivers: drivers,
    InCityKilometers: parseDecimal(form.inCityKilometers),
    Mileage: parseDecimal(form.mileage),
    MixedModeKilometers: parseDecimal(form.mixedModeKilometers),
    OutcomePaymentOrder: outcomeOrder,
    OutsideCityKilometers: parseDecimal(form.outsideCityKilometers),
    Responsible: responsible,
  }
}

function toUserProfile(user: { Id?: number; NetUid?: string; FirstName?: string; LastName?: string; FullName?: string } | null): UserProfile | null {
  if (!user) {
    return null
  }

  return {
    FirstName: user.FirstName,
    FullName: user.FullName,
    Id: user.Id,
    LastName: user.LastName,
    NetUid: user.NetUid,
  }
}

function createEmptyForm(): RoadListFormState {
  return {
    comment: '',
    inCityKilometers: '',
    mileage: '',
    mixedModeKilometers: '',
    outsideCityKilometers: '',
  }
}

function createFormFromRoadList(roadList: CompanyCarRoadList | null): RoadListFormState {
  if (!roadList) {
    return createEmptyForm()
  }

  return {
    comment: roadList.Comment || '',
    inCityKilometers: formatDecimalInput(roadList.InCityKilometers),
    mileage: formatDecimalInput(roadList.Mileage),
    mixedModeKilometers: formatDecimalInput(roadList.MixedModeKilometers),
    outsideCityKilometers: formatDecimalInput(roadList.OutsideCityKilometers),
  }
}

function formatDecimalInput(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) && value !== 0 ? String(value) : ''
}

function parseDecimal(value: string): number {
  if (!value) {
    return 0
  }

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

function mergeOutcomeOrders(current: OutcomePaymentOrder | null | undefined, outcomeOrders: OutcomePaymentOrder[]): OutcomePaymentOrder[] {
  const merged: OutcomePaymentOrder[] = []

  if (current) {
    merged.push(current)
  }

  for (const outcomeOrder of outcomeOrders) {
    if (!merged.some((candidate) => getEntityValue(candidate) === getEntityValue(outcomeOrder))) {
      merged.push(outcomeOrder)
    }
  }

  return merged
}

function resolveSelectedOutcomeOrder(
  outcomeOrders: OutcomePaymentOrder[],
  selectedOutcomeNetUid: string,
  current: OutcomePaymentOrder | null | undefined,
): OutcomePaymentOrder | null {
  return (
    outcomeOrders.find((order) => isMatchingEntityValue(order, selectedOutcomeNetUid)) ||
    (current && (!selectedOutcomeNetUid || isMatchingEntityValue(current, selectedOutcomeNetUid)) ? current : null)
  )
}

function resolveOutcomeSelection(selectedOutcomeNetUid: string, outcomeOrders: OutcomePaymentOrder[]): string {
  if (!selectedOutcomeNetUid) {
    return ''
  }

  const selectedOutcomeOrder = outcomeOrders.find((order) => isMatchingEntityValue(order, selectedOutcomeNetUid))

  return selectedOutcomeOrder ? getEntityValue(selectedOutcomeOrder) : selectedOutcomeNetUid
}

function getRoadListOutcomeValue(roadList: CompanyCarRoadList | null): string {
  return getEntityValue(roadList?.OutcomePaymentOrder) || (typeof roadList?.OutcomePaymentOrderId === 'number' ? String(roadList.OutcomePaymentOrderId) : '')
}

function isMatchingEntityValue(entity: { Id?: number; NetUid?: string } | null | undefined, value: string): boolean {
  if (!entity || !value) {
    return false
  }

  return getEntityValue(entity) === value || (typeof entity.Id === 'number' && String(entity.Id) === value)
}

function getEntityValue(entity?: { Id?: number; NetUid?: string } | null): string {
  return entity?.NetUid || (typeof entity?.Id === 'number' ? String(entity.Id) : '')
}

function getEntityName(entity?: UserProfile | null): string | undefined {
  return entity?.LastName || entity?.FullName || entity?.Name
}

function formatNumber(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '0'
}

function displayValue(value?: string | number | null): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '—'
  }

  return value || '—'
}
