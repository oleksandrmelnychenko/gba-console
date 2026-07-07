import { ActionIcon, Alert, Button, Card, Group, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { CircleAlert, Plus, RefreshCw } from 'lucide-react'
import { useEffect } from 'react'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { AppModal } from '../../../shared/ui/AppModal'
import { getOffers, getPublicOfferLink, processOffer, restartOfferValidity } from '../api/salesOffersApi'
import { NewOfferModal } from '../components/NewOfferModal'
import { OfferCard } from '../components/OfferCard'
import { OfferReasonDrawer } from '../components/OfferReasonDrawer'
import type { ClientShoppingCart, OfferOrderItem, OffersFilters } from '../types'
import './offers-page.css'

type FilterDraft = {
  from: string
  to: string
}

type ConfirmState = {
  confirmLabel: string
  message: string
  onConfirm: () => Promise<void>
  title: string
}

function buildInitialFilters(): FilterDraft {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 7)

  return { from: formatLocalDate(from), to: formatLocalDate(to) }
}

function toFilters(draft: FilterDraft): OffersFilters {
  return { from: new Date(`${draft.from}T00:00:00`), to: new Date(`${draft.to}T00:00:00`) }
}

export function OffersPage() {
  const { t } = useI18n()
  const [draft, setDraft] = useValueState<FilterDraft>(buildInitialFilters)
  const [applied, setApplied] = useValueState<FilterDraft>(buildInitialFilters)
  const [offers, setOffers] = useValueState<ClientShoppingCart[]>([])
  const [isLoading, setLoading] = useValueState(true)
  const [error, setError] = useValueState<string | null>(null)
  const [expandedNetId, setExpandedNetId] = useValueState<string | null>(null)
  const [reasonOffer, setReasonOffer] = useValueState<ClientShoppingCart | null>(null)
  const [isReasonOpen, setReasonOpen] = useValueState(false)
  const [isNewOpen, setNewOpen] = useValueState(false)
  const [confirmState, setConfirmState] = useValueState<ConfirmState | null>(null)
  const [isConfirming, setConfirming] = useValueState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const next = await getOffers(toFilters(applied))

        if (!cancelled) {
          setOffers(next)
        }
      } catch {
        if (!cancelled) {
          setError(t('Не вдалося завантажити оферти'))
          setOffers([])
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
  }, [applied, setError, setLoading, setOffers, t])

  function reload() {
    setApplied({ ...draft })
  }

  function refresh() {
    setApplied((current) => ({ ...current }))
  }

  function toggle(offer: ClientShoppingCart) {
    setExpandedNetId((current) => (current === offer.NetUid ? null : offer.NetUid ?? null))
  }

  function openReason(offer: ClientShoppingCart) {
    setReasonOffer(offer)
    setReasonOpen(true)
  }

  function openItemReason(offer: ClientShoppingCart, item: OfferOrderItem) {
    setReasonOffer({ Id: offer.Id, NetUid: offer.NetUid, Number: offer.Number, OrderItems: [item] })
    setReasonOpen(true)
  }

  async function copyLink(offer: ClientShoppingCart) {
    if (!offer.NetUid) {
      return
    }

    try {
      await navigator.clipboard.writeText(getPublicOfferLink(offer.NetUid))
      notifications.show({ color: 'green', message: t('Посилання скопійовано') })
    } catch {
      notifications.show({ color: 'red', message: t('Не вдалося скопіювати посилання') })
    }
  }

  async function restart(offer: ClientShoppingCart) {
    if (!offer.NetUid) {
      return
    }

    try {
      await restartOfferValidity(offer.NetUid)
      notifications.show({ color: 'green', message: t('Оферту перезапущено') })
      refresh()
    } catch {
      notifications.show({ color: 'red', message: t('Не вдалося перезапустити оферту') })
    }
  }

  function requestDelete(offer: ClientShoppingCart) {
    setConfirmState({
      confirmLabel: t('Видалити'),
      message: t('Ви впевнені, що бажаєте видалити?'),
      title: t('Видалення оферти'),
      onConfirm: async () => {
        await processOffer({ ...offer, Deleted: true })
        notifications.show({ color: 'green', message: t('Оферту успішно видалено') })
        refresh()
      },
    })
  }

  async function runConfirm() {
    if (!confirmState) {
      return
    }

    setConfirming(true)

    try {
      await confirmState.onConfirm()
      setConfirmState(null)
    } catch {
      notifications.show({ color: 'red', message: t('Не вдалося виконати запит') })
    } finally {
      setConfirming(false)
    }
  }

  return (
    <Stack className="offers-page" gap={6}>
      <Card withBorder radius="md" padding={0} className="app-data-card offers-card">
        <div className="app-filter-bar offers-filter-bar">
          <TextInput
            label={t('Дата з')}
            type="date"
            value={draft.from}
            onChange={(event) => {
              const nextValue = event.currentTarget.value
              setDraft((current) => ({ ...current, from: nextValue }))
            }}
          />
          <TextInput
            label={t('Дата по')}
            type="date"
            value={draft.to}
            onChange={(event) => {
              const nextValue = event.currentTarget.value
              setDraft((current) => ({ ...current, to: nextValue }))
            }}
          />
          <div className="app-filter-actions offers-filter-actions">
            <Button color="gray" size="sm" variant="light" onClick={reload}>
              {t('Застосувати')}
            </Button>
            <Tooltip label={t('Оновити')}>
              <ActionIcon aria-label={t('Оновити')} color="gray" loading={isLoading} size={34} variant="light" onClick={refresh}>
                <RefreshCw size={17} />
              </ActionIcon>
            </Tooltip>
          </div>
          <div className="offers-create-actions">
            <Button color={CREATE_ACTION_COLOR} size="sm" leftSection={<Plus size={16} />} onClick={() => setNewOpen(true)}>
              {t('Створити оферту')}
            </Button>
          </div>
        </div>

        <Stack className="offers-page__content" gap="md" p="md">
          {error && (
            <Alert color="red" icon={<CircleAlert size={16} />} title={t('Помилка')}>
              {error}
            </Alert>
          )}

          {isLoading ? (
            <div className="offers-skeleton" aria-label={t('Завантаження оферт')} aria-busy="true">
              {Array.from({ length: 5 }, (_, index) => (
                <div key={index} className="offers-skeleton-card">
                  <span className="offers-skeleton-line is-title" />
                  <span className="offers-skeleton-line" />
                  <span className="offers-skeleton-line is-short" />
                </div>
              ))}
            </div>
          ) : offers.length === 0 ? (
            <Text c="dimmed">{t('Оферти відсутні')}</Text>
          ) : (
            <Stack gap="sm">
              {offers.map((offer) => (
                <OfferCard
                  key={offer.NetUid}
                  expanded={expandedNetId === offer.NetUid}
                  offer={offer}
                  onCopyLink={copyLink}
                  onDelete={requestDelete}
                  onOpenItemReason={openItemReason}
                  onOpenReason={openReason}
                  onRestart={restart}
                  onToggle={toggle}
                />
              ))}
            </Stack>
          )}
        </Stack>
      </Card>

      <OfferReasonDrawer
        offer={reasonOffer}
        opened={isReasonOpen}
        onClose={() => setReasonOpen(false)}
        onSaved={() => {
          setReasonOpen(false)
          refresh()
        }}
      />

      <NewOfferModal
        opened={isNewOpen}
        onClose={() => setNewOpen(false)}
        onCreated={() => {
          setNewOpen(false)
          refresh()
        }}
      />

      <AppModal
        centered
        className="offers-confirm-modal"
        opened={Boolean(confirmState)}
        size="sm"
        title={<span className="offers-confirm-modal__title">{confirmState?.title ?? ''}</span>}
        onClose={() => (isConfirming ? undefined : setConfirmState(null))}
      >
        {confirmState && (
          <Stack gap="md">
            <Text>{confirmState.message}</Text>
            <Group justify="flex-end">
              <Button color="gray" disabled={isConfirming} variant="subtle" onClick={() => setConfirmState(null)}>
                {t('Скасувати')}
              </Button>
              <Button color="red" loading={isConfirming} onClick={runConfirm}>
                {confirmState.confirmLabel}
              </Button>
            </Group>
          </Stack>
        )}
      </AppModal>
    </Stack>
  )
}
