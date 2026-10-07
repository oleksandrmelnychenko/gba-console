import { MONEY_FLOW_DEFINITION, MONEY_FLOW_SOURCE, emptyMoneyFlowSelection, moneyFlowDefinitions, moneyFlowDefaults, moneyFlowFilters, moneyFlowMeasures,
  moneyFlowPolicies, moneyFlowRequestFields, moneyFlowRows, type MoneyFlowCapability, type MoneyFlowChoice, type MoneyFlowRequest, type MoneyFlowResult,
  type MoneyFlowRow, type MoneyFlowValues } from '../data/originalMoneyFlowAnalysis'
export const moneyFlowRef = (n: number) => n.toString(16).toUpperCase().padStart(32, '0')
export const moneyFlowCapability: MoneyFlowCapability = { Version: 1, World: 'fenix', SourceId: MONEY_FLOW_SOURCE, DefinitionSha256: MONEY_FLOW_DEFINITION,
  ...moneyFlowPolicies, ModuleSha256: '74443e310aa9ac05212b811b144b56f23752d9c746e88b358058870bc8e882d8',
  QuerySha256: 'e9ab555188126e6bbd05c3b6ff9c6fc68814c26ab83a6832399ac667b0bcfaef', Executable: true,
  DefaultRows: [...moneyFlowRows], DefaultColumns: [], DefaultMeasures: [...moneyFlowDefaults], Measures: [...moneyFlowMeasures], Filters: [...moneyFlowFilters],
  MeasureDefinitions: moneyFlowDefinitions, MoneyScale: 2, ComparisonOperators: ['Equal', 'InList'], HumanChoicesAvailable: false, SourceSyncEnabled: false, NormalInputsReadinessVerified: false }
const choice = (Key: string, Caption = 'Назва недоступна', CaptionAvailable = false): MoneyFlowChoice => ({ Key, Caption, CaptionAvailable })
const values = (measures: MoneyFlowRequest['Measures'], source: readonly string[]): MoneyFlowValues => Object.fromEntries(measures.map(measure => [measure, source[moneyFlowMeasures.indexOf(measure)]]))
export function moneyFlowResponse(request?: MoneyFlowRequest, named = false): MoneyFlowResult {
  const measures = request?.Measures ?? [...moneyFlowDefaults], first = values(measures, ['12.34', '12.34', '0.00', '50.00', '4.00', '46.00'])
  const second = values(measures, ['-12.34', '0.00', '-12.34', '0.00', '0.33', '-0.33'])
  function organization(n: number, Caption: string, Values: MoneyFlowValues): MoneyFlowRow {
    return { Field: 'Организация', ...choice(moneyFlowRef(n), Caption, true), Values: { ...Values },
      Children: [{ Field: 'СтатьяДвиженияДенежныхСредств', ...choice(moneyFlowRef(5), 'Оплата', true), Values: { ...Values }, Children: [] }] }
  }
  const selectors = emptyMoneyFlowSelection()
  if (request) for (const field of moneyFlowFilters) selectors[field] = [...request[moneyFlowRequestFields[field]]]
  return { Version: 1, World: 'fenix', SourceId: MONEY_FLOW_SOURCE, DefinitionSha256: MONEY_FLOW_DEFINITION, ...moneyFlowPolicies,
    From: request?.From ?? '2026-09-10', Through: request?.Through ?? '2026-09-12', Selectors: selectors, Measures: [...measures], Available: true,
    Code: 'original_money_flow_analysis_available', NormalInputsComplete: true, OurSnapshotVerified: true, InputWitnessSha256: 'a'.repeat(64), ResultSha256: 'b'.repeat(64),
    Rows: [organization(1, 'Перша організація', first), organization(2, 'Друга організація', second)],
    Totals: values(measures, ['0.00', '12.34', '-12.34', '50.00', '4.33', '45.67']),
    Choices: { Организация: [choice(moneyFlowRef(1), 'Перша організація', true), choice(moneyFlowRef(2), 'Друга організація', true)],
      Подразделение: [choice(moneyFlowRef(3), named ? 'Наш підрозділ' : undefined, named)], Проект: [choice(moneyFlowRef(4), named ? 'Наш проєкт' : undefined, named)] },
    MissingCaptionMappings: named ? [] : ['Подразделение', 'Проект'], ManagementCurrency: { Reference: moneyFlowRef(10), Code: '980', Marked: '01' }, Dependency: null }
}
export function emptyMoneyFlow(request?: MoneyFlowRequest, named = false): MoneyFlowResult {
  const value = moneyFlowResponse(request, named)
  return { ...value, Rows: [], Code: 'original_money_flow_analysis_empty', Totals: Object.fromEntries(value.Measures.map(measure => [measure, null])) }
}
export function unavailableMoneyFlow(request?: MoneyFlowRequest): MoneyFlowResult {
  return { ...emptyMoneyFlow(request), Available: false, Code: 'original_money_flow_analysis_normal_month_vector_unavailable', NormalInputsComplete: false, OurSnapshotVerified: false,
    Totals: null, InputWitnessSha256: null, ResultSha256: null, ManagementCurrency: null, Choices: { Организация: [], Подразделение: [], Проект: [] },
    MissingCaptionMappings: [], Dependency: { Kind: 'normal_month_vector_unavailable', MissingMonth: null } }
}
