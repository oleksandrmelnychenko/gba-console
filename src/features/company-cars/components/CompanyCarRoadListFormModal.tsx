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
import { IconAlertCircle, IconDeviceFloppy, IconX } from '@tabler/icons-react'
import { useEffect, useMemo, useReducer } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { useAuth } from '../../auth/useAuth'
import {
  calculateCompanyCarRoadList,
  createCompanyCarRoadList,
  getOutcomeOrdersByCompanyCar,
  searchCompanyCarUsers,
} from '../api/companyCarsApi'
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
  | { type: 'reset' }
  | { type: 'selected-outcome-changed'; selectedOutcomeNetUid: string }
  | { type: 'started-saving' }
  | { type: 'user-search-changed'; userSearchValue: string }

export function CompanyCarRoadListFormModal({
  companyCar,
  onClose,
  onCreated,
  opened,
}: {
  companyCar: CompanyCar
  onClose: () => void
  onCreated: (roadList: CompanyCarRoadList) => void
  opened: boolean
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

  const companyCarNetUid = companyCar.NetUid || ''
  const isMileageOnly = parseDecimal(form.mixedModeKilometers) !== 0
  const isMixedDisabled = parseDecimal(form.inCityKilometers) !== 0 || parseDecimal(form.outsideCityKilometers) !== 0

  useEffect(() => {
    if (!opened) {
      return
    }

    dispatchState({ type: 'reset' })
  }, [opened])

  useEffect(() => {
    if (!opened || !companyCarNetUid) {
      return
    }

    let cancelled = false

    void getOutcomeOrdersByCompanyCar(companyCarNetUid)
      .then((nextOrders) => {
        if (!cancelled) {
          dispatchState({ outcomeOrders: nextOrders, type: 'loaded-outcome-orders' })
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
  }, [companyCarNetUid, opened, t])

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
        companyCar,
        drivers,
        form: debouncedForm,
        outcomeOrder: outcomeOrders.find((order) => getEntityValue(order) === selectedOutcomeNetUid) || null,
        responsible: toUserProfile(user),
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
  }, [companyCar, companyCarNetUid, debouncedForm, drivers, opened, outcomeOrders, selectedOutcomeNetUid, t, user])

  const outcomeOptions = useMemo(
    () => toSelectOptions(outcomeOrders, (order) => order.Number),
    [outcomeOrders],
  )
  const userOptions = useMemo(
    () => toSelectOptions(users, (profile) => getEntityName(profile)),
    [users],
  )

  function addDriver(netUid: string | null) {
    if (!netUid) {
      return
    }

    const profile = users.find((candidate) => getEntityValue(candidate) === netUid)

    if (!profile || drivers.some((driver) => getEntityValue(driver.User) === netUid)) {
      return
    }

    dispatchState({ driver: { User: profile }, type: 'add-driver' })
  }

  function removeDriver(driver: CompanyCarRoadListDriver) {
    dispatchState({ driver, type: 'remove-driver' })
  }

  async function handleSave() {
    if (!companyCarNetUid) {
      return
    }

    dispatchState({ type: 'started-saving' })

    try {
      const payload = buildRoadListPayload({
        calculated,
        companyCar,
        drivers,
        form,
        outcomeOrder: outcomeOrders.find((order) => getEntityValue(order) === selectedOutcomeNetUid) || null,
        responsible: toUserProfile(user),
      })
      const created = await createCompanyCarRoadList(payload)

      if (created) {
        onCreated(created)
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

  return (
    <AppModal
      centered
      opened={opened}
      size="lg"
      title={`${t('Створення шляхового листа')} ${t('для автомобіля')} ${companyCar.LicensePlate || ''}`.trim()}
      onClose={onClose}
    >
      <Stack gap="md">
        {error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <ReadonlyItem label={t('Показники одометра')} value={formatNumber(companyCar.Mileage)} />
          <ReadonlyItem label={t('Кількість пального')} value={formatNumber(companyCar.FuelAmount)} />
          <ReadonlyItem label={t('Відповідальний')} value={displayValue(user?.LastName)} />
          <ReadonlyItem label={t('Кількість пального')} value={formatNumber(calculated?.FuelAmount ?? 0)} />
          <ReadonlyItem label={t('Загальний кілометраж')} value={formatNumber(calculated?.TotalKilometers ?? 0)} />
        </SimpleGrid>

        <Select
          data={outcomeOptions}
          label={t('Виберіть вихідну статтю бюджету')}
          placeholder={t('Видаткова стаття бюджету')}
          value={selectedOutcomeNetUid || null}
          onChange={(value) => dispatchState({ selectedOutcomeNetUid: value || '', type: 'selected-outcome-changed' })}
        />

        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput
            label={t('Показники одометра')}
            value={form.mileage}
            onChange={(event) => dispatchState({ patch: { mileage: event.currentTarget.value }, type: 'patch-form' })}
          />
          <TextInput
            disabled={isMileageOnly}
            label={t('По місту')}
            value={form.inCityKilometers}
            onChange={(event) => dispatchState({ patch: { inCityKilometers: event.currentTarget.value }, type: 'patch-form' })}
          />
          <TextInput
            disabled={isMileageOnly}
            label={t('За містом')}
            value={form.outsideCityKilometers}
            onChange={(event) => dispatchState({ patch: { outsideCityKilometers: event.currentTarget.value }, type: 'patch-form' })}
          />
          <TextInput
            disabled={isMixedDisabled}
            label={t('Змішаний режим')}
            value={form.mixedModeKilometers}
            onChange={(event) => dispatchState({ patch: { mixedModeKilometers: event.currentTarget.value }, type: 'patch-form' })}
          />
        </SimpleGrid>

        <TextInput
          label={t('Коментар')}
          value={form.comment}
          onChange={(event) => dispatchState({ patch: { comment: event.currentTarget.value }, type: 'patch-form' })}
        />

        <Select
          clearable
          searchable
          data={userOptions}
          label={t('Кому видано')}
          placeholder={t('Місце вводу для пошуку')}
          searchValue={userSearchValue}
          value={null}
          onChange={addDriver}
          onSearchChange={(value) => dispatchState({ type: 'user-search-changed', userSearchValue: value })}
        />

        {drivers.length > 0 && (
          <Group gap="xs">
            {drivers.map((driver, index) => (
              <Chip key={getEntityValue(driver.User) || index} checked={false} variant="light">
                <Group gap={4} wrap="nowrap">
                  <Text size="sm">{displayValue(getEntityName(driver.User))}</Text>
                  <ActionIcon
                    aria-label={t('Видалити')}
                    color="red"
                    size="xs"
                    variant="subtle"
                    onClick={() => removeDriver(driver)}
                  >
                    <IconX size={12} />
                  </ActionIcon>
                </Group>
              </Chip>
            ))}
          </Group>
        )}

        <Group justify="space-between">
          <Badge color="gray" variant="light">
            {t('Загальний кілометраж')}: {formatNumber(calculated?.TotalKilometers ?? 0)}
          </Badge>
          <Group gap="xs">
            <Button color="gray" disabled={isSaving} variant="light" onClick={onClose}>
              {t('Скасувати')}
            </Button>
            <Button color="violet" leftSection={<IconDeviceFloppy size={16} />} loading={isSaving} onClick={handleSave}>
              {t('Зберегти')}
            </Button>
          </Group>
        </Group>
      </Stack>
    </AppModal>
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
  return {
    calculated: null,
    drivers: [],
    error: null,
    form: createEmptyForm(),
    isSaving: false,
    outcomeOrders: [],
    selectedOutcomeNetUid: '',
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
        selectedOutcomeNetUid: getEntityValue(action.outcomeOrders[0]) || '',
      }
    case 'loaded-users':
      return {
        ...state,
        users: action.users,
      }
    case 'patch-form':
      return {
        ...state,
        form: {
          ...state.form,
          ...action.patch,
        },
      }
    case 'remove-driver':
      return {
        ...state,
        drivers: state.drivers.filter((candidate) => candidate !== action.driver),
      }
    case 'reset':
      return createRoadListModalState()
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
  calculated,
  companyCar,
  drivers,
  form,
  outcomeOrder,
  responsible,
}: {
  calculated?: CompanyCarRoadList | null
  companyCar: CompanyCar
  drivers: CompanyCarRoadListDriver[]
  form: RoadListFormState
  outcomeOrder: OutcomePaymentOrder | null
  responsible: UserProfile | null
}): CompanyCarRoadListPayload {
  return {
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
