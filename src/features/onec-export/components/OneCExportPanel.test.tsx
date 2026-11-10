import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadOneCExportBatch, exportToOneC, getOneCExportRuns, saveDownloadedFile } from '../api/oneCExportApi'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { OneCExportPanel } from './OneCExportPanel'

vi.mock('../api/oneCExportApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/oneCExportApi')>()
  return {
    ...actual,
    downloadOneCExportBatch: vi.fn(),
    exportToOneC: vi.fn(),
    getOneCExportRuns: vi.fn(),
    saveDownloadedFile: vi.fn(),
  }
})

const runs = vi.mocked(getOneCExportRuns)
const exportFile = vi.mocked(exportToOneC)
const redownload = vi.mocked(downloadOneCExportBatch)
const save = vi.mocked(saveDownloadedFile)
const file = { blob: new Blob(['x']), fileName: 'gba-1c-20261101-20261104.zip', batchNetUid: 'batch-1', warningCount: 0 }

function mount() {
  return render(<MantineProvider env="test"><I18nProvider><OneCExportPanel /></I18nProvider></MantineProvider>)
}

beforeEach(() => {
  runs.mockReset()
  exportFile.mockReset()
  redownload.mockReset()
  save.mockReset()
  runs.mockResolvedValue([{
    NetUid: 'run-1', BatchNetUid: 'batch-0', CreatedAtUtc: '2026-11-04T08:00:00Z', UserName: 'Петренко Петро',
    Base: 'Fenix', BaseName: 'Фенікс', PeriodFrom: '2026-11-01T00:00:00', PeriodTo: '2026-11-03T00:00:00',
    DocumentTypes: ['Sale'], DocumentCount: 12, DeletedCount: 2, FirstCount: 10, ChangedCount: 2,
    FileName: 'gba-1c-fenix-20261101-20261103.xml', FileSha256: null, FileLength: 100,
  }])
  exportFile.mockResolvedValue(file)
  redownload.mockResolvedValue(file)
})
afterEach(cleanup)

describe('1C export panel', () => {
  it('exports both bases and the confirmed document types by default and saves the file', async () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Вивантажити' }))

    await waitFor(() => expect(exportFile).toHaveBeenCalledTimes(1))
    const request = exportFile.mock.calls[0][0]
    expect(request.bases).toEqual(['Fenix', 'Amg'])
    expect(request.types).toEqual([
      'Sale', 'SaleReturn', 'ProductIncome', 'ProductTransfer', 'WriteOff', 'Capitalization',
      'IncomePayment', 'OutgoingPayment', 'RegisterTransfer', 'CurrencyExchange', 'ReSale',
    ])
    expect(request.from).toBe(request.to)
    await waitFor(() => expect(save).toHaveBeenCalledWith(file))
    expect(runs).toHaveBeenCalledTimes(2)
  })

  it('shows a history loading failure without initiating an export', async () => {
    runs.mockRejectedValueOnce(new Error('Журнал тимчасово недоступний'))
    mount()

    expect(await screen.findByText('Журнал тимчасово недоступний')).toBeTruthy()
    expect(exportFile).not.toHaveBeenCalled()
  })

  it('refuses to export without a base', async () => {
    mount()
    fireEvent.click(screen.getByLabelText('Фенікс'))
    fireEvent.click(screen.getByLabelText('АМГ'))
    fireEvent.click(screen.getByRole('button', { name: 'Вивантажити' }))

    await waitFor(() => expect(runs).toHaveBeenCalled())
    expect(exportFile).not.toHaveBeenCalled()
  })

  it('shows the history and downloads a stored file again', async () => {
    mount()
    expect(await screen.findByText('Петренко Петро')).toBeTruthy()
    expect(screen.getByText('01.11.2026 – 03.11.2026')).toBeTruthy()
    expect(screen.getByText('12 (видалено: 2)')).toBeTruthy()
    expect(screen.getByText('04.11.2026, 10:00')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Завантажити файл gba-1c-fenix-20261101-20261103.xml' }))

    await waitFor(() => expect(redownload).toHaveBeenCalledWith('batch-0'))
    await waitFor(() => expect(save).toHaveBeenCalledWith(file))
  })

  it('shows the server-local run time as is and lists the warnings of the export', async () => {
    runs.mockResolvedValue([{
      NetUid: 'run-2', BatchNetUid: 'batch-1', CreatedAtUtc: '2026-11-05T17:30:00', UserName: 'Петренко Петро',
      Base: 'Amg', BaseName: 'АМГ', PeriodFrom: '2026-11-05T00:00:00', PeriodTo: '2026-11-05T00:00:00',
      DocumentTypes: ['Sale'], DocumentCount: 3, DeletedCount: 0, FirstCount: 3, ChangedCount: 0,
      FileName: 'gba-1c-amg-20261105-20261105.xml', FileSha256: null, FileLength: 100, SkippedCount: 1,
      Warnings: [{ Code: 'MissingStorage', Skipped: true, Type: 'Sale', NetUid: 'sale-1', Number: 'КОк1', Line: null,
        Message: 'Не визначено склад документа.' }],
    }])
    exportFile.mockResolvedValue({ ...file, warningCount: 1 })
    mount()
    expect(await screen.findByText('05.11.2026, 17:30')).toBeTruthy()
    expect(screen.getByText('3 (пропущено: 1)')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Вивантажити' }))

    expect(await screen.findByText('Пропущено: Видаткові накладні КОк1: АМГ. Не визначено склад документа.')).toBeTruthy()
  })
})
