import { Alert, Center, Loader } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppBottomSheet } from '../../../shared/ui/AppBottomSheet'
import { TableChip } from '../../../shared/ui/TableChip'
import type { CollectionWithTotals } from '../types'
import { formatAmount, formatDate, formatMoney } from '../utils'
import './product-remains-statistics-sheet.css'

type RemainsTotals = Omit<CollectionWithTotals<unknown>, 'Collection'>

type ProductRemainsStatisticsSheetProps = {
  opened: boolean
  onClose: () => void
  totals: RemainsTotals | null
  kind: 'batches' | 'products'
  dateFrom: string
  dateTo: string
  isLoading: boolean
  error: string | null
}

export function ProductRemainsStatisticsSheet({
  opened, onClose, totals, kind, dateFrom, dateTo, isLoading, error,
}: ProductRemainsStatisticsSheetProps) {
  const { t } = useI18n()
  const sections = totals ? [
    {
      id: 'all',
      title: t('Усі залишки'),
      qty: totals.TotalQty,
      amounts: [
        { currency: 'EUR', amount: totals.TotalAmount, accounting: totals.AccountingTotalAmount },
        { currency: 'UAH', amount: totals.TotalAmountLocal, accounting: totals.AccountingTotalAmountLocal },
      ],
    },
    {
      id: 'period',
      title: t('За вибраний період'),
      qty: totals.TotalQtyFiltered,
      amounts: [
        { currency: 'EUR', amount: totals.TotalAmountFiltered, accounting: totals.AccountingTotalAmountFiltered },
        // Preserve the products view's unavailable local-currency period total.
        { currency: 'UAH', amount: kind === 'batches' ? totals.TotalAmountLocalFiltered : undefined, accounting: totals.AccountingTotalAmountLocalFiltered },
      ],
    },
  ] : []

  return (
    <AppBottomSheet
      opened={opened}
      onClose={onClose}
      title={<span className="product-remains-statistics__title">{t('Статистика залишків')} <TableChip value={kind === 'batches' ? t('Партії') : t('Товари')} /></span>}
      closeLabel={t('Закрити статистику')}
      collapseLabel={t('Згорнути статистику')}
      expandLabel={t('Розгорнути статистику')}
      mediumHeightRatio={0.5}
      contentClassName="product-remains-statistics-sheet"
      bodyClassName="product-remains-statistics"
    >
      {isLoading ? (
        <Center mih={140} role="status" aria-label={t('Завантаження статистики')}><Loader size="sm" /></Center>
      ) : error ? (
        <Alert color="red">{error}</Alert>
      ) : !totals ? (
        <p>{t('Даних немає')}</p>
      ) : (
        <div className="product-remains-statistics__grid">
          {sections.map((section) => (
            <section key={section.id} className="product-remains-statistics__section" aria-labelledby={`remains-statistics-${section.id}`}>
              <div className="product-remains-statistics__heading">
                <div>
                  <h3 id={`remains-statistics-${section.id}`} className="app-section-title">{section.title}</h3>
                  {section.id === 'period' && (
                    <div className="product-remains-statistics__period">{formatDate(dateFrom)} — {formatDate(dateTo)}</div>
                  )}
                </div>
                <span className="product-remains-statistics__quantity">
                  {t('Кількість')} <TableChip value={formatAmount(section.qty)} />
                </span>
              </div>
              <table className="product-remains-statistics__table" aria-label={section.title}>
                <thead><tr><th>{t('Валюта')}</th><th>{t('Сума')}</th><th>{t('Бухгалтерська')}</th></tr></thead>
                <tbody>
                  {section.amounts.map((row) => (
                    <tr key={row.currency}>
                      <th scope="row"><TableChip tone="source" value={row.currency} /></th>
                      <td>{formatMoney(row.amount)}</td>
                      <td>{formatMoney(row.accounting)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </AppBottomSheet>
  )
}
