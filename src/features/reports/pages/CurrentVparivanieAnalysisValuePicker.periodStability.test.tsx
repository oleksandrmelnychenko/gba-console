import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getAnalysisHierarchyPage, searchAnalysisValues } from '../api/currentVparivanieAnalysisApi'
import { currentVparivanieAnalysisCapability, type AnalysisHierarchyStatus } from '../data/currentVparivanieAnalysis'
import wire from '../data/currentVparivanieAnalysis.hierarchy-capability-fixture.json'
import { analysisDataset } from '../data/currentVparivanieAnalysis.test-fixtures'
import { CurrentVparivanieAnalysisValuePicker } from './CurrentVparivanieAnalysisValuePicker'

vi.mock('../api/currentVparivanieAnalysisApi', () => ({
  searchAnalysisValues: vi.fn(), getAnalysisHierarchyPage: vi.fn(), getAnalysisGroupPage: vi.fn(),
}))
const capability = currentVparivanieAnalysisCapability({ ...analysisDataset,
  currentVparivanie: { ...analysisDataset.currentVparivanie as object, analysis: wire } })!
const ready: AnalysisHierarchyStatus = { productGroup: null, counterpartyGroup: null, warehouseGroup: null }
const FOLDER = 'A0000000000000000000000000000001'
function Picker({ field, condition, from, to }: { field: number; condition: number; from: string; to: string }) {
  return <MantineProvider env="test"><I18nProvider><CurrentVparivanieAnalysisValuePicker
    descriptor={capability.filters.find(candidate => candidate.type === field)} status={ready}
    selection={{ IsChecked: true, SelectedField: { Type: field, Name: String(field) },
      FilterCondition: { Type: condition, Name: String(condition) }, Values: [] }}
    selections={[]} from={from} to={to} onChange={() => {}} /></I18nProvider></MantineProvider>
}
beforeEach(() => {
  vi.mocked(getAnalysisHierarchyPage).mockReset()
  vi.mocked(searchAnalysisValues).mockReset()
})

it('keeps a resolved counterparty folder visible when only the debounced report period settles', async () => {
  vi.mocked(getAnalysisHierarchyPage).mockResolvedValueOnce({ parentId: null, hasMore: false,
    items: [{ id: `fenix:${FOLDER}`, name: 'Київ', path: 'Покупці / Київ', hasChildren: false,
      data: { kind: 'counterpartyGroup', world: 'fenix', id: FOLDER } }] })
    .mockImplementation(() => new Promise(() => {}))
  const view = render(<Picker field={5} condition={7} from="" to="" />)
  fireEvent.click(screen.getByRole('combobox', { name: 'Значення' }))
  await screen.findByRole('option', { name: 'Покупці / Київ' })
  const firstSignal = vi.mocked(getAnalysisHierarchyPage).mock.calls[0][5]

  view.rerender(<Picker field={5} condition={7} from="2026-09-01" to="2026-09-27" />)

  expect({ calls: vi.mocked(getAnalysisHierarchyPage).mock.calls.length,
    optionPresent: screen.queryByRole('option', { name: 'Покупці / Київ' }) !== null,
    firstRequestAborted: firstSignal?.aborted }).toEqual({ calls: 1, optionPresent: true, firstRequestAborted: false })
  expect(searchAnalysisValues).not.toHaveBeenCalled()
})

it.each([{ field: 5, condition: 0, lookupField: 5 }, { field: 1, condition: 6, lookupField: 4 }])(
  'still replaces period-bound flat lookup results for field $field condition $condition', async ({ field, condition, lookupField }) => {
    vi.mocked(searchAnalysisValues).mockResolvedValueOnce([{ id: 'id:42', name: 'Попередній період', data: { Id: 42 } }])
      .mockResolvedValueOnce([{ id: 'id:43', name: 'Новий період', data: { Id: 43 } }])
    const view = render(<Picker field={field} condition={condition} from="" to="" />)
    fireEvent.click(screen.getByRole('combobox', { name: 'Значення' }))
    await screen.findByRole('option', { name: 'Попередній період' })
    const firstSignal = vi.mocked(searchAnalysisValues).mock.calls[0][5]

    view.rerender(<Picker field={field} condition={condition} from="2026-09-01" to="2026-09-27" />)

    await waitFor(() => expect(searchAnalysisValues).toHaveBeenCalledTimes(2))
    expect(searchAnalysisValues).toHaveBeenLastCalledWith(lookupField, '', '2026-09-01', '2026-09-27', undefined, expect.any(AbortSignal))
    expect(firstSignal?.aborted).toBe(true)
    expect(await screen.findByRole('option', { name: 'Новий період' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'Попередній період' })).toBeNull()
    expect(getAnalysisHierarchyPage).not.toHaveBeenCalled()
  })
