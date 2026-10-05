import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getPurchasesCapability } from '../api/originalPurchasesApi'
import { purchasesCapability } from '../testing/originalPurchasesFixtures'
import type { PurchasesCapability } from '../data/originalPurchases'
import type { ReportCatalogueEntry } from '../types'
import { OriginalPurchasesCatalogueLaunch } from './OriginalPurchasesCatalogueLaunch'
vi.mock('../api/originalPurchasesApi', () => ({ getPurchasesCapability: vi.fn() }))
const report = { Id: 'builtin:Закупки', Sources: [{ World: 'fenix', SourceId: purchasesCapability.SourceId, DefinitionSha256: purchasesCapability.DefinitionSha256 }] } as ReportCatalogueEntry
const launch = (entry = report, allowed = true, caller: string | null = 'caller1') => <MantineProvider env="test"><I18nProvider><OriginalPurchasesCatalogueLaunch
  report={entry} worlds={['fenix']} enabled={allowed} disabled={false} callerKey={caller} /></I18nProvider></MantineProvider>
it('only exact own Fenix Purchases builtin source and definition receive the dedicated default launch', async () => {
  vi.clearAllMocks(); vi.mocked(getPurchasesCapability).mockResolvedValue(purchasesCapability)
  const view = render(launch({ ...report, Sources: [{ ...report.Sources[0], DefinitionSha256: 'f'.repeat(64) }] })); expect(getPurchasesCapability).not.toHaveBeenCalled()
  view.rerender(launch()); await waitFor(() => expect((screen.getByRole('button', { name: 'Fenix · Закупки' }) as HTMLButtonElement).disabled).toBe(false))
  expect(getPurchasesCapability).toHaveBeenCalledTimes(1)
})
it('an AMG alias and the partial incoming-receipt dataset never acquire the original default launch', () => {
  vi.clearAllMocks()
  const view = render(launch({ ...report, Sources: [{ ...report.Sources[0], World: 'amg' }] }))
  expect(screen.queryByRole('button', { name: 'Fenix · Закупки' })).toBeNull()
  view.rerender(launch({ ...report, Id: 'native:3' }))
  expect(screen.queryByRole('button', { name: 'Fenix · Закупки' })).toBeNull()
  expect(getPurchasesCapability).not.toHaveBeenCalled()
})
it('denied permission and an absent caller prevent capability I/O and launching', () => {
  vi.clearAllMocks(); const view = render(launch(report, false)); fireEvent.click(screen.getByRole('button', { name: 'Fenix · Закупки' })); expect(getPurchasesCapability).not.toHaveBeenCalled()
  view.rerender(launch(report, true, null)); expect((screen.getByRole('button', { name: 'Fenix · Закупки' }) as HTMLButtonElement).disabled).toBe(true)
  expect(getPurchasesCapability).not.toHaveBeenCalled()
})
it('caller change aborts original capability discovery and rejects its late response', async () => {
  vi.clearAllMocks(); let finish!: (capability: PurchasesCapability) => void
  vi.mocked(getPurchasesCapability).mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockResolvedValueOnce({ ...purchasesCapability, Executable: false })
  const view = render(launch()); await waitFor(() => expect(getPurchasesCapability).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(getPurchasesCapability).mock.calls[0][0]; view.rerender(launch(report, true, 'caller2')); expect(signal?.aborted).toBe(true)
  await act(async () => { finish(purchasesCapability) }); expect((screen.getByRole('button', { name: 'Fenix · Закупки' }) as HTMLButtonElement).disabled).toBe(true)
})
