import { MantineProvider } from '@mantine/core'
// @ts-expect-error Vitest runs in Node, while the app tsconfig omits Node types.
import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { SalesTab } from './SalesTab'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
vi.mock('../../../shared/realtime/events', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../../shared/realtime/events')>(),
  useRealtimeEvent: () => {},
}))
vi.mock('../../sales-ukraine/usePersistentSaleJsonMutation', () => ({
  usePersistentSaleJsonMutationRunner: () => vi.fn(),
}))
vi.mock('../../sales-ukraine/components/SaleDetailsDrawer', () => ({ SaleDetailsDrawer: () => null }))

const apiRequestMock = vi.mocked(apiRequest)

beforeEach(() => {
  localStorage.clear()
  apiRequestMock.mockReset()
})

it.each([
  ['long client name', 'ТОВАРИСТВО З ОБМЕЖЕНОЮ ВІДПОВІДАЛЬНІСТЮ "МІЖНАРОДНА ТОРГОВЕЛЬНА КОМПАНІЯ"'],
  ['short client name', 'Боревіч'],
])('shows the full %s in the invoices register', async (_scenario, fullName) => {
  apiRequestMock.mockResolvedValue({
    Items: [{
      Id: 1,
      NetUid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      SaleNumber: { Value: 'КСН00002771' },
      ClientAgreement: { Client: { RegionCode: { Value: 'BXV01703' }, FullName: fullName } },
    }],
    TotalRowsQty: 1,
  })

  const style = document.createElement('style')
  const warehouseStyles = readFileSync('src/features/warehouse-ukraine/pages/warehouse-ukraine-page.css', 'utf8')
  style.textContent = warehouseStyles.match(/\.warehouse-ukraine-table \.data-table-cell\.sales-tab-client-name,[\s\S]*?\}/)?.[0] ?? ''
  expect(style.textContent).not.toBe('')
  document.head.append(style)

  try {
    render(
      <MantineProvider>
        <I18nProvider>
          <SalesTab
            canCreateShipment={false}
            canPrintEditAct={false}
            canPrintInvoice={false}
            canUpdatePrintStatus={false}
            onCreateShipment={vi.fn()}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    const name = await screen.findByText(`BXV01703 ${fullName}`)
    const cell = name.closest('td')

    expect(cell?.classList.contains('sales-tab-client-name')).toBe(true)
    expect(window.getComputedStyle(cell!).whiteSpace).toBe('normal')
    expect(window.getComputedStyle(name).whiteSpace).toBe('normal')
    expect(window.getComputedStyle(name).overflow).toBe('visible')
  } finally {
    style.remove()
  }
})
