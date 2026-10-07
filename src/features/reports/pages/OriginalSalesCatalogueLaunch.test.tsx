import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getSalesCapability } from '../api/originalSalesApi'
import { salesCapability } from '../testing/originalSalesFixtures'
import type { ReportCatalogueEntry } from '../types'
import { OriginalSalesCatalogueLaunch } from './OriginalSalesCatalogueLaunch'
vi.mock('../api/originalSalesApi', () => ({ getSalesCapability: vi.fn() }))
const report = { Id: 'builtin:Продажи', Sources: [{ World: 'fenix', SourceId: salesCapability.SourceId, DefinitionSha256: salesCapability.DefinitionSha256 }] } as ReportCatalogueEntry
const launch = (r = report, allowed = true, caller: string | null = 'caller1') => <MantineProvider env="test"><I18nProvider><OriginalSalesCatalogueLaunch report={r} worlds={['fenix']} enabled={allowed} disabled={false} callerKey={caller} /></I18nProvider></MantineProvider>
it('only exact Fenix original1d3 receives its dedicated default-two launch', async () => {
  vi.clearAllMocks(); vi.mocked(getSalesCapability).mockResolvedValue(salesCapability); const view = render(launch({ ...report, Id: 'other' })); expect(getSalesCapability).not.toHaveBeenCalled()
  view.rerender(launch()); await waitFor(() => expect((screen.getByRole('button', { name: 'Fenix · Продажі' }) as HTMLButtonElement).disabled).toBe(false)); expect(getSalesCapability).toHaveBeenCalledTimes(1)
})
it('permission denial and absent caller keep own capability I/O and the dedicated launch closed', () => {
  vi.clearAllMocks(); const view = render(launch(report, false)); fireEvent.click(screen.getByRole('button', { name: 'Fenix · Продажі' })); expect(getSalesCapability).not.toHaveBeenCalled()
  view.rerender(launch(report, true, null)); expect((screen.getByRole('button', { name: 'Fenix · Продажі' }) as HTMLButtonElement).disabled).toBe(true); expect(getSalesCapability).not.toHaveBeenCalled()
})
