import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getWipCapability } from '../api/originalWorkInProgressApi'
import { wipCapability } from '../testing/originalWorkInProgressFixtures'
import type { ReportCatalogueEntry } from '../types'
import { OriginalWorkInProgressCatalogueLaunch } from './OriginalWorkInProgressCatalogueLaunch'
vi.mock('../api/originalWorkInProgressApi', () => ({ getWipCapability: vi.fn() }))
const report = { Id: 'builtin:НезавершенноеПроизводство', Sources: [{ World: 'fenix', SourceId: wipCapability.SourceId, DefinitionSha256: wipCapability.DefinitionSha256 }] } as ReportCatalogueEntry
const launch = (r = report, allowed = true, caller: string | null = 'caller1') => <MantineProvider env="test"><I18nProvider><OriginalWorkInProgressCatalogueLaunch report={r} worlds={['fenix']} enabled={allowed} disabled={false} callerKey={caller} /></I18nProvider></MantineProvider>
it('only exact Fenix originalf494 receives its dedicated default-four launch', async () => {
  vi.clearAllMocks(); vi.mocked(getWipCapability).mockResolvedValue(wipCapability); const view = render(launch({ ...report, Id: 'other' })); expect(getWipCapability).not.toHaveBeenCalled()
  view.rerender(launch()); await waitFor(() => expect((screen.getByRole('button', { name: 'Fenix · Незавершене виробництво' }) as HTMLButtonElement).disabled).toBe(false)); expect(getWipCapability).toHaveBeenCalledTimes(1)
})
it('permission denial and absent caller keep own capability I/O and the dedicated launch closed', () => {
  vi.clearAllMocks(); const view = render(launch(report, false)); fireEvent.click(screen.getByRole('button', { name: 'Fenix · Незавершене виробництво' })); expect(getWipCapability).not.toHaveBeenCalled()
  view.rerender(launch(report, true, null)); expect((screen.getByRole('button', { name: 'Fenix · Незавершене виробництво' }) as HTMLButtonElement).disabled).toBe(true); expect(getWipCapability).not.toHaveBeenCalled()
})
