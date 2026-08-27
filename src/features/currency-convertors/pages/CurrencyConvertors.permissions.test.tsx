import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import {
  createCurrencyTrader,
  getAllCurrencyTraders,
  getCurrencyTrader,
  getCurrencyTraderExchangeRates,
  updateCurrencyTrader,
} from '../api/currencyConvertorsApi'
import type { CurrencyTrader, CurrencyTraderExchangeRate } from '../types'
import { CurrencyConvertorFormPage } from './CurrencyConvertorFormPage'
import { CurrencyConvertorsPage } from './CurrencyConvertorsPage'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: (permission: string) => allowedPermissions.has(permission),
    isLoading: false,
  }),
}))

vi.mock('../api/currencyConvertorsApi', () => ({
  createCurrencyTrader: vi.fn(),
  deleteCurrencyTrader: vi.fn(),
  getAllCurrencyTraders: vi.fn(),
  getCurrencyTrader: vi.fn(),
  getCurrencyTraderExchangeRates: vi.fn(),
  updateCurrencyTrader: vi.fn(),
}))

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, footer, opened }: { children: ReactNode; footer?: ReactNode; opened: boolean }) =>
    opened ? <section>{children}{footer}</section> : null,
}))

vi.mock('../../../shared/ui/AppModal', () => ({
  AppModal: ({ children, opened }: { children: ReactNode; opened: boolean }) =>
    opened ? <section>{children}</section> : null,
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({
    columns,
    data,
    onRowClick,
  }: {
    columns: DataTableColumn<CurrencyTrader>[]
    data: CurrencyTrader[]
    onRowClick?: (trader: CurrencyTrader) => void
  }) => (
    <div>
      {data.map((trader) => (
        <div key={trader.NetUid}>
          <button type="button" onClick={() => onRowClick?.(trader)}>row-trader</button>
          {columns.at(-1)?.id === 'actions' ? columns.at(-1)?.cell?.(trader) : null}
        </div>
      ))}
    </div>
  ),
}))

vi.mock('../components/CurrencyTraderExchangeRatesDrawer', () => ({
  CurrencyTraderExchangeRatesDrawer: ({
    onDelete,
    onSaveEdit,
    onStartAdd,
    onStartEdit,
    trader,
    viewState,
  }: {
    onDelete: (rate: CurrencyTraderExchangeRate) => void
    onSaveEdit: () => void
    onStartAdd: () => void
    onStartEdit: (rate: CurrencyTraderExchangeRate) => void
    trader: CurrencyTrader | null
    viewState: { canEdit: boolean }
  }) => trader ? (
    <section>
      <output data-testid="rates-can-edit">{String(viewState.canEdit)}</output>
      <button type="button" onClick={onStartAdd}>start-add-rate</button>
      <button type="button" onClick={() => onStartEdit(RATE)}>start-edit-rate</button>
      <button type="button" onClick={onSaveEdit}>save-edit-rate</button>
      <button type="button" onClick={() => onDelete(RATE)}>delete-rate</button>
    </section>
  ) : null,
}))

const RATE: CurrencyTraderExchangeRate = {
  CurrencyName: 'USD',
  ExchangeRate: 40,
  FromDate: '2026-08-18',
  NetUid: 'rate-1',
}

const TRADER: CurrencyTrader = {
  CurrencyTraderExchangeRates: [RATE],
  FirstName: 'Іван',
  LastName: 'Трейдер',
  NetUid: 'trader-1',
}

function renderRoute(element: ReactNode, path: string, routePath: string) {
  return render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={routePath} element={element} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('currency convertor canonical permission guards', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getAllCurrencyTraders).mockResolvedValue([TRADER])
    vi.mocked(getCurrencyTrader).mockResolvedValue(TRADER)
    vi.mocked(getCurrencyTraderExchangeRates).mockResolvedValue([RATE])
    vi.mocked(createCurrencyTrader).mockResolvedValue(TRADER)
    vi.mocked(updateCurrencyTrader).mockResolvedValue(TRADER)
  })

  it('does not mount the registry without page access', () => {
    renderRoute(<CurrencyConvertorsPage />, '/accounting/currency-convertors', '/accounting/currency-convertors')

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getAllCurrencyTraders).not.toHaveBeenCalled()
  })

  it('allows page-only rate history but fails closed for injected edit handlers', async () => {
    allowedPermissions.add(PermissionKeys.FinancialAdministration.CurrencyConvertors.Page.View)
    renderRoute(<CurrencyConvertorsPage />, '/accounting/currency-convertors', '/accounting/currency-convertors')

    fireEvent.click(await screen.findByRole('button', { name: 'row-trader' }))
    await waitFor(() => expect(getCurrencyTraderExchangeRates).toHaveBeenCalledTimes(1))
    expect(screen.getByTestId('rates-can-edit').textContent).toBe('false')
    fireEvent.click(screen.getByRole('button', { name: 'start-add-rate' }))
    fireEvent.click(screen.getByRole('button', { name: 'start-edit-rate' }))
    fireEvent.click(screen.getByRole('button', { name: 'save-edit-rate' }))
    fireEvent.click(screen.getByRole('button', { name: 'delete-rate' }))
    expect(updateCurrencyTrader).not.toHaveBeenCalled()
  })

  it('uses the existing edit permission for all exchange-rate aggregate mutations', async () => {
    allowedPermissions.add(PermissionKeys.FinancialAdministration.CurrencyConvertors.Page.View)
    allowedPermissions.add(PermissionKeys.FinancialAdministration.CurrencyConvertors.Converter.Edit)
    renderRoute(<CurrencyConvertorsPage />, '/accounting/currency-convertors', '/accounting/currency-convertors')

    fireEvent.click(await screen.findByRole('button', { name: 'row-trader' }))
    fireEvent.click(await screen.findByRole('button', { name: 'start-edit-rate' }))
    fireEvent.click(screen.getByRole('button', { name: 'save-edit-rate' }))

    await waitFor(() => expect(updateCurrencyTrader).toHaveBeenCalledWith(expect.objectContaining({
      NetUid: 'trader-1',
    })))
    expect(screen.getByTestId('rates-can-edit').textContent).toBe('true')
  })

  it('requires create for a direct create route and its final submit', async () => {
    allowedPermissions.add(PermissionKeys.FinancialAdministration.CurrencyConvertors.Page.View)
    const denied = renderRoute(
      <CurrencyConvertorFormPage />,
      '/accounting/currency-convertors/new',
      '/accounting/currency-convertors/new',
    )
    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    denied.unmount()

    allowedPermissions.add(PermissionKeys.FinancialAdministration.CurrencyConvertors.Converter.Create)
    renderRoute(
      <CurrencyConvertorFormPage />,
      '/accounting/currency-convertors/new',
      '/accounting/currency-convertors/new',
    )
    fireEvent.change(screen.getByRole('textbox', { name: /Ім'я/ }), { target: { value: 'Новий' } })
    fireEvent.change(screen.getByRole('textbox', { name: /Прізвище/ }), { target: { value: 'Трейдер' } })
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    await waitFor(() => expect(createCurrencyTrader).toHaveBeenCalledTimes(1))
    expect(updateCurrencyTrader).not.toHaveBeenCalled()
  })

  it('keeps a page-only direct edit read-only', async () => {
    allowedPermissions.add(PermissionKeys.FinancialAdministration.CurrencyConvertors.Page.View)
    renderRoute(
      <CurrencyConvertorFormPage />,
      '/accounting/currency-convertors/edit/trader-1',
      '/accounting/currency-convertors/edit/:id',
    )

    const firstName = await screen.findByRole('textbox', { name: /Ім'я/ })
    expect((firstName as HTMLInputElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Зберегти' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Видалити' })).toBeNull()
    expect(getCurrencyTrader).toHaveBeenCalledWith('trader-1')
  })
})
