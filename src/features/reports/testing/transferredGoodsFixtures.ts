import { TRANSFERRED_GOODS_SOURCE, TRANSFERRED_GOODS_DEFINITION, transferredGoodsMeasures, type TransferredCapability, type TransferredResources, type TransferredResult } from '../data/originalTransferredGoods'
export const product = 'A'.repeat(32)
export const capability: TransferredCapability = { Version: 1, World: 'fenix', SourceId: TRANSFERRED_GOODS_SOURCE, DefinitionSha256: TRANSFERRED_GOODS_DEFINITION,
  ModuleSha256: '0d93fdd553d70b94fdf53d6477dc792c3ddd40b8fea9d9b2a26d13f90a1696e9', QuerySha256: 'a3b945d8ffe18a56468a8c27229a4c9ce8750f93e8cdc4d539f3e0c59747cfe2',
  Executable: true, Title: 'Відомість партій переданих товарів', PeriodRequired: true, MaximumInclusiveDays: 366, RequiresCompleteNormalInputs: true,
  DefaultRows: ['ДокументОприходования', 'Номенклатура'], DefaultFilterFields: ['Номенклатура', 'ДокументОприходования'], DefaultMeasures: transferredGoodsMeasures,
  UnitPolicy: 'NativeStoredQuantityNoCoefficientConversion', MoneyUnitPolicy: 'NativeManagementResourceNoCurrencyIdentityAssumption',
  ManagementCurrencyPresentationVerified: false, AppliesFxConversion: false, ReceiptFilterChoicesSupported: false,
  NativeVirtualTableVerified: false, SourceParityVerified: false, OriginalFullTaskAccepted: false }
export const resources: TransferredResources = { Quantity: { Opening: '9007199254740993.001', Incoming: '0.002', Outgoing: '-0.003', Closing: '9007199254740993.006' },
  Cost: { Opening: '9007199254740993.01', Incoming: '0.02', Outgoing: '-0.03', Closing: '9007199254740993.06' },
  Vat: { Opening: '-10.01', Incoming: '-2.02', Outgoing: '3.03', Closing: '-15.06' } }
export function response(): TransferredResult { return { Version: 1, World: 'fenix', SourceId: TRANSFERRED_GOODS_SOURCE, DefinitionSha256: TRANSFERRED_GOODS_DEFINITION,
  From: '2026-09-01', Through: '2026-09-30', Available: true, Code: 'original_transferred_OUR_complete', NormalInputsComplete: true, OurSnapshotVerified: true,
  InputWitnessSha256: 'a'.repeat(64), ResultSha256: 'b'.repeat(64), Rows: [{ Receipt: { Type: '08', Table: '00000115', Reference: 'C'.repeat(32) },
    Caption: 'Назва документа недоступна', CaptionAvailable: false, Resources: structuredClone(resources),
    Products: [{ Product: product, Caption: 'Наш товар', CaptionAvailable: true, Resources: structuredClone(resources) }] }],
  Totals: structuredClone(resources), ProductChoices: [{ Key: product, Caption: 'Наш товар' }], MissingCaptionMappings: ['Receipt'], FilterSummary: [],
  UnitPolicy: 'NativeStoredQuantityNoCoefficientConversion', MoneyUnitPolicy: 'NativeManagementResourceNoCurrencyIdentityAssumption',
  ManagementCurrencyPresentationVerified: false, AppliesFxConversion: false, ReceiptFilterAvailable: false,
  NativeVirtualTableVerified: false, SourceParityVerified: false, OriginalFullTaskAccepted: false } }
