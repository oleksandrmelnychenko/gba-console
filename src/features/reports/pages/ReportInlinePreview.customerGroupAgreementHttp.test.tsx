import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { previewStockReport } from '../api/reportsApi'
import { searchCustomerGroupChoices } from '../api/customerGroupSelectionsApi'
import fixture from '../data/customerGroupAgreement.server-fixture.json'
import { ReportPreviewPages } from './ReportPreviewPages'
vi.mock('../../../shared/api/apiClient',()=>({apiRequest:vi.fn()}))
it('binds actual Agreement9 string identity through saved request, cached pages and per-cohort totals without broadening cohorts',async()=>{
 const api=vi.mocked(apiRequest)
 api.mockResolvedValue([fixture.dataset]);const [dataset]=await getReportDatasets()
 expect(dataset.Filters.find(field=>field.Type===9)).toMatchObject({Name:'Договір клієнта',Selectable:true})
 expect(dataset.Filters.find(field=>field.Type===9)?.hierarchy).toBeUndefined()
 api.mockResolvedValue([{Id:'agreement-wire',Revision:1,Name:'Набори',Data:fixture.request}]);const [template]=await getServerReportTemplates()
 api.mockResolvedValueOnce({Version:2,ExplicitExport:true,MaximumPageRows:200,TimeToLiveSeconds:900}).mockResolvedValueOnce(fixture.page0)
 const {preview}=await previewStockReport(template.Data,dataset)
 const sent=api.mock.calls.find(([path])=>path==='/report/stocks/preview')?.[1]?.body
 expect(sent).toMatchObject({dataSource:44,customerGroups:fixture.request.CustomerGroups,selections:fixture.request.Selections,from:'2026-09-01',to:'2026-09-03'})
 expect(template.Data.selections.find(s=>s.SelectedField.Type===9)?.Values).toEqual(fixture.request.Selections.find(s=>s.SelectedField.Type===9)?.Values)
 expect(typeof template.Data.selections.find(s=>s.SelectedField.Type===9)?.Values[0].Data.Id).toBe('string')
 expect(preview.Cells).toEqual(fixture.page0.Preview.Cells);expect(preview.Request?.IsCurrentSnapshot).toBe(false)
 expect(preview.Request?.Filters?.find(f=>f.Field==='Договір клієнта')?.Values).toEqual(['Клієнт — Спільні умови № Agreement-1 [1]'])
 expect(preview.Request?.Notes).toEqual(fixture.page0.Preview.Request.Notes)
 expect(preview.Request?.Notes?.filter(n=>n.includes('поточні дані картки клієнта'))).toHaveLength(1)
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
 expect(fixture.agreementLookupHttp.Body).toEqual(fixture.agreementLookup)
 api.mockResolvedValue(fixture.agreementLookupHttp.Body)
 expect(await searchCustomerGroupChoices(9,'id:1',0)).toEqual([{Id:'1',Name:'Клієнт — Спільні умови № Agreement-1 [1]'}])
 expect(api).toHaveBeenLastCalledWith('/report/datasets/lookup',expect.objectContaining({query:{dataSource:44,field:9,value:'id:1',offset:0,limit:30}}))
})
