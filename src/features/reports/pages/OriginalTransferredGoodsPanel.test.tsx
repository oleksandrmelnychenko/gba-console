import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { readTransferred } from '../api/originalTransferredGoodsApi'
import { capability, product, response } from '../testing/transferredGoodsFixtures'
import type { TransferredResult } from '../data/originalTransferredGoods'
import { OriginalTransferredGoodsPanel } from './OriginalTransferredGoodsPanel'
import { transferredHeaders, transferredValues } from '../data/originalTransferredGoodsExport'
vi.mock('../api/originalTransferredGoodsApi', () => ({ readTransferred: vi.fn() }))
const panel = (caller = 'caller1', canGenerate = true) => <MantineProvider env="test"><I18nProvider>
  <OriginalTransferredGoodsPanel capability={capability} callerKey={caller} canGenerate={canGenerate} initialFrom="2026-09-01" initialThrough="2026-09-30" />
</I18nProvider></MantineProvider>
it('transferred form sends own period and only admitted human product equality choices', async () => {
  vi.clearAllMocks(); vi.mocked(readTransferred).mockResolvedValue(response()); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect((screen.getByRole('combobox', { name: 'Товари' }) as HTMLInputElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('combobox', { name: 'Товари' })); fireEvent.click(await screen.findByRole('option', { name: 'Наш товар' }))
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect(readTransferred).toHaveBeenCalledTimes(2))
  expect(vi.mocked(readTransferred).mock.calls[1][0]).toMatchObject({ SourceId: capability.SourceId, Products: [product], Receipts: [] })
  expect(screen.queryByText(product)).toBeNull(); expect(screen.queryByRole('combobox', { name: 'Склади' })).toBeNull()
})
it('transferred screen preserves receipt parent before product and every signed resource from one completed result', async () => {
  vi.clearAllMocks(); vi.mocked(readTransferred).mockResolvedValue(response()); render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByText('Підсумок документа')
  const rows = screen.getAllByRole('row'); expect(rows[1].textContent).toContain('Підсумок документа'); expect(rows[2].textContent).toContain('Наш товар')
  expect(within(rows[0]).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual(transferredHeaders)
  expect(within(rows[2]).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['Назва документа недоступна', 'Наш товар', ...transferredValues(response().Rows[0].Resources)])
  for (const format of ['CSV', 'XLSX', 'PDF']) expect((screen.getByRole('button', { name: format }) as HTMLButtonElement).disabled).toBe(false)
})
it('missing transferred monthly publication shows its real dependency and disables all exports', async () => {
  vi.clearAllMocks(); vi.mocked(readTransferred).mockResolvedValue({ ...response(), Available: false, Code: 'original_transferred_month_publication_unavailable',
    NormalInputsComplete: false, Rows: [], Totals: null, ProductChoices: [], InputWitnessSha256: null, ResultSha256: null })
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByText('Не всі місячні рухи переданих товарів синхронізовані повністю.')
  for (const format of ['CSV', 'XLSX', 'PDF']) expect((screen.getByRole('button', { name: format }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.queryByText('Наш товар')).toBeNull()
})
it('late transferred response cannot restore choices rows or exports after caller changes', async () => {
  vi.clearAllMocks(); let finish!: (result: TransferredResult) => void
  vi.mocked(readTransferred).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect(readTransferred).toHaveBeenCalledTimes(1)); const signal = vi.mocked(readTransferred).mock.calls[0][1]
  view.rerender(panel('caller2')); expect(signal?.aborted).toBe(true); await act(async () => { finish(response()) })
  expect(screen.queryByText('Наш товар')).toBeNull()
  for (const format of ['CSV', 'XLSX', 'PDF']) expect((screen.getByRole('button', { name: format }) as HTMLButtonElement).disabled).toBe(true)
})
it('loss of generate permission clears transferred result and cannot call its API again', async () => {
  vi.clearAllMocks(); vi.mocked(readTransferred).mockResolvedValue(response()); const view = render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByText('Підсумок документа')
  view.rerender(panel('caller1', false)); expect(screen.queryByText('Підсумок документа')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); expect(readTransferred).toHaveBeenCalledTimes(1)
})
