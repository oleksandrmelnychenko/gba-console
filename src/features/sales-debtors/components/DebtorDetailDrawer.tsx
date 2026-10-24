import { getOrganizationDisplayName } from '../../../shared/organizations/organizationDisplayName'
import { Alert, Skeleton } from '@mantine/core'
import { CircleAlert } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { TableChip } from '../../../shared/ui/TableChip'
import { getDebtorDebtTotal, getDebtorGroupedDebts } from '../api/salesDebtorsApi'
import { DebtAgingInfo } from './DebtAgingInfo'
import { getKnownAgingDays, getKnownOverdueEuro, getGroupedDebtAging } from '../model/debtorAging'
import {
  EURO_CURRENCY_CODE,
  formatDebtAmount,
  hasCreditBalance,
  getDebtorEuroAmount,
  getStructureCurrencyTotals,
  toFiniteNumber,
} from '../model/debtorCurrency'
import type { ClientInDebt, DebtorDebtItem, DebtorDebtTotal } from '../types'
import './debtor-detail-drawer.css'

const moneyFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })

export function DebtorDetailDrawer({ debtor, onClose }: {
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
              <DebtAgingInfo aging={debtor.Aging} currencies={debtor.CurrencyDebts} />
              {(debtor.RegionCode || debtor.UserName) ? (
                <div className="debtor-detail__meta">
                  {debtor.RegionCode ? <TableChip tone="document" value={debtor.RegionCode} /> : null}
                  {debtor.UserName ? <TableChip tone="warning" value={debtor.UserName} /> : null}
                </div>
              ) : null}
            </div>
            <div className="debtor-detail__metrics">
              <DetailMetric label={t('Борг, EUR')} unit={EURO_CURRENCY_CODE} value={getDebtorEuroAmount(debtor, 'RemainderDebt')} />
              <DetailMetric
                danger={(getDebtorEuroAmount(debtor, 'OverdueDebt') ?? 0) > 0}
                label={t(debtor.Aging !== undefined ? 'Відоме прострочення, EUR' : 'Прострочено, EUR')}
                unit={EURO_CURRENCY_CODE}
                value={getDebtorEuroAmount(debtor, 'OverdueDebt')}
              />
              {hasCreditBalance(debtor) ? <DetailMetric label={t('Кредитовий залишок, EUR')} unit={EURO_CURRENCY_CODE} value={debtor.CreditBalanceEuro} /> : null}
              <DetailMetric danger={debtor.Aging !== undefined ? (getKnownAgingDays(debtor.Aging) ?? 0) > 0 : (debtor.MissedDays ?? 0) < 0} integer label={t(debtor.Aging !== undefined ? 'Макс. відоме прострочення, днів' : 'Термін, днів')} value={debtor.Aging !== undefined ? getKnownAgingDays(debtor.Aging) : debtor.MissedDays} />
            </div>
          </section>

          <DetailSection note={includesSubClients(debtor, total) ? t('Разом із субклієнтами') : undefined} title={t('Загальна заборгованість')}>
            {isLoading ? <Skeleton height={58} radius="sm" /> : error ? null : <DebtTotals total={total} />}
          </DetailSection>

          <DetailSection count={isLoading ? undefined : items.length} title={t('Борг за валютами')}>
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

function DetailSection({ children, count, note, title }: { children: ReactNode; count?: number; note?: string; title: string }) {
  return (
    <section className="debtor-detail__section">
      <div className="debtor-detail__section-head">
        <h3>{title}</h3>
        {count !== undefined ? <TableChip value={count} /> : null}
        {note ? <TableChip tone="neutral" value={note} /> : null}
      </div>
      {children}
    </section>
  )
}

function DetailMetric({ danger, euro, integer, label, unit, value }: {
  danger?: boolean; euro?: number | null; integer?: boolean; label: string; unit?: string; value?: number | null
}) {
  const { t } = useI18n()
  return (
    <div className={`debtor-detail__metric${danger ? ' is-danger' : ''}`}>
      <span className="debtor-detail__label">{label}</span>
      <div className="debtor-detail__number"><strong>{formatDebtAmount(value, integer ? String : moneyFormatter.format, t('Не визначено'))}</strong>{unit ? <TableChip tone="source" value={unit} /> : null}</div>
      {euro !== undefined ? <MoneyWithCurrency className="is-secondary" currencyCode={EURO_CURRENCY_CODE} value={euro} /> : null}
    </div>
  )
}

function DebtTotals({ total }: { total: DebtorDebtTotal | null }) {
  const { t } = useI18n()
  const currencies = getStructureCurrencyTotals(total)

  return (
    <div className="debtor-detail__totals">
      {currencies.map((item) => (
        <DetailMetric
          key={item.CurrencyCode || 'local'}
          euro={item.CurrencyCode !== EURO_CURRENCY_CODE ? item.TotalInEuro : undefined}
          label={item.CurrencyCode ? `${t('Борг')} ${item.CurrencyCode}` : t('Інші валюти')}
          unit={item.CurrencyCode || undefined}
          value={toFiniteNumber(item.Total)}
        />
      ))}
      {currencies.filter(hasCreditBalance).map((item) => (
        <DetailMetric
          key={`credit-${item.CurrencyCode || 'local'}`}
          euro={item.CurrencyCode !== EURO_CURRENCY_CODE ? item.CreditBalanceEuro : undefined}
          label={`${t('Кредитовий залишок')} ${item.CurrencyCode || ''}`.trim()}
          unit={item.CurrencyCode || undefined}
          value={item.CreditBalance}
        />
      ))}
      {total && hasCreditBalance(total) ? <DetailMetric label={t('Кредитовий залишок, EUR')} unit={EURO_CURRENCY_CODE} value={total.CreditBalanceEuro} /> : null}
      {total?.TotalInEuro !== undefined ? (
        <>
          <DetailMetric label={t('Разом, EUR')} unit={EURO_CURRENCY_CODE} value={total.TotalInEuro} />
          <DetailMetric
            danger={(getKnownOverdueEuro(total, total.OverdueInEuro) ?? 0) > 0}
            label={t(total.Aging !== undefined ? 'Відоме прострочення, EUR' : 'Прострочено, EUR')}
            unit={EURO_CURRENCY_CODE}
            value={getKnownOverdueEuro(total, total.OverdueInEuro)}
          />
        </>
      ) : null}
      <DebtAgingInfo aging={total?.Aging} currencies={currencies} />
    </div>
  )
}

function MoneyWithCurrency({ className, currencyCode, value }: { className?: string; currencyCode?: string; value?: number | null }) {
  const { t } = useI18n()
  return (
    <div className={`debtor-detail__number${className ? ` ${className}` : ''}`}>
      <strong>{formatDebtAmount(value, moneyFormatter.format, t('Не визначено'))}</strong>
      {currencyCode ? <TableChip tone="source" value={currencyCode} /> : null}
    </div>
  )
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return <div className="debtor-detail__row"><span className="debtor-detail__label">{label}</span><div>{children}</div></div>
}

function DebtCard({ item }: { item: DebtorDebtItem }) {
  const { t } = useI18n()
  const debt = item.Debt
  const agreement = displayValue(item.Agreement?.Name || item.Agreement?.Number)
  const organization = getOrganizationDisplayName(item.Agreement?.Organization)
  const currencyCode = displayValue(item.Agreement?.Currency?.Code)
  const aging = getGroupedDebtAging(debt)

  return (
    <article className="debtor-detail__debt">
      <div className="debtor-detail__debt-head">
        {currencyCode ? <TableChip tone="source" value={currencyCode} /> : <TableChip value={t('Без валюти')} />}
        <DebtAgingBadge aging={aging} />
      </div>
      <div className="debtor-detail__debt-grid">
        <DetailRow label={t('Сума боргу')}><MoneyWithCurrency currencyCode={currencyCode} value={debt?.Total} /></DetailRow>
        <DetailRow label={t('Сума, EUR')}><MoneyWithCurrency currencyCode={EURO_CURRENCY_CODE} value={debt?.EuroTotal} /></DetailRow>
        <DetailRow label={t(aging.canonical ? 'Відоме прострочення' : 'Прострочено')}>
          <div className={aging.knownOverdue ? 'debtor-detail__overdue' : undefined}>
            <MoneyWithCurrency currencyCode={currencyCode} value={aging.overdueTotal} />
            {currencyCode !== EURO_CURRENCY_CODE ? (
              <MoneyWithCurrency className="is-secondary" currencyCode={EURO_CURRENCY_CODE} value={aging.overdueEuro} />
            ) : null}
          </div>
        </DetailRow>
        {debt && hasCreditBalance(debt) ? (
          <DetailRow label={t('Кредитовий залишок')}>
            <MoneyWithCurrency currencyCode={currencyCode} value={debt.CreditBalance} />
            {currencyCode !== EURO_CURRENCY_CODE ? <MoneyWithCurrency className="is-secondary" currencyCode={EURO_CURRENCY_CODE} value={debt.CreditBalanceEuro} /> : null}
          </DetailRow>
        ) : null}
        <DetailRow label={t(aging.canonical ? 'Макс. відоме прострочення, днів' : 'Днів прострочки')}><TableChip value={aging.days === null ? t('Не визначено') : aging.days} /></DetailRow>
        {organization ? <DetailRow label={t('Організація')}><TableChip tone="product" value={organization} /></DetailRow> : null}
        {agreement ? <DetailRow label={t('Договір')}><TableChip value={agreement} /></DetailRow> : null}
      </div>
      <DebtAgingInfo aging={debt?.Aging} currencies={[{ CurrencyCode: currencyCode, Aging: debt?.Aging }]} />
    </article>
  )
}

function DebtAgingBadge({ aging }: { aging: ReturnType<typeof getGroupedDebtAging> }) {
  const { t } = useI18n()
  if (aging.knownOverdue) {
    return <TableChip tone="danger" value={`${t(aging.canonical ? 'Відоме прострочення' : 'Прострочено')} ${aging.days ?? t('Не визначено')} ${t('дн.')}`} />
  }
  return <TableChip tone={aging.incomplete ? 'warning' : 'success'} value={t(aging.incomplete ? 'Строки визначено частково' : 'Без прострочки')} />
}

function includesSubClients(debtor: ClientInDebt, total: DebtorDebtTotal | null): boolean {
  const rowEuro = getDebtorEuroAmount(debtor, 'RemainderDebt')
  return typeof total?.TotalInEuro === 'number' && rowEuro !== null &&
    Math.abs(total.TotalInEuro - rowEuro) >= 0.005
}

function displayValue(value?: string | null): string {
  return value?.trim() || ''
}
