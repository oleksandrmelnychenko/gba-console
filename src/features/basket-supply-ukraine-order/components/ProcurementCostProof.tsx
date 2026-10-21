import { Badge, Stack, Text } from '@mantine/core'
import type { ProcurementCostContext, ProcurementCostProvenance } from '../procurementCostTypes'
import type { ReorderSuggestion } from '../procurementTypes'
import { formatUnitCost } from '../procurementMoneyFormat'
import { TableChip } from '../../../shared/ui/TableChip'

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
  return <Stack component="section" aria-label="Джерело оцінки закупівлі" gap="xs">
    <Text fw={600} size="sm">Джерело оцінки закупівлі</Text>
    <ProcurementCostBadge proof={proof} />
    <Text size="sm">{proof.source === 'buyer_supplied'
      ? 'Ручне значення закупівельника. Податковий склад не підтверджено; автоматичний бюджет його не використовує.'
      : 'Медіана спостережень проведених надходжень: вартість товару без ПДВ, доставки й митних витрат. Це історична оцінка собівартості.'}</Text>
    <Text size="xs" c="dimmed">Оцінка не визначає майбутній платіж або чинну ціну за договором. Чернетка замовлення використовує власні договірні умови.</Text>
    {proof.source === 'receipt_history' ? <>
      <Text size="sm">Підтверджено спостережень: {proof.known_count} із {proof.observation_count}. Невідомих: {proof.unknown_count}.</Text>
      <Text size="xs">Поточні одиниці виміру: {proof.current_unit_ids.length ? proof.current_unit_ids.map(id => `[${id}]`).join(', ') : 'не підтверджено'}.</Text>
      <Text size="xs">Договори постачальників у підтверджених спостереженнях: {proof.supplier_client_agreement_ids.length ? proof.supplier_client_agreement_ids.map(id => `[${id}]`).join(', ') : 'не підтверджено'}.</Text>
    </> : null}
    {proof.budget_eligible ? <Text size="sm">Оцінку дозволено використовувати в автоматичному бюджеті.{item.unit_cost_eur === 0 ? ' Підтверджена нульова ціна збережена як 0.' : ''}</Text>
      : <Text size="sm" c="orange.9">Виключено з автоматичного бюджету: {proof.budget_exclusion_reasons.map(reason => exclusions[reason] ?? reason).join('; ')}.</Text>}
    {proof.coverage === 'partial' ? <Text size="sm">Показана медіана описує лише підтверджену частину спостережень; повну вартість не засвідчено.</Text> : null}
    <Text size="sm">Історична ціна продажу має непідтверджений податковий склад. Маржа, ROI й очікуваний прибуток недоступні.</Text>
    {item.cheaper_alt ? <Text size="sm">Історичне порівняння з постачальником [{item.cheaper_alt.producer_id}]: {formatUnitCost(item.cheaper_alt.cost_eur)} EUR; {coverageLabels[item.cheaper_alt.cost_provenance.coverage].toLowerCase()}. Це спостереження надходжень, а не поточна пропозиція постачальника.</Text> : null}
    <details>
      <summary>Деталі підтвердження вартості</summary>
      <Stack gap={4} mt="xs">
        <Text size="xs">Канонічне значення: {proof.canonical_unit_cost_eur ?? 'невідоме'} EUR.</Text>
        {proof.component_refs.map(ref => <Text key={ref} size="xs" style={{ overflowWrap: 'anywhere' }}>Компонент знімка: {ref}</Text>)}
        {proof.reason_counts.map(reason => <Text key={reason.reason} size="xs">{reason.reason}: {reason.count}</Text>)}
      </Stack>
    </details>
  </Stack>
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
  return <Stack component="section" aria-label="Стан джерела вартості" gap={4}>
    <Text size="sm">{context.cost_totals_certified
      ? 'Вартість підтверджена для всіх позицій: товар без ПДВ, доставки та митних витрат.'
      : context.cost_total_basis === 'includes_buyer_values_with_unverified_tax_basis'
        ? 'Оцінка містить ручні значення з непідтвердженим податковим складом. Загальну суму не засвідчено як вартість товару без податків.'
        : 'Покриття вартості неповне. Відомі оцінки показано окремо; невідомі значення залишаються порожніми.'}</Text>
    <Text size="xs" c="dimmed">Історичне вікно описує попит. Запаси, резерви та спостереження закупівель мають окремий поточний стан.</Text>
    <details>
      <summary>Час і межі спостережень закупівель ({manifest.components.length})</summary>
      <Text size="xs" my="xs">{manifest.snapshot_relationship === 'separate_snapshots' ? 'Кілька окремих знімків; спільного атомарного стану не засвідчено.'
        : manifest.snapshot_relationship === 'single_snapshot' ? 'Один знімок спостережень закупівель.' : 'Порожня область спостережень.'}</Text>
      {manifest.components.map(component => <Stack key={component.component_id} gap={2} mb="sm">
        <Text size="xs" style={{ overflowWrap: 'anywhere' }}>{component.component_id}</Text>
        <Text size="xs">{component.product_ids.length} товарів; від {component.effective_start_date} до {component.as_of_exclusive} (кінцева дата не включена).</Text>
        <Text size="xs">Час читання UTC: {component.observation_started_at_utc} — {component.observation_completed_at_utc}</Text>
        <Text size="xs">Підтверджених публікацій: {component.publications.length}.</Text>
      </Stack>)}
    </details>
  </Stack>
}
