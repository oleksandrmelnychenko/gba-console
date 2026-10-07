import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getFenixDiscountCapability } from '../api/originalFenixDiscountAnalysisApi'
import type { FenixDiscountCapability } from '../data/originalFenixDiscountAnalysis'
import { fenixCapability } from '../testing/originalFenixDiscountAnalysisFixtures'
import type { ReportCatalogueEntry } from '../types'
import { OriginalFenixDiscountAnalysisCatalogueLaunch } from './OriginalFenixDiscountAnalysisCatalogueLaunch'
vi.mock('../api/originalFenixDiscountAnalysisApi', () => ({ getFenixDiscountCapability: vi.fn() }))
const report = { Id: 'builtin:АнализСкидокНаценокНоменклатуры', Sources: [{ World: 'fenix', SourceId: fenixCapability.SourceId, DefinitionSha256: fenixCapability.DefinitionSha256 }] } as ReportCatalogueEntry
const launch = (entry = report, enabled = true, caller: string | null = 'caller1') => <MantineProvider env="test"><I18nProvider><OriginalFenixDiscountAnalysisCatalogueLaunch
  report={entry} worlds={['fenix', 'amg']} enabled={enabled} disabled={false} callerKey={caller} /></I18nProvider></MantineProvider>
const button = () => screen.getByRole('button', { name: 'Fenix · Аналіз знижок і націнок' }) as HTMLButtonElement
it('binds the dedicated launcher to exact Fenix inventory identity and static own defaults', async () => {
  vi.clearAllMocks(); vi.mocked(getFenixDiscountCapability).mockResolvedValue(fenixCapability)
  const view = render(launch({ ...report, Sources: [{ ...report.Sources[0], DefinitionSha256: 'f'.repeat(64) }] })); expect(getFenixDiscountCapability).not.toHaveBeenCalled()
  view.rerender(launch()); await waitFor(() => expect(button().disabled).toBe(false))
  expect(screen.getByText(/Поточні дані перевіряються/)).toBeTruthy(); expect(fenixCapability.NormalInputsReadinessVerified).toBe(false)
})
it('never substitutes the same UUID AMG source or generic dataset23 for the own form', () => {
  vi.clearAllMocks(); const view = render(launch({ ...report, Sources: [{ ...report.Sources[0], World: 'amg' }] }))
  expect(screen.queryByRole('button', { name: 'Fenix · Аналіз знижок і націнок' })).toBeNull(); view.rerender(launch({ ...report, Id: 'native:23' }))
  expect(screen.queryByRole('button', { name: 'Fenix · Аналіз знижок і націнок' })).toBeNull(); expect(getFenixDiscountCapability).not.toHaveBeenCalled()
})
it('denied permission and missing caller prevent I/O and opening', () => {
  vi.clearAllMocks(); const view = render(launch(report, false)); fireEvent.click(button()); expect(getFenixDiscountCapability).not.toHaveBeenCalled()
  view.rerender(launch(report, true, null)); expect(button().disabled).toBe(true); expect(getFenixDiscountCapability).not.toHaveBeenCalled()
})
it('cancels original capability across caller ABA and ignores its late completion', async () => {
  vi.clearAllMocks(); let finish!: (v: FenixDiscountCapability) => void
  vi.mocked(getFenixDiscountCapability).mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockImplementation(() => new Promise(() => {}))
  const view = render(launch()); await waitFor(() => expect(getFenixDiscountCapability).toHaveBeenCalledTimes(1)); const signal = vi.mocked(getFenixDiscountCapability).mock.calls[0][0]
  view.rerender(launch(report, true, 'caller2')); view.rerender(launch()); expect(signal?.aborted).toBe(true)
  await act(async () => { finish(fenixCapability) }); expect(button().disabled).toBe(true)
})
