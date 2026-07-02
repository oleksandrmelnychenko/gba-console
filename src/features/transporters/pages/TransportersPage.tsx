import {
  ActionIcon,
  Alert,
  Button,
  Divider,
  FileInput,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconArchive,
  IconDeviceFloppy,
  IconPlus,
  IconRefresh,
  IconRestore,
  IconSearch,
  IconUpload,
} from '@tabler/icons-react'
import { ExternalLink } from 'lucide-react'
import { useEffect, useMemo, useReducer, useState } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { translate } from '../../../shared/i18n/translate'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import {
  archiveTransporter,
  createTransporter,
  getTransportersByType,
  getTransporterTypes,
  updateTransporter,
} from '../api/transportersApi'
import type { Transporter, TransporterType } from '../types'
import '../../../shared/ui/console-table-page.css'
import './transporters-page.css'

const archiveDisabledCssClass = 'self_checkout_item_class'
const hiddenTransporterTypeNames = new Set(['Перевізники Польща', 'Перевізники TF', 'Покупці ПЛ'])

type TransporterStatusFilter = 'active' | 'all' | 'archived'

type TransporterEditorState =
  | { mode: 'create' }
  | { mode: 'edit'; transporter: Transporter }

type TransporterFormValues = {
  CssClass: string
  ImageFile: File | null
  ImageUrl: string
  Name: string
  Priority: string
}

const TRANSPORTERS_TABLE_DEFAULT_LAYOUT = {
  columnOrder: ['transporter', 'params', 'image', 'status'],
  columnPinning: { left: ['transporter'] },
  density: 'normal',
} satisfies DataTableDefaultLayout

function useTransporterColumns({
  selectedTransporterType,
}: {
  selectedTransporterType: TransporterType | null
}) {
  return useMemo<DataTableColumn<Transporter>[]>(
    () => [
      {
        id: 'transporter',
        header: 'Перевізник',
        width: 300,
        minWidth: 260,
        fill: true,
        accessor: (transporter) => getTransporterName(transporter),
        cell: (transporter) => (
          <TransporterProfileCell
            transporter={transporter}
            typeName={transporter.TransporterType?.Name || selectedTransporterType?.Name}
          />
        ),
      },
      {
        id: 'params',
        header: 'Параметри',
        width: 280,
        minWidth: 240,
        accessor: (transporter) => transporter.Priority,
        cell: (transporter) => (
          <div className="transporters-config-cell">
            <TransporterSetting label={translate('Пріоритет')} value={displayValue(transporter.Priority)} />
          </div>
        ),
      },
      {
        id: 'image',
        header: 'Зображення',
        width: 132,
        minWidth: 120,
        enableSorting: false,
        cell: (transporter) => <TransporterImagePreview transporter={transporter} />,
      },
      {
        id: 'status',
        header: 'Статус',
        width: 120,
        minWidth: 100,
        accessor: (transporter) => (transporter.Deleted === true ? translate('Архів') : translate('Активний')),
        cell: (transporter) => <TransporterStatusTag transporter={transporter} />,
      },
    ],
    [selectedTransporterType],
  )
}

export function TransportersPage() {
  const { t } = useI18n()
  const [transporterTypes, setTransporterTypes] = useValueState<TransporterType[]>([])
  const [selectedTypeNetId, setSelectedTypeNetId] = useValueState<string | null>(null)
  const [transporters, setTransporters] = useValueState<Transporter[]>([])
  const [search, setSearch] = useValueState('')
  const [statusFilter, setStatusFilter] = useValueState<TransporterStatusFilter>('active')
  const [error, setError] = useValueState<string | null>(null)
  const [isLoadingTypes, setLoadingTypes] = useValueState(true)
  const [isLoadingTransporters, setLoadingTransporters] = useValueState(false)
  const [isArchiving, setArchiving] = useValueState(false)
  const [isSaving, setSaving] = useValueState(false)
  const [archiveTarget, setArchiveTarget] = useValueState<Transporter | null>(null)
  const [actionsTransporter, setActionsTransporter] = useValueState<Transporter | null>(null)
  const [editor, setEditor] = useValueState<TransporterEditorState | null>(null)
  const [formError, setFormError] = useValueState<string | null>(null)
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const usableTransporterTypes = useMemo(
    () => transporterTypes.filter((transporterType) => Boolean(transporterType.NetUid) && isVisibleTransporterType(transporterType)),
    [transporterTypes],
  )
  const selectedTransporterType = useMemo(
    () => usableTransporterTypes.find((transporterType) => transporterType.NetUid === selectedTypeNetId) || null,
    [selectedTypeNetId, usableTransporterTypes],
  )
  const visibleTransporters = useMemo(
    () =>
      transporters.filter((transporter) => {
        if (statusFilter === 'all') {
          return matchesTransporterSearch(transporter, search, selectedTransporterType)
        }

        const matchesStatus = statusFilter === 'archived' ? transporter.Deleted === true : transporter.Deleted !== true

        return matchesStatus && matchesTransporterSearch(transporter, search, selectedTransporterType)
      }),
    [search, selectedTransporterType, statusFilter, transporters],
  )
  const isBusy = isLoadingTypes || isLoadingTransporters
  const transporterColumns = useTransporterColumns({
    selectedTransporterType,
  })

  useEffect(() => {
    let cancelled = false

    async function loadTransporterTypes() {
      setLoadingTypes(true)
      setError(null)

      try {
        const nextTransporterTypes = await getTransporterTypes()
        const nextUsableTransporterTypes = nextTransporterTypes.filter(
          (transporterType) => Boolean(transporterType.NetUid) && isVisibleTransporterType(transporterType),
        )

        if (!cancelled) {
          setTransporterTypes(nextTransporterTypes)
          setSelectedTypeNetId((currentTypeNetId) => {
            if (
              currentTypeNetId &&
              nextUsableTransporterTypes.some((transporterType) => transporterType.NetUid === currentTypeNetId)
            ) {
              return currentTypeNetId
            }

            return nextUsableTransporterTypes[0]?.NetUid || null
          })
        }
      } catch (loadError) {
        if (!cancelled) {
          setTransporterTypes([])
          setSelectedTypeNetId(null)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити типи перевізників'))
        }
      } finally {
        if (!cancelled) {
          setLoadingTypes(false)
        }
      }
    }

    void loadTransporterTypes()

    return () => {
      cancelled = true
    }
  }, [reloadKey, setError, setLoadingTypes, setSelectedTypeNetId, setTransporterTypes, t])

  useEffect(() => {
    let cancelled = false

    async function loadTransporters() {
      if (!selectedTypeNetId) {
        setTransporters([])
        setLoadingTransporters(false)
        return
      }

      setLoadingTransporters(true)
      setError(null)

      try {
        const nextTransporters = await getTransportersByType(selectedTypeNetId)

        if (!cancelled) {
          setTransporters(nextTransporters)
        }
      } catch (loadError) {
        if (!cancelled) {
          setTransporters([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити перевізників'))
        }
      } finally {
        if (!cancelled) {
          setLoadingTransporters(false)
        }
      }
    }

    void loadTransporters()

    return () => {
      cancelled = true
    }
  }, [reloadKey, selectedTypeNetId, setError, setLoadingTransporters, setTransporters, t])

  async function handleArchiveTransporter() {
    if (!archiveTarget?.NetUid || !canArchiveTransporter(archiveTarget)) {
      setArchiveTarget(null)
      return
    }

    setArchiving(true)
    setError(null)

    try {
      await archiveTransporter(archiveTarget.NetUid)
      setTransporters((currentTransporters) =>
        currentTransporters.map((transporter) =>
          transporter.NetUid === archiveTarget.NetUid
            ? {
                ...transporter,
                Deleted: true,
              }
            : transporter,
        ),
      )
      notifications.show({
        color: 'green',
        message: t('Перевізника архівовано'),
      })
      setArchiveTarget(null)
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : t('Не вдалося архівувати перевізника'))
    } finally {
      setArchiving(false)
    }
  }

  function openCreateTransporter() {
    setFormError(null)
    setEditor({ mode: 'create' })
  }

  function openTransporterActions(transporter: Transporter) {
    setActionsTransporter(transporter)
  }

  function openEditTransporter(transporter: Transporter) {
    setActionsTransporter(null)
    setFormError(null)
    setEditor({ mode: 'edit', transporter })
  }

  function openArchiveTransporter(transporter: Transporter) {
    setActionsTransporter(null)
    setArchiveTarget(transporter)
  }

  async function handleSaveTransporter(values: TransporterFormValues) {
    const validationError = validateTransporterForm(values)

    if (validationError) {
      setFormError(validationError)
      return
    }

    if (!selectedTransporterType?.Id) {
      setFormError(t('Оберіть тип перевізника'))
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      const payload = buildTransporterPayload(
        editor?.mode === 'edit' ? editor.transporter : undefined,
        values,
        selectedTransporterType,
      )

      if (editor?.mode === 'edit') {
        await updateTransporter(payload)
      } else {
        await createTransporter(payload)
      }

      notifications.show({
        color: 'green',
        message: editor?.mode === 'edit' ? t('Перевізника оновлено') : t('Перевізника створено'),
      })
      setEditor(null)
      reload()
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти перевізника'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Stack className="transporters-page console-table-page" gap={6}>
      <div className="transporters-shell console-table-shell">
        <div className="app-filter-bar transporters-command-bar">
          <div className="transporters-command-search">
            <TextInput
              className="transporters-search-input"
              label={t('Пошук')}
              leftSection={<IconSearch size={15} />}
              placeholder={t('Пошук перевізника')}
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
            />
            <Select
              className="transporters-status-filter"
              data={[
                { value: 'active', label: t('Активні') },
                { value: 'all', label: t('Усі') },
                { value: 'archived', label: t('Архів') },
              ]}
              label={t('Статус')}
              size="xs"
              value={statusFilter}
              onChange={(value) => setStatusFilter((value as TransporterStatusFilter | null) || 'active')}
            />
          </div>

          <div className="transporters-toolbar-actions">
            <Tooltip label={t('Скинути')}>
              <ActionIcon
                aria-label={t('Скинути')}
                color="gray"
                disabled={!search}
                size={34}
                type="button"
                variant="light"
                onClick={() => setSearch('')}
              >
                <IconRestore size={17} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Оновити')}>
              <ActionIcon
                aria-label={t('Оновити')}
                color="gray"
                loading={isBusy}
                size={34}
                variant="light"
                onClick={() => reload()}
              >
                <IconRefresh size={17} />
              </ActionIcon>
            </Tooltip>
          </div>
          <div ref={setTableToolbarSlot} className="transporters-table-toolbar-slot" />
          <div className="transporters-create-actions">
            <Button
              className="transporters-create-action"
              color={CREATE_ACTION_COLOR}
              disabled={!selectedTransporterType}
              leftSection={<IconPlus size={16} />}
              size="sm"
              onClick={openCreateTransporter}
            >
              {t('Створити')}
            </Button>
          </div>
        </div>

        {error && (
          <Alert className="console-table-alert" color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <div className="transporters-workspace">
          <aside className="transporters-type-rail" aria-label={t('Типи перевізників')}>
            <div className="transporters-rail-header">
              <span>{t('Навігація типів')}</span>
            </div>

            {isLoadingTypes ? (
              <div className="transporters-empty-state">{t('Завантаження типів перевізників')}</div>
            ) : usableTransporterTypes.length > 0 ? (
              <div className="transporters-type-scroll">
                <div className="transporters-type-list">
                  {usableTransporterTypes.map((transporterType) => {
                    const value = transporterType.NetUid || ''
                    const isActive = selectedTypeNetId === value
                    const count = getTransporterTypeCount(transporterType, selectedTypeNetId, transporters)

                    return (
                      <button
                        key={value}
                        className={`transporters-type-option${isActive ? ' is-active' : ''}`}
                        type="button"
                        onClick={() => setSelectedTypeNetId(value)}
                      >
                        <span className="transporters-type-option-name">{getTransporterTypeName(transporterType)}</span>
                        <span className="transporters-type-option-count">{count ?? ''}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="transporters-empty-state">{t('Типів перевізників не знайдено')}</div>
            )}
          </aside>

          <section className="transporters-roster console-table-body">
            <DataTable
              columns={transporterColumns}
              data={visibleTransporters}
              defaultLayout={TRANSPORTERS_TABLE_DEFAULT_LAYOUT}
              emptyText={selectedTypeNetId ? t('Перевізників не знайдено') : t('Оберіть тип перевізника')}
              getRowId={(transporter, index) => String(transporter.NetUid || transporter.Id || index)}
              height="100%"
              isLoading={isBusy}
              layoutVersion="transporters-table-3"
              minWidth={910}
              showLayoutControls
              tableId="transporters"
              toolbarPortalTarget={tableToolbarSlot}
              onRowClick={openTransporterActions}
            />
          </section>
        </div>
      </div>

      <TransporterActionsModal
        isArchiving={isArchiving}
        transporter={actionsTransporter}
        onArchive={openArchiveTransporter}
        onClose={() => setActionsTransporter(null)}
        onEdit={openEditTransporter}
      />

      <TransporterEditorModal
        key={editor ? `transporter-${editor.mode}-${editor.mode === 'edit' ? editor.transporter.NetUid || editor.transporter.Id : 'new'}` : 'transporter-closed'}
        error={formError}
        isSaving={isSaving}
        opened={Boolean(editor)}
        title={editor?.mode === 'edit' ? t('Редагувати перевізника') : t('Новий перевізник')}
        transporter={editor?.mode === 'edit' ? editor.transporter : undefined}
        onClose={() => {
          if (!isSaving) {
            setEditor(null)
            setFormError(null)
          }
        }}
        onSave={handleSaveTransporter}
      />

      <AppModal
        centered
        opened={Boolean(archiveTarget)}
        title={t('Архівувати перевізника')}
        onClose={() => setArchiveTarget(null)}
      >
        <Stack gap="md">
          <Text>
            {archiveTarget
              ? t('Перевізник "{name}" буде прибраний з активного списку.', { name: getTransporterName(archiveTarget) })
              : ''}
          </Text>
          <Group justify="flex-end">
            <Button color="gray" variant="subtle" onClick={() => setArchiveTarget(null)}>
              {t('Скасувати')}
            </Button>
            <Button color="red" loading={isArchiving} onClick={handleArchiveTransporter}>
              {t('Архівувати')}
            </Button>
          </Group>
        </Stack>
      </AppModal>
    </Stack>
  )
}

function TransporterActionsModal({
  isArchiving,
  transporter,
  onArchive,
  onClose,
  onEdit,
}: {
  isArchiving: boolean
  transporter: Transporter | null
  onArchive: (transporter: Transporter) => void
  onClose: () => void
  onEdit: (transporter: Transporter) => void
}) {
  const { t } = useI18n()
  const isActive = transporter?.Deleted !== true
  const canArchive = transporter ? canArchiveTransporter(transporter) : false

  return (
    <AppModal
      centered
      opened={Boolean(transporter)}
      size={496}
      title={
        <span className="transporters-action-title">
          <span className={`transporters-action-status-dot${isActive ? ' is-active' : ''}`} />
          {transporter ? getTransporterName(transporter) : t('Перевізник')}
        </span>
      }
      onClose={onClose}
    >
      {transporter && (
        <Stack gap="md">
          <Stack className="app-modal-actions" gap="xs">
            <Button
              fullWidth
              color="dark"
              justify="flex-start"
              leftSection={
                <span className="app-action-icon">
                  <ExternalLink size={20} color="var(--mantine-color-gray-7)" />
                </span>
              }
              size="md"
              variant="subtle"
              onClick={() => onEdit(transporter)}
            >
              {t('Редагувати')}
            </Button>
          </Stack>

          <Divider />

          <Button
            fullWidth
            color="gray"
            disabled={!canArchive}
            justify="flex-start"
            leftSection={<IconArchive size={16} />}
            loading={isArchiving}
            title={getArchiveTooltip(transporter)}
            variant="light"
            onClick={() => onArchive(transporter)}
          >
            {t('Архівувати')}
          </Button>
        </Stack>
      )}
    </AppModal>
  )
}

function TransporterEditorModal({
  error,
  isSaving,
  opened,
  title,
  transporter,
  onClose,
  onSave,
}: {
  error: string | null
  isSaving: boolean
  opened: boolean
  title: string
  transporter?: Transporter
  onClose: () => void
  onSave: (values: TransporterFormValues) => void
}) {
  const [values, setValues] = useValueState<TransporterFormValues>(() => transporterToFormValues(transporter))

  function setField<K extends keyof TransporterFormValues>(key: K, value: TransporterFormValues[K]) {
    setValues((currentValues) => ({
      ...currentValues,
      [key]: value,
    }))
  }

  return (
    <AppModal centered opened={opened} title={title} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSave(values)
        }}
      >
        <Stack gap="md">
          {error ? (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {error}
            </Alert>
          ) : null}
          <TextInput
            autoFocus
            label={translate('Назва')}
            required
            value={values.Name}
            onChange={(event) => setField('Name', event.currentTarget.value)}
          />
          <TextInput
            label={translate('Пріоритет')}
            type="number"
            value={values.Priority}
            onChange={(event) => setField('Priority', event.currentTarget.value)}
          />
          <TextInput
            label={translate('CSS клас')}
            value={values.CssClass}
            onChange={(event) => setField('CssClass', event.currentTarget.value)}
          />
          <TextInput
            label={translate('URL зображення')}
            value={values.ImageUrl}
            onChange={(event) => setField('ImageUrl', event.currentTarget.value)}
          />
          <FileInput
            accept="image/*"
            clearable
            label={translate('Зображення')}
            leftSection={<IconUpload size={16} />}
            value={values.ImageFile}
            onChange={(file) => setField('ImageFile', file)}
          />
          <Group justify="flex-end">
            <Button color="gray" disabled={isSaving} type="button" variant="subtle" onClick={onClose}>
              {translate('Скасувати')}
            </Button>
            <Button color={CREATE_ACTION_COLOR} leftSection={<IconDeviceFloppy size={16} />} loading={isSaving} type="submit">
              {translate('Зберегти')}
            </Button>
          </Group>
        </Stack>
      </form>
    </AppModal>
  )
}

function TransporterProfileCell({
  transporter,
  typeName,
}: {
  transporter: Transporter
  typeName?: string
}) {
  const name = getTransporterName(transporter)
  const displayType = displayValue(typeName)
  const title = [name, displayType].filter(Boolean).join('\n')

  return (
    <div className="transporters-profile-cell" title={nativeTitle(title)}>
      <div className="transporters-profile-copy">
        <span className="transporters-profile-name">{name}</span>
        <span className="transporters-profile-type">{displayType}</span>
      </div>
    </div>
  )
}

function TransporterSetting({
  label,
  value,
}: {
  label: string
  value: string
}) {
  if (!value) {
    return null
  }

  return (
    <span className="transporters-setting" title={nativeTitle(`${label}: ${value}`)}>
      <span className="transporters-setting-copy">
        <span>{label}</span>
        <strong>{value}</strong>
      </span>
    </span>
  )
}

function TransporterImagePreview({ transporter }: { transporter: Transporter }) {
  const imageUrl = transporter.ImageUrl?.trim()

  if (!imageUrl) {
    return null
  }

  return (
    <span className="transporters-image-preview is-filled" title={nativeTitle(imageUrl)}>
      <img alt={getTransporterName(transporter)} src={imageUrl} />
    </span>
  )
}

function TransporterStatusTag({ transporter }: { transporter: Transporter }) {
  const isArchived = transporter.Deleted === true

  return (
    <span className={`transporters-status-tag${isArchived ? ' is-archived' : ' is-active'}`}>
      {isArchived ? translate('Архів') : translate('Активний')}
    </span>
  )
}

function getTransporterName(transporter: Transporter): string {
  return transporter.Name?.trim() || translate('Без назви')
}

function getTransporterTypeName(transporterType: TransporterType): string {
  return transporterType.Name?.trim() || translate('Без назви')
}

function isVisibleTransporterType(transporterType: TransporterType): boolean {
  return !hiddenTransporterTypeNames.has(getTransporterTypeName(transporterType))
}

function getTransporterTypeCount(
  transporterType: TransporterType,
  selectedTypeNetId: string | null,
  selectedTransporters: Transporter[],
): number | null {
  if (transporterType.NetUid === selectedTypeNetId) {
    return selectedTransporters.length
  }

  return Array.isArray(transporterType.Transporters) ? transporterType.Transporters.length : null
}

function matchesTransporterSearch(
  transporter: Transporter,
  search: string,
  selectedTransporterType: TransporterType | null,
): boolean {
  const query = search.trim().toLowerCase()

  if (!query) {
    return true
  }

  return [
    transporter.Name,
    transporter.ImageUrl,
    transporter.Priority,
    transporter.TransporterType?.Name,
    selectedTransporterType?.Name,
  ].some((value) => String(value ?? '').toLowerCase().includes(query))
}

function displayValue(value?: number | string | null): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : ''
  }

  const normalized = value?.trim()
  return normalized || ''
}

function nativeTitle(value: string): string | undefined {
  const title = value.trim()

  return title ? title : undefined
}

function transporterToFormValues(transporter?: Transporter): TransporterFormValues {
  return {
    CssClass: transporter?.CssClass || '',
    ImageFile: null,
    ImageUrl: transporter?.ImageUrl || '',
    Name: transporter?.Name || '',
    Priority: typeof transporter?.Priority === 'number' ? String(transporter.Priority) : '',
  }
}

function validateTransporterForm(values: TransporterFormValues): string | null {
  if (!values.Name.trim()) {
    return translate('Вкажіть назву перевізника')
  }

  if (values.Priority.trim() && !Number.isFinite(Number(values.Priority))) {
    return translate('Вкажіть коректний пріоритет')
  }

  return null
}

function buildTransporterPayload(
  transporter: Transporter | undefined,
  values: TransporterFormValues,
  transporterType: TransporterType,
): FormData {
  const nextTransporter: Transporter = {
    ...(transporter || {}),
    CssClass: values.CssClass.trim(),
    ImageUrl: values.ImageUrl.trim(),
    Name: values.Name.trim(),
    Priority: values.Priority.trim() ? Number(values.Priority) : undefined,
    TransporterType: transporterType,
    TransporterTypeId: transporterType.Id,
  }
  const formData = new FormData()

  formData.append('entity', JSON.stringify(nextTransporter))

  if (values.ImageFile) {
    formData.append('image', values.ImageFile)
  }

  return formData
}

function canArchiveTransporter(transporter: Transporter): boolean {
  return Boolean(
    transporter.NetUid &&
      transporter.Deleted !== true &&
      transporter.CssClass !== archiveDisabledCssClass,
  )
}

function getArchiveTooltip(transporter: Transporter): string {
  if (transporter.Deleted) {
    return translate('Вже в архіві')
  }

  if (transporter.CssClass === archiveDisabledCssClass) {
    return translate('Архівація недоступна')
  }

  return translate('Архівувати')
}
