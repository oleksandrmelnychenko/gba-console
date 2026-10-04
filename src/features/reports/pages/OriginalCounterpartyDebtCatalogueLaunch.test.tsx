import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getDebtCapability } from '../api/originalCounterpartyDebtApi'
import { debtCapability } from '../testing/counterpartyDebtFixtures'
import type { DebtCapability } from '../data/originalCounterpartyDebt'
import type { ReportCatalogueEntry } from '../types'
import { OriginalCounterpartyDebtCatalogueLaunch } from './OriginalCounterpartyDebtCatalogueLaunch'
vi.mock('../api/originalCounterpartyDebtApi', () => ({ getDebtCapability: vi.fn() }))
const report = { Id: 'builtin:ЗадолженностьПоКонтрагентам', Sources: [{ World: 'fenix', SourceId: debtCapability.SourceId, DefinitionSha256: debtCapability.DefinitionSha256 }] } as ReportCatalogueEntry
const launch = (entry = report, enabled = true, caller = 'caller1', worlds = ['fenix']) => <MantineProvider env="test"><I18nProvider>
  <OriginalCounterpartyDebtCatalogueLaunch report={entry} worlds={worlds} enabled={enabled} disabled={false} callerKey={caller} />
</I18nProvider></MantineProvider>
it('only exact own Fenix catalogue original can load its capability', async () => {
  vi.clearAllMocks(); vi.mocked(getDebtCapability).mockResolvedValue(debtCapability)
  const view = render(launch({ ...report, Id: 'builtin:Другой' })); expect(getDebtCapability).not.toHaveBeenCalled()
  view.rerender(launch(report, true, 'caller1', ['amg'])); expect(getDebtCapability).not.toHaveBeenCalled()
  view.rerender(launch()); await waitFor(() => expect(getDebtCapability).toHaveBeenCalledTimes(1))
  await waitFor(() => expect((screen.getByRole('button', { name: 'Fenix · Заборгованість за контрагентами' }) as HTMLButtonElement).disabled).toBe(false))
})
it('caller change aborts stale capability while denied generation does not call API', async () => {
  vi.clearAllMocks(); let done!: (r: DebtCapability) => void; vi.mocked(getDebtCapability).mockImplementation(() => new Promise(resolve => { done = resolve }))
  const view = render(launch(report, false)); expect(getDebtCapability).not.toHaveBeenCalled()
  view.rerender(launch()); await waitFor(() => expect(getDebtCapability).toHaveBeenCalledTimes(1)); const signal = vi.mocked(getDebtCapability).mock.calls[0][0]
  view.rerender(launch(report, false)); expect(signal?.aborted).toBe(true); await act(async () => { done(debtCapability) })
  expect((screen.getByRole('button', { name: 'Fenix · Заборгованість за контрагентами' }) as HTMLButtonElement).disabled).toBe(true)
})
it('capability failure remains disabled and exact retry fetches a fresh scope', async () => {
  vi.clearAllMocks(); vi.mocked(getDebtCapability).mockRejectedValueOnce(new Error('failed')).mockResolvedValueOnce(debtCapability)
  render(launch()); fireEvent.click(await screen.findByRole('button', { name: 'Повторити' }))
  await waitFor(() => expect(getDebtCapability).toHaveBeenCalledTimes(2))
  await waitFor(() => expect((screen.getByRole('button', { name: 'Fenix · Заборгованість за контрагентами' }) as HTMLButtonElement).disabled).toBe(false))
})
