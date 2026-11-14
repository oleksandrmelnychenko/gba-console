import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { clearSession, saveSession } from '../../../shared/auth/session'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { previewSavedNativeReport, type SavedNativeReportResult } from '../api/savedNativeReportApi'
import { namedPriceDataset, namedPriceRequest } from '../data/namedPriceType.test-fixtures'
import { savedNativeReportConfigurationError } from '../data/savedNativeReport'
import type { NativeReportPreview, NativeReportPreviewRequest } from '../data/nativeReportPreview'
import type { SalesConstructorProfile } from '../data/salesConstructorProfiles'
import type { ReportTemplate } from '../types'
import { SavedNativeReportPanel } from './SavedNativeReportPanel'

vi.mock('../api/savedNativeReportApi', async original => ({ ...await original<typeof import('../api/savedNativeReportApi')>(),
  previewSavedNativeReport: vi.fn(), generateSavedNativeReport: vi.fn(),
}))
vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({ DocumentExportModal: () => null }))
const caller = { userNetUid: 'saved-format-owner', csrfToken: 'saved-format-csrf' }
type Props = ComponentProps<typeof SavedNativeReportPanel>
function saved(profile: SalesConstructorProfile | undefined, revision = 7): ReportTemplate {
  const data = namedPriceRequest(profile ?? 'sales')
  data.selections = []
  if (!profile) delete data.reportProfile
  data.sorted = { Row: [{ type: 5, key: 'Товар', label: 'Товар' }], Col: [],
    Measurements: [0, 2].map(Type => ({ Type, Name: namedPriceDataset.Measurements.find(field => field.Type === Type)!.Name,
      IsChecked: true, parentName: '' })) }
  return { Id: '11111111-1111-1111-1111-111111111111', Revision: revision, Name: 'Збережений формат', Data: data }
}
function outcome(template: ReportTemplate): SavedNativeReportResult {
  const Request: NativeReportPreviewRequest = { DataSource: 'NativeSalesNet', IsCurrentSnapshot: false,
    ObservationStartedAtUtc: null, ObservationCompletedAtUtc: null, HasPeriod: true,
    PeriodFrom: '01.10.2026', PeriodTo: '27.10.2026', ComparisonPeriodFrom: null, ComparisonPeriodTo: null,
    RowGroupings: ['Товар'], ColumnGroupings: [], Measures: ['Кількість', 'Вартість'], Filters: [], IgnoredFilters: [], Notes: [] }
  const preview: NativeReportPreview = { Version: 1, ResultSha256: 'b'.repeat(64), PresentationOnly: true, Request,
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: 1, ReturnedRows: 1, HasMore: false },
    RowSchema: [{ Caption: 'Товар' }], ColumnSchema: [{ Caption: 'Показник' }],
    Rows: [{ Ordinal: 0, SourceIndex: 1, Values: [{ Caption: 'Товар А' }] }],
    Columns: ['Кількість', 'Вартість'].map((Caption, index) => ({ Ordinal: index, SourceIndex: index, Values: [{ Caption }] })),
    Cells: ['27.0000000000000000000000', '12.3456'].map((Value, index) => ({ RowSourceIndex: 1, ColumnSourceIndex: index,
      Value: { Kind: 'decimal', Value, Provenance: 'producerCell' } })),
    valueSemantics: [0, 2].map((measureType, columnSourceIndex) => ({ columnSourceIndex, measureType,
      semantics: { kind: measureType === 0 ? 'quantity' : 'money', currencyPolicy: measureType === 0 ? 'notApplicable' : 'EUR',
        unitPolicy: measureType === 0 ? 'confirmedCompatibleUnit' : 'notApplicable', aggregation: 'sum', scalable: measureType !== 0,
        defaultDecimalPlaces: measureType === 0 ? 3 : 2, defaultMinimumDecimalPlaces: measureType === 0 ? 0 : 2 } })) }
  return { binding: { id: template.Id!, revision: template.Revision!, definitionSha256: 'a'.repeat(64) }, preview,
    result: { document: { DocumentURL: '/files/applied.xlsx' }, raw: {} } }
}
function Providers({ children }: { children: ReactNode }) {
  return <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider>
}
function view(template: ReportTemplate) {
  const base: Props = { template, datasets: [namedPriceDataset], callerKey: caller.userNetUid,
    enabled: true, current: true, onClose: vi.fn() }
  const rendered = render(<SavedNativeReportPanel {...base} />, { wrapper: Providers })
  return { change: (changes: Partial<Props>) => rendered.rerender(<SavedNativeReportPanel {...base} {...changes} />) }
}
function start() { fireEvent.click(screen.getByRole('button', { name: 'Показати збережений варіант' })) }
async function expectApplied(profile: SalesConstructorProfile | undefined) {
  const row = (await screen.findByRole('rowheader', { name: 'Товар А' })).closest('tr')!
  expect(within(row).getAllByRole('cell').map(cell => cell.textContent)).toEqual(profile
    ? ['27', '12,35'] : ['27', '12,3456'])
}
function expectCleared() { expect(screen.queryByRole('region', { name: 'Таблиця попереднього перегляду' })).toBeNull() }
beforeEach(() => { vi.clearAllMocks(); saveSession(caller) })
afterEach(() => { cleanup(); clearSession() })

it.each(['sales', 'grossProfit', undefined] as const)('formats a successful saved source2 %s run from its own validated applied profile only', async profile => {
  const template = saved(profile), response = outcome(template), before = JSON.stringify({ template, response })
  expect(savedNativeReportConfigurationError(template, [namedPriceDataset])).toBeNull()
  vi.mocked(previewSavedNativeReport).mockResolvedValueOnce(response)
  view(template); start(); await expectApplied(profile)
  const [target] = vi.mocked(previewSavedNativeReport).mock.calls[0]
  expect(target).toEqual({ id: template.Id, revision: 7, dataSource: 2 })
  expect(JSON.stringify({ template, response })).toBe(before)
  expect(response.preview?.numberPresentation).toBeUndefined()
})
it.each(['grossProfit', undefined] as const)('discards a pending saved sales result when the template changes to %s and binds only the next accepted revision', async profile => {
  const first = saved('sales'), next = saved(profile, 8)
  let complete!: (value: SavedNativeReportResult) => void
  vi.mocked(previewSavedNativeReport).mockReturnValueOnce(new Promise(resolve => { complete = resolve }))
  const rendered = view(first); start()
  const signal = vi.mocked(previewSavedNativeReport).mock.calls[0][1].signal
  rendered.change({ template: next })
  await act(async () => complete(outcome(first)))
  expect(signal.aborted).toBe(true); expectCleared()
  vi.mocked(previewSavedNativeReport).mockResolvedValueOnce(outcome(next))
  start(); await expectApplied(profile)
  expect(vi.mocked(previewSavedNativeReport).mock.calls[1][0]).toEqual({ id: next.Id, revision: 8, dataSource: 2 })
})
it.each(['caller', 'permission'] as const)('never installs a late applied profile after the %s scope changes, including after returning to the original scope', async reason => {
  const template = saved('grossProfit')
  let complete!: (value: SavedNativeReportResult) => void
  vi.mocked(previewSavedNativeReport).mockReturnValueOnce(new Promise(resolve => { complete = resolve }))
  const rendered = view(template); start()
  const signal = vi.mocked(previewSavedNativeReport).mock.calls[0][1].signal
  rendered.change(reason === 'caller' ? { callerKey: 'another-owner' } : { enabled: false })
  await act(async () => complete(outcome(template)))
  expect(signal.aborted).toBe(true); expectCleared()
  rendered.change({}); expectCleared()
  vi.mocked(previewSavedNativeReport).mockResolvedValueOnce(outcome(template))
  start(); await expectApplied('grossProfit')
})
