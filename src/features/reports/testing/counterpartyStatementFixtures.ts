import { STATEMENT_SOURCE, STATEMENT_DEFINITION, statementDatePolicy, statementMoneyPolicy, type StatementAmounts, type StatementCapability, type StatementResult } from '../data/originalCounterpartyStatement'
export const statementOrg = '00000000000000000000000000000001', statementParty = '00000000000000000000000000000002', statementAgreement = '00000000000000000000000000000003'
export const statementCapability: StatementCapability = { Version: 1, World: 'fenix', SourceId: STATEMENT_SOURCE, DefinitionSha256: STATEMENT_DEFINITION,
  ModuleSha256: '0ca2edd180c0c9a3d398c3f7969a2ba21fa44834e645db63791316fea3c50030', QuerySha256: 'f09d7675ddb6dccc0247d03dba151cfd46f0542917af8fcd50c43ab082072cc1',
  Executable: true, DefaultRows: ['Организация', 'Контрагент', 'ДоговорКонтрагента'], DefaultFilters: ['Организация', 'Контрагент', 'ДоговорКонтрагента'],
  DefaultMeasures: ['СуммаВзаиморасчетов', 'СуммаУпр'].flatMap(r => ['НачальныйОстаток', 'Приход', 'Расход', 'КонечныйОстаток'].map(m => r + m)),
  RequiresCompleteNormalInputs: true, RequiresWorldBoundAgreementByDocuments: true, DatePolicy: statementDatePolicy, MoneyPolicy: statementMoneyPolicy,
  ManagementCurrencyPresentationVerified: false, AppliesFxConversion: false, SourceParityVerified: false, OriginalFullTaskAccepted: false }
export const statementAmounts = (): StatementAmounts => ({ Settlement: { Opening: '10.00', Incoming: '-2.00', Outgoing: '3.00', Closing: '5.00' },
  Management: { Opening: '20.00', Incoming: '4.00', Outgoing: '-1.00', Closing: '25.00' } })
export function statementResponse(): StatementResult {
  return { Version: 1, World: 'fenix', SourceId: STATEMENT_SOURCE, DefinitionSha256: STATEMENT_DEFINITION, From: '2026-09-10', Through: '2026-09-12',
    Organizations: [], Counterparties: [], Agreements: [], Available: true, Code: 'original_counterparty_statement_complete', NormalInputsComplete: true, OurSnapshotVerified: true,
    InputWitnessSha256: 'a'.repeat(64), ResultSha256: 'b'.repeat(64), Rows: [{ Organization: statementOrg, Caption: 'Наша організація', CaptionAvailable: true, Amounts: statementAmounts(),
      Counterparties: [{ Counterparty: statementParty, Caption: 'Наш контрагент', CaptionAvailable: true, Amounts: statementAmounts(),
        Agreements: [{ Agreement: statementAgreement, Caption: 'Наш договір', CaptionAvailable: true, Amounts: statementAmounts() }] }] }], Totals: statementAmounts(),
    OrganizationChoices: [{ Key: statementOrg, Caption: 'Наша організація' }], CounterpartyChoices: [{ Key: statementParty, Caption: 'Наш контрагент' }], AgreementChoices: [{ Key: statementAgreement, Caption: 'Наш договір' }],
    MissingCaptionMappings: [], FilterSummary: ['Організації: усі', 'Контрагенти: усі', 'Договори: усі'], Dependency: null,
    MoneyPolicy: statementMoneyPolicy, DatePolicy: statementDatePolicy, ManagementCurrencyPresentationVerified: false, AppliesFxConversion: false, SourceParityVerified: false, OriginalFullTaskAccepted: false }
}
export function emptyStatement(): StatementResult {
  const r = statementResponse(), zero = { Opening: '0.00', Incoming: '0.00', Outgoing: '0.00', Closing: '0.00' }
  return { ...r, Rows: [], Totals: { Settlement: { ...zero }, Management: { ...zero } }, OrganizationChoices: [], CounterpartyChoices: [], AgreementChoices: [] }
}
export function missingStatement(): StatementResult {
  return { ...emptyStatement(), Available: false, NormalInputsComplete: false, Code: 'original_counterparty_statement_month_publication_unavailable', Totals: null,
    InputWitnessSha256: null, ResultSha256: null, Dependency: { OpeningRegister: 1, MovementRegister: 2, MovementBranch: null, MissingMonth: '2026-09', AgreementKeys: [], MissingAgreementKeyCount: 0, HasMoreAgreementKeys: false } }
}
