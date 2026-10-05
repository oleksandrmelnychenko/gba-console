import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getAmgDiscountAnalysisCapability } from '../api/originalAmgDiscountAnalysisApi'
import type { AmgDiscountAnalysisCapability } from '../data/originalAmgDiscountAnalysis'
import { amgCapability } from '../testing/originalAmgDiscountAnalysisFixtures'
import type { ReportCatalogueEntry } from '../types'
import { OriginalAmgDiscountAnalysisCatalogueLaunch } from './OriginalAmgDiscountAnalysisCatalogueLaunch'
vi.mock('../api/originalAmgDiscountAnalysisApi', () => ({ getAmgDiscountAnalysisCapability: vi.fn() }))
const report = { Id: 'builtin:АнализСкидокНаценокНоменклатуры', Sources: [{ World: 'amg', SourceId: amgCapability.SourceId, DefinitionSha256: amgCapability.DefinitionSha256 }] } as ReportCatalogueEntry
const launch = (entry = report, enabled = true, caller: string | null = 'caller1') => <MantineProvider env="test"><I18nProvider><OriginalAmgDiscountAnalysisCatalogueLaunch
  report={entry} worlds={['fenix', 'amg']} enabled={enabled} disabled={false} callerKey={caller} /></I18nProvider></MantineProvider>
const button = () => screen.getByRole('button', { name: 'AMG · Аналіз знижок і націнок' }) as HTMLButtonElement
it('binds the dedicated launcher to exact AMG inventory identity and static own defaults', async () => {
  vi.clearAllMocks(); vi.mocked(getAmgDiscountAnalysisCapability).mockResolvedValue(amgCapability)
  const view = render(launch({ ...report, Sources: [{ ...report.Sources[0], DefinitionSha256: 'f'.repeat(64) }] })); expect(getAmgDiscountAnalysisCapability).not.toHaveBeenCalled()
  view.rerender(launch()); await waitFor(() => expect(button().disabled).toBe(false))
  expect(screen.getByText(/Поточні дані перевіряються/)).toBeTruthy(); expect(amgCapability.NormalInputsReadinessVerified).toBe(false)
})
it('never substitutes the same UUID Fenix source or generic dataset23 for the own form', () => {
  vi.clearAllMocks(); const view = render(launch({ ...report, Sources: [{ ...report.Sources[0], World: 'fenix' }] }))
  expect(screen.queryByRole('button', { name: 'AMG · Аналіз знижок і націнок' })).toBeNull(); view.rerender(launch({ ...report, Id: 'native:23' }))
  expect(screen.queryByRole('button', { name: 'AMG · Аналіз знижок і націнок' })).toBeNull(); expect(getAmgDiscountAnalysisCapability).not.toHaveBeenCalled()
})
it('denied permission and missing caller prevent I/O and opening', () => {
  vi.clearAllMocks(); const view = render(launch(report, false)); fireEvent.click(button()); expect(getAmgDiscountAnalysisCapability).not.toHaveBeenCalled()
  view.rerender(launch(report, true, null)); expect(button().disabled).toBe(true); expect(getAmgDiscountAnalysisCapability).not.toHaveBeenCalled()
})
it('cancels original capability across caller ABA and ignores its late completion', async () => {
  vi.clearAllMocks(); let finish!: (v: AmgDiscountAnalysisCapability) => void
  vi.mocked(getAmgDiscountAnalysisCapability).mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockImplementation(() => new Promise(() => {}))
  const view = render(launch()); await waitFor(() => expect(getAmgDiscountAnalysisCapability).toHaveBeenCalledTimes(1)); const signal = vi.mocked(getAmgDiscountAnalysisCapability).mock.calls[0][0]
  view.rerender(launch(report, true, 'caller2')); view.rerender(launch()); expect(signal?.aborted).toBe(true)
  await act(async () => { finish(amgCapability) }); expect(button().disabled).toBe(true)
})
