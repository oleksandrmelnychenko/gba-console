import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import { currentVparivanieDataset as dataset, currentVparivanieRequest, exactSelection } from '../data/currentVparivanie.test-fixtures'
import { ReportsStocksPage } from './ReportsStocksPage'
vi.mock('../../auth/useAuth',()=>({useAuth:()=>({hasPermission:()=>true})}))
vi.mock('../api/reportsApi',async original=>({...await original<typeof import('../api/reportsApi')>(),createStockReport:vi.fn(),searchDatasetReportValues:vi.fn()}))
vi.mock('../api/reportWorkspaceApi',async original=>({...await original<typeof import('../api/reportWorkspaceApi')>(),getReportDatasets:vi.fn(),getServerReportTemplates:vi.fn()}))
function Providers({children}:{children:ReactNode}) {return <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider>}
beforeEach(()=>{
  vi.clearAllMocks();localStorage.clear()
  Object.defineProperty(HTMLElement.prototype,'scrollIntoView',{configurable:true,value:vi.fn()})
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets,dataset])
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(createStockReport).mockResolvedValue({document:{},raw:{}})
  vi.mocked(searchDatasetReportValues).mockResolvedValue([{Id:'9223372036854775807',Name:'Synthetic group'}])
})
it('offers exact group lookup and InGroup only for this dataset, then sends fixed matrix axes',async()=>{
  const user=userEvent.setup();const {container}=render(<Providers><ReportsStocksPage /></Providers>)
  await screen.findByRole('button',{name:'Продажі за днями'})
  fireEvent.click(screen.getByRole('combobox',{name:'Набір даних звіту'}));fireEvent.click(await screen.findByRole('option',{name:dataset.Name}))
  fireEvent.change(screen.getByLabelText('Від'),{target:{value:'2026-09-01'}});fireEvent.change(screen.getByLabelText('До'),{target:{value:'2026-09-27'}})
  expect((screen.getByRole('button',{name:'Сформувати'}) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.getByText(/Менеджер покупця поки недоступний/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:'Додати умову'}));const dialog=screen.getByRole('dialog',{name:'Додати умову відбору'})
  fireEvent.click(within(dialog).getByRole('combobox',{name:'Поле'}))
  expect(screen.queryByRole('option',{name:'Фільтр 60'})).toBeNull()
  fireEvent.click(await screen.findByRole('option',{name:'Фільтр 4'}))
  expect((within(dialog).getByRole('combobox',{name:'Умова'}) as HTMLInputElement).value).toBe('У групі')
  await user.type(within(dialog).getByRole('combobox',{name:'Значення'}),'s')
  await waitFor(()=>expect(searchDatasetReportValues).toHaveBeenCalledWith(39,4,{limit:30,offset:0,value:'s'},expect.any(AbortSignal)))
  fireEvent.click(await screen.findByRole('option',{name:'Synthetic group'}));fireEvent.click(within(dialog).getByRole('button',{name:'Зберегти'}))
  fireEvent.submit(container.querySelector('form')!);await waitFor(()=>expect(createStockReport).toHaveBeenCalledOnce())
  const request=vi.mocked(createStockReport).mock.calls[0][0]
  expect(request.sorted.Row.map(row=>row.type)).toEqual([5]);expect(request.sorted.Col.map(col=>col.type)).toEqual([74,75])
  expect(request.sorted.Measurements.map(measure=>measure.Type)).toEqual([83])
  expect(request.selections).toMatchObject([{SelectedField:{Type:4},FilterCondition:{Type:6},Values:[{Data:{Id:'9223372036854775807'},Value:0}]}])
})
it('refuses a saved selected-manager variant before replacing an existing ordinary report',async()=>{
  const Data={...currentVparivanieRequest(),selections:[exactSelection(1),exactSelection(60)]}
  vi.mocked(getServerReportTemplates).mockResolvedValue([{Id:'synthetic',Revision:1,Name:'Unsupported manager',Data}])
  render(<Providers><ReportsStocksPage /></Providers>);await screen.findByRole('button',{name:'Продажі за днями'})
  fireEvent.click(screen.getByRole('button',{name:'Шаблони'}));fireEvent.click(await screen.findByRole('button',{name:/Unsupported manager/}))
  expect(screen.getByText(/Відбір за менеджером покупця поки недоступний/)).toBeTruthy()
  expect((screen.getByRole('combobox',{name:'Набір даних звіту'}) as HTMLInputElement).value).not.toBe(dataset.Name)
  expect(createStockReport).not.toHaveBeenCalled()
})
