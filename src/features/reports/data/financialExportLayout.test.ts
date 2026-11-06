import { expect, it } from 'vitest'
import { financialDataset } from './financialAxes.test-fixtures'
import { financialExportLayoutQuery, financialExportLayoutText, supportsFinancialExportLayout } from './financialExportLayout'
import type { ReportDataset } from '../types'

it('enables explicit workbook layouts for native price comparison without granting other reports financial axes', () => {
  expect(supportsFinancialExportLayout({ DataSource: 46 } as ReportDataset)).toBe(true)
  expect(supportsFinancialExportLayout(financialDataset)).toBe(true)
  expect(supportsFinancialExportLayout({ DataSource: 45 } as ReportDataset)).toBe(false)
  expect(supportsFinancialExportLayout(undefined)).toBe(false)
})

it('explains automatic narrow tables and wide region sections with a bounded fallback', () => {
  expect(financialExportLayoutText(13, 'auto', 46)).toBe('Вузький звіт — одна таблиця. Широкий: до 100 регіонів у колонках — кожен регіон окремим аркушем, більше — одна таблиця.')
  expect(financialExportLayoutText(13, 'sheets', 46)).toContain('кожен регіон')
  expect(financialExportLayoutText(14, 'table', 46)).toContain('кожен код регіону')
  expect(financialExportLayoutText(10, 'sheets', 46)).not.toContain('день')
  expect(financialExportLayoutText(15, 'auto', 35)).toBe('До 100 договорів у колонках — кожен договір окремим аркушем, більше — одна таблиця.')
  expect(financialExportLayoutQuery('auto')).toBeUndefined()
  expect(financialExportLayoutQuery('table')).toBe('table')
  expect(financialExportLayoutQuery('sheets')).toBe('sheets')
})
