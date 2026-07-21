import { ActionIcon, Alert, Group, Loader, Skeleton, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { CircleAlert, Folder, Folders, RefreshCw, RotateCcw, Search } from 'lucide-react'
import { useEffect, useMemo, useReducer } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useValueState } from '../../../shared/hooks/useValueState'
import { ListTreeItem, ListTreeLayout } from '../../../shared/ui/tree/ListTreeLayout'
import { TreeView, type TreeViewNode } from '../../../shared/ui/tree/TreeView'
import { getProductGroupWithRoot, getProductGroups } from '../api/productGroupsApi'
import type { ProductGroup } from '../types'
import { getProductGroupName } from '../utils'
import './product-groups-page.css'

const SEARCH_DEBOUNCE_MS = 300

/**
 * Pilot of the reusable «list + visual tree» pattern (extracted from the Roles
 * screen) applied to product groups: left = the group list, right = the selected
 * group's subgroup hierarchy as an expand/collapse tree.
 */
export function ProductGroupsTreePage() {
  const { t } = useI18n()
  const [groups, setGroups] = useValueState<ProductGroup[]>([])
  const [selectedNetUid, setSelectedNetUid] = useValueState<string | null>(null)
  const [detail, setDetail] = useValueState<ProductGroup | null>(null)
  const [searchDraft, setSearchDraft] = useValueState('')
  const [searchValue] = useDebouncedValue(searchDraft.trim(), SEARCH_DEBOUNCE_MS)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isDetailLoading, setDetailLoading] = useValueState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    void getProductGroups(searchValue)
      .then((result) => {
        if (cancelled) {
          return
        }
        setGroups(result.ProductGroups)
        setSelectedNetUid((current) =>
          current && result.ProductGroups.some((group) => group.NetUid === current)
            ? current
            : result.ProductGroups[0]?.NetUid || null,
        )
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setGroups([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити групи товарів'))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [reloadKey, searchValue, setError, setGroups, setLoading, setSelectedNetUid, t])

  useEffect(() => {
    if (!selectedNetUid) {
      setDetail(null)
      return
    }

    let cancelled = false
    setDetailLoading(true)

    void getProductGroupWithRoot(selectedNetUid)
      .then((result) => {
        if (!cancelled) {
          setDetail(result)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDetail(null)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDetailLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [reloadKey, selectedNetUid, setDetail, setDetailLoading])

  const selectedGroup = useMemo(
    () => groups.find((group) => group.NetUid === selectedNetUid) || null,
    [groups, selectedNetUid],
  )
  const treeNodes = useMemo(() => (detail ? [buildGroupNode(detail, t)] : []), [detail, t])

  return (
    <Stack className="product-groups-tree-page" gap={6}>
      <ListTreeLayout
        className="product-groups-tree-layout"
        list={
          <Stack className="product-groups-tree-list-pane" gap={6}>
            <div className="app-filter-bar product-groups-tree-filter-bar">
              <Group align="end" gap={10} wrap="nowrap" className="product-groups-tree-filter-row">
                <TextInput
                  label={t('Пошук групи')}
                  leftSection={<Search size={16} />}
                  style={{ flex: '1 1 auto', minWidth: 160 }}
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.currentTarget.value)}
                />
                <div className="app-filter-actions">
                  <Tooltip label={t('Скинути')}>
                    <ActionIcon
                      aria-label={t('Скинути')}
                      color="gray"
                      size={34}
                      variant="light"
                      onClick={() => setSearchDraft('')}
                    >
                      <RotateCcw size={17} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label={t('Оновити')}>
                    <ActionIcon aria-label={t('Оновити')} color="gray" loading={isLoading} size={34} variant="light" onClick={() => reload()}>
                      <RefreshCw size={17} />
                    </ActionIcon>
                  </Tooltip>
                </div>
              </Group>
            </div>

            <div className="product-groups-tree-list-body">
              {error ? (
                <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
                  {error}
                </Alert>
              ) : null}

              {isLoading ? (
                <Stack gap={5}>
                  {Array.from({ length: 6 }, (_, index) => (
                    <Skeleton key={index} height={46} radius={7} />
                  ))}
                </Stack>
              ) : groups.length > 0 ? (
                <div className="list-tree-list">
                  {groups.map((group, index) => (
                    <ListTreeItem
                      key={group.NetUid || group.Id || index}
                      index={index}
                      metrics={[
                        { value: group.TotalProductSubGroup ?? 0, label: t('підгр.') },
                        { value: group.TotalProduct ?? 0, label: t('тов.') },
                      ]}
                      name={getProductGroupName(group)}
                      selected={group.NetUid === selectedNetUid}
                      onSelect={() => setSelectedNetUid(group.NetUid || null)}
                    />
                  ))}
                </div>
              ) : (
                <div className="list-tree-empty">
                  <Text c="dimmed" size="sm">
                    {t('Груп товарів не знайдено')}
                  </Text>
                </div>
              )}
            </div>
          </Stack>
        }
        detail={
          isDetailLoading ? (
            <Group justify="center" gap="xs" py="lg">
              <Loader size="sm" />
              <Text c="dimmed" size="sm">
                {t('Завантаження')}
              </Text>
            </Group>
          ) : selectedGroup ? (
            <TreeView
              defaultExpandedDepth={1}
              emptyText={t('У групи немає підгруп')}
              nodes={treeNodes}
            />
          ) : (
            <Text c="dimmed">{t('Оберіть групу зі списку')}</Text>
          )
        }
      />
    </Stack>
  )
}

function buildGroupNode(group: ProductGroup, t: (value: string) => string): TreeViewNode {
  const subGroups = (group.SubProductGroups || []).reduce<ProductGroup[]>((acc, link) => {
    if (link.SubProductGroup) {
      acc.push(link.SubProductGroup)
    }
    return acc
  }, [])
  const children = subGroups.map((child) => buildGroupNode(child, t))

  return {
    id: String(group.NetUid || group.Id || getProductGroupName(group)),
    label: getProductGroupName(group),
    icon: children.length > 0 ? <Folders size={15} /> : <Folder size={15} />,
    meta: (
      <>
        <span>
          {group.TotalProductSubGroup ?? subGroups.length} {t('підгруп')}
        </span>
        <span>·</span>
        <span>
          {group.TotalProduct ?? 0} {t('товарів')}
        </span>
      </>
    ),
    children,
    defaultExpanded: true,
  }
}
