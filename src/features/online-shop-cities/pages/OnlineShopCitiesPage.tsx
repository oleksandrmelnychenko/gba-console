import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Checkbox,
  Group,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { AppModal } from "../../../shared/ui/AppModal"
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconArchive,
  IconDeviceFloppy,
  IconHome,
  IconMapPin,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconRestore,
  IconSearch,
  IconTrash,
  IconWorld,
} from '@tabler/icons-react'
import { type FormEvent, useCallback, useEffect, useMemo, useReducer } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { translate } from '../../../shared/i18n/translate'
import { useI18n } from '../../../shared/i18n/useI18n'
import { CREATE_ACTION_COLOR, PageHeaderActions } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { getOnlineShopCities, saveOnlineShopCity } from '../api/onlineShopCitiesApi'
import type { OnlineShopCity } from '../types'
import './online-shop-cities-page.css'

const CITY_FILTER_ALL = 'all'
const CITY_FILTER_ACTIVE = 'active'
const CITY_FILTER_ARCHIVED = 'archived'
const CITY_FILTER_LOCAL = 'local'
const CITY_FILTER_GLOBAL = 'global'

type CityFilter =
  | typeof CITY_FILTER_ACTIVE
  | typeof CITY_FILTER_ALL
  | typeof CITY_FILTER_ARCHIVED
  | typeof CITY_FILTER_GLOBAL
  | typeof CITY_FILTER_LOCAL

type CityFormValues = {
  IsLocalPayment: boolean
  NameRu: string
  NameUa: string
}

const EMPTY_FORM_VALUES: CityFormValues = {
  IsLocalPayment: false,
  NameRu: '',
  NameUa: '',
}

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

export function OnlineShopCitiesPage() {
  const { t } = useI18n()
  const [cities, setCities] = useValueState<OnlineShopCity[]>([])
  const [searchDraft, setSearchDraft] = useValueState('')
  const [searchValue, setSearchValue] = useValueState('')
  const [cityFilter, setCityFilter] = useValueState<CityFilter>(CITY_FILTER_ALL)
  const [formValues, setFormValues] = useValueState<CityFormValues>(EMPTY_FORM_VALUES)
  const [editingCity, setEditingCity] = useValueState<OnlineShopCity | null>(null)
  const [archiveTarget, setArchiveTarget] = useValueState<OnlineShopCity | null>(null)
  const [error, setError] = useValueState<string | null>(null)
  const [formError, setFormError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isSaving, setSaving] = useValueState(false)
  const [isEditorOpen, setEditorOpen] = useValueState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const visibleCities = useMemo(
    () => filterCities(cities, searchValue).filter((city) => matchCityFilter(city, cityFilter)),
    [cities, cityFilter, searchValue],
  )
  const cityNavigationItems = useMemo<CityNavigationItem[]>(
    () => [
      {
        count: cities.length,
        label: t('Всі міста'),
        value: CITY_FILTER_ALL,
      },
      {
        count: cities.filter((city) => !city.Deleted).length,
        label: t('Активні'),
        value: CITY_FILTER_ACTIVE,
      },
      {
        count: cities.filter((city) => city.Deleted === true).length,
        label: t('Архів'),
        value: CITY_FILTER_ARCHIVED,
      },
      {
        count: cities.filter((city) => city.IsLocalPayment === true).length,
        label: t('Локальна оплата'),
        value: CITY_FILTER_LOCAL,
      },
      {
        count: cities.filter((city) => city.IsLocalPayment !== true).length,
        label: t('Загальна оплата'),
        value: CITY_FILTER_GLOBAL,
      },
    ],
    [cities, t],
  )
  const openEditor = useCallback((city?: OnlineShopCity) => {
    setEditingCity(city || null)
    setFormValues(cityToFormValues(city))
    setFormError(null)
    setEditorOpen(true)
  }, [setEditingCity, setEditorOpen, setFormError, setFormValues])
  const requestArchive = useCallback((city: OnlineShopCity) => {
    setArchiveTarget(city)
    setEditorOpen(false)
    setFormError(null)
  }, [setArchiveTarget, setEditorOpen, setFormError])
  const hasActiveFilters = Boolean(searchValue.trim()) || cityFilter !== CITY_FILTER_ALL

  useEffect(() => {
    let cancelled = false

    async function loadCities() {
      setLoading(true)
      setError(null)

      try {
        const nextCities = await getOnlineShopCities()

        if (!cancelled) {
          setCities(nextCities)
        }
      } catch (loadError) {
        if (!cancelled) {
          setCities([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити міста'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadCities()

    return () => {
      cancelled = true
    }
  }, [reloadKey, setCities, setError, setLoading, t])

  function updateSearch(nextSearchValue: string) {
    setSearchDraft(nextSearchValue)
    setSearchValue(nextSearchValue.trim())
  }

  function resetSearch() {
    setSearchDraft('')
    setSearchValue('')
    setCityFilter(CITY_FILTER_ALL)
  }

  function closeEditor() {
    if (isSaving) {
      return
    }

    setEditorOpen(false)
    setEditingCity(null)
    setFormValues(EMPTY_FORM_VALUES)
    setFormError(null)
  }

  function setFormField<K extends keyof CityFormValues>(key: K, value: CityFormValues[K]) {
    setFormValues((currentValues) => ({
      ...currentValues,
      [key]: value,
    }))
  }

  async function handleSaveCity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const payload = buildCityPayload(editingCity, formValues)
    const validationError = validateCity(payload)

    if (validationError) {
      setFormError(validationError)
      return
    }

    setSaving(true)
    setError(null)
    setFormError(null)

    try {
      const nextCities = await saveOnlineShopCity(payload)

      setCities(nextCities)
      notifications.show({
        color: 'green',
        message: editingCity?.Id ? t('Місто оновлено') : t('Місто створено'),
      })
      closeEditor()
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти місто'))
    } finally {
      setSaving(false)
    }
  }

  async function handleArchiveCity() {
    if (!archiveTarget) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      const nextCities = await saveOnlineShopCity({
        ...archiveTarget,
        Deleted: true,
      })

      setCities(nextCities)
      notifications.show({
        color: 'green',
        message: t('Місто архівовано'),
      })
      setArchiveTarget(null)
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : t('Не вдалося архівувати місто'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Stack className="online-shop-cities-page" gap="md">
      <PageHeaderActions>
        <Button
          color={CREATE_ACTION_COLOR}
          size="sm"
          leftSection={<IconPlus size={16} />}
          type="button"
          onClick={() => openEditor()}
        >
          {t('Нове місто')}
        </Button>
      </PageHeaderActions>

      <OnlineShopCitiesRegistry
        cityFilter={cityFilter}
        cityNavigationItems={cityNavigationItems}
        error={error}
        hasActiveFilters={hasActiveFilters}
        isLoading={isLoading}
        searchDraft={searchDraft}
        visibleCities={visibleCities}
        onCityFilterChange={setCityFilter}
        onOpenEditor={openEditor}
        onRequestArchive={requestArchive}
        onReload={reload}
        onResetSearch={resetSearch}
        onSearchChange={updateSearch}
      />

      <CityEditorModal
        city={editingCity}
        error={formError}
        isOpen={isEditorOpen}
        isSaving={isSaving}
        values={formValues}
        onArchive={requestArchive}
        onClose={closeEditor}
        onFieldChange={setFormField}
        onSubmit={handleSaveCity}
      />

      <CityArchiveModal
        city={archiveTarget}
        isSaving={isSaving}
        onArchive={handleArchiveCity}
        onClose={() => setArchiveTarget(null)}
      />
    </Stack>
  )
}

type CityNavigationItem = {
  count: number
  label: string
  value: CityFilter
}

type OnlineShopCitiesRegistryProps = {
  cityFilter: CityFilter
  cityNavigationItems: CityNavigationItem[]
  error: string | null
  hasActiveFilters: boolean
  isLoading: boolean
  searchDraft: string
  visibleCities: OnlineShopCity[]
  onCityFilterChange: (filter: CityFilter) => void
  onOpenEditor: (city?: OnlineShopCity) => void
  onRequestArchive: (city: OnlineShopCity) => void
  onReload: () => void
  onResetSearch: () => void
  onSearchChange: (value: string) => void
}

function OnlineShopCitiesRegistry({
  cityFilter,
  cityNavigationItems,
  error,
  hasActiveFilters,
  isLoading,
  searchDraft,
  visibleCities,
  onCityFilterChange,
  onOpenEditor,
  onRequestArchive,
  onReload,
  onResetSearch,
  onSearchChange,
}: OnlineShopCitiesRegistryProps) {
  const { t } = useI18n()

  return (
    <Box className="online-shop-cities-shell">
      <div className="app-filter-bar online-shop-cities-command-bar">
        <TextInput
          className="online-shop-cities-search-input"
          leftSection={<IconSearch size={15} />}
          label={t('Пошук міста')}
          placeholder={t('Назва UA, RU або UID')}
          value={searchDraft}
          onChange={(event) => onSearchChange(event.currentTarget.value)}
        />

        <div className="app-filter-actions">
          <Tooltip label={t('Очистити')}>
            <ActionIcon
              aria-label={t('Очистити')}
              color="gray"
              disabled={!hasActiveFilters}
              size={34}
              type="button"
              variant="light"
              onClick={onResetSearch}
            >
              <IconRestore size={17} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t('Оновити')}>
            <ActionIcon
              aria-label={t('Оновити')}
              color="gray"
              loading={isLoading}
              size={34}
              type="button"
              variant="light"
              onClick={onReload}
            >
              <IconRefresh size={17} />
            </ActionIcon>
          </Tooltip>
        </div>
      </div>

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {error}
        </Alert>
      )}

      <div className="online-shop-cities-layout">
        <aside className="online-shop-cities-rail" aria-label={t('Міста')}>
          <div className="online-shop-cities-rail-header">
            <span>{t('Навігація міст')}</span>
          </div>

          <div className="online-shop-cities-filter-list">
            {cityNavigationItems.map((item) => (
              <button
                key={item.value}
                className={`online-shop-cities-filter-option${cityFilter === item.value ? ' is-active' : ''}`}
                type="button"
                onClick={() => onCityFilterChange(item.value)}
              >
                <span className="online-shop-cities-filter-name">{item.label}</span>
                <span className="online-shop-cities-filter-count">{item.count}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="online-shop-cities-roster">
          <div className="online-shop-cities-roster-table">
            <div className="online-shop-cities-roster-head">
              <span>{t('Місто')}</span>
              <span>{t('Оплата')}</span>
              <span>{t('Стан')}</span>
              <span>{t('Оновлено')}</span>
              <span />
              <span />
            </div>

            <ScrollArea.Autosize mah="calc(100vh - 372px)" type="auto">
              <div className="online-shop-cities-roster-body">
                {isLoading ? (
                  <div className="online-shop-cities-empty-state">
                    {t('Завантаження міст')}
                  </div>
                ) : visibleCities.length > 0 ? (
                  visibleCities.map((city, index) => (
                    <CityRosterRow
                      key={String(city.NetUid || city.Id || index)}
                      city={city}
                      onOpenEditor={onOpenEditor}
                      onRequestArchive={onRequestArchive}
                    />
                  ))
                ) : (
                  <div className="online-shop-cities-empty-state">
                    {hasActiveFilters
                      ? t('Міст за цими фільтрами не знайдено')
                      : t('Міст не знайдено')}
                  </div>
                )}
              </div>
            </ScrollArea.Autosize>
          </div>
        </section>
      </div>
    </Box>
  )
}

function CityRosterRow({
  city,
  onOpenEditor,
  onRequestArchive,
}: {
  city: OnlineShopCity
  onOpenEditor: (city: OnlineShopCity) => void
  onRequestArchive: (city: OnlineShopCity) => void
}) {
  const { t } = useI18n()
  const dateParts = formatDateParts(city.Updated)
  const isArchived = city.Deleted === true
  const isLocalPayment = city.IsLocalPayment === true

  function openCity() {
    onOpenEditor(city)
  }

  return (
    <div
      className={`online-shop-cities-row${isArchived ? ' is-archived' : ''}`}
      role="button"
      tabIndex={0}
      onClick={openCity}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          openCity()
        }
      }}
    >
      <div className="online-shop-cities-name-cell">
        <span className="online-shop-cities-city-icon" aria-hidden="true">
          <IconMapPin size={15} />
        </span>
        <div className="online-shop-cities-name-copy">
          <Text className="online-shop-cities-name-primary">
            {displayValue(city.NameUa)}
          </Text>
          <Text className="online-shop-cities-name-secondary">
            {displayValue(city.NameRu)}
          </Text>
        </div>
      </div>

      <div className={`online-shop-cities-payment-cell${isLocalPayment ? ' is-local' : ' is-global'}`}>
        <span className="online-shop-cities-payment-marker" aria-hidden="true">
          {isLocalPayment ? <IconHome size={13} /> : <IconWorld size={13} />}
        </span>
        <strong>
          {isLocalPayment ? t('Локальна') : t('Загальна')}
        </strong>
      </div>

      <span className={`online-shop-cities-status-tag${isArchived ? ' is-archived' : ' is-active'}`}>
        {isArchived ? t('Архів') : t('Активне')}
      </span>

      <div className="online-shop-cities-date-cell">
        <Text className="online-shop-cities-date-primary">
          {dateParts.date}
        </Text>
        <Text className="online-shop-cities-date-secondary">
          {dateParts.time}
        </Text>
      </div>

      <Tooltip label={t('Редагувати')}>
        <ActionIcon
          aria-label={t('Редагувати')}
          className="online-shop-cities-row-action"
          color="gray"
          size="sm"
          variant="subtle"
          onClick={(event) => {
            event.stopPropagation()
            onOpenEditor(city)
          }}
        >
          <IconPencil size={15} />
        </ActionIcon>
      </Tooltip>

      <Tooltip label={t('Архівувати')}>
        <ActionIcon
          aria-label={t('Архівувати')}
          className="online-shop-cities-row-action"
          color="gray"
          disabled={!city.Id || isArchived}
          size="sm"
          variant="subtle"
          onClick={(event) => {
            event.stopPropagation()
            onRequestArchive(city)
          }}
        >
          <IconArchive size={15} />
        </ActionIcon>
      </Tooltip>
    </div>
  )
}

type CityEditorModalProps = {
  city: OnlineShopCity | null
  error: string | null
  isOpen: boolean
  isSaving: boolean
  values: CityFormValues
  onArchive: (city: OnlineShopCity) => void
  onClose: () => void
  onFieldChange: <K extends keyof CityFormValues>(key: K, value: CityFormValues[K]) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

function CityEditorModal({
  city,
  error,
  isOpen,
  isSaving,
  values,
  onArchive,
  onClose,
  onFieldChange,
  onSubmit,
}: CityEditorModalProps) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={isOpen} title={city?.Id ? t('Редагування міста') : t('Нове місто')} onClose={onClose}>
      <form onSubmit={onSubmit}>
        <Stack gap="md">
          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {error}
            </Alert>
          )}
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <TextInput
              disabled={isSaving}
              label={t('Назва [UA]')}
              maxLength={120}
              required
              value={values.NameUa}
              onChange={(event) => onFieldChange('NameUa', event.currentTarget.value)}
            />
            <TextInput
              disabled={isSaving}
              label={t('Назва [RU]')}
              maxLength={120}
              required
              value={values.NameRu}
              onChange={(event) => onFieldChange('NameRu', event.currentTarget.value)}
            />
          </SimpleGrid>
          <Checkbox
            checked={values.IsLocalPayment}
            disabled={isSaving}
            label={t('Локальна оплата')}
            onChange={(event) => onFieldChange('IsLocalPayment', event.currentTarget.checked)}
          />
          <Group justify="space-between">
            <Box>
              {city?.Id && (
                <Button
                  color="red"
                  disabled={isSaving}
                  leftSection={<IconTrash size={16} />}
                  type="button"
                  variant="subtle"
                  onClick={() => onArchive(city)}
                >
                  {t('Архівувати')}
                </Button>
              )}
            </Box>
            <Group gap="xs">
              <Button color="gray" disabled={isSaving} type="button" variant="subtle" onClick={onClose}>
                {t('Скасувати')}
              </Button>
              <Button color="violet" leftSection={<IconDeviceFloppy size={16} />} loading={isSaving} type="submit">
                {t('Зберегти')}
              </Button>
            </Group>
          </Group>
        </Stack>
      </form>
    </AppModal>
  )
}

type CityArchiveModalProps = {
  city: OnlineShopCity | null
  isSaving: boolean
  onArchive: () => void
  onClose: () => void
}

function CityArchiveModal({ city, isSaving, onArchive, onClose }: CityArchiveModalProps) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={Boolean(city)} title={t('Архівувати місто')} onClose={onClose}>
      <Stack gap="md">
        <Text>{city ? t('Місто "{name}" буде прибране з активного списку.', { name: getCityName(city) }) : ''}</Text>
        <Group justify="flex-end">
          <Button color="gray" disabled={isSaving} variant="subtle" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button color="red" loading={isSaving} onClick={onArchive}>
            {t('Архівувати')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function cityToFormValues(city?: OnlineShopCity): CityFormValues {
  if (!city) {
    return EMPTY_FORM_VALUES
  }

  return {
    IsLocalPayment: city.IsLocalPayment === true,
    NameRu: city.NameRu || '',
    NameUa: city.NameUa || '',
  }
}

function buildCityPayload(city: OnlineShopCity | null, values: CityFormValues): OnlineShopCity {
  return {
    ...(city || {}),
    IsLocalPayment: values.IsLocalPayment,
    NameRu: values.NameRu.trim(),
    NameUa: values.NameUa.trim(),
  }
}

function validateCity(city: OnlineShopCity): string | null {
  if (!city.NameUa?.trim()) {
    return translate('Вкажіть назву [UA]')
  }

  if (!city.NameRu?.trim()) {
    return translate('Вкажіть назву [RU]')
  }

  return null
}

function filterCities(cities: OnlineShopCity[], searchValue: string): OnlineShopCity[] {
  const normalizedSearch = searchValue.trim().toLocaleLowerCase('uk')

  if (!normalizedSearch) {
    return cities
  }

  return cities.filter((city) =>
    [city.NameUa, city.NameRu, city.NetUid, city.Id].some((value) =>
      String(value ?? '').toLocaleLowerCase('uk').includes(normalizedSearch),
    ),
  )
}

function matchCityFilter(city: OnlineShopCity, filter: CityFilter): boolean {
  if (filter === CITY_FILTER_ALL) {
    return true
  }

  if (filter === CITY_FILTER_ACTIVE) {
    return city.Deleted !== true
  }

  if (filter === CITY_FILTER_ARCHIVED) {
    return city.Deleted === true
  }

  if (filter === CITY_FILTER_LOCAL) {
    return city.IsLocalPayment === true
  }

  return city.IsLocalPayment !== true
}

function getCityName(city: OnlineShopCity): string {
  return city.NameUa?.trim() || city.NameRu?.trim() || translate('Без назви')
}

function displayValue(value?: boolean | number | string | null): string {
  if (typeof value === 'boolean') {
    return value ? translate('Так') : translate('Ні')
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '-'
  }

  const normalized = value?.trim()
  return normalized || '-'
}

function formatDateTime(value?: Date | string): string {
  if (!value) {
    return ''
  }

  const time = new Date(value).getTime()

  if (!Number.isFinite(time)) {
    return ''
  }

  return dateTimeFormatter.format(new Date(time))
}

function formatDateParts(value?: Date | string) {
  const formatted = formatDateTime(value)

  if (!formatted) {
    return { date: '-', time: '' }
  }

  const [date, time] = formatted.split(',').map((part) => part.trim())

  return {
    date: date || '-',
    time: time || '',
  }
}
