import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { searchDatasetReportValues } from '../api/reportsApi'
import { initialCustomerGroups } from '../data/customerGroups'
import { CustomerGroupsPanel } from './CustomerGroupsPanel'

vi.mock('../api/reportsApi',()=>({searchDatasetReportValues:vi.fn()}))
it('uses GBA client autocomplete and persists exact ids independently for each group',async()=>{
  vi.mocked(searchDatasetReportValues).mockResolvedValue([{Id:71,Name:'Покупець один'}])
  const onChange=vi.fn()
  render(<MantineProvider env="test"><CustomerGroupsPanel value={initialCustomerGroups()} onChange={onChange} disabled={false}/></MantineProvider>)
  await waitFor(()=>expect(searchDatasetReportValues).toHaveBeenCalledWith(44,6,{value:'',offset:0,limit:30},expect.any(AbortSignal)))
  fireEvent.click(screen.getByRole('combobox',{name:'Клієнти: Еталон'}))
  fireEvent.click(await screen.findByRole('option',{name:'Покупець один'}))
  expect(onChange).toHaveBeenLastCalledWith({Version:1,Groups:[{Name:'Еталон',ClientIds:[71]},{Name:'Порівнюваний набір',ClientIds:[]}]})
})
