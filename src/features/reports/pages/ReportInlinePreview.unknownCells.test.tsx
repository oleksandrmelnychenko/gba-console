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
    wire.Totals.Values[3].Value.Provenance = 'unconfirmedCurrency'
  }
  return render(<MantineProvider env="test"><I18nProvider><ReportInlinePreview preview={normalizeNativeReportPreview({ Preview: wire })} /></I18nProvider></MantineProvider>)
}
it('shades only the cells whose currency is not confirmed', () => {
  const shaded = [...view(true).container.querySelectorAll('td.is-unknown')]
  expect(shaded).toHaveLength(2)
  expect(shaded.map(cell => cell.textContent)).toEqual(['—', '—'])
})
it('leaves other undetermined cells unshaded', () => {
  expect(view(false).container.querySelector('td.is-unknown')).toBeNull()
})
