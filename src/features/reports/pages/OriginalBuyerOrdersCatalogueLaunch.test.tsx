import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getBuyerOrdersCapability } from '../api/originalBuyerOrdersApi'
import { capability } from '../testing/buyerOrdersFixtures'
import type { ReportCatalogueEntry } from '../types'
import { OriginalBuyerOrdersCatalogueLaunch } from './OriginalBuyerOrdersCatalogueLaunch'
vi.mock('../api/originalBuyerOrdersApi', () => ({ getBuyerOrdersCapability: vi.fn() }))
vi.mock('./OriginalBuyerOrdersPanel', () => ({ OriginalBuyerOrdersPanel: () => <div>Own buyerOrders panel</div> }))
const entry = { Id: 'builtin:ВедомостьЗаказыПокупателей', Sources: [{ World: 'fenix', SourceId: capability.SourceId }] } as ReportCatalogueEntry
const launch = (enabled = true, caller: string | null = 'caller1', report = entry, worlds = ['fenix']) => <MantineProvider env="test"><I18nProvider>
  <OriginalBuyerOrdersCatalogueLaunch report={report} worlds={worlds} enabled={enabled} disabled={false} callerKey={caller} />
</I18nProvider></MantineProvider>
it('own buyerOrders catalogue action loads its capability then opens only its dedicated panel', async () => {
  vi.clearAllMocks(); vi.mocked(getBuyerOrdersCapability).mockResolvedValue(capability); render(launch())
  await waitFor(() => expect((screen.getByRole('button', { name: 'Fenix · Замовлення покупців' }) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: 'Fenix · Замовлення покупців' })); await screen.findByText('Own buyerOrders panel')
})
it('no session or permission prevents capability reads and report execution', () => {
  vi.clearAllMocks(); const view = render(launch(false)); expect(getBuyerOrdersCapability).not.toHaveBeenCalled()
  expect((screen.getByRole('button', { name: 'Fenix · Замовлення покупців' }) as HTMLButtonElement).disabled).toBe(true)
  view.rerender(launch(true, null)); expect(getBuyerOrdersCapability).not.toHaveBeenCalled()
})
it('another original or AMG-only catalogue source never gets the buyerOrders action', () => {
  vi.clearAllMocks(); const view = render(launch(true, 'caller1', { ...entry, Id: 'builtin:ВедомостьТоварыУКомиссионеров' }))
  expect(screen.queryByRole('button', { name: 'Fenix · Замовлення покупців' })).toBeNull()
  view.rerender(launch(true, 'caller1', entry, ['amg'])); expect(getBuyerOrdersCapability).not.toHaveBeenCalled()
})
