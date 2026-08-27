import { ActionIcon, Button, Group, Loader, ScrollArea, SegmentedControl, Text, TextInput } from '@mantine/core'
import { Check, Pencil } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { formatLocalDate } from '../../../../shared/date/dateTime'
import { useI18n } from '../../../../shared/i18n/useI18n'
import type { WizardCalculatedProductPricing, WizardNearestSupplyOrder } from './newSaleWizardApi'
import { ProductSummaryCard } from './ProductSummaryCard'
import { WizardAiPriceHint } from './WizardAiPriceHint'
import { buildWizardProductPriceRows } from './wizardProductPricing'
import './product-full-detail-panel.css'
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
  clientAgreementNetId,
  descriptionDraft,
  detailsError,
  isFullDetail,
  isEditingDescription,
  isLoadingDetails = false,
  isVatSale,
  localCurrencyCode = 'UAH',
  nearestSupplyOrder,
  pricing,
  product,
  rows,
  selectedChipIndex,
  selectedRowIndex,
  showSummary = true,
  showRowDetails,
  displayQty,
  onDescriptionDraftChange,
  onOpenImage,
  onRetryDetails,
  onSelectChip,
  onToggleDescription,
}: {
  canEditDescription: boolean
  chips: WizardDetailChip[]
  clientAgreementNetId?: string | null
  descriptionDraft: string
  detailsError?: string | null
  isFullDetail: boolean
  isEditingDescription: boolean
  isLoadingDetails?: boolean
  isVatSale: boolean
  localCurrencyCode?: string
  nearestSupplyOrder?: WizardNearestSupplyOrder | null
  pricing: WizardCalculatedProductPricing | null
  product: WizardSaleProduct
  rows: WizardDetailRow[]
  selectedChipIndex: number | null
  selectedRowIndex: number | null
  showSummary?: boolean
  showRowDetails: boolean
  displayQty?: number
  onDescriptionDraftChange: (value: string) => void
  onOpenImage?: () => void
  onRetryDetails?: () => void
  onSelectChip?: (index: number) => void
  onToggleDescription: () => void
}) {
  const { t } = useI18n()
  // The draft is local so typing re-renders only this panel; the parent step
  // tracks the value through onDescriptionDraftChange (a ref write, no render).
  // Re-sync from the incoming draft each time editing (re)starts.
  const [draft, setDraft] = useState(descriptionDraft)
  const wasEditingRef = useRef(isEditingDescription)

  useEffect(() => {
    if (isEditingDescription && !wasEditingRef.current) {
      setDraft(descriptionDraft)
    }

    wasEditingRef.current = isEditingDescription
  }, [descriptionDraft, isEditingDescription])
  const code = product.VendorCode || product.Articul || ''
  const measureUnit = product.MeasureUnit?.Name || t('шт')
  const discountRate = pricing?.DiscountRate ?? null
  const priceRows = buildWizardProductPriceRows({ localCurrency: localCurrencyCode, pricing, product })
  const legacyLines = buildLegacyPriceLines(product, isVatSale, localCurrencyCode, displayQty ?? 0)

  function handleAvailabilityKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target
    if (!onSelectChip || event.ctrlKey || event.altKey || event.metaKey || !(target instanceof HTMLInputElement)) return
    const index = chips.findIndex((chip) => chip.key === target.value)
    if (index < 0) return
    let nextIndex = index
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        nextIndex = (index + 1) % chips.length
        break
      case 'ArrowUp':
      case 'ArrowLeft':
        nextIndex = (index - 1 + chips.length) % chips.length
        break
      case 'Home':
        nextIndex = 0
        break
      case 'End':
        nextIndex = chips.length - 1
        break
      case 'Enter':
      case ' ':
        break
      default:
        return
    }
    event.preventDefault()
    event.stopPropagation()
    onSelectChip(nextIndex)
    event.currentTarget.querySelectorAll<HTMLInputElement>('input[type="radio"]')[nextIndex]?.focus()
  }

  return (
    <section aria-label={t('Детальна інформація про товар')} className="new-sale-product-detail">
      {showSummary && <ProductSummaryCard displayQty={displayQty} localCurrencyCode={localCurrencyCode} pricing={pricing} product={product} onOpenImage={onOpenImage} />}

      <div className="new-sale-product-detail__tree">
        <div className="new-sale-product-detail__tree-head">
          <h3>{t('Деталі товару')}</h3>
          <span>{code}</span>
        </div>
        <div className="new-sale-product-detail__sections">
          <ProductDetailSection title={t('Ціни')}>
            {priceRows.map((row) => (
              <DetailField
                key={row.key}
                label={t(row.label)}
                mono
                value={formatPrice(row.value) + ' ' + row.currency}
              />
            ))}
            {discountRate != null && (
              <DetailField label={t('Знижка')} mono value={priceFormatter.format(discountRate) + '%'} />
            )}
            {isFullDetail && legacyLines.map((line) => (
              <DetailField
                key={line.key}
                label={t(line.label)}
                mono
                value={[
                  qtyFormatter.format(line.qty) + ' ' + measureUnit,
                  ...new Set([
                    line.localPrice != null ? formatPrice(line.localPrice) + ' ' + line.localCurrency : '',
                    line.eurPrice != null ? formatPrice(line.eurPrice) + ' EUR' : '',
                    line.uahPrice != null ? formatPrice(line.uahPrice) + ' UAH' : '',
                  ].filter(Boolean)),
                ].join(' · ')}
              />
            ))}
            {nearestSupplyOrder && (
              <DetailField
                label={t('Найближча партія')}
                mono
                value={[
                  nearestSupplyOrder.OrderArrivedDate ? formatLocalDate(new Date(nearestSupplyOrder.OrderArrivedDate)) : '—',
                  qtyFormatter.format(nearestSupplyOrder.Qty ?? 0) + ' ' + measureUnit,
                ].join(' · ')}
              />
            )}
          </ProductDetailSection>

          <ProductDetailSection
            title={t('Опис')}
            actions={canEditDescription && (
              <ActionIcon
                aria-label={isEditingDescription ? t('Зберегти') : t('Редагувати')}
                color={isEditingDescription ? 'teal' : 'gray'}
                size="sm"
                title={isEditingDescription ? t('Зберегти') : t('Редагувати')}
                variant="subtle"
                onClick={onToggleDescription}
              >
                {isEditingDescription ? <Check size={15} /> : <Pencil size={15} />}
              </ActionIcon>
            )}
          >
            {isEditingDescription ? (
              <TextInput
                aria-label={t('Опис')}
                autoFocus
                size="xs"
                value={draft}
                onChange={(event) => {
                  const value = event.currentTarget.value
                  setDraft(value)
                  onDescriptionDraftChange(value)
                }}
              />
            ) : (
              <p className="new-sale-product-detail__description">{product.Description || t('Опис відсутній')}</p>
            )}
          </ProductDetailSection>
        </div>
      </div>

      <section aria-label={t('Наявність')} className="new-sale-product-detail__tree">
        <div className="new-sale-product-detail__tree-head">
          <h3>{t('Наявність')}</h3>
        </div>
        <div className="new-sale-product-detail__sections new-sale-product-detail__availability-sections">
          <div className="new-sale-product-detail__section new-sale-product-detail__availability-section">
            {isLoadingDetails ? (
              <Group aria-live="polite" className="new-sale-product-detail__state" gap={8} role="status">
                <Loader size="xs" />
                <Text c="dimmed" size="xs">{t('Завантаження деталей залишків')}</Text>
              </Group>
            ) : detailsError ? (
              <Group className="new-sale-product-detail__state" gap={8} justify="space-between">
                <Text c="red" role="alert" size="xs">{detailsError}</Text>
                {onRetryDetails && (
                  <Button color="red" size="compact-xs" variant="light" onClick={onRetryDetails}>
                    {t('Повторити')}
                  </Button>
                )}
              </Group>
            ) : (
              <SegmentedControl
                aria-label={t('Тип наявності')}
                className="new-sale-product-detail__availability-toggle"
                color="brand"
                data={chips.map((chip) => ({
                  value: chip.key,
                  label: (
                    <span className="new-sale-product-detail__availability-option">
                      <span>{chip.name}</span>{' '}
                      <strong className="new-sale-product-detail__availability-count">{qtyFormatter.format(chip.count)}</strong>
                    </span>
                  ),
                }))}
                fullWidth
                orientation="horizontal"
                radius="md"
                readOnly={!onSelectChip}
                size="sm"
                value={selectedChipIndex == null ? '' : chips[selectedChipIndex]?.key || ''}
                withItemsBorders={false}
                onChange={(value) => {
                  const index = chips.findIndex((chip) => chip.key === value)
                  if (index >= 0) onSelectChip?.(index)
                }}
                onKeyDown={handleAvailabilityKeyDown}
              />
            )}
          </div>

          {isFullDetail && !isLoadingDetails && !detailsError && (
            <ProductDetailSection title={t('Деталі залишків')}>
              {rows.length > 0 ? (
                <ScrollArea.Autosize mah={130} type="auto">
                  {rows.map((row, index) => (
                    <DetailField
                      key={getDetailRowKey(row)}
                      className={cx('new-sale-product-detail__stock-row', index === selectedRowIndex && 'is-selected')}
                      label={[showRowDetails && row.regionCode, row.name, showRowDetails && row.analyst].filter(Boolean).join(' · ')}
                      mono
                      value={qtyFormatter.format(row.amount)}
                    />
                  ))}
                </ScrollArea.Autosize>
              ) : (
                <p className="new-sale-product-detail__empty">{t('Немає деталізації')}</p>
              )}
            </ProductDetailSection>
          )}
        </div>
      </section>

      <WizardAiPriceHint
        clientAgreementNetId={clientAgreementNetId}
        productNetId={product.NetUid}
        withVat={isVatSale}
      />
    </section>
  )
}

function ProductDetailSection({ actions, children, title }: { actions?: ReactNode; children: ReactNode; title: string }) {
  return (
    <section aria-label={title} className="new-sale-product-detail__section">
      <div className="new-sale-product-detail__section-head">
        <h4>{title}</h4>
        {actions}
      </div>
      <div className="new-sale-product-detail__field-list">{children}</div>
    </section>
  )
}

function DetailField({ className, label, mono, value }: { className?: string; label: string; mono?: boolean; value: string }) {
  return (
    <div className={cx('app-detail-field', mono && 'is-mono', className)}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

type LegacyPriceLine = {
  eurPrice?: number | null
  key: string
  label: string
  localCurrency: string
  localPrice?: number | null
  qty: number
  uahPrice?: number | null
}

function buildLegacyPriceLines(
  product: WizardSaleProduct,
  isVatSale: boolean,
  localCurrencyCode: string,
  displayQty: number,
): LegacyPriceLine[] {
  const storageQty =
    isVatSale
      ? getWizardProductNumber(product.AvailableQtyUkVAT) ?? displayQty
      : getWizardProductNumber(product.AvailableQtyUk) ?? displayQty
  const showNonVatUahConversion = !isVatSale && localCurrencyCode === 'EUR'
  const storageLine: LegacyPriceLine = {
    eurPrice: showNonVatUahConversion ? null : getWizardProductNumber(product.CurrentPrice),
    key: 'storage',
    label: isVatSale ? 'ПДВ склад' : 'Склад',
    localCurrency: localCurrencyCode,
    localPrice: getWizardProductNumber(product.CurrentLocalPrice),
    qty: storageQty,
    uahPrice: showNonVatUahConversion ? getWizardProductNumber(product.CurrentPriceEurToUah) : null,
  }

  if (isVatSale) {
    return [storageLine]
  }

  const resaleQty = getWizardProductNumber(product.AvailableQtyUkReSale)
  const resaleLine: LegacyPriceLine = {
    eurPrice: showNonVatUahConversion ? null : getWizardProductNumber(product.CurrentPriceReSale),
    key: 'resale',
    label: 'Перепродаж',
    localCurrency: localCurrencyCode,
    localPrice: getWizardProductNumber(product.CurrentLocalPriceReSale),
    qty: resaleQty ?? 0,
    uahPrice: showNonVatUahConversion ? getWizardProductNumber(product.CurrentPriceReSaleEurToUah) : null,
  }

  return [storageLine, resaleLine]
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
