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
import { agingFixture } from '../model/debtorAging.testData'

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
  it('shows unknown EUR valuations and separate credit balances without hiding local amounts', async () => {
    vi.mocked(getFilteredDebtors).mockResolvedValue({
      ...debtors,
      ClientInDebtors: [{
        ...debtors.ClientInDebtors[0], RemainderDebt: 999, RemainderDebtEuro: null,
        OverdueDebtEuro: 0, TotalDebtInDaysEuro: null, CreditBalanceEuro: null,
        CurrencyDebts: [{ CurrencyCode: 'UAH', RemainderDebt: 100, OverdueDebt: 0, CreditBalance: 25, CreditBalanceEuro: null }],
      }],
      CurrencyTotals: [{ CurrencyCode: 'UAH', RemainderDebt: 100, CreditBalance: 25, CreditBalanceEuro: null }],
      TotalRemainderDebtorsValue: null, TotalOverdueDebtorsValue: 0, TotalCreditBalanceEuro: null, UnknownEuroDebtCount: 1,
    })
    vi.mocked(getDebtorGroupedDebts).mockResolvedValue([{
      Id: 1, Agreement: { Currency: { Code: 'UAH' } },
      Debt: { Total: 100, EuroTotal: null, OverdueTotal: 0, OverdueEuroTotal: 0, CreditBalance: 25, CreditBalanceEuro: null },
    }])
    vi.mocked(getDebtorDebtTotal).mockResolvedValue({
      TotalInEuro: null, OverdueInEuro: 0, CreditBalanceEuro: null,
      Currencies: [{ CurrencyCode: 'UAH', Total: 100, TotalInEuro: null, CreditBalance: 25, CreditBalanceEuro: null }],
    })
    renderWithMantine(<I18nProvider><SalesDebtorsPage /></I18nProvider>)
    const row = await screen.findByTestId('row-0')
    expect(text(row.querySelector('[data-column="remainderDebt"]')!)).toBe('Не визначеноEUR')
    expect(text(row.querySelector('[data-column="overdueDebt"]')!)).toBe(`${money.format(0)}EUR`)
    expect(text(row.querySelector('[data-column="currencyDebt"]')!)).toContain(`${money.format(100)}UAH`)
    expect(text(row.querySelector('[data-column="creditBalance"]')!)).toContain(`${money.format(25)}UAHНе визначеноEUR`)
    expect(screen.getByText('Без оцінки в EUR: 1')).toBeTruthy()
    const footer = document.querySelector('.sales-debtors-summary')!
    expect(text(footer)).toContain('Борг, EURНе визначеноEUR')
    expect(text(footer)).toContain('Кредитовий залишок, EURНе визначеноEUR')
    expect(text(footer)).not.toContain(money.format(999))
    fireEvent.click(row)
    const drawer = await screen.findByLabelText('drawer')
    await waitFor(() => expect(within(drawer).getByText('Сума боргу')).toBeTruthy())
    const detail = text(drawer)
    expect(detail).toContain(`Сума боргу${money.format(100)}UAH`)
    expect(detail).toContain('Сума, EURНе визначеноEUR')
    expect(detail).toContain(`Кредитовий залишок${money.format(25)}UAHНе визначеноEUR`)
    expect(detail).toContain('Разом, EURНе визначеноEUR')
    expect(detail).not.toContain('Разом із субклієнтами')
  })

  it('shows known aging, unknown buckets and nullable days without classifying unknown debts as paid on time', async () => {
    const Aging = agingFixture({ UnknownDateDebtCount: 1, UnknownDateDebt: 60, UnknownDateDebtEuro: 30, UnknownTermsDebtCount: 1, UnknownTermsDebt: 40, UnknownTermsDebtEuro: null, HasCompleteAging: false })
    vi.mocked(getFilteredDebtors).mockResolvedValue({ ...debtors, Aging, DueCutoffBusinessDay: '2026-10-27T00:00:00', TotalOverdueDebtorsValue: null,
      ClientInDebtors: [{ ...debtors.ClientInDebtors[0], Aging, MissedDays: null, OverdueDebtEuro: null,
        CurrencyDebts: [{ CurrencyCode: 'USD', RemainderDebt: 100, OverdueDebt: null, Aging }] },
      { ...debtors.ClientInDebtors[0], ClientName: 'Борг із підтвердженою датою', Aging: agingFixture(), CreatedDebt: '2026-10-24T00:00:00' }],
      CurrencyTotals: [{ CurrencyCode: 'USD', RemainderDebt: 100, OverdueDebt: null, Aging }],
    })
    vi.mocked(getDebtorDebtTotal).mockResolvedValue({ Aging, TotalInEuro: null, OverdueInEuro: null, Currencies: [{ CurrencyCode: 'USD', Total: 100, Overdue: null, Aging }] })
    vi.mocked(getDebtorGroupedDebts).mockResolvedValue([{ Id: 1, Agreement: { Currency: { Code: 'USD' } }, Debt: { Aging, Days: null, Total: 100, EuroTotal: null, OverdueTotal: null, OverdueEuroTotal: null } }])
    renderWithMantine(<I18nProvider><SalesDebtorsPage /></I18nProvider>)
    const row = await screen.findByTestId('row-0')
    expect(screen.getByText('Борг до 27.10.2026')).toBeTruthy()
    expect(within(row).getByTitle('Підтверджена дата боргу відсутня').textContent).toBe('Дата не визначена')
    const datedRow = screen.getByTestId('row-1')
    expect(within(datedRow).getByTitle('Найраніша підтверджена дата боргу').textContent).toBe('24.10.2026')
    expect(text(datedRow)).not.toContain('00:00')
    expect(text(row.querySelector('[data-column="missedDays"]')!)).toContain('Не визначено')
    expect(text(row.querySelector('[data-column="overdueDebt"]')!)).toBe(`${money.format(0)}EUR`)
    const footer = document.querySelector('.sales-debtors-summary') as HTMLElement
    expect(text(footer)).toContain(`Відоме прострочення, EUR${money.format(0)}EUR`)
    fireEvent.click(within(footer).getByRole('button', { name: 'Невідома дата: 1 · Невідомий строк: 1' }))
    expect(await screen.findByText('Станом на: 24.10.2026 (Київ)')).toBeTruthy()
    expect(screen.getByText('За чинними умовами договорів')).toBeTruthy()
    expect(screen.getByText('60,00 USD')).toBeTruthy()
    expect(screen.getByText('40,00 USD')).toBeTruthy()
    expect(screen.getByText('Не визначено EUR')).toBeTruthy()
    fireEvent.click(within(footer).getByRole('button', { name: 'Невідома дата: 1 · Невідомий строк: 1' }))
    fireEvent.click(within(row).getByRole('button', { name: 'Неповні дані' }))
    expect(await screen.findByText('За чинними умовами договорів')).toBeTruthy()
    expect(screen.queryByLabelText('drawer')).toBeNull()
    fireEvent.click(within(row).getByRole('button', { name: 'Неповні дані' }))
    fireEvent.click(row)
    const drawer = await screen.findByLabelText('drawer')
    await waitFor(() => expect(within(drawer).getByText('Сума боргу')).toBeTruthy())
    expect(within(drawer).getByText('Строки визначено частково')).toBeTruthy()
    expect(within(drawer).queryByText('Без прострочки')).toBeNull()
    expect(within(drawer).getAllByText('Не визначено').length).toBeGreaterThan(0)
  })

})
