import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getAccountingCashFlow, getAccountingCashFlowCounterparty } from '../api/accountingCashFlowApi'
import { SupplierAccountingCashFlowPage } from './AccountingCashFlowPage'

vi.mock('../../auth/components/PermissionGate', () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/accountingCashFlowApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/accountingCashFlowApi')>(),
  getAccountingCashFlow: vi.fn(),
  getAccountingCashFlowCounterparty: vi.fn(),
}))

it('says «Контрагента не знайдено» when the server answers an unknown id with an empty record', async () => {
  vi.mocked(getAccountingCashFlowCounterparty).mockResolvedValue({ ClientAgreements: [] })
  vi.mocked(getAccountingCashFlow).mockResolvedValue({ AccountingCashFlowHeadItems: [] } as never)
  render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={['/suppliers/accounting-cash-flow/999999']}>
          <Routes>
            <Route path="/suppliers/accounting-cash-flow/:id" element={<SupplierAccountingCashFlowPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )

  expect(await screen.findByText('Контрагента не знайдено')).toBeTruthy()
})
