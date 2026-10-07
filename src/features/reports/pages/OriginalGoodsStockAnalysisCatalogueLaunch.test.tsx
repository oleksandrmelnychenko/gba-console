import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getGoodsAnalysisCapability } from '../api/originalGoodsStockAnalysisApi'
import { goodsAnalysisCapability } from '../testing/originalGoodsStockAnalysisFixtures'
import type { ReportCatalogueEntry } from '../types'
import { OriginalGoodsStockAnalysisCatalogueLaunch } from './OriginalGoodsStockAnalysisCatalogueLaunch'
vi.mock('../api/originalGoodsStockAnalysisApi', () => ({ getGoodsAnalysisCapability: vi.fn() }))
const report = { Id: 'builtin:АнализОстатковТоваровНаСкладах', Sources: [{ World: 'fenix', SourceId: goodsAnalysisCapability.SourceId, DefinitionSha256: goodsAnalysisCapability.DefinitionSha256 }] } as ReportCatalogueEntry
const launch = (r = report, allowed = true, caller: string | null = 'caller1') => <MantineProvider env="test"><I18nProvider><OriginalGoodsStockAnalysisCatalogueLaunch report={r} worlds={['fenix']} enabled={allowed} disabled={false} callerKey={caller} /></I18nProvider></MantineProvider>
it('only exact Fenix original5ec receives its dedicated default-two launch', async () => {
  vi.clearAllMocks(); vi.mocked(getGoodsAnalysisCapability).mockResolvedValue(goodsAnalysisCapability); const view = render(launch({ ...report, Id: 'other' })); expect(getGoodsAnalysisCapability).not.toHaveBeenCalled()
  view.rerender(launch()); await waitFor(() => expect((screen.getByRole('button', { name: 'Fenix · Аналіз товарних залишків' }) as HTMLButtonElement).disabled).toBe(false)); expect(getGoodsAnalysisCapability).toHaveBeenCalledTimes(1)
})
it('permission denial and absent caller keep own capability I/O and the dedicated launch closed', () => {
  vi.clearAllMocks(); const view = render(launch(report, false)); fireEvent.click(screen.getByRole('button', { name: 'Fenix · Аналіз товарних залишків' })); expect(getGoodsAnalysisCapability).not.toHaveBeenCalled()
  view.rerender(launch(report, true, null)); expect((screen.getByRole('button', { name: 'Fenix · Аналіз товарних залишків' }) as HTMLButtonElement).disabled).toBe(true); expect(getGoodsAnalysisCapability).not.toHaveBeenCalled()
})
