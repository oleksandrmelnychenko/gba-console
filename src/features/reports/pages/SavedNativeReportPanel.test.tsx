import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/apiClient'
import { clearSession, saveSession } from '../../../shared/auth/session'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { generateSavedNativeReport, previewSavedNativeReport, type SavedNativeReportResult } from '../api/savedNativeReportApi'
import { createSalesReportPreset } from '../data/reportPresets'
import { grossDataset } from '../data/reportDatasets.test-fixtures'
import { SavedNativeReportPanel } from './SavedNativeReportPanel'

vi.mock('../api/savedNativeReportApi', async original => ({ ...await original<typeof import('../api/savedNativeReportApi')>(),
  generateSavedNativeReport: vi.fn(), previewSavedNativeReport: vi.fn(),
}))
vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({
  DocumentExportModal: ({ opened, document, onClose }: { opened: boolean; document?: { DocumentURL?: string; PdfDocumentURL?: string }; onClose: () => void }) =>
    opened ? <div role="dialog" aria-label="Файли збереженого звіту">{document?.DocumentURL} {document?.PdfDocumentURL}
      <button type="button" onClick={onClose}>Закрити файли</button></div> : null,
}))

type Props = ComponentProps<typeof SavedNativeReportPanel>
const caller = { userNetUid: 'caller-a', csrfToken: 'csrf-a' }
const template = { ...createSalesReportPreset('agreements', '2026-09-01', '2026-09-07', []),
  Id: '11111111-1111-1111-1111-111111111111', Revision: 7, Name: 'Збережені договори' }
const definition = 'a'.repeat(64)
function outcome(revision = 7): SavedNativeReportResult {
  return { binding: { id: template.Id, revision, definitionSha256: definition },
    result: { document: { DocumentURL: '/files/saved.xlsx', PdfDocumentURL: '/files/saved.pdf' }, raw: {} },
    preview: { Version: 1, ResultSha256: 'b'.repeat(64), PresentationOnly: true, Request: null,
      Page: { Offset: 0, Limit: 50, TotalVisibleRows: 1, ReturnedRows: 1, HasMore: false },
      RowSchema: [{ Caption: 'Покупець' }], ColumnSchema: [{ Caption: 'Значення' }],
      Rows: [{ Ordinal: 0, SourceIndex: 1, Values: [{ Caption: 'Покупець А' }] }],
      Columns: [{ Ordinal: 0, SourceIndex: 2, Values: [{ Caption: 'Значення' }] }],
      Cells: [{ RowSourceIndex: 1, ColumnSourceIndex: 2, Value: { Kind: 'null', Value: null, Provenance: 'producerCell' } }],
    } }
}
function Providers({ children }: { children: ReactNode }) {
  return <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider>
}
function view(overrides: Partial<Props> = {}) {
  const base: Props = { template, datasets: [grossDataset], callerKey: caller.userNetUid,
    enabled: true, current: true, onClose: vi.fn() }
  const rendered = render(<SavedNativeReportPanel {...base} {...overrides} />, { wrapper: Providers })
  return { ...rendered, change: (changes: Partial<Props>) => rendered.rerender(<SavedNativeReportPanel {...base} {...changes} />) }
}
function preview() { fireEvent.click(screen.getByRole('button', { name: 'Показати збережений варіант' })) }
function noResult() {
  expect(screen.queryByRole('region', { name: 'Таблиця попереднього перегляду' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Файли збереженого звіту' })).toBeNull()
  expect(screen.queryByRole('dialog')).toBeNull()
}

describe('saved native version result isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks(); saveSession(caller)
    vi.mocked(previewSavedNativeReport).mockResolvedValue(outcome())
    vi.mocked(generateSavedNativeReport).mockResolvedValue({ ...outcome(), preview: undefined })
  })
  afterEach(() => clearSession())

  it('keeps NULL and the preview file links from one run, opening files without a second calculation', async () => {
    view(); preview()
    expect(await screen.findByRole('cell', { name: '∅' })).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Файли збереженого звіту' }))
    expect(screen.getByRole('dialog').textContent).toContain('/files/saved.xlsx')
    expect(screen.getByRole('dialog').textContent).toContain('/files/saved.pdf')
    expect(previewSavedNativeReport).toHaveBeenCalledOnce()
    expect(generateSavedNativeReport).not.toHaveBeenCalled()
    expect(vi.mocked(previewSavedNativeReport).mock.calls[0][0]).toEqual({ id: template.Id, revision: 7, dataSource: 0 })
  })

  it('binds a repeated file generation to the definition accepted by the prior preview', async () => {
    view(); preview(); await screen.findByRole('cell', { name: '∅' })
    fireEvent.click(screen.getByRole('button', { name: 'Сформувати збережений варіант' }))
    await screen.findByRole('dialog')
    expect(vi.mocked(generateSavedNativeReport).mock.calls[0][0]).toEqual({ id: template.Id, revision: 7,
      dataSource: 0, expectedDefinitionSha256: definition })
    expect(previewSavedNativeReport).toHaveBeenCalledOnce()
  })

  it('shows a saved revision refusal and clears prior files rather than retaining them', async () => {
    view(); preview(); await screen.findByRole('cell', { name: '∅' })
    vi.mocked(previewSavedNativeReport).mockRejectedValueOnce(new ApiError('stale revision', 409, null))
    preview()
    expect((await screen.findByRole('alert')).textContent).toContain('Оновіть список шаблонів')
    noResult(); expect(generateSavedNativeReport).not.toHaveBeenCalled()
  })

  it('discards a deferred response after a version becomes stale, even when the same version is selected again', async () => {
    let complete!: (value: SavedNativeReportResult) => void
    vi.mocked(previewSavedNativeReport).mockReturnValueOnce(new Promise(resolve => { complete = resolve }))
    const rendered = view(); preview()
    const oldSignal = vi.mocked(previewSavedNativeReport).mock.calls[0][1].signal
    rendered.change({ current: false })
    expect((screen.getByRole('button', { name: 'Показати збережений варіант' }) as HTMLButtonElement).disabled).toBe(true)
    rendered.change({ current: true })
    await act(async () => complete(outcome()))
    expect(oldSignal.aborted).toBe(true); noResult()
    preview(); expect(await screen.findByRole('cell', { name: '∅' })).toBeTruthy()
    expect(previewSavedNativeReport).toHaveBeenCalledTimes(2)
  })

  it('clears accepted files when the saved revision changes and starts a new binding', async () => {
    const rendered = view(); preview(); await screen.findByRole('cell', { name: '∅' })
    rendered.change({ template: { ...template, Revision: 8 } }); noResult()
    vi.mocked(previewSavedNativeReport).mockResolvedValueOnce(outcome(8))
    preview(); await screen.findByRole('cell', { name: '∅' })
    expect(vi.mocked(previewSavedNativeReport).mock.calls[1][0]).toEqual({ id: template.Id, revision: 8, dataSource: 0 })
  })

  it.each(['permission', 'caller', 'catalogue'])('rejects a late response after %s changes', async cause => {
    let complete!: (value: SavedNativeReportResult) => void
    vi.mocked(previewSavedNativeReport).mockReturnValueOnce(new Promise(resolve => { complete = resolve }))
    const rendered = view(); preview()
    rendered.change(cause === 'permission' ? { enabled: false }
      : cause === 'caller' ? { callerKey: 'caller-b' } : { datasets: [] })
    await act(async () => complete(outcome()))
    noResult()
    rendered.change({}); noResult()
  })

  it('does not start using another browser session or missing catalogue capabilities', () => {
    const rendered = view(); saveSession({ userNetUid: 'caller-b', csrfToken: 'csrf-b' }); preview()
    expect(previewSavedNativeReport).not.toHaveBeenCalled()
    saveSession(caller)
    rendered.change({ datasets: [{ ...grossDataset, Measurements: [] }] })
    expect((screen.getByRole('button', { name: 'Показати збережений варіант' }) as HTMLButtonElement).disabled).toBe(true)
    preview(); expect(previewSavedNativeReport).not.toHaveBeenCalled()
  })

  it('aborts the pending saved run when the panel is closed', async () => {
    let complete!: (value: SavedNativeReportResult) => void
    vi.mocked(previewSavedNativeReport).mockReturnValueOnce(new Promise(resolve => { complete = resolve }))
    const rendered = view(); preview()
    await waitFor(() => expect(previewSavedNativeReport).toHaveBeenCalledOnce())
    const signal = vi.mocked(previewSavedNativeReport).mock.calls[0][1].signal
    rendered.unmount(); expect(signal.aborted).toBe(true)
    await act(async () => complete(outcome()))
    noResult()
  })
})
