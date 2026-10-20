import { ActionIcon, Button, Group, Loader, ScrollArea, SegmentedControl, Text, TextInput } from '@mantine/core'
import { ArrowLeftRight, Check, Pencil, ReceiptText, Truck, Warehouse } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { formatLocalDate } from '../../../../shared/date/dateTime'
import { useI18n } from '../../../../shared/i18n/useI18n'
import type { WizardCalculatedProductPricing, WizardNearestSupplyOrder } from './newSaleWizardApi'
import { ProductSummaryCard } from './ProductSummaryCard'
import { WizardAiPriceHint } from './WizardAiPriceHint'
import { TableChip } from '../../../../shared/ui/TableChip'
import { DocumentDetailLayout, DocumentDetailSection } from '../../../../shared/ui/document-detail/DocumentDetail'
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
  currentPriceEur,
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
  currentPriceEur?: number | null
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
  const measureUnit = product.MeasureUnit?.Name || t('шт')
  const discountRate = pricing?.DiscountRate ?? null
  const legacyLines = buildLegacyPriceLines(product, isVatSale, localCurrencyCode, displayQty ?? 0)
  const stockCurrencies = [...new Set(['EUR', localCurrencyCode, ...legacyLines.flatMap((line) => line.uahPrice != null ? ['UAH'] : [])])]


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
      <DocumentDetailLayout summary={null}>
        {showSummary && <ProductSummaryCard variant="detail" currentPriceEur={currentPriceEur} displayQty={displayQty} localCurrencyCode={localCurrencyCode} pricing={pricing} product={product} onOpenImage={onOpenImage} />}
        <div className="new-sale-product-detail__columns">
          <DocumentDetailSection title={t('Наявність і ціни')} stacked>
            {isFullDetail && (
              <div className="new-sale-product-detail__table-scroll">
                <table className="app-static-table" aria-label={t('Наявність і ціни')}>
                  <thead><tr>
                    <th scope="col">{t('Джерело')}</th>
                    <th scope="col" className="app-table-cell-number">{t('К-сть')}</th>
                    {stockCurrencies.map((currency) => <th key={currency} scope="col" className="app-table-cell-number"><TableChip tone="source" value={currency} /></th>)}
                  </tr></thead>
                  <tbody>{legacyLines.map((line) => (
                    <tr key={line.key}>
                      <th scope="row">{t(line.label)}</th>
                      <td className="app-table-cell-number">{qtyFormatter.format(line.qty)} <TableChip value={measureUnit} /></td>
                      {stockCurrencies.map((currency) => <td key={currency} className="app-table-cell-number">{formatPrice(getLegacyCurrencyPrice(line, currency))}</td>)}
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            {(discountRate != null || nearestSupplyOrder) && (
              <Group gap={16} className="new-sale-product-detail__extra">
                {discountRate != null && <Group gap={6}><Text size="xs">{t('Знижка')}</Text><TableChip tone="document" value={priceFormatter.format(discountRate) + '%'} /></Group>}
                {nearestSupplyOrder && <Group gap={6}>
                  <Text size="xs">{t('Найближча партія')}</Text>
                  <TableChip tone="document" value={nearestSupplyOrder.OrderArrivedDate ? formatLocalDate(new Date(nearestSupplyOrder.OrderArrivedDate)) : '—'} />
                  <span className="app-money">{qtyFormatter.format(nearestSupplyOrder.Qty ?? 0)}</span><TableChip value={measureUnit} />
                </Group>}
              </Group>
            )}
          </DocumentDetailSection>

          <DocumentDetailSection stacked
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
          </DocumentDetailSection>
        </div>

        <DocumentDetailSection title={t('Наявність')} stacked>
          <div className="new-sale-product-detail__availability-section">
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
                      <AvailabilityIcon chipKey={chip.key} />
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
            <div role="region" aria-label={t('Деталі залишків')} className="new-sale-product-detail__stock">
              {rows.length > 0 ? (
                <ScrollArea.Autosize mah={240} type="auto">
                  <table className="app-static-table" aria-label={t('Деталі залишків')}>
                    <thead><tr><th scope="col">{t('Розташування')}</th><th scope="col" className="app-table-cell-number">{t('К-сть')}</th></tr></thead>
                    <tbody>{rows.map((row, index) => (
                      <tr key={getDetailRowKey(row)} className={cx('new-sale-product-detail__stock-row', index === selectedRowIndex && 'is-selected')}>
                        <td>
                          <Group gap={8}>
                            <TableChip tone="storage" value={row.name} />
                            {showRowDetails && row.regionCode && <TableChip value={row.regionCode} />}
                            {showRowDetails && row.analyst && <Text size="xs">{row.analyst}</Text>}
                          </Group>
                        </td>
                        <td className="app-table-cell-number">{qtyFormatter.format(row.amount)} <TableChip value={measureUnit} /></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </ScrollArea.Autosize>
              ) : (
                <p className="new-sale-product-detail__empty">{t('Немає деталізації')}</p>
              )}
            </div>
          )}
        </DocumentDetailSection>

      <WizardAiPriceHint
        clientAgreementNetId={clientAgreementNetId}
        productNetId={product.NetUid}
        withVat={isVatSale}
      />
      </DocumentDetailLayout>
    </section>
  )
}

function AvailabilityIcon({ chipKey }: { chipKey: string }) {
  const Icon = chipKey === 'InAccount' ? ReceiptText
    : chipKey === 'AvailableQtyUkReSale' ? ArrowLeftRight
      : chipKey === 'OnWayToPl' || chipKey === 'OnWayToUkr' ? Truck
        : Warehouse
  return <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
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

function getLegacyCurrencyPrice(line: LegacyPriceLine, currency: string): number | null | undefined {
  if (currency === line.localCurrency && line.localPrice != null) return line.localPrice
  if (currency === 'EUR') return line.eurPrice
  if (currency === 'UAH') return line.uahPrice
  return null
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
