import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, getReportClientAgreements, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from '../api/reportWorkspaceApi'
import { defaultDatasetRequest } from '../data/reportDatasets'
import { getNativeReportProfile } from '../data/nativeReportProfiles'
import { reportDatasets, nativeDocumentDatasets, currentDebtDataset, supplierReturnDataset } from '../data/reportDatasets.test-fixtures'
import type { ReportTemplate } from '../types'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth',()=>({useAuth:()=>({hasPermission:()=>true})}))
vi.mock('../api/reportsApi',async original=>({...await original<typeof import('../api/reportsApi')>(),createStockReport:vi.fn(),getReportClientAgreements:vi.fn(),searchDatasetReportValues:vi.fn()}))
vi.mock('../api/reportWorkspaceApi',async original=>({...await original<typeof import('../api/reportWorkspaceApi')>(),getReportDatasets:vi.fn(),getServerReportTemplates:vi.fn(),saveServerReportTemplate:vi.fn()}))
function Providers({children}:{children:ReactNode}) {return <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider>}
async function ready() {const view=render(<Providers><ReportsStocksPage /></Providers>);await screen.findByRole('button',{name:'Продажі за днями'});return view}
async function choose(name:string) {fireEvent.click(screen.getByRole('combobox',{name:'Набір даних звіту'}));fireEvent.click(await screen.findByRole('option',{name}))}

describe('native supplier-return documents and current debt',()=>{
  beforeEach(()=>{
    vi.clearAllMocks();localStorage.clear()
    Object.defineProperty(HTMLElement.prototype,'scrollIntoView',{configurable:true,value:vi.fn()})
    vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets,...nativeDocumentDatasets])
    vi.mocked(getServerReportTemplates).mockResolvedValue([])
    vi.mocked(createStockReport).mockResolvedValue({document:{},raw:{}})
    vi.mocked(saveServerReportTemplate).mockImplementation(async template=>({...template,Revision:2}))
  })
  it('keeps supplier returns periodic and debt current-only with their own presets and measures',async()=>{
    const {container}=await ready()
    fireEvent.change(screen.getByLabelText('Від'),{target:{value:'2026-06-01'}});fireEvent.change(screen.getByLabelText('До'),{target:{value:'2026-06-30'}})
    for(const dataset of nativeDocumentDatasets) {
      await choose(dataset.Name)
      fireEvent.click(screen.getByRole('button',{name:getNativeReportProfile(dataset.DataSource)!.preset.name}))
      expect(screen.queryByRole('combobox',{name:'Договір для оцінки'})).toBeNull()
      expect(screen.queryByLabelText('Від')!==null).toBe(dataset.DataSource===9)
      expect(screen.getByRole('checkbox',{name:dataset.Measurements[0].Name})).toBeTruthy()
      fireEvent.submit(container.querySelector('form')!)
      await waitFor(()=>expect(createStockReport).toHaveBeenCalledTimes(dataset.DataSource===9?1:2))
      expect(vi.mocked(createStockReport).mock.lastCall?.[0]).toEqual(defaultDatasetRequest(dataset,'2026-06-01','2026-06-30'))
    }
    await choose(supplierReturnDataset.Name)
    expect((screen.getByLabelText('Від') as HTMLInputElement).value).toBe('2026-06-01')
    fireEvent.change(screen.getByLabelText('Від'),{target:{value:''}})
    expect((screen.getByRole('button',{name:'Сформувати'}) as HTMLButtonElement).disabled).toBe(true)
  })
  it.each(nativeDocumentDatasets.flatMap(dataset=>dataset.Filters.map(field=>({dataset,field}))))('uses source $dataset.DataSource native one-character lookup for exact field $field.Type',async({dataset,field})=>{
    const id=field.Type===27?1:77
    vi.mocked(searchDatasetReportValues).mockResolvedValue([{Id:id,Name:`Тест [${id}]`}])
    const user=userEvent.setup();const {container}=await ready();await choose(dataset.Name)
    fireEvent.click(screen.getByRole('button',{name:'Додати умову'}));const dialog=screen.getByRole('dialog',{name:'Додати умову відбору'})
    fireEvent.click(within(dialog).getByRole('combobox',{name:'Поле'}));fireEvent.click(await screen.findByRole('option',{name:field.Name}))
    await user.type(within(dialog).getByRole('combobox',{name:'Значення'}),'т')
    await waitFor(()=>expect(searchDatasetReportValues).toHaveBeenCalledWith(dataset.DataSource,field.Type,{limit:30,offset:0,value:'т'},expect.any(AbortSignal)))
    expect(getReportClientAgreements).not.toHaveBeenCalled();expect(screen.queryByText(/Спочатку виберіть клієнта/)).toBeNull()
    fireEvent.click(await screen.findByRole('option',{name:`Тест [${id}]`}));fireEvent.click(within(dialog).getByRole('button',{name:'Зберегти'}))
    fireEvent.submit(container.querySelector('form')!);await waitFor(()=>expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0].selections).toMatchObject([{SelectedField:{Type:field.Type},Values:[{Data:{Id:id},Value:id}]}])
  })
  it('applies and updates a current debt template with exact ownership contract, currency and disabled supplier condition',async()=>{
    const data=defaultDatasetRequest(currentDebtDataset,'','')
    data.selections=[{IsChecked:true,SelectedField:{Name:'CustomerContract',Type:9},FilterCondition:{Name:'Дорівнює',Type:0},Values:[{Data:{Id:42},Name:'Договір42',Value:42}]},
      {IsChecked:true,SelectedField:{Name:'DebtCurrency',Type:25},FilterCondition:{Name:'Дорівнює',Type:0},Values:[{Data:{Id:1},Name:'EUR [1]',Value:1}]},
      {IsChecked:false,SelectedField:{Name:'SupplierContract',Type:18},FilterCondition:{Name:'Дорівнює',Type:0},Values:[{Data:{Id:99},Name:'Договір99',Value:99}]}]
    const template:ReportTemplate={Id:crypto.randomUUID(),Revision:1,Name:'Мій борг',Data:data}
    vi.mocked(getServerReportTemplates).mockResolvedValue([template]);const {container}=await ready()
    fireEvent.click(screen.getByRole('button',{name:'Шаблони'}));fireEvent.click(await screen.findByRole('button',{name:/Мій борг/}))
    expect(screen.queryByLabelText('Від')).toBeNull();expect(screen.queryByRole('combobox',{name:'Договір для оцінки'})).toBeNull()
    fireEvent.submit(container.querySelector('form')!);await waitFor(()=>expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0]).toEqual({...data,selections:data.selections.slice(0,2)})
    fireEvent.click(screen.getByRole('button',{name:'Шаблони'}));fireEvent.click(screen.getByRole('button',{name:'Зберегти'}))
    await waitFor(()=>expect(saveServerReportTemplate).toHaveBeenCalledOnce());expect(vi.mocked(saveServerReportTemplate).mock.calls[0][0].Data).toEqual(data)
  })
  it('refuses a dated debt template before changing the selected periodic dataset',async()=>{
    const data={...defaultDatasetRequest(currentDebtDataset,'',''),from:'2026-06-01',to:'2026-06-30'}
    vi.mocked(getServerReportTemplates).mockResolvedValue([{Id:crypto.randomUUID(),Revision:1,Name:'Історичний борг',Data:data}]);await ready()
    fireEvent.click(screen.getByRole('button',{name:'Шаблони'}));fireEvent.click(await screen.findByRole('button',{name:/Історичний борг/}))
    expect(screen.getByText(/Поточна заборгованість не підтримує період/)).toBeTruthy();expect(screen.getByLabelText('Від')).toBeTruthy()
  })
})
