import { Badge, Stack, Text } from '@mantine/core'
import { ChevronDown, CircleAlert, ShieldCheck } from 'lucide-react'
import type { ProcurementCostContext, ProcurementCostProvenance } from '../procurementCostTypes'
import type { ReorderSuggestion } from '../procurementTypes'
import { formatUnitCost } from '../procurementMoneyFormat'
import { TableChip } from '../../../shared/ui/TableChip'
import './procurement-cost-snapshot.css'

const coverageLabels = { complete: 'Повне покриття', partial: 'Неповне покриття', unknown: 'Вартість не підтверджено',
  no_observations: 'Немає спостережень', buyer_supplied: 'Ручна оцінка' }
const exclusions: Record<string, string> = {
  no_observations: 'Немає спостережень закупівель', incomplete_observation_coverage: 'Частину спостережень не підтверджено',
  mixed_current_units: 'Різні поточні одиниці виміру', cost_float_precision_unsupported: 'Точність ціни не підтримується',
  verified_cost_unavailable: 'Немає підтвердженої ціни', line_amount_precision_unsupported: 'Точність суми рядка не підтримується',
  buyer_tax_basis_unverified: 'Податковий склад ручної оцінки не підтверджено', no_positive_suggested_quantity: 'Немає додатної рекомендованої кількості',
}

export function ProcurementCostBadge({ proof }: { proof: ProcurementCostProvenance }) {
  return <Badge size="xs" color={proof.budget_eligible ? 'teal' : 'orange'} variant="light"
    title={proof.budget_eligible ? 'Доступно для автоматичного бюджету' : proof.budget_exclusion_reasons.map(reason => exclusions[reason] ?? reason).join('; ')}>
    {coverageLabels[proof.coverage]}
  </Badge>
}

export function ProcurementCostProof({ item, compact = false }: { item: ReorderSuggestion; compact?: boolean }) {
  const proof = item.cost_provenance
  if (compact) return <Stack component="section" aria-label="Джерело оцінки закупівлі" gap={6}>
    <div><TableChip value={coverageLabels[proof.coverage]} tone={proof.budget_eligible ? 'success' : 'warning'} /></div>
    <Text size="xs">{proof.source === 'buyer_supplied'
      ? 'Ручна оцінка закупівельника; склад податків не підтверджено.'
      : 'Історична оцінка надходжень без ПДВ, доставки та мита; не поточна ціна постачальника.'}</Text>
    {proof.coverage === 'partial' ? <Text size="xs">Відомо лише частину вартості. Повну суму не підтверджено.</Text> : null}
    {proof.coverage === 'unknown' || proof.coverage === 'no_observations'
      ? <Text size="xs">Підтвердженої ціни немає.</Text> : null}
    {!proof.budget_eligible ? <Text size="xs">Цю оцінку не включено до автоматичного бюджету.</Text> : null}
    <Text size="xs">Маржа та очікуваний прибуток не розраховані: склад податків у ціні продажу не підтверджено.</Text>
    {item.cheaper_alt ? <Text size="xs">Дешевше в історії: {formatUnitCost(item.cheaper_alt.cost_eur)} <TableChip value="EUR" tone="source" />. {coverageLabels[item.cheaper_alt.cost_provenance.coverage]}. Це минулі надходження, а не поточна пропозиція.</Text> : null}
  </Stack>
  const historical = proof.source === 'receipt_history'
  const BudgetIcon = proof.budget_eligible ? ShieldCheck : CircleAlert

  return <section className="procure-cost-proof" aria-label="Джерело оцінки закупівлі">
    <div className="procure-cost-proof__header">
      <h4>Джерело оцінки закупівлі</h4>
      <ProcurementCostBadge proof={proof} />
    </div>
    <p className="procure-cost-proof__source">{historical ? 'Історична собівартість за надходженнями' : 'Ручне значення закупівельника'}</p>
    <p className="procure-cost-proof__caption">{historical ? 'Медіана вартості товару без ПДВ, доставки й митних витрат.' : 'Податковий склад ручної оцінки не підтверджено.'}</p>
    <dl className="procure-cost-proof__metrics">
      <div>
        <dt>Оцінка за одиницю, EUR</dt>
        <dd>{item.unit_cost_eur === null ? '—' : formatUnitCost(item.unit_cost_eur)}</dd>
      </div>
      {historical && <>
        <div><dt>Підтверджено спостережень</dt><dd>{proof.known_count.toLocaleString('uk-UA')} <small>із {proof.observation_count.toLocaleString('uk-UA')}</small></dd></div>
        <div><dt>Невідомих</dt><dd>{proof.unknown_count.toLocaleString('uk-UA')}</dd></div>
      </>}
    </dl>
    <div className={`procure-cost-proof__budget${proof.budget_eligible ? ' is-eligible' : ''}`}>
      <BudgetIcon size={15} aria-hidden="true" />
      <p>{proof.budget_eligible ? <>Доступно для автоматичного бюджету.{item.unit_cost_eur === 0 ? ' Підтверджена нульова ціна збережена як 0.' : ''}</>
        : <>Виключено з автоматичного бюджету: {proof.budget_exclusion_reasons.map(reason => exclusions[reason] ?? reason).join('; ')}.</>}</p>
    </div>
    {proof.coverage === 'partial' && <p className="procure-cost-proof__warning">Показана медіана описує лише підтверджену частину спостережень; повну вартість не засвідчено.</p>}
    <p className="procure-cost-proof__caption">Історична оцінка не визначає майбутній платіж. Маржа, ROI й очікуваний прибуток недоступні.</p>
    {item.cheaper_alt && <p className="procure-cost-proof__alternative">Історичне порівняння з постачальником [{item.cheaper_alt.producer_id}]: <strong>{formatUnitCost(item.cheaper_alt.cost_eur)} EUR</strong>; {coverageLabels[item.cheaper_alt.cost_provenance.coverage].toLowerCase()}. Це спостереження надходжень, а не поточна пропозиція постачальника.</p>}
    <details className="procure-cost-proof__details">
      <summary>Деталі підтвердження вартості <ChevronDown size={14} aria-hidden="true" /></summary>
      <div className="procure-cost-proof__detail-body">
        <p>{historical
          ? 'Медіана спостережень проведених надходжень: вартість товару без ПДВ, доставки й митних витрат. Це історична оцінка собівартості.'
          : 'Ручне значення закупівельника. Податковий склад не підтверджено; автоматичний бюджет його не використовує.'}</p>
        <p>Оцінка не визначає майбутній платіж або чинну ціну за договором. Чернетка замовлення використовує власні договірні умови.</p>
        <p>Історична ціна продажу має непідтверджений податковий склад. Маржа, ROI й очікуваний прибуток недоступні.</p>
        <dl className="procure-cost-proof__references">
          <div><dt>Канонічне значення, EUR</dt><dd>{proof.canonical_unit_cost_eur ?? 'невідоме'}</dd></div>
          {historical && <>
            <div><dt>Одиниці виміру, ID</dt><dd>{proof.current_unit_ids.length ? proof.current_unit_ids.join(', ') : 'не підтверджено'}</dd></div>
            <div><dt>Договори постачальників, ID</dt><dd>{proof.supplier_client_agreement_ids.length ? proof.supplier_client_agreement_ids.join(', ') : 'не підтверджено'}</dd></div>
          </>}
          {proof.component_refs.map(ref => <div key={ref}><dt>Компонент знімка</dt><dd>{ref}</dd></div>)}
          {proof.reason_counts.map(reason => <div key={reason.reason}><dt>{exclusions[reason.reason] ?? reason.reason}</dt><dd>{reason.count.toLocaleString('uk-UA')}</dd></div>)}
        </dl>
      </div>
    </details>
  </section>
}

export function ProcurementCostSnapshot({ context, compact = false }: { context: ProcurementCostContext; compact?: boolean }) {
  if (compact) return <Stack component="section" className="procurement-cost-notice" aria-label="Стан джерела вартості" gap={6}>
    <div><TableChip value={context.cost_totals_certified ? 'Вартість підтверджена' : 'Оцінка неповна'} tone={context.cost_totals_certified ? 'success' : 'warning'} /></div>
    <Text size="xs">{context.cost_totals_certified
      ? 'Історична вартість товарів без ПДВ, доставки та мита.'
      : context.cost_total_basis === 'includes_buyer_values_with_unverified_tax_basis'
        ? 'Є ручні оцінки з непідтвердженим складом податків. Загальну вартість не підтверджено.'
        : 'Відомі історичні оцінки — без ПДВ, доставки та мита. Невідомі суми залишаються невизначеними.'}</Text>
  </Stack>
  const manifest = context.cost_observation_manifest
  const certified = context.cost_totals_certified
  const manual = context.cost_total_basis === 'includes_buyer_values_with_unverified_tax_basis'
  const StatusIcon = certified ? ShieldCheck : CircleAlert
  const description = certified
      ? 'Вартість підтверджена для всіх позицій: товар без ПДВ, доставки та митних витрат.'
      : manual
        ? 'Оцінка містить ручні значення з непідтвердженим податковим складом. Загальну суму не засвідчено як вартість товару без податків.'
        : 'Відомі оцінки показано окремо; невідомі значення залишаються порожніми.'

  return <section className={`procure-cost-snapshot${certified ? ' is-certified' : ''}`} aria-label="Стан джерела вартості">
    <details className="procure-cost-snapshot__details">
      <summary className="procure-cost-snapshot__summary">
        <StatusIcon className="procure-cost-snapshot__icon" size={18} aria-hidden="true" />
        <span className="procure-cost-snapshot__status">
          <strong>{certified ? 'Вартість підтверджена' : manual ? 'Ручні оцінки вартості' : 'Неповне покриття вартості'}</strong>
          <span>{description}</span>
        </span>
        <span className="procure-cost-snapshot__toggle">
          Деталі даних <span className="procure-cost-snapshot__count">{manifest.components.length}</span>
          <ChevronDown size={15} aria-hidden="true" />
        </span>
      </summary>
      <div className="procure-cost-snapshot__body">
        <div className="procure-cost-snapshot__notes">
          <p>{manifest.snapshot_relationship === 'separate_snapshots' ? 'Дані з кількох окремих знімків. Єдиний одночасний стан не підтверджено.'
            : manifest.snapshot_relationship === 'single_snapshot' ? 'Дані з одного знімка спостережень закупівель.' : 'Спостережень закупівель немає.'}</p>
          <p>Історичне вікно описує попит. Запаси, резерви та спостереження закупівель мають окремий поточний стан.</p>
        </div>
        {manifest.components.length > 0 && <>
          <div className="procure-cost-snapshot__table-scroll" tabIndex={0} role="region" aria-label="Знімки спостережень закупівель">
            <table className="app-static-table procure-cost-snapshot__table">
              <thead><tr>
                <th scope="col">Знімок</th>
                <th scope="col" className="app-table-cell-number">Товарів</th>
                <th scope="col">Період спостережень</th>
                <th scope="col">Зчитано, UTC</th>
                <th scope="col" className="app-table-cell-number">Підтверджених публікацій</th>
              </tr></thead>
              <tbody>{manifest.components.map(component => <tr key={component.component_id}>
                <td><code title={component.component_id}>{component.component_id.slice(0, 12)}…</code></td>
                <td className="app-table-cell-number">{component.product_ids.length.toLocaleString('uk-UA')}</td>
                <td className="procure-cost-snapshot__period">{snapshotDate(component.effective_start_date)} — {snapshotDate(component.as_of_exclusive)}<span>кінцева дата не включена</span></td>
                <td title={`Час читання UTC: ${component.observation_started_at_utc} — ${component.observation_completed_at_utc}`}>
                  <span className="procure-cost-snapshot__time">{snapshotTimestamp(component.observation_started_at_utc)} — {snapshotTimestamp(component.observation_completed_at_utc)}</span>
                </td>
                <td className="app-table-cell-number">{component.publications.length.toLocaleString('uk-UA')}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <p className="procure-cost-snapshot__hint">Повний ідентифікатор і точний час доступні при наведенні на відповідну клітинку.</p>
        </>}
      </div>
    </details>
  </section>
}

function snapshotDate(value: string) {
  return value.slice(0, 10).split('-').reverse().join('.')
}

function snapshotTimestamp(value: string) {
  // Keep the recorded UTC date and time; do not apply the browser's time zone.
  return `${snapshotDate(value)} ${value.slice(11, 19)}`
}
