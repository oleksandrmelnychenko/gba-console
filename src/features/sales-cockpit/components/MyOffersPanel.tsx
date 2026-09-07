import {
  ActionIcon,
  Alert,
  Badge,
  Card,
  Group,
  Select,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { CircleAlert, RefreshCw, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import { TableRowAction } from '../../../shared/ui/table-row-action'
import { usePermissions } from '../../auth/usePermissions'
import { createWizardOperationId } from '../../sales-ukraine/components/new-sale-wizard/wizardMutationOperation'
import { getCockpitOffers, getPublicOfferLink, restartOfferValidity } from '../../sales-offers/api/salesOffersApi'
import { formatDate, formatDateTime, formatMoney } from '../../sales-offers/components/offerHelpers'
import type { ClientShoppingCart } from '../../sales-offers/types'
import { getOfferLifecycle, type OfferLifecycle } from './offerLifecycle'

const PERIOD_OPTIONS = [
  { label: '7 днів', value: '7' },
  { label: '30 днів', value: '30' },
  { label: '90 днів', value: '90' },
]

const LIFECYCLE_PRESENTATION: Record<OfferLifecycle, { color: string; label: string }> = {
  ordered: { color: 'green', label: 'Замовлена' },
  viewed: { color: 'blue', label: 'Переглянута' },
  expired: { color: 'red', label: 'Протермінована' },
  sent: { color: 'gray', label: 'Надіслана' },
}

export function MyOffersPanel() {
  const { t } = useI18n()
  const { can } = usePermissions()
  const canExtendValidity = can(PermissionKeys.SalesUkraineOffers.Offer.ExtendValidity)
  const [offers, setOffers] = useValueState<ClientShoppingCart[]>([])
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useState(true)
  const [periodDays, setPeriodDays] = useValueState('30')
  const [search, setSearch] = useValueState('')
  const [debouncedSearch] = useDebouncedValue(search, 400)
  const [reloadKey, setReloadKey] = useState(0)
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)
  const [pendingNetId, setPendingNetId] = useState<string | null>(null)
  const operationIdsRef = useRef(new Map<string, string>())

  useEffect(() => {
    let cancelled = false

    async function load() {
      setError(null)
      setLoading(true)

      try {
        const to = new Date()
        const from = new Date()
        from.setDate(from.getDate() - Number(periodDays))

        const result = await getCockpitOffers({ from, to })

        if (!cancelled) {
          setOffers(result)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити оферти'))
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
  }, [periodDays, reloadKey, setError, setOffers, t])

  const visibleOffers = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase()

    if (!needle) {
      return offers
    }

    return offers.filter((offer) =>
      [offer.Number, offer.ClientAgreement?.Client?.FullName]
        .some((field) => (field ?? '').toLowerCase().includes(needle)),
    )
  }, [offers, debouncedSearch])

  const summary = useMemo(() => {
    const counts: Record<OfferLifecycle, number> = { ordered: 0, viewed: 0, expired: 0, sent: 0 }

    for (const offer of visibleOffers) {
      counts[getOfferLifecycle(offer)] += 1
    }

    return counts
  }, [visibleOffers])

  const copyLink = useCallback(
    async (offer: ClientShoppingCart) => {
      if (!offer.NetUid) {
        return
      }

      try {
        await navigator.clipboard.writeText(getPublicOfferLink(offer.NetUid))
        notifications.show({ color: 'green', message: t('Посилання скопійовано') })
      } catch {
        notifications.show({ color: 'red', message: t('Не вдалося скопіювати посилання') })
      }
    },
    [t],
  )

  const extendValidity = useCallback(
    async (offer: ClientShoppingCart) => {
      if (!can(PermissionKeys.SalesUkraineOffers.Offer.ExtendValidity) || !offer.NetUid) {
        return
      }

      const operationKey = `extend|${offer.NetUid}`
      const existing = operationIdsRef.current.get(operationKey)
      const operationId = existing ?? createWizardOperationId()

      if (!existing) {
        operationIdsRef.current.set(operationKey, operationId)
      }

      setPendingNetId(offer.NetUid)

      try {
        await restartOfferValidity(offer.NetUid, { operationId })
        operationIdsRef.current.delete(operationKey)
        notifications.show({ color: 'green', message: t('Термін дії оферти продовжено') })
        setReloadKey((key) => key + 1)
      } catch (actionError) {
        notifications.show({
          color: 'red',
          message: actionError instanceof Error ? actionError.message : t('Не вдалося продовжити оферту'),
        })
      } finally {
        setPendingNetId(null)
      }
    },
    [can, t],
  )
  const offerColumns = useMemo<DataTableColumn<ClientShoppingCart>[]>(
    () => [
      {
        id: 'number',
        header: t('Номер'),
        accessor: (offer) => offer.Number ?? '',
        cell: (offer) => (
          <Text ff="var(--font-mono)" size="sm">
            {offer.Number ?? ''}
          </Text>
        ),
        width: 130,
      },
      {
        id: 'client',
        header: t('Клієнт'),
        accessor: (offer) => offer.ClientAgreement?.Client?.FullName ?? '',
        cell: (offer) => offer.ClientAgreement?.Client?.FullName ?? '',
        minWidth: 220,
        fill: true,
      },
      {
        id: 'created',
        header: t('Створено'),
        accessor: (offer) => offer.Created,
        cell: (offer) => formatDateTime(offer.Created),
        width: 180,
      },
      {
        id: 'valid-until',
        header: t('Дійсна до'),
        accessor: (offer) => offer.ValidUntil,
        cell: (offer) => formatDate(offer.ValidUntil),
        width: 155,
      },
      {
        id: 'positions',
        header: t('Позицій'),
        accessor: (offer) => offer.OrderItems?.length ?? 0,
        align: 'right',
        width: 125,
      },
      {
        id: 'total',
        header: t('Сума'),
        accessor: (offer) => offer.TotalAmount,
        cell: (offer) => (
          <span className="app-money">
            {formatMoney(offer.TotalAmount)}{' '}
            <span className="app-money-meta">{offer.ClientAgreement?.Agreement?.Currency?.Code ?? 'EUR'}</span>
          </span>
        ),
        align: 'right',
        width: 165,
      },
      {
        id: 'status',
        header: t('Статус'),
        accessor: (offer) => getOfferLifecycle(offer),
        cell: (offer) => {
          const lifecycle = getOfferLifecycle(offer)
          const presentation = LIFECYCLE_PRESENTATION[lifecycle]
          const viewedAt = offer.ViewedAt ? formatDateTime(offer.ViewedAt) : null

          return (
            <Badge
              className={'app-role-pill' + (presentation.color === 'blue' ? '' : ' is-' + presentation.color)}
              title={viewedAt ? t('Переглянута') + ' ' + viewedAt : undefined}
              variant="light"
            >
              {t(presentation.label)}
            </Badge>
          )
        },
        width: 130,
      },
      {
        id: 'actions',
        header: '',
        cell: (offer) => {
          const lifecycle = getOfferLifecycle(offer)

          return (
            <Group gap={4} justify="flex-end" wrap="nowrap">
              {canExtendValidity && lifecycle === 'expired' && (
                <TableRowAction
                  action="restore"
                  label={t('Продовжити на 2 дні')}
                  loading={pendingNetId === offer.NetUid}
                  onClick={() => void extendValidity(offer)}
                />
              )}
              {(lifecycle === 'sent' || lifecycle === 'viewed') && offer.NetUid && (
                <>
                  <TableRowAction
                    action="copy"
                    label={t('Скопіювати посилання')}
                    onClick={() => void copyLink(offer)}
                  />
                  <TableRowAction
                    action="open"
                    component="a"
                    href={getPublicOfferLink(offer.NetUid)}
                    label={t('Відкрити')}
                    rel="noreferrer"
                    target="_blank"
                  />
                </>
              )}
            </Group>
          )
        },
        align: 'right',
        rowActions: true,
        enableHiding: false,
        width: 120,
      },
    ],
    [canExtendValidity, copyLink, extendValidity, pendingNetId, t],
  )

  return (
    <Card className="app-section-card cockpit-panel-card" withBorder padding={0} radius="md">
      <div className="app-filter-bar cockpit-panel-bar">
        <div className="cockpit-panel-heading">
          <Text className="app-section-title" fw={600} size="sm">{t('Мої оферти')}</Text>
          <Text className="cockpit-panel-meta" size="xs">
            {isLoading ? t('Завантаження') : visibleOffers.length + ' · ' + t('замовлено') + ' ' + summary.ordered + ' · ' + t('переглянуто') + ' ' + summary.viewed + ' · ' + t('протерміновано') + ' ' + summary.expired}
          </Text>
        </div>
        <Select
          allowDeselect={false}
          data={PERIOD_OPTIONS.map((option) => ({ ...option, label: t(option.label) }))}
          label={t('Період')}
          value={periodDays}
          w={140}
          onChange={(value) => value && setPeriodDays(value)}
        />
        <TextInput
          label={t('Пошук')}
          leftSection={<Search size={15} />}
          placeholder={t('Номер або клієнт')}
          value={search}
          w={260}
          onChange={(event) => setSearch(event.currentTarget.value)}
        />
        <div className="app-filter-actions">
          <Tooltip label={t('Оновити')}>
            <ActionIcon aria-label={t('Оновити')} loading={isLoading} size={34} variant="default" onClick={() => setReloadKey((key) => key + 1)}>
              <RefreshCw size={17} />
            </ActionIcon>
          </Tooltip>
          <div ref={setTableToolbarSlot} className="app-filter-table-toolbar-slot" />
        </div>
      </div>
      {error && <Alert color="red" icon={<CircleAlert size={18} />} variant="light">{error}</Alert>}
      <div className="cockpit-panel-table">
        <DataTable
          columns={offerColumns}
          data={visibleOffers}
          emptyText={error ? t('Дані оферт недоступні') : t('За обраний період оферт немає')}
          getRowId={(offer) => String(offer.NetUid ?? offer.Id)}
          height="100%"
          isLoading={isLoading}
          layoutVersion="offers-compact-2"
          minWidth={1180}
          showLayoutControls
          tableId="sales-cockpit-my-offers"
          toolbarPortalTarget={tableToolbarSlot}
        />
      </div>
    </Card>
  )
}
