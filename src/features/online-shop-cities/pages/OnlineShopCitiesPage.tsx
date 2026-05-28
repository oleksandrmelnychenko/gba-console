import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Group,
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
  IconDeviceFloppy,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconRestore,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react'
import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useReducer } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { translate } from '../../../shared/i18n/translate'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { getOnlineShopCities, saveOnlineShopCity } from '../api/onlineShopCitiesApi'
import type { OnlineShopCity } from '../types'

const ONLINE_SHOP_CITIES_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['nameUa'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

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
    () => filterCities(cities, searchValue),
    [cities, searchValue],
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
  const columns = useOnlineShopCityColumns(openEditor, requestArchive)
  const toolbarLeft = useMemo(
    () => (
      <Text size="xs" c="dimmed">
        {t('Показано')} {visibleCities.length} {t('з')} {cities.length}
        {searchValue ? `, ${t('пошук')}: ${searchValue}` : ''}
      </Text>
    ),
    [cities.length, searchValue, t, visibleCities.length],
  )

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
    <Stack gap="lg">
      <OnlineShopCitiesTableCard
        columns={columns}
        error={error}
        isLoading={isLoading}
        searchDraft={searchDraft}
        toolbarLeft={toolbarLeft}
        visibleCities={visibleCities}
        onOpenEditor={openEditor}
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

type OnlineShopCitiesTableCardProps = {
  columns: DataTableColumn<OnlineShopCity>[]
  error: string | null
  isLoading: boolean
  searchDraft: string
  toolbarLeft: ReactNode
  visibleCities: OnlineShopCity[]
  onOpenEditor: (city?: OnlineShopCity) => void
  onReload: () => void
  onResetSearch: () => void
  onSearchChange: (value: string) => void
}

function OnlineShopCitiesTableCard({
  columns,
  error,
  isLoading,
  searchDraft,
  toolbarLeft,
  visibleCities,
  onOpenEditor,
  onReload,
  onResetSearch,
  onSearchChange,
}: OnlineShopCitiesTableCardProps) {
  const { t } = useI18n()

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="md">
        <Group align="start" justify="flex-end" gap="sm">
          <Tooltip label={t('Оновити')}>
            <ActionIcon
              aria-label={t('Оновити')}
              color="gray"
              loading={isLoading}
              size={36}
              variant="light"
              onClick={onReload}
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>

        <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
          <TextInput
            leftSection={<IconSearch size={16} />}
            label={t('Пошук')}
            placeholder={t('Назва міста')}
            value={searchDraft}
            onChange={(event) => onSearchChange(event.currentTarget.value)}
            style={{ flex: '1 1 auto', minWidth: 160 }}
          />
          <Tooltip label={t('Скинути')}>
            <ActionIcon
              aria-label={t('Скинути')}
              color="gray"
              size={36}
              style={{ flex: '0 0 auto' }}
              type="button"
              variant="light"
              onClick={onResetSearch}
            >
              <IconRestore size={18} />
            </ActionIcon>
          </Tooltip>
          <Button
            color="violet"
            leftSection={<IconPlus size={16} />}
            type="button"
            onClick={() => onOpenEditor()}
            style={{ flex: '0 0 auto' }}
          >
            {t('Нове місто')}
          </Button>
        </Group>

        {error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <DataTable
          columns={columns}
          data={visibleCities}
          defaultLayout={ONLINE_SHOP_CITIES_TABLE_DEFAULT_LAYOUT}
          emptyText={t('Міст не знайдено')}
          getRowId={(city, index) => String(city.NetUid || city.Id || index)}
          isLoading={isLoading}
          layoutVersion="online-shop-cities-table-1"
          loadingText={t('Завантаження міст')}
          maxHeight="calc(100vh - 310px)"
          minWidth={1180}
          tableId="online-shop-cities"
          toolbarLeft={toolbarLeft}
          onRowClick={onOpenEditor}
        />
      </Stack>
    </Card>
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

function useOnlineShopCityColumns(
  openEditor: (city: OnlineShopCity) => void,
  requestArchive: (city: OnlineShopCity) => void,
): DataTableColumn<OnlineShopCity>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<OnlineShopCity>[]>(
    () => [
      {
        id: 'nameUa',
        header: 'Назва [UA]',
        width: 260,
        minWidth: 200,
        accessor: (city) => city.NameUa,
        cell: (city) => (
          <Text fw={600}>{displayValue(city.NameUa)}</Text>
        ),
      },
      {
        id: 'nameRu',
        header: 'Назва [RU]',
        width: 260,
        minWidth: 200,
        accessor: (city) => city.NameRu,
        cell: (city) => displayValue(city.NameRu),
      },
      {
        id: 'payment',
        header: 'Оплата',
        width: 160,
        minWidth: 132,
        accessor: (city) => (city.IsLocalPayment ? t('Локальна') : t('Загальна')),
        cell: (city) => (
          <Badge color={city.IsLocalPayment ? 'green' : 'gray'} variant="light">
            {city.IsLocalPayment ? t('Локальна') : t('Загальна')}
          </Badge>
        ),
      },
      {
        id: 'status',
        header: 'Статус',
        width: 120,
        minWidth: 104,
        accessor: (city) => (city.Deleted ? t('Архів') : t('Активне')),
        cell: (city) => (
          <Badge color={city.Deleted ? 'gray' : 'blue'} variant="light">
            {city.Deleted ? t('Архів') : t('Активне')}
          </Badge>
        ),
      },
      {
        id: 'updated',
        header: 'Оновлено',
        width: 170,
        minWidth: 140,
        accessor: (city) => formatDateTime(city.Updated),
        cell: (city) => displayValue(formatDateTime(city.Updated)),
      },
      {
        id: 'actions',
        header: '',
        width: 94,
        minWidth: 94,
        maxWidth: 94,
        align: 'center',
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
        cell: (city) => (
          <Group gap={4} justify="center" wrap="nowrap" onClick={(event) => event.stopPropagation()}>
            <Tooltip label={t('Редагувати')}>
              <ActionIcon
                aria-label={t('Редагувати')}
                color="gray"
                variant="subtle"
                onClick={() => openEditor(city)}
              >
                <IconPencil size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Архівувати')}>
              <ActionIcon
                aria-label={t('Архівувати')}
                color="red"
                disabled={!city.Id || city.Deleted === true}
                variant="subtle"
                onClick={() => requestArchive(city)}
              >
                <IconTrash size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ),
      },
    ],
    [openEditor, requestArchive, t],
  )
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
