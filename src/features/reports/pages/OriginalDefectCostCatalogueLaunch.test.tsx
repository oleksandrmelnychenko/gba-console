import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getDefectCostCapability } from '../api/originalDefectCostApi'
import { defectCostCapability } from '../testing/originalDefectCostFixtures'
import type { DefectCostCapability } from '../data/originalDefectCost'
import type { ReportCatalogueEntry } from '../types'
import { OriginalDefectCostCatalogueLaunch } from './OriginalDefectCostCatalogueLaunch'
vi.mock('../api/originalDefectCostApi', () => ({ getDefectCostCapability: vi.fn() }))
const report = { Id: 'builtin:БракВПроизводстве', Sources: [{ World: 'fenix', SourceId: defectCostCapability.SourceId, DefinitionSha256: defectCostCapability.DefinitionSha256 }] } as ReportCatalogueEntry
const launch = (entry = report, allowed = true, caller: string | null = 'caller1') => <MantineProvider env="test"><I18nProvider><OriginalDefectCostCatalogueLaunch
  report={entry} worlds={['fenix']} enabled={allowed} disabled={false} callerKey={caller} /></I18nProvider></MantineProvider>
it('only exact original builtin source definition and world receive the dedicated default cost launch', async () => {
  vi.clearAllMocks(); vi.mocked(getDefectCostCapability).mockResolvedValue(defectCostCapability)
  const view = render(launch({ ...report, Sources: [{ ...report.Sources[0], DefinitionSha256: 'f'.repeat(64) }] })); expect(getDefectCostCapability).not.toHaveBeenCalled()
  view.rerender(launch()); await waitFor(() => expect((screen.getByRole('button', { name: 'Fenix · Вартість браку' }) as HTMLButtonElement).disabled).toBe(false))
  expect(getDefectCostCapability).toHaveBeenCalledTimes(1)
})
it('denied permission and an absent caller prevent capability I/O and launching', () => {
  vi.clearAllMocks(); const view = render(launch(report, false)); fireEvent.click(screen.getByRole('button', { name: 'Fenix · Вартість браку' })); expect(getDefectCostCapability).not.toHaveBeenCalled()
  view.rerender(launch(report, true, null)); expect((screen.getByRole('button', { name: 'Fenix · Вартість браку' }) as HTMLButtonElement).disabled).toBe(true)
  expect(getDefectCostCapability).not.toHaveBeenCalled()
})
it('caller change aborts original capability discovery and rejects its late response', async () => {
  vi.clearAllMocks(); let finish!: (capability: DefectCostCapability) => void
  vi.mocked(getDefectCostCapability).mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockResolvedValueOnce({ ...defectCostCapability, Executable: false })
  const view = render(launch()); await waitFor(() => expect(getDefectCostCapability).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(getDefectCostCapability).mock.calls[0][0]; view.rerender(launch(report, true, 'caller2')); expect(signal?.aborted).toBe(true)
  await act(async () => { finish(defectCostCapability) }); expect((screen.getByRole('button', { name: 'Fenix · Вартість браку' }) as HTMLButtonElement).disabled).toBe(true)
})
