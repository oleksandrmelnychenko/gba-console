import { CASH_MOVEMENTS_DEFINITION, CASH_MOVEMENTS_SOURCE, cashMovementsDefinitions, cashMovementsFilters, cashMovementsMeasures, cashMovementsPolicies,
  cashMovementsRows, emptyCashMovementsSelection, type CashMovementsCapability, type CashMovementsChoice, type CashMovementsResult, type CashMovementsRow, type CashMovementsTotals } from '../data/originalCashMovements'
export const cashRef = (n: number) => n.toString(16).toUpperCase().padStart(32, '0')
export const cashBank = `08:0000000F:${cashRef(1)}`, cashBox = `08:00000038:${cashRef(1)}`, cashParty = `08:00000044:${cashRef(2)}`
export const cashKind1 = cashRef(3), cashKind2 = cashRef(4), cashCurrency = cashRef(5), cashDirection = cashRef(6), cashArticle = cashRef(7)
export const cashMovementsCapability: CashMovementsCapability = { Version: 1, World: 'fenix', SourceId: CASH_MOVEMENTS_SOURCE, DefinitionSha256: CASH_MOVEMENTS_DEFINITION,
  ...cashMovementsPolicies, ModuleSha256: '2ecb0998253f3bf296a7334aae01a0886b9aa8594986d8b0f030282bf8a62ab6',
  UniversalModuleSha256: 'c34895f1904a5af9fb80223ba12ef5dd8c9fc422ff5ed6caee7d73529a531a17', Executable: true,
  DefaultRows: [...cashMovementsRows], DefaultColumns: ['ВидДенежныхСредств'], Filters: [...cashMovementsFilters], DefaultMeasures: [...cashMovementsMeasures],
  Measures: [...cashMovementsMeasures], MeasureDefinitions: cashMovementsDefinitions, MoneyScale: 2, ComparisonOperators: ['Equal', 'InList'] }
const choice = (Key: string, Caption: string): CashMovementsChoice => ({ Key, Caption, CaptionAvailable: true })
function totals(kind: string, amount: string, management: string): CashMovementsTotals {
  const Values = { СуммаОборот: amount, СуммаУпрОборот: management }, absent = { СуммаОборот: null, СуммаУпрОборот: null }
  return { Values, ByMoneyKind: { [cashKind1]: kind === cashKind1 ? { ...Values } : { ...absent }, [cashKind2]: kind === cashKind2 ? { ...Values } : { ...absent } } }
}
function currencyRow(currency: string, name: string, account: string, kind: string, amount: string, management: string): CashMovementsRow {
  const shared = totals(kind, amount, management)
  const article: CashMovementsRow = { Field: 'СтатьяДвиженияДенежныхСредств', ...choice(cashArticle, 'Оплата'), ...structuredClone(shared), Children: [] }
  const accountRow: CashMovementsRow = { Field: 'БанковскийСчетКасса', ...choice(account, account === cashBank ? 'Наш банк' : 'Наша каса'), ...structuredClone(shared), Children: [article] }
  const direction: CashMovementsRow = { Field: 'ПриходРасход', ...choice(cashDirection, 'Прихід'), ...structuredClone(shared), Children: [accountRow] }
  return { Field: 'ВалютаДенежныхСредств', ...choice(currency, name), ...shared, Children: [direction] }
}
export function cashMovementsResponse(): CashMovementsResult {
  const first = currencyRow('NULL', 'Не задано', cashBox, cashKind1, '0.00', '0.00'), second = currencyRow(cashCurrency, 'Валюта джерела', cashBank, cashKind2, '-12.34', '45.67')
  return { Version: 1, World: 'fenix', SourceId: CASH_MOVEMENTS_SOURCE, DefinitionSha256: CASH_MOVEMENTS_DEFINITION, From: '2026-09-10', Through: '2026-09-12',
    Selectors: emptyCashMovementsSelection(), Measures: [...cashMovementsMeasures], Available: true, Code: 'original_cash_movements_available',
    NormalInputsComplete: true, OurSnapshotVerified: true, InputWitnessSha256: 'a'.repeat(64), ResultSha256: 'b'.repeat(64),
    Columns: [choice(cashKind1, 'Готівка'), choice(cashKind2, 'Безготівкові')], Rows: [first, second],
    Totals: { Values: { СуммаОборот: '-12.34', СуммаУпрОборот: '45.67' }, ByMoneyKind: { [cashKind1]: { ...first.Values }, [cashKind2]: { ...second.Values } } },
    Choices: { ВалютаДенежныхСредств: [choice('NULL', 'Не задано'), choice(cashCurrency, 'Валюта джерела')],
      ВидДенежныхСредств: [choice(cashKind1, 'Готівка'), choice(cashKind2, 'Безготівкові')], ПриходРасход: [choice(cashDirection, 'Прихід')],
      Организация: [choice(cashRef(8), 'Організація')], БанковскийСчетКасса: [choice(cashBox, 'Наша каса'), choice(cashBank, 'Наш банк')],
      СтатьяДвиженияДенежныхСредств: [choice(cashArticle, 'Оплата')], Проект: [choice(cashRef(9), 'Проєкт')], Контрагент: [choice(cashParty, 'Наш контрагент')] },
    MissingCaptionMappings: [], ManagementCurrency: { Reference: cashRef(10), Code: '980', Marked: '01' }, Dependency: null,
    ...cashMovementsPolicies, MeasureDefinitions: cashMovementsDefinitions, MixedCurrencyTotalPolicy: 'OriginalArithmeticSumOfStoredResourcesWithoutCommonCurrencyConversion' }
}
export function emptyCashMovements(): CashMovementsResult {
  return { ...cashMovementsResponse(), Rows: [], Columns: [], Code: 'original_cash_movements_empty', Totals: { Values: { СуммаОборот: null, СуммаУпрОборот: null }, ByMoneyKind: {} } }
}
export function unavailableCashMovements(): CashMovementsResult {
  return { ...emptyCashMovements(), Available: false, NormalInputsComplete: false, Code: 'original_cash_movements_month_unavailable', Totals: null,
    InputWitnessSha256: null, ResultSha256: null, ManagementCurrency: null, Choices: Object.fromEntries(cashMovementsFilters.map(field => [field, []])) as CashMovementsResult['Choices'],
    Dependency: { Kind: 'month_unavailable', MissingMonth: '2026-09' } }
}
