import { notifications } from '@mantine/notifications'
import { useCallback, useState } from 'react'
import { useI18n } from '../../shared/i18n/useI18n'
import { PermissionKeys } from '../../shared/auth/permissionKeys'
import { usePermissions } from '../auth/usePermissions'
import { usePersistentCreateMutation } from '../sales-ukraine/persistentCreateMutation'
import { createOffer } from './api/salesOffersApi'
import { buildOfferFromRecommendations } from './offerFromRecommendations'
import type { RecommendationProduct } from '../clients/recommendationsTypes'
import type { ClientShoppingCart, OfferClientAgreement } from './types'

// Shared «Створити оферту» flow for recommendation check-lists (client card + cockpit clients tab):
// build the cart, run the idempotent create mutation, hand back the persisted offer for the link modal.
export function useOfferFromRecommendations() {
  const { t } = useI18n()
  const { can } = usePermissions()
  const runCreateOffer = usePersistentCreateMutation('offer', 'new')
  const [createdOffer, setCreatedOffer] = useState<ClientShoppingCart | null>(null)
  const [isCreatingOffer, setCreatingOffer] = useState(false)

  const createOfferFromSelection = useCallback(
    async (
      agreement: OfferClientAgreement,
      products: RecommendationProduct[],
      validDays?: number,
    ): Promise<boolean> => {
      if (!can(PermissionKeys.SalesUkraineOffers.Offer.Create)) {
        return false
      }

      setCreatingOffer(true)

      try {
        const result = await runCreateOffer(
          buildOfferFromRecommendations(agreement, products),
          (offer, operation) => createOffer(offer, operation, validDays),
        )

        if (!result?.NetUid) {
          notifications.show({ color: 'red', message: t('Не вдалося отримати посилання на оферту') })
          return false
        }

        notifications.show({ color: 'green', message: t('Оферту успішно створено') })
        setCreatedOffer(result)
        return true
      } catch (error) {
        notifications.show({
          color: 'red',
          message: error instanceof Error ? error.message : t('Не вдалося створити оферту'),
        })
        return false
      } finally {
        setCreatingOffer(false)
      }
    },
    [can, runCreateOffer, t],
  )

  const clearCreatedOffer = useCallback(() => setCreatedOffer(null), [])

  return { clearCreatedOffer, createdOffer, createOfferFromSelection, isCreatingOffer }
}
