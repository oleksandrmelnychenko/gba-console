import { matrixRequest, originalMatrixDefinition, type MatrixCapability, type MatrixResult } from '../data/originalVparivanie'
export function matrixCapability(): MatrixCapability {
  return { Version: 1, World: 'fenix', SourceId: originalMatrixDefinition.source, SchemaId: originalMatrixDefinition.schema,
    DefinitionSha256: originalMatrixDefinition.hash, Executable: true, PeriodPolicy: 'InclusiveCalendarWholeSecondsSingleMonth',
    GroupPolicy: 'ExactSourceLeafProductGroup', MaximumProductRows: 128, MaximumColumns: 262, QuantityEncoding: 'InvariantDecimalString',
    RequiresCompleteNormalInputs: true, SourceParityVerified: false, OriginalFullTaskAccepted: false }
}
export const matrixWire = () => matrixRequest(matrixCapability(), '2025-04-01', '2025-04-23', 3569, 'A'.repeat(32))
export function matrixFixture(): MatrixResult {
  return { ...matrixWire(), GroupCaption: 'Наша група', Available: true, Code: 'original_vparivanie_current_our', NormalInputsComplete: true,
    OurSnapshotVerified: true, InputWitnessSha256: 'a'.repeat(64), PeriodPolicy: 'InclusiveCalendarWholeSecondsSingleMonth',
    QuantityEncoding: 'InvariantDecimalString', SourceParityVerified: false, OriginalFullTaskAccepted: false,
    Columns: [{ Group: 'Stock', Caption: 'Остатки', RegionCode: null, MeasureCaption: null },
      { Group: 'Stock', Caption: 'Остатки', RegionCode: '', MeasureCaption: 'Результат' },
      { Group: 'Sales', Caption: 'Продажи', RegionCode: null, MeasureCaption: null },
      { Group: 'Sales', Caption: 'Продажи', RegionCode: '', MeasureCaption: 'Результат' }],
    Rows: [{ ProductReference: 'B'.repeat(32), Caption: 'Однакова назва', Values: ['0', '0', null, null] },
      { ProductReference: 'C'.repeat(32), Caption: 'Однакова назва', Values: [null, null, '-9007199254740993.125', '-9007199254740993.125'] }] }
}
