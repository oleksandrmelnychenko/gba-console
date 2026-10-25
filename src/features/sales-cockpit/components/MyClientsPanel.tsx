import { useSingleFlight } from '../../../shared/hooks/useSingleFlight'
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Loader,
  Pagination,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { CircleAlert, Link as LinkIcon, RefreshCw, Search, ShoppingCart } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TableChip } from '../../../shared/ui/TableChip'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { TableRowAction } from '../../../shared/ui/table-row-action'
import { useAuth } from '../../auth/useAuth'
import { usePermissions } from '../../auth/usePermissions'
import {
  getMostPurchasedProductsByClientId,
  sendRecommendationFeedback,
} from '../../clients/api/clientRecommendationsApi'
import {
  canSelectRecommendationProduct,
  getRecommendationAvailableQty,
  hasRecommendationAvailabilityData,
} from '../../clients/components/recommendations/recommendationAvailability'
import { getRecommendationSourcePresentation } from '../../clients/components/recommendations/recommendationSourcePresentation'
import type { RecommendationProduct } from '../../clients/recommendationsTypes'
import { OfferLinkModal } from '../../sales-offers/components/OfferLinkModal'
import { useOfferFromRecommendations } from '../../sales-offers/useOfferFromRecommendations'
import type { OfferClientAgreement } from '../../sales-offers/types'
import { NewSaleWizard, type NewSaleWizardPrefill } from '../../sales-ukraine/components/new-sale-wizard/NewSaleWizard'
import { RecommendationAgreementScope } from '../../clients/components/recommendations/RecommendationAgreementScope'
import type { SalesUkraineClientAgreement, SalesUkraineProduct } from '../../sales-ukraine/types'
import { getCockpitClients } from '../api/salesCockpitApi'
import type { ContactClient } from '../contactTypes'
import type { CockpitClient, CockpitClientSegment, CockpitClientsResponse } from '../types'
import { ClientRepeatEvidence } from './ClientRepeatEvidence'

const moneyFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 })
const lastOrderFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short' })

type ClientRecommendationsState = {
  agreement: SalesUkraineClientAgreement | null
  error: string | null
  isLoading: boolean
  products: RecommendationProduct[]
}

export function MyClientsPanel({ onContact, onTasks, revision = 0 }: { onContact?: (client: ContactClient) => void; onTasks?: (client: ContactClient) => void; revision?: number }) {
  const { can } = usePermissions()
  const canRecordContact = can(PermissionKeys.SalesCockpit.Task.AddNote)
  const { t } = useI18n()
  const navigate = useNavigate()
  const [response, setResponse] = useValueState<CockpitClientsResponse | null>(null)
  const [segment, setSegment] = useState<CockpitClientSegment>('all')
  const [page, setPage] = useState(1)
  const pageSize = 50
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useState(true)
  const [search, setSearch] = useValueState('')
  const [debouncedSearch] = useDebouncedValue(search, 400)
  const [reloadKey, setReloadKey] = useState(0)
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setError(null)
      setLoading(true)
      setResponse(null)

      try {
        const result = await getCockpitClients({ segment, search: debouncedSearch, offset: (page - 1) * pageSize, limit: pageSize })

        if (!cancelled) {
          const lastPage = Math.max(1, Math.ceil(result.total / pageSize))
          if (page > lastPage) setPage(lastPage)
          else setResponse(result)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити клієнтів'))
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
  }, [reloadKey, revision, segment, page, debouncedSearch, setResponse, setError, t])

  const segments: Array<{ value: CockpitClientSegment; label: string }> = [
    { value: 'all', label: t('Усі клієнти') },
    { value: 'reorder_due', label: t('Час повторного замовлення') },
    { value: 'reorder_overdue', label: t('Прострочена повторна покупка') },
    { value: 'reactivation', label: t('Давно не купували') },
    { value: 'new_client', label: t('Без покупок у доступній історії') },
  ]

  const clientColumns = useMemo<DataTableColumn<CockpitClient>[]>(
    () => [
      {
        id: 'client',
        header: t('Клієнт'),
        accessor: (client) => client.name || client.full_name || client.client_id,
        cell: (client) => (
          <>
            <Anchor
              fw={600}
              size="sm"
              onClick={() => navigate(`/clients/edit/${client.client_net_uid}`)}
            >
              {client.name || client.full_name || `#${client.client_id}`}
            </Anchor>
            {client.full_name && client.name && client.full_name !== client.name && (
              <Text c="dimmed" size="xs">
                {client.full_name}
              </Text>
            )}
          </>
        ),
        minWidth: 240,
        fill: true,
      },
      {
        id: 'last-order',
        header: t('Останнє замовлення'),
        accessor: (client) => client.last_order ?? '',
        cell: (client) => <span className="app-money">{formatLastOrder(client.last_order) ?? ''}</span>,
        width: 210,
      },
      {
        id: 'orders',
        header: t('Замовлень (12м)'),
        accessor: (client) => client.orders_cnt,
        cell: (client) => <span className="app-money">{client.orders_cnt}</span>,
        align: 'right',
        width: 185,
      },
      {
        id: 'turnover',
        header: t('Оборот (12м)'),
        accessor: (client) => client.turnover_eur,
        cell: (client) => (
          <Text className="app-money" size="sm">
            {formatMoney(client.turnover_eur)}
          </Text>
        ),
        align: 'right',
        width: 180,
      },
      {
        id: 'overdue',
        header: t('Прострочений борг'),
        accessor: (client) => client.overdue_eur,
        cell: (client) => (
          <span className="app-money" title={client.overdue_eur > 0 ? t('Прострочено понад терміни') + ': ' + client.max_days_past_terms + ' ' + t('дн') : undefined}>
            {formatMoney(client.overdue_eur)}
          </span>
        ),
        align: 'right',
        width: 215,
      },
      {
        id: 'repeat-reason',
        header: t('Причина та наступний контакт'),
        cell: (client) => <ClientRepeatEvidence client={client} compact />,
        width: 320,
      },
      {
        id: 'contacts',
        header: t('Контакти'),
        cell: (client) => {
          const phone = client.phone?.trim()
          const email = client.email?.trim()

          return (
            <Group gap={4} justify="flex-end" wrap="nowrap">
              {onTasks && <TableRowAction action="history" label={t('Завдання та історія')} onClick={() => onTasks({ client_id: client.client_id, client_name: client.name || client.full_name || `#${client.client_id}` })} />}
              {onContact && <TableRowAction action={canRecordContact ? 'edit' : 'details'} label={t(canRecordContact ? 'Записати контакт' : 'Історія контактів')} onClick={() => onContact({ client_id: client.client_id, client_name: client.name || client.full_name || `#${client.client_id}` })} />}
              {phone && (
                <TableRowAction
                  action="call"
                  component="a"
                  href={`tel:${phone}`}
                  label={`${t('Подзвонити')}: ${phone}`}
                  tone="success"
                />
              )}
              {email && (
                <TableRowAction
                  action="email"
                  component="a"
                  href={`mailto:${email}`}
                  label={`${t('Написати')}: ${email}`}
                  tone="brand"
                />
              )}
            </Group>
          )
        },
        align: 'right',
        rowActions: true,
        width: 72 + (onContact ? 32 : 0) + (onTasks ? 32 : 0),
      },
    ],
    [navigate, t, canRecordContact, onContact, onTasks],
  )

  return (
    <Card className="app-section-card cockpit-panel-card" withBorder padding={0} radius="md">
      <div className="app-filter-bar cockpit-panel-bar">
        <div className="cockpit-panel-heading">
          <Text className="app-section-title" fw={600} size="sm">{t('Мої клієнти')}</Text>
          <Group gap={6} wrap="nowrap">
            <TableChip value={isLoading ? '…' : response?.total ?? '—'} />
          </Group>
        </div>
        <Select
          classNames={{ input: 'cockpit-mono-input', option: 'cockpit-mono-input' }}
          label={t('Сегмент клієнтів')}
          value={segment}
          allowDeselect={false}
          data={segments.map((item) => ({ value: item.value, label: `${item.label} (${response?.segment_counts[item.value] ?? '—'})` }))}
          w={320}
          onChange={(value) => { setSegment((value ?? 'all') as CockpitClientSegment); setPage(1) }}
        />
        <TextInput
          label={t('Пошук клієнта')}
          leftSection={<Search size={15} />}
          placeholder={t('Назва, телефон або email')}
          value={search}
          w={280}
          onChange={(event) => { setSearch(event.currentTarget.value); setPage(1) }}
        />
        <div className="app-filter-actions">
          <Button
            leftSection={<RefreshCw size={16} />}
            loading={isLoading}
            variant="default"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            {t('Оновити')}
          </Button>
          <div ref={setTableToolbarSlot} className="app-filter-table-toolbar-slot" />
        </div>
      </div>
      {error && <Alert color="red" icon={<CircleAlert size={18} />} variant="light">{error}</Alert>}
      {response && <Text size="xs" c="dimmed" px="md" py="xs">
        {t('У вибраному сегменті')}: {response.total} · {t('У клієнтській базі за пошуком')}: {response.population_count}. {t('Лічильники охоплюють усі знайдені записи, не лише цю сторінку. Сегменти можуть перетинатися.')}
      </Text>}
      <div className="cockpit-panel-table">
        <DataTable
          columns={clientColumns}
          data={response?.clients ?? []}
          emptyText={error ? t('Дані клієнтів недоступні') : t('Клієнтів не знайдено')}
          expandColumnLabels={{ collapseRow: t('Згорнути'), expandRow: t('Розгорнути') }}
          getRowId={(client) => String(client.client_id)}
          height="100%"
          isLoading={isLoading}
          layoutVersion="clients-workday-5"
          minWidth={1180}
          renderExpandedRow={(client) => <Stack gap="xs"><ClientRepeatEvidence client={client} /><ClientRecommendationsInline client={client} onSaleCreated={() => setReloadKey((key) => key + 1)} /></Stack>}
          showLayoutControls
          tableId="sales-cockpit-my-clients"
          toolbarPortalTarget={tableToolbarSlot}
        />
      </div>
      {response && response.total > pageSize && <Group justify="space-between" p="sm">
        <Text size="sm">{t('Показано')}: {response.offset + 1}–{response.offset + response.count} {t('з')} {response.total}</Text>
        <Pagination total={Math.ceil(response.total / pageSize)} value={page} onChange={setPage} />
      </Group>}
    </Card>
  )
}

function ClientRecommendationsInline({ client, onSaleCreated }: { client: CockpitClient; onSaleCreated: () => void }) {
  return (
    <RecommendationAgreementScope clientNetId={client.client_net_uid}>
      {(agreement) => <ClientRecommendationsForAgreement client={client} agreement={agreement as SalesUkraineClientAgreement} onSaleCreated={onSaleCreated} />}
    </RecommendationAgreementScope>
  )
}

function ClientRecommendationsForAgreement({
  client, agreement, onSaleCreated,
}: { client: CockpitClient; agreement: SalesUkraineClientAgreement; onSaleCreated: () => void }) {
  const runActionOnce = useSingleFlight()
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const { can } = usePermissions()
  const [state, setState] = useState<ClientRecommendationsState>({
    agreement: null,
    error: null,
    isLoading: true,
    products: [],
  })
  const [selectedKeys, setSelectedKeys] = useState<ReadonlySet<string>>(new Set())
  const [offerValidDays, setOfferValidDays] = useState('2')
  const [wizardPrefill, setWizardPrefill] = useState<NewSaleWizardPrefill | null>(null)
  const { clearCreatedOffer, createdOffer, createOfferFromSelection, isCreatingOffer } =
    useOfferFromRecommendations()

  const canCreateSale = hasPermission(PermissionKeys.SalesUkraine.Sale.Create)
  const canCreateOffer = can(PermissionKeys.SalesUkraineOffers.Offer.Create)
  const canExcludeProduct = can(PermissionKeys.Clients.Recommendations.ExcludeProduct)
  const clientNetId = client.client_net_uid
  const isVatSale = Boolean(state.agreement?.Agreement?.WithVATAccounting)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function load() {
      setSelectedKeys(new Set())

      try {
        const active = agreement
        const options = {
          signal: controller.signal,
          clientAgreementNetId: active.NetUid || '',
        }
        const products = await getMostPurchasedProductsByClientId(clientNetId, false, options)

        if (!cancelled) {
          setState({ agreement: active, error: null, isLoading: false, products })
        }
      } catch (loadError) {
        if (!cancelled && !controller.signal.aborted) {
          setState({
            agreement: null,
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити рекомендації'),
            isLoading: false,
            products: [],
          })
        }
      }
    }

    void load()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [agreement, clientNetId, t])

  const toggleSelected = useCallback(
    (product: RecommendationProduct, index: number) => {
      if (!canSelectRecommendationProduct(product, isVatSale)) {
        return
      }

      const key = getProductKey(product, index)
      setSelectedKeys((current) => {
        const next = new Set(current)

        if (next.has(key)) {
          next.delete(key)
        } else {
          next.add(key)
        }

        return next
      })
    },
    [isVatSale],
  )

  const chosen = useMemo(
    () =>
      state.products.filter(
        (product, index) =>
          selectedKeys.has(getProductKey(product, index)) &&
          canSelectRecommendationProduct(product, isVatSale) &&
          (product.Id ?? 0) > 0 &&
          product.NetUid,
      ),
    [isVatSale, selectedKeys, state.products],
  )

  const offerDisabledReason = !state.agreement
    ? t('Щоб створити пропозицію, додайте клієнту активний договір')
    : chosen.length === 0
      ? t('Виберіть хоча б один товар')
      : ''

  async function handleCreateOffer() {
    return runActionOnce('handleCreateOffer', async () => {
      if (!can(PermissionKeys.SalesUkraineOffers.Offer.Create) || !state.agreement || chosen.length === 0) {
        return
      }

      const created = await createOfferFromSelection(
        state.agreement as OfferClientAgreement,
        chosen,
        Number(offerValidDays) || undefined,
      )

      if (created) {
        setSelectedKeys(new Set())
      }
    })
  }

  function handleOpenSaleWizard() {
    if (!state.agreement?.NetUid || chosen.length === 0) {
      return
    }

    setWizardPrefill({
      agreement: state.agreement,
      agreementNetId: state.agreement.NetUid,
      clientNetId,
      products: chosen as unknown as SalesUkraineProduct[],
    })
  }

  async function handleExcludeProduct(product: RecommendationProduct, index: number) {
    return runActionOnce('exclude:' + getProductKey(product, index), async () => {
      if (!can(PermissionKeys.Clients.Recommendations.ExcludeProduct) || !(product.Id ?? 0)) {
        return
      }

      const key = getProductKey(product, index)

      try {
        await sendRecommendationFeedback(clientNetId, [product.Id as number])
        setState((current) => ({
          ...current,
          products: current.products.filter((item, itemIndex) => getProductKey(item, itemIndex) !== key),
        }))
        setSelectedKeys((current) => {
          const next = new Set(current)
          next.delete(key)
          return next
        })
        notifications.show({ color: 'green', message: t('Більше не пропонуватимемо цей товар клієнту') })
      } catch (feedbackError) {
        notifications.show({
          color: 'red',
          message: feedbackError instanceof Error ? feedbackError.message : t('Не вдалося зберегти відгук'),
        })
      }
    })
  }

  return (
    <div className="cockpit-client-recs">
      {state.isLoading ? (
        <Group gap="xs" p="md">
          <Loader size="xs" />
          <Text c="dimmed" size="sm">
            {t('Завантаження рекомендацій')}
          </Text>
        </Group>
      ) : state.error ? (
        <Alert color="red" icon={<CircleAlert size={16} />} m="sm" variant="light">
          {state.error}
        </Alert>
      ) : state.products.length === 0 ? (
        <Text c="dimmed" p="md" size="sm">
          {t('Для цього клієнта поки немає рекомендацій')}
        </Text>
      ) : (
        <Stack gap="xs" p="sm">
          <Group justify="space-between" wrap="wrap">
            <Text c="dimmed" size="xs">
              {t('Відмітьте товари, які опрацювали сьогодні, і сформуйте персональну пропозицію')}
            </Text>
            <Group gap={6} wrap="nowrap">
              {canCreateSale && (
                <Tooltip disabled={!offerDisabledReason} label={offerDisabledReason} withArrow>
                  <span>
                    <Button
                      color={CREATE_ACTION_COLOR}
                      disabled={Boolean(offerDisabledReason)}
                      leftSection={<ShoppingCart size={14} />}
                      size="xs"
                      onClick={handleOpenSaleWizard}
                    >
                      {chosen.length > 0 ? `${t('Утворити продажу')} (${chosen.length})` : t('Утворити продажу')}
                    </Button>
                  </span>
                </Tooltip>
              )}
              {canCreateOffer && (
                <Tooltip disabled={!offerDisabledReason} label={offerDisabledReason} withArrow>
                  <span>
                    <Button
                      disabled={Boolean(offerDisabledReason)}
                      leftSection={<LinkIcon size={14} />}
                      loading={isCreatingOffer}
                      size="xs"
                      variant="default"
                      onClick={handleCreateOffer}
                    >
                      {chosen.length > 0 ? `${t('Створити пропозицію')} (${chosen.length})` : t('Створити пропозицію')}
                    </Button>
                  </span>
                </Tooltip>
              )}
              <Tooltip label={t('Термін дії пропозиції')} withArrow>
                <Select
                  classNames={{ input: 'cockpit-mono-input', option: 'cockpit-mono-input' }}
                  allowDeselect={false}
                  data={[
                    { value: '1', label: `1 ${t('дн')}` },
                    { value: '2', label: `2 ${t('дн')}` },
                    { value: '7', label: `7 ${t('дн')}` },
                    { value: '14', label: `14 ${t('дн')}` },
                  ]}
                  size="xs"
                  value={offerValidDays}
                  w={78}
                  onChange={(value) => setOfferValidDays(value ?? '2')}
                />
              </Tooltip>
            </Group>
          </Group>

          <Table className="app-static-table" verticalSpacing={4} withRowBorders={false}>
            <Table.Tbody>
              {state.products.map((product, index) => {
                const key = getProductKey(product, index)
                const selectable = canSelectRecommendationProduct(product, isVatSale)
                const availableQty = getRecommendationAvailableQty(product, isVatSale)
                const hasAvailability = hasRecommendationAvailabilityData(product, isVatSale)
                const source = getRecommendationSourcePresentation(product)

                return (
                  <Table.Tr key={key}>
                    <Table.Td w={32}>
                      <Tooltip disabled={selectable} label={t('Немає в наявності')}>
                        <span>
                          <Checkbox
                            checked={selectedKeys.has(key)}
                            disabled={!selectable}
                            size="xs"
                            onChange={() => toggleSelected(product, index)}
                          />
                        </span>
                      </Tooltip>
                    </Table.Td>
                    <Table.Td w={140}>
                      <Text size="xs" style={{ fontFamily: 'var(--font-mono)' }}>
                        {product.VendorCode || '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{product.NameUA || product.Name || '—'}</Text>
                    </Table.Td>
                    <Table.Td ta="right" w={110}>
                      <Text className="app-money" size="sm">
                        {typeof product.CurrentPrice === 'number' ? `€${product.CurrentPrice.toFixed(2)}` : '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td className="app-table-number" ta="right" w={110}>
                      <Text c={availableQty > 0 ? undefined : 'dimmed'} size="xs">
                        {hasAvailability ? `${t('Наявність')}: ${availableQty}` : '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td w={180}>
                      {source && (
                        <Tooltip label={source.tooltip} withArrow>
                          <Badge color={source.color} size="sm" variant="light">
                            {t(source.label)}
                          </Badge>
                        </Tooltip>
                      )}
                    </Table.Td>
                    <Table.Td w={36}>
                      {canExcludeProduct && (
                        <TableRowAction
                          action="cancel"
                          label={t('Не пропонувати цей товар клієнту')}
                          tone="neutral"
                          onClick={() => handleExcludeProduct(product, index)}
                        />
                      )}
                    </Table.Td>
                  </Table.Tr>
                )
              })}
            </Table.Tbody>
          </Table>
        </Stack>
      )}

      <OfferLinkModal offer={createdOffer} onClose={clearCreatedOffer} />

      {canCreateSale && (
        <NewSaleWizard
          canConvertMergedToBill={hasPermission(PermissionKeys.SalesUkraine.Sale.ConvertMergedToBill)}
          opened={Boolean(wizardPrefill)}
          permissionScopedSalesUkraineApi
          prefill={wizardPrefill}
          onClose={() => setWizardPrefill(null)}
          onCreated={() => { setWizardPrefill(null); onSaleCreated() }}
        />
      )}
    </div>
  )
}

function getProductKey(product: RecommendationProduct, index: number): string {
  return product.NetUid || String(product.Id ?? index)
}

function formatMoney(value: number): string {
  return `€${moneyFormatter.format(value)}`
}

function formatLastOrder(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const parsed = new Date(value)

  return Number.isNaN(parsed.getTime()) ? null : lastOrderFormatter.format(parsed)
}
