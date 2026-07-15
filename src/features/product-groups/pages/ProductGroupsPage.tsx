import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { AppModal } from "../../../shared/ui/AppModal"
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { notifications } from '@mantine/notifications'
import { useDebouncedValue } from '@mantine/hooks'
import { CircleAlert, Pencil, Plus, RefreshCw, RotateCcw, Search } from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useMemo, useReducer } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useLocation, useNavigate } from 'react-router-dom'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import { DataTableDensityToggle } from '../../../shared/ui/data-table/DataTableDensityToggle'
import { useDataTableDensity } from '../../../shared/ui/data-table/useDataTableDensity'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { PermissionGate } from '../../auth/components/PermissionGate'
import { createProductGroup, getProductGroups, getRootProductGroups } from '../api/productGroupsApi'
import { PRODUCT_GROUPS_ADD_PERMISSION } from '../permissions'
import { ProductGroupForm } from '../components/ProductGroupForm'
import type { ProductGroup, ProductSubGroup } from '../types'
import {
  createEmptyProductGroup,
  displayValue,
  formatProductGroupDate,
  getCurrentRootProductGroupName,
  getProductGroupFullName,
  getProductGroupName,
  normalizeProductGroupForSave,
  validateProductGroup,
} from '../utils'
import './product-groups-page.css'

const PRODUCT_GROUPS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['status', 'name'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const PRODUCT_GROUP_SEARCH_DEBOUNCE_MS = 300

type ProductGroupFieldChange = <TKey extends keyof ProductGroup>(key: TKey, value: ProductGroup[TKey]) => void

export function ProductGroupsPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const [productGroups, setProductGroups] = useValueState<ProductGroup[]>([])
  const [rootGroups, setRootGroups] = useValueState<ProductGroup[]>([])
  const [createDraft, setCreateDraft] = useValueState<ProductGroup>(() => createEmptyProductGroup())
  const [selectedRootNetUid, setSelectedRootNetUid] = useValueState<string | null>(null)
  const [searchDraft, setSearchDraft] = useValueState('')
  const [searchValue] = useDebouncedValue(searchDraft.trim(), PRODUCT_GROUP_SEARCH_DEBOUNCE_MS)
  const [error, setError] = useValueState<string | null>(null)
  const [createError, setCreateError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isLoadingRootGroups, setLoadingRootGroups] = useValueState(false)
  const [isCreating, setCreating] = useValueState(false)
  const [createModalOpened, setCreateModalOpened] = useValueState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const openProductGroup = useCallback(
    (productGroup: ProductGroup) => {
      if (!productGroup.NetUid) {
        return
      }

      navigate(`/product-groups/${productGroup.NetUid}`, {
        state: {
          backgroundLocation: location,
          nodeTitle: getProductGroupName(productGroup),
          returnPath: `${location.pathname}${location.search}`,
        },
      })
    },
    [location, navigate],
  )
  const columns = useProductGroupColumns(openProductGroup)
  const { density, toggleDensity } = useDataTableDensity(
    'product-groups',
    PRODUCT_GROUPS_TABLE_DEFAULT_LAYOUT.density,
  )

  useEffect(() => {
    let cancelled = false

    async function loadProductGroups() {
      setLoading(true)
      setError(null)

      try {
        const response = await getProductGroups(searchValue)

        if (!cancelled) {
          setProductGroups(response.ProductGroups)
        }
      } catch (loadError) {
        if (!cancelled) {
          setProductGroups([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити групи товарів'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadProductGroups()

    return () => {
      cancelled = true
    }
  }, [reloadKey, searchValue, setError, setLoading, setProductGroups, t])

  useEffect(() => {
    if (!createModalOpened) {
      return
    }

    let cancelled = false

    async function loadRootGroups() {
      setLoadingRootGroups(true)
      setCreateError(null)

      try {
        const nextRootGroups = await getRootProductGroups()

        if (!cancelled) {
          setRootGroups(nextRootGroups)
        }
      } catch (loadError) {
        if (!cancelled) {
          setRootGroups([])
          setCreateError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити батьківські групи'))
        }
      } finally {
        if (!cancelled) {
          setLoadingRootGroups(false)
        }
      }
    }

    void loadRootGroups()

    return () => {
      cancelled = true
    }
  }, [createModalOpened, setCreateError, setLoadingRootGroups, setRootGroups, t])

  function updateSearch(nextSearchValue: string) {
    setSearchDraft(nextSearchValue)
  }

  function resetSearch() {
    setSearchDraft('')
  }

  function closeCreateModal() {
    setCreateModalOpened(false)
    setCreateError(null)
    setCreateDraft(createEmptyProductGroup())
    setSelectedRootNetUid(null)
  }

  function setCreateField<TKey extends keyof ProductGroup>(key: TKey, value: ProductGroup[TKey]) {
    setCreateDraft((currentDraft) => ({
      ...currentDraft,
      [key]: value,
    }))
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const selectedRootGroup = rootGroups.find((rootGroup) => rootGroup.NetUid === selectedRootNetUid) || null
    const rootProductGroups: ProductSubGroup[] = selectedRootGroup ? [{ RootProductGroup: selectedRootGroup }] : []
    const payload = normalizeProductGroupForSave(createDraft, rootProductGroups)
    const validationError = validateProductGroup(payload)

    if (validationError) {
      setCreateError(validationError)
      return
    }

    setCreating(true)
    setCreateError(null)

    try {
      const createdProductGroup = await createProductGroup(payload)

      notifications.show({
        color: 'green',
        message: t('Групу товарів створено'),
      })
      closeCreateModal()

      if (createdProductGroup?.NetUid) {
        navigate(`/product-groups/${createdProductGroup.NetUid}`, {
          state: {
            backgroundLocation: location,
            nodeTitle: getProductGroupName(createdProductGroup),
            returnPath: `${location.pathname}${location.search}`,
          },
        })
      } else {
        reload()
      }
    } catch (createError) {
      setCreateError(createError instanceof Error ? createError.message : t('Не вдалося створити групу товарів'))
    } finally {
      setCreating(false)
    }
  }

  return (
    <Stack className="product-groups-page" gap={6}>
      <Card className="app-data-card product-groups-card" withBorder radius="md" padding={0}>
        <div className="app-filter-bar product-groups-filter-bar">
          <Group align="end" gap={10} wrap="nowrap" className="clients-filter-row">
            <TextInput
              leftSection={<Search size={16} />}
              label={t('Пошук')}
              placeholder={t('Назва або опис')}
              value={searchDraft}
              onChange={(event) => updateSearch(event.currentTarget.value)}
              style={{ flex: '1 1 auto', minWidth: 160 }}
            />
            <div className="app-filter-actions">
              <Tooltip label={t('Скинути')}>
                <ActionIcon
                  aria-label={t('Скинути')}
                  color="gray"
                  size={34}
                  variant="light"
                  onClick={resetSearch}
                >
                  <RotateCcw size={17} />
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
                  onClick={() => reload()}
                >
                  <RefreshCw size={18} />
                </ActionIcon>
              </Tooltip>
              <DataTableDensityToggle density={density} onToggle={toggleDensity} size={34} />
            </div>
            <PermissionGate permissionKey={PRODUCT_GROUPS_ADD_PERMISSION}>
              <Button
                color={CREATE_ACTION_COLOR}
                leftSection={<Plus size={16} />}
                size="sm"
                styles={{ label: { fontFamily: 'var(--font-mono)', letterSpacing: 0 } }}
                type="button"
                onClick={() => setCreateModalOpened(true)}
              >
                {t('Нова група')}
              </Button>
            </PermissionGate>
          </Group>
        </div>

        {error && (
          <Alert
            className="product-groups-page__alert"
            color="red"
            icon={<CircleAlert size={18} />}
            variant="light"
          >
            {error}
          </Alert>
        )}

        <div className="product-groups-page__table">
          <DataTable
            columns={columns}
            data={productGroups}
            defaultLayout={PRODUCT_GROUPS_TABLE_DEFAULT_LAYOUT}
            density={density}
            emptyText="Груп товарів не знайдено"
            getRowId={(productGroup, index) => String(productGroup.NetUid || productGroup.Id || index)}
            height="100%"
            isLoading={isLoading}
            layoutVersion="product-groups-table-2"
            loadingText="Завантаження груп товарів"
            minWidth={1660}
            tableId="product-groups"
            onRowClick={openProductGroup}
          />
        </div>
      </Card>

      <ProductGroupCreateModal
        createDraft={createDraft}
        createError={createError}
        isCreating={isCreating}
        isLoadingRootGroups={isLoadingRootGroups}
        opened={createModalOpened}
        rootGroups={rootGroups}
        selectedRootNetUid={selectedRootNetUid}
        onClose={closeCreateModal}
        onFieldChange={setCreateField}
        onRootGroupChange={setSelectedRootNetUid}
        onSubmit={handleCreate}
      />
    </Stack>
  )
}

function useProductGroupColumns(openProductGroup: (productGroup: ProductGroup) => void) {
  const { t } = useI18n()

  return useMemo<DataTableColumn<ProductGroup>[]>(
    () => [
      {
        id: 'status',
        header: 'Статус',
        width: 116,
        minWidth: 104,
        accessor: (productGroup) => (productGroup.IsActive === false ? t('Неактивна') : t('Активна')),
        cell: (productGroup) => (
          <Badge className={productGroup.IsActive === false ? 'app-role-pill is-gray' : 'app-role-pill is-green'} variant="light">
            {productGroup.IsActive === false ? t('Неактивна') : t('Активна')}
          </Badge>
        ),
      },
      {
        id: 'name',
        header: 'Назва',
        width: 280,
        minWidth: 220,
        accessor: getProductGroupName,
        cell: (productGroup) => (
          <Text fw={600}>{getProductGroupName(productGroup)}</Text>
        ),
      },
      {
        id: 'fullName',
        header: 'Повна назва',
        width: 260,
        minWidth: 200,
        accessor: getProductGroupFullName,
        cell: (productGroup) => displayValue(getProductGroupFullName(productGroup)),
      },
      {
        id: 'rootGroup',
        header: 'Батьківська група',
        width: 220,
        minWidth: 170,
        accessor: getCurrentRootProductGroupName,
        cell: (productGroup) => getCurrentRootProductGroupName(productGroup),
      },
      {
        id: 'description',
        header: 'Опис',
        width: 280,
        minWidth: 180,
        accessor: (productGroup) => productGroup.Description,
        cell: (productGroup) => displayValue(productGroup.Description),
      },
      {
        id: 'isSubGroup',
        header: 'Підгрупа',
        width: 120,
        minWidth: 104,
        accessor: (productGroup) => productGroup.IsSubGroup,
        cell: (productGroup) => displayValue(productGroup.IsSubGroup),
      },
      {
        id: 'totalSubGroups',
        header: 'Підгрупи',
        width: 120,
        minWidth: 104,
        align: 'right',
        accessor: (productGroup) => productGroup.TotalProductSubGroup,
        cell: (productGroup) => displayValue(productGroup.TotalProductSubGroup),
      },
      {
        id: 'totalProducts',
        header: 'Товари',
        width: 120,
        minWidth: 104,
        align: 'right',
        accessor: (productGroup) => productGroup.TotalProduct,
        cell: (productGroup) => displayValue(productGroup.TotalProduct),
      },
      {
        id: 'created',
        header: 'Створено',
        width: 140,
        minWidth: 120,
        accessor: (productGroup) => productGroup.Created,
        cell: (productGroup) => formatProductGroupDate(productGroup.Created),
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
        cell: (productGroup) => (
          <Box onClick={(event) => event.stopPropagation()}>
            <Tooltip label={t('Відкрити')}>
              <ActionIcon
                aria-label={t('Відкрити')}
                color="gray"
                disabled={!productGroup.NetUid}
                variant="subtle"
                onClick={() => openProductGroup(productGroup)}
              >
                <Pencil size={18} />
              </ActionIcon>
            </Tooltip>
          </Box>
        ),
      },
    ],
    [openProductGroup, t],
  )
}

function ProductGroupCreateModal({
  createDraft,
  createError,
  isCreating,
  isLoadingRootGroups,
  opened,
  rootGroups,
  selectedRootNetUid,
  onClose,
  onFieldChange,
  onRootGroupChange,
  onSubmit,
}: {
  createDraft: ProductGroup
  createError: string | null
  isCreating: boolean
  isLoadingRootGroups: boolean
  opened: boolean
  rootGroups: ProductGroup[]
  selectedRootNetUid: string | null
  onClose: () => void
  onFieldChange: ProductGroupFieldChange
  onRootGroupChange: (rootNetUid: string | null) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={opened} size="lg" title={t('Нова група товарів')} onClose={onClose}>
      <form id="product-group-create-form" onSubmit={onSubmit}>
        <Stack gap="md">
          {createError && (
            <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
              {createError}
            </Alert>
          )}

          <ProductGroupForm
            disabled={isCreating}
            isLoadingRootGroups={isLoadingRootGroups}
            productGroup={createDraft}
            rootGroups={rootGroups}
            selectedRootNetUid={selectedRootNetUid}
            onFieldChange={onFieldChange}
            onRootGroupChange={onRootGroupChange}
          />

          <Group justify="flex-end">
            <Button color="gray" type="button" variant="subtle" onClick={onClose}>
              {t('Скасувати')}
            </Button>
            <Button color={CREATE_ACTION_COLOR} loading={isCreating} styles={{ label: { fontFamily: 'var(--font-mono)', letterSpacing: 0 } }} type="submit">
              {t('Створити')}
            </Button>
          </Group>
        </Stack>
      </form>
    </AppModal>
  )
}
