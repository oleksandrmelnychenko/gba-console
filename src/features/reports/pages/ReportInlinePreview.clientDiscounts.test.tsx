import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { MantineProvider } from '@mantine/core'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { normalizeNativeReportPreview } from '../data/nativeReportPreview'
import { clientDiscountsPreview } from '../data/originalClientDiscounts.test-fixtures'
import { ReportInlinePreview } from './ReportInlinePreview'

afterEach(cleanup)
it('renders direct recipient region beside its row and keeps product percentage in one numeric column', () => {
  render(<MantineProvider><I18nProvider><ReportInlinePreview preview={normalizeNativeReportPreview({ Preview: clientDiscountsPreview() })} /></I18nProvider></MantineProvider>)
  const table = screen.getByRole('table')
  expect(within(table).getAllByRole('columnheader').map(header => header.textContent)).toEqual(['Одержувач', 'Код по региону', 'Product / Відсоток'])
  expect(table.contains(within(table).getByRole('rowheader', { name: '01' }))).toBe(true)
  expect(table.contains(within(table).getByRole('cell', { name: '20' }))).toBe(true)
})
it('does not replace a known empty region with NULL or unavailable text', () => {
  const value = clientDiscountsPreview(); value.ClientDiscountRecipientRegions.Rows[0].RegionCode = ''
  render(<MantineProvider><I18nProvider><ReportInlinePreview preview={normalizeNativeReportPreview({ Preview: value })} /></I18nProvider></MantineProvider>)
  const row = within(screen.getByRole('table')).getAllByRole('row')[1]
  expect(within(row).getAllByRole('rowheader')[1].textContent).toBe('')
})
