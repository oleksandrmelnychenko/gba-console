import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Loader,
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
import { AiFeatureBadge } from '../../../shared/ai/AiFeatureBadge'
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
import { getWizardClientAgreements } from '../../sales-ukraine/components/new-sale-wizard/wizardClientStepApi'
import type { SalesUkraineClientAgreement, SalesUkraineProduct } from '../../sales-ukraine/types'
import { getCockpitClients } from '../api/salesCockpitApi'
import type { CockpitClient } from '../types'

const moneyFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 })
const lastOrderFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short' })

type ClientRecommendationsState = {
  agreement: SalesUkraineClientAgreement | null
  error: string | null
  isLoading: boolean
  products: RecommendationProduct[]
}

export function MyClientsPanel() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [clients, setClients] = useValueState<CockpitClient[]>([])
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useState(true)
  const [search, setSearch] = useValueState('')
  const [debouncedSearch] = useDebouncedValue(search, 400)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setError(null)
      setLoading(true)

      try {
        const result = await getCockpitClients()

        if (!cancelled) {
          setClients(result.clients)
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
  }, [reloadKey, setClients, setError, t])

  const visibleClients = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase()

    if (!needle) {
      return clients
    }

    return clients.filter((client) =>
      [client.name, client.full_name, client.phone, client.email]
        .some((field) => (field ?? '').toLowerCase().includes(needle)),
    )
  }, [clients, debouncedSearch])

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
        cell: (client) => <Text size="sm">{formatLastOrder(client.last_order) ?? '—'}</Text>,
        width: 150,
      },
      {
        id: 'orders',
        header: t('Замовлень (12м)'),
        accessor: (client) => client.orders_cnt,
        cell: (client) => <Text size="sm">{client.orders_cnt || '—'}</Text>,
        align: 'right',
        width: 125,
      },
      {
        id: 'turnover',
        header: t('Оборот (12м)'),
        accessor: (client) => client.turnover_eur,
        cell: (client) => (
          <Text className="app-money" size="sm">
            {client.turnover_eur > 0 ? formatMoney(client.turnover_eur) : '—'}
          </Text>
        ),
        align: 'right',
        width: 130,
      },
      {
        id: 'overdue',
        header: t('Прострочений борг'),
        accessor: (client) => client.overdue_eur,
        cell: (client) =>
          client.overdue_eur > 0 ? (
            <Tooltip
              label={`${t('Прострочено понад терміни')}: ${client.max_days_past_terms} ${t('дн')}`}
            >
              <Text c="red" className="app-money" fw={600} size="sm">
                {formatMoney(client.overdue_eur)}
              </Text>
            </Tooltip>
          ) : (
            <Text c="dimmed" size="sm">
              —
            </Text>
          ),
        align: 'right',
        width: 150,
      },
      {
        id: 'contacts',
        header: t('Контакти'),
        cell: (client) => {
          const phone = client.phone?.trim()
          const email = client.email?.trim()

          return (
            <Group gap={4} justify="flex-end" wrap="nowrap">
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
        width: 96,
      },
    ],
    [navigate, t],
  )

  return (
    <Card className="app-section-card" withBorder padding="md" radius="md">
      <Stack gap="md">
        <Group justify="space-between" wrap="wrap">
          <Group gap="xs">
            <Text className="app-section-title" fw={600} size="sm">
              {t('Мої клієнти')}
            </Text>
            <Badge className="app-role-pill is-gray" variant="light">
              {visibleClients.length}
            </Badge>
            <AiFeatureBadge size="sm" tooltip={t('AI-рекомендації товарів для кожного клієнта')} />
          </Group>

          <Group gap="xs">
            <TextInput
              leftSection={<Search size={16} />}
              placeholder={t('Пошук клієнта')}
              size="sm"
              value={search}
              w={260}
              onChange={(event) => setSearch(event.currentTarget.value)}
            />
            <Tooltip label={t('Оновити')}>
              <ActionIcon
                aria-label={t('Оновити')}
                size={34}
                variant="light"
                onClick={() => setReloadKey((key) => key + 1)}
              >
                <RefreshCw size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        {error && (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <DataTable
          columns={clientColumns}
          data={visibleClients}
          emptyText={t('Клієнтів не знайдено')}
          expandColumnLabels={{
            collapseRow: t('Згорнути'),
            expandRow: t('Розгорнути'),
          }}
          getRowId={(client) => String(client.client_id)}
          isLoading={isLoading}
          minWidth={940}
          renderExpandedRow={(client) => <ClientRecommendationsInline client={client} />}
          tableId="sales-cockpit-my-clients"
        />
      </Stack>
    </Card>
  )
}

function ClientRecommendationsInline({ client }: { client: CockpitClient }) {
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

  const canCreateSale = hasPermission(PermissionKeys.SalesUkraine.Sale.OpenCreateDialog)
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
        const agreements = await getWizardClientAgreements(clientNetId)
        const active = agreements.find((item) => item.Agreement?.IsActive) ?? agreements[0] ?? null
        const options = {
          signal: controller.signal,
          ...(active?.NetUid ? { clientAgreementNetId: active.NetUid } : {}),
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
  }, [clientNetId, t])

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
    ? t('Щоб створити оферту, додайте клієнту активний договір')
    : chosen.length === 0
      ? t('Виберіть хоча б один товар')
      : ''

  async function handleCreateOffer() {
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
                      variant="light"
                      onClick={handleCreateOffer}
                    >
                      {chosen.length > 0 ? `${t('Створити оферту')} (${chosen.length})` : t('Створити оферту')}
                    </Button>
                  </span>
                </Tooltip>
              )}
              <Tooltip label={t('Термін дії оферти')} withArrow>
                <Select
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

          <Table verticalSpacing={4} withRowBorders={false}>
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
          onCreated={() => setWizardPrefill(null)}
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
