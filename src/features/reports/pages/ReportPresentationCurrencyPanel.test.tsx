import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { ReportPresentationCurrencyPanel } from './ReportPresentationCurrencyPanel'
import { getReportPresentationCurrencies } from '../api/reportPresentationCurrencies'
import { currencyDataset, currencyRequest, currencySelection } from '../data/reportPresentationCurrency.test-fixtures'
vi.mock('../api/reportPresentationCurrencies', () => ({ getReportPresentationCurrencies: vi.fn() }))
const lookup = vi.mocked(getReportPresentationCurrencies)
const cad = { value: currencySelection.currencyNetUid, code: 'CAD retail', label: 'CAD retail — Канадський долар' }
beforeEach(() => lookup.mockReset().mockResolvedValue([cad]))
function panel(request = currencyRequest(), dataset = currencyDataset, change = vi.fn()) {
 return { change, view: render(<MantineProvider env="test"><ReportPresentationCurrencyPanel dataset={dataset} request={request} disabled={false} onChange={change} /></MantineProvider>) }
}
it('selects from catalog, preserves the NetUid and explicitly resets to legacy EUR', async () => {
 const { change, view } = panel()
 await waitFor(() => expect(screen.getByRole('combobox', { name: 'Валюта звіту' })).toHaveProperty('value', cad.label))
 fireEvent.click(screen.getByRole('combobox', { name: 'Валюта звіту' }))
 fireEvent.click(screen.getByRole('option', { name: 'EUR — за замовчуванням' }))
 expect(change).toHaveBeenLastCalledWith(undefined)
 view.rerender(<MantineProvider env="test"><ReportPresentationCurrencyPanel dataset={currencyDataset} request={{ ...currencyRequest(), presentationCurrency: undefined }} disabled={false} onChange={change} /></MantineProvider>)
 fireEvent.click(screen.getByRole('combobox', { name: 'Валюта звіту' }))
 fireEvent.click(screen.getByRole('option', { name: cad.label }))
 expect(change).toHaveBeenLastCalledWith(currencySelection)
})
it('keeps unavailable selections on failed lookup and retries without changing request', async () => {
 lookup.mockRejectedValueOnce(new Error('Довідник недоступний'))
 const { change } = panel()
 await screen.findByRole('alert')
 expect(change).not.toHaveBeenCalled()
 fireEvent.click(screen.getByRole('button', { name: 'Повторити завантаження валют' }))
 await waitFor(() => expect(screen.getByRole('combobox', { name: 'Валюта звіту' })).toHaveProperty('value', cad.label))
 expect(change).not.toHaveBeenCalled()
})
it('refuses missing catalog entry visibly rather than changing to default', async () => {
 lookup.mockResolvedValueOnce([])
 const { change } = panel()
 await screen.findByText(/Збереженої валюти немає/)
 expect(change).not.toHaveBeenCalled()
})
it('does not fetch on old metadata or incompatible mode and offers explicit reset only', () => {
 const { change } = panel({ ...currencyRequest(), profitReadMode: 1 })
 expect(lookup).not.toHaveBeenCalled()
 expect(screen.getByText(/Валюта звіту доступна лише/)).toBeTruthy()
 fireEvent.click(screen.getByRole('button', { name: 'Використовувати EUR за замовчуванням' }))
 expect(change).toHaveBeenLastCalledWith(undefined)
})
it('does not add controls or network dependencies to legacy metadata', () => {
 render(<MantineProvider><ReportPresentationCurrencyPanel dataset={{ ...currencyDataset, currentFinancialPresentationCurrency: undefined }}
   request={{ ...currencyRequest(), presentationCurrency: undefined }} disabled={false} onChange={vi.fn()} /></MantineProvider>)
 expect(screen.queryByText('Валюта звіту')).toBeNull()
 expect(lookup).not.toHaveBeenCalled()
})
