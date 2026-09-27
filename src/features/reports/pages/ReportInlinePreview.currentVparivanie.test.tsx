import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import { normalizeNativeReportPreview } from '../data/nativeReportPreview'
import { currentVparivaniePreview } from '../data/currentVparivanie.test-fixtures'
import { CURRENT_VPARIVANIE_PRODUCT_CAPTIONS } from '../data/currentVparivanie'
import { ReportInlinePreview } from './ReportInlinePreview'

it('shows the actual seven flat attributes and separate customer identities with one resource', () => {
  const preview = normalizeNativeReportPreview({ Preview: currentVparivaniePreview() })
  const view = render(<MantineProvider env="test"><ReportInlinePreview preview={preview} /></MantineProvider>)
  for (const name of CURRENT_VPARIVANIE_PRODUCT_CAPTIONS) expect(screen.getByRole('columnheader', { name })).toBeTruthy()
  expect(screen.getAllByRole('columnheader', { name: 'Контрагенты' })).toHaveLength(2)
  expect(screen.getAllByRole('columnheader', { name: 'Одна назва / Кількість / Результат' })).toHaveLength(2)
  const row = screen.getByRole('rowheader', { name: '0000123' }).closest('tr')!
  expect(within(row).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['0', '-2.00000000', '∅', '3.00000001'])
  expect(within(row).getAllByRole('rowheader')).toHaveLength(7)
  expect(view.container.querySelectorAll('script')).toHaveLength(0)
  expect(screen.getByText('<script>name</script>')).toBeTruthy()
  expect(screen.getByText('Поточні залишки та період продажів')).toBeTruthy()
  expect(screen.getByText(/Вибраний період стосується продажів/)).toBeTruthy()
  expect(screen.getByText('Період розрахунку: 01.09.2026 — 27.09.2026')).toBeTruthy()
  expect(view.container.textContent).not.toContain('a'.repeat(64))
})
