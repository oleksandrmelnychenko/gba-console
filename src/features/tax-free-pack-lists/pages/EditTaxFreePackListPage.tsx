import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core'
import { AppDrawer } from "../../../shared/ui/AppDrawer"
import { AppModal } from "../../../shared/ui/AppModal"
import {
  IconAlertCircle,
  IconArrowLeft,
  IconArrowRight,
  IconDeviceFloppy,
  IconFile,
  IconPrinter,
  IconRefresh,
  IconSearch,
  IconTruckDelivery,
  IconTrash,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import {
  getClientAgreements,
  getOrganizations,
  getTaxFreePackListById,
  getTaxFreePrintDocument,
  getTaxFreePrintDocuments,
  saveTaxFreePackList,
  searchClients,
} from '../api/taxFreePackListsApi'
import { MoveTaxFreeItemsModal } from '../components/MoveTaxFreeItemsModal'
import { TaxFreeBreakModal } from '../components/TaxFreeBreakModal'
import { TaxFreeCarrierModal } from '../components/TaxFreeCarrierModal'
import { TaxFreeDocumentsPanel } from '../components/TaxFreeDocumentsPanel'
import type {
  Client,
  ClientAgreement,
  Organization,
  SupplyOrderUkraineCartItem,
  TaxFree,
  TaxFreeItem,
  TaxFreePackList,
  TaxFreePackListOrderItem,
  TaxFreeStatus,
} from '../types'
import { TaxFreeStatus as TaxFreeStatusValue } from '../types'
import {
  clonePackList,
  displayValue,
  formatMoney,
  formatNumber,
  getClientAgreementLabel,
  getClientLabel,
  getEditableTaxFreeStatuses,
  getEntityName,
  getProductName,
  getTaxFreeItemProduct,
  getTaxFreeItemUnitPrice,
  getTaxFreeTotalQty,
  normalizePackList,
  openDocumentUrl,
  parseTaxFreeStatus,
} from '../utils'
import './taxFreePackLists.css'

const SOURCE_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['selected', 'vendorCode', 'productName'],
  },
  density: 'compact',
} satisfies DataTableDefaultLayout

const TAX_FREE_ITEMS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['selected', 'vendorCode', 'productName'],
  },
  density: 'compact',
} satisfies DataTableDefaultLayout

type SourceRow = {
  id: string
  entity: SupplyOrderUkraineCartItem | TaxFreePackListOrderItem
  isOrderItem: boolean
}

type EditState = {
  isLoading: boolean
  packList: TaxFreePackList | null
}

export function EditTaxFreePackListPage() {
  const { t } = useI18n()
  const { id } = useParams()
  const [state, setState] = useState<EditState>({ isLoading: false, packList: null })
  const [originalPackList, setOriginalPackList] = useState<TaxFreePackList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [clientSearch, setClientSearch] = useState('')
  const [clientAgreements, setClientAgreements] = useState<ClientAgreement[]>([])
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(() => new Set())
  const [selectedTaxFreeIds, setSelectedTaxFreeIds] = useState<Set<string>>(() => new Set())
  const [selectedTaxFreeItemIds, setSelectedTaxFreeItemIds] = useState<Set<string>>(() => new Set())
  const [moveItems, setMoveItems] = useState<TaxFreeItem[]>([])
  const [isMoveModalOpen, setMoveModalOpen] = useState(false)
  const [isBreakModalOpen, setBreakModalOpen] = useState(false)
  const [documentTaxFree, setDocumentTaxFree] = useState<TaxFree | null>(null)
  const [carrierTaxFree, setCarrierTaxFree] = useState<TaxFree | null>(null)
  const [deleteTaxFree, setDeleteTaxFree] = useState<TaxFree | null>(null)
  const [isSaving, setSaving] = useState(false)
  const [isPrinting, setPrinting] = useState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const packList = state.packList
  const isDirty = useMemo(
    () => Boolean(packList && originalPackList && JSON.stringify(packList) !== JSON.stringify(originalPackList)),
    [originalPackList, packList],
  )
  const sourceRows = useMemo(() => buildSourceRows(packList), [packList])
  const totals = useMemo(() => getSourceTotals(packList), [packList])
  const taxFreeStatuses = useMemo(() => getEditableTaxFreeStatuses(), [])
  const selectedClientNetUid = packList?.Client?.NetUid || null
  const selectedAgreementValue = packList?.ClientAgreement?.NetUid
    || (packList?.ClientAgreement?.AgreementId ? String(packList.ClientAgreement.AgreementId) : null)
  const selectedOrganizationValue = packList?.Organization?.NetUid || (packList?.Organization?.Id ? String(packList.Organization.Id) : null)
  const organizationOptions = useMemo(() => buildOrganizationOptions(organizations, t('Організація')), [organizations, t])
  const clientOptions = useMemo(() => buildClientOptions(clients), [clients])
  const clientAgreementOptions = useMemo(() => buildClientAgreementOptions(clientAgreements), [clientAgreements])

  useEffect(() => {
    let cancelled = false

    async function loadPackList() {
      if (!id) {
        setError(t('Не вказано ідентифікатор пакувального листа'))
        return
      }

      setState((currentState) => ({ ...currentState, isLoading: true }))
      setError(null)

      try {
        const [nextPackList, nextOrganizations] = await Promise.all([
          getTaxFreePackListById(id),
          getOrganizations(),
        ])

        if (cancelled) {
          return
        }

        if (!nextPackList) {
          setState({ isLoading: false, packList: null })
          setError(t('Пакувальний лист не знайдено'))
          return
        }

        setOrganizations(nextOrganizations)
        setState({ isLoading: false, packList: nextPackList })
        setOriginalPackList(clonePackList(nextPackList))
        setClientSearch(getEntityName(nextPackList.Client))
        setClients(nextPackList.Client ? [nextPackList.Client] : [])
        setSelectedSourceIds(new Set())
        setSelectedTaxFreeIds(new Set())
        setSelectedTaxFreeItemIds(new Set())

        if (nextPackList.Client?.NetUid) {
          getClientAgreements(nextPackList.Client.NetUid)
            .then(setClientAgreements)
            .catch(() => setClientAgreements([]))
        }
      } catch (loadError) {
        if (!cancelled) {
          setState({ isLoading: false, packList: null })
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити пакувальний лист'))
        }
      }
    }

    loadPackList()

    return () => {
      cancelled = true
    }
  }, [id, reloadKey, t])

  useEffect(() => {
    if (clientSearch.trim().length < 2) {
      return
    }

    const controller = new AbortController()

    searchClients(clientSearch, controller.signal)
      .then(setClients)
      .catch(() => undefined)

    return () => controller.abort()
  }, [clientSearch])

  const setPackList = useCallback((updater: TaxFreePackList | ((packList: TaxFreePackList) => TaxFreePackList)) => {
    setState((currentState) => {
      if (!currentState.packList) {
        return currentState
      }

      const nextPackList = typeof updater === 'function' ? updater(currentState.packList) : updater

      return {
        ...currentState,
        packList: normalizePackList(nextPackList),
      }
    })
  }, [])

  async function persistPackList(nextPackList = packList, successMessage = t('Пакувальний лист збережено')) {
    if (!nextPackList) {
      return null
    }

    setSaving(true)
    setError(null)

    try {
      const savedPackList = await saveTaxFreePackList(preparePackListForSave(nextPackList))

      if (savedPackList) {
        setState({ isLoading: false, packList: savedPackList })
        setOriginalPackList(clonePackList(savedPackList))
      }
      notifications.show({ color: 'green', message: successMessage })
      return savedPackList
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти пакувальний лист'))
      return null
    } finally {
      setSaving(false)
    }
  }

  async function sendPackList() {
    if (!packList) {
      return
    }

    const incorrectTaxFree = (packList.TaxFrees || []).find((taxFree) => !taxFree.DateOfIssue || !taxFree.DateOfPrint)

    if (incorrectTaxFree) {
      const missingStatus = !incorrectTaxFree.DateOfIssue
        ? parseTaxFreeStatus(TaxFreeStatusValue.Formed)
        : parseTaxFreeStatus(TaxFreeStatusValue.Printed)
      setError(`TF ${incorrectTaxFree.Number || ''} - ${t('не вистачає статусу')} "${missingStatus}"`)
      return
    }

    await persistPackList({ ...packList, IsSent: true }, t('Пакувальний лист проведено'))
  }

  function cancelChanges() {
    if (originalPackList) {
      setState({ isLoading: false, packList: clonePackList(originalPackList) })
      setSelectedSourceIds(new Set())
      setSelectedTaxFreeIds(new Set())
      setSelectedTaxFreeItemIds(new Set())
    }
  }

  function toggleSource(rowId: string, enabled: boolean) {
    setSelectedSourceIds((currentIds) => {
      const nextIds = new Set(currentIds)
      if (enabled) {
        nextIds.add(rowId)
      } else {
        nextIds.delete(rowId)
      }
      return nextIds
    })
  }

  function moveSelectedRight() {
    if (!packList) {
      return
    }

    if (packList.IsSent) {
      notifications.show({ color: 'red', message: t('Проведений документ не можна змінювати') })
      return
    }

    const selectedItems: TaxFreeItem[] = []

    for (const row of sourceRows) {
      if (selectedSourceIds.has(row.id) && getSourceUnpackedQty(row.entity) > 0) {
        selectedItems.push(sourceRowToTaxFreeItem(row, packList.IsFromSale))
      }
    }

    setMoveItems(selectedItems)
    setMoveModalOpen(true)
  }

  function moveSelectedLeft() {
    if (!packList) {
      return
    }

    if (packList.IsSent) {
      notifications.show({ color: 'red', message: t('Проведений документ не можна змінювати') })
      return
    }

    setPackList({
      ...packList,
      TaxFrees: (packList.TaxFrees || []).map((taxFree, taxFreeIndex) => ({
        ...taxFree,
        TaxFreeItems: (taxFree.TaxFreeItems || []).filter((item, itemIndex) => (
          !selectedTaxFreeItemIds.has(getTaxFreeItemId(taxFree, taxFreeIndex, item, itemIndex))
        )),
      })),
    })
    setSelectedTaxFreeItemIds(new Set())
  }

  async function printSelectedTaxFrees() {
    const selectedTaxFrees = (packList?.TaxFrees || [])
      .filter((taxFree, index) => selectedTaxFreeIds.has(getTaxFreeId(taxFree, index)))

    if (selectedTaxFrees.some((taxFree) => !isTaxFreeGroupPrintable(taxFree))) {
      notifications.show({ color: 'yellow', message: t('Обрані Tax Free не мають бути у статусі Не сформовано') })
      return
    }

    const selectedIds: string[] = []

    for (const taxFree of selectedTaxFrees) {
      if (taxFree.NetUid) {
        selectedIds.push(taxFree.NetUid)
      }
    }

    if (selectedIds.length === 0) {
      notifications.show({ color: 'yellow', message: t('Оберіть Tax Free для друку') })
      return
    }

    setPrinting(true)

    try {
      const document = await getTaxFreePrintDocuments(selectedIds)
      if (!openDocumentUrl(document)) {
        notifications.show({ color: 'yellow', message: t('Документ не містить посилання для відкриття') })
      }
    } catch (printError) {
      setError(printError instanceof Error ? printError.message : t('Не вдалося отримати документ'))
    } finally {
      setPrinting(false)
    }
  }

  const sourceColumns = useSourceColumns({
    disabled: Boolean(packList?.IsSent),
    isSelected: (rowId) => selectedSourceIds.has(rowId),
    onDelete: (row) => {
      if (!packList) {
        return
      }
      setPackList(removeSourceRow(packList, row))
    },
    onMaxQtyChange: (row, value) => setPackList((currentPackList) => updateSourceRow(currentPackList, row, { MaxQtyPerTF: value })),
    onQtyChange: (row, value) => setPackList((currentPackList) => updateSourceRow(currentPackList, row, { UnpackedQty: value })),
    toggleSource,
  })
  const selectedTaxFrees = (packList?.TaxFrees || []).filter((taxFree, index) => selectedTaxFreeIds.has(getTaxFreeId(taxFree, index)))
  const hasNonPrintableSelectedTaxFrees = selectedTaxFrees.some((taxFree) => !isTaxFreeGroupPrintable(taxFree))

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Badge color={packList?.IsSent ? 'green' : 'gray'} variant="light">
          {packList?.IsSent ? t('Проведено') : t('Не проведено')}
        </Badge>
        <Group gap="xs">
          <Tooltip label={t('Оновити')}>
            <ActionIcon variant="light" size={36} aria-label={t('Оновити')} onClick={reload}>
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
          {!packList?.IsSent && (
            <Button disabled={isDirty || (packList?.TaxFrees || []).length === 0} onClick={sendPackList}>
              {t('Провести')}
            </Button>
          )}
        </Group>
      </Group>

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card withBorder radius="md">
        <Stack>
          {packList?.IsSent ? (
            <SimpleGrid cols={{ base: 1, md: 4 }}>
              <ReadonlyField label={t('Організація')} value={getEntityName(packList.Organization)} />
              <ReadonlyField label={t('Клієнт')} value={getEntityName(packList.Client)} />
              <ReadonlyField label={t('Договір')} value={getClientAgreementLabel(packList.ClientAgreement || {})} />
              <ReadonlyField label={t('Маржа')} value={formatMoney(packList.MarginAmount)} />
            </SimpleGrid>
          ) : (
            <SimpleGrid cols={{ base: 1, md: 5 }}>
              <Select
                searchable
                data={organizationOptions}
                label={t('Організація')}
                value={selectedOrganizationValue}
                onChange={(value) => {
                  const organization = organizations.find((item) => getOrganizationOptionValue(item) === value)
                  setPackList((currentPackList) => ({ ...currentPackList, Organization: organization }))
                }}
              />
              <TextInput
                leftSection={<IconSearch size={16} />}
                label={t('Пошук клієнта')}
                value={clientSearch}
                onChange={(event) => setClientSearch(event.currentTarget.value)}
              />
              <Select
                searchable
                clearable
                data={clientOptions}
                label={t('Клієнт')}
                value={selectedClientNetUid}
                onChange={(value) => {
                  const client = clients.find((item) => getClientOptionValue(item) === value)
                  setPackList((currentPackList) => ({ ...currentPackList, Client: client, ClientAgreement: undefined }))
                  setClientAgreements([])
                  if (client?.NetUid) {
                    getClientAgreements(client.NetUid).then(setClientAgreements).catch(() => setClientAgreements([]))
                  }
                }}
              />
              <Select
                clearable
                data={clientAgreementOptions}
                disabled={!packList?.Client}
                label={t('Договір')}
                value={selectedAgreementValue}
                onChange={(value) => {
                  const agreement = clientAgreements.find((item) => (
                    getClientAgreementOptionValue(item) === value
                  ))
                  setPackList((currentPackList) => ({ ...currentPackList, ClientAgreement: agreement }))
                }}
              />
              {!packList?.IsFromSale && (
                <NumberInput
                  disabled={(packList?.TaxFrees || []).length > 0}
                  label={t('Маржа')}
                  min={0}
                  value={packList?.MarginAmount || 0}
                  onChange={(value) => {
                    const marginAmount = typeof value === 'number' ? value : Number(value) || 0
                    setPackList((currentPackList) => ({ ...currentPackList, MarginAmount: marginAmount }))
                  }}
                />
              )}
            </SimpleGrid>
          )}

          {!packList?.IsSent && (
            <Group justify="space-between">
              <Button disabled={isDirty} variant="light" onClick={() => setBreakModalOpen(true)}>
                {t('Розбити')}
              </Button>
              {isDirty && (
                <Group>
                  <Button variant="subtle" onClick={cancelChanges}>{t('Скасувати')}</Button>
                  <Button leftSection={<IconDeviceFloppy size={16} />} loading={isSaving} onClick={() => persistPackList()}>
                    {t('Зберегти')}
                  </Button>
                </Group>
              )}
            </Group>
          )}
        </Stack>
      </Card>

      <div className="tax-free-pack-list-edit-grid">
        <Card withBorder radius="md" className="tax-free-pack-list-source-card">
          <Stack>
            <Group justify="space-between">
              <Title order={4}>{packList?.IsFromSale ? t('Позиції продажу') : t('Позиції замовлення')}</Title>
              <Checkbox
                checked={sourceRows.length > 0 && sourceRows.every((row) => selectedSourceIds.has(row.id))}
                disabled={sourceRows.length === 0 || packList?.IsSent}
                label={t('Обрати всі')}
                onChange={(event) => {
                  setSelectedSourceIds(event.currentTarget.checked
                    ? new Set(getSourceRowsAvailableForMove(sourceRows))
                    : new Set())
                }}
              />
            </Group>
            <DataTable
              columns={sourceColumns}
              data={sourceRows}
              defaultLayout={SOURCE_TABLE_DEFAULT_LAYOUT}
              emptyText={t('Позицій немає')}
              getRowId={(row) => row.id}
              isLoading={state.isLoading}
              layoutVersion="tax-free-pack-list-source-table-1"
              maxHeight={420}
              minWidth={900}
              tableId="tax-free-pack-list-source"
              onRowClick={(row) => {
                if (!packList?.IsSent && getSourceUnpackedQty(row.entity) > 0) {
                  toggleSource(row.id, !selectedSourceIds.has(row.id))
                }
              }}
            />
            <TotalsLine
              items={[
                [t('Заг. к-сть'), formatNumber(totals.qty)],
                [t('Заг. вага'), formatNumber(totals.weight)],
                [`${t('Сума')} EUR`, formatMoney(totals.amount)],
                [`${t('Сума')} PLN`, formatMoney(totals.amountLocal)],
              ]}
            />
          </Stack>
        </Card>

        <div className="tax-free-pack-list-move-buttons">
          <Tooltip label={t('Перенести у Tax Free')}>
            <ActionIcon
              aria-label={t('Перенести у Tax Free')}
              disabled={selectedSourceIds.size === 0 || packList?.IsSent || isDirty}
              size="lg"
              variant="filled"
              onClick={moveSelectedRight}
            >
              <IconArrowRight size={20} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t('Повернути з Tax Free')}>
            <ActionIcon
              aria-label={t('Повернути з Tax Free')}
              disabled={selectedTaxFreeItemIds.size === 0 || packList?.IsSent || isDirty}
              size="lg"
              variant="light"
              onClick={moveSelectedLeft}
            >
              <IconArrowLeft size={20} />
            </ActionIcon>
          </Tooltip>
        </div>

        <Card withBorder radius="md" className="tax-free-pack-list-tax-frees-card">
          <Stack>
            <Group justify="space-between">
              <Title order={4}>{t('Tax Free')}</Title>
              <Group gap="xs">
                <Checkbox
                  checked={(packList?.TaxFrees || []).length > 0 && (packList?.TaxFrees || []).every((taxFree, index) => (
                    selectedTaxFreeIds.has(getTaxFreeId(taxFree, index))
                  ))}
                  disabled={(packList?.TaxFrees || []).length === 0}
                  label={t('Обрати всі')}
                  onChange={(event) => {
                    setSelectedTaxFreeIds(event.currentTarget.checked
                      ? new Set((packList?.TaxFrees || []).map(getTaxFreeId))
                      : new Set())
                  }}
                />
                <Button
                  disabled={selectedTaxFreeIds.size === 0 || isDirty || hasNonPrintableSelectedTaxFrees}
                  leftSection={<IconPrinter size={16} />}
                  loading={isPrinting}
                  size="xs"
                  variant="light"
                  onClick={printSelectedTaxFrees}
                >
                  {t('Друк')}
                </Button>
                <Button
                  color="red"
                  disabled={selectedTaxFreeIds.size === 0 || packList?.IsSent}
                  leftSection={<IconTrash size={16} />}
                  size="xs"
                  variant="subtle"
                  onClick={() => {
                    if (!packList) {
                      return
                    }
                    setPackList({
                      ...packList,
                      TaxFrees: (packList.TaxFrees || []).filter((taxFree, index) => (
                        !selectedTaxFreeIds.has(getTaxFreeId(taxFree, index)) || isTaxFreeReadOnly(taxFree, packList)
                      )),
                    })
                    setSelectedTaxFreeIds(new Set())
                  }}
                >
                  {t('Видалити')}
                </Button>
              </Group>
            </Group>

            <Stack gap="md" className="tax-free-pack-list-card-list">
              {(packList?.TaxFrees || []).map((taxFree, index) => (
                <TaxFreeCard
                  isDirty={isDirty}
                  isReadOnly={isTaxFreeReadOnly(taxFree, packList)}
                  key={getTaxFreeId(taxFree, index)}
                  selectedItemIds={selectedTaxFreeItemIds}
                  selectedTaxFreeIds={selectedTaxFreeIds}
                  statusOptions={taxFreeStatuses}
                  taxFree={taxFree}
                  taxFreeId={getTaxFreeId(taxFree, index)}
                  taxFreeIndex={index}
                  onDelete={() => setDeleteTaxFree(taxFree)}
                  onDocuments={() => setDocumentTaxFree(taxFree)}
                  onItemQtyChange={(itemIndex, qty) => {
                    setPackList((currentPackList) => updateTaxFreeItem(currentPackList, index, itemIndex, { ChangedQty: qty }))
                  }}
                  onPrint={async () => {
                    if (!taxFree.NetUid) {
                      return
                    }
                    setPrinting(true)
                    try {
                      const document = await getTaxFreePrintDocument(taxFree.NetUid)
                      if (!openDocumentUrl(document)) {
                        notifications.show({ color: 'yellow', message: t('Документ не містить посилання для відкриття') })
                      }
                    } catch (printError) {
                      setError(printError instanceof Error ? printError.message : t('Не вдалося отримати документ'))
                    } finally {
                      setPrinting(false)
                    }
                  }}
                  onSelect={(checked) => {
                    setSelectedTaxFreeIds((currentIds) => {
                      const nextIds = new Set(currentIds)
                      if (checked) {
                        nextIds.add(getTaxFreeId(taxFree, index))
                      } else {
                        nextIds.delete(getTaxFreeId(taxFree, index))
                      }
                      return nextIds
                    })
                  }}
                  onSelectCarrier={() => setCarrierTaxFree(taxFree)}
                  onToggleItem={(item, itemIndex, checked) => {
                    const itemId = getTaxFreeItemId(taxFree, index, item, itemIndex)
                    setSelectedTaxFreeItemIds((currentIds) => {
                      const nextIds = new Set(currentIds)
                      if (checked) {
                        nextIds.add(itemId)
                      } else {
                        nextIds.delete(itemId)
                      }
                      return nextIds
                    })
                  }}
                  onStatusChange={(status) => {
                    setPackList((currentPackList) => updateTaxFreeStatus(currentPackList, index, status))
                  }}
                />
              ))}
              {(packList?.TaxFrees || []).length === 0 && (
                <Text size="sm" c="dimmed">{t('Tax Free ще не сформовано')}</Text>
              )}
            </Stack>

            <TotalsLine
              items={[
                [t('Заг. к-сть'), formatNumber(packList?.TaxFrees?.length || 0)],
                [t('Заг. вага'), formatNumber(packList?.TotalWeight)],
                [`${t('Сума')} EUR`, formatMoney(packList?.TotalAmount)],
                [`${t('Сума')} PLN`, formatMoney(packList?.TotalAmountLocal)],
                [`${t('З ПДВ')} PLN`, formatMoney(packList?.TotalVatAmountLocal)],
              ]}
            />
          </Stack>
        </Card>
      </div>

      <MoveTaxFreeItemsModal
        items={moveItems}
        opened={isMoveModalOpen}
        packList={packList}
        onClose={() => setMoveModalOpen(false)}
        onSubmit={async (nextPackList) => {
          setMoveModalOpen(false)
          const savedPackList = await persistPackList(nextPackList, t('Позиції перенесено'))
          if (savedPackList) {
            setSelectedSourceIds(new Set())
          }
        }}
      />

      <TaxFreeBreakModal
        opened={isBreakModalOpen}
        packList={packList}
        onClose={() => setBreakModalOpen(false)}
        onUpdated={(nextPackList) => {
          setState({ isLoading: false, packList: nextPackList })
          setOriginalPackList(clonePackList(nextPackList))
        }}
      />

      <TaxFreeCarrierModal
        opened={Boolean(carrierTaxFree)}
        taxFree={carrierTaxFree}
        onClose={() => setCarrierTaxFree(null)}
        onUpdated={(updatedTaxFree) => {
          setPackList((currentPackList) => replaceTaxFree(currentPackList, updatedTaxFree))
          setOriginalPackList((currentPackList) => currentPackList ? replaceTaxFree(currentPackList, updatedTaxFree) : currentPackList)
        }}
      />

      <AppDrawer
        opened={Boolean(documentTaxFree)}
        position="right"
        size="min(620px, 100vw)"
        title={documentTaxFree ? `${t('Документи')} TF ${documentTaxFree.Number || ''}` : t('Документи')}
        onClose={() => setDocumentTaxFree(null)}
      >
        {documentTaxFree && (
          <TaxFreeDocumentsPanel
            taxFree={documentTaxFree}
            onUpdated={(updatedTaxFree) => {
              setDocumentTaxFree(updatedTaxFree)
              setPackList((currentPackList) => replaceTaxFree(currentPackList, updatedTaxFree))
              setOriginalPackList((currentPackList) => currentPackList ? replaceTaxFree(currentPackList, updatedTaxFree) : currentPackList)
            }}
          />
        )}
      </AppDrawer>

      <AppModal centered opened={Boolean(deleteTaxFree)} title={t('Підтвердити видалення')} onClose={() => setDeleteTaxFree(null)}>
        <Stack>
          <Text size="sm">{t('Видалити')} TF {deleteTaxFree?.Number || ''}?</Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setDeleteTaxFree(null)}>{t('Скасувати')}</Button>
            <Button
              color="red"
              onClick={() => {
                if (packList && deleteTaxFree) {
                  setPackList({
                    ...packList,
                    TaxFrees: (packList.TaxFrees || []).filter((taxFree) => taxFree.NetUid !== deleteTaxFree.NetUid),
                  })
                }
                setDeleteTaxFree(null)
              }}
            >
              {t('Видалити')}
            </Button>
          </Group>
        </Stack>
      </AppModal>
    </Stack>
  )
}

function TaxFreeCard({
  isDirty,
  isReadOnly,
  onDelete,
  onDocuments,
  onItemQtyChange,
  onPrint,
  onSelect,
  onSelectCarrier,
  onStatusChange,
  onToggleItem,
  selectedItemIds,
  selectedTaxFreeIds,
  statusOptions,
  taxFree,
  taxFreeId,
  taxFreeIndex,
}: {
  isDirty: boolean
  isReadOnly: boolean
  onDelete: () => void
  onDocuments: () => void
  onItemQtyChange: (itemIndex: number, qty: number) => void
  onPrint: () => void
  onSelect: (checked: boolean) => void
  onSelectCarrier: () => void
  onStatusChange: (status: TaxFreeStatus) => void
  onToggleItem: (item: TaxFreeItem, itemIndex: number, checked: boolean) => void
  selectedItemIds: Set<string>
  selectedTaxFreeIds: Set<string>
  statusOptions: Array<{ label: string, value: TaxFreeStatus }>
  taxFree: TaxFree
  taxFreeId: string
  taxFreeIndex: number
}) {
  const { t } = useI18n()
  const columns = useTaxFreeItemColumns({
    isReadOnly,
    isSelected: (item, index) => selectedItemIds.has(getTaxFreeItemId(taxFree, taxFreeIndex, item, index)),
    onItemQtyChange,
    onToggleItem,
    taxFree,
  })
  const statusValue = String(taxFree.TaxFreeStatus ?? TaxFreeStatusValue.NotFormed)
  const canPrint = taxFree.TaxFreeStatus === TaxFreeStatusValue.Formed || taxFree.TaxFreeStatus === TaxFreeStatusValue.Printed
  const canSelectCarrier = taxFree.TaxFreeStatus === TaxFreeStatusValue.Printed

  return (
    <Card withBorder radius="sm" className="tax-free-card">
      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <Group gap="xs">
            <Checkbox
              checked={selectedTaxFreeIds.has(taxFreeId)}
              onChange={(event) => onSelect(event.currentTarget.checked)}
            />
            <Text fw={700}>TF {taxFree.Number || t('новий')}</Text>
            {isReadOnly && <Badge color="gray" variant="light">{t('Тільки читання')}</Badge>}
          </Group>
          <Group gap="xs">
            <Tooltip label={t('Документи')}>
              <ActionIcon aria-label={t('Документи')} variant="subtle" onClick={onDocuments}>
                <IconFile size={16} />
              </ActionIcon>
            </Tooltip>
            {!isDirty && canPrint && (
              <Tooltip label={t('Друк')}>
                <ActionIcon aria-label={t('Друк')} loading={false} variant="subtle" onClick={onPrint}>
                  <IconPrinter size={16} />
                </ActionIcon>
              </Tooltip>
            )}
            {!isDirty && canSelectCarrier && (
              <Tooltip label={t('Перевізник')}>
                <ActionIcon aria-label={t('Перевізник')} variant="subtle" onClick={onSelectCarrier}>
                  <IconTruckDelivery size={16} />
                </ActionIcon>
              </Tooltip>
            )}
            {!isReadOnly && (
              <Tooltip label={t('Видалити')}>
                <ActionIcon aria-label={t('Видалити')} color="red" variant="subtle" onClick={onDelete}>
                  <IconTrash size={16} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        </Group>

        <DataTable
          columns={columns}
          data={taxFree.TaxFreeItems || []}
          defaultLayout={TAX_FREE_ITEMS_TABLE_DEFAULT_LAYOUT}
          emptyText={t('Позицій немає')}
          getRowId={(item, index) => getTaxFreeItemId(taxFree, taxFreeIndex, item, index)}
          layoutVersion="tax-free-pack-list-card-items-table-1"
          maxHeight={260}
          minWidth={920}
          tableId={`tax-free-pack-list-card-items-${taxFreeId}`}
          onRowClick={(item) => {
            const index = (taxFree.TaxFreeItems || []).indexOf(item)
            if (!isReadOnly && index >= 0) {
              const itemId = getTaxFreeItemId(taxFree, taxFreeIndex, item, index)
              onToggleItem(item, index, !selectedItemIds.has(itemId))
            }
          }}
        />

        <Group justify="space-between">
          <Select
            data={statusOptions.map((status) => ({ label: status.label, value: String(status.value) }))}
            disabled={isReadOnly}
            label={t('Статус')}
            size="xs"
            value={statusValue}
            w={220}
            onChange={(value) => {
              if (value !== null) {
                onStatusChange(Number(value) as TaxFreeStatus)
              }
            }}
          />
          <TotalsLine
            items={[
              [t('К-сть'), formatNumber(getTaxFreeTotalQty(taxFree))],
              [t('Вага'), formatNumber(taxFree.TotalNetWeight)],
              [`${t('З ПДВ')} PLN`, formatMoney(taxFree.TotalWithVatPl)],
            ]}
          />
        </Group>
      </Stack>
    </Card>
  )
}

function ReadonlyField({ label, value }: { label: string, value: string }) {
  return (
    <div>
      <Text size="xs" c="dimmed">{label}</Text>
      <Text size="sm" fw={600}>{displayValue(value)}</Text>
    </div>
  )
}

function TotalsLine({ items }: { items: Array<[string, string]> }) {
  return (
    <Group gap="md" className="tax-free-totals">
      {items.map(([label, value]) => (
        <div key={label}>
          <Text size="xs" c="dimmed">{label}</Text>
          <Text size="sm" fw={700}>{value}</Text>
        </div>
      ))}
    </Group>
  )
}

function useSourceColumns({
  disabled,
  isSelected,
  onDelete,
  onMaxQtyChange,
  onQtyChange,
  toggleSource,
}: {
  disabled: boolean
  isSelected: (rowId: string) => boolean
  onDelete: (row: SourceRow) => void
  onMaxQtyChange: (row: SourceRow, value: number) => void
  onQtyChange: (row: SourceRow, value: number) => void
  toggleSource: (rowId: string, enabled: boolean) => void
}) {
  const { t } = useI18n()

  return useMemo<DataTableColumn<SourceRow>[]>(
    () => [
      {
        id: 'selected',
        header: '',
        width: 48,
        enableSorting: false,
        cell: (row) => (
          <Checkbox
            checked={isSelected(row.id)}
            disabled={disabled || getSourceUnpackedQty(row.entity) <= 0}
            onChange={(event) => toggleSource(row.id, event.currentTarget.checked)}
            onClick={(event) => event.stopPropagation()}
          />
        ),
      },
      {
        id: 'vendorCode',
        header: t('Код'),
        width: 130,
        accessor: (row) => getSourceProduct(row.entity)?.VendorCode,
        cell: (row) => displayValue(getSourceProduct(row.entity)?.VendorCode),
      },
      {
        id: 'productName',
        header: t('Назва'),
        minWidth: 220,
        accessor: (row) => getSourceProduct(row.entity)?.Name,
        cell: (row) => displayValue(getSourceProduct(row.entity)?.Name),
      },
      {
        id: 'supplier',
        header: t('Постачальник'),
        width: 180,
        accessor: (row) => 'Supplier' in row.entity ? getEntityName(row.entity.Supplier) : '',
        cell: (row) => displayValue('Supplier' in row.entity ? getEntityName(row.entity.Supplier) : ''),
      },
      {
        id: 'unpackedQty',
        header: t('К-сть'),
        width: 110,
        align: 'right',
        accessor: (row) => getSourceUnpackedQty(row.entity),
        cell: (row) => (
          <NumberInput
            disabled={disabled}
            min={0}
            size="xs"
            value={getSourceUnpackedQty(row.entity)}
            onChange={(value) => onQtyChange(row, typeof value === 'number' ? value : Number(value) || 0)}
            onClick={(event) => event.stopPropagation()}
          />
        ),
      },
      {
        id: 'amount',
        header: 'EUR',
        width: 95,
        align: 'right',
        accessor: (row) => getSourceAmount(row.entity),
        cell: (row) => formatMoney(getSourceAmount(row.entity)),
      },
      {
        id: 'amountLocal',
        header: 'PLN',
        width: 95,
        align: 'right',
        accessor: (row) => getSourceAmountLocal(row.entity),
        cell: (row) => formatMoney(getSourceAmountLocal(row.entity)),
      },
      {
        id: 'weight',
        header: t('Вага'),
        width: 95,
        align: 'right',
        accessor: (row) => getSourceWeight(row.entity),
        cell: (row) => formatNumber(getSourceWeight(row.entity)),
      },
      {
        id: 'maxQtyPerTf',
        header: t('Макс. в TF'),
        width: 115,
        align: 'right',
        accessor: (row) => row.entity.MaxQtyPerTF,
        cell: (row) => (
          <NumberInput
            disabled={disabled}
            min={0}
            size="xs"
            value={row.entity.MaxQtyPerTF || 0}
            onChange={(value) => onMaxQtyChange(row, typeof value === 'number' ? value : Number(value) || 0)}
            onClick={(event) => event.stopPropagation()}
          />
        ),
      },
      {
        id: 'delete',
        header: '',
        width: 54,
        enableSorting: false,
        cell: (row) => row.isOrderItem ? null : (
          <ActionIcon
            aria-label={t('Видалити')}
            color="red"
            disabled={disabled}
            size="sm"
            variant="subtle"
            onClick={(event) => {
              event.stopPropagation()
              onDelete(row)
            }}
          >
            <IconTrash size={16} />
          </ActionIcon>
        ),
      },
    ],
    [disabled, isSelected, onDelete, onMaxQtyChange, onQtyChange, t, toggleSource],
  )
}

function useTaxFreeItemColumns({
  isReadOnly,
  isSelected,
  onItemQtyChange,
  onToggleItem,
  taxFree,
}: {
  isReadOnly: boolean
  isSelected: (item: TaxFreeItem, index: number) => boolean
  onItemQtyChange: (itemIndex: number, qty: number) => void
  onToggleItem: (item: TaxFreeItem, itemIndex: number, checked: boolean) => void
  taxFree: TaxFree
}) {
  const { t } = useI18n()

  return useMemo<DataTableColumn<TaxFreeItem>[]>(
    () => [
      {
        id: 'selected',
        header: '',
        width: 48,
        enableSorting: false,
        cell: (item) => {
          const index = (taxFree.TaxFreeItems || []).indexOf(item)

          return (
            <Checkbox
              checked={isSelected(item, index)}
              disabled={isReadOnly}
              onChange={(event) => onToggleItem(item, index, event.currentTarget.checked)}
              onClick={(event) => event.stopPropagation()}
            />
          )
        },
      },
      {
        id: 'vendorCode',
        header: t('Код'),
        width: 120,
        accessor: (item) => getTaxFreeItemProduct(item)?.VendorCode,
        cell: (item) => displayValue(getTaxFreeItemProduct(item)?.VendorCode),
      },
      {
        id: 'productName',
        header: t('Назва'),
        minWidth: 220,
        accessor: (item) => getTaxFreeItemProduct(item)?.Name,
        cell: (item) => displayValue(getTaxFreeItemProduct(item)?.Name),
      },
      {
        id: 'qty',
        header: t('К-сть'),
        width: 110,
        align: 'right',
        accessor: (item) => item.ChangedQty ?? item.Qty,
        cell: (item) => {
          const index = (taxFree.TaxFreeItems || []).indexOf(item)

          return (
            <NumberInput
              disabled={isReadOnly}
              min={0}
              size="xs"
              value={item.ChangedQty ?? item.Qty ?? 0}
              onChange={(value) => onItemQtyChange(index, typeof value === 'number' ? value : Number(value) || 0)}
              onClick={(event) => event.stopPropagation()}
            />
          )
        },
      },
      {
        id: 'weight',
        header: t('Вага'),
        width: 95,
        align: 'right',
        accessor: (item) => item.TotalNetWeight,
        cell: (item) => formatNumber(item.TotalNetWeight),
      },
      {
        id: 'unitPrice',
        header: t('Ціна'),
        width: 95,
        align: 'right',
        accessor: getTaxFreeItemUnitPrice,
        cell: (item) => formatMoney(getTaxFreeItemUnitPrice(item)),
      },
      {
        id: 'totalWithVat',
        header: t('Разом EUR'),
        width: 110,
        align: 'right',
        accessor: (item) => item.TotalWithVat,
        cell: (item) => formatMoney(item.TotalWithVat),
      },
      {
        id: 'vatAmount',
        header: t('ПДВ PLN'),
        width: 100,
        align: 'right',
        accessor: (item) => item.VatAmountPl,
        cell: (item) => formatMoney(item.VatAmountPl),
      },
      {
        id: 'totalPln',
        header: t('Разом PLN'),
        width: 110,
        align: 'right',
        accessor: (item) => item.TotalWithVatPl,
        cell: (item) => formatMoney(item.TotalWithVatPl),
      },
    ],
    [isReadOnly, isSelected, onItemQtyChange, onToggleItem, t, taxFree],
  )
}

function buildSourceRows(packList: TaxFreePackList | null): SourceRow[] {
  if (!packList) {
    return []
  }

  const rows = packList.IsFromSale
    ? packList.TaxFreePackListOrderItems || []
    : packList.SupplyOrderUkraineCartItems || []

  return rows.map((entity, index) => ({
    entity,
    id: entity.NetUid || String(entity.Id || index),
    isOrderItem: Boolean(packList.IsFromSale),
  }))
}

function buildOrganizationOptions(organizations: Organization[], fallbackLabel: string) {
  const options: Array<{ label: string; value: string }> = []

  for (const organization of organizations) {
    const value = getOrganizationOptionValue(organization)

    if (!value) {
      continue
    }

    options.push({
      label: organization.Name || organization.FullName || fallbackLabel,
      value,
    })
  }

  return options
}

function buildClientOptions(clients: Client[]) {
  const options: Array<{ label: string; value: string }> = []

  for (const client of clients) {
    const value = getClientOptionValue(client)

    if (!value) {
      continue
    }

    options.push({
      label: getClientLabel(client),
      value,
    })
  }

  return options
}

function buildClientAgreementOptions(agreements: ClientAgreement[]) {
  const options: Array<{ label: string; value: string }> = []

  for (const agreement of agreements) {
    const value = getClientAgreementOptionValue(agreement)

    if (!value) {
      continue
    }

    options.push({
      label: getClientAgreementLabel(agreement),
      value,
    })
  }

  return options
}

function getSourceRowsAvailableForMove(sourceRows: SourceRow[]) {
  const ids: string[] = []

  for (const row of sourceRows) {
    if (getSourceUnpackedQty(row.entity) > 0) {
      ids.push(row.id)
    }
  }

  return ids
}

function getOrganizationOptionValue(organization: Organization) {
  return organization.NetUid || String(organization.Id || '')
}

function getClientOptionValue(client: Client) {
  return client.NetUid || String(client.Id || '')
}

function getClientAgreementOptionValue(agreement: ClientAgreement) {
  return agreement.NetUid || String(agreement.AgreementId || agreement.Id || '')
}

function sourceRowToTaxFreeItem(row: SourceRow, isFromSale?: boolean): TaxFreeItem {
  const product = getSourceProduct(row.entity)
  const qty = getSourceUnpackedQty(row.entity)

  return {
    ChangedQty: qty,
    ProductFullName: getProductName(product),
    Qty: qty,
    TaxFreePackListOrderItem: isFromSale ? row.entity as TaxFreePackListOrderItem : undefined,
    SupplyOrderUkraineCartItem: isFromSale ? undefined : row.entity as SupplyOrderUkraineCartItem,
  }
}

function getSourceProduct(entity: SupplyOrderUkraineCartItem | TaxFreePackListOrderItem) {
  return (entity as SupplyOrderUkraineCartItem).Product || (entity as TaxFreePackListOrderItem).OrderItem?.Product
}

function getSourceUnpackedQty(entity: SupplyOrderUkraineCartItem | TaxFreePackListOrderItem) {
  return entity.UnpackedQty || 0
}

function getSourceAmount(entity: SupplyOrderUkraineCartItem | TaxFreePackListOrderItem) {
  return (entity as SupplyOrderUkraineCartItem).TotalAmount ?? (entity as TaxFreePackListOrderItem).OrderItem?.TotalAmount
}

function getSourceAmountLocal(entity: SupplyOrderUkraineCartItem | TaxFreePackListOrderItem) {
  return (entity as SupplyOrderUkraineCartItem).TotalAmountLocal ?? (entity as TaxFreePackListOrderItem).OrderItem?.TotalAmountLocal
}

function getSourceWeight(entity: SupplyOrderUkraineCartItem | TaxFreePackListOrderItem) {
  return entity.TotalNetWeight || entity.NetWeight || 0
}

function getSourceTotals(packList: TaxFreePackList | null) {
  return {
    amount: packList?.TotalUnspecifiedAmount || 0,
    amountLocal: packList?.TotalUnspecifiedAmountLocal || 0,
    qty: packList?.IsFromSale
      ? (packList.TaxFreePackListOrderItems || []).reduce((total, item) => total + (item.UnpackedQty || 0), 0)
      : (packList?.SupplyOrderUkraineCartItems || []).reduce((total, item) => total + (item.UnpackedQty || 0), 0),
    weight: packList?.TotalUnspecifiedWeight || 0,
  }
}

function updateSourceRow(
  packList: TaxFreePackList,
  row: SourceRow,
  changes: Partial<SupplyOrderUkraineCartItem & TaxFreePackListOrderItem>,
): TaxFreePackList {
  if (packList.IsFromSale) {
    return {
      ...packList,
      TaxFreePackListOrderItems: (packList.TaxFreePackListOrderItems || []).map((item) => (
        getEntityId(item) === row.id ? { ...item, ...changes } : item
      )),
    }
  }

  return {
    ...packList,
    SupplyOrderUkraineCartItems: (packList.SupplyOrderUkraineCartItems || []).map((item) => (
      getEntityId(item) === row.id ? { ...item, ...changes } : item
    )),
  }
}

function removeSourceRow(packList: TaxFreePackList, row: SourceRow): TaxFreePackList {
  return {
    ...packList,
    SupplyOrderUkraineCartItems: (packList.SupplyOrderUkraineCartItems || []).filter((item) => getEntityId(item) !== row.id),
  }
}

function updateTaxFreeItem(
  packList: TaxFreePackList,
  taxFreeIndex: number,
  itemIndex: number,
  changes: Partial<TaxFreeItem>,
): TaxFreePackList {
  return {
    ...packList,
    TaxFrees: (packList.TaxFrees || []).map((taxFree, index) => index === taxFreeIndex
      ? {
          ...taxFree,
          TaxFreeItems: (taxFree.TaxFreeItems || []).map((item, currentItemIndex) => (
            currentItemIndex === itemIndex ? { ...item, ...changes } : item
          )),
        }
      : taxFree),
  }
}

function updateTaxFreeStatus(packList: TaxFreePackList, taxFreeIndex: number, status: TaxFreeStatus): TaxFreePackList {
  return {
    ...packList,
    TaxFrees: (packList.TaxFrees || []).map((taxFree, index) => {
      if (index !== taxFreeIndex) {
        return taxFree
      }

      return {
        ...taxFree,
        DateOfIssue: !taxFree.DateOfIssue && status === TaxFreeStatusValue.Formed ? new Date().toISOString() : taxFree.DateOfIssue,
        DateOfPrint: !taxFree.DateOfPrint && status === TaxFreeStatusValue.Printed ? new Date().toISOString() : taxFree.DateOfPrint,
        TaxFreeStatus: status,
      }
    }),
  }
}

function replaceTaxFree(packList: TaxFreePackList, updatedTaxFree: TaxFree): TaxFreePackList {
  return normalizePackList({
    ...packList,
    TaxFrees: (packList.TaxFrees || []).map((taxFree) => (
      taxFree.NetUid === updatedTaxFree.NetUid ? updatedTaxFree : taxFree
    )),
  })
}

function preparePackListForSave(packList: TaxFreePackList): TaxFreePackList {
  return {
    ...packList,
    TaxFrees: (packList.TaxFrees || []).map((taxFree) => ({
      ...taxFree,
      TaxFreeItems: (taxFree.TaxFreeItems || []).map((item) => ({
        ...item,
        Qty: item.ChangedQty ?? item.Qty ?? 0,
      })),
    })),
  }
}

function isTaxFreeReadOnly(taxFree: TaxFree, packList?: TaxFreePackList | null): boolean {
  return Boolean(packList?.IsSent || (taxFree.TaxFreeStatus ?? 0) >= TaxFreeStatusValue.Printed)
}

function isTaxFreeGroupPrintable(taxFree: TaxFree): boolean {
  return taxFree.TaxFreeStatus !== TaxFreeStatusValue.NotFormed
}

function getTaxFreeId(taxFree: TaxFree, index: number): string {
  return taxFree.NetUid || String(taxFree.Id || `tax-free-${index}`)
}

function getTaxFreeItemId(taxFree: TaxFree, taxFreeIndex: number, item: TaxFreeItem, itemIndex: number): string {
  return item.NetUid || String(item.Id || `${getTaxFreeId(taxFree, taxFreeIndex)}-item-${itemIndex}`)
}

function getEntityId(entity: { Id?: number, NetUid?: string }) {
  return entity.NetUid || String(entity.Id || '')
}
