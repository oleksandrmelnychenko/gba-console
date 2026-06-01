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
import { CREATE_ACTION_COLOR, PageHeaderActions } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { notifications } from '@mantine/notifications'
import { useDebouncedValue } from '@mantine/hooks'
import { IconAlertCircle, IconPencil, IconPlus, IconRefresh, IconRestore, IconSearch } from '@tabler/icons-react'
import { type FormEvent, useCallback, useEffect, useMemo, useReducer } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useLocation, useNavigate } from 'react-router-dom'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
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
  const [totalFilteredQty, setTotalFilteredQty] = useValueState(0)
  const [totalQty, setTotalQty] = useValueState(0)
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
  const toolbarLeft = useMemo(
    () => (
      <Text size="xs" c="dimmed">
        {t('Показано')} {productGroups.length}
        {totalQty ? ` ${t('з')} ${totalQty}` : ''}
        {searchValue ? `, ${t('пошук')}: ${searchValue}` : ''}
      </Text>
    ),
    [productGroups.length, searchValue, totalQty, t],
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
          setTotalFilteredQty(response.TotalFilteredQty)
          setTotalQty(response.TotalQty)
        }
      } catch (loadError) {
        if (!cancelled) {
          setProductGroups([])
          setTotalFilteredQty(0)
          setTotalQty(0)
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
  }, [reloadKey, searchValue, setError, setLoading, setProductGroups, setTotalFilteredQty, setTotalQty, t])

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
    <Stack gap="lg">
      <PermissionGate permissionKey={PRODUCT_GROUPS_ADD_PERMISSION}>
        <PageHeaderActions>
          <Button
            color={CREATE_ACTION_COLOR}
            size="sm"
            leftSection={<IconPlus size={16} />}
            onClick={() => setCreateModalOpened(true)}
            type="button"
          >
            {t('Нова група')}
          </Button>
        </PageHeaderActions>
      </PermissionGate>
      <Card withBorder radius="md" padding="md">
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
            data={productGroups}
            defaultLayout={PRODUCT_GROUPS_TABLE_DEFAULT_LAYOUT}
            emptyText="Груп товарів не знайдено"
            getRowId={(productGroup, index) => String(productGroup.NetUid || productGroup.Id || index)}
            isLoading={isLoading}
            layoutVersion="product-groups-table-2"
            loadingText="Завантаження груп товарів"
            maxHeight="calc(100vh - 260px)"
            minWidth={1660}
            tableId="product-groups"
            toolbarLeft={toolbarLeft}
            onRowClick={openProductGroup}
          />

          <Group justify="flex-end" gap="lg">
            <Text size="xs" c="dimmed">
              {t('Відфільтрована кількість')}: {totalFilteredQty}
            </Text>
            <Text size="xs" c="dimmed">
              {t('Загальна к-сть')}: {totalQty}
            </Text>
          </Group>
        </Stack>
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
          <Badge color={productGroup.IsActive === false ? 'gray' : 'green'} variant="light">
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
                <IconPencil size={18} />
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
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
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
            <Button color="violet" loading={isCreating} type="submit">
              {t('Створити')}
            </Button>
          </Group>
        </Stack>
      </form>
    </AppModal>
  )
}
