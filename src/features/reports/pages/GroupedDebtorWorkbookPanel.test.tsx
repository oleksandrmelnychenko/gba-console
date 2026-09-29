import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { beforeEach, expect, it, vi } from 'vitest'
import { getGroupedDebtorCapability, getGroupedDebtorStatement } from '../api/groupedDebtorApi'
import { GROUPED_DEBTOR_ROOT } from '../data/groupedDebtor'
import { downloadGroupedDebtorPdf, downloadGroupedDebtorXlsx } from '../data/downloadGroupedDebtor'
import { GroupedDebtorWorkbookPanel } from './GroupedDebtorWorkbookPanel'

vi.mock('../api/groupedDebtorApi', () => ({
  getGroupedDebtorCapability: vi.fn(), getGroupedDebtorStatement: vi.fn(),
}))
vi.mock('../data/downloadGroupedDebtor', () => ({
  downloadGroupedDebtorPdf: vi.fn(), downloadGroupedDebtorXlsx: vi.fn(),
}))

const capability = vi.mocked(getGroupedDebtorCapability)
const statement = vi.mocked(getGroupedDebtorStatement)
const uid = '00000000-0000-0000-0000-000000000001'

beforeEach(() => { vi.resetAllMocks() })

it('keeps the full workbook action closed until source and parity are certified', async () => {
  capability.mockResolvedValue({ Available: false, SourcePopulationCertified: false,
    WorkbookParityVerified: false, BuyerRootSourceId: GROUPED_DEBTOR_ROOT,
    MaximumDays: 31, CurrencyBasis: 'SettlementCurrency', Reason: 'Популяція неповна' })
  render(<MantineProvider env="test"><GroupedDebtorWorkbookPanel from="2025-09-01" to="2025-09-02"
    enabled disabled={false} /></MantineProvider>)
  expect(await screen.findByText('Популяція неповна')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Сформувати повну дебіторку' }).hasAttribute('disabled')).toBe(true)
  expect(screen.queryByRole('button', { name: /Завантажити XLSX/ })).toBeNull()
  expect(screen.queryByRole('button', { name: /Завантажити PDF/ })).toBeNull()
  expect(statement).not.toHaveBeenCalled()
})

it('renders organization then counterparty with separate settlement currency amounts', async () => {
  capability.mockResolvedValue({ Available: true, SourcePopulationCertified: true,
    WorkbookParityVerified: true, BuyerRootSourceId: GROUPED_DEBTOR_ROOT,
    MaximumDays: 31, CurrencyBasis: 'SettlementCurrency', Reason: '' })
  statement.mockResolvedValue({ From: '2025-09-01', To: '2025-09-02',
    BuyerRootSourceId: GROUPED_DEBTOR_ROOT, CurrencyBasis: 'SettlementCurrency', Rows: [{
      OrganizationId: '10', OrganizationNetUid: uid, OrganizationName: 'Компанія',
      CounterpartyId: '20', CounterpartyNetUid: uid, CounterpartyName: 'Покупець',
      CurrencyId: '40', CurrencyNetUid: uid, CurrencyCode: '980', Opening: '100.00',
      Incoming: '15.50', Outgoing: '5.00', Closing: '110.50',
      Agreements: [{ AgreementId: '31', AgreementNetUid: uid,
        SourceAgreementRRef: 'A'.repeat(32), PublicationId: uid }],
    }] })
  render(<MantineProvider env="test"><GroupedDebtorWorkbookPanel from="2025-09-01" to="2025-09-02"
    enabled disabled={false} /></MantineProvider>)
  const button = screen.getByRole('button', { name: 'Сформувати повну дебіторку' })
  await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false))
  fireEvent.click(button)
  expect(await screen.findByText('110,50')).toBeTruthy()
  expect(screen.getByText('Компанія')).toBeTruthy()
  expect(screen.getByText('Покупець')).toBeTruthy()
  expect(statement).toHaveBeenCalledWith('2025-09-01', '2025-09-02', expect.any(AbortSignal))
  expect(screen.getByText(/Чернетка на поточних даних/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Завантажити XLSX · чернетка' }))
  await waitFor(() => expect(downloadGroupedDebtorXlsx).toHaveBeenCalledWith(expect.objectContaining({
    Rows: expect.arrayContaining([expect.objectContaining({ Closing: '110.50', CurrencyCode: '980' })]),
  })))
  fireEvent.click(screen.getByRole('button', { name: 'Завантажити PDF · чернетка' }))
  await waitFor(() => expect(downloadGroupedDebtorPdf).toHaveBeenCalledWith(expect.objectContaining({
    From: '2025-09-01', To: '2025-09-02',
  })))
})
