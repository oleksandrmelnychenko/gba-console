import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { readBuyerOrders } from '../api/originalBuyerOrdersApi'
import { capability, product, response } from '../testing/buyerOrdersFixtures'
import type { BuyerOrdersResult } from '../data/originalBuyerOrders'
import { OriginalBuyerOrdersPanel } from './OriginalBuyerOrdersPanel'
import { buyerOrdersHeaders, buyerOrdersValues } from '../data/originalBuyerOrdersExport'
vi.mock('../api/originalBuyerOrdersApi', () => ({ readBuyerOrders: vi.fn() }))
const panel = (caller = 'caller1', canGenerate = true) => <MantineProvider env="test"><I18nProvider>
  <OriginalBuyerOrdersPanel capability={capability} callerKey={caller} canGenerate={canGenerate} initialFrom="2026-09-01" initialThrough="2026-09-30" />
</I18nProvider></MantineProvider>
it('buyerOrders form sends own period and only admitted human product equality choices', async () => {
  vi.clearAllMocks(); vi.mocked(readBuyerOrders).mockResolvedValue(response()); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect((screen.getByRole('combobox', { name: 'Товари' }) as HTMLInputElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('combobox', { name: 'Товари' })); fireEvent.click(await screen.findByRole('option', { name: 'Наш товар' }))
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect(readBuyerOrders).toHaveBeenCalledTimes(2))
  expect(vi.mocked(readBuyerOrders).mock.calls[1][0]).toMatchObject({ SourceId: capability.SourceId, Rows: [0, 1], Filters: [{ Field: 1, Type: null, Table: null, Reference: product }] })
  expect(screen.queryByText(product)).toBeNull(); expect(screen.queryByRole('combobox', { name: 'Склади' })).toBeNull()
})
it('buyerOrders screen preserves receipt parent before product and every signed resource from one completed result', async () => {
  vi.clearAllMocks(); vi.mocked(readBuyerOrders).mockResolvedValue(response()); render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByText('Підсумок замовлення')
  const rows = screen.getAllByRole('row'); expect(rows[1].textContent).toContain('Підсумок замовлення'); expect(rows[2].textContent).toContain('Наш товар')
  expect(within(rows[0]).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual(buyerOrdersHeaders)
  expect(within(rows[2]).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['Замовлення без назви · 1', 'Наш товар', ...buyerOrdersValues(response().Rows[0].Base, response().Rows[0].Stored)])
  for (const format of ['CSV', 'XLSX', 'PDF']) expect((screen.getByRole('button', { name: format }) as HTMLButtonElement).disabled).toBe(false)
})
it('missing buyerOrders monthly publication shows its real dependency and disables all exports', async () => {
  vi.clearAllMocks(); vi.mocked(readBuyerOrders).mockResolvedValue({ ...response(), Available: false, Code: 'original_buyer_orders_month_publication_unavailable',
    NormalInputsComplete: false, Rows: [], BaseTotals: null, StoredTotals: null, ProductChoices: [], FieldChoices: [], InputWitnessSha256: null })
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByText('Не всі місячні рухи замовлень покупців синхронізовані повністю.')
  for (const format of ['CSV', 'XLSX', 'PDF']) expect((screen.getByRole('button', { name: format }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.queryByText('Наш товар')).toBeNull()
})
it('late buyerOrders response cannot restore choices rows or exports after caller changes', async () => {
  vi.clearAllMocks(); let finish!: (result: BuyerOrdersResult) => void
  vi.mocked(readBuyerOrders).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect(readBuyerOrders).toHaveBeenCalledTimes(1)); const signal = vi.mocked(readBuyerOrders).mock.calls[0][1]
  view.rerender(panel('caller2')); expect(signal?.aborted).toBe(true); await act(async () => { finish(response()) })
  expect(screen.queryByText('Наш товар')).toBeNull()
  for (const format of ['CSV', 'XLSX', 'PDF']) expect((screen.getByRole('button', { name: format }) as HTMLButtonElement).disabled).toBe(true)
})
it('loss of generate permission clears buyerOrders result and cannot call its API again', async () => {
  vi.clearAllMocks(); vi.mocked(readBuyerOrders).mockResolvedValue(response()); const view = render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByText('Підсумок замовлення')
  view.rerender(panel('caller1', false)); expect(screen.queryByText('Підсумок замовлення')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); expect(readBuyerOrders).toHaveBeenCalledTimes(1)
})

it('buyer default form selects full order status and agreement identities from its own complete period', async () => {
  vi.clearAllMocks(); vi.mocked(readBuyerOrders).mockResolvedValue(response()); render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByText('Підсумок замовлення')
  for (const [field, label, option] of [[0, 'Замовлення', 'Замовлення без назви · 1'], [2, 'Статуси партій', 'Статус без назви · 1'], [3, 'Угоди', 'Угода без назви · 1']] as const) {
    fireEvent.click(screen.getByRole('combobox', { name: label })); fireEvent.click(await screen.findByRole('option', { name: option }));
    fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await waitFor(() => expect(vi.mocked(readBuyerOrders).mock.lastCall?.[0].Filters.some(f => f.Field === field)).toBe(true))
    await screen.findByText('Підсумок замовлення')
  }
  expect(vi.mocked(readBuyerOrders).mock.lastCall?.[0].Filters.find(f => f.Field === 0)).toMatchObject({ Type: '08', Table: '00000100', Reference: '4'.repeat(32) })
})
