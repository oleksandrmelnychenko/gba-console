import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getStatementCapability } from '../api/originalCounterpartyStatementApi'
import { statementCapability } from '../testing/counterpartyStatementFixtures'
import type { StatementCapability } from '../data/originalCounterpartyStatement'
import type { ReportCatalogueEntry } from '../types'
import { OriginalCounterpartyStatementCatalogueLaunch } from './OriginalCounterpartyStatementCatalogueLaunch'
vi.mock('../api/originalCounterpartyStatementApi', () => ({ getStatementCapability: vi.fn() }))
const report = { Id: 'builtin:ВедомостьВзаиморасчетыСКонтрагентами', Sources: [{ World: 'fenix', SourceId: statementCapability.SourceId, DefinitionSha256: statementCapability.DefinitionSha256 }] } as ReportCatalogueEntry
const launch = (entry = report, enabled = true, caller = 'caller1', worlds = ['fenix']) => <MantineProvider env="test"><I18nProvider>
  <OriginalCounterpartyStatementCatalogueLaunch report={entry} worlds={worlds} enabled={enabled} disabled={false} callerKey={caller} />
</I18nProvider></MantineProvider>
it('only exact own Fenix catalogue original can load its capability', async () => {
  vi.clearAllMocks(); vi.mocked(getStatementCapability).mockResolvedValue(statementCapability)
  const view = render(launch({ ...report, Id: 'builtin:Другой' })); expect(getStatementCapability).not.toHaveBeenCalled()
  view.rerender(launch(report, true, 'caller1', ['amg'])); expect(getStatementCapability).not.toHaveBeenCalled()
  view.rerender(launch()); await waitFor(() => expect(getStatementCapability).toHaveBeenCalledTimes(1))
  await waitFor(() => expect((screen.getByRole('button', { name: 'Fenix · Відомість взаєморозрахунків' }) as HTMLButtonElement).disabled).toBe(false))
})
it('caller change aborts stale capability while denied generation does not call API', async () => {
  vi.clearAllMocks(); let done!: (r: StatementCapability) => void; vi.mocked(getStatementCapability).mockImplementation(() => new Promise(resolve => { done = resolve }))
  const view = render(launch(report, false)); expect(getStatementCapability).not.toHaveBeenCalled()
  view.rerender(launch()); await waitFor(() => expect(getStatementCapability).toHaveBeenCalledTimes(1)); const signal = vi.mocked(getStatementCapability).mock.calls[0][0]
  view.rerender(launch(report, false)); expect(signal?.aborted).toBe(true); await act(async () => { done(statementCapability) })
  expect((screen.getByRole('button', { name: 'Fenix · Відомість взаєморозрахунків' }) as HTMLButtonElement).disabled).toBe(true)
})
it('capability failure remains disabled and exact retry fetches a fresh scope', async () => {
  vi.clearAllMocks(); vi.mocked(getStatementCapability).mockRejectedValueOnce(new Error('failed')).mockResolvedValueOnce(statementCapability)
  render(launch()); fireEvent.click(await screen.findByRole('button', { name: 'Повторити' }))
  await waitFor(() => expect(getStatementCapability).toHaveBeenCalledTimes(2))
  await waitFor(() => expect((screen.getByRole('button', { name: 'Fenix · Відомість взаєморозрахунків' }) as HTMLButtonElement).disabled).toBe(false))
})
