import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { previewStockReport } from '../api/reportsApi'
import { normalizeNativeReportPreview } from '../data/nativeReportPreview'
import variants from '../data/customerGroupPresentation.server-fixture.json'
import { ReportPreviewPages } from './ReportPreviewPages'
vi.mock('../../../shared/api/apiClient',async original=>({...await original<typeof import('../../../shared/api/apiClient')>(),apiRequest:vi.fn()}))
beforeEach(()=>vi.clearAllMocks())
afterEach(cleanup)
it.each(variants)('binds actual source44 $name presentation without changing cohort totals, unknown units or cached values',async fixture=>{
 const api=vi.mocked(apiRequest);api.mockResolvedValue([fixture.dataset]);const [dataset]=await getReportDatasets()
 expect(dataset.constructorPresentation).toEqual({version:1,fields:['negativeRed','grandTotals']})
 api.mockResolvedValue([{Id:'presentation-wire',Revision:1,Name:'Порівняння',Data:fixture.request}]);const [template]=await getServerReportTemplates()
 api.mockResolvedValueOnce({Version:2,ExplicitExport:true,MaximumPageRows:200,TimeToLiveSeconds:900}).mockResolvedValueOnce(fixture.page0)
 const {preview}=await previewStockReport(template.Data,dataset)
 const body=api.mock.calls.find(([path])=>path==='/report/stocks/preview')?.[1]?.body
 expect(body).toMatchObject({dataSource:44,customerGroups:fixture.request.CustomerGroups,selections:fixture.request.Selections})
 if(fixture.name==='absent'){expect(body).not.toHaveProperty('constructorPresentation');expect(preview.constructorPresentation).toBeUndefined()}
 else {expect(body).toMatchObject({constructorPresentation:{version:1,negativeRed:fixture.expected.red,grandTotals:fixture.expected.grand}});expect(preview.constructorPresentation).toEqual({version:1,negativeRed:fixture.expected.red,grandTotals:fixture.expected.grand})}
 expect(preview.Cells).toEqual(fixture.page0.Preview.Cells)
 expect(preview.Totals?.Values.map(c=>c.Value.Kind==='null'?null:Number(c.Value.Value))).toEqual([null,null,null,110,0,0,null,null,null,70,-40,-36.36])
 expect(preview.Totals?.Values).toHaveLength(12);expect(preview.Totals?.Values).toEqual(variants[0].page0.Preview.Totals.Values)
 expect(preview.Request?.IsCurrentSnapshot).toBe(false)
 const view=render(<MantineProvider env="test"><ReportPreviewPages initial={preview} request={template.Data}/></MantineProvider>)
 expect(view.container.querySelector('tfoot')!==null).toBe(fixture.expected.grand)
 const cells=Array.from(view.container.querySelectorAll('tbody tr:not(.report-inline-preview__group-total) td'))
 expect(cells).toHaveLength(12)
 cells.forEach((cell,index)=>expect(cell.classList.contains('is-negative')).toBe(fixture.expected.red===true&&index>=10))
 expect(cells.filter(c=>c.textContent==='∅')).toHaveLength(6)
 expect(cells[4].textContent).toMatch(/^0(?:[.,]0+)?$/);expect(cells[5].textContent).toMatch(/^0(?:[.,]0+)?$/);expect(cells[0].getAttribute('aria-description')).toContain('Без підтвердженої одиниці документа')
 expect(view.container.querySelector('.report-inline-preview__group-total')).toBeTruthy()
 const requestBefore=structuredClone(template.Data)
 api.mockResolvedValue(fixture.page1);fireEvent.click(screen.getByRole('button',{name:'Наступні рядки'}));await screen.findByText('2–2 із 2')
 expect(api).toHaveBeenLastCalledWith(expect.stringContaining('/report/stocks/preview/'),expect.objectContaining({query:expect.objectContaining({rowOffset:1})}))
 expect(view.container.querySelector('tfoot')!==null).toBe(fixture.expected.grand)
 expect(Array.from(view.container.querySelectorAll('tbody tr:not(.report-inline-preview__group-total) td')).every(c=>!c.classList.contains('is-negative'))).toBe(true)
 expect(fixture.page1.ResultSha256).toBe(fixture.page0.ResultSha256);expect(fixture.page1.Preview.Totals.Values).toEqual(fixture.page0.Preview.Totals.Values)
 api.mockResolvedValue(fixture.page0);fireEvent.click(screen.getByRole('button',{name:'Попередні рядки'}));await screen.findByText('1–1 із 2')
 expect(api.mock.calls.filter(([path])=>path==='/report/stocks/preview')).toHaveLength(1);expect(template.Data).toEqual(requestBefore)
})
it('rejects presentation flags from other result namespaces and malformed explicit settings',()=>{
 const fixture=variants[4].page0
 expect(()=>normalizeNativeReportPreview({...fixture,Preview:{...fixture.Preview,Request:{...fixture.Preview.Request,DataSource:'NativeStockMovement'}}})).toThrow('Непідтримуване оформлення результату.')
 expect(()=>normalizeNativeReportPreview({...fixture,Preview:{...fixture.Preview,constructorPresentation:{version:1,negativeRed:'true',grandTotals:true}}})).toThrow('Непідтримуване оформлення результату.')
})
