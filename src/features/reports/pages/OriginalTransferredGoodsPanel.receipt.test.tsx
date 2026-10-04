import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { readTransferred } from '../api/originalTransferredGoodsApi'
import { pointCapability, pointReceipt, pointResponse, emptyPointResponse, pointCaption } from '../testing/receiptPointFixtures'
import { product, response } from '../testing/transferredGoodsFixtures'
import type { TransferredResult } from '../data/originalTransferredGoods'
import { OriginalTransferredGoodsPanel } from './OriginalTransferredGoodsPanel'
vi.mock('../api/originalTransferredGoodsApi', () => ({ readTransferred: vi.fn() }))
const panel = (caller = 'caller1') => <MantineProvider env="test"><I18nProvider><OriginalTransferredGoodsPanel capability={pointCapability}
  callerKey={caller} canGenerate initialFrom="2026-09-01" initialThrough="2026-09-30" /></I18nProvider></MantineProvider>
it('transferred optional receipt mode starts off and sends exact admitted full tuples without changing the default request', async () => {
  vi.clearAllMocks(); vi.mocked(readTransferred).mockImplementation(async request => request.CurrentReceiptCaptionChoices ? pointResponse() : response())
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByText('Підсумок документа')
  expect(vi.mocked(readTransferred).mock.calls[0][0]).not.toHaveProperty('CurrentReceiptCaptionChoices')
  fireEvent.click(screen.getByRole('checkbox', { name: 'Поточні підписи документів GBA' })); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect((screen.getByRole('combobox', { name: 'Документи надходження' }) as HTMLInputElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('combobox', { name: 'Документи надходження' })); fireEvent.click(await screen.findByRole('option', { name: pointCaption }))
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await waitFor(() => expect(readTransferred).toHaveBeenCalledTimes(3))
  expect(vi.mocked(readTransferred).mock.calls[2][0]).toMatchObject({ CurrentReceiptCaptionChoices: true, Receipts: [pointReceipt] })
  await screen.findByText('Підсумок документа'); expect(screen.queryByText(pointReceipt.Reference)).toBeNull()
  for (const format of ['CSV', 'XLSX', 'PDF']) expect((screen.getByRole('button', { name: format }) as HTMLButtonElement).disabled).toBe(false)
})
it('transferred complete empty result keeps an active receipt removable with its prior human caption', async () => {
  vi.clearAllMocks(); vi.mocked(readTransferred).mockResolvedValueOnce(pointResponse()).mockResolvedValue(emptyPointResponse())
  render(panel()); fireEvent.click(screen.getByRole('checkbox', { name: 'Поточні підписи документів GBA' })); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByText('Підсумок документа'); fireEvent.click(screen.getByRole('combobox', { name: 'Документи надходження' }))
  fireEvent.click(await screen.findByRole('option', { name: pointCaption })); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByText('У повністю перевіреному періоді рядків немає.')
  expect((screen.getByRole('combobox', { name: 'Документи надходження' }) as HTMLInputElement).disabled).toBe(false)
  expect(screen.getByText(pointCaption)).toBeTruthy(); expect(screen.queryByText(pointReceipt.Reference)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Очистити відбір документів' })); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect(readTransferred).toHaveBeenCalledTimes(3)); expect(vi.mocked(readTransferred).mock.calls[2][0].Receipts).toEqual([])
})
it('transferred product scope changes invalidate receipt proof and every selected receipt', async () => {
  vi.clearAllMocks(); vi.mocked(readTransferred).mockResolvedValue(pointResponse()); render(panel())
  fireEvent.click(screen.getByRole('checkbox', { name: 'Поточні підписи документів GBA' })); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByText('Підсумок документа'); fireEvent.click(screen.getByRole('combobox', { name: 'Документи надходження' })); fireEvent.click(await screen.findByRole('option', { name: pointCaption }))
  fireEvent.click(screen.getByRole('combobox', { name: 'Товари' })); fireEvent.click(await screen.findByRole('option', { name: 'Наш товар' }))
  expect((screen.getByRole('combobox', { name: 'Документи надходження' }) as HTMLInputElement).disabled).toBe(true)
  expect(screen.queryByText(pointCaption)).toBeNull(); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect(readTransferred).toHaveBeenCalledTimes(2)); expect(vi.mocked(readTransferred).mock.calls[1][0]).toMatchObject({ Products: [product], Receipts: [] })
})
it.each(['caller', 'period'])('late transferred caption response cannot restore choices or exports after %s changes', async kind => {
  vi.clearAllMocks(); let finish!: (result: TransferredResult) => void
  vi.mocked(readTransferred).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(panel()); fireEvent.click(screen.getByRole('checkbox', { name: 'Поточні підписи документів GBA' })); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect(readTransferred).toHaveBeenCalledTimes(1)); const signal = vi.mocked(readTransferred).mock.calls[0][1]
  if (kind === 'caller') view.rerender(panel('caller2'))
  else fireEvent.change(screen.getByLabelText('Кінець періоду'), { target: { value: '2026-10-31' } })
  expect(signal?.aborted).toBe(true); await act(async () => { finish(pointResponse()) })
  expect(screen.queryByText(pointCaption)).toBeNull(); expect((screen.getByRole('combobox', { name: 'Документи надходження' }) as HTMLInputElement).disabled).toBe(true)
  for (const format of ['CSV', 'XLSX', 'PDF']) expect((screen.getByRole('button', { name: format }) as HTMLButtonElement).disabled).toBe(true)
})
