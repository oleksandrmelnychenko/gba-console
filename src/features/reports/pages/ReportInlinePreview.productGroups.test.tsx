import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import { normalizeNativeReportPreview } from '../data/nativeReportPreview'
import { productGroupsPreview } from '../data/currentProductGroups.test-fixtures'
import { ReportInlinePreview } from './ReportInlinePreview'

it('renders every direct group as a separate name without identity clutter or caption deduplication', () => {
  const raw = productGroupsPreview()
  const view = render(<MantineProvider env="test"><ReportInlinePreview preview={normalizeNativeReportPreview({ Preview: raw })} previewReportProfile="sales" /></MantineProvider>)
  const list = screen.getByRole('list', { name: 'Групи поточного товару' })
  expect(within(list).getAllByRole('listitem').map(item => item.textContent)).toEqual(['Однакова назва', 'Однакова назва'])
  expect(screen.getByRole('columnheader', { name: 'Групи (поточний товар)' })).toBeTruthy()
  expect(view.container.textContent).not.toContain('9007199254740993')
  expect(view.container.textContent).not.toContain('11111111-1111')
})
it.each(['empty', 'unavailable', 'blankCaption', 'htmlCaption'])('keeps %s list state honest and text-only', mode => {
  const raw = productGroupsPreview(), value = raw.workbookPresentation.rows[0].values[1]
  if (mode === 'empty' || mode === 'unavailable') value.references = []
  if (mode === 'unavailable') value.state = 'unavailable'
  if (mode === 'blankCaption') { value.references![0].caption = null; value.references![1].caption = '' }
  if (mode === 'htmlCaption') value.references![0].caption = '<img src=x onerror=alert(1)>'
  const view = render(<MantineProvider env="test"><ReportInlinePreview preview={normalizeNativeReportPreview({ Preview: raw })} /></MantineProvider>)
  if (mode === 'empty') expect(screen.getByRole('rowheader', { name: 'Немає груп' })).toBeTruthy()
  if (mode === 'unavailable') { expect(screen.queryByRole('list')).toBeNull(); expect(screen.getByRole('rowheader', { name: '—' })).toBeTruthy() }
  if (mode === 'blankCaption') expect(screen.getAllByText('Без назви')).toHaveLength(2)
  if (mode === 'htmlCaption') { expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeTruthy(); expect(view.container.querySelector('img')).toBeNull() }
})
