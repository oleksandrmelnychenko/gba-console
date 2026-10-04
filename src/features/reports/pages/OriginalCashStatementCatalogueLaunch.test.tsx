import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getOriginalCashCapability } from '../api/originalCashStatementApi'
import { cashCapabilityFixture } from '../data/originalCashStatement.fixtures'
import { cashDefinition } from '../data/originalCashStatement'
import type { ReportCatalogueEntry } from '../types'
import { OriginalCashStatementCatalogueLaunch } from './OriginalCashStatementCatalogueLaunch'
vi.mock('../api/originalCashStatementApi', () => ({ getOriginalCashCapability: vi.fn() }))
vi.mock('./OriginalCashStatementPanel', () => ({ OriginalCashStatementPanel: () => <div>Own original977 panel</div> }))
const entry: ReportCatalogueEntry = { Id: `builtin:${cashDefinition.name}`, Name: cashDefinition.name, Title: '', Kind: 'builtin', Sources: [{ World: 'fenix', SourceId: cashDefinition.source, DefinitionSha256: cashDefinition.definition, Attributes: [] }] }
const launch = (enabled = true, caller: string | null = 'caller1', report = entry, worlds = ['fenix']) => <MantineProvider env="test"><I18nProvider>
  <OriginalCashStatementCatalogueLaunch report={report} worlds={worlds} enabled={enabled} disabled={false} callerKey={caller} />
</I18nProvider></MantineProvider>
it('exact retained catalogue original opens its own period form after own capability', async () => {
  vi.clearAllMocks(); vi.mocked(getOriginalCashCapability).mockResolvedValue(cashCapabilityFixture()); render(launch())
  await waitFor(() => expect((screen.getByRole('button', { name: 'Fenix · відомість коштів за період' }) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: 'Fenix · відомість коштів за період' })); await screen.findByText('Own original977 panel')
})
it('missing caller or permission does not read capability and another definition or AMG cannot borrow action', () => {
  vi.clearAllMocks(); const view = render(launch(false)); expect(getOriginalCashCapability).not.toHaveBeenCalled()
  view.rerender(launch(true, null)); expect(getOriginalCashCapability).not.toHaveBeenCalled()
  view.rerender(launch(true, 'caller1', { ...entry, Id: 'builtin:ДвижениеДенежныхСредств' })); expect(screen.queryByRole('button', { name: 'Fenix · відомість коштів за період' })).toBeNull()
  view.rerender(launch(true, 'caller1', entry, ['amg'])); expect(getOriginalCashCapability).not.toHaveBeenCalled()
})
