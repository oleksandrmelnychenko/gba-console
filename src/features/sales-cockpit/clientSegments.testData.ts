import type { CockpitClient, CockpitClientsResponse } from './types'

export function clientFixture(id = 1): CockpitClient {
  return {
    client_id: id, client_net_uid: `00000000-0000-0000-0000-${String(id).padStart(12, '0')}`, name: `Клієнт ${id}`,
    orders_cnt: 3, turnover_eur: 100, overdue_eur: 0, max_days_past_terms: 0, segments: ['reorder_overdue'],
    new_client_basis: null,
    contact_cooldown: { active: false, reason: null, event_id: null, contacted_at: null, next_contact_at: null, next_action: null },
    repeat_evidence: {
      history_start: '2025-01-01', history_complete: false, date_basis: 'source_document_date', reason: 'Повторна покупка очікувалась 21 жовтня.',
      products: [{ product_id: 10, product_net_uid: null, name: 'Фільтр', last_purchase_on: '2026-09-21', last_quantity: 4,
        recent_purchase_dates: ['2026-07-21', '2026-08-21', '2026-09-21'], purchase_count: 3, cycle_days: 30, next_expected_on: '2026-10-21', overdue_days: 1,
        available_qty: 0, availability_status: 'out_of_stock', history_status: 'partial', reason: 'Цикл за трьома покупками.' }],
    },
  }
}

export function clientsPage(overrides: Partial<CockpitClientsResponse> = {}): CockpitClientsResponse {
  return { manager_id: 7, manager_net_uid: '00000000-0000-0000-0000-000000000007', as_of: '2026-10-22',
    count: 1, total: 1, population_count: 1, offset: 0, limit: 50, segment: 'all', search: '',
    segment_counts: { all: 1, reorder_due: 0, reorder_overdue: 1, reactivation: 0, new_client: 0 }, clients: [clientFixture()], ...overrides }
}
