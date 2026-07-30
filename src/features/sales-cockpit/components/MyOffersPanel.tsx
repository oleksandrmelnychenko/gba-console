import {
  ActionIcon,
  Alert,
  Badge,
  Card,
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
import { CircleAlert, RefreshCw, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { TableRowAction } from '../../../shared/ui/table-row-action'
import { createWizardOperationId } from '../../sales-ukraine/components/new-sale-wizard/wizardMutationOperation'
import { getOffers, getPublicOfferLink, restartOfferValidity } from '../../sales-offers/api/salesOffersApi'
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
  const [offers, setOffers] = useValueState<ClientShoppingCart[]>([])
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useState(true)
  const [periodDays, setPeriodDays] = useValueState('30')
  const [search, setSearch] = useValueState('')
  const [debouncedSearch] = useDebouncedValue(search, 400)
  const [reloadKey, setReloadKey] = useState(0)
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

        const result = await getOffers({ from, to }, true)

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
      if (!offer.NetUid) {
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
    [t],
  )

  return (
    <Card className="app-section-card" withBorder padding="md" radius="md">
      <Stack gap="md">
        <Group justify="space-between" wrap="wrap">
          <Group gap="xs">
            <Text fw={600}>{t('Мої оферти')}</Text>
            {!isLoading && (
              <Text c="dimmed" size="sm">
                {visibleOffers.length} · {t('замовлено')} {summary.ordered} · {t('переглянуто')} {summary.viewed} ·{' '}
                {t('протерміновано')} {summary.expired}
              </Text>
            )}
          </Group>
          <Group gap="xs">
            <Select
              aria-label={t('Період')}
              data={PERIOD_OPTIONS}
              size="xs"
              value={periodDays}
              w={110}
              onChange={(value) => value && setPeriodDays(value)}
            />
            <TextInput
              aria-label={t('Пошук')}
              leftSection={<Search size={14} />}
              placeholder={t('Номер або клієнт')}
              size="xs"
              value={search}
              w={220}
              onChange={(event) => setSearch(event.currentTarget.value)}
            />
            <Tooltip label={t('Оновити')}>
              <ActionIcon
                aria-label={t('Оновити')}
                variant="light"
                onClick={() => setReloadKey((key) => key + 1)}
              >
                <RefreshCw size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        {error && (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}

        {isLoading ? (
          <Group justify="center" py="xl">
            <Loader size="sm" />
          </Group>
        ) : visibleOffers.length === 0 ? (
          <Text c="dimmed" py="md" size="sm" ta="center">
            {t('За обраний період оферт немає')}
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={860}>
            <Table highlightOnHover striped verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('Номер')}</Table.Th>
                  <Table.Th>{t('Клієнт')}</Table.Th>
                  <Table.Th>{t('Створено')}</Table.Th>
                  <Table.Th>{t('Дійсна до')}</Table.Th>
                  <Table.Th ta="right">{t('Позицій')}</Table.Th>
                  <Table.Th ta="right">{t('Сума')}</Table.Th>
                  <Table.Th>{t('Статус')}</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {visibleOffers.map((offer) => {
                  const lifecycle = getOfferLifecycle(offer)
                  const presentation = LIFECYCLE_PRESENTATION[lifecycle]
                  const currencyCode = offer.ClientAgreement?.Agreement?.Currency?.Code ?? 'EUR'
                  const viewedAt = offer.ViewedAt ? formatDateTime(offer.ViewedAt) : null

                  return (
                    <Table.Tr key={offer.NetUid ?? offer.Id}>
                      <Table.Td>
                        <Text ff="var(--font-mono)" size="sm">
                          {offer.Number ?? '—'}
                        </Text>
                      </Table.Td>
                      <Table.Td>{offer.ClientAgreement?.Client?.FullName ?? '—'}</Table.Td>
                      <Table.Td>{formatDateTime(offer.Created)}</Table.Td>
                      <Table.Td>{formatDate(offer.ValidUntil)}</Table.Td>
                      <Table.Td ta="right">{offer.OrderItems?.length ?? 0}</Table.Td>
                      <Table.Td ta="right">
                        {formatMoney(offer.TotalAmount)} {currencyCode}
                      </Table.Td>
                      <Table.Td>
                        <Tooltip
                          disabled={!viewedAt}
                          label={viewedAt ? `${t('Переглянута')} ${viewedAt}` : undefined}
                        >
                          <Badge color={presentation.color} variant="light">
                            {t(presentation.label)}
                          </Badge>
                        </Tooltip>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4} justify="flex-end" wrap="nowrap">
                          {lifecycle === 'expired' && (
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
                      </Table.Td>
                    </Table.Tr>
                  )
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Stack>
    </Card>
  )
}
