import type { ReportDataset, ReportRequestBody } from '../types'
import { currentVparivanieDataset, currentVparivanieRequest } from './currentVparivanie.test-fixtures'
import type { CurrentVparivanieRegionalResult } from './currentVparivanieRegional'

export const regionalDataset: ReportDataset = { ...currentVparivanieDataset, currentVparivanie: {
  ...currentVparivanieDataset.currentVparivanie as object, CurrentRegionalAvailable: true, CurrentRegionalVersion: 3,
} }
export function regionalRequest(): ReportRequestBody {
  return { ...currentVparivanieRequest(), from: '2026-10-01', to: '2026-10-31' }
}
export function regionalResult(): CurrentVparivanieRegionalResult {
  return { Version: 3, From: '2026-10-01', To: '2026-10-31', StockAnchor: 'CurrentRecordedFree',
    ProductCount: 1, StockFacts: 1, SaleFacts: 2, ReturnFacts: 1, CounterpartyFacts: 3,
    Request: { HasPeriod: true, IsCurrentSnapshot: false, PeriodFrom: '01.10.2026', PeriodTo: '31.10.2026',
      Filters: [{ Field: 'Товар', Condition: 'Дорівнює', Values: ['Товар А'] }], Notes: ['Залишки поточні.'] },
    Rows: [{ ProductId: '9223372036854775807', Article: '000001', Name: 'Товар А', Description: '',
      Group: 'AL-KO', OE: 'OE', Size: 'XL', Top: 'Так', Cells: [
        { Column: 'Stock', RegionCode: null, Quantity: '9007199254740993.00000001', UnitId: '12', FactCount: 1 },
        { Column: 'Sales', RegionCode: null, Quantity: '9.00000001', UnitId: '12', FactCount: 3 },
        { Column: 'CounterpartyTotal', RegionCode: null, Quantity: '9.00000001', UnitId: '12', FactCount: 3 },
        { Column: 'CounterpartyRegionCode', RegionCode: 'RI00100', Quantity: '9.00000001', UnitId: '12', FactCount: 3 },
      ] }] }
}
