import {
  ActionIcon,
  Alert,
  Anchor,
  Box,
  Button,
  Card,
  Group,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconDownload,
  IconEdit,
  IconFileTypePdf,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { useEffect, useMemo, useReducer, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getDocumentHref } from '../../../shared/url/getDocumentHref'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { useAuth } from '../../auth/useAuth'
import {
  deleteTaxFreeCarrier,
  exportTaxFreeCarriersDocument,
  getTaxFreeCarriers,
  searchTaxFreeCarriers,
} from '../api/taxFreeCarriersApi'
import { TAX_FREE_CARRIER_MANAGE_PERMISSION, TAX_FREE_CARRIER_PRINT_PERMISSION } from '../permissions'
import type { TaxFreeCarrier, TaxFreeCarrierExportColumn, TaxFreeCarrierExportDocument } from '../types'

const CARRIERS_PATH = '/tax-free/carriers/all'

const CARRIERS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['index', 'lastName'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const EXPORT_COLUMNS: TaxFreeCarrierExportColumn[] = [
  { Number: 1, TableName: 'Statham', ColumnName: 'LastName', Translate: 'Прізвище' },
  { Number: 2, TableName: 'Statham', ColumnName: 'FirstName', Translate: "Ім'я" },
  { Number: 3, TableName: 'Statham', ColumnName: 'MiddleName', Translate: 'По батькові' },
]

function useTaxFreeCarriersPageModel() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const canManage = hasPermission(TAX_FREE_CARRIER_MANAGE_PERMISSION)
  const canPrint = hasPermission(TAX_FREE_CARRIER_PRINT_PERMISSION)
  const [carriers, setCarriers] = useValueState<TaxFreeCarrier[]>([])
  const [searchDraft, setSearchDraft] = useValueState('')
  const [activeSearch, setActiveSearch] = useValueState('')
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [carrierToDelete, setCarrierToDelete] = useValueState<TaxFreeCarrier | null>(null)
  const [isDeleting, setDeleting] = useValueState(false)
  const [downloadOpened, setDownloadOpened] = useValueState(false)
  const [downloadDocument, setDownloadDocument] = useValueState<TaxFreeCarrierExportDocument | null>(null)
  const [downloadError, setDownloadError] = useValueState<string | null>(null)
  const [isDownloading, setDownloading] = useValueState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const downloadRequestRef = useRef(0)
  const carrierIndexMap = useMemo(() => buildIndexMap(carriers), [carriers])

  useTaxFreeCarriersLoader({ activeSearch, reloadKey, setCarriers, setError, setLoading })

  function applySearch() {
    setActiveSearch(searchDraft.trim())
  }

  function resetSearch() {
    setSearchDraft('')
    setActiveSearch('')
  }

  function openCreate() {
    navigate('/tax-free/carriers/new')
  }

  function openEdit(carrier: TaxFreeCarrier) {
    if (carrier.NetUid) {
      navigate(`/tax-free/carriers/edit/${carrier.NetUid}`)
    }
  }

  async function confirmDelete() {
    const netId = carrierToDelete?.NetUid

    if (!netId) {
      return
    }

    setDeleting(true)
    setError(null)

    try {
      await deleteTaxFreeCarrier(netId)
      notifications.show({ color: 'green', message: t('Перевізника видалено') })
      setCarrierToDelete(null)
      reload()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t('Не вдалося видалити перевізника'))
    } finally {
      setDeleting(false)
    }
  }

  function closeDownload() {
    downloadRequestRef.current += 1
    setDownloadOpened(false)
    setDownloadDocument(null)
    setDownloadError(null)
    setDownloading(false)
  }

  async function exportDocument() {
    const requestId = downloadRequestRef.current + 1
    downloadRequestRef.current = requestId
    setDownloadOpened(true)
    setDownloadDocument(null)
    setDownloadError(null)
    setDownloading(true)

    try {
      const document = await exportTaxFreeCarriersDocument(EXPORT_COLUMNS)

      if (downloadRequestRef.current === requestId) {
        setDownloadDocument(document)
      }
    } catch (exportError) {
      if (downloadRequestRef.current === requestId) {
        setDownloadError(exportError instanceof Error ? exportError.message : t('Документ недоступний для завантаження'))
      }
    } finally {
      if (downloadRequestRef.current === requestId) {
        setDownloading(false)
      }
    }
  }

  const columns = useCarrierColumns({ canManage, carrierIndexMap, onDelete: setCarrierToDelete, onEdit: openEdit })

  const toolbarLeft = useMemo(
    () => (
      <Text size="xs" c="dimmed">
        {t('Показано')} {carriers.length}
      </Text>
    ),
    [carriers.length, t],
  )

  return {
    canManage, canPrint, carrierToDelete, carriers, columns, downloadDocument, downloadError, downloadOpened, error,
    isDeleting, isDownloading, isLoading, searchDraft, toolbarLeft, applySearch, closeDownload, confirmDelete,
    exportDocument, openCreate, openEdit, reload, resetSearch, setCarrierToDelete, setSearchDraft,
  }
}

function useTaxFreeCarriersLoader({
  activeSearch,
  reloadKey,
  setCarriers,
  setError,
  setLoading,
}: {
  activeSearch: string
  reloadKey: number
  setCarriers: (value: TaxFreeCarrier[]) => void
  setError: (value: string | null) => void
  setLoading: (value: boolean) => void
}) {
  const { t } = useI18n()

  useEffect(() => {
    let cancelled = false

    async function loadCarriers() {
      setLoading(true)
      setError(null)

      try {
        const nextCarriers = activeSearch ? await searchTaxFreeCarriers(activeSearch) : await getTaxFreeCarriers()

        if (!cancelled) {
          setCarriers(nextCarriers)
        }
      } catch (loadError) {
        if (!cancelled) {
          setCarriers([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити перевізників'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadCarriers()

    return () => {
      cancelled = true
    }
  }, [activeSearch, reloadKey, setCarriers, setError, setLoading, t])
}

export function TaxFreeCarriersPage() {
  const model = useTaxFreeCarriersPageModel()

  return (
    <Stack gap="lg">
      <CarriersTableCard model={model} />
      <CarriersDeleteModal model={model} />
      <CarriersDownloadModal model={model} />
    </Stack>
  )
}

function CarriersTableCard({ model }: { model: ReturnType<typeof useTaxFreeCarriersPageModel> }) {
  const { t } = useI18n()
  const {
    applySearch, canManage, canPrint, columns, carriers, error, exportDocument, isDownloading, isLoading, openCreate,
    openEdit, reload, resetSearch, searchDraft, setSearchDraft, toolbarLeft,
  } = model

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="md">
        <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
          <TextInput
            label={t('Пошук')}
            leftSection={<IconSearch size={16} />}
            value={searchDraft}
            style={{ flex: '1 1 auto', minWidth: 180 }}
            onChange={(event) => setSearchDraft(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                applySearch()
              }
            }}
          />
          <Button color="gray" variant="light" onClick={applySearch}>
            {t('Пошук')}
          </Button>
          <Button color="gray" variant="subtle" onClick={resetSearch}>
            {t('Скинути')}
          </Button>
          <Tooltip label={t('Оновити')}>
            <ActionIcon
              aria-label={t('Оновити')}
              color="gray"
              loading={isLoading}
              size={38}
              variant="light"
              onClick={() => reload()}
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
          {canPrint && (
            <Button
              color="gray"
              leftSection={<IconDownload size={16} />}
              loading={isDownloading}
              variant="light"
              onClick={exportDocument}
            >
              {t('Завантажити')}
            </Button>
          )}
          {canManage && (
            <Button color="violet" leftSection={<IconPlus size={16} />} onClick={openCreate}>
              {t('Додати')}
            </Button>
          )}
        </Group>

        {error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <DataTable
          columns={columns}
          data={carriers}
          defaultLayout={CARRIERS_TABLE_DEFAULT_LAYOUT}
          emptyText={t('Перевізників не знайдено')}
          getRowId={(carrier, index) => String(carrier.NetUid || carrier.Id || index)}
          isLoading={isLoading}
          layoutVersion="tax-free-carriers-table-1"
          loadingText={t('Завантаження перевізників')}
          maxHeight="calc(100vh - 320px)"
          minWidth={760}
          tableId="tax-free-carriers"
          toolbarLeft={toolbarLeft}
          onRowClick={openEdit}
        />
      </Stack>
    </Card>
  )
}

function CarriersDeleteModal({ model }: { model: ReturnType<typeof useTaxFreeCarriersPageModel> }) {
  const { t } = useI18n()
  const { carrierToDelete, confirmDelete, isDeleting, setCarrierToDelete } = model

  return (
    <AppModal
      centered
      opened={Boolean(carrierToDelete)}
      title={t('Ви впевнені, що хочете видалити?')}
      onClose={() => setCarrierToDelete(null)}
    >
      <Stack gap="md">
        <Text>{getCarrierName(carrierToDelete)}</Text>
        <Group justify="flex-end">
          <Button color="gray" disabled={isDeleting} variant="light" onClick={() => setCarrierToDelete(null)}>
            {t('Скасувати')}
          </Button>
          <Button color="red" leftSection={<IconTrash size={16} />} loading={isDeleting} onClick={confirmDelete}>
            {t('Видалити')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function CarriersDownloadModal({ model }: { model: ReturnType<typeof useTaxFreeCarriersPageModel> }) {
  const { t } = useI18n()
  const { closeDownload, downloadDocument, downloadError, downloadOpened, isDownloading } = model

  return (
    <AppModal centered opened={downloadOpened} title={t('Завантажити')} onClose={closeDownload}>
      <Stack gap="sm">
        {isDownloading ? (
          <Text c="dimmed" size="sm">
            {t('Завантаження')}
          </Text>
        ) : downloadError ? (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {downloadError}
          </Alert>
        ) : downloadDocument?.DocumentURL || downloadDocument?.PdfDocumentURL ? (
          <>
            {downloadDocument.DocumentURL && (
              <Anchor href={getDocumentHref(downloadDocument.DocumentURL)} target="_blank" rel="noreferrer" className="document-link">
                <span className="document-link-badge document-link-badge-excel">
                  <ExcelIcon size={22} />
                </span>
                <span>{t('Excel документ')}</span>
              </Anchor>
            )}
            {downloadDocument.PdfDocumentURL && (
              <Anchor href={getDocumentHref(downloadDocument.PdfDocumentURL)} target="_blank" rel="noreferrer" className="document-link">
                <span className="document-link-badge document-link-badge-pdf">
                  <IconFileTypePdf size={22} stroke={1.8} />
                </span>
                <span>{t('PDF документ')}</span>
              </Anchor>
            )}
          </>
        ) : (
          <Text c="dimmed" size="sm">
            {t('Документ недоступний для завантаження')}
          </Text>
        )}
      </Stack>
    </AppModal>
  )
}

function useCarrierColumns({
  canManage,
  carrierIndexMap,
  onDelete,
  onEdit,
}: {
  canManage: boolean
  carrierIndexMap: Map<TaxFreeCarrier, number>
  onDelete: (carrier: TaxFreeCarrier) => void
  onEdit: (carrier: TaxFreeCarrier) => void
}) {
  const { t } = useI18n()

  return useMemo<DataTableColumn<TaxFreeCarrier>[]>(
    () => [
      {
        id: 'index',
        header: '#',
        width: 56,
        minWidth: 48,
        align: 'right',
        enableSorting: false,
        enableHiding: false,
        accessor: (carrier) => carrierIndexMap.get(carrier) || 0,
        cell: (carrier) => (
          <Text c="dimmed" size="sm">
            {carrierIndexMap.get(carrier) || ''}
          </Text>
        ),
      },
      {
        id: 'lastName',
        header: t('Прізвище'),
        minWidth: 180,
        accessor: (carrier) => carrier.LastName,
        cell: (carrier) => <Text fw={700}>{displayValue(carrier.LastName)}</Text>,
      },
      {
        id: 'firstName',
        header: t("Ім'я"),
        minWidth: 180,
        accessor: (carrier) => carrier.FirstName,
        cell: (carrier) => displayValue(carrier.FirstName),
      },
      {
        id: 'middleName',
        header: t('По батькові'),
        minWidth: 180,
        accessor: (carrier) => carrier.MiddleName,
        cell: (carrier) => displayValue(carrier.MiddleName),
      },
      {
        id: 'actions',
        header: '',
        width: canManage ? 96 : 58,
        minWidth: canManage ? 96 : 58,
        maxWidth: canManage ? 96 : 58,
        align: 'center',
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
        cell: (carrier) => (
          <Box onClick={(event) => event.stopPropagation()}>
            <Group gap={4} justify="center" wrap="nowrap">
              <Tooltip label={t('Редагування Перевізника')}>
                <ActionIcon aria-label={t('Редагування Перевізника')} color="gray" variant="subtle" onClick={() => onEdit(carrier)}>
                  <IconEdit size={18} />
                </ActionIcon>
              </Tooltip>
              {canManage && (
                <Tooltip label={t('Видалити')}>
                  <ActionIcon aria-label={t('Видалити')} color="red" variant="subtle" onClick={() => onDelete(carrier)}>
                    <IconTrash size={18} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
          </Box>
        ),
      },
    ],
    [canManage, carrierIndexMap, onDelete, onEdit, t],
  )
}

function buildIndexMap(carriers: TaxFreeCarrier[]): Map<TaxFreeCarrier, number> {
  return carriers.reduce((indexMap, carrier, index) => {
    indexMap.set(carrier, index + 1)

    return indexMap
  }, new Map<TaxFreeCarrier, number>())
}

function getCarrierName(carrier: TaxFreeCarrier | null): string {
  if (!carrier) {
    return ''
  }

  return [carrier.LastName, carrier.FirstName, carrier.MiddleName].filter(Boolean).join(' ').trim()
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return String(value)
}

export const TAX_FREE_CARRIERS_PATH = CARRIERS_PATH
