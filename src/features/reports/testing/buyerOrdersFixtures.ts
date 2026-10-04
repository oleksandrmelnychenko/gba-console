import { BUYER_ORDERS_DEFINITION, BUYER_ORDERS_SOURCE, buyerOrdersMeasures, type BuyerOrdersCapability, type BuyerOrdersGroupValue, type BuyerOrdersMeasure, type BuyerOrdersResult } from '../data/originalBuyerOrders'
export const product = '6'.repeat(32)
export const order: BuyerOrdersGroupValue = { Field: 0, Type: '08', Table: '00000100', Reference: '4'.repeat(32) }
export const productValue: BuyerOrdersGroupValue = { Field: 1, Type: null, Table: null, Reference: product }
export const stored: BuyerOrdersMeasure = { Opening: '9007199254740993.003', Incoming: '1.007', Outgoing: '-3.003', Closing: '9007199254740997.013' }
export const base: BuyerOrdersMeasure = { Opening: '18014398509481986.006', Incoming: '2.014', Outgoing: '-6.006', Closing: '18014398509481994.026' }
export const capability: BuyerOrdersCapability = { Version: 1, World: 'fenix', SourceId: BUYER_ORDERS_SOURCE, DefinitionSha256: BUYER_ORDERS_DEFINITION,
  ModuleSha256: '21b55e41d955357dc0ab1187a04172fdb4283a6bbaa7c94c1e3a1e9b5cc01746', Executable: true, Title: 'Відомість замовлень покупців',
  MaximumInclusiveDays: 366, DefaultRows: [0, 1], FilterFields: [0, 1, 2, 3], DefaultMeasures: buyerOrdersMeasures,
  UnitPolicy: 'ExactStorageCoefficientBeforeAggregation', RequiresReportUnitCoefficient: false, NativeRoundingVerified: false, SourceParityVerified: false, OriginalFullTaskAccepted: false }
export function response(): BuyerOrdersResult { return structuredClone({ Version: 1, World: 'fenix', SourceId: BUYER_ORDERS_SOURCE, DefinitionSha256: BUYER_ORDERS_DEFINITION,
  From: '2026-09-01', Through: '2026-09-30', Available: true, Code: 'original_buyer_orders_OUR_complete', NormalInputsComplete: true, OurSnapshotVerified: true,
  InputWitnessSha256: 'a'.repeat(64), ResultSha256: 'b'.repeat(64), Rows: [{ Key: [order, productValue], Base: base, Stored: stored }], BaseTotals: base, StoredTotals: stored,
  ProductChoices: [{ Key: product, Caption: 'Наш товар' }], FieldChoices: [{ Value: order, Caption: 'Замовлення без назви · 1' }, { Value: productValue, Caption: 'Наш товар' },
    { Value: { Field: 2, Type: null, Table: null, Reference: '5'.repeat(32) }, Caption: 'Статус без назви · 1' },
    { Value: { Field: 3, Type: null, Table: null, Reference: '3'.repeat(32) }, Caption: 'Угода без назви · 1' }],
  MissingProductRoleKeys: [], MissingStorageUnitKeys: [], MissingProductRoleCount: 0, MissingStorageUnitCount: 0, FilterSummary: [],
  UnitPolicy: 'ExactStorageCoefficientBeforeAggregation', NumberPresentation: 'ExactUnroundedDecimalAtLeastThreePlaces', RequiresReportUnitCoefficient: false,
  AppliesFxConversion: false, NativeRoundingVerified: false, SourceParityVerified: false, OriginalFullTaskAccepted: false, OrderCaptionAvailable: false }) as BuyerOrdersResult }
