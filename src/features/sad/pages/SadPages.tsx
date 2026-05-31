import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Divider,
  FileInput,
  Group,
  Loader,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { AppModal } from "../../../shared/ui/AppModal"
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconArrowLeft,
  IconArrowRight,
  IconCash,
  IconDownload,
  IconEdit,
  IconEye,
  IconFileUpload,
  IconPackage,
  IconPlus,
  IconRefresh,
  IconTrash,
} from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DocumentOutcomePaymentModal } from '../../document-outcome-payment'
import type { DocumentOutcomePaymentSource } from '../../document-outcome-payment'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import {
  deleteSad,
  deleteSadDocument,
  getClientAgreements,
  getOrganizations,
  getSad,
  getSadDocuments,
  getSadPalletTypes,
  getSads,
  getSadWithSpecifications,
  searchClients,
  searchOrganizationClients,
  searchStathams,
  updateProductSpecification,
  updateSad,
  updateSaleSad,
  uploadProductSpecificationForSad,
  uploadSadDocuments,
} from '../api/sadApi'
import type {
  Sad,
  SadAgreement,
  SadClient,
  SadClientAgreement,
  SadDocument,
  SadItem,
  SadOrganization,
  SadOrganizationClient,
  SadOrganizationClientAgreement,
  SadPallet,
  SadPalletItem,
  SadPalletType,
  SadPrintDocument,
  SadProduct,
  SadProductSpecification,
  SadSpecificationParseConfiguration,
  SadStatham,
  SadStathamCar,
  SadTypeValue,
} from '../types'
import { SAD_TYPES } from '../types'

const DEFAULT_PAGE_SIZE = 20
const PAGE_SIZE_OPTIONS = ['20', '40', '60', '100']

const SAD_LIST_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['fromDate', 'number'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const SAD_ITEMS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['select', 'vendorCode', 'product'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const SAD_SPEC_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['vendorCode', 'product'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const numberFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
})

const qtyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 3,
})

type EditorMode = 'base' | 'sale' | 'tir'

type SelectOption = {
  label: string
  value: string
}

type PalletTableRow = SadPalletItem & {
  __pallet: SadPallet
  __rowId: string
}

type DownloadDocumentLink = {
  label: string
  url?: string
}

export function AllSadsPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [filters, setFilters] = useState(() => ({
    from: getDateShiftedByDays(-7),
    to: formatLocalDate(new Date()),
  }))
  const [sads, setSads] = useState<Sad[]>([])
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setLoading] = useState(false)
  const [isLoadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedSad, setSelectedSad] = useState<Sad | null>(null)
  const [outcomeSource, setOutcomeSource] = useState<DocumentOutcomePaymentSource | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Sad | null>(null)
  const [isDeleting, setDeleting] = useState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)

  const loadSads = useCallback(async (offset: number) => {
    if (offset === 0) {
      setLoading(true)
    } else {
      setLoadingMore(true)
    }

    setError(null)

    try {
      const rows = await getSads({
        from: new Date(filters.from).toISOString(),
        limit: pageSize,
        offset,
        to: new Date(filters.to).toISOString(),
      })

      setSads((currentRows) => offset === 0 ? rows : [...currentRows, ...rows])
      setHasMore(rows.length >= pageSize)
    } catch (loadError) {
      setError(getErrorMessage(loadError, t('Не вдалося завантажити SAD')))
      if (offset === 0) {
        setSads([])
        setHasMore(false)
      }
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [filters.from, filters.to, pageSize, t])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSads(0)
  }, [loadSads, reloadKey])

  const columns = useMemo<DataTableColumn<Sad>[]>(
    () => [
      {
        id: 'fromDate',
        header: t('Дата'),
        accessor: (sad) => sad.FromDate,
        cell: (sad) => formatDate(sad.FromDate),
        width: 130,
      },
      {
        id: 'number',
        header: t('Номер'),
        accessor: (sad) => sad.Number,
        width: 170,
      },
      {
        id: 'status',
        header: t('Статус'),
        accessor: (sad) => sad.IsSend,
        cell: (sad) => <StatusBadge sad={sad} />,
        width: 130,
      },
      {
        id: 'order',
        header: t('Замовлення'),
        accessor: (sad) => sad.SupplyOrderUkraineId,
        cell: (sad) => (
          <Badge color={sad.SupplyOrderUkraineId ? 'green' : 'gray'} variant="light">
            {sad.SupplyOrderUkraineId ? t('Створено') : t('Немає')}
          </Badge>
        ),
        width: 120,
      },
      {
        id: 'organization',
        header: t('Організація'),
        accessor: (sad) => sad.Organization?.Name,
        minWidth: 160,
      },
      {
        id: 'client',
        header: t('Клієнт'),
        accessor: (sad) => getSadClientName(sad),
        minWidth: 220,
      },
      {
        id: 'type',
        header: t('Тип'),
        accessor: (sad) => getSadTypeLabel(sad.SadType),
        cell: (sad) => getSadTypeLabel(sad.SadType),
        width: 90,
      },
      {
        id: 'carrier',
        header: t('Перевізник'),
        accessor: (sad) => sad.Statham?.LastName || sad.Statham?.FullName,
        width: 150,
      },
      {
        id: 'amount',
        header: t('EUR'),
        accessor: (sad) => sad.TotalAmountWithMargin ?? sad.TotalAmount,
        cell: (sad) => formatNumber(sad.TotalAmountWithMargin ?? sad.TotalAmount),
        align: 'right',
        width: 120,
      },
      {
        id: 'amountLocal',
        header: t('Місцева валюта'),
        accessor: (sad) => sad.TotalAmountLocal,
        cell: (sad) => formatNumber(sad.TotalAmountLocal),
        align: 'right',
        width: 120,
      },
      {
        id: 'responsible',
        header: t('Відповідальний'),
        accessor: (sad) => getUserName(sad.Responsible),
        width: 160,
      },
      {
        id: 'comment',
        header: t('Коментар'),
        accessor: (sad) => sad.Comment,
        minWidth: 180,
      },
      {
        id: 'actions',
        header: '',
        cell: (sad) => (
          <Group gap={4} justify="flex-end" wrap="nowrap">
            <Tooltip label={t('Переглянути')}>
              <ActionIcon
                aria-label={t('Переглянути')}
                size="sm"
                variant="subtle"
                onClick={(event) => {
                  event.stopPropagation()
                  setSelectedSad(sad)
                }}
              >
                <IconEye size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Створити видатковий ордер')}>
              <ActionIcon
                aria-label={t('Створити видатковий ордер')}
                size="sm"
                variant="subtle"
                onClick={(event) => {
                  event.stopPropagation()
                  setOutcomeSource(buildSadOutcomeSource(sad))
                }}
              >
                <IconCash size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={sad.IsSend ? t('Проведений SAD не можна видалити') : t('Видалити')}>
              <ActionIcon
                aria-label={t('Видалити')}
                color="red"
                disabled={sad.IsSend}
                size="sm"
                variant="subtle"
                onClick={(event) => {
                  event.stopPropagation()
                  setDeleteTarget(sad)
                }}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ),
        enableSorting: false,
        width: 120,
      },
    ],
    [t],
  )

  async function handleDeleteSad() {
    if (!deleteTarget?.NetUid) {
      return
    }

    setDeleting(true)

    try {
      await deleteSad(deleteTarget.NetUid)
      notifications.show({ color: 'green', message: t('SAD видалено') })
      setDeleteTarget(null)
      reload()
    } catch (deleteError) {
      notifications.show({ color: 'red', message: getErrorMessage(deleteError, t('Не вдалося видалити SAD')) })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Stack gap="md">
      <Group align="center" justify="flex-end">
        <Tooltip label={t('Оновити')}>
          <ActionIcon aria-label={t('Оновити')} loading={isLoading} variant="subtle" onClick={() => reload()}>
            <IconRefresh size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <Card withBorder radius="sm">
        <Group align="end">
          <TextInput
            label={t('З')}
            type="date"
            value={filters.from}
            onChange={(event) => setFilters((currentFilters) => ({ ...currentFilters, from: event.currentTarget.value }))}
          />
          <TextInput
            label={t('По')}
            type="date"
            value={filters.to}
            onChange={(event) => setFilters((currentFilters) => ({ ...currentFilters, to: event.currentTarget.value }))}
          />
        </Group>
      </Card>

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />}>
          {error}
        </Alert>
      )}

      <Card withBorder p={0} radius="sm">
        <DataTable
          columns={columns}
          data={sads}
          defaultLayout={SAD_LIST_TABLE_DEFAULT_LAYOUT}
          emptyText={t('SAD не знайдено')}
          getRowId={(sad, index) => sad.NetUid || String(index)}
          isLoading={isLoading}
          minWidth={1420}
          tableId="sad-all"
          toolbarLeft={
            <Text c="dimmed" size="xs">
              {t('Показано')} {sads.length}
              {hasMore ? '+' : ''}
            </Text>
          }
          toolbarRight={
            <Group gap={6} wrap="nowrap">
              <Select
                aria-label={t('Кількість рядків')}
                data={PAGE_SIZE_OPTIONS}
                size="xs"
                value={String(pageSize)}
                w={88}
                onChange={(value) => {
                  setPageSize(Number(value || DEFAULT_PAGE_SIZE))
                  reload()
                }}
              />
              <Button
                disabled={!hasMore}
                loading={isLoadingMore}
                size="xs"
                variant="light"
                onClick={() => loadSads(sads.length)}
              >
                {t('Ще')}
              </Button>
            </Group>
          }
          onRowClick={setSelectedSad}
        />
      </Card>

      <SadActionModal
        sad={selectedSad}
        onClose={() => setSelectedSad(null)}
        onNavigate={(path) => {
          setSelectedSad(null)
          navigate(path)
        }}
      />

      <DocumentOutcomePaymentModal
        opened={Boolean(outcomeSource)}
        source={outcomeSource}
        onClose={() => setOutcomeSource(null)}
      />

      <AppModal centered opened={Boolean(deleteTarget)} title={t('Видалити SAD')} onClose={() => setDeleteTarget(null)}>
        <Stack>
          <Text>{t('Видалити обраний SAD?')}</Text>
          <Group justify="flex-end">
            <Button color="gray" disabled={isDeleting} variant="subtle" onClick={() => setDeleteTarget(null)}>
              {t('Скасувати')}
            </Button>
            <Button color="red" loading={isDeleting} onClick={handleDeleteSad}>
              {t('Видалити')}
            </Button>
          </Group>
        </Stack>
      </AppModal>
    </Stack>
  )
}

export function EditSadPage() {
  const { netid } = useParams<{ netid?: string }>()

  return <SadEditorPage mode="base" netId={netid} />
}

export function EditSaleSadPage() {
  const { netid } = useParams<{ netid?: string }>()

  return <SadEditorPage mode="sale" netId={netid} />
}

export function EditTirSadPage() {
  const { netid } = useParams<{ netid?: string }>()

  return <SadEditorPage mode="tir" netId={netid} />
}

function SadEditorPage({ mode, netId }: { mode: EditorMode; netId?: string }) {
  const { t } = useI18n()
  const [sad, setSad] = useState<Sad | null>(null)
  const [organizations, setOrganizations] = useState<SadOrganization[]>([])
  const [clients, setClients] = useState<SadClient[]>([])
  const [organizationClients, setOrganizationClients] = useState<SadOrganizationClient[]>([])
  const [clientAgreements, setClientAgreements] = useState<SadClientAgreement[]>([])
  const [stathams, setStathams] = useState<SadStatham[]>([])
  const [selectedOrganizationNetId, setSelectedOrganizationNetId] = useState('')
  const [selectedClientNetId, setSelectedClientNetId] = useState('')
  const [selectedClientAgreementNetId, setSelectedClientAgreementNetId] = useState('')
  const [selectedOrganizationClientNetId, setSelectedOrganizationClientNetId] = useState('')
  const [selectedOrganizationClientAgreementNetId, setSelectedOrganizationClientAgreementNetId] = useState('')
  const [selectedStathamNetId, setSelectedStathamNetId] = useState('')
  const [selectedStathamCarNetId, setSelectedStathamCarNetId] = useState('')
  const [marginAmount, setMarginAmount] = useState<number | ''>('')
  const [isLoading, setLoading] = useState(true)
  const [isSaving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [documentsOpen, setDocumentsOpen] = useState(false)
  const [downloadDocument, setDownloadDocument] = useState<SadPrintDocument | null>(null)
  const [addItemPlaceholderOpen, setAddItemPlaceholderOpen] = useState(false)
  const [deleteItemTarget, setDeleteItemTarget] = useState<SadItem | null>(null)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)

  const selectedClient = useMemo(
    () => findByNetUid([sad?.Client, ...clients], selectedClientNetId),
    [clients, sad?.Client, selectedClientNetId],
  )
  const selectedOrganizationClient = useMemo(
    () => findByNetUid([sad?.OrganizationClient, ...organizationClients], selectedOrganizationClientNetId),
    [organizationClients, sad?.OrganizationClient, selectedOrganizationClientNetId],
  )
  const selectedStatham = useMemo(
    () => findByNetUid([sad?.Statham, ...stathams], selectedStathamNetId),
    [sad?.Statham, selectedStathamNetId, stathams],
  )
  const selectedStathamCar = useMemo(
    () => findByNetUid([sad?.StathamCar, ...(selectedStatham?.StathamCars || [])], selectedStathamCarNetId),
    [sad?.StathamCar, selectedStatham?.StathamCars, selectedStathamCarNetId],
  )
  const selectedOrganization = useMemo(
    () => findByNetUid([sad?.Organization, ...organizations], selectedOrganizationNetId),
    [organizations, sad?.Organization, selectedOrganizationNetId],
  )
  const selectedClientAgreement = useMemo(
    () => findByNetUid([sad?.ClientAgreement, ...clientAgreements], selectedClientAgreementNetId),
    [clientAgreements, sad?.ClientAgreement, selectedClientAgreementNetId],
  )
  const selectedOrganizationClientAgreement = useMemo(
    () => findByNetUid(
      [sad?.OrganizationClientAgreement, ...(selectedOrganizationClient?.OrganizationClientAgreements || [])],
      selectedOrganizationClientAgreementNetId,
    ),
    [sad?.OrganizationClientAgreement, selectedOrganizationClient?.OrganizationClientAgreements, selectedOrganizationClientAgreementNetId],
  )

  const isReadonly = Boolean(sad?.IsSend)
  const status = isLoading ? t('Завантаження') : isReadonly ? t('Проведено') : t('Чернетка')

  useEffect(() => {
    let ignore = false

    async function load() {
      if (!netId) {
        setError(t('Не передано ідентифікатор SAD'))
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const [loadedSad, loadedOrganizations] = await Promise.all([getSad(netId), getOrganizations()])

        if (ignore) {
          return
        }

        setSad(loadedSad)
        setOrganizations(loadedOrganizations)

        if (loadedSad) {
          hydrateEditorState(loadedSad, loadedOrganizations)
          if (loadedSad.Client?.NetUid) {
            const agreements = await getClientAgreements(loadedSad.Client.NetUid)
            if (!ignore) {
              setClientAgreements(agreements)
            }
          }
        }
      } catch (loadError) {
        if (!ignore) {
          setError(getErrorMessage(loadError, t('Не вдалося завантажити SAD')))
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      ignore = true
    }
  }, [netId, reloadKey, t])

  function hydrateEditorState(loadedSad: Sad, loadedOrganizations: SadOrganization[]) {
    const firstOrganization = loadedSad.Organization || loadedOrganizations[0] || null

    setSelectedOrganizationNetId(firstOrganization?.NetUid || '')
    setSelectedClientNetId(loadedSad.Client?.NetUid || '')
    setSelectedClientAgreementNetId(loadedSad.ClientAgreement?.NetUid || '')
    setSelectedOrganizationClientNetId(loadedSad.OrganizationClient?.NetUid || '')
    setSelectedOrganizationClientAgreementNetId(loadedSad.OrganizationClientAgreement?.NetUid || '')
    setSelectedStathamNetId(loadedSad.Statham?.NetUid || '')
    setSelectedStathamCarNetId(loadedSad.StathamCar?.NetUid || '')
    setMarginAmount(toEditableNumber(loadedSad.MarginAmount))
  }

  async function handleClientSearch(value: string) {
    if (value.trim().length < 2) {
      return
    }

    try {
      setClients(await searchClients(value.trim()))
    } catch (searchError) {
      notifications.show({ color: 'red', message: getErrorMessage(searchError, t('Не вдалося знайти клієнтів')) })
    }
  }

  async function handleOrganizationClientSearch(value: string) {
    if (value.trim().length < 2) {
      return
    }

    try {
      setOrganizationClients(await searchOrganizationClients(value.trim()))
    } catch (searchError) {
      notifications.show({ color: 'red', message: getErrorMessage(searchError, t('Не вдалося знайти клієнтів організації')) })
    }
  }

  async function handleStathamSearch(value: string) {
    if (value.trim().length < 2) {
      return
    }

    try {
      setStathams(await searchStathams(value.trim()))
    } catch (searchError) {
      notifications.show({ color: 'red', message: getErrorMessage(searchError, t('Не вдалося знайти перевізників')) })
    }
  }

  async function selectClient(value: string | null) {
    setSelectedClientNetId(value || '')
    setSelectedClientAgreementNetId('')
    setClientAgreements([])

    const client = findByNetUid([sad?.Client, ...clients], value)
    if (client?.NetUid) {
      try {
        const agreements = await getClientAgreements(client.NetUid)
        setClientAgreements(agreements)
        setSelectedClientAgreementNetId(agreements[0]?.NetUid || '')
      } catch (agreementsError) {
        notifications.show({ color: 'red', message: getErrorMessage(agreementsError, t('Не вдалося завантажити договори')) })
      }
    }
  }

  function selectOrganizationClient(value: string | null) {
    setSelectedOrganizationClientNetId(value || '')
    const client = findByNetUid([sad?.OrganizationClient, ...organizationClients], value)

    setMarginAmount(toEditableNumber(client?.MarginAmount))
    setSelectedOrganizationClientAgreementNetId(client?.OrganizationClientAgreements?.[0]?.NetUid || '')
  }

  function selectStatham(value: string | null) {
    setSelectedStathamNetId(value || '')
    const carrier = findByNetUid([sad?.Statham, ...stathams], value)

    setSelectedStathamCarNetId(carrier?.StathamCars?.[0]?.NetUid || '')
  }

  function updateLocalSad(updater: (currentSad: Sad) => Sad) {
    setSad((currentSad) => currentSad ? updater(currentSad) : currentSad)
  }

  async function saveSad(isSend: boolean) {
    if (!sad) {
      return
    }

    const validationError = validateSadBeforeSave({
      isSend,
      mode,
      sad,
      selectedClient,
      selectedOrganization,
      selectedOrganizationClient,
      selectedStatham,
      selectedStathamCar,
      marginAmount,
      t,
    })

    if (validationError) {
      notifications.show({ color: 'red', message: validationError })
      return
    }

    const payload = buildSadPayload({
      isSend,
      marginAmount,
      sad,
      selectedClient,
      selectedClientAgreement,
      selectedOrganization,
      selectedOrganizationClient,
      selectedOrganizationClientAgreement,
      selectedStatham,
      selectedStathamCar,
    })

    setSaving(true)

    try {
      const updatedSad = shouldUseSaleUpdate(payload, mode) ? await updateSaleSad(payload) : await updateSad(payload)

      if (updatedSad) {
        setSad(updatedSad)
        hydrateEditorState(updatedSad, organizations)
      }

      notifications.show({ color: 'green', message: isSend ? t('SAD проведено') : t('SAD збережено') })
    } catch (saveError) {
      notifications.show({ color: 'red', message: getErrorMessage(saveError, t('Не вдалося зберегти SAD')) })
    } finally {
      setSaving(false)
    }
  }

  function deleteItem(item: SadItem) {
    if (!sad) {
      return
    }

    updateLocalSad((currentSad) => ({
      ...currentSad,
      SadItems: (currentSad.SadItems || []).filter((sadItem) => getEntityKey(sadItem) !== getEntityKey(item)),
    }))
    setDeleteItemTarget(null)
  }

  async function persistDocuments(nextSad?: Sad | null) {
    if (nextSad) {
      setSad(nextSad)
      return
    }

    reload()
  }

  if (isLoading) {
    return <LoadingState label={t('Завантаження SAD')} />
  }

  if (error) {
    return (
      <Alert color="red" icon={<IconAlertCircle size={18} />}>
        {error}
      </Alert>
    )
  }

  if (!sad) {
    return (
      <Alert color="yellow" icon={<IconAlertCircle size={18} />}>
        {t('SAD не знайдено')}
      </Alert>
    )
  }

  return (
    <Stack gap="md">
      <Group align="center" justify="space-between">
        <Group gap="sm">
          <Badge color={isReadonly ? 'green' : 'yellow'}>{status}</Badge>
          <Badge variant="light">{getSadTypeLabel(sad.SadType)}</Badge>
        </Group>
        <Group>
          <Button leftSection={<IconFileUpload size={16} />} variant="light" onClick={() => setDocumentsOpen(true)}>
            {t('Документи')}
          </Button>
          <Button
            leftSection={<IconDownload size={16} />}
            variant="light"
            onClick={async () => {
              if (!sad.NetUid) {
                return
              }

              try {
                setDownloadDocument(await getSadDocuments(sad.NetUid))
              } catch (downloadError) {
                notifications.show({ color: 'red', message: getErrorMessage(downloadError, t('Не вдалося отримати документи')) })
              }
            }}
          >
            {t('Завантажити')}
          </Button>
          {!isReadonly && mode !== 'sale' && (
            <Button leftSection={<IconPlus size={16} />} variant="light" onClick={() => setAddItemPlaceholderOpen(true)}>
              {t('Додати товар')}
            </Button>
          )}
          {!isReadonly && mode !== 'tir' && (
            <Button disabled={isSaving} variant="light" onClick={() => saveSad(false)}>
              {t('Зберегти')}
            </Button>
          )}
          {!isReadonly && (
            <Button loading={isSaving} onClick={() => saveSad(true)}>
              {t('Провести')}
            </Button>
          )}
        </Group>
      </Group>

      <Card withBorder radius="sm">
        <Stack>
          <Text fw={600}>{t('Реквізити')}</Text>
          <SimpleGrid cols={{ base: 1, md: 2, xl: 4 }}>
            <Select
              data={toSelectOptions(organizations, getOrganizationName)}
              disabled={isReadonly}
              label={t('Організація')}
              searchable
              value={selectedOrganizationNetId || null}
              onChange={(value) => setSelectedOrganizationNetId(value || '')}
            />
            <NumberInput
              decimalScale={2}
              disabled={isReadonly || (mode === 'tir' && Boolean(sad.IsFromSale))}
              label={t('Маржа')}
              min={0}
              value={marginAmount}
              onChange={(value) => setMarginAmount(value === '' ? '' : numberInputValue(value))}
            />
            <Select
              data={toSelectOptions([sad.Statham, ...stathams], getStathamName)}
              disabled={isReadonly}
              label={t('Перевізник')}
              searchable
              value={selectedStathamNetId || null}
              onChange={selectStatham}
              onSearchChange={handleStathamSearch}
            />
            <Select
              data={toSelectOptions([sad.StathamCar, ...(selectedStatham?.StathamCars || [])], getCarName)}
              disabled={isReadonly || !selectedStatham}
              label={t('Авто')}
              searchable
              value={selectedStathamCarNetId || null}
              onChange={(value) => setSelectedStathamCarNetId(value || '')}
            />
          </SimpleGrid>
          {mode === 'base' && sad.SadType !== SAD_TYPES.TIR && (
            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <Select
                data={toSelectOptions([sad.Client, ...clients], getClientName)}
                disabled={isReadonly}
                label={t('Клієнт')}
                searchable
                value={selectedClientNetId || null}
                onChange={selectClient}
                onSearchChange={handleClientSearch}
              />
              <Select
                data={toSelectOptions([sad.ClientAgreement, ...clientAgreements], getClientAgreementName)}
                disabled={isReadonly || !selectedClient}
                label={t('Договір')}
                searchable
                value={selectedClientAgreementNetId || null}
                onChange={(value) => setSelectedClientAgreementNetId(value || '')}
              />
            </SimpleGrid>
          )}
          {mode === 'tir' && !sad.IsFromSale && (
            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <Select
                data={toSelectOptions([sad.OrganizationClient, ...organizationClients], getClientName)}
                disabled={isReadonly}
                label={t('Клієнт організації')}
                searchable
                value={selectedOrganizationClientNetId || null}
                onChange={selectOrganizationClient}
                onSearchChange={handleOrganizationClientSearch}
              />
              <Select
                data={toSelectOptions(
                  [sad.OrganizationClientAgreement, ...(selectedOrganizationClient?.OrganizationClientAgreements || [])],
                  getOrganizationClientAgreementName,
                )}
                disabled={isReadonly || !selectedOrganizationClient}
                label={t('Договір клієнта організації')}
                searchable
                value={selectedOrganizationClientAgreementNetId || null}
                onChange={(value) => setSelectedOrganizationClientAgreementNetId(value || '')}
              />
            </SimpleGrid>
          )}
        </Stack>
      </Card>

      {mode === 'tir' ? (
        <TirMovementPanel
          isSaving={isSaving}
          readonly={isReadonly}
          sad={sad}
          setSad={setSad}
          onPersist={async (nextSad) => {
            setSaving(true)
            try {
              const updatedSad = nextSad.IsFromSale ? await updateSaleSad(nextSad) : await updateSad(nextSad)
              if (updatedSad) {
                setSad(updatedSad)
              }
              notifications.show({ color: 'green', message: t('Палети оновлено') })
            } catch (saveError) {
              notifications.show({ color: 'red', message: getErrorMessage(saveError, t('Не вдалося оновити палети')) })
            } finally {
              setSaving(false)
            }
          }}
        />
      ) : (
        <SadItemsPanel
          mode={mode}
          readonly={isReadonly}
          sad={sad}
          onDelete={setDeleteItemTarget}
          onUpdateItem={(item) => {
            updateLocalSad((currentSad) => ({
              ...currentSad,
              SadItems: (currentSad.SadItems || []).map((currentItem) =>
                getEntityKey(currentItem) === getEntityKey(item) ? item : currentItem,
              ),
            }))
          }}
        />
      )}

      <SadTotals sad={sad} />

      <SadDocumentsModal
        opened={documentsOpen}
        sad={sad}
        onClose={() => setDocumentsOpen(false)}
        onUpdated={(nextSad) => void persistDocuments(nextSad)}
      />

      <DownloadDocumentsModal
        document={downloadDocument}
        opened={Boolean(downloadDocument)}
        onClose={() => setDownloadDocument(null)}
      />

      <AppModal centered opened={addItemPlaceholderOpen} title={t('Додавання товарів')} onClose={() => setAddItemPlaceholderOpen(false)}>
        <Stack>
          <Text size="sm">
            {t('Додавання товарів залежить від екрана кошика/замовлення постачання, який не входить у цей SAD slice. Поточний SAD не буде змінено.')}
          </Text>
          <Group justify="flex-end">
            <Button onClick={() => setAddItemPlaceholderOpen(false)}>{t('Зрозуміло')}</Button>
          </Group>
        </Stack>
      </AppModal>

      <AppModal centered opened={Boolean(deleteItemTarget)} title={t('Видалити позицію')} onClose={() => setDeleteItemTarget(null)}>
        <Stack>
          <Text>{t('Позицію буде прибрано з SAD після наступного збереження.')}</Text>
          <Group justify="flex-end">
            <Button color="gray" variant="subtle" onClick={() => setDeleteItemTarget(null)}>
              {t('Скасувати')}
            </Button>
            <Button color="red" onClick={() => deleteItemTarget && deleteItem(deleteItemTarget)}>
              {t('Видалити')}
            </Button>
          </Group>
        </Stack>
      </AppModal>
    </Stack>
  )
}

function SadItemsPanel({
  mode,
  onDelete,
  onUpdateItem,
  readonly,
  sad,
}: {
  mode: EditorMode
  onDelete: (item: SadItem) => void
  onUpdateItem: (item: SadItem) => void
  readonly: boolean
  sad: Sad
}) {
  const { t } = useI18n()
  const columns = useMemo<DataTableColumn<SadItem>[]>(
    () => [
      {
        id: 'vendorCode',
        header: t('Артикул'),
        accessor: (item) => getItemProduct(item)?.VendorCode,
        width: 160,
      },
      {
        id: 'product',
        header: t('Товар'),
        accessor: (item) => getItemProduct(item)?.Name,
        minWidth: 260,
      },
      {
        id: 'supplier',
        header: t('Постачальник'),
        accessor: (item) => getClientName(item.Supplier),
        width: 180,
      },
      {
        id: 'qty',
        header: t('Кількість'),
        accessor: (item) => item.ChangedQty ?? item.Qty,
        cell: (item) => mode === 'base' && !readonly ? (
          <NumberInput
            decimalScale={3}
            min={0}
            size="xs"
            value={item.ChangedQty ?? item.Qty ?? 0}
            onChange={(value) => onUpdateItem({ ...item, ChangedQty: numberInputValue(value) })}
          />
        ) : (
          formatQty(item.Qty)
        ),
        align: 'right',
        width: 130,
      },
      {
        id: 'amount',
        header: t('EUR'),
        accessor: (item) => item.TotalAmount,
        cell: (item) => formatNumber(item.TotalAmount),
        align: 'right',
        width: 120,
      },
      {
        id: 'amountLocal',
        header: t('Місцева валюта'),
        accessor: (item) => item.TotalAmountLocal,
        cell: (item) => formatNumber(item.TotalAmountLocal),
        align: 'right',
        width: 120,
      },
      {
        id: 'weight',
        header: t('Вага'),
        accessor: (item) => item.TotalNetWeight,
        cell: (item) => formatQty(item.TotalNetWeight),
        align: 'right',
        width: 120,
      },
      {
        id: 'comment',
        header: t('Коментар'),
        accessor: (item) => item.Comment,
        minWidth: 180,
      },
      {
        id: 'actions',
        header: '',
        cell: (item) => !readonly && mode === 'base' ? (
          <Group justify="flex-end">
            <Tooltip label={t('Видалити')}>
              <ActionIcon aria-label={t('Видалити')} color="red" size="sm" variant="subtle" onClick={() => onDelete(item)}>
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ) : null,
        enableSorting: false,
        width: 70,
      },
    ],
    [mode, onDelete, onUpdateItem, readonly, t],
  )

  return (
    <Card withBorder p={0} radius="sm">
      <DataTable
        columns={columns}
        data={sad.SadItems || []}
        defaultLayout={SAD_ITEMS_TABLE_DEFAULT_LAYOUT}
        emptyText={t('Позицій немає')}
        getRowId={(item, index) => getEntityKey(item) || String(index)}
        minWidth={1180}
        tableId={`sad-items-${mode}`}
      />
    </Card>
  )
}

function TirMovementPanel({
  isSaving,
  onPersist,
  readonly,
  sad,
  setSad,
}: {
  isSaving: boolean
  onPersist: (sad: Sad) => Promise<void>
  readonly: boolean
  sad: Sad
  setSad: (sad: Sad) => void
}) {
  const { t } = useI18n()
  const [moveModalOpen, setMoveModalOpen] = useState(false)
  const [palletTypes, setPalletTypes] = useState<SadPalletType[]>([])
  const selectedSourceItems = useMemo(() => (sad.SadItems || []).filter((item) => item.IsSelected), [sad.SadItems])
  const selectedPalletItems = useMemo(
    () => (sad.SadPallets || []).flatMap((pallet) => (pallet.SadPalletItems || []).filter((item) => item.IsSelected)),
    [sad.SadPallets],
  )

  useEffect(() => {
    let ignore = false

    async function loadPalletTypes() {
      try {
        const loadedTypes = await getSadPalletTypes()
        if (!ignore) {
          setPalletTypes(loadedTypes)
        }
      } catch (loadError) {
        notifications.show({ color: 'red', message: getErrorMessage(loadError, t('Не вдалося завантажити типи палет')) })
      }
    }

    void loadPalletTypes()

    return () => {
      ignore = true
    }
  }, [t])

  function updateSourceItem(item: SadItem) {
    setSad({
      ...sad,
      SadItems: (sad.SadItems || []).map((currentItem) => getEntityKey(currentItem) === getEntityKey(item) ? item : currentItem),
    })
  }

  function updatePalletItem(item: SadPalletItem) {
    setSad({
      ...sad,
      SadPallets: (sad.SadPallets || []).map((pallet) => ({
        ...pallet,
        IsDirty: (pallet.SadPalletItems || []).some((currentItem) => getEntityKey(currentItem) === getEntityKey(item)) || pallet.IsDirty,
        SadPalletItems: (pallet.SadPalletItems || []).map((currentItem) =>
          getEntityKey(currentItem) === getEntityKey(item) ? item : currentItem,
        ),
      })),
    })
  }

  function moveLeft() {
    if (!selectedPalletItems.length) {
      return
    }

    const selectedKeys = new Set(selectedPalletItems.map(getEntityKey))

    setSad({
      ...sad,
      SadPallets: (sad.SadPallets || []).map((pallet) => ({
        ...pallet,
        SadPalletItems: (pallet.SadPalletItems || []).filter((item) => !selectedKeys.has(getEntityKey(item))),
      })),
    })
  }

  return (
    <Stack>
      <SimpleGrid cols={{ base: 1, xl: 3 }} spacing="md">
        <Card withBorder p={0} radius="sm" style={{ minWidth: 0 }}>
          <SadSourceItemsTable
            items={sad.SadItems || []}
            readonly={readonly}
            onSelectAll={() => {
              const shouldSelect = !(sad.SadItems || []).filter((item) => (item.UnpackedQty || 0) > 0).every((item) => item.IsSelected)
              setSad({
                ...sad,
                SadItems: (sad.SadItems || []).map((item) => (item.UnpackedQty || 0) > 0 ? { ...item, IsSelected: shouldSelect } : item),
              })
            }}
            onUpdate={updateSourceItem}
          />
        </Card>

        <Stack align="center" justify="center">
          <Button
            disabled={readonly || selectedSourceItems.length === 0}
            leftSection={<IconArrowRight size={16} />}
            variant="light"
            onClick={() => setMoveModalOpen(true)}
          >
            {t('До палети')}
          </Button>
          <Button
            disabled={readonly || selectedPalletItems.length === 0}
            leftSection={<IconArrowLeft size={16} />}
            variant="light"
            onClick={moveLeft}
          >
            {t('Повернути')}
          </Button>
        </Stack>

        <Card withBorder p={0} radius="sm" style={{ minWidth: 0 }}>
          <SadPalletsTable
            pallets={sad.SadPallets || []}
            readonly={readonly}
            onDeletePallet={(pallet) => {
              setSad({
                ...sad,
                SadPallets: (sad.SadPallets || []).filter((currentPallet) => getEntityKey(currentPallet) !== getEntityKey(pallet)),
              })
            }}
            onUpdateItem={updatePalletItem}
          />
        </Card>
      </SimpleGrid>

      {!readonly && (
        <Group justify="flex-end">
          <Button loading={isSaving} onClick={() => onPersist(cleanPalletDrafts(sad))}>
            {t('Зберегти палети')}
          </Button>
        </Group>
      )}

      <MoveItemsModal
        opened={moveModalOpen}
        palletTypes={palletTypes}
        sad={sad}
        selectedItems={selectedSourceItems}
        onClose={() => setMoveModalOpen(false)}
        onMove={(nextSad) => {
          setSad(nextSad)
          setMoveModalOpen(false)
        }}
      />
    </Stack>
  )
}

function SadSourceItemsTable({
  items,
  onSelectAll,
  onUpdate,
  readonly,
}: {
  items: SadItem[]
  onSelectAll: () => void
  onUpdate: (item: SadItem) => void
  readonly: boolean
}) {
  const { t } = useI18n()
  const selectableItems = items.filter((item) => (item.UnpackedQty || 0) > 0)
  const isAllSelected = selectableItems.length > 0 && selectableItems.every((item) => item.IsSelected)
  const columns = useMemo<DataTableColumn<SadItem>[]>(
    () => [
      {
        id: 'select',
        header: (
          <Checkbox
            aria-label={t('Вибрати всі')}
            checked={isAllSelected}
            disabled={readonly || selectableItems.length === 0}
            onChange={onSelectAll}
          />
        ),
        cell: (item) => (
          <Checkbox
            aria-label={t('Вибрати')}
            checked={Boolean(item.IsSelected)}
            disabled={readonly || (item.UnpackedQty || 0) <= 0}
            onChange={() => onUpdate({ ...item, IsSelected: !item.IsSelected })}
          />
        ),
        enableSorting: false,
        width: 54,
      },
      {
        id: 'vendorCode',
        header: t('Артикул'),
        accessor: (item) => getItemProduct(item)?.VendorCode,
        width: 150,
      },
      {
        id: 'product',
        header: t('Товар'),
        accessor: (item) => getItemProduct(item)?.Name,
        minWidth: 240,
      },
      {
        id: 'qty',
        header: t('К-сть'),
        accessor: (item) => item.Qty,
        cell: (item) => formatQty(item.Qty),
        align: 'right',
        width: 100,
      },
      {
        id: 'unpacked',
        header: t('Не в палеті'),
        accessor: (item) => item.UnpackedQty,
        cell: (item) => formatQty(item.UnpackedQty),
        align: 'right',
        width: 120,
      },
    ],
    [isAllSelected, onSelectAll, onUpdate, readonly, selectableItems.length, t],
  )

  return (
    <DataTable
      columns={columns}
      data={items}
      defaultLayout={SAD_ITEMS_TABLE_DEFAULT_LAYOUT}
      emptyText={t('Позицій немає')}
      getRowId={(item, index) => getEntityKey(item) || String(index)}
      minWidth={760}
      tableId="sad-tir-source-items"
    />
  )
}

function SadPalletsTable({
  onDeletePallet,
  onUpdateItem,
  pallets,
  readonly,
}: {
  onDeletePallet: (pallet: SadPallet) => void
  onUpdateItem: (item: SadPalletItem) => void
  pallets: SadPallet[]
  readonly: boolean
}) {
  const { t } = useI18n()
  const rows = useMemo<PalletTableRow[]>(
    () =>
      pallets.flatMap((pallet, palletIndex) =>
        (pallet.SadPalletItems || []).map((item, itemIndex) => ({
          ...item,
          __pallet: pallet,
          __rowId: `${getEntityKey(pallet) || palletIndex}-${getEntityKey(item) || itemIndex}`,
        })),
      ),
    [pallets],
  )
  const columns = useMemo<DataTableColumn<PalletTableRow>[]>(
    () => [
      {
        id: 'select',
        header: '',
        cell: (item) => (
          <Checkbox
            aria-label={t('Вибрати')}
            checked={Boolean(item.IsSelected)}
            disabled={readonly}
            onChange={() => onUpdateItem({ ...item, IsSelected: !item.IsSelected })}
          />
        ),
        enableSorting: false,
        width: 54,
      },
      {
        id: 'pallet',
        header: t('Палета'),
        accessor: (item) => item.__pallet.Number,
        cell: (item) => (
          <Group gap={6} wrap="nowrap">
            <IconPackage size={14} />
            <Text size="sm">{item.__pallet.Number || t('Без номера')}</Text>
          </Group>
        ),
        width: 150,
      },
      {
        id: 'vendorCode',
        header: t('Артикул'),
        accessor: (item) => getItemProduct(item.SadItem || undefined)?.VendorCode,
        width: 150,
      },
      {
        id: 'product',
        header: t('Товар'),
        accessor: (item) => getItemProduct(item.SadItem || undefined)?.Name,
        minWidth: 240,
      },
      {
        id: 'qty',
        header: t('К-сть'),
        accessor: (item) => item.ChangedQty ?? item.Qty,
        cell: (item) => readonly ? formatQty(item.Qty) : (
          <NumberInput
            decimalScale={3}
            error={item.IsError}
            min={0}
            size="xs"
            value={item.ChangedQty ?? item.Qty ?? 0}
            onChange={(value) => {
              const changedQty = numberInputValue(value)
              onUpdateItem({
                ...item,
                ChangedQty: changedQty,
                IsDirty: true,
                IsError: changedQty <= 0,
              })
            }}
          />
        ),
        align: 'right',
        width: 120,
      },
      {
        id: 'actions',
        header: '',
        cell: (item) => !readonly ? (
          <Tooltip label={t('Видалити палету')}>
            <ActionIcon aria-label={t('Видалити палету')} color="red" size="sm" variant="subtle" onClick={() => onDeletePallet(item.__pallet)}>
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        ) : null,
        enableSorting: false,
        width: 70,
      },
    ],
    [onDeletePallet, onUpdateItem, readonly, t],
  )

  return (
    <DataTable
      columns={columns}
      data={rows}
      defaultLayout={SAD_ITEMS_TABLE_DEFAULT_LAYOUT}
      emptyText={t('Палет немає')}
      getRowId={(item) => item.__rowId}
      minWidth={840}
      tableId="sad-tir-pallet-items"
    />
  )
}

function MoveItemsModal({
  onClose,
  onMove,
  opened,
  palletTypes,
  sad,
  selectedItems,
}: {
  onClose: () => void
  onMove: (sad: Sad) => void
  opened: boolean
  palletTypes: SadPalletType[]
  sad: Sad
  selectedItems: SadItem[]
}) {
  const { t } = useI18n()
  const [isNewPallet, setNewPallet] = useState(true)
  const [palletNumber, setPalletNumber] = useState('')
  const [palletNetId, setPalletNetId] = useState('')
  const [palletTypeNetId, setPalletTypeNetId] = useState('')

  useEffect(() => {
    if (opened) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNewPallet((sad.SadPallets || []).length === 0)
      setPalletNumber('')
      setPalletNetId((sad.SadPallets || [])[0]?.NetUid || '')
      setPalletTypeNetId(palletTypes[0]?.NetUid || '')
    }
  }, [opened, palletTypes, sad.SadPallets])

  function move() {
    if (!isNewPallet && !palletNetId) {
      notifications.show({ color: 'red', message: t('Оберіть палету') })
      return
    }

    if (isNewPallet && !palletNumber.trim()) {
      notifications.show({ color: 'red', message: t('Вкажіть номер палети') })
      return
    }

    const selectedPalletType = findByNetUid(palletTypes, palletTypeNetId)
    const palletItems = selectedItems.map<SadPalletItem>((item, index) => ({
      IsDirty: true,
      Qty: item.UnpackedQty || item.Qty || 0,
      SadItem: { ...item, IsSelected: false },
      SadItemId: item.Id,
      NetUid: `draft-${Date.now()}-${index}`,
    }))

    const nextSadItems = (sad.SadItems || []).map((item) =>
      selectedItems.some((selectedItem) => getEntityKey(selectedItem) === getEntityKey(item)) ? { ...item, IsSelected: false } : item,
    )

    const nextPallets = isNewPallet
      ? [
          ...(sad.SadPallets || []),
          {
            IsDirty: true,
            Number: palletNumber.trim(),
            SadPalletItems: palletItems,
            SadPalletType: selectedPalletType || undefined,
          },
        ]
      : (sad.SadPallets || []).map((pallet) =>
          pallet.NetUid === palletNetId
            ? {
                ...pallet,
                IsDirty: true,
                SadPalletItems: [...(pallet.SadPalletItems || []), ...palletItems],
              }
            : pallet,
        )

    onMove({
      ...sad,
      SadItems: nextSadItems,
      SadPallets: nextPallets,
    })
  }

  return (
    <AppModal centered opened={opened} size="lg" title={t('Перемістити в палету')} onClose={onClose}>
      <Stack>
        <Alert color="blue" variant="light">
          {t('До палети буде додано')} {selectedItems.length} {t('позицій. Кількість береться з поля "Не в палеті".')}
        </Alert>
        <Checkbox
          checked={isNewPallet}
          label={t('Створити нову палету')}
          onChange={(event) => setNewPallet(event.currentTarget.checked)}
        />
        {isNewPallet ? (
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label={t('Номер палети')} value={palletNumber} onChange={(event) => setPalletNumber(event.currentTarget.value)} />
            <Select
              data={toSelectOptions(palletTypes, (type) => type.Name || '')}
              label={t('Тип палети')}
              searchable
              value={palletTypeNetId || null}
              onChange={(value) => setPalletTypeNetId(value || '')}
            />
          </SimpleGrid>
        ) : (
          <Select
            data={toSelectOptions(sad.SadPallets || [], (pallet) => pallet.Number || '')}
            label={t('Палета')}
            searchable
            value={palletNetId || null}
            onChange={(value) => setPalletNetId(value || '')}
          />
        )}
        <Group justify="flex-end">
          <Button color="gray" variant="subtle" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button onClick={move}>{t('Перемістити')}</Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

export function SadSpecificationsPage() {
  const { id } = useParams<{ id?: string }>()
  const { t } = useI18n()
  const [sad, setSad] = useState<Sad | null>(null)
  const [isLoading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloadDocument, setDownloadDocument] = useState<SadPrintDocument | null>(null)
  const [editingSpec, setEditingSpec] = useState<{ product: SadProduct; specification: SadProductSpecification | null } | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)

  useEffect(() => {
    let ignore = false

    async function load() {
      if (!id) {
        setError(t('Не передано ідентифікатор SAD'))
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const loadedSad = await getSadWithSpecifications(id)
        if (!ignore) {
          setSad(loadedSad)
        }
      } catch (loadError) {
        if (!ignore) {
          setError(getErrorMessage(loadError, t('Не вдалося завантажити специфікації')))
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      ignore = true
    }
  }, [id, reloadKey, t])

  const columns = useMemo<DataTableColumn<SadItem>[]>(
    () => [
      {
        id: 'vendorCode',
        header: t('Артикул'),
        accessor: (item) => getItemProduct(item)?.VendorCode,
        width: 160,
      },
      {
        id: 'product',
        header: t('Товар'),
        accessor: (item) => getItemProduct(item)?.Name,
        minWidth: 260,
      },
      {
        id: 'specCode',
        header: t('Код специфікації'),
        accessor: (item) => getLastSpecification(getItemProduct(item))?.SpecificationCode,
        cell: (item) => getLastSpecification(getItemProduct(item))?.SpecificationCode || '',
        width: 180,
      },
      {
        id: 'qty',
        header: t('Кількість'),
        accessor: (item) => item.Qty,
        cell: (item) => formatQty(item.Qty),
        align: 'right',
        width: 120,
      },
      {
        id: 'unitPrice',
        header: t('Ціна'),
        accessor: (item) => item.OrderItem?.PricePerItem ?? item.SupplyOrderUkraineCartItem?.UnitPrice,
        cell: (item) => formatNumber(item.OrderItem?.PricePerItem ?? item.SupplyOrderUkraineCartItem?.UnitPrice),
        align: 'right',
        width: 120,
      },
      {
        id: 'customsValue',
        header: t('Митна вартість'),
        accessor: (item) => getLastSpecification(getItemProduct(item))?.CustomsValue,
        cell: (item) => formatNumber(getLastSpecification(getItemProduct(item))?.CustomsValue),
        align: 'right',
        width: 150,
      },
      {
        id: 'duty',
        header: t('Мито'),
        accessor: (item) => getLastSpecification(getItemProduct(item))?.Duty,
        cell: (item) => formatNumber(getLastSpecification(getItemProduct(item))?.Duty),
        align: 'right',
        width: 120,
      },
      {
        id: 'vat',
        header: t('ПДВ'),
        accessor: (item) => getLastSpecification(getItemProduct(item))?.VATValue,
        cell: (item) => formatNumber(getLastSpecification(getItemProduct(item))?.VATValue),
        align: 'right',
        width: 120,
      },
      {
        id: 'percent',
        header: t('%'),
        accessor: (item) => `${getLastSpecification(getItemProduct(item))?.DutyPercent || ''}/${getLastSpecification(getItemProduct(item))?.VATPercent || ''}`,
        width: 100,
      },
      {
        id: 'comment',
        header: t('Коментар'),
        accessor: (item) => item.Comment,
        minWidth: 160,
      },
      {
        id: 'actions',
        header: '',
        cell: (item) => {
          const product = getItemProduct(item)

          return product ? (
            <Group justify="flex-end">
              <Tooltip label={t('Редагувати специфікацію')}>
                <ActionIcon
                  aria-label={t('Редагувати специфікацію')}
                  size="sm"
                  variant="subtle"
                  onClick={() => setEditingSpec({ product, specification: getLastSpecification(product) || null })}
                >
                  <IconEdit size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          ) : null
        },
        enableSorting: false,
        width: 80,
      },
    ],
    [t],
  )

  if (isLoading) {
    return <LoadingState label={t('Завантаження специфікацій')} />
  }

  if (error) {
    return (
      <Alert color="red" icon={<IconAlertCircle size={18} />}>
        {error}
      </Alert>
    )
  }

  if (!sad) {
    return (
      <Alert color="yellow" icon={<IconAlertCircle size={18} />}>
        {t('SAD не знайдено')}
      </Alert>
    )
  }

  return (
    <Stack gap="md">
      <Group align="center" justify="space-between">
        <StatusBadge sad={sad} />
        <Group>
          <Button leftSection={<IconFileUpload size={16} />} variant="light" onClick={() => setUploadOpen(true)}>
            {t('Імпорт')}
          </Button>
          <Button
            leftSection={<IconDownload size={16} />}
            variant="light"
            onClick={async () => {
              if (!sad.NetUid) {
                return
              }

              try {
                setDownloadDocument(await getSadDocuments(sad.NetUid))
              } catch (downloadError) {
                notifications.show({ color: 'red', message: getErrorMessage(downloadError, t('Не вдалося отримати документи')) })
              }
            }}
          >
            {t('Документи')}
          </Button>
          <Tooltip label={t('Оновити')}>
            <ActionIcon aria-label={t('Оновити')} variant="subtle" onClick={() => reload()}>
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      <Card withBorder p={0} radius="sm">
        <DataTable
          columns={columns}
          data={sad.SadItems || []}
          defaultLayout={SAD_SPEC_TABLE_DEFAULT_LAYOUT}
          emptyText={t('Специфікацій немає')}
          getRowId={(item, index) => getEntityKey(item) || String(index)}
          minWidth={1420}
          tableId="sad-specifications"
        />
      </Card>

      <SpecificationEditorModal
        editor={editingSpec}
        sadNetId={sad.NetUid}
        onClose={() => setEditingSpec(null)}
        onSaved={() => {
          setEditingSpec(null)
          reload()
        }}
      />

      <SpecificationUploadModal
        opened={uploadOpen}
        sadNetId={sad.NetUid}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => {
          setUploadOpen(false)
          reload()
        }}
      />

      <DownloadDocumentsModal
        document={downloadDocument}
        opened={Boolean(downloadDocument)}
        onClose={() => setDownloadDocument(null)}
      />
    </Stack>
  )
}

function SadDocumentsModal({
  onClose,
  onUpdated,
  opened,
  sad,
}: {
  onClose: () => void
  onUpdated: (sad: Sad | null) => void
  opened: boolean
  sad: Sad
}) {
  const { t } = useI18n()
  const [files, setFiles] = useState<File[]>([])
  const [isSaving, setSaving] = useState(false)

  useEffect(() => {
    if (!opened) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFiles([])
    }
  }, [opened])

  async function uploadFiles() {
    if (!sad.NetUid || !files.length) {
      return
    }

    setSaving(true)

    try {
      const nextSad = await uploadSadDocuments(sad.NetUid, files)
      notifications.show({ color: 'green', message: t('Документи завантажено') })
      onUpdated(nextSad)
      onClose()
    } catch (uploadError) {
      notifications.show({ color: 'red', message: getErrorMessage(uploadError, t('Не вдалося завантажити документи')) })
    } finally {
      setSaving(false)
    }
  }

  async function removeDocument(document: SadDocument) {
    if (!document.NetUid) {
      return
    }

    try {
      await deleteSadDocument(document.NetUid)
      notifications.show({ color: 'green', message: t('Документ видалено') })
      onUpdated({
        ...sad,
        SadDocuments: (sad.SadDocuments || []).filter((item) => item.NetUid !== document.NetUid),
      })
    } catch (deleteError) {
      notifications.show({ color: 'red', message: getErrorMessage(deleteError, t('Не вдалося видалити документ')) })
    }
  }

  return (
    <AppModal centered opened={opened} size="lg" title={t('Документи SAD')} onClose={onClose}>
      <Stack>
        <FileInput
          clearable
          label={t('Файли')}
          multiple
          value={files}
          onChange={(value) => setFiles(value || [])}
        />
        <Divider />
        <Stack gap={6}>
          {(sad.SadDocuments || []).length === 0 && (
            <Text c="dimmed" size="sm">{t('Документів немає')}</Text>
          )}
          {(sad.SadDocuments || []).map((document) => (
            <Group key={getEntityKey(document)} justify="space-between">
              <Box>
                <Text size="sm">{document.FileName || t('Документ')}</Text>
                <Text c="dimmed" size="xs">{document.ContentType}</Text>
              </Box>
              <Tooltip label={t('Видалити')}>
                <ActionIcon aria-label={t('Видалити')} color="red" size="sm" variant="subtle" onClick={() => removeDocument(document)}>
                  <IconTrash size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          ))}
        </Stack>
        <Group justify="flex-end">
          <Button color="gray" disabled={isSaving} variant="subtle" onClick={onClose}>
            {t('Закрити')}
          </Button>
          <Button disabled={!files.length} loading={isSaving} onClick={uploadFiles}>
            {t('Завантажити')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function DownloadDocumentsModal({
  document,
  onClose,
  opened,
}: {
  document: SadPrintDocument | null
  onClose: () => void
  opened: boolean
}) {
  const { t } = useI18n()
  const links = useMemo(() => document ? createDownloadDocumentLinks(document, t) : [], [document, t])

  return (
    <AppModal centered opened={opened} title={t('Документи для друку')} onClose={onClose}>
      <Stack>
        {links.length === 0 && <Text c="dimmed">{t('Посилань немає')}</Text>}
        {links.map((link) => (
          <Button
            key={link.label}
            disabled={!link.url}
            justify="space-between"
            rightSection={<IconDownload size={16} />}
            variant="light"
            onClick={() => link.url && window.open(link.url, '_blank')}
          >
            {link.label}
          </Button>
        ))}
      </Stack>
    </AppModal>
  )
}

function SpecificationEditorModal({
  editor,
  onClose,
  onSaved,
  sadNetId,
}: {
  editor: { product: SadProduct; specification: SadProductSpecification | null } | null
  onClose: () => void
  onSaved: () => void
  sadNetId?: string
}) {
  const { t } = useI18n()
  const [draft, setDraft] = useState<SadProductSpecification>({})
  const [isSaving, setSaving] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(editor?.specification ? { ...editor.specification } : { ProductId: editor?.product.Id, Product: editor?.product })
  }, [editor])

  async function save() {
    if (!sadNetId || !editor?.product) {
      return
    }

    setSaving(true)

    try {
      await updateProductSpecification(sadNetId, {
        ...draft,
        Product: editor.product,
        ProductId: editor.product.Id,
      })
      notifications.show({ color: 'green', message: t('Специфікацію оновлено') })
      onSaved()
    } catch (saveError) {
      notifications.show({ color: 'red', message: getErrorMessage(saveError, t('Не вдалося оновити специфікацію')) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppModal centered opened={Boolean(editor)} size="lg" title={t('Специфікація товару')} onClose={onClose}>
      <Stack>
        <Text fw={600}>{editor?.product.VendorCode} · {editor?.product.Name}</Text>
        <TextInput
          label={t('Код специфікації')}
          value={draft.SpecificationCode || ''}
          onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, SpecificationCode: event.currentTarget.value }))}
        />
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <NumberInput
            decimalScale={2}
            label={t('Митна вартість')}
            value={toEditableNumber(draft.CustomsValue)}
            onChange={(value) => setDraft((currentDraft) => ({ ...currentDraft, CustomsValue: numberInputValue(value) }))}
          />
          <NumberInput
            decimalScale={2}
            label={t('Мито')}
            value={toEditableNumber(draft.Duty)}
            onChange={(value) => setDraft((currentDraft) => ({ ...currentDraft, Duty: numberInputValue(value) }))}
          />
          <NumberInput
            decimalScale={2}
            label={t('ПДВ')}
            value={toEditableNumber(draft.VATValue)}
            onChange={(value) => setDraft((currentDraft) => ({ ...currentDraft, VATValue: numberInputValue(value) }))}
          />
          <NumberInput
            decimalScale={2}
            label={t('Мито %')}
            value={toEditableNumber(draft.DutyPercent)}
            onChange={(value) => setDraft((currentDraft) => ({ ...currentDraft, DutyPercent: numberInputValue(value) }))}
          />
          <NumberInput
            decimalScale={2}
            label={t('ПДВ %')}
            value={toEditableNumber(draft.VATPercent)}
            onChange={(value) => setDraft((currentDraft) => ({ ...currentDraft, VATPercent: numberInputValue(value) }))}
          />
        </SimpleGrid>
        <Group justify="flex-end">
          <Button color="gray" disabled={isSaving} variant="subtle" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button loading={isSaving} onClick={save}>
            {t('Зберегти')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function SpecificationUploadModal({
  onClose,
  onUploaded,
  opened,
  sadNetId,
}: {
  onClose: () => void
  onUploaded: () => void
  opened: boolean
  sadNetId?: string
}) {
  const { t } = useI18n()
  const [file, setFile] = useState<File | null>(null)
  const [parseConfiguration, setParseConfiguration] = useState<SadSpecificationParseConfiguration>({
    CustomsValue: '',
    Duty: '',
    EndRow: '',
    SpecificationCode: '',
    StartRow: '',
    VATValue: '',
    VendorCode: '',
  })
  const [isUploading, setUploading] = useState(false)

  async function upload() {
    if (!sadNetId || !file) {
      return
    }

    const normalizedConfiguration = normalizeSpecificationParseConfiguration(parseConfiguration)

    if (!normalizedConfiguration) {
      notifications.show({ color: 'red', message: t('Заповніть усі колонки імпорту') })
      return
    }

    setUploading(true)

    try {
      await uploadProductSpecificationForSad(sadNetId, file, normalizedConfiguration)
      notifications.show({ color: 'green', message: t('Специфікації імпортовано') })
      onUploaded()
    } catch (uploadError) {
      notifications.show({ color: 'red', message: getErrorMessage(uploadError, t('Не вдалося імпортувати специфікації')) })
    } finally {
      setUploading(false)
    }
  }

  return (
    <AppModal centered opened={opened} size="lg" title={t('Імпорт специфікацій')} onClose={onClose}>
      <Stack>
        <FileInput clearable label={t('Файл')} value={file} onChange={setFile} />
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
          {Object.keys(parseConfiguration).map((key) => (
            <NumberInput
              key={key}
              label={getSpecificationColumnLabel(key as keyof SadSpecificationParseConfiguration, t)}
              min={1}
              value={parseConfiguration[key as keyof SadSpecificationParseConfiguration]}
              onChange={(value) =>
                setParseConfiguration((currentConfiguration) => ({
                  ...currentConfiguration,
                  [key]: value === '' ? '' : numberInputValue(value),
                }))
              }
            />
          ))}
        </SimpleGrid>
        <Group justify="flex-end">
          <Button color="gray" disabled={isUploading} variant="subtle" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button disabled={!file} loading={isUploading} onClick={upload}>
            {t('Імпортувати')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function SadActionModal({
  onClose,
  onNavigate,
  sad,
}: {
  onClose: () => void
  onNavigate: (path: string) => void
  sad: Sad | null
}) {
  const { t } = useI18n()

  if (!sad) {
    return null
  }

  const editPath = getSadEditPath(sad)
  const canCreateSupplyOrder = Boolean(sad.IsSend && !sad.IsFromSale && !sad.SupplyOrderUkraineId)

  return (
    <AppModal centered opened={Boolean(sad)} title={`${t('SAD')} ${sad.Number || ''}`} onClose={onClose}>
      <Stack>
        <Button justify="space-between" rightSection={<IconEye size={16} />} variant="light" onClick={() => onNavigate(editPath)}>
          {t('Перегляд / редагування')}
        </Button>
        <Button
          justify="space-between"
          rightSection={<IconEdit size={16} />}
          variant="light"
          onClick={() => sad.NetUid && onNavigate(`/sad/edit/${sad.NetUid}/specifications`)}
        >
          {t('Коди специфікацій')}
        </Button>
        {canCreateSupplyOrder && (
          <Button
            justify="space-between"
            rightSection={<IconArrowRight size={16} />}
            variant="light"
            onClick={() => {
              notifications.show({
                color: 'yellow',
                message: t('Створення замовлення постачання з SAD буде підключено разом із відповідним екраном.'),
              })
            }}
          >
            {t('Створити замовлення постачання')}
          </Button>
        )}
        {sad.IsSend && sad.Client && (
          <>
            <Divider />
            {[
              t('Авансовий платіж'),
              t('Прибутковий касовий ордер'),
              t('Видатковий касовий ордер'),
            ].map((label) => (
              <Button
                key={label}
                justify="space-between"
                variant="subtle"
                onClick={() => {
                  notifications.show({
                    color: 'yellow',
                    message: t('Бухгалтерська дія SAD очікує міграції відповідної панелі.'),
                  })
                }}
              >
                {label}
              </Button>
            ))}
          </>
        )}
      </Stack>
    </AppModal>
  )
}

function SadTotals({ sad }: { sad: Sad }) {
  const { t } = useI18n()

  return (
    <Card withBorder radius="sm">
      <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }}>
        <Metric label={t('Позицій')} value={(sad.SadItems || []).length} />
        <Metric label={t('Кількість')} value={formatQty(sad.TotalQty)} />
        <Metric label={t('Нетто')} value={formatQty(sad.TotalNetWeight)} />
        <Metric label={t('Брутто')} value={formatQty(sad.TotalGrossWeight)} />
        <Metric label={t('EUR')} value={formatNumber(sad.TotalAmount)} />
        <Metric label={t('Місцева валюта')} value={formatNumber(sad.TotalAmountLocal)} />
      </SimpleGrid>
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box>
      <Text c="dimmed" size="xs">{label}</Text>
      <Text fw={600}>{value}</Text>
    </Box>
  )
}

function StatusBadge({ sad }: { sad: Sad }) {
  const { t } = useI18n()

  return (
    <Badge color={sad.IsSend ? 'green' : 'yellow'} variant="light">
      {sad.IsSend ? t('Проведено') : t('Чернетка')}
    </Badge>
  )
}

function LoadingState({ label }: { label: string }) {
  return (
    <Group justify="center" p="xl">
      <Loader size="sm" />
      <Text c="dimmed">{label}</Text>
    </Group>
  )
}

function buildSadPayload({
  isSend,
  marginAmount,
  sad,
  selectedClient,
  selectedClientAgreement,
  selectedOrganization,
  selectedOrganizationClient,
  selectedOrganizationClientAgreement,
  selectedStatham,
  selectedStathamCar,
}: {
  isSend: boolean
  marginAmount: number | ''
  sad: Sad
  selectedClient?: SadClient | null
  selectedClientAgreement?: SadClientAgreement | null
  selectedOrganization?: SadOrganization | null
  selectedOrganizationClient?: SadOrganizationClient | null
  selectedOrganizationClientAgreement?: SadOrganizationClientAgreement | null
  selectedStatham?: SadStatham | null
  selectedStathamCar?: SadStathamCar | null
}): Sad {
  return {
    ...sad,
    Client: selectedClient || undefined,
    ClientAgreement: selectedClientAgreement || undefined,
    IsSend: isSend,
    MarginAmount: typeof marginAmount === 'number' ? marginAmount : 0,
    Organization: selectedOrganization || sad.Organization,
    OrganizationClient: selectedOrganizationClient || sad.OrganizationClient,
    OrganizationClientAgreement: selectedOrganizationClientAgreement || sad.OrganizationClientAgreement,
    SadItems: (sad.SadItems || []).map((item) => ({
      ...item,
      Qty: item.ChangedQty ?? item.Qty,
    })),
    Statham: selectedStatham || undefined,
    StathamCar: selectedStathamCar || undefined,
  }
}

function validateSadBeforeSave({
  isSend,
  marginAmount,
  mode,
  sad,
  selectedClient,
  selectedOrganization,
  selectedOrganizationClient,
  selectedStatham,
  selectedStathamCar,
  t,
}: {
  isSend: boolean
  marginAmount: number | ''
  mode: EditorMode
  sad: Sad
  selectedClient?: SadClient | null
  selectedOrganization?: SadOrganization | null
  selectedOrganizationClient?: SadOrganizationClient | null
  selectedStatham?: SadStatham | null
  selectedStathamCar?: SadStathamCar | null
  t: (key: string) => string
}): string | null {
  if (!isSend) {
    return null
  }

  if (!selectedOrganization?.NetUid) {
    return t('Оберіть організацію')
  }

  if (!selectedStatham?.NetUid) {
    return t('Оберіть перевізника')
  }

  if (!selectedStathamCar?.NetUid) {
    return t('Оберіть авто')
  }

  if (mode === 'base' && sad.SadType !== SAD_TYPES.TIR && !selectedClient?.NetUid) {
    return t('Оберіть клієнта')
  }

  if (mode === 'tir' && !sad.IsFromSale && !selectedOrganizationClient?.NetUid) {
    return t('Оберіть клієнта організації')
  }

  if (!sad.IsFromSale && (!marginAmount || marginAmount <= 0)) {
    return t('Вкажіть маржу')
  }

  return null
}

function shouldUseSaleUpdate(sad: Sad, mode: EditorMode) {
  return Boolean(sad.IsFromSale || mode === 'sale')
}

function cleanPalletDrafts(sad: Sad): Sad {
  return {
    ...sad,
    SadPallets: (sad.SadPallets || []).map((pallet) => ({
      ...pallet,
      SadPalletItems: (pallet.SadPalletItems || []).map((item) => ({
        ...item,
        IsSelected: false,
        Qty: item.ChangedQty ?? item.Qty,
      })),
    })),
  }
}

function createDownloadDocumentLinks(document: SadPrintDocument, t: (key: string) => string): DownloadDocumentLink[] {
  return [
    { label: `${t('Фактура')} XLS`, url: document.FacturaDocumentURL },
    { label: `${t('Фактура')} PDF`, url: document.FacturaPdfDocumentURL },
    { label: `${t('Специфікація')} XLS`, url: document.SpecificationDocumentURL },
    { label: `${t('Специфікація')} PDF`, url: document.SpecificationPdfDocumentURL },
    { label: `${t('Фактура')} Export XLS`, url: document.ExportFacturaDocumentURL },
    { label: `${t('Фактура')} Export PDF`, url: document.ExportFacturaPdfDocumentURL },
    { label: `${t('Специфікація')} Export XLS`, url: document.ExportSpecificationDocumentURL },
    { label: `${t('Специфікація')} Export PDF`, url: document.ExportSpecificationPdfDocumentURL },
  ].filter((link) => Boolean(link.url))
}

function normalizeSpecificationParseConfiguration(
  configuration: SadSpecificationParseConfiguration,
): Record<keyof SadSpecificationParseConfiguration, number> | null {
  const entries = Object.entries(configuration) as Array<[keyof SadSpecificationParseConfiguration, number | '']>
  const normalizedEntries = entries.map(([key, value]) => [key, typeof value === 'number' && value > 0 ? value : null] as const)

  if (normalizedEntries.some(([, value]) => value === null)) {
    return null
  }

  return normalizedEntries.reduce<Record<keyof SadSpecificationParseConfiguration, number>>((result, [key, value]) => {
    result[key] = value || 0
    return result
  }, {
    CustomsValue: 0,
    Duty: 0,
    EndRow: 0,
    SpecificationCode: 0,
    StartRow: 0,
    VATValue: 0,
    VendorCode: 0,
  })
}

function getSpecificationColumnLabel(key: keyof SadSpecificationParseConfiguration, t: (key: string) => string) {
  const labels: Record<keyof SadSpecificationParseConfiguration, string> = {
    CustomsValue: t('Митна вартість'),
    Duty: t('Мито'),
    EndRow: t('Останній рядок'),
    SpecificationCode: t('Код специфікації'),
    StartRow: t('Перший рядок'),
    VATValue: t('ПДВ'),
    VendorCode: t('Артикул'),
  }

  return labels[key]
}

function toSelectOptions<TItem extends { NetUid?: string }>(
  items: Array<TItem | null | undefined>,
  getLabel: (item: TItem) => string,
): SelectOption[] {
  const seen = new Set<string>()

  return items.reduce<SelectOption[]>((options, item) => {
    if (!item?.NetUid || seen.has(item.NetUid)) {
      return options
    }

    seen.add(item.NetUid)
    options.push({
      label: getLabel(item) || item.NetUid,
      value: item.NetUid,
    })

    return options
  }, [])
}

function findByNetUid<TItem extends { NetUid?: string }>(
  items: Array<TItem | null | undefined>,
  netUid?: string | null,
): TItem | null {
  if (!netUid) {
    return null
  }

  return items.find((item) => item?.NetUid === netUid) || null
}

function getSadEditPath(sad: Sad) {
  const netUid = sad.NetUid || ''
  const basePath = `/sad/edit/${netUid}`

  if (sad.SadType === SAD_TYPES.TIR) {
    return `${basePath}/tir`
  }

  return sad.IsFromSale ? `${basePath}/sale` : basePath
}

function getSadTypeLabel(value?: SadTypeValue) {
  return value === SAD_TYPES.TIR ? 'TIR' : 'SAD'
}

function getSadClientName(sad: Sad) {
  return getClientName(sad.Client) || getClientName(sad.OrganizationClient)
}

function buildSadOutcomeSource(sad: Sad): DocumentOutcomePaymentSource {
  const client = sad.Client || sad.OrganizationClient

  return {
    amount: sad.TotalVatAmountWithMargin || 0,
    clientName: getSadClientName(sad),
    clientNetId: client?.NetUid || '',
    created: typeof sad.Created === 'string' ? sad.Created : undefined,
    documentNetId: sad.NetUid || '',
    type: 'sad',
  }
}

function getClientName(client?: SadClient | SadOrganizationClient | null) {
  return client?.FullName || client?.Name || client?.Abbreviation || ''
}

function getClientAgreementName(agreement?: SadClientAgreement | null) {
  const nestedAgreement: SadAgreement | null | undefined = agreement?.Agreement

  return agreement?.FullName
    || nestedAgreement?.FullName
    || nestedAgreement?.Name
    || nestedAgreement?.Number
    || agreement?.NetUid
    || ''
}

function getOrganizationClientAgreementName(agreement?: SadOrganizationClientAgreement | null) {
  return agreement?.Number || agreement?.NetUid || ''
}

function getOrganizationName(organization?: SadOrganization | null) {
  return organization?.Name || organization?.FullName || organization?.Abbreviation || ''
}

function getStathamName(statham?: SadStatham | null) {
  return statham?.FullName || [statham?.LastName, statham?.FirstName].filter(Boolean).join(' ')
}

function getCarName(car?: SadStathamCar | null) {
  return car?.Number || [car?.Brand, car?.Model].filter(Boolean).join(' ')
}

function getUserName(user?: { FirstName?: string; FullName?: string; LastName?: string; MiddleName?: string; Name?: string } | null) {
  return user?.FullName || user?.Name || [user?.LastName, user?.FirstName, user?.MiddleName].filter(Boolean).join(' ')
}

function getItemProduct(item?: SadItem | null) {
  return item?.SupplyOrderUkraineCartItem?.Product || item?.OrderItem?.Product || null
}

function getLastSpecification(product?: SadProduct | null) {
  const specifications = product?.ProductSpecifications

  return Array.isArray(specifications) && specifications.length > 0 ? specifications[specifications.length - 1] : null
}

function getEntityKey(entity?: { Id?: number; NetUid?: string } | null) {
  return entity?.NetUid || (entity?.Id ? String(entity.Id) : '')
}

function formatDate(value?: Date | string) {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('uk-UA')
}

function formatNumber(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? numberFormatter.format(value) : ''
}

function formatQty(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? qtyFormatter.format(value) : ''
}

function numberInputValue(value: string | number) {
  const parsedValue = typeof value === 'number' ? value : Number(value)

  return Number.isFinite(parsedValue) ? parsedValue : 0
}

function toEditableNumber(value?: number | null): number | '' {
  return typeof value === 'number' && Number.isFinite(value) ? value : ''
}

function getDateShiftedByDays(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)

  return formatLocalDate(date)
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}
