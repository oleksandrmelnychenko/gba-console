import {
  ActionIcon,
  Alert,
  Button,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconArrowLeft,
  IconCar,
  IconDeviceFloppy,
  IconEdit,
  IconId,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react'
import { type FormEvent, useEffect } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useAuth } from '../../auth/useAuth'
import { createTaxFreeCarrier, getTaxFreeCarrier, updateTaxFreeCarrier } from '../api/taxFreeCarriersApi'
import { TaxFreeCarrierCarModal } from '../components/TaxFreeCarrierCarModal'
import { TaxFreeCarrierPassportDrawer } from '../components/TaxFreeCarrierPassportDrawer'
import { TAX_FREE_CARRIER_MANAGE_PERMISSION } from '../permissions'
import type { TaxFreeCarrier, TaxFreeCarrierCar, TaxFreeCarrierPassport } from '../types'

const CARRIERS_PATH = '/tax-free/carriers/all'

type CarrierFormState = {
  firstName: string
  lastName: string
  middleName: string
}

export function TaxFreeCarrierFormPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const { id } = useParams<{ id?: string }>()
  const isEditMode = Boolean(id)
  const canSave = hasPermission(TAX_FREE_CARRIER_MANAGE_PERMISSION)
  const [carrier, setCarrier] = useValueState<TaxFreeCarrier>(() => createEmptyCarrier())
  const [form, setForm] = useValueState<CarrierFormState>(() => createEmptyForm())
  const [cars, setCars] = useValueState<TaxFreeCarrierCar[]>([])
  const [passports, setPassports] = useValueState<TaxFreeCarrierPassport[]>([])
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(isEditMode)
  const [isSaving, setSaving] = useValueState(false)
  const [isCarModalOpen, setCarModalOpen] = useValueState(false)
  const [editingPassportIndex, setEditingPassportIndex] = useValueState<number | null>(null)
  const [isPassportDrawerOpen, setPassportDrawerOpen] = useValueState(false)

  useEffect(() => {
    if (!id) {
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    async function loadCarrier(netId: string) {
      try {
        const loadedCarrier = await getTaxFreeCarrier(netId)

        if (cancelled) {
          return
        }

        const initialCarrier = loadedCarrier || createEmptyCarrier()
        setCarrier(initialCarrier)
        setForm(toFormState(initialCarrier))
        setCars(initialCarrier.StathamCars || [])
        setPassports(initialCarrier.StathamPassports || [])
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити перевізника'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadCarrier(id)

    return () => {
      cancelled = true
    }
  }, [id, setCarrier, setCars, setError, setForm, setLoading, setPassports, t])

  if (isEditMode && !id) {
    return <Navigate replace to={CARRIERS_PATH} />
  }

  const editingPassport = editingPassportIndex !== null ? passports[editingPassportIndex] || null : null

  function updateForm(patch: Partial<CarrierFormState>) {
    setForm((current) => ({ ...current, ...patch }))
  }

  function handleCancel() {
    if (isSaving) {
      return
    }

    navigate(CARRIERS_PATH, { replace: true })
  }

  function addCar(car: TaxFreeCarrierCar) {
    setCars((current) => [...current, car])
    setCarModalOpen(false)
  }

  function removeCar(index: number) {
    setCars((current) => current.filter((_, carIndex) => carIndex !== index))
  }

  function openNewPassport() {
    setEditingPassportIndex(null)
    setPassportDrawerOpen(true)
  }

  function openEditPassport(index: number) {
    setEditingPassportIndex(index)
    setPassportDrawerOpen(true)
  }

  function closePassportDrawer() {
    setPassportDrawerOpen(false)
    setEditingPassportIndex(null)
  }

  function submitPassport(passport: TaxFreeCarrierPassport) {
    setPassports((current) => {
      if (editingPassportIndex === null) {
        return [...current, passport]
      }

      return current.map((item, index) => (index === editingPassportIndex ? passport : item))
    })
    closePassportDrawer()
  }

  function removePassport(index: number) {
    setPassports((current) => current.filter((_, passportIndex) => passportIndex !== index))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationError = validateForm({ canSave, cars, form, isEditMode, t })

    if (validationError) {
      setError(validationError)
      return
    }

    const payload = toPayload(carrier, form, cars, passports)
    setSaving(true)
    setError(null)

    try {
      const savedCarrier = isEditMode ? await updateTaxFreeCarrier(payload) : await createTaxFreeCarrier(payload)
      notifications.show({
        color: 'green',
        message: isEditMode ? t('Перевізника оновлено') : t('Перевізника створено'),
      })
      void savedCarrier
      navigate(CARRIERS_PATH, { replace: true })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти перевізника'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppDrawer
      opened
      position="right"
      size="standard"
      title={isEditMode ? t('Редагування Перевізника') : t('Новий Перевізник')}
      onClose={handleCancel}
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <Group justify="flex-end" gap="xs" wrap="wrap">
            <Button color="gray" leftSection={<IconArrowLeft size={16} />} type="button" variant="light" onClick={handleCancel}>
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

          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {error}
            </Alert>
          )}

          {!canSave && (
            <Alert color="yellow" icon={<IconAlertCircle size={18} />} variant="light">
              {t('Немає прав для збереження перевізника')}
            </Alert>
          )}

          <SimpleGrid cols={{ base: 1, md: 3 }}>
            <TextInput
              disabled={isLoading || isSaving}
              label={t('Прізвище')}
              maxLength={40}
              required
              value={form.lastName}
              onChange={(event) => updateForm({ lastName: event.currentTarget.value })}
            />
            <TextInput
              disabled={isLoading || isSaving}
              label={t("Ім'я")}
              maxLength={40}
              required
              value={form.firstName}
              onChange={(event) => updateForm({ firstName: event.currentTarget.value })}
            />
            <TextInput
              disabled={isLoading || isSaving}
              label={t('По батькові')}
              maxLength={40}
              value={form.middleName}
              onChange={(event) => updateForm({ middleName: event.currentTarget.value })}
            />
          </SimpleGrid>

          <PassportsSection
            canAdd={!isEditMode || !passports.some(isUnsavedPassport)}
            disabled={isLoading || isSaving}
            passports={passports}
            onAdd={openNewPassport}
            onEdit={openEditPassport}
            onRemove={removePassport}
          />

          <CarsSection
            cars={cars}
            disabled={isLoading || isSaving}
            onAdd={() => setCarModalOpen(true)}
            onRemove={removeCar}
          />
        </Stack>
      </form>

      <TaxFreeCarrierCarModal opened={isCarModalOpen} onClose={() => setCarModalOpen(false)} onSubmit={addCar} />

      <TaxFreeCarrierPassportDrawer
        opened={isPassportDrawerOpen}
        passport={editingPassport}
        onClose={closePassportDrawer}
        onSubmit={submitPassport}
      />
    </AppDrawer>
  )
}

function PassportsSection({
  canAdd,
  disabled,
  passports,
  onAdd,
  onEdit,
  onRemove,
}: {
  canAdd: boolean
  disabled: boolean
  passports: TaxFreeCarrierPassport[]
  onAdd: () => void
  onEdit: (index: number) => void
  onRemove: (index: number) => void
}) {
  const { t } = useI18n()

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Group gap="xs">
          <IconId size={18} />
          <Text fw={700}>{t('Новий Паспорт')}</Text>
        </Group>
        {canAdd && (
          <Button
            color="gray"
            disabled={disabled}
            leftSection={<IconPlus size={16} />}
            size="xs"
            type="button"
            variant="light"
            onClick={onAdd}
          >
            {t('Новий Паспорт')}
          </Button>
        )}
      </Group>

      {passports.length === 0 ? (
        <Text c="dimmed" size="sm">
          -
        </Text>
      ) : (
        <SimpleGrid cols={{ base: 1, md: 2 }}>
          {passports.map((passport, index) => (
            <Card key={passport.NetUid || passport.TempId || `${passport.PassportSeria}-${index}`} withBorder padding="sm" radius="sm">
              <Group justify="space-between" wrap="nowrap">
                <Stack gap={2}>
                  <Text fw={600}>
                    {displayValue(passport.PassportSeria)} {displayValue(passport.PassportNumber)}
                  </Text>
                  <Text c="dimmed" size="xs">
                    {[passport.City, passport.Street, passport.HouseNumber].filter(Boolean).join(', ') || '-'}
                  </Text>
                </Stack>
                <Group gap={4} wrap="nowrap">
                  <Tooltip label={t('Редагування Паспорту')}>
                    <ActionIcon
                      aria-label={t('Редагування Паспорту')}
                      color="gray"
                      disabled={disabled}
                      variant="subtle"
                      onClick={() => onEdit(index)}
                    >
                      <IconEdit size={18} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label={t('Видалити')}>
                    <ActionIcon
                      aria-label={t('Видалити')}
                      color="red"
                      disabled={disabled}
                      variant="subtle"
                      onClick={() => onRemove(index)}
                    >
                      <IconTrash size={18} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  )
}

function CarsSection({
  cars,
  disabled,
  onAdd,
  onRemove,
}: {
  cars: TaxFreeCarrierCar[]
  disabled: boolean
  onAdd: () => void
  onRemove: (index: number) => void
}) {
  const { t } = useI18n()

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Group gap="xs">
          <IconCar size={18} />
          <Text fw={700}>{t('Машина перевізника')}</Text>
        </Group>
        <Button
          color="gray"
          disabled={disabled}
          leftSection={<IconPlus size={16} />}
          size="xs"
          type="button"
          variant="light"
          onClick={onAdd}
        >
          {t('Нова Машина')}
        </Button>
      </Group>

      {cars.length === 0 ? (
        <Text c="dimmed" size="sm">
          -
        </Text>
      ) : (
        <SimpleGrid cols={{ base: 1, md: 2 }}>
          {cars.map((car, index) => (
            <Card key={car.NetUid || `${car.Number}-${index}`} withBorder padding="sm" radius="sm">
              <Group justify="space-between" wrap="nowrap">
                <Stack gap={2}>
                  <Text fw={600}>{displayValue(car.Number)}</Text>
                  <Text c="dimmed" size="xs">
                    {t("Об'єм")}: {displayValue(car.Volume)}
                  </Text>
                </Stack>
                <Tooltip label={t('Видалити')}>
                  <ActionIcon
                    aria-label={t('Видалити')}
                    color="red"
                    disabled={disabled}
                    variant="subtle"
                    onClick={() => onRemove(index)}
                  >
                    <IconTrash size={18} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  )
}

function isUnsavedPassport(passport: TaxFreeCarrierPassport): boolean {
  return !passport.NetUid && !passport.Id
}

function createEmptyCarrier(): TaxFreeCarrier {
  return {
    StathamCars: [],
    StathamPassports: [],
  }
}

function createEmptyForm(): CarrierFormState {
  return {
    firstName: '',
    lastName: '',
    middleName: '',
  }
}

function toFormState(carrier: TaxFreeCarrier): CarrierFormState {
  return {
    firstName: carrier.FirstName || '',
    lastName: carrier.LastName || '',
    middleName: carrier.MiddleName || '',
  }
}

function toPayload(
  carrier: TaxFreeCarrier,
  form: CarrierFormState,
  cars: TaxFreeCarrierCar[],
  passports: TaxFreeCarrierPassport[],
): TaxFreeCarrier {
  return {
    ...carrier,
    FirstName: form.firstName.trim(),
    LastName: form.lastName.trim(),
    MiddleName: form.middleName.trim(),
    StathamCars: cars,
    StathamPassports: passports,
  }
}

function validateForm({
  canSave,
  cars,
  form,
  isEditMode,
  t,
}: {
  canSave: boolean
  cars: TaxFreeCarrierCar[]
  form: CarrierFormState
  isEditMode: boolean
  t: (value: string) => string
}): string | null {
  if (!canSave) {
    return t('Немає прав для збереження перевізника')
  }

  if (!form.lastName.trim() || !form.firstName.trim()) {
    return t('Помилки у формі')
  }

  if (isEditMode && cars.length === 0) {
    return t('Додайте хоча б одну машину')
  }

  return null
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return String(value)
}
