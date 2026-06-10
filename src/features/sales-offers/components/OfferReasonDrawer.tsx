import { Anchor, Badge, Button, Group, Stack, Text, Textarea } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { ProductCardModal } from '../../products/components/ProductCardModal'
import { processOffer } from '../api/salesOffersApi'
import type { ClientShoppingCart, OfferOrderItem } from '../types'
import { getItemNotProcessed } from './offerHelpers'

export function OfferReasonDrawer({
  offer,
  onClose,
  onSaved,
  opened,
}: {
  offer: ClientShoppingCart | null
  onClose: () => void
  onSaved: () => void
  opened: boolean
}) {
  const { t } = useI18n()

  return (
    <AppDrawer
      opened={opened}
      size="lg"
      title={offer ? `${t('Оферта')} ${offer.Number ?? ''}` : t('Причини')}
      onClose={onClose}
    >
      {opened && offer && <OfferReasonForm key={offer.NetUid} offer={offer} onClose={onClose} onSaved={onSaved} />}
    </AppDrawer>
  )
}

function OfferReasonForm({
  offer,
  onClose,
  onSaved,
}: {
  offer: ClientShoppingCart
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useI18n()
  const notProcessedItems = (offer.OrderItems ?? []).filter((item) => getItemNotProcessed(item) > 0)
  const isSingleItem = (offer.OrderItems ?? []).length === 1
  const [offerComment, setOfferComment] = useState(offer.Comment ?? '')
  const [reasons, setReasons] = useState<Record<string, string>>(() => buildInitialReasons(notProcessedItems))
  const [isSaving, setSaving] = useState(false)
  const [productCardNetId, setProductCardNetId] = useState<string | null>(null)

  async function save() {
    setSaving(true)

    const payload: ClientShoppingCart = {
      ...offer,
      Comment: isSingleItem ? offer.Comment : offerComment,
      OrderItems: (offer.OrderItems ?? []).map((item) => ({
        ...item,
        Comment: item.NetUid && item.NetUid in reasons ? reasons[item.NetUid] : item.Comment,
      })),
    }

    try {
      await processOffer(payload)
      notifications.show({ color: 'green', message: t('Оферту успішно оновлено') })
      onSaved()
    } catch {
      notifications.show({ color: 'red', message: t('Не вдалося зберегти причини') })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Stack gap="md">
      {!isSingleItem && (
        <Textarea
          autosize
          label={t('Коментар')}
          minRows={2}
          value={offerComment}
          onChange={(event) => setOfferComment(event.currentTarget.value)}
        />
      )}

      <Text fw={600} size="sm">
        {t('Неопрацьовані позиції')}
      </Text>

      {notProcessedItems.length === 0 && (
        <Text c="dimmed" size="sm">
          {t('Немає неопрацьованих позицій')}
        </Text>
      )}

      {notProcessedItems.map((item) => (
        <Stack key={item.NetUid} gap={4}>
          <Group gap="xs" justify="space-between">
            {item.Product?.NetUid ? (
              <Anchor
                component="button"
                fw={500}
                size="sm"
                style={{ textAlign: 'left' }}
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  setProductCardNetId(item.Product?.NetUid as string)
                }}
              >
                {[item.Product?.VendorCode, item.Product?.Name].filter(Boolean).join(' ')}
              </Anchor>
            ) : (
              <Text fw={500} size="sm">
                {[item.Product?.VendorCode, item.Product?.Name].filter(Boolean).join(' ')}
              </Text>
            )}
            <Group gap="xs">
              <Badge color="gray" variant="light">
                {t('Замовлено')}: {item.OrderedQty ?? 0}
              </Badge>
              <Badge color="orange" variant="light">
                {t('Неопрацьовано')}: {getItemNotProcessed(item)}
              </Badge>
            </Group>
          </Group>
          <Textarea
            autosize
            label={t('Причина')}
            minRows={1}
            value={item.NetUid ? reasons[item.NetUid] ?? '' : ''}
            onChange={(event) => {
              const value = event.currentTarget.value

              setReasons((current) => ({ ...current, [item.NetUid ?? '']: value }))
            }}
          />
        </Stack>
      ))}

      <Group justify="flex-end">
        <Button color="gray" disabled={isSaving} variant="subtle" onClick={onClose}>
          {t('Скасувати')}
        </Button>
        <Button loading={isSaving} onClick={save}>
          {t('Зберегти')}
        </Button>
      </Group>
      <ProductCardModal productNetId={productCardNetId} onClose={() => setProductCardNetId(null)} />
    </Stack>
  )
}

function buildInitialReasons(items: OfferOrderItem[]): Record<string, string> {
  const result: Record<string, string> = {}

  items.forEach((item) => {
    if (item.NetUid) {
      result[item.NetUid] = item.Comment ?? ''
    }
  })

  return result
}
