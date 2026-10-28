import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { theme } from '../../../shared/theme/theme'
import type { SalesUkraineSale } from '../types'

const mocks = vi.hoisted(() => ({
  getSalesUkraine: vi.fn(),
  getSalesUkraineDeliveryDetails: vi.fn(),
  getSalesUkraineSaleDetails: vi.fn(),
}))

vi.mock('../api/salesUkraineApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/salesUkraineApi')>(),
  ...mocks,
  getSalesUkraineOrganizations: vi.fn(async () => []),
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true, user: { NetUid: 'qa-reader' } }),
}))

vi.mock('../../../shared/realtime/events', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../../shared/realtime/events')>(),
  useRealtimeEvent: () => {},
}))

import { SalesUkrainePage } from './SalesUkrainePage'

const liveComment = "8578888 6859879898578888 6859879898578888 6859879898578888 6859879898578888 6859879898578888 6859879898578888 6859879898578888 6859879898578888 6859879898578888 6859879898578888 6859879898578888 6859879898578888 6859879898578888 6859879898578888 6859879898578888 6859879898578888 685987989"
const sale: SalesUkraineSale = {
  Id: 2133586,
  NetUid: '3366e3b9-77ca-4bae-8a30-40ef4584f164',
  SaleNumber: { Value: '00000039264' },
  ClientAgreement: {
    Client: {
      FullName: 'Миколаїв - ФОП Даниленко Іван Миколайович',
      RegionCode: { Value: 'BMI00602' },
    },
    Agreement: { Name: 'Договір ФОП Самолюк А. Д.', Currency: { Code: 'UAH' } },
  },
  BaseLifeCycleStatus: { SaleLifeCycleType: 1 },
  BaseSalePaymentStatus: { SalePaymentStatusType: 0 },
  HasDetails: false,
  Transporter: { Name: 'Автолюкс' },
  Comment: liveComment,
  Order: { OrderItems: [] },
  TotalPositions: 5,
  TotalRowsQty: 1,
}

function renderPage() {
  return render(
    <MantineProvider theme={theme}>
      <I18nProvider>
        <MemoryRouter initialEntries={['/sales/ukraine/all']}>
          <SalesUkrainePage />
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

async function findRow() {
  return (await screen.findByText('00000039264')).closest('.sales-grid-row') as HTMLElement
}

describe('SalesUkrainePage carrier comment in the registry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSalesUkraine.mockResolvedValue([sale])
    mocks.getSalesUkraineDeliveryDetails.mockResolvedValue(sale)
  })

  it('shows the live carrier comment in the collapsed registry without requesting details', async () => {
    renderPage()
    const row = await findRow()
    expect(within(row).getByText(liveComment)).not.toBeNull()
    expect(within(row).getByRole('button', { name: 'Автолюкс' })).not.toBeNull()
    expect(mocks.getSalesUkraineDeliveryDetails).not.toHaveBeenCalled()
    expect(mocks.getSalesUkraineSaleDetails).not.toHaveBeenCalled()
    expect(document.querySelector('.sales-grid-expand')).toBeNull()
  })

  it('exposes the full multiline unbroken comment on keyboard focus and keeps carrier details available', async () => {
    const comment = `Передзвонити перед доставкою\n${'1234567890'.repeat(50)}`
    mocks.getSalesUkraine.mockResolvedValue([{ ...sale, Comment: comment }])
    renderPage()
    const row = await findRow()
    const preview = within(row).getByLabelText('Коментар')
    expect(preview.textContent).toBe(comment)
    expect(preview.closest('.sg-client')).not.toBeNull()
    fireEvent.focus(preview)
    const tooltip = await screen.findByRole('tooltip')
    expect(tooltip.textContent).toBe(comment)
    fireEvent.blur(preview)
    fireEvent.click(within(row).getByRole('button', { name: 'Автолюкс' }))
    await waitFor(() => expect(mocks.getSalesUkraineDeliveryDetails).toHaveBeenCalled())
    expect(mocks.getSalesUkraineDeliveryDetails.mock.calls[0][0]).toBe(sale.NetUid)
  })

  it.each([undefined, '', '   '])('does not show a historical comment when current comment is %j', async (comment) => {
    mocks.getSalesUkraine.mockResolvedValue([{
      ...sale,
      Comment: comment,
      UpdateDataCarrier: [{ Comment: 'Старий коментар' }],
    }])
    renderPage()
    const row = await findRow()
    expect(within(row).queryByLabelText('Коментар')).toBeNull()
    expect(within(row).queryByText('Старий коментар')).toBeNull()
    expect(within(row).getByRole('button', { name: 'Автолюкс' })).not.toBeNull()
  })
})
