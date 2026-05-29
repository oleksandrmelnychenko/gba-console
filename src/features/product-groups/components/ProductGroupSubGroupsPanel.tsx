import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { IconAlertCircle, IconPencil, IconRefresh, IconRestore, IconSearch } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useNavigate } from 'react-router-dom'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { getProductSubGroups } from '../api/productGroupsApi'
import type { ProductGroup, ProductSubGroup } from '../types'
import { displayValue, formatProductGroupDate, getProductGroupName } from '../utils'

const PAGE_LIMIT_OPTIONS = ['15', '25', '50', '100', '150', '200']
const PRODUCT_GROUP_SEARCH_DEBOUNCE_MS = 300

const SUB_GROUPS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['name'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

type ProductGroupSubGroupsPanelProps = {
  productGroupNetId: string
}

export function ProductGroupSubGroupsPanel({ productGroupNetId }: ProductGroupSubGroupsPanelProps) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [subGroups, setSubGroups] = useValueState<ProductSubGroup[]>([])
  const [searchDraft, setSearchDraft] = useValueState('')
  const [searchValue] = useDebouncedValue(searchDraft.trim(), PRODUCT_GROUP_SEARCH_DEBOUNCE_MS)
  const [limit, setLimit] = useValueState(50)
  const [totalFilteredQty, setTotalFilteredQty] = useValueState(0)
  const [totalQty, setTotalQty] = useValueState(0)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isLoadingMore, setLoadingMore] = useValueState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const loadSequenceRef = useRef(0)
  const canLoadMore = subGroups.length < totalFilteredQty
  const openSubGroup = useCallback(
    (productGroup?: ProductGroup | null) => {
      if (productGroup?.NetUid) {
        navigate(`/product-groups/${productGroup.NetUid}`, {
          state: {
            nodeTitle: getProductGroupName(productGroup),
          },
        })
      }
    },
    [navigate],
  )
  const columns = useMemo<DataTableColumn<ProductSubGroup>[]>(
    () => [
      {
        id: 'name',
        header: 'Назва',
        width: 260,
        minWidth: 220,
        accessor: (subGroup) => getProductGroupName(subGroup.SubProductGroup),
        cell: (subGroup) => (
          <Text fw={600}>{getProductGroupName(subGroup.SubProductGroup)}</Text>
        ),
      },
      {
        id: 'description',
        header: 'Опис',
        width: 280,
        minWidth: 180,
        accessor: (subGroup) => subGroup.SubProductGroup?.Description,
        cell: (subGroup) => displayValue(subGroup.SubProductGroup?.Description),
      },
      {
        id: 'totalSubGroups',
        header: 'Підгрупи',
        width: 120,
        minWidth: 104,
        align: 'right',
        accessor: (subGroup) => subGroup.SubProductGroup?.TotalProductSubGroup,
        cell: (subGroup) => displayValue(subGroup.SubProductGroup?.TotalProductSubGroup),
      },
      {
        id: 'totalProducts',
        header: 'Товари',
        width: 120,
        minWidth: 104,
        align: 'right',
        accessor: (subGroup) => subGroup.SubProductGroup?.TotalProduct,
        cell: (subGroup) => displayValue(subGroup.SubProductGroup?.TotalProduct),
      },
      {
        id: 'created',
        header: 'Створено',
        width: 140,
        minWidth: 120,
        accessor: (subGroup) => subGroup.SubProductGroup?.Created,
        cell: (subGroup) => formatProductGroupDate(subGroup.SubProductGroup?.Created),
      },
      {
        id: 'actions',
        header: '',
        width: 58,
        minWidth: 58,
        maxWidth: 58,
        align: 'center',
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
        cell: (subGroup) => (
          <Box onClick={(event) => event.stopPropagation()}>
            <Tooltip label={t('Відкрити')}>
              <ActionIcon
                aria-label={t('Відкрити')}
                color="gray"
                disabled={!subGroup.SubProductGroup?.NetUid}
                variant="subtle"
                onClick={() => openSubGroup(subGroup.SubProductGroup)}
              >
                <IconPencil size={18} />
              </ActionIcon>
            </Tooltip>
          </Box>
        ),
      },
    ],
    [openSubGroup, t],
  )
  const toolbarLeft = useMemo(
    () => (
      <Text size="xs" c="dimmed">
        {t('Показано')} {subGroups.length} {t('з')} {totalFilteredQty}
        {searchValue ? `, ${t('пошук')}: ${searchValue}` : ''}
      </Text>
    ),
    [searchValue, subGroups.length, totalFilteredQty, t],
  )

  const loadSubGroups = useCallback(
    async (offset: number, append: boolean) => {
      const loadSequence = loadSequenceRef.current + 1

      loadSequenceRef.current = loadSequence

      if (append) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }

      setError(null)

      try {
        const response = await getProductSubGroups({
          limit,
          netId: productGroupNetId,
          offset,
          value: searchValue,
        })

        if (loadSequence === loadSequenceRef.current) {
          setSubGroups((currentSubGroups) =>
            append ? [...currentSubGroups, ...response.ProductSubGroups] : response.ProductSubGroups,
          )
          setTotalFilteredQty(response.TotalFilteredQty)
          setTotalQty(response.TotalQty)
        }
      } catch (loadError) {
        if (loadSequence === loadSequenceRef.current) {
          if (!append) {
            setSubGroups([])
            setTotalFilteredQty(0)
            setTotalQty(0)
          }

          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити підгрупи'))
        }
      } finally {
        if (loadSequence === loadSequenceRef.current) {
          setLoading(false)
          setLoadingMore(false)
        }
      }
    },
    [limit, productGroupNetId, searchValue, setError, setLoading, setLoadingMore, setSubGroups, setTotalFilteredQty, setTotalQty, t],
  )

  useEffect(() => {
    void loadSubGroups(0, false)
  }, [loadSubGroups, reloadKey])

  function updateSearch(nextSearchValue: string) {
    setSearchDraft(nextSearchValue)
  }

  function resetSearch() {
    setSearchDraft('')
  }

  return (
    <Stack gap="md">
      <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
        <TextInput
          leftSection={<IconSearch size={16} />}
          label={t('Пошук')}
          placeholder={t('Назва або опис')}
          value={searchDraft}
          onChange={(event) => updateSearch(event.currentTarget.value)}
          style={{ flex: '1 1 auto', minWidth: 160 }}
        />
        <Select
          aria-label={t('Кількість')}
          data={PAGE_LIMIT_OPTIONS}
          value={String(limit)}
          w={96}
          onChange={(value) => setLimit(Number(value || 50))}
        />
        <Tooltip label={t('Скинути')}>
          <ActionIcon
            aria-label={t('Скинути')}
            color="gray"
            size={36}
            style={{ flex: '0 0 auto' }}
            variant="light"
            onClick={resetSearch}
          >
            <IconRestore size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={t('Оновити')}>
          <ActionIcon
            aria-label={t('Оновити')}
            color="gray"
            loading={isLoading}
            size={36}
            style={{ flex: '0 0 auto' }}
            variant="light"
            onClick={() => reload()}
          >
            <IconRefresh size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {error}
        </Alert>
      )}

      <DataTable
        columns={columns}
        data={subGroups}
        defaultLayout={SUB_GROUPS_TABLE_DEFAULT_LAYOUT}
        emptyText="Підгруп не знайдено"
        getRowId={(subGroup, index) => String(subGroup.SubProductGroup?.NetUid || subGroup.Id || index)}
        isLoading={isLoading}
        layoutVersion="product-group-subgroups-table-1"
        loadingText="Завантаження підгруп"
        maxHeight="calc(100vh - 420px)"
        minWidth={980}
        tableId={`product-group-subgroups-${productGroupNetId}`}
        toolbarLeft={toolbarLeft}
        onRowClick={(subGroup) => openSubGroup(subGroup.SubProductGroup)}
      />

      <Group justify="space-between">
        <Text size="xs" c="dimmed">
          {t('Усього')}: {totalQty}
        </Text>
        <Button
          color="gray"
          disabled={!canLoadMore}
          loading={isLoadingMore}
          size="xs"
          variant="light"
          onClick={() => loadSubGroups(subGroups.length, true)}
        >
          {t('Завантажити ще')}
        </Button>
      </Group>
    </Stack>
  )
}
