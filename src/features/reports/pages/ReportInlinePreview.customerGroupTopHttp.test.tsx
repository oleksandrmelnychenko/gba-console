import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { previewStockReport } from '../api/reportsApi'
import { searchCustomerGroupTop } from '../api/customerGroupTopApi'
import fixture from '../data/customerGroupTop.server-fixture.json'
import { ReportPreviewPages } from './ReportPreviewPages'
vi.mock('../../../shared/api/apiClient',()=>({apiRequest:vi.fn()}))
it('binds actual TOP3 raw Name identity through saved all-seven-filter request and cached pages without changing cohorts/unknown quantities',async()=>{
 const api=vi.mocked(apiRequest)
 api.mockResolvedValue([fixture.dataset]);const [dataset]=await getReportDatasets()
 expect(dataset.Filters.find(field=>field.Type===3)).toMatchObject({Name:'Поточний TOP товару',Selectable:true})
 expect(dataset.Filters.find(field=>field.Type===3)?.hierarchy).toBeUndefined()
 api.mockResolvedValue([{Id:'top-wire',Revision:1,Name:'Набори',Data:fixture.request}]);const [template]=await getServerReportTemplates()
 api.mockResolvedValueOnce({Version:2,ExplicitExport:true,MaximumPageRows:200,TimeToLiveSeconds:900}).mockResolvedValueOnce(fixture.page0)
 const {preview}=await previewStockReport(template.Data,dataset)
 const sent=api.mock.calls.find(([path])=>path==='/report/stocks/preview')?.[1]?.body
 expect(sent).toMatchObject({dataSource:44,customerGroups:fixture.request.CustomerGroups,selections:fixture.request.Selections,from:'2026-09-01',to:'2026-09-03'})
 const top=template.Data.selections.find(item=>item.SelectedField.Type===3)
 expect(top?.Values.map(value=>value.Data)).toEqual([{Name:'X9'},{Name:'E  '}]);expect(top?.Values.map(value=>value.Value)).toEqual([0,0])
 expect(template.Data.selections.map(item=>item.SelectedField.Type).sort((a,b)=>a-b)).toEqual([0,1,3,7,8,9,10])
 expect(preview.Cells).toEqual(fixture.page0.Preview.Cells);expect(preview.Request?.IsCurrentSnapshot).toBe(false)
 expect(preview.Request?.Filters?.find(f=>f.Field==='Поточний TOP товару')?.Values).toEqual(['X9','E'])
 expect(preview.Request?.Notes).toEqual(fixture.page0.Preview.Request.Notes)
 expect(preview.Request?.Notes?.filter(n=>n==='TOP у відборі — поточні дані картки товару; його зміна впливає і на звіти за минулі періоди.')).toHaveLength(1)
 expect(preview.Totals?.Values.map(cell=>cell.Value.Kind==='null'?null:Number(cell.Value.Value))).toEqual([null,null,null,70,0,0,0,null,null,0,-70,-100])
 expect(fixture.page1.ResultSha256).toBe(fixture.page0.ResultSha256);expect(fixture.page1.Preview.Totals.Values).toEqual(fixture.page0.Preview.Totals.Values)
 expect(fixture.page0.Preview.Totals.Groups[0].Values[3].Value.Value).toBe('60');expect(fixture.page1.Preview.Totals.Groups[0].Values[3].Value.Value).toBe('10')
 const view=render(<MantineProvider env="test"><ReportPreviewPages initial={preview} request={template.Data}/></MantineProvider>)
 const quantity=view.container.querySelector('tbody tr:not(.report-inline-preview__group-total) td')!
 expect(quantity.textContent).toBe('∅');expect(quantity.getAttribute('aria-description')).toContain('Без підтвердженої одиниці документа')
 api.mockResolvedValue(fixture.page1);fireEvent.click(screen.getByRole('button',{name:'Наступні рядки'}));await screen.findByText('2–2 із 2')
 expect(api).toHaveBeenLastCalledWith(expect.stringContaining('/report/stocks/preview/'),expect.objectContaining({query:expect.objectContaining({rowOffset:1})}))
 api.mockResolvedValue(fixture.page0);fireEvent.click(screen.getByRole('button',{name:'Попередні рядки'}));await screen.findByText('1–1 із 2')
 await waitFor(()=>expect(api).toHaveBeenLastCalledWith(expect.stringContaining('/report/stocks/preview/'),expect.objectContaining({query:expect.objectContaining({rowOffset:0})})))
 expect(api.mock.calls.filter(([path])=>path==='/report/stocks/preview')).toHaveLength(1)
 expect(template.Data.customerGroups).toEqual(fixture.request.CustomerGroups);expect(template.Data.selections).toEqual(fixture.request.Selections)
 api.mockResolvedValue(fixture.topLookupHttp.Body)
 expect(await searchCustomerGroupTop('',0)).toEqual(['E  ','X9'])
 expect(api).toHaveBeenLastCalledWith('/report/datasets/lookup',expect.objectContaining({query:{dataSource:44,field:3,value:'',offset:0,limit:30}}))
})
