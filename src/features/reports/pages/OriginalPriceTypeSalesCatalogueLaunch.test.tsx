import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getPriceSalesCapability } from '../api/originalPriceTypeSalesApi'
import { salesCapability } from '../testing/priceTypeSalesFixtures'
import type { ReportCatalogueEntry } from '../types'
import { OriginalPriceTypeSalesCatalogueLaunch } from './OriginalPriceTypeSalesCatalogueLaunch'
vi.mock('../api/originalPriceTypeSalesApi', () => ({ getPriceSalesCapability: vi.fn() }))
const report = { Id: 'builtin:ПродажиСравнениеПоТипуЦен', Sources: [{ World: 'fenix', SourceId: salesCapability.SourceId, DefinitionSha256: salesCapability.DefinitionSha256 }] } as ReportCatalogueEntry
const launch = (r = report, allowed = true, caller: string | null = 'caller1') => <MantineProvider env="test"><I18nProvider><OriginalPriceTypeSalesCatalogueLaunch report={r} worlds={['fenix']} enabled={allowed} disabled={false} callerKey={caller} /></I18nProvider></MantineProvider>
it('only exact Fenix original5543 receives its dedicated default-four launch', async () => {
  vi.clearAllMocks(); vi.mocked(getPriceSalesCapability).mockResolvedValue(salesCapability); const view = render(launch({ ...report, Id: 'other' })); expect(getPriceSalesCapability).not.toHaveBeenCalled()
  view.rerender(launch()); await waitFor(() => expect((screen.getByRole('button', { name: 'Fenix · Порівняння продажів за типом цін' }) as HTMLButtonElement).disabled).toBe(false)); expect(getPriceSalesCapability).toHaveBeenCalledTimes(1)
})
it('permission denial and absent caller keep own capability I/O and the dedicated launch closed', () => {
  vi.clearAllMocks(); const view = render(launch(report, false)); fireEvent.click(screen.getByRole('button', { name: 'Fenix · Порівняння продажів за типом цін' })); expect(getPriceSalesCapability).not.toHaveBeenCalled()
  view.rerender(launch(report, true, null)); expect((screen.getByRole('button', { name: 'Fenix · Порівняння продажів за типом цін' }) as HTMLButtonElement).disabled).toBe(true); expect(getPriceSalesCapability).not.toHaveBeenCalled()
})
