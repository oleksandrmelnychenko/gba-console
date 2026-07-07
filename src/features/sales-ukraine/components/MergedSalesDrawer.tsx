import { ActionIcon, Alert, Anchor, Badge, Button, Card, Checkbox, Chip, Group, NumberInput, Stack, Table, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { CircleAlert, Pencil, ReceiptText } from 'lucide-react'
import { useEffect } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { AppModal } from '../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { getCurrentUnmergedSale, getMergedSales, updateMergedSale } from '../api/salesUkraineApi'
import {
  buildMergedSaleInvoiceDrafts,
  buildMergedSaleInvoicePayload,
  getMergedSaleKey,
  getNumber,
  getOrderItemKey,
  getOrderItems,
  hasCurrentUnmergedSale,
  hasMergedMainClient,
  hasSelectedMergedSaleItems,
  type MergedSaleInvoiceDraft,
  type MergedSaleInvoiceDraftBySale,
} from '../mergedSaleInvoice'
import type { SalesUkraineSale, SalesUkraineSaleMerged } from '../types'
import './sales-drawers.css'

const amountFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'

export function MergedSalesDrawer({
  saleNetId,
  clientAgreementNetId,
  onClose,
  onChanged,
  onCreateNewSale,
  onEditSale,
  onInvoice,
}: {
  clientAgreementNetId?: string | null
  onChanged: () => void
  onClose: () => void
  onCreateNewSale?: () => void
  onEditSale?: (sale: SalesUkraineSale) => void
  onInvoice?: (sale: SalesUkraineSale) => void
  saleNetId: string | null
}) {
  const { t } = useI18n()

  return (
    <AppDrawer
      offset={8}
      opened={Boolean(saleNetId)}
      padding="lg"
      position="right"
      radius="md"
      size="min(960px, 100vw)"
      title={t("Об'єднання продажів")}
      onClose={onClose}
    >
      {saleNetId && (
        <MergedSalesContent
          key={saleNetId}
          clientAgreementNetId={clientAgreementNetId}
          saleNetId={saleNetId}
          onChanged={onChanged}
          onCreateNewSale={onCreateNewSale}
          onEditSale={onEditSale}
          onInvoice={onInvoice}
        />
      )}
    </AppDrawer>
  )
}

function MergedSalesContent({
  saleNetId,
  clientAgreementNetId,
  onChanged,
  onCreateNewSale,
  onEditSale,
  onInvoice,
}: {
  clientAgreementNetId?: string | null
  onChanged: () => void
  onCreateNewSale?: () => void
  onEditSale?: (sale: SalesUkraineSale) => void
  onInvoice?: (sale: SalesUkraineSale) => void
  saleNetId: string
}) {
  const { t } = useI18n()
  const [mergedSale, setMergedSale] = useValueState<SalesUkraineSale | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [error, setError] = useValueState<string | null>(null)
  const [clientFilter, setClientFilter] = useValueState<string>('all')
  const [confirmSale, setConfirmSale] = useValueState<SalesUkraineSale | null>(null)
  const [drafts, setDrafts] = useValueState<MergedSaleInvoiceDraftBySale>({})
  const [isConverting, setConverting] = useValueState(false)
  const [hasMainClientNewSale, setHasMainClientNewSale] = useValueState<boolean | null>(null)
  const [reloadKey, reload] = useValueState(0)
  const wantsCreateNewSale = Boolean(onCreateNewSale)
  const agreementNetUid = clientAgreementNetId || mergedSale?.ClientAgreement?.NetUid || ''

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    async function load() {
      try {
        const next = await getMergedSales(saleNetId)

        if (!cancelled) {
          setMergedSale(next)
          setDrafts(buildMergedSaleInvoiceDrafts(Array.isArray(next?.InputSaleMerges) ? next.InputSaleMerges : []))
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t("Не вдалося завантажити об'єднання"))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [saleNetId, reloadKey, setDrafts, setError, setLoading, setMergedSale, t])

  useEffect(() => {
    if (!wantsCreateNewSale || !agreementNetUid) {
      return
    }

    let cancelled = false
    setHasMainClientNewSale(null)

    async function check(netUid: string) {
      try {
        const current = await getCurrentUnmergedSale(netUid)

        if (!cancelled) {
          setHasMainClientNewSale(hasCurrentUnmergedSale(current))
        }
      } catch {
        if (!cancelled) {
          setHasMainClientNewSale(false)
        }
      }
    }

    void check(agreementNetUid)

    return () => {
      cancelled = true
    }
  }, [agreementNetUid, reloadKey, setHasMainClientNewSale, wantsCreateNewSale])

  const merges = Array.isArray(mergedSale?.InputSaleMerges) ? mergedSale.InputSaleMerges : []
  const canCreateNewSaleToClient =
    wantsCreateNewSale && !isLoading && merges.length > 0 && !hasMergedMainClient(merges) && hasMainClientNewSale === false
  const clientFilters = buildClientFilters(merges)
  const visibleMerges = merges.reduce<Array<{ index: number; merge: SalesUkraineSaleMerged }>>((acc, merge, index) => {
    if (clientFilter === 'all' || getClientNetUid(merge) === clientFilter) {
      acc.push({ index, merge })
    }

    return acc
  }, [])

  function updateSaleDraft(sale: SalesUkraineSale, index: number, updater: (draft: MergedSaleInvoiceDraft) => MergedSaleInvoiceDraft) {
    const key = getMergedSaleKey(sale, index)

    setDrafts((current) => {
      const currentDraft = current[key] || { items: {}, selected: false }

      return { ...current, [key]: updater(currentDraft) }
    })
  }

  function toggleSale(sale: SalesUkraineSale, index: number, selected: boolean) {
    updateSaleDraft(sale, index, (draft) => ({
      selected,
      items: Object.fromEntries(Object.entries(draft.items).map(([key, item]) => [key, { ...item, selected }])),
    }))
  }

  function toggleItem(sale: SalesUkraineSale, saleIndex: number, itemKey: string, selected: boolean) {
    updateSaleDraft(sale, saleIndex, (draft) => {
      const items = {
        ...draft.items,
        [itemKey]: { ...(draft.items[itemKey] || { qty: '', selected }), selected },
      }
      const hasSelectedItems = Object.values(items).some((item) => item.selected)

      return { selected: hasSelectedItems, items }
    })
  }

  function updateItemQty(sale: SalesUkraineSale, saleIndex: number, itemKey: string, qty: number | string) {
    updateSaleDraft(sale, saleIndex, (draft) => ({
      ...draft,
      items: {
        ...draft.items,
        [itemKey]: { ...(draft.items[itemKey] || { selected: true, qty }), qty },
      },
    }))
  }

  function requestConvert(sale: SalesUkraineSale, index: number) {
    const payload = buildMergedSaleInvoicePayload(sale, drafts[getMergedSaleKey(sale, index)])

    if (!payload.Order?.OrderItems?.length) {
      notifications.show({ color: 'orange', message: t('Оберіть товари для рахунку') })

      return
    }

    if (onInvoice) {
      onInvoice(payload)

      return
    }

    setConfirmSale(payload)
  }

  async function convert() {
    if (!confirmSale) {
      return
    }

    setConverting(true)

    const payload: SalesUkraineSale = {
      ...confirmSale,
      BaseLifeCycleStatus: { Deleted: false, Id: 0, NetUid: EMPTY_GUID, SaleLifeCycleType: 1 },
      BaseSalePaymentStatus: { Deleted: false, Id: 0, NetUid: EMPTY_GUID, SalePaymentStatusType: 0 },
      IsPrintedPaymentInvoice: true,
    }

    try {
      await updateMergedSale(payload)
      notifications.show({ color: 'green', message: t('Рахунок створено') })
      setConfirmSale(null)
      reload((key) => key + 1)
      onChanged()
    } catch {
      notifications.show({ color: 'red', message: t('Не вдалося створити рахунок') })
    } finally {
      setConverting(false)
    }
  }

  if (isLoading) {
    return <SalesDrawerSkeleton />
  }

  return (
    <Stack gap="md">
      {error && (
        <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
          {error}
        </Alert>
      )}

      {canCreateNewSaleToClient && (
        <Group>
          <Anchor component="button" fw={600} size="sm" type="button" onClick={onCreateNewSale}>
            {t('Створити новий рахунок головному клієнту')}
          </Anchor>
        </Group>
      )}

      {clientFilters.length > 1 && (
        <Chip.Group multiple={false} value={clientFilter} onChange={(value) => setClientFilter((value as string) || 'all')}>
          <Group gap="xs">
            <Chip value="all">{t('Усі')}</Chip>
            {clientFilters.map((filter) => (
              <Chip key={filter.value} value={filter.value}>
                {filter.label}
              </Chip>
            ))}
          </Group>
        </Chip.Group>
      )}

      {visibleMerges.length === 0 ? (
        <Text c="dimmed" size="sm">
          {t("Об'єднаних продажів не знайдено")}
        </Text>
      ) : (
        visibleMerges.map(({ index, merge }) => (
          <MergedSaleCard
            key={getInputSale(merge)?.NetUid || merge.InputSaleId || index}
            draft={drafts[getMergedSaleKey(getInputSale(merge) || {}, index)]}
            index={index}
            sale={getInputSale(merge)}
            onEdit={onEditSale}
            onInvoice={requestConvert}
            onItemQtyChange={updateItemQty}
            onItemToggle={toggleItem}
            onSaleToggle={toggleSale}
          />
        ))
      )}

      <AppModal
        centered
        opened={Boolean(confirmSale)}
        size="sm"
        title={t('Зробити рахунок')}
        onClose={() => (isConverting ? undefined : setConfirmSale(null))}
      >
        <Stack gap="md">
          <Text>{t('Перетворити цей продаж на рахунок?')}</Text>
          <Group justify="flex-end">
            <Button color="gray" disabled={isConverting} variant="subtle" onClick={() => setConfirmSale(null)}>
              {t('Скасувати')}
            </Button>
            <Button color={CREATE_ACTION_COLOR} loading={isConverting} onClick={convert}>
              {t('Зробити рахунок')}
            </Button>
          </Group>
        </Stack>
      </AppModal>
    </Stack>
  )
}

function MergedSaleCard({
  draft,
  index,
  sale,
  onEdit,
  onInvoice,
  onItemQtyChange,
  onItemToggle,
  onSaleToggle,
}: {
  draft?: MergedSaleInvoiceDraft
  index: number
  onEdit?: (sale: SalesUkraineSale) => void
  onInvoice: (sale: SalesUkraineSale, index: number) => void
  onItemQtyChange: (sale: SalesUkraineSale, saleIndex: number, itemKey: string, qty: number | string) => void
  onItemToggle: (sale: SalesUkraineSale, saleIndex: number, itemKey: string, selected: boolean) => void
  onSaleToggle: (sale: SalesUkraineSale, index: number, selected: boolean) => void
  sale?: SalesUkraineSale
}) {
  const { t } = useI18n()

  if (!sale) {
    return null
  }

  const orderItems = getOrderItems(sale)
  const client = sale.ClientAgreement?.Client
  const currency = sale.ClientAgreement?.Agreement?.Currency?.Code || ''
  const canInvoice = hasSelectedMergedSaleItems(sale, draft)

  return (
    <Card withBorder className="sales-merge-card" padding="md" radius="md">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Stack gap={2}>
            <Group gap="xs">
              <Text className="sales-merge-title">{displayValue(sale.SaleNumber?.Value)}</Text>
              <Badge className={`app-role-pill ${getClientPillClass(client)}`} size="xs" variant="light">
                {getClientTypeLabel(client, t)}
              </Badge>
            </Group>
            <Text className="sales-merge-client" size="sm">
              {displayValue(client?.FullName)}
            </Text>
            <Text className="sales-merge-meta">
              {[getUserLastName(sale), formatDateTime(sale.Updated)].filter(Boolean).join(' · ')}
            </Text>
          </Stack>
          <Group gap="sm">
            <Checkbox
              className="sales-drawer-action-button"
              checked={draft?.selected ?? false}
              label={t('Усі товари')}
              onChange={(event) => onSaleToggle(sale, index, event.currentTarget.checked)}
            />
            {onEdit && (
              <ActionIcon aria-label={t('Редагувати')} color="gray" size="lg" variant="subtle" onClick={() => onEdit(sale)}>
                <Pencil size={18} />
              </ActionIcon>
            )}
            <Button
              className="sales-drawer-action-button"
              color={CREATE_ACTION_COLOR}
              disabled={!canInvoice}
              leftSection={<ReceiptText size={16} />}
              size="xs"
              variant="outline"
              onClick={() => onInvoice(sale, index)}
            >
              {t('Створити накладну')}
            </Button>
          </Group>
        </Group>

        <Table className="sales-drawer-table" withRowBorders={false}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={44} />
              <Table.Th>{t('Код Виробника')}</Table.Th>
              <Table.Th>{t('Назва товару')}</Table.Th>
              <Table.Th ta="right">{t('К-сть')}</Table.Th>
              <Table.Th ta="right">{t('Сума')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {orderItems.map((item, itemIndex) => {
              const key = getOrderItemKey(item, itemIndex)
              const itemDraft = draft?.items[key]
              const qty = getNumber(itemDraft?.qty) ?? getNumber(item.Qty) ?? 0
              const maxQty = getNumber(item.Qty) ?? undefined

              return (
                <Table.Tr key={key}>
                  <Table.Td>
                    <Checkbox
                      aria-label={t('Обрати товар')}
                      checked={itemDraft?.selected ?? false}
                      onChange={(event) => onItemToggle(sale, index, key, event.currentTarget.checked)}
                    />
                  </Table.Td>
                  <Table.Td>{displayValue(item.Product?.VendorCode || item.Product?.MainOriginalNumber)}</Table.Td>
                  <Table.Td>{displayValue(item.Product?.NameUA || item.Product?.Name)}</Table.Td>
                  <Table.Td ta="right">
                    <NumberInput
                      allowNegative={false}
                      clampBehavior="strict"
                      decimalScale={2}
                      disabled={!itemDraft?.selected}
                      hideControls
                      max={maxQty}
                      min={0}
                      size="xs"
                      value={itemDraft?.qty ?? ''}
                      w={88}
                      onChange={(value) => onItemQtyChange(sale, index, key, value)}
                    />
                  </Table.Td>
                  <Table.Td ta="right">
                    {formatAmount(getNumber(item.TotalAmountLocal) ?? getNumber(item.TotalAmount), qty, getNumber(item.Qty))}{' '}
                    {currency}
                  </Table.Td>
                </Table.Tr>
              )
            })}
          </Table.Tbody>
        </Table>
      </Stack>
    </Card>
  )
}

function buildClientFilters(merges: SalesUkraineSaleMerged[]): Array<{ label: string; value: string }> {
  const seen = new Map<string, string>()

  merges.forEach((merge) => {
    const netUid = getClientNetUid(merge)
    const client = getInputSale(merge)?.ClientAgreement?.Client

    if (netUid && !seen.has(netUid)) {
      seen.set(netUid, client?.FullName || netUid)
    }
  })

  return Array.from(seen.entries()).map(([value, label]) => ({ label, value }))
}

function getInputSale(merge: SalesUkraineSaleMerged): SalesUkraineSale | undefined {
  return merge.InputSale
}

function getClientNetUid(merge: SalesUkraineSaleMerged): string {
  return getInputSale(merge)?.ClientAgreement?.Client?.NetUid || ''
}

function getClientTypeLabel(client: { IsSubClient?: boolean; IsTradePoint?: boolean } | undefined, t: (key: string) => string): string {
  if (client?.IsTradePoint) {
    return t('Торгова точка')
  }

  if (client?.IsSubClient) {
    return t('Субклієнт')
  }

  return t('Клієнт')
}

function getClientPillClass(client: { IsSubClient?: boolean; IsTradePoint?: boolean } | undefined): string {
  if (client?.IsTradePoint) {
    return 'is-orange'
  }

  if (client?.IsSubClient) {
    return ''
  }

  return 'is-gray'
}

function getUserLastName(sale: SalesUkraineSale): string {
  const user = sale.User || sale.UpdateUser

  return user?.LastName?.trim() || ''
}

function formatDateTime(value?: Date | string): string {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('uk-UA')
}

function formatAmount(value: number | null, qty?: number, originalQty?: number | null): string {
  if (typeof value !== 'number') {
    return ''
  }

  if (typeof qty === 'number' && typeof originalQty === 'number' && originalQty > 0 && qty !== originalQty) {
    return amountFormatter.format((value / originalQty) * qty)
  }

  return amountFormatter.format(value)
}

function displayValue(value: unknown): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : ''
  }

  if (typeof value === 'string') {
    return value.trim()
  }

  return ''
}

function SalesDrawerSkeleton() {
  return (
    <Stack className="sales-drawer-loading" gap="md">
      {[0, 1].map((cardIndex) => (
        <Stack key={cardIndex} className="sales-drawer-skeleton-card" gap="sm">
          <div className="sales-drawer-skeleton-line" style={{ width: cardIndex === 0 ? '32%' : '26%' }} />
          <div className="sales-drawer-skeleton-line" style={{ width: '54%' }} />
          {[0, 1, 2, 3].map((rowIndex) => (
            <div key={rowIndex} className="sales-drawer-skeleton-row">
              <div className="sales-drawer-skeleton-line" style={{ width: '18px' }} />
              <div className="sales-drawer-skeleton-line" />
              <div className="sales-drawer-skeleton-line" style={{ width: rowIndex % 2 ? '82%' : '94%' }} />
              <div className="sales-drawer-skeleton-line" />
              <div className="sales-drawer-skeleton-line" />
            </div>
          ))}
        </Stack>
      ))}
    </Stack>
  )
}
