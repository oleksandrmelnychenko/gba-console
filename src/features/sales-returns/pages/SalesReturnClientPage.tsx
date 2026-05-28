import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Drawer,
  Group,
  Loader,
  Modal,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconPackageImport,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react'
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import {
  createDirectSaleReturn,
  getIncomeConsignments,
  getReturnProductByNetId,
  getSalesReturnOrganizations,
  getStoragesByOrganization,
  searchReturnProducts,
  searchSalesReturnClients,
} from '../api/salesReturnsApi'
import type {
  DirectSalesReturnProduct,
  SalesReturnBatch,
  SalesReturnClient,
  SalesReturnClientAgreement,
  SalesReturnItemStatusValue,
  SalesReturnOrganization,
  SalesReturnProduct,
  SalesReturnStorage,
} from '../types'
import {
  displayValue,
  formatAmount,
  formatDateTime,
  formatMoney,
  getEntityName,
  getStatusLabel,
  getStatusOptions,
  parseStatusValue,
  readNumber,
} from '../utils'

const RETURN_ITEMS_TABLE_LAYOUT = {
  columnPinning: {
    left: ['vendorCode', 'product'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const BATCH_TABLE_LAYOUT = {
  columnPinning: {
    left: ['number'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

export function SalesReturnClientPage() {
  const { t } = useI18n()
  const [organizations, setOrganizations] = useState<SalesReturnOrganization[]>([])
  const [storages, setStorages] = useState<SalesReturnStorage[]>([])
  const [clients, setClients] = useState<SalesReturnClient[]>([])
  const [productCandidates, setProductCandidates] = useState<SalesReturnProduct[]>([])
  const [batches, setBatches] = useState<SalesReturnBatch[]>([])
  const [items, setItems] = useState<DirectSalesReturnProduct[]>([])
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [storageId, setStorageId] = useState<string | null>(null)
  const [clientSearch, setClientSearch] = useState('')
  const [clientId, setClientId] = useState<string | null>(null)
  const [agreementId, setAgreementId] = useState<string | null>(null)
  const [productSearch, setProductSearch] = useState('')
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<SalesReturnProduct | null>(null)
  const [qty, setQty] = useState<number | ''>('')
  const [status, setStatus] = useState<SalesReturnItemStatusValue | undefined>()
  const [batch, setBatch] = useState<SalesReturnBatch | null>(null)
  const [createOpened, setCreateOpened] = useState(true)
  const [batchModalOpened, setBatchModalOpened] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [isLoadingOrganizations, setLoadingOrganizations] = useState(false)
  const [isLoadingStorages, setLoadingStorages] = useState(false)
  const [isSearchingClients, setSearchingClients] = useState(false)
  const [isSearchingProducts, setSearchingProducts] = useState(false)
  const [isLoadingBatches, setLoadingBatches] = useState(false)
  const [isSaving, setSaving] = useState(false)

  const selectedOrganization = useMemo(
    () => organizations.find((organization) => getEntityKey(organization) === organizationId) || null,
    [organizationId, organizations],
  )
  const selectedStorage = useMemo(
    () => storages.find((storage) => getEntityKey(storage) === storageId) || null,
    [storageId, storages],
  )
  const selectedClient = useMemo(
    () => clients.find((client) => getEntityKey(client) === clientId) || null,
    [clientId, clients],
  )
  const visibleClients = useMemo(() => {
    if (!selectedOrganization || clientSearch.trim().length < 2) {
      return selectedClient ? [selectedClient] : []
    }

    return clients
  }, [clientSearch, clients, selectedClient, selectedOrganization])
  const agreements = useMemo(
    () => getAgreementsForOrganization(selectedClient, selectedOrganization),
    [selectedClient, selectedOrganization],
  )
  const selectedAgreement = useMemo(
    () => agreements.find((agreement) => getEntityKey(agreement) === agreementId) || null,
    [agreementId, agreements],
  )
  const statusOptions = useMemo(() => getStatusOptions(t), [t])
  const productOptions = useMemo(
    () =>
      productCandidates.map((product) => ({
        label: getProductOptionLabel(product),
        value: getEntityKey(product),
      })),
    [productCandidates],
  )
  const returnItemsColumns = useDirectReturnColumns({
    onRemove: removeItem,
    t,
  })
  const batchColumns = useBatchColumns(t)

  useEffect(() => {
    let cancelled = false

    async function loadOrganizations() {
      setLoadingOrganizations(true)
      setError(null)

      try {
        const nextOrganizations = await getSalesReturnOrganizations()

        if (!cancelled) {
          setOrganizations(nextOrganizations)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити організації'))
        }
      } finally {
        if (!cancelled) {
          setLoadingOrganizations(false)
        }
      }
    }

    void loadOrganizations()

    return () => {
      cancelled = true
    }
  }, [t])

  useEffect(() => {
    if (!selectedOrganization?.NetUid) {
      return
    }

    const organizationNetUid = selectedOrganization.NetUid
    let cancelled = false

    async function loadStorages() {
      setLoadingStorages(true)
      setError(null)

      try {
        const nextStorages = await getStoragesByOrganization(organizationNetUid)

        if (!cancelled) {
          setStorages(nextStorages)
        }
      } catch (loadError) {
        if (!cancelled) {
          setStorages([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити склади'))
        }
      } finally {
        if (!cancelled) {
          setLoadingStorages(false)
        }
      }
    }

    void loadStorages()

    return () => {
      cancelled = true
    }
  }, [selectedOrganization?.NetUid, t])

  useEffect(() => {
    const normalizedSearch = clientSearch.trim()

    if (!selectedOrganization || normalizedSearch.length < 2) {
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      setSearchingClients(true)

      searchSalesReturnClients(normalizedSearch, controller.signal)
        .then((nextClients) => {
          setClients(nextClients)
          setError(null)
        })
        .catch((searchError: unknown) => {
          if (!controller.signal.aborted) {
            setClients([])
            setError(searchError instanceof Error ? searchError.message : t('Не вдалося виконати пошук клієнта'))
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setSearchingClients(false)
          }
        })
    }, 250)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [clientSearch, selectedClient, selectedOrganization, t])

  const selectProduct = useCallback(async (product: SalesReturnProduct) => {
    setSelectedProductId(getEntityKey(product))
    setLoadingBatches(true)
    setBatch(null)
    setBatches([])
    setWarning(null)
    setError(null)

    try {
      const fullProduct = product.NetUid ? await getReturnProductByNetId(product.NetUid) : product
      const nextProduct = fullProduct || product

      setSelectedProduct(nextProduct)

      if (!nextProduct.NetUid) {
        setWarning(t('Товар не має NetUid для пошуку партій'))
        return
      }

      const nextBatches = await getIncomeConsignments({
        from: '2020-12-21',
        productNetId: nextProduct.NetUid,
        to: formatLocalDate(new Date()),
      })

      setBatches(nextBatches)

      if (!nextBatches.length) {
        setWarning(t('Для товару не знайдено партій приходу'))
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити партії товару'))
    } finally {
      setLoadingBatches(false)
    }
  }, [t])

  const handleProductSearch = useCallback(async () => {
    const normalizedSearch = productSearch.trim()

    if (normalizedSearch.length < 4) {
      setWarning(t('Введіть щонайменше 4 символи артикулу'))
      return
    }

    setSearchingProducts(true)
    setWarning(null)
    setError(null)

    try {
      const products = await searchReturnProducts(normalizedSearch)

      setProductCandidates(products)

      const firstProduct = products[0]

      if (firstProduct?.NetUid) {
        await selectProduct(firstProduct)
      } else {
        setSelectedProductId(null)
        setSelectedProduct(null)
        setBatches([])
        setBatch(null)
        setWarning(t('Товар не знайдено'))
      }
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : t('Не вдалося знайти товар'))
    } finally {
      setSearchingProducts(false)
    }
  }, [productSearch, selectProduct, t])

  useEffect(() => {
    const normalizedSearch = productSearch.trim()

    if (normalizedSearch.length < 4) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void handleProductSearch()
    }, 300)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [handleProductSearch, productSearch])

  function resetProductSearchResult() {
    setProductCandidates([])
    setSelectedProductId(null)
    setSelectedProduct(null)
    setBatches([])
    setBatch(null)
  }

  function updateProductSearch(nextProductSearch: string) {
    setProductSearch(nextProductSearch)

    if (nextProductSearch.trim().length < 4) {
      resetProductSearchResult()
    }
  }

  function handleOrganizationChange(nextOrganizationId: string | null) {
    setOrganizationId(nextOrganizationId)
    setStorageId(null)
    setClientId(null)
    setAgreementId(null)
    setClientSearch('')
    setClients([])
    setLoadingStorages(false)
    setError(null)
    setWarning(null)
  }

  function handleClientChange(nextClientId: string | null) {
    setClientId(nextClientId)
    setAgreementId(null)
    setError(null)
    setWarning(null)
  }

  function handleProductChange(nextProductId: string | null) {
    const product = productCandidates.find((candidate) => getEntityKey(candidate) === nextProductId)

    if (!product) {
      setSelectedProductId(null)
      setSelectedProduct(null)
      setBatches([])
      setBatch(null)
      return
    }

    void selectProduct(product)
  }

  function addItem() {
    const validationError = validateDraftItem({
      batch,
      product: selectedProduct,
      qty,
      status,
      t,
    })

    if (validationError) {
      setError(validationError)
      return
    }

    const priceWarning = getBatchPriceWarning(batch)

    setItems((currentItems) => [
      ...currentItems,
      {
        batch: batch as SalesReturnBatch,
        product: selectedProduct as SalesReturnProduct,
        qty: Number(qty),
        status: status as SalesReturnItemStatusValue,
      },
    ])
    resetProductDraft()
    setError(null)
    setWarning(priceWarning)
  }

  function removeItem(item: DirectSalesReturnProduct) {
    setItems((currentItems) => currentItems.filter((currentItem) => currentItem !== item))
  }

  function resetProductDraft() {
    setProductSearch('')
    setProductCandidates([])
    setSelectedProductId(null)
    setSelectedProduct(null)
    setQty('')
    setStatus(undefined)
    setBatch(null)
    setBatches([])
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationError = validateReturnForm({
      agreement: selectedAgreement,
      client: selectedClient,
      items,
      storage: selectedStorage,
      t,
    })

    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError(null)
    setWarning(null)

    try {
      await createDirectSaleReturn({
        ClientAgreementId: selectedAgreement?.Id || 0,
        ClientId: selectedClient?.Id || 0,
        Products: items.map((item) => ({
          Batch: item.batch,
          ProductId: item.product.Id || 0,
          ReasoForReturn: item.status,
          SpecificationQty: item.qty,
        })),
        StorageId: selectedStorage?.Id || 0,
      })

      notifications.show({
        color: 'green',
        message: t('Повернення клієнта створено'),
      })
      setItems([])
      resetProductDraft()
      setCreateOpened(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося створити повернення'))
    } finally {
      setSaving(false)
    }
  }

  function closeCreateDrawer() {
    if (isSaving) {
      return
    }

    setCreateOpened(false)
  }

  return (
    <Box p="lg">
      <Stack gap="md">
        <Group justify="flex-end" align="flex-start">
          <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateOpened(true)}>
            {t('Створити повернення')}
          </Button>
        </Group>
      </Stack>

      <Drawer
        opened={createOpened}
        position="right"
        size="min(1120px, 100vw)"
        title={t('Повернення від клієнта')}
        onClose={closeCreateDrawer}
      >
        <Stack gap="md">
          <Group justify="flex-end" align="flex-start">
          <Button
            leftSection={<IconRefresh size={16} />}
            variant="light"
            onClick={() => {
              setItems([])
              resetProductDraft()
              setError(null)
              setWarning(null)
            }}
          >
            {t('Очистити')}
          </Button>
        </Group>

        {error ? (
          <Alert color="red" icon={<IconAlertCircle size={16} />} title={t('Помилка')}>
            {error}
          </Alert>
        ) : null}
        {warning ? (
          <Alert color="yellow" icon={<IconAlertCircle size={16} />} title={t('Увага')}>
            {warning}
          </Alert>
        ) : null}

        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, md: 2, lg: 4 }}>
              <Select
                clearable
                data={organizations.map((organization) => ({
                  label: getEntityName(organization) || t('Без назви'),
                  value: getEntityKey(organization),
                }))}
                disabled={isLoadingOrganizations}
                label={t('Організація')}
                onChange={handleOrganizationChange}
                searchable
                value={organizationId}
              />
              <Select
                clearable
                data={storages.map((storage) => ({
                  label: [storage.Name, storage.Organization?.Name ? `(${storage.Organization.Name})` : ''].filter(Boolean).join(' '),
                  value: getEntityKey(storage),
                }))}
                disabled={!selectedOrganization || isLoadingStorages}
                label={t('Склад')}
                onChange={setStorageId}
                searchable
                value={storageId}
              />
              <Select
                clearable
                data={visibleClients.map((client) => ({
                  label: getClientName(client),
                  value: getEntityKey(client),
                }))}
                disabled={!selectedOrganization}
                label={t('Клієнт')}
                onChange={handleClientChange}
                onSearchChange={setClientSearch}
                placeholder={t('Пошук за назвою або кодом')}
                rightSection={isSearchingClients ? <IconSearch size={14} /> : null}
                searchable
                searchValue={clientSearch}
                value={clientId}
              />
              <Select
                clearable
                data={agreements.map((agreement) => ({
                  label: getAgreementLabel(agreement),
                  value: getEntityKey(agreement),
                }))}
                disabled={!selectedClient}
                label={t('Договір')}
                onChange={setAgreementId}
                searchable
                value={agreementId}
              />
            </SimpleGrid>

            <Box>
              <Group align="flex-end" gap="sm">
                <TextInput
                  label={t('Артикул')}
                  placeholder={t('Введіть артикул')}
                  rightSection={isSearchingProducts ? <Loader size={14} /> : undefined}
                  value={productSearch}
                  onChange={(event) => updateProductSearch(event.currentTarget.value)}
                />
                <Select
                  clearable
                  data={productOptions}
                  disabled={!productOptions.length}
                  label={t('Знайдений товар')}
                  onChange={handleProductChange}
                  searchable
                  value={selectedProductId}
                  w={{ base: '100%', md: 320 }}
                />
              </Group>
            </Box>

            <SimpleGrid cols={{ base: 1, md: 4 }}>
              <NumberInput
                allowDecimal
                decimalScale={3}
                label={t('Кількість')}
                min={0}
                onChange={(value) => setQty(typeof value === 'number' ? value : '')}
                value={qty}
              />
              <Select
                clearable
                data={statusOptions}
                label={t('Причина повернення')}
                onChange={(value) => setStatus(parseStatusValue(value))}
                value={typeof status === 'number' ? String(status) : null}
              />
              <TextInput
                label={t('Партія')}
                readOnly
                rightSection={
                  <Tooltip label={t('Обрати партію')}>
                    <ActionIcon
                      aria-label={t('Обрати партію')}
                      disabled={!selectedProduct || isLoadingBatches}
                      onClick={() => setBatchModalOpened(true)}
                      variant="subtle"
                    >
                      <IconPackageImport size={16} />
                    </ActionIcon>
                  </Tooltip>
                }
                value={batch?.IncomeToStorageNumber || ''}
              />
              <Button
                leftSection={<IconPlus size={16} />}
                mt={{ base: 0, md: 24 }}
                onClick={addItem}
                type="button"
                variant="light"
              >
                {t('Додати позицію')}
              </Button>
            </SimpleGrid>

            <DataTable
              columns={returnItemsColumns}
              data={items}
              defaultLayout={RETURN_ITEMS_TABLE_LAYOUT}
              emptyText={t('Позиції повернення ще не додано')}
              getRowId={(item, index) => `${item.product.NetUid || item.product.Id || 'product'}-${index}`}
              minWidth={940}
              tableId="sales-return-client-items"
            />

            <Group justify="flex-end">
              <Button disabled={!items.length} loading={isSaving} type="submit">
                {t('Створити повернення')}
              </Button>
            </Group>
          </Stack>
        </form>
      </Stack>
      </Drawer>

      <Modal
        opened={batchModalOpened}
        onClose={() => setBatchModalOpened(false)}
        size="xl"
        title={t('Партії приходу')}
      >
        <DataTable
          columns={batchColumns}
          data={batches}
          defaultLayout={BATCH_TABLE_LAYOUT}
          emptyText={t('Партій не знайдено')}
          getRowId={(row, index) => `${row.IncomeToStorageNumber || 'batch'}-${index}`}
          isLoading={isLoadingBatches}
          minWidth={920}
          onRowClick={(row) => {
            setBatch(row)
            setBatchModalOpened(false)
          }}
          tableId="sales-return-client-batches"
        />
      </Modal>
    </Box>
  )
}

function useDirectReturnColumns({
  onRemove,
  t,
}: {
  onRemove: (item: DirectSalesReturnProduct) => void
  t: (value: string) => string
}): DataTableColumn<DirectSalesReturnProduct>[] {
  return useMemo(
    () => [
      {
        id: 'vendorCode',
        header: t('Артикул'),
        accessor: (item) => item.product.VendorCode,
        cell: (item) => <Text fw={600}>{displayValue(item.product.VendorCode)}</Text>,
        width: 140,
      },
      {
        id: 'product',
        header: t('Товар'),
        accessor: (item) => getEntityName(item.product),
        cell: (item) => displayValue(getEntityName(item.product)),
        width: 260,
      },
      {
        id: 'qty',
        header: t('Кількість'),
        accessor: (item) => item.qty,
        cell: (item) => formatAmount(item.qty),
        width: 110,
      },
      {
        id: 'status',
        header: t('Причина'),
        accessor: (item) => getStatusLabel(item.status, t),
        cell: (item) => <Badge variant="light">{getStatusLabel(item.status, t)}</Badge>,
        width: 220,
      },
      {
        id: 'batch',
        header: t('Партія'),
        accessor: (item) => item.batch.IncomeToStorageNumber,
        cell: (item) => displayValue(item.batch.IncomeToStorageNumber),
        width: 180,
      },
      {
        id: 'price',
        header: t('Ціна партії'),
        accessor: (item) => getBatchPrice(item.batch),
        cell: (item) => formatMoney(getBatchPrice(item.batch)),
        align: 'right',
        width: 130,
      },
      {
        id: 'actions',
        header: '',
        cell: (item) => (
          <Tooltip label={t('Видалити')}>
            <ActionIcon aria-label={t('Видалити')} color="red" onClick={() => onRemove(item)} variant="subtle">
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        ),
        enableSorting: false,
        width: 80,
      },
    ],
    [onRemove, t],
  )
}

function useBatchColumns(t: (value: string) => string): DataTableColumn<SalesReturnBatch>[] {
  return useMemo(
    () => [
      {
        id: 'number',
        header: t('Номер приходу'),
        accessor: (batch) => batch.IncomeToStorageNumber,
        cell: (batch) => <Text fw={600}>{displayValue(batch.IncomeToStorageNumber)}</Text>,
        width: 180,
      },
      {
        id: 'currency',
        header: t('Валюта'),
        accessor: (batch) => batch.Currency,
        cell: (batch) => displayValue(batch.Currency),
        width: 90,
      },
      {
        id: 'organization',
        header: t('Організація'),
        accessor: (batch) => batch.OrganizationName,
        cell: (batch) => displayValue(batch.OrganizationName),
        width: 180,
      },
      {
        id: 'supplier',
        header: t('Постачальник'),
        accessor: (batch) => batch.SupplierName,
        cell: (batch) => displayValue(batch.SupplierName),
        width: 180,
      },
      {
        id: 'remaining',
        header: t('Залишок'),
        accessor: (batch) => batch.RemainingQty,
        cell: (batch) => formatAmount(batch.RemainingQty),
        align: 'right',
        width: 100,
      },
      {
        id: 'netPrice',
        header: t('InvoiceNetUnitPrice'),
        accessor: (batch) => batch.NetPrice,
        cell: (batch) => formatMoney(batch.NetPrice),
        align: 'right',
        width: 150,
      },
      {
        id: 'grossPrice',
        header: t('AccountingGrossUnitPrice'),
        accessor: (batch) => batch.GrossPrice,
        cell: (batch) => formatMoney(batch.GrossPrice),
        align: 'right',
        width: 170,
      },
      {
        id: 'date',
        header: t('Дата приходу'),
        accessor: (batch) => batch.IncomeToStorageDate,
        cell: (batch) => formatDateTime(batch.IncomeToStorageDate),
        width: 160,
      },
    ],
    [t],
  )
}

function validateReturnForm({
  agreement,
  client,
  items,
  storage,
  t,
}: {
  agreement: SalesReturnClientAgreement | null
  client: SalesReturnClient | null
  items: DirectSalesReturnProduct[]
  storage: SalesReturnStorage | null
  t: (value: string) => string
}) {
  if (!storage?.Id) {
    return t('Оберіть склад')
  }

  if (!client?.Id) {
    return t('Оберіть клієнта')
  }

  if (!agreement?.Id) {
    return t('Оберіть договір')
  }

  if (!items.length) {
    return t('Додайте хоча б одну позицію повернення')
  }

  return null
}

function validateDraftItem({
  batch,
  product,
  qty,
  status,
  t,
}: {
  batch: SalesReturnBatch | null
  product: SalesReturnProduct | null
  qty: number | ''
  status?: SalesReturnItemStatusValue
  t: (value: string) => string
}) {
  const numericQty = typeof qty === 'number' ? qty : 0
  const remainingQty = readNumber(batch?.RemainingQty)

  if (!product?.Id) {
    return t('Оберіть товар')
  }

  if (!Number.isFinite(numericQty) || numericQty <= 0) {
    return t('Кількість повернення має бути більшою за нуль')
  }

  if (typeof remainingQty === 'number' && numericQty > remainingQty) {
    return t('Кількість повернення перевищує залишок обраної партії')
  }

  if (typeof status !== 'number') {
    return t('Оберіть причину повернення')
  }

  if (!batch?.IncomeToStorageNumber) {
    return t('Оберіть партію приходу')
  }

  return null
}

function getAgreementsForOrganization(
  client: SalesReturnClient | null,
  organization: SalesReturnOrganization | null,
): SalesReturnClientAgreement[] {
  const agreements = client?.ClientAgreements || []

  if (!organization?.Id) {
    return agreements
  }

  return agreements.filter((agreement) => agreement.Agreement?.OrganizationId === organization.Id)
}

function getAgreementLabel(agreement: SalesReturnClientAgreement): string {
  return [
    agreement.Agreement?.Name || agreement.Agreement?.FullName,
    agreement.Agreement?.Currency?.Code,
  ].filter(Boolean).join(' ')
}

function getClientName(client: SalesReturnClient): string {
  return [
    client.FullName || client.Name || tFallback('Без назви'),
    client.RegionCode?.Value,
  ].filter(Boolean).join(' · ')
}

function getProductOptionLabel(product: SalesReturnProduct): string {
  return [product.VendorCode, product.Name || product.FullName].filter(Boolean).join(' · ')
}

function getEntityKey(entity: { Id?: number; NetUid?: string }): string {
  return entity.NetUid || String(entity.Id || '')
}

function getBatchPrice(batch?: SalesReturnBatch | null): number | undefined {
  return readNumber(batch?.ReturnPrice)
    ?? readNumber(batch?.NetPrice)
    ?? readNumber(batch?.GrossPrice)
    ?? readNumber(batch?.UnitPriceLocal)
}

function getBatchPriceWarning(batch: SalesReturnBatch | null): string | null {
  const price = getBatchPrice(batch)

  return typeof price === 'number' && price > 0 ? null : 'Обрана партія не має валідної ціни. Перевірте її перед створенням повернення.'
}

function tFallback(value: string): string {
  return value
}
