import { Alert, Box, Button, Group, Loader, Modal, Stack, Table, Text } from '@mantine/core'
import { CircleAlert, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { getProductCoPurchaseRecommendations } from '../../../clients/api/clientRecommendationsApi'
import { getWizardProductNumber, getWizardSellableQty, type WizardSaleProduct } from './wizardSaleProduct'

const amountFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
const qtyFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 })

// Co-purchase (cross-sell) picker for the sale wizard cart: «з цим зазвичай беруть ще й це».
// The AI service returns ranked product ids; the system endpoint hydrates them with the
// agreement-scoped availability and prices, so the rows here match search-result numbers.
export function WizardCrossSellModal({
  agreementNetId,
  clientNetId,
  excludeNetUids,
  isVatSale,
  localCurrencyCode,
  opened,
  seedProduct,
  useEurToUah,
  onClose,
  onPick,
}: {
  agreementNetId: string | null
  clientNetId: string | null
  excludeNetUids: Set<string>
  isVatSale: boolean
  localCurrencyCode: string
  opened: boolean
  seedProduct: WizardSaleProduct | null
  useEurToUah: boolean
  onClose: () => void
  onPick: (product: WizardSaleProduct) => void
}) {
  const { t } = useI18n()
  const [products, setProducts] = useState<WizardSaleProduct[]>([])
  const [isLoading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!opened || !clientNetId) {
      return
    }

    const controller = new AbortController()
    const loadTimer = window.setTimeout(() => {
      setLoading(true)
      setError(null)

      getProductCoPurchaseRecommendations(seedProduct?.NetUid ?? '', clientNetId, false, {
        clientAgreementNetId: agreementNetId ?? undefined,
        signal: controller.signal,
      })
        .then((items) => {
          if (!controller.signal.aborted) {
            setProducts(items as unknown as WizardSaleProduct[])
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setError(t('Не вдалося завантажити кросс-продажі'))
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false)
          }
        })
    }, 0)

    return () => {
      window.clearTimeout(loadTimer)
      controller.abort()
    }
  }, [opened, clientNetId, agreementNetId, seedProduct?.NetUid, t])

  const visibleProducts = products.filter((product) => !product.NetUid || !excludeNetUids.has(product.NetUid))

  return (
    <Modal
      centered
      opened={opened}
      size="xl"
      title={
        <Group gap={8} wrap="nowrap">
          <Sparkles size={16} />
          <Text fw={600}>
            {seedProduct?.VendorCode
              ? `${t('З цим товаром купують')} · ${seedProduct.VendorCode}`
              : t('Кросс-продажі для клієнта')}
          </Text>
        </Group>
      }
      onClose={onClose}
    >
      {isLoading ? (
        <Group justify="center" py="lg">
          <Loader size="sm" />
          <Text size="sm">{t('Завантаження кросс-продажів…')}</Text>
        </Group>
      ) : error ? (
        <Alert color="orange" icon={<CircleAlert size={18} />} variant="light">
          {error}
        </Alert>
      ) : visibleProducts.length === 0 ? (
        <Text c="dimmed" py="md" ta="center">
          {t('З цим товаром поки нічого разом не купували')}
        </Text>
      ) : (
        <Stack gap={6}>
          <Table highlightOnHover striped verticalSpacing={4} withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('Код')}</Table.Th>
                <Table.Th>{t('Назва')}</Table.Th>
                <Table.Th ta="right">{t('Наявність')}</Table.Th>
                <Table.Th ta="right">{t('Ціна')} EUR</Table.Th>
                <Table.Th ta="right">{t('Ціна')} {localCurrencyCode}</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {visibleProducts.map((product) => {
                const sellable = getWizardSellableQty(product, isVatSale) ?? 0
                const localPrice =
                  (useEurToUah
                    ? getWizardProductNumber(product.CurrentPriceEurToUah)
                    : getWizardProductNumber(product.CurrentLocalPrice)) ?? 0

                return (
                  <Table.Tr key={product.NetUid || product.VendorCode}>
                    <Table.Td>
                      <Text fw={600} size="sm">
                        {product.VendorCode}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Box maw={340}>
                        <Text size="sm" title={product.NameUA || product.Name} truncate>
                          {product.NameUA || product.Name}
                        </Text>
                      </Box>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text c={sellable > 0 ? undefined : 'dimmed'} size="sm">
                        {qtyFormatter.format(sellable)} {product.MeasureUnit?.Name ?? ''}
                      </Text>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text size="sm">{amountFormatter.format(getWizardProductNumber(product.CurrentPrice) ?? 0)}</Text>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text size="sm">{amountFormatter.format(localPrice)}</Text>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Button size="compact-xs" variant="light" onClick={() => onPick(product)}>
                        {t('В кошик')}
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                )
              })}
            </Table.Tbody>
          </Table>
        </Stack>
      )}
    </Modal>
  )
}
