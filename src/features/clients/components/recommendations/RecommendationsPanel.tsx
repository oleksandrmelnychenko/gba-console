import { useSingleFlight } from '../../../../shared/hooks/useSingleFlight'
import './recommendations-panel.css'
import { RecommendationsList, SelectedProductCard, ProductImagePreviewModal } from './RecommendationProducts'
import { getRecommendationProductKey as getProductKey } from './recommendationProductKey'
import { useRecommendationsData } from './useRecommendationsData'
import {
  Alert,
  Button,
  Card,
  Group,
  Loader,
  Select,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { CircleAlert, Link as LinkIcon, ShoppingCart } from 'lucide-react'
import { useState } from 'react'
import { AiFeatureBadge } from '../../../../shared/ai/AiFeatureBadge'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { CREATE_ACTION_COLOR } from '../../../../shared/ui/page-header-actions/PageHeaderActions'
import { useAuth } from '../../../auth/useAuth'
import { PermissionKeys } from '../../../../shared/auth/permissionKeys'
import { NewSaleWizard, type NewSaleWizardPrefill } from '../../../sales-ukraine/components/new-sale-wizard/NewSaleWizard'
import { RecommendationAgreementScope } from './RecommendationAgreementScope'
import type { SalesUkraineClientAgreement, SalesUkraineProduct } from '../../../sales-ukraine/types'
import { OfferLinkModal } from '../../../sales-offers/components/OfferLinkModal'
import { useOfferFromRecommendations } from '../../../sales-offers/useOfferFromRecommendations'
import type { OfferClientAgreement } from '../../../sales-offers/types'
import { sendRecommendationFeedback } from '../../api/clientRecommendationsApi'
import type { RecommendationProduct } from '../../recommendationsTypes'
import type { Client, ClientAgreement } from '../../types'
import { canSelectRecommendationProduct } from './recommendationAvailability'

type RecommendationsPanelProps = {
  client: Client
  productNetId?: string
}

export function RecommendationsPanel(props: RecommendationsPanelProps) {
  return (
    <RecommendationAgreementScope clientNetId={props.client.NetUid || ''}>
      {(agreement) => <RecommendationsForAgreement key={props.productNetId ?? 'client'} {...props} agreement={agreement} />}
    </RecommendationAgreementScope>
  )
}

function RecommendationsForAgreement({
  client, productNetId, agreement,
}: RecommendationsPanelProps & { agreement: ClientAgreement }) {
  const runActionOnce = useSingleFlight()
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const { state, dispatch } = useRecommendationsData({ agreementNetId: agreement.NetUid || '', clientNetId: client.NetUid || '', productNetId })
  const { error, isLoading, previewProduct, products, selectedKeys, selectedProduct } = state
  const agreementNetId = agreement.NetUid || ''
  const [wizardPrefill, setWizardPrefill] = useState<NewSaleWizardPrefill | null>(null)
  const [offerValidDays, setOfferValidDays] = useState('2')
  const { clearCreatedOffer, createdOffer, createOfferFromSelection, isCreatingOffer } =
    useOfferFromRecommendations()

  const clientNetId = client.NetUid || ''
  const canCreateSale = hasPermission(PermissionKeys.SalesUkraine.Sale.Create)
  const canExcludeProduct = hasPermission(PermissionKeys.Clients.Recommendations.ExcludeProduct)
  const isVatSale = Boolean(agreement?.Agreement?.WithVATAccounting)
  const selectedCount = selectedKeys.size
  const createSaleDisabled = isLoading || !clientNetId || !agreementNetId || selectedCount === 0
  const createSaleDisabledReason = !agreementNetId
    ? t('Щоб створити продаж, додайте клієнту активний договір із цінами продажу')
      : selectedCount === 0
        ? t('Виберіть хоча б один товар')
        : ''

  function toggleSelected(product: RecommendationProduct, index: number) {
    if (!canSelectRecommendationProduct(product, isVatSale)) {
      return
    }

    const key = getProductKey(product, index)
    dispatch({ key, type: 'toggleSelected' })
  }

  function getChosenProducts(): RecommendationProduct[] {
    return products.filter(
      (product, index) =>
        selectedKeys.has(getProductKey(product, index))
        && canSelectRecommendationProduct(product, isVatSale)
        && (product.Id ?? 0) > 0
        && product.NetUid,
    )
  }

  function openSaleWizard() {
    if (!clientNetId || !agreementNetId || !agreement) {
      return
    }

    setWizardPrefill({
      agreement: agreement as unknown as SalesUkraineClientAgreement,
      agreementNetId,
      client,
      clientNetId,
      products: getChosenProducts() as unknown as SalesUkraineProduct[],
    })
  }

  async function handleCreateOffer() {
    return runActionOnce('handleCreateOffer', async () => {
      if (!agreement) {
        return
      }

      const chosen = getChosenProducts()

      if (chosen.length > 0) {
        await createOfferFromSelection(
          agreement as unknown as OfferClientAgreement,
          chosen,
          Number(offerValidDays) || undefined,
        )
      }
    })
  }

  async function handleExcludeProduct(product: RecommendationProduct, index: number) {
    return runActionOnce('exclude:' + getProductKey(product, index), async () => {
      if (!canExcludeProduct || !clientNetId || !(product.Id ?? 0)) {
        return
      }

      const key = getProductKey(product, index)

      try {
        await sendRecommendationFeedback(clientNetId, [product.Id as number])
        dispatch({ key, type: 'removeProduct' })
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
    <Stack className="client-recommendations" gap="sm" pos="relative">
      <Card className="app-section-card client-recommendations-card" withBorder radius="md" padding="md">
        <Stack gap="sm">
          <Group className="client-recommendations-toolbar" justify="space-between" align="center" wrap="wrap" gap="xs">
            <Group align="center" gap="xs" wrap="nowrap">
              <Text className="client-section-title" fw={600} size="sm">
                {t('Рекомендації')}
                {selectedProduct?.VendorCode ? ` - ${selectedProduct.VendorCode}` : ''}
              </Text>
              <AiFeatureBadge size="sm" tooltip={t('AI-рекомендації для клієнта')} />
            </Group>

            <Group className="client-recommendations-actions" gap="xs" align="end">
              {canCreateSale && (
                <Tooltip disabled={!createSaleDisabledReason} label={createSaleDisabledReason} withArrow>
                  <span>
                    <Button
                      color={CREATE_ACTION_COLOR}
                      disabled={createSaleDisabled}
                      leftSection={<ShoppingCart size={16} />}
                      size="sm"
                      variant="filled"
                      onClick={openSaleWizard}
                    >
                      {selectedCount > 0 ? `${t('Створити продаж')} (${selectedCount})` : t('Створити продаж')}
                    </Button>
                  </span>
                </Tooltip>
              )}
              {canCreateSale && (
                <Group gap={6} wrap="wrap" align="end">
                  <Tooltip disabled={!createSaleDisabledReason} label={createSaleDisabledReason} withArrow>
                    <span>
                      <Button
                        disabled={createSaleDisabled}
                        leftSection={<LinkIcon size={16} />}
                        loading={isCreatingOffer}
                        size="sm"
                        variant="default"
                        onClick={handleCreateOffer}
                      >
                        {selectedCount > 0 ? `${t('Створити пропозицію')} (${selectedCount})` : t('Створити пропозицію')}
                      </Button>
                    </span>
                  </Tooltip>
                  <Tooltip label={t('Термін дії пропозиції')} withArrow>
                    <Select
                      className="client-recommendations-term"
                      label={t('Термін пропозиції')}
                      allowDeselect={false}
                      data={[
                        { value: '1', label: `1 ${t('дн')}` },
                        { value: '2', label: `2 ${t('дн')}` },
                        { value: '7', label: `7 ${t('дн')}` },
                        { value: '14', label: `14 ${t('дн')}` },
                      ]}
                      size="sm"
                      value={offerValidDays}
                      onChange={(value) => setOfferValidDays(value ?? '2')}
                    />
                  </Tooltip>
                </Group>
              )}

            </Group>
          </Group>

          {error && (
            <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
              {error}
            </Alert>
          )}

          {isLoading ? (
            <Group role="status" gap="xs" py="md"><Loader size="sm" color="orange" /><Text size="sm" c="dimmed">{t('Завантаження рекомендацій')}</Text></Group>
          ) : !error && (
            <Stack gap="md">
              {selectedProduct && (
                <SelectedProductCard
                  product={selectedProduct}
                  onPreview={() => dispatch({ product: selectedProduct, type: 'previewProduct' })}
                />
              )}
              <RecommendationsList
                isVatSale={isVatSale}
                products={products}
                selectable={canCreateSale}
                selectedKeys={selectedKeys}
                onExclude={canExcludeProduct ? handleExcludeProduct : undefined}
                onPreview={(product) => dispatch({ product, type: 'previewProduct' })}
                onToggleSelect={toggleSelected}
              />
            </Stack>
          )}
        </Stack>
      </Card>

      <ProductImagePreviewModal product={previewProduct} onClose={() => dispatch({ product: null, type: 'previewProduct' })} />

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
    </Stack>
  )
}
