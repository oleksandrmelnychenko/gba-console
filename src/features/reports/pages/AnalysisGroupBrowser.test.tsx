import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getAnalysisGroupPage } from '../api/currentVparivanieAnalysisApi'
import { currentVparivanieAnalysisCapability } from '../data/currentVparivanieAnalysis'
import { analysisDataset } from '../data/currentVparivanieAnalysis.test-fixtures'
import wire from '../data/currentVparivanieAnalysis.ua-capability-fixture.json'
import type { ReportSelection } from '../types'
import { AnalysisGroupBrowser } from './AnalysisGroupBrowser'
vi.mock('../api/currentVparivanieAnalysisApi', () => ({ getAnalysisGroupPage: vi.fn() }))
const descriptor = currentVparivanieAnalysisCapability({ ...analysisDataset, currentVparivanie: { ...analysisDataset.currentVparivanie as object, analysis: wire } })!.filters.find(f => f.type === 4)!
const node = (id: string, name: string, hasChildren = false) => ({ id, name, data: { Id: id }, hasChildren })
const selection: ReportSelection = { IsChecked: true, SelectedField: { Type: 4, Name: 'Група' }, FilterCondition: { Type: 3, Name: 'У групі зі списку' },
  Values: [{ Data: { kind: 'product', id: '99' }, Name: 'Existing product', Value: 0 }] }
function mount(value = selection) {
  const onChange = vi.fn()
  render(<MantineProvider env="test"><I18nProvider><AnalysisGroupBrowser descriptor={descriptor} selection={value} onChange={onChange} /></I18nProvider></MantineProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Дерево товарних груп' }))
  return { onChange, dialog: screen.getByRole('dialog', { name: 'Дерево товарних груп' }) }
}
beforeEach(() => vi.mocked(getAnalysisGroupPage).mockReset())
it('loads children only on expansion, preserves mixed products, and applies exact selected group IDs', async () => {
  vi.mocked(getAnalysisGroupPage).mockImplementation(async parentId => parentId === null
    ? { parentId, items: [node('1', 'CONTECH', true)], hasMore: false }
    : { parentId, items: [node('2', 'Child group'), node('1', 'Cycle to CONTECH', true)], hasMore: false })
  const { onChange, dialog } = mount()
  const root = await within(dialog).findByRole('button', { name: 'CONTECH' })
  expect(getAnalysisGroupPage).toHaveBeenCalledTimes(1)
  fireEvent.click(root)
  fireEvent.click(within(root.closest('.app-tree-node-row') as HTMLElement).getByRole('button', { name: 'Розгорнути' }))
  fireEvent.click(await within(dialog).findByRole('button', { name: 'Child group' }))
  expect(within(dialog).getByText('Циклічний зв’язок груп; подальше розкриття недоступне.')).toBeTruthy()
  expect(getAnalysisGroupPage).toHaveBeenCalledTimes(2)
  expect(getAnalysisGroupPage).toHaveBeenLastCalledWith('1', 0, 50, '', expect.any(AbortSignal))
  fireEvent.click(within(dialog).getByRole('button', { name: 'Застосувати' }))
  expect(onChange).toHaveBeenCalledWith([selection.Values[0],
    { Name: 'CONTECH', Value: 0, Data: { kind: 'productGroup', id: '1' } },
    { Name: 'Child group', Value: 0, Data: { kind: 'productGroup', id: '2' } }])
})
it('cancels tree edits and explicitly replaces a one-group selection without importing descendants', async () => {
  vi.mocked(getAnalysisGroupPage).mockResolvedValue({ parentId: null, items: [node('1', 'CONTECH', true), node('2', 'Other')], hasMore: false })
  const { onChange, dialog } = mount({ ...selection, FilterCondition: { Type: 6, Name: 'У групі' }, Values: [{ Data: { Id: '5' }, Name: 'Old', Value: 0 }] })
  fireEvent.click(await within(dialog).findByRole('button', { name: 'CONTECH' }))
  fireEvent.click(within(dialog).getByRole('button', { name: 'Скасувати' }))
  expect(onChange).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Дерево товарних груп' }))
  const fresh = screen.getByRole('dialog', { name: 'Дерево товарних груп' })
  fireEvent.click(await within(fresh).findByRole('button', { name: 'Other' }))
  fireEvent.click(within(fresh).getByRole('button', { name: 'Застосувати' }))
  expect(onChange).toHaveBeenCalledWith([{ Data: { Id: '2' }, Name: 'Other', Value: 0 }])
})
it('paginates the current level and shows retryable errors instead of an empty successful tree', async () => {
  vi.mocked(getAnalysisGroupPage).mockRejectedValueOnce(new Error('Lookup unavailable'))
    .mockResolvedValueOnce({ parentId: null, items: [node('1', 'CONTECH')], hasMore: true })
    .mockResolvedValueOnce({ parentId: null, items: [node('2', 'Other')], hasMore: false })
  const { dialog } = mount()
  expect(await within(dialog).findByText('Lookup unavailable')).toBeTruthy()
  expect(within(dialog).queryByText('Груп не знайдено')).toBeNull()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Повторити' }))
  await within(dialog).findByRole('button', { name: 'CONTECH' })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Ще кореневі групи' }))
  await within(dialog).findByRole('button', { name: 'Other' })
  expect(getAnalysisGroupPage).toHaveBeenLastCalledWith(null, 1, 50, '', expect.any(AbortSignal))
  await waitFor(() => expect(within(dialog).queryByRole('button', { name: 'Ще кореневі групи' })).toBeNull())
})

it.each([0, 1])('keeps multiple exact groups for flat condition %i when a list operator is advertised', async condition => {
  vi.mocked(getAnalysisGroupPage).mockResolvedValue({ parentId: null, items: [node('2', 'Other')], hasMore: false })
  const first = { Data: { Id: '1' }, Name: 'First', Value: 0 }
  const { onChange, dialog } = mount({ ...selection, FilterCondition: { Type: condition, Name: 'Condition' }, Values: [first] })
  fireEvent.click(await within(dialog).findByRole('button', { name: 'Other' }))
  expect(within(dialog).getByText('Вибрано значень: 2')).toBeTruthy()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Застосувати' }))
  expect(onChange).toHaveBeenCalledWith([first, { Data: { Id: '2' }, Name: 'Other', Value: 0 }])
})
