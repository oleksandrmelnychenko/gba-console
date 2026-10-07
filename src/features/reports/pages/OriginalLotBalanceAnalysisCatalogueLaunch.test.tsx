import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getLotAnalysisCapability } from '../api/originalLotBalanceAnalysisApi'
import { lotAnalysisCapability } from '../testing/originalLotBalanceAnalysisFixtures'
import type { ReportCatalogueEntry } from '../types'
import { OriginalLotBalanceAnalysisCatalogueLaunch } from './OriginalLotBalanceAnalysisCatalogueLaunch'
vi.mock('../api/originalLotBalanceAnalysisApi', () => ({ getLotAnalysisCapability: vi.fn() }))
const report = { Id: 'builtin:АнализОстатковПартийТоваровНаСкладах', Sources: [{ World: 'fenix', SourceId: lotAnalysisCapability.SourceId, DefinitionSha256: lotAnalysisCapability.DefinitionSha256 }] } as ReportCatalogueEntry
const launch = (r = report, allowed = true, caller: string | null = 'caller1') => <MantineProvider env="test"><I18nProvider><OriginalLotBalanceAnalysisCatalogueLaunch report={r} worlds={['fenix']} enabled={allowed} disabled={false} callerKey={caller} /></I18nProvider></MantineProvider>
it('only exact Fenix originala820 receives its dedicated default-four launch', async () => {
  vi.clearAllMocks(); vi.mocked(getLotAnalysisCapability).mockResolvedValue(lotAnalysisCapability); const view = render(launch({ ...report, Id: 'other' })); expect(getLotAnalysisCapability).not.toHaveBeenCalled()
  view.rerender(launch()); await waitFor(() => expect((screen.getByRole('button', { name: 'Fenix · Аналіз залишків партій' }) as HTMLButtonElement).disabled).toBe(false)); expect(getLotAnalysisCapability).toHaveBeenCalledTimes(1)
})
it('permission denial and absent caller keep own capability I/O and the dedicated launch closed', () => {
  vi.clearAllMocks(); const view = render(launch(report, false)); fireEvent.click(screen.getByRole('button', { name: 'Fenix · Аналіз залишків партій' })); expect(getLotAnalysisCapability).not.toHaveBeenCalled()
  view.rerender(launch(report, true, null)); expect((screen.getByRole('button', { name: 'Fenix · Аналіз залишків партій' }) as HTMLButtonElement).disabled).toBe(true); expect(getLotAnalysisCapability).not.toHaveBeenCalled()
})
