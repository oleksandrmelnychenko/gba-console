import type {
  StockMovementCapability, StockMovementExport, StockMovementLookupItem, StockMovementQuantity, StockMovementRequest, StockMovementResult, StockMovementRow,
} from '../data/warehouseStockMovement'

export const stockMovementCapability: StockMovementCapability = {
  Version: 1,
  MinimumFrom: '2025-01-01',
  Today: '2026-10-26',
  StockSyncAt: null,
  Levels: ['warehouse', 'product', 'month', 'day', 'registrar'],
  DefaultLevels: ['warehouse', 'product', 'registrar'],
  Measures: ['opening', 'incoming', 'outgoing', 'closing'],
  Comparisons: ['greater', 'greaterOrEqual', 'less', 'lessOrEqual', 'equal', 'notEqual'],
  ArticleMatches: ['equals', 'contains', 'inList'],
  DocumentKinds: [{ Code: 'sale', Name: 'Продаж' }, { Code: 'receipt', Name: 'Прихід від постачальника' }, { Code: 'transfer', Name: 'Переміщення' }],
  MaximumLimit: 1000,
  Notes: ['Кінцевий залишок на сьогодні дорівнює фізичному залишку партій GBA.'],
}

export const stockMovementWarehouses: StockMovementLookupItem[] = [
  { Id: 2968, Name: 'СКЛАД -1', Detail: 'Фенікс' },
  { Id: 2975, Name: 'СКЛАД Н/П', Detail: 'Фенікс' },
]
export const stockMovementOrganizations: StockMovementLookupItem[] = [{ Id: 1, Name: 'Фенікс', Detail: null }]
export const stockMovementProducts: StockMovementLookupItem[] = [{ Id: 38221591, Name: '94000', Detail: 'Фільтр масляний' }]
export const stockMovementGroups: StockMovementLookupItem[] = [{ Id: 7, Name: 'Фільтри', Detail: null }]

const quantity = (Opening: number, Incoming: number, Outgoing: number): StockMovementQuantity =>
  ({ Opening, Incoming, Outgoing, Closing: Opening + Incoming - Outgoing })

const base = (Index: number, Depth: number, Level: StockMovementRow['Level'], Label: string, value: StockMovementQuantity): StockMovementRow => ({
  Index, Depth, Level, Label, StorageId: 2968, ProductId: Level === 'warehouse' ? null : 38221591, Article: Level === 'warehouse' ? null : '94000',
  ProductName: Level === 'warehouse' ? null : 'Фільтр масляний', Period: null, DocumentKind: null, DocumentType: null, DocumentNumber: null,
  DocumentDate: null, Counterparty: null, Organization: null, Source: null, Quantity: value,
})

export const stockMovementRows: StockMovementRow[] = [
  base(0, 0, 'warehouse', 'СКЛАД -1', quantity(-2, 10, 3)),
  base(1, 1, 'product', '94000 — Фільтр масляний', quantity(-2, 10, 3)),
  { ...base(2, 2, 'registrar', 'Прихідна накладна ПН-1 від 03.02.2025 10:00:00', quantity(-2, 10, 0)),
    DocumentKind: 'receipt', DocumentType: 'Прихідна накладна', DocumentNumber: 'ПН-1', DocumentDate: '2025-02-03 10:00:00', Counterparty: 'Постачальник', Source: '1c' },
  { ...base(3, 2, 'registrar', 'Видаткова накладна ВН-7 від 20.10.2026 9:15:00', quantity(8, 0, 3)),
    DocumentKind: 'sale', DocumentType: 'Видаткова накладна', DocumentNumber: 'ВН-7', DocumentDate: '2026-10-20 09:15:00', Counterparty: 'Клієнт', Source: 'gba' },
]

export function stockMovementResult(request: StockMovementRequest, rows: StockMovementRow[] = stockMovementRows, totalRows = rows.length): StockMovementResult {
  const page = rows.slice(request.Offset, request.Offset + request.Limit)
  return {
    Version: 1, From: request.From, To: request.To, Levels: request.Levels, Measures: request.Measures,
    ObservedAt: '2026-10-26 15:04:05', StockSyncAt: null, Totals: quantity(-2, 10, 3), Keys: 1, Registrars: 2,
    TotalRows: Math.max(totalRows, rows.length), Offset: request.Offset, Limit: request.Limit,
    Rows: page.map((row, index) => ({ ...row, Index: request.Offset + index })),
    Notes: ['Рух — складські документи GBA: імпортовані з 1С і створені в GBA, кожен документ один раз, незалежно від часу синхронізації. Резерви в рахунках не є рухом.'],
  }
}

export const stockMovementExport: StockMovementExport = { DocumentURL: '/files/rukh.xlsx?sig=1', FileName: 'rukh-tovaru-2025-01-01-2026-10-26.xlsx', TotalRows: 4 }
