import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getTransferredCapability } from '../api/originalTransferredGoodsApi'
import { capability } from '../testing/transferredGoodsFixtures'
import type { ReportCatalogueEntry } from '../types'
import { OriginalTransferredGoodsCatalogueLaunch } from './OriginalTransferredGoodsCatalogueLaunch'
vi.mock('../api/originalTransferredGoodsApi', () => ({ getTransferredCapability: vi.fn() }))
vi.mock('./OriginalTransferredGoodsPanel', () => ({ OriginalTransferredGoodsPanel: () => <div>Own transferred panel</div> }))
const entry = { Id: 'builtin:ВедомостьПартииТоваровПереданных', Sources: [{ World: 'fenix', SourceId: capability.SourceId }] } as ReportCatalogueEntry
const launch = (enabled = true, caller: string | null = 'caller1', report = entry, worlds = ['fenix']) => <MantineProvider env="test"><I18nProvider>
  <OriginalTransferredGoodsCatalogueLaunch report={report} worlds={worlds} enabled={enabled} disabled={false} callerKey={caller} />
</I18nProvider></MantineProvider>
it('own transferred catalogue action loads its capability then opens only its dedicated panel', async () => {
  vi.clearAllMocks(); vi.mocked(getTransferredCapability).mockResolvedValue(capability); render(launch())
  await waitFor(() => expect((screen.getByRole('button', { name: 'Fenix · Партії переданих товарів' }) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: 'Fenix · Партії переданих товарів' })); await screen.findByText('Own transferred panel')
})
it('no session or permission prevents capability reads and report execution', () => {
  vi.clearAllMocks(); const view = render(launch(false)); expect(getTransferredCapability).not.toHaveBeenCalled()
  expect((screen.getByRole('button', { name: 'Fenix · Партії переданих товарів' }) as HTMLButtonElement).disabled).toBe(true)
  view.rerender(launch(true, null)); expect(getTransferredCapability).not.toHaveBeenCalled()
})
it('another original or AMG-only catalogue source never gets the transferred action', () => {
  vi.clearAllMocks(); const view = render(launch(true, 'caller1', { ...entry, Id: 'builtin:ВедомостьТоварыУКомиссионеров' }))
  expect(screen.queryByRole('button', { name: 'Fenix · Партії переданих товарів' })).toBeNull()
  view.rerender(launch(true, 'caller1', entry, ['amg'])); expect(getTransferredCapability).not.toHaveBeenCalled()
})
