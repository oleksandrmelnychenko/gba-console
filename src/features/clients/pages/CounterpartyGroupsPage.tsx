import { Alert, Badge, Button, Checkbox, Group, Skeleton, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { CircleAlert, Folder, FolderInput, Folders, Pencil, Plus, RefreshCw, RotateCcw, Search, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { useNavigate } from 'react-router-dom'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import { ListTreeLayout } from '../../../shared/ui/tree/ListTreeLayout'
import { TreeView, type TreeViewNode } from '../../../shared/ui/tree/TreeView'
import { PermissionGate } from '../../auth/components/PermissionGate'
import { usePermissions } from '../../auth/usePermissions'
import {
  createCounterpartyGroup,
  deleteCounterpartyGroup,
  getCounterpartyGroupMembers,
  getCounterpartyGroupTree,
  moveClientsToCounterpartyGroup,
  updateCounterpartyGroup,
  type CounterpartyGroupDraft,
  type CounterpartyGroupMember,
  type CounterpartyGroupNode,
} from '../api/counterpartyGroupsApi'
import { CounterpartyGroupFormModal, CounterpartyGroupPickerModal } from '../components/CounterpartyGroupModals'
import {
  buildCounterpartyGroupForest,
  canHaveSubgroups,
  counterpartyGroupPath,
  filterCounterpartyGroupForest,
  type CounterpartyGroupBranch,
} from '../counterpartyGroupTree'
import './counterparty-groups-page.css'

const SEARCH_DEBOUNCE_MS = 300
const MEMBER_PAGE_SIZE = 50

type FormState = { mode: 'create'; parentNetUid: string | null } | { mode: 'edit'; group: CounterpartyGroupNode } | null

export function CounterpartyGroupsPage() {
  return (
    <PermissionGate permissionKey={PermissionKeys.Clients.Page.View} fallback={<CounterpartyGroupsPermissionDenied />}>
      <CounterpartyGroupsPageContent />
    </PermissionGate>
  )
}

function CounterpartyGroupsPermissionDenied() {
  const { t } = useI18n()
  return (
    <Alert color="red" icon={<CircleAlert size={18} />} title={t('Доступ заборонено')} variant="light">
      {t('У вашої ролі немає права переглядати групи контрагентів.')}
    </Alert>
  )
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function CounterpartyGroupsPageContent() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { can } = usePermissions()
  const canEdit = can(PermissionKeys.Clients.Client.Edit)
  const [groups, setGroups] = useValueState<CounterpartyGroupNode[]>([])
  const [isLoading, setLoading] = useValueState(true)
  const [loadError, setLoadError] = useValueState<string | null>(null)
  const [selectedNetUid, setSelectedNetUid] = useValueState<string | null>(null)
  const [treeSearchDraft, setTreeSearchDraft] = useValueState('')
  const [treeSearch] = useDebouncedValue(treeSearchDraft, SEARCH_DEBOUNCE_MS)
  const [memberSearchDraft, setMemberSearchDraft] = useValueState('')
  const [memberSearch] = useDebouncedValue(memberSearchDraft.trim(), SEARCH_DEBOUNCE_MS)
  const [members, setMembers] = useValueState<CounterpartyGroupMember[]>([])
  const [hasMoreMembers, setHasMoreMembers] = useValueState(false)
  const [membersLoading, setMembersLoading] = useValueState(false)
  const [membersError, setMembersError] = useValueState<string | null>(null)
  const [memberOffset, setMemberOffset] = useValueState(0)
  const [checked, setChecked] = useValueState<ReadonlySet<string>>(new Set())
  const [form, setForm] = useValueState<FormState>(null)
  const [moveOpened, setMoveOpened] = useValueState(false)
  const [saving, setSaving] = useValueState(false)
  const [actionError, setActionError] = useValueState<string | null>(null)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setLoadError(null)
    void getCounterpartyGroupTree(controller.signal)
      .then((result) => {
        setGroups(result)
        setSelectedNetUid((current) => current && result.some((group) => group.NetUid === current)
          ? current : result.find((group) => group.IsSystem && group.ParentNetUid === null)?.NetUid ?? result[0]?.NetUid ?? null)
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setLoadError(errorText(error, t('Не вдалося завантажити групи контрагентів.')))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [reloadKey, setGroups, setLoadError, setLoading, setSelectedNetUid, t])

  useEffect(() => {
    setMemberOffset(0)
    setChecked(new Set())
  }, [memberSearch, selectedNetUid, setChecked, setMemberOffset])

  useEffect(() => {
    if (!selectedNetUid) {
      setMembers([])
      setHasMoreMembers(false)
      return undefined
    }
    const controller = new AbortController()
    setMembersLoading(true)
    setMembersError(null)
    void getCounterpartyGroupMembers(selectedNetUid, memberSearch, memberOffset, MEMBER_PAGE_SIZE, controller.signal)
      .then((page) => {
        setMembers(page.Items)
        setHasMoreMembers(page.HasMore)
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setMembers([])
          setHasMoreMembers(false)
          setMembersError(errorText(error, t('Не вдалося завантажити контрагентів групи.')))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setMembersLoading(false)
      })
    return () => controller.abort()
  }, [memberOffset, memberSearch, reloadKey, selectedNetUid, setHasMoreMembers, setMembers, setMembersError, setMembersLoading, t])

  const selected = useMemo(() => groups.find((group) => group.NetUid === selectedNetUid) ?? null, [groups, selectedNetUid])
  const forest = useMemo(() => buildCounterpartyGroupForest(groups), [groups])
  const visibleForest = useMemo(() => filterCounterpartyGroupForest(forest, treeSearch), [forest, treeSearch])

  const toNode = useCallback((branch: CounterpartyGroupBranch): TreeViewNode => ({
    id: branch.group.NetUid,
    label: branch.group.Name,
    icon: branch.children.length > 0 ? <Folders size={15} /> : <Folder size={15} />,
    meta: (
      <>
        <span>{branch.group.ClientCount} {t('контрагентів')}</span>
        {branch.group.RegionCode ? <><span>·</span><span>{branch.group.RegionCode}</span></> : null}
      </>
    ),
    active: branch.group.NetUid === selectedNetUid,
    onActivate: () => setSelectedNetUid(branch.group.NetUid),
    defaultExpanded: branch.group.IsSystem || treeSearch.trim().length > 0,
    children: branch.children.map(toNode),
  }), [selectedNetUid, setSelectedNetUid, t, treeSearch])
  const treeNodes = useMemo(() => visibleForest.map(toNode), [toNode, visibleForest])

  const closeForm = () => {
    setForm(null)
    setActionError(null)
  }

  const submitForm = async (draft: CounterpartyGroupDraft) => {
    if (!form) return
    setSaving(true)
    setActionError(null)
    try {
      const saved = form.mode === 'create' ? await createCounterpartyGroup(draft) : await updateCounterpartyGroup(form.group.NetUid, draft)
      notifications.show({ color: 'green', message: form.mode === 'create' ? t('Групу створено.') : t('Групу змінено.') })
      setForm(null)
      if (saved) setSelectedNetUid(saved.NetUid)
      reload()
    } catch (error) {
      setActionError(errorText(error, t('Не вдалося зберегти групу.')))
    } finally {
      setSaving(false)
    }
  }

  const removeSelected = async () => {
    if (!selected || !window.confirm(t('Видалити групу «{name}»?', { name: selected.Name }))) return
    setSaving(true)
    try {
      await deleteCounterpartyGroup(selected.NetUid)
      notifications.show({ color: 'green', message: t('Групу видалено.') })
      setSelectedNetUid(selected.ParentNetUid)
      reload()
    } catch (error) {
      notifications.show({ color: 'red', message: errorText(error, t('Не вдалося видалити групу.')) })
    } finally {
      setSaving(false)
    }
  }

  const moveChecked = async (groupNetUid: string) => {
    setSaving(true)
    setActionError(null)
    try {
      const moved = await moveClientsToCounterpartyGroup([...checked], groupNetUid)
      notifications.show({ color: 'green', message: t('Перенесено контрагентів: {count}.', { count: moved }) })
      setMoveOpened(false)
      setChecked(new Set())
      reload()
    } catch (error) {
      setActionError(errorText(error, t('Не вдалося перенести контрагентів.')))
    } finally {
      setSaving(false)
    }
  }

  const toggleChecked = useCallback((netUid: string) => setChecked((current) => {
    const next = new Set(current)
    if (next.has(netUid)) next.delete(netUid)
    else next.add(netUid)
    return next
  }), [setChecked])

  const columns = useMemo<DataTableColumn<CounterpartyGroupMember>[]>(() => [
    ...(canEdit ? [{
      id: 'select',
      header: '',
      width: 44,
      enableSorting: false,
      enableHiding: false,
      cell: (member: CounterpartyGroupMember) => (
        <Checkbox
          aria-label={t('Вибрати {name}', { name: member.Name })}
          checked={checked.has(member.ClientNetUid)}
          onChange={() => toggleChecked(member.ClientNetUid)}
          onClick={(event) => event.stopPropagation()}
        />
      ),
    }] : []),
    { id: 'name', header: t('Контрагент'), accessor: (member) => member.Name, fill: true, minWidth: 260 },
    { id: 'region', header: t('Код по регіону'), accessor: (member) => member.RegionCode ?? '', width: 140 },
    { id: 'usreou', header: t('ЄДРПОУ'), accessor: (member) => member.Usreou ?? '', width: 140 },
    {
      id: 'placement',
      header: t('Розміщення'),
      width: 170,
      cell: (member) => !member.IsPlaced
        ? <Text c="dimmed" size="sm">{t('без групи')}</Text>
        : member.IsManuallyPlaced ? <Badge color="blue" variant="light">{t('змінено в GBA')}</Badge>
          : <Badge color="gray" variant="light">{t('з 1С')}</Badge>,
    },
  ], [canEdit, checked, t, toggleChecked])

  const selectedPath = selected ? counterpartyGroupPath(groups, selected.NetUid) : ''

  return (
    <Stack className="counterparty-groups-page" gap={6}>
      {loadError ? <Alert color="red" icon={<CircleAlert size={18} />} variant="light">{loadError}</Alert> : null}
      <ListTreeLayout
        className="counterparty-groups-layout"
        list={
          <Stack gap={6}>
            <div className="app-filter-bar counterparty-groups-filter-bar">
              <Group align="end" gap={10} wrap="nowrap" className="app-filter-fields counterparty-groups-filter-row">
                <TextInput
                  className="counterparty-groups-search"
                  label={t('Пошук групи')}
                  leftSection={<Search size={16} />}
                  value={treeSearchDraft}
                  onChange={(event) => setTreeSearchDraft(event.currentTarget.value)}
                />
                <div className="app-filter-actions">
                  <Tooltip label={t('Скинути')}>
                    <Button aria-label={t('Скинути')} className="registry-caption-action" color="gray" leftSection={<RotateCcw size={17} />}
                      size="sm" variant="default" onClick={() => setTreeSearchDraft('')}>{t('Скинути')}</Button>
                  </Tooltip>
                  <Tooltip label={t('Оновити')}>
                    <Button aria-label={t('Оновити')} className="registry-caption-action" color="gray" leftSection={<RefreshCw size={17} />}
                      loading={isLoading} size="sm" variant="default" onClick={() => reload()}>{t('Оновити')}</Button>
                  </Tooltip>
                </div>
              </Group>
            </div>
            {isLoading && groups.length === 0 ? (
              <Stack gap={5}>{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} height={38} radius={7} />)}</Stack>
            ) : (
              <TreeView key={treeSearch.trim()} className="counterparty-groups-tree" emptyText={t('Груп не знайдено')} nodes={treeNodes} />
            )}
          </Stack>
        }
        detail={selected ? (
          <Stack gap="sm">
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Stack gap={4}>
                <Text fw={600} size="lg">{selected.Name}</Text>
                <Text c="dimmed" size="sm">{selectedPath}</Text>
                <Group gap={6}>
                  {selected.IsSystem ? <Badge color="violet" variant="light">{t('системна')}</Badge> : null}
                  {selected.IsFromOneC ? <Badge color="gray" variant="light">{t('з 1С')}</Badge> : <Badge color="teal" variant="light">{t('створена в GBA')}</Badge>}
                  {selected.IsManuallyEdited && selected.IsFromOneC ? <Badge color="blue" variant="light">{t('змінена в GBA')}</Badge> : null}
                  {selected.RegionCode ? <Badge color="orange" variant="light">{selected.RegionCode}</Badge> : null}
                  <Badge color="gray" variant="outline">{t('{count} контрагентів', { count: selected.ClientCount })}</Badge>
                </Group>
              </Stack>
              {canEdit ? (
                <Group gap={6} wrap="nowrap">
                  {canHaveSubgroups(selected) ? (
                    <Button leftSection={<Plus size={16} />} size="sm" variant="light"
                      onClick={() => setForm({ mode: 'create', parentNetUid: selected.NetUid })}>{t('Підгрупа')}</Button>
                  ) : null}
                  {!selected.IsSystem ? (
                    <>
                      <Button leftSection={<Pencil size={16} />} size="sm" variant="default"
                        onClick={() => setForm({ mode: 'edit', group: selected })}>{t('Змінити')}</Button>
                      <Button color="red" leftSection={<Trash2 size={16} />} loading={saving} size="sm" variant="light"
                        onClick={() => void removeSelected()}>{t('Видалити')}</Button>
                    </>
                  ) : null}
                </Group>
              ) : null}
            </Group>
            {selected.IsUngrouped ? (
              <Text c="dimmed" size="sm">
                {t('Тут контрагенти, яких перенесли в «Без групи», і всі контрагенти без групи. Покупці без групи входять у групу «Покупці» у звітах.')}
              </Text>
            ) : null}
            <div className="app-filter-bar counterparty-groups-filter-bar">
              <Group align="end" gap={10} wrap="nowrap" className="app-filter-fields counterparty-groups-filter-row">
                <TextInput
                  className="counterparty-groups-search"
                  label={t('Пошук контрагента')}
                  leftSection={<Search size={16} />}
                  placeholder={t('Назва, ЄДРПОУ або код')}
                  value={memberSearchDraft}
                  onChange={(event) => setMemberSearchDraft(event.currentTarget.value)}
                />
                {canEdit ? (
                  <div className="app-filter-actions">
                    <Button disabled={checked.size === 0} leftSection={<FolderInput size={17} />} size="sm"
                      onClick={() => {
                        setActionError(null)
                        setMoveOpened(true)
                      }}>
                      {t('Перемістити ({count})', { count: checked.size })}
                    </Button>
                  </div>
                ) : null}
              </Group>
            </div>
            {membersError ? <Alert color="red" icon={<CircleAlert size={18} />} variant="light">{membersError}</Alert> : null}
            <DataTable
              columns={columns}
              data={members}
              emptyText={t('У групі немає контрагентів')}
              getRowId={(member) => member.ClientNetUid}
              isLoading={membersLoading}
              showLayoutControls={false}
              showToolbar={false}
              tableId="counterparty-group-members"
              onRowClick={(member) => navigate(`/clients/edit/${member.ClientNetUid}`)}
            />
            {memberOffset > 0 || hasMoreMembers ? (
              <Group gap="xs" justify="center">
                <Button disabled={memberOffset === 0} variant="default"
                  onClick={() => setMemberOffset((offset) => Math.max(0, offset - MEMBER_PAGE_SIZE))}>
                  {t('Попередні')}
                </Button>
                <Text c="dimmed" size="sm">{t('{from}–{to}', { from: memberOffset + 1, to: memberOffset + members.length })}</Text>
                <Button disabled={!hasMoreMembers} variant="default"
                  onClick={() => setMemberOffset((offset) => offset + MEMBER_PAGE_SIZE)}>
                  {t('Наступні')}
                </Button>
              </Group>
            ) : null}
          </Stack>
        ) : <Text c="dimmed">{t('Оберіть групу в дереві')}</Text>}
      />
      <CounterpartyGroupFormModal
        edited={form?.mode === 'edit' ? form.group : null}
        error={actionError}
        groups={groups}
        opened={form !== null}
        parentNetUid={form?.mode === 'create' ? form.parentNetUid : null}
        saving={saving}
        onClose={closeForm}
        onSubmit={(draft) => void submitForm(draft)}
      />
      <CounterpartyGroupPickerModal
        currentNetUid={selected?.NetUid ?? null}
        description={t('Звіти й список клієнтів одразу покажуть контрагентів у новій групі. Синхронізація з 1С їх не повертає.')}
        error={actionError}
        groups={groups}
        opened={moveOpened}
        saving={saving}
        title={t('Перемістити контрагентів')}
        onClose={() => setMoveOpened(false)}
        onSubmit={(groupNetUid) => void moveChecked(groupNetUid)}
      />
    </Stack>
  )
}
