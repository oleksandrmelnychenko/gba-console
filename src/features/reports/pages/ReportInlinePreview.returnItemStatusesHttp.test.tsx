import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { previewStockReport } from '../api/reportsApi'
import fixture from '../data/returnItemStatuses.server-fixture.json'
import { returnItemStatusesCapability, returnItemStatusesError } from '../data/returnItemStatuses'
import { ReportPreviewPages } from './ReportPreviewPages'
vi.mock('../../../shared/api/apiClient',()=>({apiRequest:vi.fn()}))
afterEach(cleanup)
it('binds actual typed return-reason HTTP bytes, canonical summary and cached own-date rows without recomputation',async()=>{
 const api=vi.mocked(apiRequest)
 api.mockResolvedValue([fixture.dataset]);const [dataset]=await getReportDatasets()
 expect(returnItemStatusesCapability(dataset)).toHaveLength(9)
 expect(returnItemStatusesCapability(dataset)?.find(value=>value.value===0)?.name).toBe('Товар прибув пізніше заявленого терміну')
 api.mockResolvedValue([{Id:'return-reason-wire',Revision:1,Name:'Повернення',Data:fixture.request}]);const [template]=await getServerReportTemplates()
 expect(returnItemStatusesError(template.Data,dataset)).toBeNull()
 expect(template.Data.selections[0].Values[0].Data).toBe('{"ReturnItemStatus":6}')
 api.mockResolvedValueOnce({Version:2,ExplicitExport:true,MaximumPageRows:200,TimeToLiveSeconds:900}).mockResolvedValueOnce(fixture.page0)
 const {preview}=await previewStockReport(template.Data,dataset)
 const sent=api.mock.calls.find(([path])=>path==='/report/stocks/preview')?.[1]?.body
 expect(sent).toMatchObject({dataSource:2,returnsOnly:true,selections:fixture.request.Selections,from:'2026-09-03',to:'2026-09-04'})
 expect(preview.Request?.Filters?.find(filter=>filter.Field==='Причина повернення')?.Values).toEqual(['Брак'])
 expect(JSON.stringify(preview.Request)).not.toContain('Untrusted caption')
 expect(preview.Cells).toEqual(fixture.page0.Preview.Cells)
 expect(preview.Totals?.Values.map(cell=>cell.Value.Kind==='null'?null:Number(cell.Value.Value))).toEqual(fixture.expectedTotals)
 expect(preview.Request?.IsCurrentSnapshot).toBe(false)
 expect(fixture.page1.ResultSha256).toBe(fixture.page0.ResultSha256)
 expect(fixture.page1.Preview.Totals.Values).toEqual(fixture.page0.Preview.Totals.Values)
 render(<MantineProvider env="test"><ReportPreviewPages initial={preview} request={template.Data}/></MantineProvider>)
 api.mockResolvedValue(fixture.page1);fireEvent.click(screen.getByRole('button',{name:'Наступні рядки'}));await screen.findByText('2–2 із 2')
 expect(api).toHaveBeenLastCalledWith(expect.stringContaining('/report/stocks/preview/'),expect.objectContaining({query:expect.objectContaining({rowOffset:1})}))
 api.mockResolvedValue(fixture.page0);fireEvent.click(screen.getByRole('button',{name:'Попередні рядки'}));await screen.findByText('1–1 із 2')
 await waitFor(()=>expect(api).toHaveBeenLastCalledWith(expect.stringContaining('/report/stocks/preview/'),expect.objectContaining({query:expect.objectContaining({rowOffset:0})})))
 expect(api.mock.calls.filter(([path])=>path==='/report/stocks/preview')).toHaveLength(1)
 expect(template.Data.selections).toEqual(fixture.request.Selections)
})
