import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { createStockReport, searchDatasetReportValues } from './reportsApi'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from './reportWorkspaceApi'
import { currentVparivanieDataset as legacy, currentVparivanieRequest, exactSelection } from '../data/currentVparivanie.test-fixtures'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest), reference = 'ABCDEF1234567890ABCDEF1234567890'
beforeEach(() => api.mockReset())
it('accepts advertised paired capability and canonical exact refs through request without mutating caller', async () => {
 const enabled = { ...legacy, currentVparivanie: { ...legacy.currentVparivanie as object, ManagerFilterSupported: true }, Filters: legacy.Filters.map(f => f.Type === 60 ? { ...f, Selectable: true } : f) }
 api.mockResolvedValue([enabled]);await expect(getReportDatasets()).resolves.toEqual([enabled])
 const request = { ...currentVparivanieRequest(), selections: [exactSelection(1),exactSelection(60,0,[reference.toLowerCase()])] }
 const original = structuredClone(request);api.mockResolvedValue({})
 await createStockReport(request)
 expect(request).toEqual(original)
 expect(api).toHaveBeenLastCalledWith('/report/stocks/generate',{method:'POST', dedupe: false,body:{...request,selections:[request.selections[0],{...request.selections[1],Values:[{...request.selections[1].Values[0],Data:{Id:reference}}]}]}})
})
it('preserves distinct source refs with equal labels and sends only field60 dataset lookup', async () => {
 const rows = [{Id:reference,Name:'One caption'},{Id:'BBCDEF1234567890ABCDEF1234567890',Name:'One caption'}]
 api.mockResolvedValue(rows);const controller=new AbortController()
 await expect(searchDatasetReportValues(39,60,{value:' mgr ',offset:0,limit:30},controller.signal)).resolves.toEqual(rows)
 expect(api).toHaveBeenCalledWith('/report/datasets/lookup',{query:{dataSource:39,field:60,value:'mgr',offset:0,limit:30},signal:controller.signal})
})
it.each([[{Id:reference.toLowerCase(),Name:'Wrong canonical'}],[{Id:12,Name:'Native User'}],
 [{Id:reference,Name:'One'},{Id:reference,Name:'Two'}]].map(rows=>({rows})))('refuses malformed or conflicting lookup rows %#', async ({rows}) => {
 api.mockResolvedValue(rows)
 await expect(searchDatasetReportValues(39,60,{value:'',offset:0,limit:30})).rejects.toThrow()
})
it.each([reference, '0'.repeat(32)])('loads and saves exact manager syntax without inventing a current capability: %s', async identity => {
 const request={...currentVparivanieRequest(),selections:[exactSelection(1),exactSelection(60,0,[identity])]}
 const wire={Id:'test',Revision:1,Name:'Manager variant',Data:{DataSource:39,From:request.from,To:request.to,Sorted:request.sorted,Selections:request.selections}}
 api.mockResolvedValue([wire]);const [template]=await getServerReportTemplates();expect(template.Data).toEqual(request)
 api.mockResolvedValue(wire);await saveServerReportTemplate(template)
 expect(api).toHaveBeenLastCalledWith('/report/templates/save',{method:'POST',body:{Id:'test',Revision:1,Name:'Manager variant',Data:request}})
})

it('keeps the returned EmptyRef string through lookup and generation without numeric coercion', async () => {
 const empty = '0'.repeat(32), rows = [{ Id: empty, Name: 'Без основного менеджера покупця' }]
 api.mockResolvedValue(rows)
 await expect(searchDatasetReportValues(39, 60, { value: 'Без', offset: 0, limit: 30 })).resolves.toEqual(rows)
 const request = { ...currentVparivanieRequest(), selections: [exactSelection(1), exactSelection(60, 0, [empty])] }
 const original = structuredClone(request)
 api.mockResolvedValue({})
 await createStockReport(request)
 expect(request).toEqual(original)
 expect(api).toHaveBeenLastCalledWith('/report/stocks/generate', { method: 'POST', dedupe: false, body: original })
})
