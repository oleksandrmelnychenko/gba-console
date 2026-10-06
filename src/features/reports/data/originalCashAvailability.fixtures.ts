import { availabilityDefinition, availabilityFields, availabilityOwnMeasures, availabilityManagementMeasures, availabilityRequest, availabilityGrainFilter, availabilityFilterKey, type AvailabilityCapability, type AvailabilityRequest, type AvailabilityResult } from './originalCashAvailability'
import { availabilityDisplay, type AvailabilityAmounts, type AvailabilityNumber } from './originalCashAvailabilityMoney'
export const availabilityPoint = '2026-10-06T12:34:56'
export function availabilityCapabilityFixture(): AvailabilityCapability {
  return { Version: 1, World: 'fenix', SourceId: availabilityDefinition.source, DefinitionSha256: availabilityDefinition.definition, ModuleSha256: availabilityDefinition.module, Executable: true,
    EndpointPolicy: 'NativeBalanceBeforeExactDateKon_FxLatestAtOrBeforeDateKon', FilterFields: [...availabilityFields], DefaultFilters: [availabilityFields[0], availabilityFields[2], availabilityFields[1]],
    DefaultRowDimensions: [], DefaultColumnDimensions: [], DefaultMeasures: [...availabilityOwnMeasures], ManagementMeasures: [...availabilityManagementMeasures], RequiresFourNormalFamilies: true,
    ManagementCurrencyPolicy: 'OrdinarySourceManagementCurrency_ExactOurMapping', FxPolicy: 'StoredNormalizedCommercialCommonBaseHistory_ManualValuesPreserved', ExportUsesCompletedResult: true,
    NativeVirtualTableVerified: false, SourceParityVerified: false, OriginalFullTaskAccepted: false }
}
export function availabilityNumberFixture(n: string, d = '1'): AvailabilityNumber { return { Numerator: n, Denominator: d, Display: availabilityDisplay(BigInt(n), BigInt(d)) } }
export function availabilityAmountsFixture(management = false): AvailabilityAmounts {
  const values = management ? ['200', '40', '10', '20', '150'] : ['100', '20', '5', '10', '75']
  return { Current: availabilityNumberFixture(values[0]), Writeoff: availabilityNumberFixture(values[1]), Receipts: availabilityNumberFixture(values[2]), Reserve: availabilityNumberFixture(values[3]), Free: availabilityNumberFixture(values[4]) }
}
export function availabilityResultFixture(request: AvailabilityRequest = availabilityRequest(availabilityCapabilityFixture(), availabilityPoint, [], [], false)): AvailabilityResult {
  const grain = { Account: { Type: '08', Table: '0000000F', Reference: 'B'.repeat(32) }, CashKind: 'A'.repeat(32), Organization: 'C'.repeat(32), CurrencyId: 1,
    CurrencyNetUid: '10000000-0000-0000-0000-000000000001', CurrencyCode: 'UAH', CurrencyReference: 'D'.repeat(32) }
  const currency = { CurrencyId: 1, NetUid: grain.CurrencyNetUid, Code: 'UAH', SourceReference: grain.CurrencyReference }, own = availabilityAmountsFixture(), management = availabilityAmountsFixture(true)
  const captions = ['Наша організація', 'Безготівкові', 'Наш рахунок', 'Гривня'], choices = availabilityFields.map((f, i) => ({ Value: availabilityGrainFilter(grain, f), Caption: captions[i], WitnessSha256: 'a'.repeat(64) }))
  const names = new Map(choices.map(v => [availabilityFilterKey(v.Value), v.Caption]))
  return { ...request, Available: true, Code: 'original_cash_availability_OUR_complete', NormalInputsComplete: true, OurSnapshotVerified: true, InputWitnessSha256: 'c'.repeat(64), ResultSha256: 'd'.repeat(64),
    Rows: [{ Grain: grain, Own: own, Management: management, UnavailableInputs: [], RawInputHashes: ['a'.repeat(64)] }], OwnTotals: { Amounts: own, MixedOwnCurrencies: false, Currencies: [currency] },
    ManagementTotals: { Amounts: management, MixedOwnCurrencies: false, Currencies: [currency] }, Table: { Columns: [...request.RowDimensions, ...availabilityOwnMeasures, ...(request.IncludeManagement ? availabilityManagementMeasures : [])],
      Rows: [[...request.RowDimensions.map(f => names.get(availabilityFilterKey(availabilityGrainFilter(grain, f)))!), '100.00', '20.00', '5.00', '10.00', '75.00', ...(request.IncludeManagement ? ['200.00', '40.00', '10.00', '20.00', '150.00'] : [])]] },
    Choices: choices, UnavailableInputs: [], MissingCaptionMappings: [], ManagementCurrencyId: 1, ManagementCurrencySourceReference: currency.SourceReference, CommonBaseCurrencyId: 1, ManagementCurrency: currency,
    FullAccountMappingsComplete: true, UnselectedUnmappedGrains: 0, NativeVirtualTableVerified: false, SourceParityVerified: false, OriginalFullTaskAccepted: false }
}
export function availabilityPartialFixture(request?: AvailabilityRequest): AvailabilityResult {
  const value = availabilityResultFixture(request), amounts = { ...value.Rows[0].Own, Writeoff: null, Free: null }
  return { ...value, Available: false, Code: 'original_cash_availability_inputs_incomplete', NormalInputsComplete: false,
    Rows: [{ ...value.Rows[0], Own: amounts, UnavailableInputs: ['normal_cash_writeoff_incomplete'] }], OwnTotals: { ...value.OwnTotals!, Amounts: amounts },
    Table: { ...value.Table, Rows: [[...value.Table.Rows[0].slice(0, value.RowDimensions.length), '100.00', null, '5.00', '10.00', null, ...(value.IncludeManagement ? ['200.00', '40.00', '10.00', '20.00', '150.00'] : [])]] },
    UnavailableInputs: ['normal_cash_writeoff_incomplete'] }
}
