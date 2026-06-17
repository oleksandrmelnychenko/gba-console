import { ActionIcon, Badge, Box, Group, Image, Paper, ScrollArea, Stack, Text, TextInput } from '@mantine/core'
import { IconArrowRight, IconCheck, IconPencil } from '@tabler/icons-react'
import { formatLocalDate } from '../../../../shared/date/dateTime'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { getProductMainImage, getRelatedProductRowColor } from '../../../products/utils'
import type { WizardCalculatedProductPricing, WizardNearestSupplyOrder } from './newSaleWizardApi'
import { getWizardDisplayQty, type WizardSaleProduct } from './wizardSaleProduct'

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
  name: string
  regionCode?: string
}

export function ProductFullDetailPanel({
  canEditDescription,
  chips,
  descriptionDraft,
  isEditingDescription,
  isVatSale,
  nearestSupplyOrder,
  pricing,
  product,
  rows,
  selectedChipIndex,
  selectedRowIndex,
  showRowDetails,
  onDescriptionDraftChange,
  onToggleDescription,
}: {
  canEditDescription: boolean
  chips: WizardDetailChip[]
  descriptionDraft: string
  isEditingDescription: boolean
  isVatSale: boolean
  nearestSupplyOrder?: WizardNearestSupplyOrder | null
  pricing: WizardCalculatedProductPricing | null
  product: WizardSaleProduct
  rows: WizardDetailRow[]
  selectedChipIndex: number | null
  selectedRowIndex: number | null
  showRowDetails: boolean
  onDescriptionDraftChange: (value: string) => void
  onToggleDescription: () => void
}) {
  const { t } = useI18n()
  const mainImage = getProductMainImage(product)
  const titleColor = getRelatedProductRowColor(product)
  const displayQty = getWizardDisplayQty(product, isVatSale)

  return (
    <Paper p="sm" radius="md" style={{ borderLeft: '3px solid var(--mantine-color-violet-4)' }} withBorder>
      <Stack gap="sm">
        {/* Availability columns spanning the full width (count on top, label below) + image on the right */}
        <Group align="flex-start" gap="md" wrap="nowrap">
          <Stack gap="xs" style={{ flex: 1, minWidth: 0 }}>
            {nearestSupplyOrder && (
              <Paper bg="var(--mantine-color-blue-light)" p={6} radius="sm">
                <Group gap="md" wrap="nowrap">
                  <Text fw={600} size="sm">
                    {nearestSupplyOrder.OrderArrivedDate ? formatLocalDate(new Date(nearestSupplyOrder.OrderArrivedDate)) : '—'}
                  </Text>
                  <Group gap={4} wrap="nowrap">
                    <Text fw={700} size="sm">
                      {qtyFormatter.format(nearestSupplyOrder.Qty ?? 0)}
                    </Text>
                    <Text c="dimmed" size="xs">
                      {t('штук')}
                    </Text>
                  </Group>
                  <Text c="dimmed" size="xs">
                    {t('Найближча партія товару')}
                  </Text>
                </Group>
              </Paper>
            )}

            <Box
              style={{
                border: '1px solid var(--mantine-color-gray-3)',
                borderRadius: 'var(--mantine-radius-sm)',
                display: 'flex',
                overflow: 'hidden',
              }}
            >
              {chips.map((chip, index) => (
                <Box
                  key={chip.key}
                  style={{
                    background: index === selectedChipIndex ? 'var(--mantine-color-violet-light)' : undefined,
                    borderLeft: index === 0 ? undefined : '1px solid var(--mantine-color-gray-3)',
                    flex: 1,
                    minWidth: 0,
                    padding: '6px 4px',
                    textAlign: 'center',
                  }}
                >
                  <Text fw={700} size="md">
                    {qtyFormatter.format(chip.count)}
                  </Text>
                  <Text c="dimmed" tt="uppercase" style={{ fontSize: 10, lineHeight: 1.2 }}>
                    {chip.name}
                  </Text>
                </Box>
              ))}
            </Box>

            {selectedChipIndex !== null && rows.length > 0 && (
              <ScrollArea.Autosize mah={150} type="auto">
                <Stack gap={4}>
                  {rows.map((row, index) => (
                    <Paper
                      key={index}
                      bg={index === selectedRowIndex ? 'var(--mantine-color-blue-light)' : undefined}
                      p={6}
                      radius="sm"
                      withBorder
                    >
                      <Group gap="md" justify="space-between" wrap="nowrap">
                        <Group gap="md" style={{ minWidth: 0 }} wrap="nowrap">
                          {showRowDetails && row.regionCode && (
                            <Badge color="gray" variant="light">
                              {row.regionCode}
                            </Badge>
                          )}
                          <Text size="sm" style={{ minWidth: 0 }} truncate>
                            {row.name}
                          </Text>
                        </Group>
                        <Group gap="md" wrap="nowrap">
                          <Group gap={4} wrap="nowrap">
                            <Text fw={700} size="sm">
                              {qtyFormatter.format(row.amount)}
                            </Text>
                            <Text c="dimmed" size="xs">
                              {t('штук')}
                            </Text>
                          </Group>
                          {showRowDetails && row.analyst && (
                            <Text c="dimmed" size="sm">
                              {row.analyst}
                            </Text>
                          )}
                        </Group>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              </ScrollArea.Autosize>
            )}
          </Stack>

          {mainImage?.ImageUrl && (
            <Image alt={product.VendorCode || ''} fit="contain" h={96} radius="sm" src={mainImage.ImageUrl} w={120} />
          )}
        </Group>

        {/* Description (editable) */}
        <Group align="flex-start" gap="xs" wrap="nowrap">
          <Box style={{ flex: 1, minWidth: 0 }}>
            {isEditingDescription ? (
              <TextInput
                autoFocus
                size="xs"
                value={descriptionDraft}
                onChange={(event) => onDescriptionDraftChange(event.currentTarget.value)}
              />
            ) : (
              <Text c="dimmed" size="sm">
                {product.Description || ''}
              </Text>
            )}
          </Box>
          {canEditDescription && (
            <ActionIcon
              aria-label={isEditingDescription ? t('Зберегти') : t('Редагувати')}
              color={isEditingDescription ? 'teal' : 'gray'}
              size="sm"
              variant="subtle"
              onClick={onToggleDescription}
            >
              {isEditingDescription ? <IconCheck size={15} /> : <IconPencil size={15} />}
            </ActionIcon>
          )}
        </Group>

        {/* Product name + available qty */}
        <Group gap="md" justify="space-between" wrap="nowrap">
          <Text c={titleColor} fw={700} size="sm" style={{ minWidth: 0 }} truncate>
            {product.VendorCode} {product.NameUA || product.Name}
          </Text>
          <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
            <Text fw={700} size="sm">
              {qtyFormatter.format(displayQty)}
            </Text>
            {product.MeasureUnit?.Name && (
              <Text c="dimmed" size="xs">
                {product.MeasureUnit.Name}
              </Text>
            )}
          </Group>
        </Group>

        {/* Top / original number / size */}
        <Group gap="sm" wrap="wrap">
          {product.Top && (
            <Badge color="gray" radius="sm" variant="light">
              {product.Top}
            </Badge>
          )}
          {product.MainOriginalNumber && (
            <Text c="dimmed" size="sm">
              {product.MainOriginalNumber}
            </Text>
          )}
          {product.Size && (
            <Text c="dimmed" size="sm">
              {product.Size}
            </Text>
          )}
        </Group>

        {/* Pricing line: base → discount% → discounted price, then retail */}
        {pricing && (
          <Group gap="lg" justify="space-between" wrap="wrap">
            <Group gap={6} wrap="nowrap">
              {pricing.Pricing?.Name && (
                <Text c={titleColor} fw={700} size="sm">
                  {pricing.Pricing.Name}
                </Text>
              )}
              <Text size="sm">{priceFormatter.format(pricing.PriceEUR ?? 0)}</Text>
              <IconArrowRight size={13} style={{ color: 'var(--mantine-color-dimmed)' }} />
              <Text c="dimmed" size="sm">
                {pricing.DiscountRate ?? 0}%
              </Text>
              <IconArrowRight size={13} style={{ color: 'var(--mantine-color-dimmed)' }} />
              <Text fw={700} size="sm">
                {priceFormatter.format(pricing.DiscountPriceEUR ?? 0)}
              </Text>
            </Group>
            <Group gap={6} wrap="nowrap">
              <Text c="dimmed" size="sm">
                {t('Роздріб')}
              </Text>
              <Text size="sm">EUR: {priceFormatter.format(pricing.RetailPriceEUR ?? 0)}</Text>
              <Text size="sm">
                {t('UAH')}: {priceFormatter.format(pricing.RetailPriceLocal ?? 0)}
              </Text>
            </Group>
          </Group>
        )}
      </Stack>
    </Paper>
  )
}
