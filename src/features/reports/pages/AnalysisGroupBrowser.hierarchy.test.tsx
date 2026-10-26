import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getAnalysisHierarchyPage } from '../api/currentVparivanieAnalysisApi'
import { currentVparivanieAnalysisCapability } from '../data/currentVparivanieAnalysis'
import wire from '../data/currentVparivanieAnalysis.hierarchy-capability-fixture.json'
import { analysisDataset } from '../data/currentVparivanieAnalysis.test-fixtures'
import type { ReportSelection } from '../types'
import { AnalysisGroupBrowser } from './AnalysisGroupBrowser'
vi.mock('../api/currentVparivanieAnalysisApi', () => ({ getAnalysisGroupPage: vi.fn(), getAnalysisHierarchyPage: vi.fn() }))
const capability = currentVparivanieAnalysisCapability({ ...analysisDataset, currentVparivanie: { ...analysisDataset.currentVparivanie as object, analysis: wire } })!
const ROOT = '8AB2005056C0000811DEFC4535BB4D40', CHILD = 'A0000000000000000000000000000001'
const node = (id: string, name: string, path: string, hasChildren = false, world = 'fenix', kind = 'counterpartyGroup') =>
  ({ id: `${world}:${id}`, name, path, hasChildren, data: { kind, world, id } })
beforeEach(() => vi.mocked(getAnalysisHierarchyPage).mockReset())

it('browses supplier folders lazily and applies typed groups next to preserved suppliers', async () => {
  vi.mocked(getAnalysisHierarchyPage).mockImplementation(async (_kind, parentId) => parentId === null
    ? { parentId, hasMore: false, items: [node(ROOT, 'Постачальники', 'Постачальники', true)] }
    : { parentId, hasMore: false, items: [node(CHILD, 'Туреччина', 'Постачальники / Туреччина')] })
  const onChange = vi.fn()
  const selection: ReportSelection = { IsChecked: true, SelectedField: { Type: 17, Name: 'Постачальник' }, FilterCondition: { Type: 5, Name: 'Не у групі зі списку' },
    Values: [{ Data: { kind: 'supplier', id: 9 }, Name: 'Existing supplier', Value: 0 }] }
  render(<MantineProvider env="test"><I18nProvider><AnalysisGroupBrowser descriptor={capability.filters.find(f => f.type === 17)!} selection={selection} onChange={onChange} /></I18nProvider></MantineProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Дерево груп контрагентів' }))
  const dialog = screen.getByRole('dialog', { name: 'Дерево груп контрагентів' })
  const root = await within(dialog).findByRole('button', { name: 'Постачальники' })
  expect(getAnalysisHierarchyPage).toHaveBeenCalledWith('counterpartyGroup', null, 0, 50, '', expect.any(AbortSignal))
  fireEvent.click(within(root.closest('.app-tree-node-row') as HTMLElement).getByRole('button', { name: 'Розгорнути' }))
  fireEvent.click(await within(dialog).findByRole('button', { name: 'Туреччина' }))
  expect(getAnalysisHierarchyPage).toHaveBeenLastCalledWith('counterpartyGroup', `fenix:${ROOT}`, 0, 50, '', expect.any(AbortSignal))
  fireEvent.click(within(dialog).getByRole('button', { name: 'Застосувати' }))
  expect(onChange).toHaveBeenCalledWith([selection.Values[0],
    { Name: 'Постачальники / Туреччина', Value: 0, Data: { kind: 'counterpartyGroup', world: 'fenix', id: CHILD } }])
})

it('searches warehouse folders across both 1C bases and keeps one group for «У групі»', async () => {
  vi.mocked(getAnalysisHierarchyPage).mockImplementation(async (_kind, parentId, _offset, _limit, value) => ({ parentId, hasMore: false,
    items: value ? [node(CHILD, 'Київ', 'Склади (AMG) / Київ (AMG)', false, 'amg', 'warehouseGroup')]
      : [node(ROOT, 'Склади (Fenix)', 'Склади (Fenix)', false, 'fenix', 'warehouseGroup')] }))
  const onChange = vi.fn()
  const selection: ReportSelection = { IsChecked: true, SelectedField: { Type: 21, Name: 'Склад' }, FilterCondition: { Type: 6, Name: 'У групі' }, Values: [] }
  render(<MantineProvider env="test"><I18nProvider><AnalysisGroupBrowser descriptor={capability.filters.find(f => f.type === 21)!} selection={selection} onChange={onChange} /></I18nProvider></MantineProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Дерево груп складів' }))
  const dialog = screen.getByRole('dialog', { name: 'Дерево груп складів' })
  fireEvent.click(await within(dialog).findByRole('button', { name: 'Склади (Fenix)' }))
  fireEvent.change(within(dialog).getByLabelText('Пошук групи'), { target: { value: 'Київ' } })
  fireEvent.click(await within(dialog).findByRole('button', { name: 'Склади (AMG) / Київ (AMG)' }, { timeout: 3000 }))
  await waitFor(() => expect(within(dialog).getByText('Вибрано значень: 1')).toBeTruthy())
  fireEvent.click(within(dialog).getByRole('button', { name: 'Застосувати' }))
  expect(onChange).toHaveBeenCalledWith([{ Name: 'Склади (AMG) / Київ (AMG)', Value: 0, Data: { kind: 'warehouseGroup', world: 'amg', id: CHILD } }])
})
