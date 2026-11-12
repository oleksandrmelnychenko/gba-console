import { MantineProvider } from '@mantine/core'
import { render } from '@testing-library/react'
import { expect, it } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { ReportRowPagination } from './ReportRowPagination'

it('groups thousands in the row range', () => {
  const view = render(<MantineProvider env="test"><I18nProvider>
    <ReportRowPagination total={98664} offset={16000} onChange={() => undefined} />
  </I18nProvider></MantineProvider>)
  expect(view.container.querySelector('.report-preview-footer__range')?.textContent).toBe('16\u00a0001–16\u00a0050 із 98\u00a0664')
})
