import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { normalizeNativeReportPreview } from '../data/nativeReportPreview'
import { productPreview } from '../data/currentProductFields.test-fixtures'
import { ReportInlinePreview } from './ReportInlinePreview'
it('renders current attributes as independent ordered columns, with honest empty values and unchanged unknown money', () => {
  render(<MantineProvider env="test"><ReportInlinePreview preview={normalizeNativeReportPreview({ Preview: productPreview() })} previewReportProfile="sales" /></MantineProvider>)
  const headers = screen.getAllByRole('columnheader').map(node => node.textContent)
  expect(headers.indexOf('Розмір (поточний товар)')).toBeLessThan(headers.indexOf('Артикул (поточний товар)'))
  expect(screen.getByRole('rowheader', { name: 'SEM14631' })).toBeTruthy()
  expect(screen.getByRole('rowheader', { name: '∅' })).toBeTruthy()
  expect(screen.getByRole('cell', { name: '∅' })).toBeTruthy()
  expect(screen.getByText(/Поточні поля товару з довідника/)).toBeTruthy()
  expect(screen.queryByText('b'.repeat(64))).toBeNull()
})
