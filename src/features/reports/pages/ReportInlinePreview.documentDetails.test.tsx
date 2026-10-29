import { MantineProvider } from '@mantine/core'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import fixture from '../data/documentDetails.server-fixture.json'
import { normalizeNativeReportPreview } from '../data/nativeReportPreview'
import { ReportInlinePreview } from './ReportInlinePreview'
afterEach(cleanup)
it.each(['sales', 'grossProfit'] as const)('renders actual %s server detail identities separately with unknown historical quantity', profile => {
  const preview = normalizeNativeReportPreview({ Preview: fixture[profile].preview })
  const view = render(<MantineProvider env="test"><ReportInlinePreview preview={preview} previewReportProfile={profile} /></MantineProvider>)
  for (const row of fixture[profile].preview.Rows) expect(screen.getByRole('rowheader', { name: row.Values[1].Caption })).toBeTruthy()
  expect(view.container.querySelectorAll('tbody tr:not(.report-inline-preview__group-total) td[aria-description="Кількість не підтверджена для вибраних рядків."]').length).toBe(3)
  expect(screen.queryByText('R:1:1:1')).toBeNull()
  expect(screen.getAllByRole('columnheader').some(node => node.textContent === 'Детальний запис GBA')).toBe(true)
})
