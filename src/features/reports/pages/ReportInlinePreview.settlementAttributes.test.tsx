import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import { normalizeNativeReportPreview } from '../data/nativeReportPreview'
import { knownSettlementAttribute, settlementAttributePreview } from '../data/settlementSourceAttributes.test-fixtures'
import { ReportInlinePreview } from './ReportInlinePreview'
it('shows the original additional headers and server strings without changing the three financial axes or zero cell', () => {
  const view = render(<MantineProvider env="test"><ReportInlinePreview preview={normalizeNativeReportPreview({ Preview: settlementAttributePreview() })} /></MantineProvider>)
  const table = screen.getByRole('table')
  expect(within(table).getByRole('columnheader', { name: 'Основний менеджер покупця' })).toBeTruthy()
  expect(within(table).getByRole('columnheader', { name: 'Код по региону' })).toBeTruthy()
  expect(view.container.textContent).toContain(' Manager🙂 '); expect(view.container.textContent).toContain(' B🙂 ')
  expect(within(table).getByRole('cell', { name: '0' })).toBeTruthy()
  expect(view.container.textContent).not.toContain('b'.repeat(64))
})
it('renders observed unassigned fields and treats source markup as text', () => {
  const row = { ...knownSettlementAttribute(), ManagerName: null, ManagerAssigned: false, RegionCode: '<img src=x>' }
  const view = render(<MantineProvider env="test"><ReportInlinePreview preview={normalizeNativeReportPreview({ Preview: settlementAttributePreview(row) })} /></MantineProvider>)
  const table = screen.getByRole('table'); expect(within(table).getByRole('rowheader', { name: '∅' })).toBeTruthy()
  expect(view.container.textContent).toContain('<img src=x>'); expect(view.container.querySelector('img')).toBeNull()
})
it('shows unavailable source attributes without fabricating text or hiding the known zero amount', () => {
  const row = { ...knownSettlementAttribute(), ManagerAvailable: false, ManagerName: null, ManagerAssigned: null,
    RegionAvailable: false, RegionCode: null }
  render(<MantineProvider env="test"><ReportInlinePreview preview={normalizeNativeReportPreview({ Preview: settlementAttributePreview(row) })} /></MantineProvider>)
  const table = screen.getByRole('table')
  expect(within(table).getAllByRole('rowheader', { name: '—' })).toHaveLength(2)
  expect(within(table).getByRole('cell', { name: '0' })).toBeTruthy()
})
