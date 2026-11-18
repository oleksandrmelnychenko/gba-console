import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { MantineProvider } from '@mantine/core'
import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { normalizeNativeReportPreview } from '../data/nativeReportPreview'
import { ownPresentationPreview } from '../data/constructorPresentation.native.test-fixtures'
import { ReportInlinePreview } from './ReportInlinePreview'

afterEach(() => { cleanup() })
const view = (unconfirmed: boolean) => {
  const wire = ownPresentationPreview(3)
  wire.Request.DataSource = 'NativeSalesNet'
  if (unconfirmed) {
    wire.Cells[3].Value.Provenance = 'unconfirmedCurrency'
    wire.Cells[0].Value.Provenance = 'unconfirmedCurrency'
    wire.Totals.Values[3].Value.Provenance = 'unconfirmedCurrency'
  }
  return render(<MantineProvider env="test"><I18nProvider><ReportInlinePreview preview={normalizeNativeReportPreview({ Preview: wire })} /></I18nProvider></MantineProvider>)
}
it('shades every cell left out of the totals for an unconfirmed currency, known values included', () => {
  const shaded = [...view(true).container.querySelectorAll('td.is-unknown')]
  expect(shaded).toHaveLength(3)
  expect(shaded.map(cell => cell.textContent)).toEqual(['8,125', '—', '—'])
})
it('leaves other undetermined cells unshaded', () => {
  expect(view(false).container.querySelector('td.is-unknown')).toBeNull()
})
