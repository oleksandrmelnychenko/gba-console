import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getAmgDiscountReadiness } from '../api/originalAmgClientDiscountsApi'
import type { AmgDiscountReadiness } from '../data/originalAmgClientDiscounts'
import { amgReadiness } from '../testing/originalAmgClientDiscountsFixtures'
import type { ReportCatalogueEntry } from '../types'
import { OriginalAmgClientDiscountsCatalogueLaunch } from './OriginalAmgClientDiscountsCatalogueLaunch'
vi.mock('../api/originalAmgClientDiscountsApi', () => ({ getAmgDiscountReadiness: vi.fn() }))
const report = { Id: 'builtin:ОтчетПоСкидкам', Sources: [{ World: 'amg', SourceId: amgReadiness.SourceId, DefinitionSha256: amgReadiness.DefinitionSha256 }] } as ReportCatalogueEntry
const launch = (entry = report, enabled = true, caller: string | null = 'caller1') => <MantineProvider env="test"><I18nProvider><OriginalAmgClientDiscountsCatalogueLaunch
  report={entry} worlds={['amg', 'fenix']} enabled={enabled} disabled={false} callerKey={caller} /></I18nProvider></MantineProvider>
const button = () => screen.getByRole('button', { name: 'AMG · ОтчетПоСкидкам' }) as HTMLButtonElement
it('launches only exact AMG source and definition after dynamic ordinary readiness', async () => {
  vi.clearAllMocks(); vi.mocked(getAmgDiscountReadiness).mockResolvedValue(amgReadiness)
  const view = render(launch({ ...report, Sources: [{ ...report.Sources[0], DefinitionSha256: 'f'.repeat(64) }] })); expect(getAmgDiscountReadiness).not.toHaveBeenCalled()
  view.rerender(launch()); await waitFor(() => expect(button().disabled).toBe(false)); expect(getAmgDiscountReadiness).toHaveBeenCalledTimes(1)
})
it('never substitutes Fenix identity or a native generic dataset', () => {
  vi.clearAllMocks(); const view = render(launch({ ...report, Sources: [{ ...report.Sources[0], World: 'fenix' }] }))
  expect(screen.queryByRole('button', { name: 'AMG · ОтчетПоСкидкам' })).toBeNull(); view.rerender(launch({ ...report, Id: 'native:25' }))
  expect(screen.queryByRole('button', { name: 'AMG · ОтчетПоСкидкам' })).toBeNull(); expect(getAmgDiscountReadiness).not.toHaveBeenCalled()
})
it('missing ordinary readiness, permission or caller blocks launching and permission denial blocks I/O', async () => {
  vi.clearAllMocks(); vi.mocked(getAmgDiscountReadiness).mockResolvedValue({ ...amgReadiness, Executable: false, OurSnapshotVerified: false })
  const view = render(launch(report, false)); fireEvent.click(button()); expect(getAmgDiscountReadiness).not.toHaveBeenCalled()
  view.rerender(launch(report, true, null)); expect(button().disabled).toBe(true); expect(getAmgDiscountReadiness).not.toHaveBeenCalled()
  view.rerender(launch()); await waitFor(() => expect(getAmgDiscountReadiness).toHaveBeenCalledTimes(1)); expect(button().disabled).toBe(true)
})
it('rejects late readiness from the original caller after a scope replacement', async () => {
  vi.clearAllMocks(); let finish!: (v: AmgDiscountReadiness) => void
  vi.mocked(getAmgDiscountReadiness).mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockResolvedValueOnce({ ...amgReadiness, Executable: false, OurSnapshotVerified: false })
  const view = render(launch()); await waitFor(() => expect(getAmgDiscountReadiness).toHaveBeenCalledTimes(1)); const signal = vi.mocked(getAmgDiscountReadiness).mock.calls[0][0]
  view.rerender(launch(report, true, 'caller2')); expect(signal?.aborted).toBe(true); await act(async () => { finish(amgReadiness) }); expect(button().disabled).toBe(true)
})
