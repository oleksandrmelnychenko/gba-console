import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Collapse,
  Group,
  Loader,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  ChevronRight,
  CircleAlert,
  FileText,
  Folder,
  ListChecks,
  Route,
  Search,
  ShieldCheck,
} from 'lucide-react'
import {
  forwardRef,
  useDeferredValue,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { ApiError } from '../../../shared/api/apiClient'
import { useI18n } from '../../../shared/i18n/useI18n'
import {
  getEventPermissionCatalog,
  getRoleEventPermissions,
  updateRoleEventPermissions,
  type EventPermissionCatalog,
  type EventPermissionDefinition,
  type RoleEventPermissions,
} from '../api/eventPermissionsApi'
import {
  buildEventPermissionTree,
  filterEventPermissions,
  getGroupPermissionKeys,
  getPagePermissionKeys,
  getSelectionState,
  getTreePermissionKeys,
  haveSamePermissionKeys,
  togglePermissionKeys,
  type EventPermissionGroup,
  type EventPermissionPage,
  type EventPermissionRiskFilter,
  type EventPermissionSection,
  type EventPermissionStateFilter,
} from '../eventPermissionsTree'
import type { UserRole } from '../types'
import { SelectionMark } from './RolePermissionsEditor'
import './role-permissions-editor.css'
import './event-permissions-catalog.css'

const EXPANDED_STORAGE_KEY = 'gba.event-permissions.expanded.v1'
const EMPTY_SELECTED_KEYS: ReadonlySet<string> = new Set()

type EventPermissionsCatalogProps = {
  role: UserRole | null
  onDirtyChange?: (dirty: boolean) => void
  onSavingChange?: (saving: boolean) => void
}

export type EventPermissionsCatalogHandle = {
  cancel: () => void
  hasUnsavedChanges: () => boolean
  isSaving: () => boolean
  reload: () => void
  save: () => Promise<void>
}

type ConflictState = {
  currentVersion?: number
  message: string
}

export const EventPermissionsCatalog = forwardRef<
  EventPermissionsCatalogHandle,
  EventPermissionsCatalogProps
>(function EventPermissionsCatalog(
  { role, onDirtyChange, onSavingChange },
  ref,
) {
  const { t } = useI18n()
  const roleNetUid = role?.NetUid || ''
  const [catalog, setCatalog] = useState<EventPermissionCatalog | null>(null)
  const [rolePermissions, setRolePermissions] =
    useState<RoleEventPermissions | null>(null)
  const [baselineKeys, setBaselineKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const [selectedKeys, setSelectedKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const [isCatalogLoading, setCatalogLoading] = useState(true)
  const [isRoleLoading, setRoleLoading] = useState(false)
  const [isSaving, setSaving] = useState(false)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [roleError, setRoleError] = useState<string | null>(null)
  const [conflict, setConflict] = useState<ConflictState | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [query, setQuery] = useState('')
  const [riskFilter, setRiskFilter] =
    useState<EventPermissionRiskFilter>('all')
  const [stateFilter, setStateFilter] =
    useState<EventPermissionStateFilter>('all')
  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(
    readExpandedKeys,
  )
  const [hadStoredExpansionState] = useState(hasStoredExpandedKeys)
  const mountedRef = useRef(false)
  const saveOperationRef = useRef(0)
  const deferredQuery = useDeferredValue(query)
  const filterSelectedKeys =
    stateFilter === 'all' ? EMPTY_SELECTED_KEYS : selectedKeys

  const activePermissions = useMemo(
    () => catalog?.permissions.filter((permission) => permission.active) || [],
    [catalog],
  )
  const filteredPermissions = useMemo(
    () =>
      filterEventPermissions(
        activePermissions,
        { query: deferredQuery, risk: riskFilter, state: stateFilter },
        filterSelectedKeys,
      ),
    [activePermissions, deferredQuery, filterSelectedKeys, riskFilter, stateFilter],
  )
  const tree = useMemo(
    () => buildEventPermissionTree(filteredPermissions),
    [filteredPermissions],
  )
  const visibleKeys = useMemo(
    () => filteredPermissions.map((permission) => permission.key),
    [filteredPermissions],
  )
  const activeKeys = useMemo(
    () => activePermissions.map((permission) => permission.key),
    [activePermissions],
  )
  const knownKeys = useMemo(
    () => new Set(activePermissions.map((permission) => permission.key)),
    [activePermissions],
  )
  const inheritedKeys = useMemo(
    () => new Set(rolePermissions?.inheritedPermissionKeys || []),
    [rolePermissions],
  )
  const assignedKnownCount = useMemo(
    () => Array.from(selectedKeys).filter((key) => knownKeys.has(key)).length,
    [knownKeys, selectedKeys],
  )
  const unavailableAssignedCount = Math.max(
    0,
    selectedKeys.size - assignedKnownCount,
  )
  const selectedEditableCount = useMemo(
    () => Array.from(selectedKeys).filter((key) => !inheritedKeys.has(key)).length,
    [inheritedKeys, selectedKeys],
  )
  const dirty = !haveSamePermissionKeys(baselineKeys, selectedKeys)
  const hasActiveFilters = Boolean(deferredQuery.trim()) || riskFilter !== 'all' || stateFilter !== 'all'
  const isLoading = isCatalogLoading || isRoleLoading

  useEffect(() => {
    const controller = new AbortController()

    async function loadCatalog() {
      setCatalogLoading(true)
      setCatalogError(null)

      try {
        const nextCatalog = await getEventPermissionCatalog(controller.signal)

        if (!controller.signal.aborted) {
          setCatalog(nextCatalog)
          setExpandedKeys((current) => {
            if (hadStoredExpansionState) {
              return current
            }

            return new Set(
              buildEventPermissionTree(nextCatalog.permissions).map(
                (section) => sectionExpandedKey(section.id),
              ),
            )
          })
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setCatalog(null)
          setCatalogError(getErrorMessage(loadError, t('Не вдалося завантажити каталог подієвих прав')))
        }
      } finally {
        if (!controller.signal.aborted) {
          setCatalogLoading(false)
        }
      }
    }

    void loadCatalog()
    return () => controller.abort()
  }, [hadStoredExpansionState, reloadKey, t])

  useEffect(() => {
    const controller = new AbortController()

    if (!roleNetUid) {
      return () => controller.abort()
    }

    async function loadRolePermissions() {
      setRoleLoading(true)

      try {
        const nextRolePermissions = await getRoleEventPermissions(
          roleNetUid,
          controller.signal,
        )

        if (!controller.signal.aborted) {
          applyRolePermissions(nextRolePermissions)
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setRoleError(getErrorMessage(loadError, t('Не вдалося завантажити права ролі')))
        }
      } finally {
        if (!controller.signal.aborted) {
          setRoleLoading(false)
        }
      }
    }

    void loadRolePermissions()
    return () => controller.abort()
  }, [reloadKey, roleNetUid, t])

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      saveOperationRef.current += 1
    }
  }, [])

  useEffect(() => {
    onSavingChange?.(isSaving)
  }, [isSaving, onSavingChange])

  useEffect(() => {
    writeExpandedKeys(expandedKeys)
  }, [expandedKeys])

  useEffect(
    () => () => {
      onDirtyChange?.(false)
      onSavingChange?.(false)
    },
    [onDirtyChange, onSavingChange],
  )

  useImperativeHandle(
    ref,
    () => ({
      cancel,
      hasUnsavedChanges: () => dirty,
      isSaving: () => isSaving,
      reload,
      save,
    }),
  )

  function applyRolePermissions(nextRolePermissions: RoleEventPermissions) {
    const nextKeys = new Set(nextRolePermissions.permissionKeys)
    setRolePermissions(nextRolePermissions)
    setBaselineKeys(nextKeys)
    setSelectedKeys(new Set(nextKeys))
    setConflict(null)
    setRoleError(null)
  }

  function cancel() {
    setSelectedKeys(new Set(baselineKeys))
    setConflict(null)
  }

  function reload() {
    saveOperationRef.current += 1
    setSaving(false)
    setCatalog(null)
    setRolePermissions(null)
    setBaselineKeys(new Set())
    setSelectedKeys(new Set())
    setCatalogError(null)
    setRoleError(null)
    setConflict(null)
    setCatalogLoading(true)
    setRoleLoading(Boolean(roleNetUid))
    setReloadKey((current) => current + 1)
  }

  async function save() {
    if (!roleNetUid || !rolePermissions || !dirty || isSaving) {
      return
    }

    if (unavailableAssignedCount > 0) {
      setRoleError(t('Набір прав містить ключі поза активним каталогом. Завантажте актуальний стан.'))
      return
    }

    if (
      catalog?.catalogVersion &&
      rolePermissions.catalogVersion &&
      catalog.catalogVersion !== rolePermissions.catalogVersion
    ) {
      setRoleError(t('Каталог прав оновився. Завантажте актуальний стан перед збереженням.'))
      return
    }

    setSaving(true)
    setRoleError(null)
    setConflict(null)
    const operationId = saveOperationRef.current + 1
    saveOperationRef.current = operationId

    try {
      const saved = await updateRoleEventPermissions(
        roleNetUid,
        rolePermissions.version,
        Array.from(selectedKeys).sort(),
      )

      if (!mountedRef.current || saveOperationRef.current !== operationId) {
        return
      }

      applyRolePermissions(saved)
      notifications.show({ color: 'green', message: t('Збережено') })
    } catch (saveError) {
      if (!mountedRef.current || saveOperationRef.current !== operationId) {
        return
      }

      if (saveError instanceof ApiError && saveError.status === 409) {
        setConflict({
          currentVersion: readConflictVersion(saveError.payload),
          message: t('Права ролі були змінені іншим користувачем. Завантажте актуальний стан і повторіть зміни.'),
        })
      } else {
        setRoleError(getErrorMessage(saveError, t('Не вдалося зберегти права ролі')))
      }
    } finally {
      if (mountedRef.current && saveOperationRef.current === operationId) {
        setSaving(false)
      }
    }
  }

  function toggleExpanded(key: string) {
    setExpandedKeys((current) => toggleSetValue(current, key))
  }

  function toggleKeys(keys: readonly string[]) {
    const editableKeys = keys.filter((key) => !inheritedKeys.has(key))
    if (editableKeys.length === 0) {
      return
    }

    setSelectedKeys((current) => togglePermissionKeys(current, editableKeys))
    setConflict(null)
  }

  function selectKeys(keys: readonly string[]) {
    setSelectedKeys((current) => new Set([...current, ...keys]))
    setConflict(null)
  }

  function clearKeys() {
    setSelectedKeys(new Set(inheritedKeys))
    setConflict(null)
  }

  if (!role) {
    return <Text c="dimmed">{t('Оберіть роль зі списку')}</Text>
  }

  if (!roleNetUid) {
    return (
      <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
        {t('Для ролі відсутній ідентифікатор. Подієві права недоступні.')}
      </Alert>
    )
  }

  if (isLoading && !catalog && !rolePermissions) {
    return (
      <Group className="event-permissions-state" justify="center" gap="xs">
        <Loader color="orange" size="sm" />
        <Text c="dimmed" size="sm">
          {t('Завантаження подієвих прав')}
        </Text>
      </Group>
    )
  }

  if ((catalogError && !catalog) || (roleError && !rolePermissions)) {
    return (
      <Stack className="event-permissions-state" align="center" justify="center" gap="sm">
        <Text c="red" size="sm" ta="center">
          {catalogError || roleError}
        </Text>
        <button className="role-tree-text-action" type="button" onClick={reload}>
          {t('Спробувати ще раз')}
        </button>
      </Stack>
    )
  }

  if (!activePermissions.length) {
    return (
      <Stack className="event-permissions-state" align="center" justify="center" gap="sm">
        <Text c="dimmed" size="sm">
          {t('Каталог подієвих прав порожній')}
        </Text>
        <button className="role-tree-text-action" type="button" onClick={reload}>
          {t('Оновити')}
        </button>
      </Stack>
    )
  }

  return (
    <Box className="role-tree event-permissions-editor">
      <div className="event-permissions-filters">
        <TextInput
          aria-label={t('Пошук права')}
          leftSection={<Search size={15} />}
          placeholder={t('Назва дії, сторінка або ключ')}
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
        <Select
          aria-label={t('Ризик')}
          allowDeselect={false}
          data={[
            { label: t('Усі ризики'), value: 'all' },
            { label: t('Низький ризик'), value: 'low' },
            { label: t('Середній ризик'), value: 'medium' },
            { label: t('Високий ризик'), value: 'high' },
          ]}
          value={riskFilter}
          onChange={(value) => setRiskFilter((value || 'all') as EventPermissionRiskFilter)}
        />
        <Select
          aria-label={t('Стан права')}
          allowDeselect={false}
          data={[
            { label: t('Усі права'), value: 'all' },
            { label: t('Вибрані'), value: 'selected' },
            { label: t('Не вибрані'), value: 'unselected' },
          ]}
          value={stateFilter}
          onChange={(value) => setStateFilter((value || 'all') as EventPermissionStateFilter)}
        />
      </div>

      {roleError ? (
        <Alert className="event-permissions-alert" color="red" icon={<CircleAlert size={18} />} variant="light">
          {roleError}
        </Alert>
      ) : null}

      {inheritedKeys.size > 0 ? (
        <Alert className="event-permissions-alert" color="blue" variant="light">
          {t('Успадковані права з вкладки «Права сторінок»')}: {inheritedKeys.size}.{' '}
          {t('Щоб зняти таке право, спочатку приберіть його у вкладці «Права сторінок».')}
        </Alert>
      ) : null}

      {conflict ? (
        <Alert
          className="event-permissions-alert"
          color="yellow"
          icon={<CircleAlert size={18} />}
          title={t('Конфлікт змін')}
          variant="light"
        >
          <Group justify="space-between" gap="xs">
            <Text size="sm">
              {conflict.message}
              {typeof conflict.currentVersion === 'number'
                ? ` ${t('Актуальна версія')}: ${conflict.currentVersion}.`
                : ''}
            </Text>
            <button className="role-tree-text-action" type="button" onClick={reload}>
              {t('Завантажити актуальні права')}
            </button>
          </Group>
        </Alert>
      ) : null}

      {catalog?.catalogVersion && rolePermissions?.catalogVersion &&
      catalog.catalogVersion !== rolePermissions.catalogVersion ? (
        <Alert className="event-permissions-alert" color="yellow" variant="light">
          {t('Каталог прав оновився. Перед збереженням завантажте актуальний стан.')}
        </Alert>
      ) : null}

      {unavailableAssignedCount > 0 ? (
        <Alert className="event-permissions-alert" color="yellow" variant="light">
          {t('Для ролі є права, яких немає в активному каталозі')}: {unavailableAssignedCount}.
          {' '}{t('Завантажте актуальний стан перед збереженням.')}
        </Alert>
      ) : null}

      <Group className="role-tree-toolbar" justify="space-between" wrap="nowrap">
        <Group gap="xs" wrap="nowrap">
          <button
            className="role-tree-text-action"
            disabled={
              activeKeys.length === 0 ||
              activeKeys.every((key) => selectedKeys.has(key)) ||
              isSaving
            }
            type="button"
            onClick={() => selectKeys(activeKeys)}
          >
            {t('Вибрати все')}
          </button>
          <button
            className="role-tree-text-action"
            disabled={selectedEditableCount === 0 || isSaving}
            type="button"
            onClick={clearKeys}
          >
            {t('Очистити')}
          </button>
          {hasActiveFilters ? (
            <button
              className="role-tree-text-action"
              disabled={
                visibleKeys.length === 0 ||
                visibleKeys.every((key) => selectedKeys.has(key)) ||
                isSaving
              }
              type="button"
              onClick={() => selectKeys(visibleKeys)}
            >
              {t('Вибрати показані')}
            </button>
          ) : null}
        </Group>
        <Group className="role-tree-toolbar-stats" gap="xs" justify="flex-end" wrap="wrap">
          <Badge className="app-role-pill is-gray" variant="light">
            {t('Знайдено')}: {filteredPermissions.length}/{activePermissions.length}
          </Badge>
          <Badge className="app-role-pill is-gray" variant="light">
            {t('Права')}: {assignedKnownCount}/{activePermissions.length}
          </Badge>
        </Group>
      </Group>

      <ScrollArea.Autosize mah="calc(100vh - 430px)" type="auto">
        {tree.length > 0 ? (
          <Box className="role-tree-modules">
            {tree.map((section) => (
              <SectionRow
                key={section.id}
                expandedKeys={expandedKeys}
                forceExpanded={hasActiveFilters}
                inheritedKeys={inheritedKeys}
                section={section}
                selectedKeys={selectedKeys}
                onToggleExpanded={toggleExpanded}
                onToggleKeys={toggleKeys}
              />
            ))}
          </Box>
        ) : (
          <Text className="event-permissions-empty" c="dimmed" size="sm" ta="center">
            {t('Подієвих прав не знайдено')}
          </Text>
        )}
      </ScrollArea.Autosize>
    </Box>
  )
})

type TreeRowProps = {
  expandedKeys: ReadonlySet<string>
  forceExpanded: boolean
  inheritedKeys: ReadonlySet<string>
  selectedKeys: ReadonlySet<string>
  onToggleExpanded: (key: string) => void
  onToggleKeys: (keys: readonly string[]) => void
}

function SectionRow({
  expandedKeys,
  forceExpanded,
  inheritedKeys,
  section,
  selectedKeys,
  onToggleExpanded,
  onToggleKeys,
}: TreeRowProps & { section: EventPermissionSection }) {
  const { t } = useI18n()
  const expandedKey = sectionExpandedKey(section.id)
  const expanded = forceExpanded || expandedKeys.has(expandedKey)
  const keys = getTreePermissionKeys(section)
  const selection = getSelectionState(keys, selectedKeys)
  const selectedCount = keys.filter((key) => selectedKeys.has(key)).length

  return (
    <section className="role-tree-module">
      <div className="role-tree-module-header">
        <DisclosureButton
          expanded={expanded}
          label={`${expanded ? t('Згорнути') : t('Розгорнути')}: ${section.label}`}
          onClick={() => onToggleExpanded(expandedKey)}
        />
        <SelectionMark
          checked={selection.checked}
          disabled={keys.every((key) => inheritedKeys.has(key))}
          indeterminate={selection.indeterminate}
          label={`${t('Вибрати розділ')}: ${section.label}`}
          onChange={() => onToggleKeys(keys)}
        />
        <ThemeIcon className="role-tree-module-icon" color="gray" size={28} variant="light">
          <Folder size={16} />
        </ThemeIcon>
        <button className="role-tree-module-title" type="button" onClick={() => onToggleExpanded(expandedKey)}>
          <Text className="role-tree-module-name">{section.label}</Text>
          <Text className="role-tree-module-description">{section.id}</Text>
        </button>
        <div className="role-tree-module-stats">
          <Badge className="app-role-pill is-gray" variant="light">
            {section.pages.length} {t('стор.')}
          </Badge>
          <Badge className="app-role-pill is-gray" variant="light">
            {selectedCount}/{keys.length}
          </Badge>
        </div>
      </div>

      <Collapse expanded={expanded}>
        {expanded ? (
          <div className="role-tree-node-list">
            {section.pages.map((page) => (
              <PageRow
                key={page.id}
                expandedKeys={expandedKeys}
                forceExpanded={forceExpanded}
                inheritedKeys={inheritedKeys}
                page={page}
                sectionId={section.id}
                selectedKeys={selectedKeys}
                onToggleExpanded={onToggleExpanded}
                onToggleKeys={onToggleKeys}
              />
            ))}
          </div>
        ) : null}
      </Collapse>
    </section>
  )
}

function PageRow({
  expandedKeys,
  forceExpanded,
  inheritedKeys,
  page,
  sectionId,
  selectedKeys,
  onToggleExpanded,
  onToggleKeys,
}: TreeRowProps & { page: EventPermissionPage; sectionId: string }) {
  const { t } = useI18n()
  const expandedKey = pageExpandedKey(sectionId, page.id)
  const expanded = forceExpanded || expandedKeys.has(expandedKey)
  const keys = getPagePermissionKeys(page)
  const selection = getSelectionState(keys, selectedKeys)
  const selectedCount = keys.filter((key) => selectedKeys.has(key)).length

  return (
    <Box className={`role-tree-node${selection.checked ? ' is-selected' : ''}${selection.indeterminate ? ' is-mixed' : ''}`}>
      <div className="role-tree-node-row">
        <DisclosureButton
          expanded={expanded}
          label={`${expanded ? t('Згорнути') : t('Розгорнути')}: ${page.label}`}
          onClick={() => onToggleExpanded(expandedKey)}
        />
        <SelectionMark
          checked={selection.checked}
          disabled={keys.every((key) => inheritedKeys.has(key))}
          indeterminate={selection.indeterminate}
          label={`${t('Вибрати сторінку')}: ${page.label}`}
          onChange={() => onToggleKeys(keys)}
        />
        <ThemeIcon className="role-tree-node-icon" color="gray" size={26} variant="light">
          <FileText size={15} />
        </ThemeIcon>
        <button className="role-tree-node-title" type="button" onClick={() => onToggleExpanded(expandedKey)}>
          <Text className="role-tree-node-name">{page.label}</Text>
          <span className="role-tree-node-meta">
            {page.route ? (
              <span className="role-tree-route">
                <Route size={12} />
                {page.route}
              </span>
            ) : null}
            <span>{selectedCount}/{keys.length} {t('прав')}</span>
          </span>
        </button>
        <div className="role-tree-node-actions">
          <Badge className="app-role-pill is-gray" variant="light">
            {page.groups.length}
          </Badge>
        </div>
      </div>

      <Collapse expanded={expanded}>
        {expanded ? (
          <div className="role-tree-child-nodes">
            {page.groups.map((group) => (
              <GroupRow
                key={group.id}
                expandedKeys={expandedKeys}
                forceExpanded={forceExpanded}
                inheritedKeys={inheritedKeys}
                group={group}
                pageId={page.id}
                sectionId={sectionId}
                selectedKeys={selectedKeys}
                onToggleExpanded={onToggleExpanded}
                onToggleKeys={onToggleKeys}
              />
            ))}
          </div>
        ) : null}
      </Collapse>
    </Box>
  )
}

function GroupRow({
  expandedKeys,
  forceExpanded,
  inheritedKeys,
  group,
  pageId,
  sectionId,
  selectedKeys,
  onToggleExpanded,
  onToggleKeys,
}: TreeRowProps & {
  group: EventPermissionGroup
  pageId: string
  sectionId: string
}) {
  const { t } = useI18n()
  const expandedKey = groupExpandedKey(sectionId, pageId, group.id)
  const expanded = forceExpanded || expandedKeys.has(expandedKey)
  const keys = getGroupPermissionKeys(group)
  const selection = getSelectionState(keys, selectedKeys)
  const selectedCount = keys.filter((key) => selectedKeys.has(key)).length
  const rowStyle = { '--role-tree-indent': '18px' } as CSSProperties

  return (
    <Box
      className={`role-tree-node event-role-tree-group${selection.checked ? ' is-selected' : ''}${selection.indeterminate ? ' is-mixed' : ''}`}
      style={rowStyle}
    >
      <div className="role-tree-node-row">
        <DisclosureButton
          expanded={expanded}
          label={`${expanded ? t('Згорнути') : t('Розгорнути')}: ${group.label}`}
          onClick={() => onToggleExpanded(expandedKey)}
        />
        <SelectionMark
          checked={selection.checked}
          disabled={keys.every((key) => inheritedKeys.has(key))}
          indeterminate={selection.indeterminate}
          label={`${t('Вибрати групу')}: ${group.label}`}
          onChange={() => onToggleKeys(keys)}
        />
        <ThemeIcon className="role-tree-node-icon" color="gray" size={26} variant="light">
          <ListChecks size={15} />
        </ThemeIcon>
        <button className="role-tree-node-title" type="button" onClick={() => onToggleExpanded(expandedKey)}>
          <Text className="role-tree-node-name">{group.label}</Text>
          <span className="role-tree-node-meta">
            <span>{selectedCount}/{keys.length} {t('прав')}</span>
          </span>
        </button>
        <div className="role-tree-node-actions" />
      </div>

      <Collapse expanded={expanded}>
        {expanded ? (
          <div className="role-tree-permissions">
            {group.permissions.map((permission) => (
              <PermissionRow
                key={permission.key}
                permission={permission}
                inherited={inheritedKeys.has(permission.key)}
                selected={selectedKeys.has(permission.key)}
                onToggle={() => onToggleKeys([permission.key])}
              />
            ))}
          </div>
        ) : null}
      </Collapse>
    </Box>
  )
}

function PermissionRow({
  inherited,
  permission,
  selected,
  onToggle,
}: {
  inherited: boolean
  permission: EventPermissionDefinition
  selected: boolean
  onToggle: () => void
}) {
  const { t } = useI18n()
  const rowStyle = { '--role-tree-indent': '36px' } as CSSProperties

  return (
    <div
      className={`role-tree-permission${selected ? ' is-selected' : ''}`}
      style={rowStyle}
    >
      <span className="role-tree-connector" aria-hidden />
      <SelectionMark
        checked={selected}
        disabled={inherited}
        label={`${t('Вибрати право')}: ${permission.name} (${permission.key})`}
        size="sm"
        onChange={onToggle}
      />
      <ThemeIcon className="role-tree-permission-icon" color="gray" size={24} variant="light">
        <ShieldCheck size={14} />
      </ThemeIcon>
      <div className="role-tree-permission-body">
        <div className="role-tree-permission-copy">
          <div className="role-tree-permission-title-row">
            <Text className="role-tree-permission-name">{permission.name}</Text>
          </div>
          <div className="role-tree-permission-meta">
            {permission.description ? <span>{permission.description}</span> : null}
            <code>{permission.key}</code>
          </div>
        </div>
        <span className="role-tree-permission-body-line" aria-hidden />
      </div>
      <div className="role-tree-permission-actions">
        {inherited ? (
          <Badge color="blue" size="xs" variant="light">
            {t('Успадковано')}
          </Badge>
        ) : null}
        <Badge color={permission.risk === 'high' ? 'red' : permission.risk === 'medium' ? 'yellow' : 'gray'} size="xs" variant="light">
          {getRiskLabel(permission.risk, t)}
        </Badge>
        <Badge color="gray" size="xs" variant="light">
          {permission.controlType}
        </Badge>
      </div>
    </div>
  )
}

function DisclosureButton({
  expanded,
  label,
  onClick,
}: {
  expanded: boolean
  label: string
  onClick: () => void
}) {
  return (
    <ActionIcon
      aria-expanded={expanded}
      aria-label={label}
      className="role-tree-disclosure"
      color="gray"
      size="sm"
      variant="subtle"
      onClick={onClick}
    >
      <ChevronRight
        size={16}
        strokeWidth={2}
        style={{ transform: expanded ? 'rotate(90deg)' : undefined }}
      />
    </ActionIcon>
  )
}

function getRiskLabel(
  risk: EventPermissionDefinition['risk'],
  t: (value: string) => string,
): string {
  if (risk === 'high') {
    return t('Високий')
  }
  if (risk === 'medium') {
    return t('Середній')
  }
  return t('Низький')
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function readConflictVersion(payload: unknown): number | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined
  }

  const record = payload as Record<string, unknown>
  const directVersion = record.currentVersion ?? record.CurrentVersion
  if (typeof directVersion === 'number') {
    return directVersion
  }

  const body = record.Body
  if (body && typeof body === 'object') {
    const bodyRecord = body as Record<string, unknown>
    const bodyVersion = bodyRecord.currentVersion ?? bodyRecord.CurrentVersion
    return typeof bodyVersion === 'number' ? bodyVersion : undefined
  }

  return undefined
}

function sectionExpandedKey(sectionId: string): string {
  return `section:${sectionId}`
}

function pageExpandedKey(sectionId: string, pageId: string): string {
  return `page:${sectionId}:${pageId}`
}

function groupExpandedKey(
  sectionId: string,
  pageId: string,
  groupId: string,
): string {
  return `group:${sectionId}:${pageId}:${groupId}`
}

function toggleSetValue(
  current: ReadonlySet<string>,
  value: string,
): ReadonlySet<string> {
  const next = new Set(current)

  if (next.has(value)) {
    next.delete(value)
  } else {
    next.add(value)
  }

  return next
}

function readExpandedKeys(): ReadonlySet<string> {
  if (typeof window === 'undefined') {
    return new Set()
  }

  try {
    const value = window.sessionStorage.getItem(EXPANDED_STORAGE_KEY)
    const parsed = value ? (JSON.parse(value) as unknown) : []

    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === 'string')
        : [],
    )
  } catch {
    return new Set()
  }
}

function hasStoredExpandedKeys(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    return window.sessionStorage.getItem(EXPANDED_STORAGE_KEY) !== null
  } catch {
    return false
  }
}

function writeExpandedKeys(keys: ReadonlySet<string>) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.sessionStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify(Array.from(keys)))
  } catch {
    // Session storage may be blocked; expansion still works for this mount.
  }
}
