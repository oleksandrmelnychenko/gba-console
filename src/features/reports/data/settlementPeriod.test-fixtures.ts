import type { ReportDataset } from '../types'
import { SETTLEMENT_PERIOD_MEASURES, SETTLEMENT_PERIOD_ROWS, SETTLEMENT_PERIOD_TITLE,
  type SettlementPeriodAgreement, type SettlementPeriodScope } from './settlementPeriod'
import { defaultDatasetRequest } from './reportDatasets'

export const settlementPeriodDataset: ReportDataset = {
  DataSource: 41, Name: SETTLEMENT_PERIOD_TITLE, Description: 'Один точний договір',
  PeriodRequired: true, PeriodSupported: true,
  Groupings: SETTLEMENT_PERIOD_ROWS.map(Type => ({ Type, Name: `Рядок ${Type}` })),
  Measurements: SETTLEMENT_PERIOD_MEASURES.map(Type => ({ Type, Name: `Показник ${Type}` })),
  Filters: [],
  settlementPeriod: { Version: 1, MaximumDays: 31, CurrencyBasis: 'SettlementCurrency',
    PeriodCalendar: 'Europe/Kyiv', RequiresAgreementNetUid: true,
    RequiresOneCompleteClosingDayGeneration: true, ManagementCurrencySupported: false,
    CurrentDaySupported: false, AllCounterpartiesSupported: false, NonDocumentAgreementsSupported: false,
    SourceWorlds: ['Fenix', 'Amg'], NativeFamilies: ['ClientAgreement', 'SupplyOrganizationAgreement'],
    FixedRowGroupings: [...SETTLEMENT_PERIOD_ROWS], FixedMeasurements: [...SETTLEMENT_PERIOD_MEASURES] },
  Limitations: ['Потрібне повне покриття завершального дня'],
}

export const settlementPeriodAgreement: SettlementPeriodAgreement = {
  SourceWorld: 'Fenix', NativeFamily: 'ClientAgreement', AgreementId: '9223372036854775807',
  AgreementNetUid: '12345678-1234-1234-1234-1234567890ab',
  AgreementName: 'Synthetic agreement', CounterpartyName: 'Synthetic counterparty',
  CurrencyName: 'Synthetic currency', CurrencyCode: '978', OrganizationName: 'Synthetic organization',
}
export const settlementPeriodScope: SettlementPeriodScope = {
  Version: 1, SourceWorld: settlementPeriodAgreement.SourceWorld, NativeFamily: settlementPeriodAgreement.NativeFamily,
  AgreementId: settlementPeriodAgreement.AgreementId, AgreementNetUid: settlementPeriodAgreement.AgreementNetUid,
  CurrencyBasis: 'SettlementCurrency',
}
export function settlementPeriodRequest() {
  return { ...defaultDatasetRequest(settlementPeriodDataset, '2026-09-01', '2026-09-12'), settlementPeriod: settlementPeriodScope }
}
