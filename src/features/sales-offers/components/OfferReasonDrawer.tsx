import { Anchor, Badge, Button, Group, Stack, Text, Textarea } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useState } from 'react'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { ProductCardModal } from '../../products/components/ProductCardModal'
import { usePermissions } from '../../auth/usePermissions'
import { createWizardOperationId } from '../../sales-ukraine/components/new-sale-wizard/wizardMutationOperation'
import { processOffer } from '../api/salesOffersApi'
import type { ClientShoppingCart, OfferOrderItem } from '../types'
import { getItemNotProcessed } from './offerHelpers'
import './offers-modal.css'

const OFFER_REASON_FORM_ID = 'offer-reason-form'

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
  const { can } = usePermissions()
  const isOpen = can(PermissionKeys.SalesUkraineOffers.Offer.Edit) && opened
  const [isSaving, setSaving] = useState(false)

  function close() {
    setSaving(false)
    onClose()
  }

  return (
    <AppDrawer
      className="offer-reason-drawer"
      footer={
        isOpen && offer ? (
          <Group gap="sm" justify="flex-end">
            <Button color="gray" disabled={isSaving} type="button" variant="subtle" onClick={close}>
              {t('Скасувати')}
            </Button>
            <Button
              color={CREATE_ACTION_COLOR}
              form={OFFER_REASON_FORM_ID}
              loading={isSaving}
              type="submit"
            >
              {t('Зберегти')}
            </Button>
          </Group>
        ) : undefined
      }
      opened={isOpen}
      size="lg"
      title={offer ? `${t('Оферта')} ${offer.Number ?? ''}` : t('Причини')}
      onClose={close}
    >
      {isOpen && offer && (
        <OfferReasonForm
          key={offer.NetUid}
          isSaving={isSaving}
          offer={offer}
          onSaved={onSaved}
          onSavingChange={setSaving}
        />
      )}
    </AppDrawer>
  )
}

function OfferReasonForm({
  isSaving,
  offer,
  onSaved,
  onSavingChange,
}: {
  isSaving: boolean
  offer: ClientShoppingCart
  onSaved: () => void
  onSavingChange: (value: boolean) => void
}) {
  const { t } = useI18n()
  const { can } = usePermissions()
  const notProcessedItems = (offer.OrderItems ?? []).filter((item) => getItemNotProcessed(item) > 0)
  const isSingleItem = (offer.OrderItems ?? []).length === 1
  const [offerComment, setOfferComment] = useState(offer.Comment ?? '')
  const [reasons, setReasons] = useState<Record<string, string>>(() => buildInitialReasons(notProcessedItems))
  const [productCardNetId, setProductCardNetId] = useState<string | null>(null)
  const [operationId] = useState(createWizardOperationId)

  async function save() {
    if (!can(PermissionKeys.SalesUkraineOffers.Offer.Edit)) {
      return
    }

    onSavingChange(true)

    const payload: ClientShoppingCart = {
      ...offer,
      Comment: isSingleItem ? offer.Comment : offerComment,
      OrderItems: (offer.OrderItems ?? []).map((item) => ({
        ...item,
        Comment: item.NetUid && item.NetUid in reasons ? reasons[item.NetUid] : item.Comment,
      })),
    }

    try {
      await processOffer(payload, { operationId })
      notifications.show({ color: 'green', message: t('Оферту успішно оновлено') })
      onSaved()
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : t('Не вдалося зберегти причини'),
      })
    } finally {
      onSavingChange(false)
    }
  }

  return (
    <>
      <Stack
        component="form"
        gap="md"
        id={OFFER_REASON_FORM_ID}
        onSubmit={(event) => {
          event.preventDefault()

          if (!isSaving) {
            void save()
          }
        }}
      >
        {!isSingleItem && (
          <Textarea
            autosize
            label={t('Коментар')}
            minRows={2}
            value={offerComment}
            onChange={(event) => setOfferComment(event.currentTarget.value)}
          />
        )}

        <Text className="app-section-title">
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
                  className="offer-reason-product-link"
                  component="button"
                  type="button"
                  underline="always"
                  onClick={(event) => {
                    event.stopPropagation()
                    setProductCardNetId(item.Product?.NetUid as string)
                  }}
                >
                  {[item.Product?.VendorCode, item.Product?.Name].filter(Boolean).join(' ')}
                </Anchor>
              ) : (
                <Text className="offer-reason-product-name">
                  {[item.Product?.VendorCode, item.Product?.Name].filter(Boolean).join(' ')}
                </Text>
              )}
              <Group gap="xs">
                <Badge className="app-role-pill is-gray" variant="light">
                  {t('Замовлено')}: {item.OrderedQty ?? 0}
                </Badge>
                <Badge className="app-role-pill is-orange" variant="light">
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
      </Stack>
      <ProductCardModal productNetId={productCardNetId} onClose={() => setProductCardNetId(null)} />
    </>
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
