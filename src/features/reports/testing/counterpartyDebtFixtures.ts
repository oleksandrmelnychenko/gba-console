import { DEBT_SOURCE, DEBT_DEFINITION, debtMoneyPolicy, type DebtCapability, type DebtResult } from '../data/originalCounterpartyDebt'
export const org1 = '00000000000000000000000000000001', org2 = '00000000000000000000000000000002'
export const party1 = '00000000000000000000000000000011', party2 = '00000000000000000000000000000012'
export const debtCapability: DebtCapability = { Version: 1, World: 'fenix', SourceId: DEBT_SOURCE, DefinitionSha256: DEBT_DEFINITION,
  ModuleSha256: '33f194d65ae6ccfec4e51ef071d32c460c8a0e3e71747e2b3422c8454a8de3ba', QuerySha256: '657766f9456936f55b5c517bfc6f50ef6fb6301de9f6929c03738d81e9acd629',
  Executable: true, RequiresCompleteNormalInputs: true, DefaultRows: ['Организация', 'Контрагент'], DefaultFilters: ['Организация', 'Контрагент'],
  DefaultMeasures: ['СуммаУпр'], OptionalMeasures: ['СуммаВзаиморасчетов'], DatePolicy: 'OURBalanceBeforeExplicitWholeSecond', MoneyPolicy: debtMoneyPolicy,
  EffectiveNativeDateAndSwitchVerified: false, ManagementCurrencyPresentationVerified: false, AppliesFxConversion: false, SourceParityVerified: false, OriginalFullTaskAccepted: false }
export function debtResponse(settlement = false): DebtResult {
  const amount1 = { Management: '20.00', Settlement: '10.00' }, amount2 = { Management: '40.00', Settlement: '-6.00' }
  return { Version: 1, World: 'fenix', SourceId: DEBT_SOURCE, DefinitionSha256: DEBT_DEFINITION, AsOf: '2026-09-15T10:20:30', DebtSwitch: 0, IncludeSettlement: settlement,
    Available: true, Code: 'original_counterparty_debt_complete', NormalInputsComplete: true, OurSnapshotVerified: true,
    InputWitnessSha256: 'a'.repeat(64), ResultSha256: 'b'.repeat(64), Rows: [
      { Organization: org1, Caption: 'Наша організація', CaptionAvailable: true, Amounts: amount1, Counterparties: [{ Counterparty: party1, Caption: 'Наш контрагент', CaptionAvailable: true, Amounts: amount1 }] },
      { Organization: org2, Caption: 'Назва організації недоступна', CaptionAvailable: false, Amounts: amount2, Counterparties: [{ Counterparty: party2, Caption: 'Назва контрагента недоступна', CaptionAvailable: false, Amounts: amount2 }] }],
    Totals: { Management: '60.00', Settlement: '4.00' }, OrganizationChoices: [{ Key: org1, Caption: 'Наша організація' }], CounterpartyChoices: [{ Key: party1, Caption: 'Наш контрагент' }],
    MissingCaptionMappings: ['Organization', 'Counterparty'], FilterSummary: ['Організації: усі', 'Контрагенти: усі', 'Вид заборгованості: усі'], Dependency: null,
    DatePolicy: 'OURBalanceBeforeExplicitWholeSecond', MoneyPolicy: debtMoneyPolicy, EffectiveNativeDateAndSwitchVerified: false,
    ManagementCurrencyPresentationVerified: false, AppliesFxConversion: false, SourceParityVerified: false, OriginalFullTaskAccepted: false }
}
export function emptyDebt(): DebtResult { return { ...debtResponse(), Rows: [], Totals: { Management: '0.00', Settlement: '0.00' }, OrganizationChoices: [], CounterpartyChoices: [], MissingCaptionMappings: [] } }
