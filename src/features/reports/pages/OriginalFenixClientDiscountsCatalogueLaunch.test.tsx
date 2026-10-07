import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getFenixDiscountReadiness } from '../api/originalFenixClientDiscountsApi'
import type { FenixDiscountReadiness } from '../data/originalFenixClientDiscounts'
import { fenixReadiness } from '../testing/originalFenixClientDiscountsFixtures'
import type { ReportCatalogueEntry } from '../types'
import { OriginalFenixClientDiscountsCatalogueLaunch } from './OriginalFenixClientDiscountsCatalogueLaunch'
vi.mock('../api/originalFenixClientDiscountsApi', () => ({ getFenixDiscountReadiness: vi.fn() }))
const report = { Id: 'builtin:ОтчетПоСкидкам', Sources: [{ World: 'fenix', SourceId: fenixReadiness.SourceId, DefinitionSha256: fenixReadiness.DefinitionSha256 }] } as ReportCatalogueEntry
const launch = (entry = report, enabled = true, caller: string | null = 'caller1') => <MantineProvider env="test"><I18nProvider><OriginalFenixClientDiscountsCatalogueLaunch
  report={entry} worlds={['fenix', 'amg']} enabled={enabled} disabled={false} callerKey={caller} /></I18nProvider></MantineProvider>
const button = () => screen.getByRole('button', { name: 'FENIX · ОтчетПоСкидкам' }) as HTMLButtonElement
it('launches only exact FENIX source and definition after dynamic ordinary readiness', async () => {
  vi.clearAllMocks(); vi.mocked(getFenixDiscountReadiness).mockResolvedValue(fenixReadiness)
  const view = render(launch({ ...report, Sources: [{ ...report.Sources[0], DefinitionSha256: 'f'.repeat(64) }] })); expect(getFenixDiscountReadiness).not.toHaveBeenCalled()
  view.rerender(launch()); await waitFor(() => expect(button().disabled).toBe(false)); expect(getFenixDiscountReadiness).toHaveBeenCalledTimes(1)
})
it('never substitutes Fenix identity or a native generic dataset', () => {
  vi.clearAllMocks(); const view = render(launch({ ...report, Sources: [{ ...report.Sources[0], World: 'amg' }] }))
  expect(screen.queryByRole('button', { name: 'FENIX · ОтчетПоСкидкам' })).toBeNull(); view.rerender(launch({ ...report, Id: 'native:25' }))
  expect(screen.queryByRole('button', { name: 'FENIX · ОтчетПоСкидкам' })).toBeNull(); expect(getFenixDiscountReadiness).not.toHaveBeenCalled()
})
it('missing ordinary readiness, permission or caller blocks launching and permission denial blocks I/O', async () => {
  vi.clearAllMocks(); vi.mocked(getFenixDiscountReadiness).mockResolvedValue({ ...fenixReadiness, Executable: false, OurSnapshotVerified: false })
  const view = render(launch(report, false)); fireEvent.click(button()); expect(getFenixDiscountReadiness).not.toHaveBeenCalled()
  view.rerender(launch(report, true, null)); expect(button().disabled).toBe(true); expect(getFenixDiscountReadiness).not.toHaveBeenCalled()
  view.rerender(launch()); await waitFor(() => expect(getFenixDiscountReadiness).toHaveBeenCalledTimes(1)); expect(button().disabled).toBe(true)
})
it('rejects late readiness from the original caller after a scope replacement', async () => {
  vi.clearAllMocks(); let finish!: (v: FenixDiscountReadiness) => void
  vi.mocked(getFenixDiscountReadiness).mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockResolvedValueOnce({ ...fenixReadiness, Executable: false, OurSnapshotVerified: false })
  const view = render(launch()); await waitFor(() => expect(getFenixDiscountReadiness).toHaveBeenCalledTimes(1)); const signal = vi.mocked(getFenixDiscountReadiness).mock.calls[0][0]
  view.rerender(launch(report, true, 'caller2')); expect(signal?.aborted).toBe(true); await act(async () => { finish(fenixReadiness) }); expect(button().disabled).toBe(true)
})
