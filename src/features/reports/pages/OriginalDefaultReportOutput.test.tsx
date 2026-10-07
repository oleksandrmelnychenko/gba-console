import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { defaultSheetBlob, defaultSheetExportError, type OriginalDefaultSheet } from '../data/originalDefaultReportExport'
import { OriginalDefaultReportOutput } from './OriginalDefaultReportOutput'
vi.mock('../data/originalDefaultReportExport', async importOriginal => ({ ...await importOriginal<typeof import('../data/originalDefaultReportExport')>(), defaultSheetBlob: vi.fn() }))
const sheet: OriginalDefaultSheet = { title: 'Доступні кошти', from: '2026-10-06T12-34-56', through: '2026-10-06T12-34-56', scopeLabel: 'Стан перед 2026-10-06 12:34:56', headers: ['Рахунок', 'Сума'], labelColumns: 1,
  lines: Array.from({ length: 51 }, (_, i) => ({ key: String(i), cells: [`Рахунок ${i + 1}`, `${i + 1}.00`] })), total: null, note: '' }
const output = (allowExport = true) => <MantineProvider env="test"><I18nProvider><OriginalDefaultReportOutput sheet={sheet} filename="availability" allowExport={allowExport} /></I18nProvider></MantineProvider>
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear() })
it('maps only displayed page while whole 51-row result is passed intact to export', async () => {
  let finish!: (value: Blob) => void; vi.mocked(defaultSheetBlob).mockImplementation(() => new Promise(resolve => { finish = resolve })); const view = render(output())
  expect(screen.getAllByRole('cell')).toHaveLength(100); expect(screen.queryByRole('cell', { name: 'Рахунок 51' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Наступні рядки' })); expect(screen.getAllByRole('cell')).toHaveLength(2); expect(screen.getByRole('cell', { name: 'Рахунок 51' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'XLSX' })); expect(defaultSheetBlob).toHaveBeenCalledWith(sheet, 'xlsx'); expect(defaultSheetExportError(sheet)).toBeNull()
  view.unmount(); await act(async () => { finish(new Blob(['completed'])) })
})
it('unknown-input display cannot export but existing other report callers retain default export permission', () => {
  const view = render(output(false)); for (const name of ['CSV', 'XLSX', 'PDF']) expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true)
  view.rerender(output()); expect((screen.getByRole('button', { name: 'CSV' }) as HTMLButtonElement).disabled).toBe(false)
})
it('layout unmount cancels a deferred file before object URL or download creation', async () => {
  let finish!: (value: Blob) => void; vi.mocked(defaultSheetBlob).mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const create = vi.fn(), prior = URL.createObjectURL; URL.createObjectURL = create
  try { const view = render(output()); fireEvent.click(screen.getByRole('button', { name: 'XLSX' })); view.unmount(); await act(async () => { finish(new Blob(['late'])) }); expect(create).not.toHaveBeenCalled() }
  finally { URL.createObjectURL = prior }
})
