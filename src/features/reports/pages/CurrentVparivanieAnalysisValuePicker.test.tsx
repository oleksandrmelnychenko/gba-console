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
