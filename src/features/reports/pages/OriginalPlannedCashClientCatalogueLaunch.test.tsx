import { MantineProvider } from '@mantine/core'
import { act, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getClientReportCapability } from '../api/originalClientReportApi'
import { getPlannedFlowCapability } from '../api/originalPlannedCashFlowApi'
import { clientCapability, flowCapability } from '../testing/originalPlannedCashClientFixtures'
import type { ClientCapability } from '../data/originalClientReport'
import type { ReportCatalogueEntry } from '../types'
import { OriginalClientReportCatalogueLaunch, OriginalPlannedCashFlowCatalogueLaunch } from './OriginalPlannedCashClientCatalogueLaunch'
vi.mock('../api/originalClientReportApi', () => ({ getClientReportCapability: vi.fn() }))
vi.mock('../api/originalPlannedCashFlowApi', () => ({ getPlannedFlowCapability: vi.fn() }))
const client = { Id: 'builtin:ОтчетПоКлиентам', Sources: [{ World: 'fenix', SourceId: clientCapability.SourceId, DefinitionSha256: clientCapability.DefinitionSha256 }] } as ReportCatalogueEntry
const flow = { Id: 'builtin:ПланыДвиженияДенежныхСредств', Sources: [{ World: 'fenix', SourceId: flowCapability.SourceId, DefinitionSha256: flowCapability.DefinitionSha256 }] } as ReportCatalogueEntry
const launch = (report = client, worlds = ['fenix'], permission = true) => <MantineProvider env="test"><I18nProvider>
  <OriginalClientReportCatalogueLaunch report={report} worlds={worlds} enabled={permission} disabled={false} callerKey="caller1" />
  <OriginalPlannedCashFlowCatalogueLaunch report={report} worlds={worlds} enabled={permission} disabled={false} callerKey="caller1" />
</I18nProvider></MantineProvider>
it('exact catalogue world and original identity launch only its own endpoint with no cross-report substitution', async () => {
  vi.clearAllMocks(); vi.mocked(getClientReportCapability).mockResolvedValue(clientCapability); vi.mocked(getPlannedFlowCapability).mockResolvedValue(flowCapability)
  const view = render(launch(client, ['amg'])); expect(getClientReportCapability).not.toHaveBeenCalled(); expect(getPlannedFlowCapability).not.toHaveBeenCalled()
  view.rerender(launch()); await waitFor(() => expect(getClientReportCapability).toHaveBeenCalledTimes(1)); expect(getPlannedFlowCapability).not.toHaveBeenCalled()
  view.rerender(launch(flow)); await waitFor(() => expect(getPlannedFlowCapability).toHaveBeenCalledTimes(1))
  await waitFor(() => expect((screen.getByRole('button', { name: 'Fenix · Плани руху коштів' }) as HTMLButtonElement).disabled).toBe(false))
})
it('permission loss aborts the exact capability owner and late response cannot open a form', async () => {
  vi.clearAllMocks(); let finish!: (capability: ClientCapability) => void; vi.mocked(getClientReportCapability).mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const view = render(launch()); await waitFor(() => expect(getClientReportCapability).toHaveBeenCalledTimes(1)); const signal = vi.mocked(getClientReportCapability).mock.calls[0][0]
  view.rerender(launch(client, ['fenix'], false)); expect(signal?.aborted).toBe(true); await act(async () => { finish(clientCapability) })
  expect((screen.getByRole('button', { name: 'Fenix · Звіт за клієнтами' }) as HTMLButtonElement).disabled).toBe(true)
})
