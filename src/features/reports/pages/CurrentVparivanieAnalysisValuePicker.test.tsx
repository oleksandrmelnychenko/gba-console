import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { useState } from 'react'
import { groupDescriptor } from '../data/currentVparivanieAnalysis.group-selection.test-fixtures'
import type { ReportSelectedValue } from '../types'
import { MantineProvider } from '@mantine/core'
import { render,screen,fireEvent,waitFor } from '@testing-library/react'
import { expect,it,vi } from 'vitest'
import { CurrentVparivanieAnalysisValuePicker } from './CurrentVparivanieAnalysisValuePicker'
import { searchAnalysisValues } from '../api/currentVparivanieAnalysisApi'
vi.mock('../api/currentVparivanieAnalysisApi',()=>({searchAnalysisValues:vi.fn()}))
it('selects canonical Top',async()=>{
vi.mocked(searchAnalysisValues).mockResolvedValue([{id:'top:A',name:'A',data:{name:'A'}}])
const onChange=vi.fn()
render(<MantineProvider env="test"><CurrentVparivanieAnalysisValuePicker selection={{IsChecked:true,SelectedField:{Type:3,Name:'Топ'},FilterCondition:{Type:0,Name:'Дорівнює'},Values:[]}} selections={[]} from="" to="" onChange={onChange}/></MantineProvider>)
fireEvent.click(screen.getByRole('combobox'))
fireEvent.click(await screen.findByRole('option',{name:'A'}))
await waitFor(()=>expect(onChange).toHaveBeenCalledWith([{Data:{name:'A'},Name:'A',Value:0}]))
})

it('discards lookup values from a previous period while the replacement request is pending', async () => {
  let resolveOld!: (values: Array<{id:string;name:string;data:{name:string}}>) => void
  vi.mocked(searchAnalysisValues).mockReset()
    .mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
    .mockImplementationOnce(() => new Promise(() => {}))
  const onChange = vi.fn()
  const props = { selection: { IsChecked: true, SelectedField: { Type: 3, Name: 'Топ' }, FilterCondition: { Type: 0, Name: 'Дорівнює' }, Values: [] }, selections: [], to: '2026-10-23', onChange }
  const view = render(<MantineProvider env="test"><CurrentVparivanieAnalysisValuePicker {...props} from="2026-01-01" /></MantineProvider>)
  view.rerender(<MantineProvider env="test"><CurrentVparivanieAnalysisValuePicker {...props} from="2026-10-01" /></MantineProvider>)
  resolveOld([{ id: 'top:A', name: 'Old period', data: { name: 'A' } }])
  await waitFor(() => expect(searchAnalysisValues).toHaveBeenCalledTimes(2))
  fireEvent.click(screen.getByRole('combobox'))
  expect(screen.queryByRole('option', { name: 'Old period' })).toBeNull()
  expect(onChange).not.toHaveBeenCalled()
})

function MixedPicker({ condition = 3 }: { condition?: number }) {
  const [values, setValues] = useState<ReportSelectedValue[]>([{ Data: { Id: 1 }, Name: 'Group one', Value: 0 }])
  return <CurrentVparivanieAnalysisValuePicker descriptor={groupDescriptor}
    selection={{ IsChecked: true, SelectedField: { Type: 4, Name: 'Група товару' }, FilterCondition: { Type: condition, Name: 'Mixed' }, Values: values }}
    selections={[]} from="2026-01-01" to="2026-10-24" onChange={setValues} />
}
it.each([3, 5])('selects products and groups with overlapping IDs independently for condition %i', async condition => {
  vi.mocked(searchAnalysisValues).mockReset().mockImplementation(async field => field === 1
    ? [{ id: '1', name: 'Product one', data: { Id: 1 } }]
    : [{ id: '1', name: 'Group one', data: { Id: 1 } }, { id: '2', name: 'Group two', data: { Id: '2' } }])
  render(<MantineProvider env="test"><I18nProvider><MixedPicker condition={condition} /></I18nProvider></MantineProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Значення' }))
  await screen.findByRole('option', { name: 'Group one' })
  expect(screen.queryByRole('option', { name: 'Всі' })).toBeNull()
  fireEvent.click(screen.getByRole('option', { name: 'Group two' }))
  expect(screen.getByText('Група: Group one')).toBeTruthy()
  expect(screen.getByText('Група: Group two')).toBeTruthy()
  fireEvent.click(screen.getByRole('radio', { name: 'Товари' }))
  await waitFor(() => expect(searchAnalysisValues).toHaveBeenLastCalledWith(1, '', '2026-01-01', '2026-10-24', undefined, expect.any(AbortSignal)))
  fireEvent.click(await screen.findByRole('option', { name: 'Product one' }))
  expect(screen.getByText('Товар: Product one')).toBeTruthy()
  expect(screen.getByText('Група: Group one')).toBeTruthy()
  expect(screen.getAllByText('Вибрано: 3').length).toBeGreaterThan(0)
  fireEvent.click(screen.getByRole('radio', { name: 'Групи' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Group one' }))
  expect(screen.queryByText('Група: Group one')).toBeNull()
  expect(screen.getByText('Товар: Product one')).toBeTruthy()
})
it('uses group-only lookup and allows explicit replacement of preserved multiple values for a one-group condition', async () => {
  vi.mocked(searchAnalysisValues).mockReset().mockResolvedValue([{ id: '1', name: 'Group one', data: { Id: 1 } }])
  const onChange = vi.fn()
  render(<MantineProvider env="test"><CurrentVparivanieAnalysisValuePicker descriptor={groupDescriptor}
    selection={{ IsChecked: true, SelectedField: { Type: 4, Name: 'Group' }, FilterCondition: { Type: 6, Name: 'У групі' },
      Values: [{ Data: { Id: 1 }, Name: 'Group one', Value: 0 }, { Data: { Id: 2 }, Name: 'Group two', Value: 0 }] }}
    selections={[]} from="" to="" onChange={onChange} /></MantineProvider>)
  expect(screen.queryByRole('radio', { name: 'Товари' })).toBeNull()
  fireEvent.click(screen.getByRole('combobox', { name: 'Значення' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Group one' }))
  expect(onChange).toHaveBeenCalledWith([{ Data: { Id: 1 }, Name: 'Group one', Value: 0 }])
})

it('ignores an old group response after switching the mixed lookup to products', async () => {
  let resolveGroup!: (values: Array<{ id: string; name: string; data: { Id: number } }>) => void
  vi.mocked(searchAnalysisValues).mockReset().mockImplementationOnce(() => new Promise(resolve => { resolveGroup = resolve }))
    .mockResolvedValueOnce([{ id: '2', name: 'Current product', data: { Id: 2 } }])
  render(<MantineProvider env="test"><I18nProvider><MixedPicker /></I18nProvider></MantineProvider>)
  fireEvent.click(screen.getByRole('radio', { name: 'Товари' }))
  fireEvent.click(screen.getByRole('button', { name: 'Значення' }))
  await screen.findByRole('option', { name: 'Current product' })
  resolveGroup([{ id: '3', name: 'Stale group', data: { Id: 3 } }])
  await waitFor(() => expect(searchAnalysisValues).toHaveBeenCalledTimes(2))
  expect(screen.queryByRole('option', { name: 'Stale group' })).toBeNull()
  fireEvent.click(screen.getByRole('option', { name: 'Current product' }))
  expect(screen.getByText('Товар: Current product')).toBeTruthy()
})
