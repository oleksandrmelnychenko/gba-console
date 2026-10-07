import { stockAxes, stockDefaultRows, stockDefaults, stockDefinition, stockMeasures, stockRequest, type StockCapability, type StockRequest } from './originalStockAvailability'
import type { StockChoices, StockResult } from './originalStockAvailabilityResponse'
export const stockCapabilityFixture = (): StockCapability => ({ Version: 1, World: 'fenix', SourceId: stockDefinition.source, DefinitionSha256: stockDefinition.definition, ModuleSha256: stockDefinition.module,
  Executable: true, SourceSyncEnabled: false, CurrentInputsComplete: false, SourceParityVerified: false, DatePolicy: 'explicit_plain_DateKon_second_exclusive', Axes: [...stockAxes], DefaultRows: [...stockDefaultRows], DefaultFilters: [...stockDefaultRows], Measures: [...stockMeasures], DefaultMeasures: [...stockDefaults] })
export const stockRequestFixture = () => stockRequest(stockCapabilityFixture(), '2026-10-06 12:34:56', [...stockDefaultRows], [...stockDefaults], [])
export const stockNumberFixture = (value = '10') => ({ Numerator: value, Denominator: '1', Display: `${value}.000` })
export function stockResultFixture(request: StockRequest = stockRequestFixture()): StockResult {
  const choices = Object.fromEntries(stockAxes.map((axis, i) => [axis, i < 2 ? [{ Key: (i === 0 ? 'a' : 'b').repeat(64), Caption: i === 0 ? 'Наш склад' : 'Наш товар' }] : []])) as StockChoices
  return { ...request, Available: true, Code: 'original_stock_availability_current_our', OurSnapshotVerified: true, NormalInputsComplete: true, Choices: choices,
    Data: [{ Key: request.Rows.map(axis => ({ Field: axis, Key: choices[axis][0].Key, Caption: choices[axis][0].Caption })), Values: Object.fromEntries(request.Measures.map(m => [m, stockNumberFixture()])) }] }
}
