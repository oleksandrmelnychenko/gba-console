import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getAnalysisHierarchyPage, searchAnalysisValues } from '../api/currentVparivanieAnalysisApi'
import { currentVparivanieAnalysisCapability, type AnalysisHierarchyStatus } from '../data/currentVparivanieAnalysis'
import wire from '../data/currentVparivanieAnalysis.hierarchy-capability-fixture.json'
import { analysisDataset } from '../data/currentVparivanieAnalysis.test-fixtures'
import type { ReportSelectedValue } from '../types'
import { CurrentVparivanieAnalysisValuePicker } from './CurrentVparivanieAnalysisValuePicker'
vi.mock('../api/currentVparivanieAnalysisApi', () => ({ searchAnalysisValues: vi.fn(), getAnalysisHierarchyPage: vi.fn(), getAnalysisGroupPage: vi.fn() }))
const capability = currentVparivanieAnalysisCapability({ ...analysisDataset, currentVparivanie: { ...analysisDataset.currentVparivanie as object, analysis: wire } })!
const FOLDER = 'A0000000000000000000000000000001'
const ready: AnalysisHierarchyStatus = { productGroup: null, counterpartyGroup: null, warehouseGroup: null }
function Picker({ field, condition, status = ready, initial = [], onValues }: {
  field: number; condition: number; status?: AnalysisHierarchyStatus | null; initial?: ReportSelectedValue[]; onValues?: (values: ReportSelectedValue[]) => void
}) {
  const [values, setValues] = useState(initial)
  return <MantineProvider env="test"><I18nProvider><CurrentVparivanieAnalysisValuePicker descriptor={capability.filters.find(f => f.type === field)}
    selection={{ IsChecked: true, SelectedField: { Type: field, Name: String(field) }, FilterCondition: { Type: condition, Name: String(condition) }, Values: values }}
    selections={[]} from="2026-10-01" to="2026-10-23" status={status} onChange={next => { setValues(next); onValues?.(next) }} /></I18nProvider></MantineProvider>
}
beforeEach(() => {
  vi.mocked(searchAnalysisValues).mockReset()
  vi.mocked(getAnalysisHierarchyPage).mockReset()
})

it('mixes buyer folders from the captured hierarchy with exact buyers and keeps both typed', async () => {
  vi.mocked(getAnalysisHierarchyPage).mockResolvedValue({ parentId: null, hasMore: false, items: [{ id: `fenix:${FOLDER}`, name: 'Київ',
    path: 'Покупці / Київ', hasChildren: true, data: { kind: 'counterpartyGroup', world: 'fenix', id: FOLDER } }] })
  vi.mocked(searchAnalysisValues).mockResolvedValue([{ id: 'id:7', name: 'Buyer seven', data: { Id: 7 } }])
  const onValues = vi.fn()
  render(<Picker field={5} condition={3} onValues={onValues} />)
  await waitFor(() => expect(getAnalysisHierarchyPage).toHaveBeenCalledWith('counterpartyGroup', null, 0, 30, '', expect.any(AbortSignal)))
  expect(searchAnalysisValues).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('combobox', { name: 'Значення' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Покупці / Київ' }))
  fireEvent.click(screen.getByRole('radio', { name: 'Покупці' }))
  await waitFor(() => expect(searchAnalysisValues).toHaveBeenLastCalledWith(5, '', '2026-10-01', '2026-10-23', undefined, expect.any(AbortSignal)))
  fireEvent.click(await screen.findByRole('option', { name: 'Buyer seven' }))
  expect(onValues).toHaveBeenLastCalledWith([
    { Data: { kind: 'counterpartyGroup', world: 'fenix', id: FOLDER }, Name: 'Покупці / Київ', Value: 0 },
    { Data: { kind: 'buyer', id: 7 }, Name: 'Buyer seven', Value: 0 }])
  fireEvent.click(screen.getByRole('button', { name: 'Вибрано: 2' }))
  expect(screen.getByRole('option', { name: 'Група: Покупці / Київ' })).toBeTruthy()
  expect(screen.getByRole('option', { name: 'Покупець: Buyer seven' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Дерево груп контрагентів' })).toBeTruthy()
})

it('explains unavailable warehouse folders instead of offering lookups', () => {
  render(<Picker field={21} condition={6} status={{ ...ready, warehouseGroup: 'Папки складів ще не захоплені.' }} />)
  expect(screen.getByText('Папки складів ще не захоплені.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Дерево груп складів' })).toBeNull()
  expect(getAnalysisHierarchyPage).not.toHaveBeenCalled()
  expect(searchAnalysisValues).not.toHaveBeenCalled()
})

it('selects one product group for the Товар field through the product-group lookup', async () => {
  vi.mocked(searchAnalysisValues).mockResolvedValue([{ id: 'id:42', name: 'AL-KO', data: { Id: 42 } }])
  const onValues = vi.fn()
  render(<Picker field={1} condition={6} onValues={onValues} />)
  await waitFor(() => expect(searchAnalysisValues).toHaveBeenCalledWith(4, '', '2026-10-01', '2026-10-23', undefined, expect.any(AbortSignal)))
  fireEvent.click(screen.getByRole('combobox', { name: 'Значення' }))
  fireEvent.click(await screen.findByRole('option', { name: 'AL-KO' }))
  expect(onValues).toHaveBeenLastCalledWith([{ Data: { kind: 'productGroup', id: 42 }, Name: 'AL-KO', Value: 0 }])
  expect(screen.getByText('Група: AL-KO')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Дерево товарних груп' })).toBeTruthy()
})

it('keeps exact warehouse lists on flat conditions without typing them', async () => {
  vi.mocked(searchAnalysisValues).mockResolvedValue([{ id: 'id:3', name: 'Склад 3', data: { Id: 3 } }])
  const onValues = vi.fn()
  render(<Picker field={21} condition={2} status={null} onValues={onValues} />)
  await waitFor(() => expect(searchAnalysisValues).toHaveBeenCalledWith(21, '', '2026-10-01', '2026-10-23', undefined, expect.any(AbortSignal)))
  fireEvent.click(screen.getByRole('combobox', { name: 'Значення' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Склад 3' }))
  expect(onValues).toHaveBeenLastCalledWith([{ Data: { Id: 3 }, Name: 'Склад 3', Value: 0 }])
  expect(screen.queryByRole('radio', { name: 'Склади' })).toBeNull()
})
