import type { GeographyMetric, SalesGeographySummary } from './types'

export function geographySummary(metric: GeographyMetric = 'sales'): SalesGeographySummary {
  return {
    Metric: metric, Currency: 'EUR', TimeZone: 'Europe/Kyiv',
    From: metric === 'sales' ? '2025-01-01' : null,
    To: metric === 'sales' ? '2026-10-23' : null,
    AvailableFrom: metric === 'sales' ? '2025-01-01' : null,
    LatestDocumentDate: metric === 'sales' ? '2026-10-22' : null,
    AsOfUtc: '2026-10-23T10:00:00Z',
    AmountBasis: metric === 'sales' ? 'confirmed-invoices-minus-active-returns-with-vat' : 'current-positive-receivables-historical-fx',
    RegionBasis: 'current-client-region', ImportCompletenessConfirmed: false,
    UnresolvedUnit: metric === 'sales' ? 'lines' : 'debts',
    Rows: [
      { RegionCode: 'PA', ValueEur: 1.4, KnownValueEur: 1.4, ClientCount: 2, UnresolvedAmountCount: 0 },
      { RegionCode: 'LV', ValueEur: 1.4, KnownValueEur: 1.4, ClientCount: 1, UnresolvedAmountCount: 0 },
    ],
    TotalEur: 2.8, KnownTotalEur: 2.8, ClientCount: 3, UnresolvedAmountCount: 0,
  }
}
