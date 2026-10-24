import { Button, Group, Loader, ScrollArea, SegmentedControl, Text } from '@mantine/core'
import { ArrowLeftRight, ReceiptText, Truck, Warehouse } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { TableChip } from '../../../../shared/ui/TableChip'
import { DocumentDetailSection } from '../../../../shared/ui/document-detail/DocumentDetail'
import type { WizardDetailChip, WizardDetailRow } from './wizardProductDetailModel'

const qtyFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 })

export function ProductAvailabilitySection({
  chips, rows, selectedChipIndex, selectedRowIndex, isFullDetail, isLoadingDetails,
  detailsError, showRowDetails, measureUnit, onSelectChip, onRetryDetails,
}: {
  chips: WizardDetailChip[]
  rows: WizardDetailRow[]
  selectedChipIndex: number | null
  selectedRowIndex: number | null
  isFullDetail: boolean
  isLoadingDetails: boolean
  detailsError?: string | null
  showRowDetails: boolean
  measureUnit: string
  onSelectChip?: (index: number) => void
  onRetryDetails?: () => void
}) {
  const { t } = useI18n()
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
  )
}

function AvailabilityIcon({ chipKey }: { chipKey: string }) {
  const Icon = chipKey === 'InAccount' ? ReceiptText
    : chipKey === 'AvailableQtyUkReSale' ? ArrowLeftRight
      : chipKey === 'OnWayToPl' || chipKey === 'OnWayToUkr' ? Truck
        : Warehouse
  return <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
}

function getDetailRowKey(row: WizardDetailRow): string {
  return row.key || [row.regionCode, row.name, row.analyst, row.amount].filter((value) => value !== undefined && value !== '').join('|')
}

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}
