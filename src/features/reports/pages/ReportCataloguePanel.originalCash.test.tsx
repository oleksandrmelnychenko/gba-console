import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getOriginalCashCapability } from '../api/originalCashStatementApi'
import { getReportCatalogue, getReportDatasets } from '../api/reportWorkspaceApi'
import { cashDefinition } from '../data/originalCashStatement'
import { cashCapabilityFixture } from '../data/originalCashStatement.fixtures'
import { catalogueFixture } from '../data/reportMigration.test-fixtures'
import type { ReportCatalogueEntry } from '../types'
import { ReportCataloguePanel } from './ReportCataloguePanel'

const auth = vi.hoisted(() => ({ allowed: true }))
const surface = vi.hoisted(() => ({ only: false }))
vi.mock('../reportSurfacePolicy', () => ({ get BUG_1274_ONLY_REPORT_SURFACE() { return surface.only } }))
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => auth.allowed }) }))
vi.mock('../api/reportWorkspaceApi', () => ({ getReportCatalogue: vi.fn(), getReportDatasets: vi.fn() }))
vi.mock('../api/originalCashStatementApi', () => ({ getOriginalCashCapability: vi.fn() }))
vi.mock('./OriginalCashStatementPanel', () => ({ OriginalCashStatementPanel: () => <div>Original cash form</div> }))
const cashEntry: ReportCatalogueEntry = {
  Id: `builtin:${cashDefinition.name}`, Name: cashDefinition.name, Title: 'Відомість коштів', Kind: 'builtin',
  Sources: [{ World: 'fenix', SourceId: cashDefinition.source, DefinitionSha256: cashDefinition.definition, Attributes: [] }],
}
function configure(entry = cashEntry) {
  const catalogue = catalogueFixture()
  catalogue.Reports = [structuredClone(entry)]
  vi.mocked(getReportCatalogue).mockResolvedValue(catalogue)
}
function mount(disabled = false, callerKey: string | null = 'approved-caller') {
  return render(<MantineProvider env="test"><I18nProvider>
    <ReportCataloguePanel consoleScope disabled={disabled} callerKey={callerKey} />
  </I18nProvider></MantineProvider>)
}
afterEach(() => vi.restoreAllMocks())
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1280)
  vi.clearAllMocks(); auth.allowed = true; surface.only = false; configure()
  vi.mocked(getReportDatasets).mockResolvedValue([])
  vi.mocked(getOriginalCashCapability).mockResolvedValue(cashCapabilityFixture())
})
it('the BUG-1274-only console catalogue keeps the cash report row without the original cash form', async () => {
  surface.only = true
  mount()
  await screen.findByText('Відомість по коштах')
  expect(screen.queryByRole('button', { name: 'Fenix · відомість коштів за період' })).toBeNull()
  expect(getOriginalCashCapability).not.toHaveBeenCalled()
})
it('the console catalogue exposes only the identity-bound original cash form and opens its real panel', async () => {
  mount()
  const launch = await screen.findByRole('button', { name: 'Fenix · відомість коштів за період' })
  await waitFor(() => expect(launch.hasAttribute('disabled')).toBe(false))
  expect(getOriginalCashCapability).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('button', { name: /Fenix.*відвантаження/ })).toBeNull()
  fireEvent.click(launch)
  await screen.findByText('Original cash form')
})
it('disabled console controls cannot open the original cash panel', async () => {
  mount(true)
  const launch = await screen.findByRole('button', { name: 'Fenix · відомість коштів за період' })
  expect(launch.hasAttribute('disabled')).toBe(true)
  fireEvent.click(launch)
  expect(screen.queryByText('Original cash form')).toBeNull()
})
it('without generation permission or a caller it neither reads a capability nor opens the panel', async () => {
  auth.allowed = false
  const view = mount()
  expect((await screen.findByRole('button', { name: 'Fenix · відомість коштів за період' })).hasAttribute('disabled')).toBe(true)
  expect(getOriginalCashCapability).not.toHaveBeenCalled()
  auth.allowed = true
  view.unmount(); mount(false, null)
  expect((await screen.findByRole('button', { name: 'Fenix · відомість коштів за період' })).hasAttribute('disabled')).toBe(true)
  expect(getOriginalCashCapability).not.toHaveBeenCalled()
})
it.each(['world', 'source', 'definition', 'report'] as const)('does not expose or read an original capability for a different %s', async field => {
  const entry = structuredClone(cashEntry)
  if (field === 'world') entry.Sources[0].World = 'amg'
  if (field === 'source') entry.Sources[0].SourceId = 'another-source'
  if (field === 'definition') entry.Sources[0].DefinitionSha256 = '0'.repeat(64)
  if (field === 'report') entry.Id = 'builtin:ВедомостьВзаиморасчетыСКонтрагентами'
  configure(entry); mount()
  await screen.findByRole('button', { name: 'Покриття звіту: Відомість коштів' })
  expect(screen.queryByRole('button', { name: 'Fenix · відомість коштів за період' })).toBeNull()
  expect(getOriginalCashCapability).not.toHaveBeenCalled()
})
