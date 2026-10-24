import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { readMovement } from '../api/originalWarehouseMovementApi'
import { movementPdf, movementPdfDefinition, movementXlsx } from '../data/originalWarehouseMovementExport'
import { movementFixture, movementPublication } from '../data/originalWarehouseMovement.test-fixtures'
import type { MovementResult } from '../data/originalWarehouseMovement'
import { OriginalWarehouseMovementPanel } from './OriginalWarehouseMovementPanel'
vi.mock('../api/originalWarehouseMovementApi', () => ({ readMovement: vi.fn() }))
vi.mock('../data/originalWarehouseMovementExport', async original => ({ ...await original<typeof import('../data/originalWarehouseMovementExport')>(), movementXlsx: vi.fn(), movementPdf: vi.fn() }))
const publication = { ...movementPublication, Capture: { ...movementPublication.Capture, Through: '2026-09-30' } }
const panel = (caller = 'caller1', allowed = true) => <MantineProvider env="test"><I18nProvider><OriginalWarehouseMovementPanel publications={[publication]} callerKey={caller} canGenerate={allowed} /></I18nProvider></MantineProvider>
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(readMovement).mockResolvedValue(structuredClone(movementFixture))
  vi.mocked(movementXlsx).mockResolvedValue(new Blob(['file']))
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:movement') })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})
it('applies the complete form; changing dates retains warehouses and old table/export even when draft invalid', async () => {
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Застосувати й показати' }))
  await screen.findByRole('table', { name: 'Рух товару за складськими документами' })
  expect(vi.mocked(readMovement).mock.calls[0][0]).toEqual({ Version: 1, World: 'fenix', From: '2026-09-01', Through: '2026-09-30', Article: 'TEST-ARTICLE', Warehouses: publication.Warehouses.map(w => w.Reference) })
  fireEvent.change(screen.getByLabelText('Від'), { target: { value: '01.12.2026' } }); fireEvent.blur(screen.getByLabelText('Від'))
  expect(screen.getByText(/Налаштування змінено/)).toBeTruthy()
  expect(screen.getByLabelText('Період сформованого руху').textContent).toContain('2026-09-01 — 2026-09-30')
  expect((screen.getByRole('button', { name: 'Застосувати й показати' }) as HTMLButtonElement).disabled).toBe(true)
  expect((screen.getByRole('button', { name: 'XLSX' }) as HTMLButtonElement).disabled).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'XLSX' }))
  await waitFor(() => expect(movementXlsx).toHaveBeenCalledWith(movementFixture))
  expect(readMovement).toHaveBeenCalledOnce()
  expect(screen.getByRole('combobox', { name: 'Склади' }).closest('.mantine-MultiSelect-root')?.textContent).toContain('Тестовий склад 1')
})
it('does not replace an accepted result with an unavailable subset or invented zeros', async () => {
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Застосувати й показати' }))
  await screen.findByRole('table')
  vi.mocked(readMovement).mockResolvedValue({ ...movementFixture, Available: false, Rows: [], Totals: null, ResultSha256: null })
  fireEvent.click(screen.getByRole('button', { name: 'Застосувати й показати' }))
  await screen.findByText(/Попередній результат збережено/)
  expect(screen.getByRole('table')).toBeTruthy(); expect((screen.getByRole('button', { name: 'CSV' }) as HTMLButtonElement).disabled).toBe(false)
})
it('aborts late responses on caller change; restores no table or download on permission roundtrip', async () => {
  let finish!: (value: MovementResult) => void
  vi.mocked(readMovement).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Застосувати й показати' }))
  const signal = vi.mocked(readMovement).mock.calls[0][2]
  view.rerender(panel('caller2')); expect(signal?.aborted).toBe(true)
  await act(async () => { finish(movementFixture) }); expect(screen.queryByRole('table')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Застосувати й показати' })); await screen.findByRole('table')
  let exportFinish!: (value: Blob) => void
  vi.mocked(movementXlsx).mockImplementationOnce(() => new Promise(resolve => { exportFinish = resolve }))
  fireEvent.click(screen.getByRole('button', { name: 'XLSX' })); view.rerender(panel('caller2', false)); view.rerender(panel('caller2', true))
  await act(async () => { exportFinish(new Blob(['late'])) })
  expect(URL.createObjectURL).not.toHaveBeenCalled(); expect(screen.queryByRole('table')).toBeNull()
})
it('shows partial final-day status from capture, regardless current date', async () => {
  const result = { ...movementFixture, Scope: { ...movementFixture.Scope, Through: movementFixture.Capture!.Through } }
  vi.mocked(readMovement).mockResolvedValue(result)
  render(<MantineProvider env="test"><I18nProvider><OriginalWarehouseMovementPanel publications={[movementPublication]} callerKey="caller1" canGenerate /></I18nProvider></MantineProvider>)
  fireEvent.change(screen.getByLabelText('Від'), { target: { value: '01.09.2026' } }); fireEvent.blur(screen.getByLabelText('Від'))
  fireEvent.click(screen.getByRole('button', { name: 'Застосувати й показати' }))
  await screen.findByText('Останній день періоду ще не завершений у джерельному зрізі.')
})

it('keeps the table and editable draft alive after PDF normalizes its private table cells', async () => {
  vi.mocked(movementPdf).mockImplementationOnce(async result => {
    const definition = movementPdfDefinition(result)
    const table = definition.content.find(item => typeof item === 'object' && item !== null && 'table' in item) as { table: { body: unknown[][] } }
    table.table.body[0].forEach((text, index) => { table.table.body[0][index] = { text, fillColor: '#fff' } })
    return new Blob(['%PDF-1.3'])
  })
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Застосувати й показати' }))
  await screen.findByRole('table')
  fireEvent.click(screen.getByRole('button', { name: 'PDF' }))
  await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledOnce())
  await waitFor(() => expect((screen.getByRole('button', { name: 'PDF' }) as HTMLButtonElement).disabled).toBe(false))
  expect(screen.getByRole('columnheader', { name: 'Початковий залишок' })).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Від'), { target: { value: '02.09.2026' } }); fireEvent.blur(screen.getByLabelText('Від'))
  expect(screen.getByText(/Налаштування змінено/)).toBeTruthy()
  expect(screen.getByRole('columnheader', { name: 'Прихід' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'XLSX' }))
  await waitFor(() => expect(movementXlsx).toHaveBeenCalledWith(movementFixture))
})
