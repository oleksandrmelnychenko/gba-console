import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { MantineProvider } from '@mantine/core'
import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { normalizeNativeReportPreview } from '../data/nativeReportPreview'
import { ownPresentationPreview } from '../data/constructorPresentation.native.test-fixtures'
import { ReportInlinePreview } from './ReportInlinePreview'

afterEach(() => { cleanup() })
const view = (source: string) => {
  const wire = ownPresentationPreview(3)
  wire.Request.DataSource = source
  return render(<MantineProvider env="test"><I18nProvider><ReportInlinePreview preview={normalizeNativeReportPreview({ Preview: wire })} /></I18nProvider></MantineProvider>)
}
it('shades only the undetermined cells of the sales report, totals included', () => {
  const shaded = [...view('NativeSalesNet').container.querySelectorAll('td.is-unknown')]
  expect(shaded).toHaveLength(3)
  expect(shaded.map(cell => cell.textContent)).toEqual(['—', '—', '—'])
})
it('leaves other reports unshaded', () => {
  expect(view('NativePurchases').container.querySelector('td.is-unknown')).toBeNull()
})
