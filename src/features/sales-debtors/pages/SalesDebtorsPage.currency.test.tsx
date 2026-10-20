import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { renderWithMantine } from '../../../test/renderWithMantine'
import {
  getDebtorDebtTotal,
  getDebtorGroupedDebts,
  getDebtorsManagers,
  getDebtorsOrganizations,
  getFilteredDebtors,
} from '../api/salesDebtorsApi'
import type { ClientDebtors } from '../types'
import { SalesDebtorsPage } from './SalesDebtorsPage'

vi.mock('../api/salesDebtorsApi', () => ({
  exportDebtorsDocument: vi.fn(),
  getDebtorDebtTotal: vi.fn(),
  getDebtorGroupedDebts: vi.fn(),
  getDebtorsManagers: vi.fn(),
  getDebtorsOrganizations: vi.fn(),
  getFilteredDebtors: vi.fn(),
}))

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, opened, title }: { children: ReactNode; opened: boolean; title?: ReactNode }) =>
    opened ? <section aria-label="drawer"><h2>{title}</h2>{children}</section> : null,
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: <TData,>({ columns, data, onRowClick, tableId }: {
    columns: Array<{ cell?: (item: TData) => ReactNode; header: ReactNode; id: string }>
    data: TData[]
    onRowClick?: (item: TData) => void
    tableId: string
  }) => (
    <table data-testid={tableId}>
      <thead>
        <tr>{columns.map((column) => <th key={column.id}>{column.header}</th>)}</tr>
      </thead>
      <tbody>
        {data.map((item, index) => (
          <tr key={index} data-testid={`row-${index}`} onClick={() => onRowClick?.(item)}>
            {columns.map((column) => <td key={column.id} data-column={column.id}>{column.cell?.(item)}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  ),
}))

const moneyFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
const money = { format: (value: number) => moneyFormatter.format(value).replace(/\s/g, ' ') }
const text = (element: Element) => (element.textContent ?? '').replace(/\s+/g, ' ')

const debtors: ClientDebtors = {
  ClientInDebtors: [
    {
      ClientName: 'Київ - ФОП Терновий Олексій Михайлович',
      ClientNetId: 'b36475e5-5773-498f-b465-ef4b2e4ae312',
      CurrencyDebts: [
        {
          CurrencyCode: 'EUR',
          OverdueDebt: 804.11,
          OverdueDebtEuro: 804.11,
          RemainderDebt: 804.11,
          RemainderDebtEuro: 804.11,
          TotalDebtInDays: 804.11,
          TotalDebtInDaysEuro: 804.11,
        },
        {
          CurrencyCode: 'UAH',
          OverdueDebt: 4389.78,
          OverdueDebtEuro: 85.91,
          RemainderDebt: 4389.78,
          RemainderDebtEuro: 85.91,
          TotalDebtInDays: 4389.78,
          TotalDebtInDaysEuro: 85.91,
        },
      ],
      MissedDays: -1686,
      OverdueDebt: 890.02,
      OverdueDebtEuro: 890.02,
      RemainderDebt: 890.02,
      RemainderDebtEuro: 890.02,
      TotalDebtInDays: 5193.89,
      TotalDebtInDaysEuro: 890.02,
    },
  ],
  CurrencyTotals: [
    { CurrencyCode: 'EUR', OverdueDebt: 39757.31, OverdueDebtEuro: 39757.31, RemainderDebt: 44708.81, RemainderDebtEuro: 44708.81 },
    { CurrencyCode: 'UAH', OverdueDebt: 4181286.99, OverdueDebtEuro: 81825.47, RemainderDebt: 9400025.48, RemainderDebtEuro: 183953.45 },
  ],
  TotalMissedDays: -359219,
  TotalOverdueDebtorsValue: 121582.78,
  TotalQtyClients: 1,
  TotalRemainderDebtorsValue: 228662.26,
}

describe('SalesDebtorsPage debt currency', () => {
  beforeEach(() => {
    vi.mocked(getFilteredDebtors).mockResolvedValue(debtors)
    vi.mocked(getDebtorsManagers).mockResolvedValue([])
    vi.mocked(getDebtorsOrganizations).mockResolvedValue([])
    vi.mocked(getDebtorGroupedDebts).mockResolvedValue([
      {
        Agreement: { Currency: { Code: 'EUR' } },
        Debt: { Days: 1647, EuroTotal: 804.11, OverdueEuroTotal: 804.11, OverdueTotal: 804.11, Total: 804.11 },
        Id: 1,
      },
      {
        Agreement: { Currency: { Code: 'UAH' } },
        Debt: { Days: 38, EuroTotal: 85.91, OverdueEuroTotal: 85.91, OverdueTotal: 4389.78, Total: 4389.78 },
        Id: 2,
      },
    ])
    vi.mocked(getDebtorDebtTotal).mockResolvedValue({
      Currencies: [
        { CurrencyCode: 'EUR', Overdue: 804.11, OverdueInEuro: 804.11, Total: 804.11, TotalInEuro: 804.11 },
        { CurrencyCode: 'UAH', Overdue: 4389.78, OverdueInEuro: 85.91, Total: 4389.78, TotalInEuro: 85.91 },
      ],
      OverdueInEuro: 890.02,
      TotalEuro: 804.11,
      TotalInEuro: 890.02,
      TotalLocal: 4389.78,
    })
  })

  it('shows every debt currency next to the euro equivalent in the grid and the footer', async () => {
    renderWithMantine(
      <I18nProvider>
        <SalesDebtorsPage />
      </I18nProvider>,
    )

    const row = await screen.findByTestId('row-0')
    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent)

    expect(headers).toEqual(expect.arrayContaining(['Борг', 'Прострочено', 'Борг, EUR', 'Прострочено, EUR']))

    const debtCell = row.querySelector('[data-column="currencyDebt"]') as HTMLElement
    expect(within(debtCell).getByText(money.format(804.11))).toBeTruthy()
    expect(within(debtCell).getByText(money.format(4389.78))).toBeTruthy()
    expect(within(debtCell).getByText('UAH')).toBeTruthy()
    expect(within(debtCell).getByText('EUR')).toBeTruthy()

    const euroCell = row.querySelector('[data-column="remainderDebt"]') as HTMLElement
    expect(text(euroCell)).toBe(`${money.format(890.02)}EUR`)

    const daysCell = row.querySelector('[data-column="totalDebtInDays"]') as HTMLElement
    expect(within(daysCell).getByText(money.format(4389.78))).toBeTruthy()
    expect(text(daysCell)).not.toContain(money.format(5193.89))

    const footer = Array.from(document.querySelectorAll('.sales-debtors-summary__amount')).map(text)
    expect(footer).toContain(`Борг${money.format(44708.81)}EUR${money.format(9400025.48)}UAH`)
    expect(footer).toContain(`Прострочено${money.format(39757.31)}EUR${money.format(4181286.99)}UAH`)
    expect(footer).toContain(`Борг, EUR${money.format(228662.26)}EUR`)
    expect(footer).toContain(`Прострочено, EUR${money.format(121582.78)}EUR`)
  })

  it('shows the same currency and euro amounts in the client drill-down', async () => {
    renderWithMantine(
      <I18nProvider>
        <SalesDebtorsPage />
      </I18nProvider>,
    )

    fireEvent.click(await screen.findByTestId('row-0'))

    const drawer = await screen.findByLabelText('drawer')

    await waitFor(() => expect(within(drawer).getAllByText('Днів прострочки')).toHaveLength(2))

    const drawerText = text(drawer)
    expect(drawerText).toContain(`Борг, EUR${money.format(890.02)}EUR`)
    expect(drawerText).toContain(`Борг UAH${money.format(4389.78)}UAH${money.format(85.91)}EUR`)
    expect(drawerText).toContain(`Борг EUR${money.format(804.11)}EUR`)
    expect(drawerText).toContain(`Разом, EUR${money.format(890.02)}EUR`)
    expect(drawerText).toContain(`Сума боргу${money.format(4389.78)}UAH`)
    expect(drawerText).toContain(`Сума, EUR${money.format(85.91)}EUR`)
    expect(drawerText).toContain('Прострочено 38 дн.')
    expect(drawerText).not.toContain('Разом із субклієнтами')
  })
})
