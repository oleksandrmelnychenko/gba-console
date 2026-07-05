import { ActionIcon, Box, Group, Image, Paper, ScrollArea, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import {
  IconBarcode,
  IconBox,
  IconCheck,
  IconCurrencyEuro,
  IconInfoCircle,
  IconPencil,
  IconPhoto,
  IconRulerMeasure,
  IconTruckDelivery,
} from '@tabler/icons-react'
import { formatLocalDate } from '../../../../shared/date/dateTime'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { getProductMainImage, getProductShopImageUrl, getRelatedProductRowColor } from '../../../products/utils'
import type { WizardCalculatedProductPricing, WizardNearestSupplyOrder } from './newSaleWizardApi'
import { getWizardProductNumber, type WizardSaleProduct } from './wizardSaleProduct'

const qtyFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 })
const priceFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })

export type WizardDetailChip = {
  count: number
  key: string
  name: string
}

export type WizardDetailRow = {
  amount: number
  analyst?: string
  key?: string
  name: string
  regionCode?: string
}

export function ProductFullDetailPanel({
  canEditDescription,
  chips,
  descriptionDraft,
  isEditingDescription,
  nearestSupplyOrder,
  pricing,
  product,
  rows,
  selectedChipIndex,
  selectedRowIndex,
  showRowDetails,
  displayQty,
  onDescriptionDraftChange,
  onSelectChip,
  onToggleDescription,
}: {
  canEditDescription: boolean
  chips: WizardDetailChip[]
  descriptionDraft: string
  isEditingDescription: boolean
  nearestSupplyOrder?: WizardNearestSupplyOrder | null
  pricing: WizardCalculatedProductPricing | null
  product: WizardSaleProduct
  rows: WizardDetailRow[]
  selectedChipIndex: number | null
  selectedRowIndex: number | null
  showRowDetails: boolean
  displayQty?: number
  onDescriptionDraftChange: (value: string) => void
  onSelectChip?: (index: number) => void
  onToggleDescription: () => void
}) {
  const { t } = useI18n()
  const mainImage = getProductMainImage(product)
  const shopImageUrl = getProductShopImageUrl(product)
  const titleColor = getRelatedProductRowColor(product)
  const code = product.VendorCode || product.Articul || ''
  const productName = product.NameUA || product.Name || t('Без назви')
  const originalNumber = product.MainOriginalNumber || ''
  const size = product.Size || ''
  const top = product.Top || ''
  const headerQty = displayQty ?? 0
  const basePrice = pricing?.PriceEUR || getWizardProductNumber(product.CurrentPrice)
  const salePrice = pricing?.DiscountPriceEUR ?? basePrice
  const retailPrice = pricing?.RetailPriceEUR || null
  const localSalePrice = getWizardProductNumber(product.CurrentPriceEurToUah)
  const localRetailPrice = pricing?.RetailPriceLocal || null
  const discountRate = pricing?.DiscountRate ?? null
  const pricingName = pricing?.Pricing?.Name || ''
  const hasLogistics = Boolean(nearestSupplyOrder)

  return (
    <Paper className="new-sale-product-card">
      <Box className="new-sale-product-card__rail" aria-hidden="true" />

      <Box className="new-sale-product-card__media">
        {mainImage?.ImageUrl ? (
          <Image
            alt={code}
            fallbackSrc={shopImageUrl || undefined}
            fit="contain"
            h="100%"
            src={mainImage.ImageUrl}
            w="100%"
          />
        ) : (
          <Box className="new-sale-product-card__media-empty">
            <IconPhoto size={30} stroke={1.6} />
          </Box>
        )}
      </Box>

      <Box className="new-sale-product-card__main">
        <Group align="flex-start" className="new-sale-product-card__top" justify="space-between" wrap="nowrap">
          <Box className="new-sale-product-card__identity">
            <Group gap={7} wrap="nowrap">
              <span className="new-sale-product-card__code">
                <IconBarcode size={13} />
                {code}
              </span>
              {originalNumber && <span className="new-sale-product-card__pill">{originalNumber}</span>}
              {top && <span className="new-sale-product-card__pill is-soft">{top}</span>}
              {size && (
                <span className="new-sale-product-card__pill is-soft">
                  <IconRulerMeasure size={12} />
                  {size}
                </span>
              )}
            </Group>
            <Text className="new-sale-product-card__title" style={{ color: titleColor }} title={productName}>
              {productName}
            </Text>
          </Box>

          <Group className="new-sale-product-card__money" gap={8} wrap="nowrap">
            <MetricBlock label={t('Доступно')} tone={headerQty > 0 ? 'good' : 'bad'} value={qtyFormatter.format(headerQty)} />
            <MetricBlock label="EUR" tone="strong" value={formatPrice(salePrice)} />
            {localSalePrice != null && <MetricBlock label="UAH" value={formatPrice(localSalePrice)} />}
          </Group>
        </Group>

        <Group align="stretch" className="new-sale-product-card__pricing-row" gap={8} wrap="nowrap">
          <Box className="new-sale-product-card__price-chain">
            <Box className="new-sale-product-card__mini-icon">
              <IconCurrencyEuro size={15} />
            </Box>
            <Box className="new-sale-product-card__price-copy">
              <span>{pricingName || t('Прайс')}</span>
              <strong>{formatPrice(salePrice)} EUR</strong>
            </Box>
            {discountRate != null && <span className="new-sale-product-card__discount">-{priceFormatter.format(discountRate)}%</span>}
            {basePrice != null && basePrice !== salePrice && (
              <span className="new-sale-product-card__muted-price">{formatPrice(basePrice)} EUR</span>
            )}
          </Box>

          {retailPrice != null && (
            <Box className="new-sale-product-card__retail">
              <span>{t('Роздріб')}</span>
              <strong>{formatPrice(retailPrice)} EUR</strong>
              {localRetailPrice != null && <small>{formatPrice(localRetailPrice)} UAH</small>}
            </Box>
          )}

          {hasLogistics && (
            <Box className="new-sale-product-card__next">
              <IconTruckDelivery size={16} />
              <Box>
                <span>{t('Найближча партія')}</span>
                <strong>
                  {nearestSupplyOrder?.OrderArrivedDate ? formatLocalDate(new Date(nearestSupplyOrder.OrderArrivedDate)) : '—'}
                  {' · '}
                  {qtyFormatter.format(nearestSupplyOrder?.Qty ?? 0)} {t('шт')}
                </strong>
              </Box>
            </Box>
          )}
        </Group>

        <Box className="new-sale-product-card__availability">
          {chips.map((chip, index) => {
            const selected = index === selectedChipIndex
            const isEmpty = chip.count <= 0

            return (
              <Box
                key={chip.key}
                className={cx('new-sale-product-card__chip', selected && 'is-selected', isEmpty && 'is-empty')}
                role={onSelectChip ? 'button' : undefined}
                tabIndex={onSelectChip ? 0 : undefined}
                onClick={() => onSelectChip?.(index)}
                onKeyDown={(event) => {
                  if (!onSelectChip || (event.key !== 'Enter' && event.key !== ' ')) {
                    return
                  }

                  event.preventDefault()
                  onSelectChip(index)
                }}
              >
                <span>{chip.name}</span>
                <strong>{qtyFormatter.format(chip.count)}</strong>
              </Box>
            )
          })}
        </Box>

        <Group align="stretch" className="new-sale-product-card__bottom" gap={10} wrap="nowrap">
          <Box className="new-sale-product-card__description">
            <Group gap={6} justify="space-between" wrap="nowrap">
              <span className="new-sale-product-card__section-title">
                <IconInfoCircle size={13} />
                {t('Опис')}
              </span>
              {canEditDescription && (
                <Tooltip label={isEditingDescription ? t('Зберегти') : t('Редагувати')}>
                  <ActionIcon
                    aria-label={isEditingDescription ? t('Зберегти') : t('Редагувати')}
                    color={isEditingDescription ? 'teal' : 'gray'}
                    size="sm"
                    variant="subtle"
                    onClick={onToggleDescription}
                  >
                    {isEditingDescription ? <IconCheck size={15} /> : <IconPencil size={15} />}
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
            {isEditingDescription ? (
              <TextInput
                autoFocus
                className="new-sale-product-card__description-input"
                size="xs"
                value={descriptionDraft}
                onChange={(event) => onDescriptionDraftChange(event.currentTarget.value)}
              />
            ) : (
              <Text className="new-sale-product-card__description-text" lineClamp={2}>
                {product.Description || t('Опис відсутній')}
              </Text>
            )}
          </Box>

          <Box className="new-sale-product-card__rows">
            <Group gap={6} justify="space-between" wrap="nowrap">
              <span className="new-sale-product-card__section-title">
                <IconBox size={13} />
                {t('Деталі')}
              </span>
              <span className="new-sale-product-card__rows-count">{rows.length}</span>
            </Group>

            {rows.length > 0 ? (
              <ScrollArea.Autosize mah={96} type="auto">
                <Stack gap={5}>
                  {rows.map((row, index) => (
                    <Box
                      key={getDetailRowKey(row)}
                      className={cx('new-sale-product-card__row', index === selectedRowIndex && 'is-selected')}
                    >
                      <Group gap={6} style={{ minWidth: 0 }} wrap="nowrap">
                        {showRowDetails && row.regionCode && <span className="new-sale-product-card__region">{row.regionCode}</span>}
                        <Text className="new-sale-product-card__row-name" title={row.name} truncate>
                          {row.name || ''}
                        </Text>
                      </Group>
                      <Group gap={8} wrap="nowrap">
                        {showRowDetails && row.analyst && <span className="new-sale-product-card__analyst">{row.analyst}</span>}
                        <strong>{qtyFormatter.format(row.amount)}</strong>
                      </Group>
                    </Box>
                  ))}
                </Stack>
              </ScrollArea.Autosize>
            ) : (
              <Box className="new-sale-product-card__empty-row">{t('Немає деталізації')}</Box>
            )}
          </Box>
        </Group>
      </Box>
    </Paper>
  )
}

function MetricBlock({ label, tone, value }: { label: string; tone?: 'bad' | 'good' | 'strong'; value: string }) {
  return (
    <Box className={cx('new-sale-product-card__metric', tone && `is-${tone}`)}>
      <strong>{value}</strong>
      <span>{label}</span>
    </Box>
  )
}

function formatPrice(value: number | null | undefined): string {
  return value == null ? '—' : priceFormatter.format(value)
}

function getDetailRowKey(row: WizardDetailRow): string {
  return row.key || [row.regionCode, row.name, row.analyst, row.amount].filter((value) => value !== undefined && value !== '').join('|')
}

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}
