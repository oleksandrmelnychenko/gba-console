import { Alert, Skeleton } from '@mantine/core'
import { CircleAlert } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { TableChip } from '../../../shared/ui/TableChip'
import { getDebtorDebtTotal, getDebtorGroupedDebts } from '../api/salesDebtorsApi'
import type { ClientInDebt, DebtorDebtItem, DebtorDebtSale, DebtorDebtTotal } from '../types'
import './debtor-detail-drawer.css'

const moneyFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short', timeStyle: 'short' })

export function DebtorDetailDrawer({ currencyCode, debtor, onClose }: {
  currencyCode: string
  debtor: ClientInDebt | null
  onClose: () => void
}) {
  const { t } = useI18n()
  const [items, setItems] = useValueState<DebtorDebtItem[]>([])
  const [total, setTotal] = useValueState<DebtorDebtTotal | null>(null)
  const [isLoading, setLoading] = useValueState(false)
  const [error, setError] = useValueState<string | null>(null)

  useEffect(() => {
    const clientNetId = debtor?.ClientNetId

    if (!clientNetId) {
      setItems([])
      setTotal(null)
      setLoading(false)
      setError(null)

      return
    }

    const controller = new AbortController()
    const debtorClientNetId = clientNetId

    async function loadDetails() {
      setLoading(true)
      setError(null)

      try {
        const [nextItems, nextTotal] = await Promise.all([
          getDebtorGroupedDebts(debtorClientNetId, controller.signal),
          getDebtorDebtTotal(debtorClientNetId, controller.signal),
        ])

        if (controller.signal.aborted) return

        setItems(nextItems)
        setTotal(nextTotal)
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setItems([])
          setTotal(null)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити деталі боржника'))
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadDetails()

    return () => {
      controller.abort()
    }
  }, [debtor?.ClientNetId, setError, setItems, setLoading, setTotal, t])

  return (
    <AppDrawer opened={Boolean(debtor)} padding="md" size="xl" title={t('Деталі боржника')} onClose={onClose}>
      {debtor ? (
        <div className="debtor-detail">
          <section className="debtor-detail__summary">
            <div className="debtor-detail__identity">
              <span className="debtor-detail__label">{t('Клієнт')}</span>
              <div className="debtor-detail__client"><TableChip tone="warning" value={debtor.ClientName} /></div>
              {(debtor.RegionCode || debtor.UserName) ? (
                <div className="debtor-detail__meta">
                  {debtor.RegionCode ? <TableChip tone="document" value={debtor.RegionCode} /> : null}
                  {debtor.UserName ? <TableChip tone="product" value={debtor.UserName} /> : null}
                </div>
              ) : null}
            </div>
            <div className="debtor-detail__metrics">
              <DetailMetric label={t('Залишок')} unit={currencyCode} value={debtor.RemainderDebt} />
              <DetailMetric danger={(debtor.OverdueDebt ?? 0) > 0} label={t('Прострочено')} unit={currencyCode} value={debtor.OverdueDebt} />
              <DetailMetric danger={(debtor.MissedDays ?? 0) < 0} integer label={t('Термін, днів')} value={debtor.MissedDays} />
            </div>
          </section>

          <DetailSection title={t('Загальна заборгованість')}>
            {isLoading ? <Skeleton height={58} radius="sm" /> : error ? null : (
              <div className="debtor-detail__totals">
                <DetailMetric label={t('В євро')} unit="EUR" value={total?.TotalEuro} />
                <DetailMetric label={t('У гривнях')} unit="UAH" value={total?.TotalLocal} />
                <DetailMetric label={t('По структурі')} unit="UAH" value={total?.TotalSubClientDebt} />
              </div>
            )}
          </DetailSection>

          <DetailSection count={isLoading ? undefined : items.length} title={t('Борги по клієнту')}>
            {isLoading ? (
              <div className="debtor-detail__loading" aria-label={t('Завантаження деталей')}><Skeleton height={88} radius="sm" /><Skeleton height={88} radius="sm" /></div>
            ) : error ? (
              <Alert color="red" icon={<CircleAlert size={18} />} variant="light">{error}</Alert>
            ) : items.length === 0 ? (
              <div className="debtor-detail__empty">{t('Боргових документів не знайдено')}</div>
            ) : (
              <div className="debtor-detail__debts">
                {items.map((item, index) => <DebtCard key={item.NetUid || `${item.Id || 'debt'}-${index}`} item={item} />)}
              </div>
            )}
          </DetailSection>
        </div>
      ) : null}
    </AppDrawer>
  )
}

function DetailSection({ children, count, title }: { children: ReactNode; count?: number; title: string }) {
  return (
    <section className="debtor-detail__section">
      <div className="debtor-detail__section-head"><h3>{title}</h3>{count !== undefined ? <TableChip value={count} /> : null}</div>
      {children}
    </section>
  )
}

function DetailMetric({ danger, integer, label, unit, value }: {
  danger?: boolean; integer?: boolean; label: string; unit?: string; value?: number
}) {
  return (
    <div className={`debtor-detail__metric${danger ? ' is-danger' : ''}`}>
      <span className="debtor-detail__label">{label}</span>
      <div className="debtor-detail__number"><strong>{value === undefined ? '—' : integer ? String(value) : moneyFormatter.format(value)}</strong>{unit ? <TableChip tone="source" value={unit} /> : null}</div>
    </div>
  )
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return <div className="debtor-detail__row"><span className="debtor-detail__label">{label}</span><div>{children}</div></div>
}

function DebtCard({ item }: { item: DebtorDebtItem }) {
  const { t } = useI18n()
  const sale = item.Sale || item.ReSale || null
  const documentNumber = getDebtDocumentNumber(item, sale)
  const documentDate = getDebtDocumentDate(item, sale)
  const agreement = getDebtAgreementLabel(item)
  const status = getDebtStatusLabel(sale)
  const currencyCode = displayValue(item.Agreement?.Currency?.Code)
  const amount = item.Debt?.Total ?? sale?.TotalAmount ?? sale?.TotalAmountLocal

  return (
    <article className="debtor-detail__debt">
      <div className="debtor-detail__debt-head">
        <TableChip tone="document" value={documentNumber || t('Без номера')} />
        {documentDate ? <time>{documentDate}</time> : null}
      </div>
      <div className="debtor-detail__debt-grid">
        <DetailRow label={t('Договір')}>{agreement || '—'}</DetailRow>
        <DetailRow label={t('Статус')}>{status ? <TableChip value={status} /> : '—'}</DetailRow>
        <DetailRow label={t('Сума боргу')}><div className="debtor-detail__number"><strong>{amount === undefined ? '—' : moneyFormatter.format(amount)}</strong>{currencyCode ? <TableChip tone="source" value={currencyCode} /> : null}</div></DetailRow>
        <DetailRow label={t('Днів')}><TableChip value={item.Debt?.Days ?? '—'} /></DetailRow>
      </div>
    </article>
  )
}

function displayValue(value?: string | null): string {
  return value?.trim() || ''
}

function formatDateTime(value?: string | null): string {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? '' : dateTimeFormatter.format(date)
}

function getDebtDocumentNumber(item: DebtorDebtItem, sale: DebtorDebtSale | null): string {
  return displayValue(
    sale?.SaleNumber?.Value ||
    sale?.SaleNumber?.Name ||
    sale?.SaleNumber?.Number ||
    sale?.Number ||
    sale?.Name ||
    item.Debt?.Name,
  )
}

function getDebtDocumentDate(item: DebtorDebtItem, sale: DebtorDebtSale | null): string {
  return formatDateTime(sale?.ChangedToInvoice || sale?.Created || item.Created)
}

function getDebtAgreementLabel(item: DebtorDebtItem): string {
  const agreement = item.Agreement
  const organization = agreement?.Organization?.Name
  const agreementName = agreement?.Name || agreement?.Number

  if (organization && agreementName) {
    return `${organization} · ${agreementName}`
  }

  return displayValue(agreementName || organization)
}

function getDebtStatusLabel(sale: DebtorDebtSale | null): string {
  return displayValue(
    sale?.BaseSalePaymentStatus?.Name ||
    sale?.BaseSalePaymentStatus?.Value ||
    sale?.BaseLifeCycleStatus?.Name ||
    sale?.BaseLifeCycleStatus?.Value,
  )
}

