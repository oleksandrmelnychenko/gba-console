import type { ReportDataset } from '../types'
import { CASH_PERIOD_ALL_MEASURES, CASH_PERIOD_MEASURES, CASH_PERIOD_ROWS, CASH_PERIOD_TITLE } from './cashPeriod'
import { defaultDatasetRequest } from './reportDatasets'

export const cashPeriodDataset: ReportDataset = {
  DataSource: 40, Name: CASH_PERIOD_TITLE, Description: 'Один валютний запис рахунку',
  PeriodRequired: true, PeriodSupported: true,
  Groupings: CASH_PERIOD_ROWS.map(Type => ({ Type, Name: `Рядок ${Type}` })),
  Measurements: CASH_PERIOD_MEASURES.map(Type => ({ Type, Name: `Показник ${Type}` })),
  Filters: [],
  cashPeriod: { Version: 1, MaximumDays: 31, CurrencyBasis: 'AccountCurrency',
    PeriodCalendar: 'Europe/Kyiv', RequiresCurrencyRegisterNetUid: true,
    RequiresOneCompleteClosingDayGeneration: true, ManagementCurrencySupported: false,
    CurrentDaySupported: false, FixedRowGroupings: [...CASH_PERIOD_ROWS],
    FixedMeasurements: [...CASH_PERIOD_MEASURES] },
  Limitations: ['Потрібне повне покриття завершального дня'],
}

export const cashPeriodLeg = {
  CurrencyRegisterId: '9223372036854775807',
  CurrencyRegisterNetUid: '12345678-1234-1234-1234-1234567890ab',
  AccountName: 'Synthetic account', CurrencyName: 'Synthetic currency',
  CurrencyCode: '978', OrganizationName: 'Synthetic organization',
}

export const cashPeriodScope = {
  Version: 1 as const, CurrencyRegisterId: cashPeriodLeg.CurrencyRegisterId,
  CurrencyRegisterNetUid: cashPeriodLeg.CurrencyRegisterNetUid,
  CurrencyBasis: 'AccountCurrency' as const,
}

export const cashPeriodManagementScope = { ...cashPeriodScope, Version: 2 as const,
  CurrencyBasis: 'AccountAndManagementCurrency' as const }

export const cashPeriodManagementDataset: ReportDataset = { ...cashPeriodDataset,
  Measurements: CASH_PERIOD_ALL_MEASURES.map(Type => ({ Type, Name: `Показник ${Type}` })),
  cashPeriod: { ...(cashPeriodDataset.cashPeriod as Record<string, unknown>), Version: 2,
    CurrencyBasis: 'AccountAndManagementCurrency', ManagementCurrencySupported: true,
    FixedMeasurements: [...CASH_PERIOD_ALL_MEASURES] } }

export function cashPeriodRequest() {
  return { ...defaultDatasetRequest(cashPeriodDataset, '2026-09-01', '2026-09-12'),
    cashPeriod: cashPeriodScope }
}

export function cashPeriodManagementRequest() {
  return { ...defaultDatasetRequest(cashPeriodManagementDataset, '2026-09-01', '2026-09-12'),
    cashPeriod: cashPeriodManagementScope }
}
