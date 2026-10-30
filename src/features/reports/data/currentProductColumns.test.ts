import { expect, it } from 'vitest'
import { currentProductCapability, editableProductColumnsTemplate, readProductColumnsCapability, workbookConfigurationError } from './workbookPresentation'
import { productColumnsCapability, productColumnsDataset, productColumnsPreview, productColumnsRequest } from './currentProductColumns.test-fixtures'
import { productGroupsDataset } from './currentProductGroups.test-fixtures'
import { productDataset } from './currentProductFields.test-fixtures'
import { normalizeNativeReportPreview } from './nativeReportPreview'
import { bindWorkbookPreview } from './workbookPreview'
import { nextCurrentProductFieldsSelection } from './currentProductFieldsControls'

it('admits v4 additively while old versions retain their exact field allowlists and paging', () => {
 expect(currentProductCapability(productColumnsDataset)?.version).toBe(4)
 expect(currentProductCapability(productGroupsDataset)?.version).toBe(3)
 expect(currentProductCapability(productDataset)?.version).toBe(2)
 expect(workbookConfigurationError(productColumnsRequest(),productColumnsDataset)).toBeNull()
 for(const old of [2,3]) expect(workbookConfigurationError({...productColumnsRequest(),workbookPresentation:{version:old,additionalFields:[70],ordering:null}},productColumnsDataset)).not.toBeNull()
 expect(workbookConfigurationError(productColumnsRequest(),productGroupsDataset)).not.toBeNull()
 expect(readProductColumnsCapability({...productColumnsCapability,additionalFields:productColumnsCapability.additionalFields.filter(f=>f.type!==70)})).toBeNull()
 expect(readProductColumnsCapability({...productColumnsCapability,version:3})).toBeNull()
})
it('binds exact current scalars, full groups and selected order; null and empty remain distinct',()=>{
 const preview=normalizeNativeReportPreview({Preview:productColumnsPreview()});bindWorkbookPreview(productColumnsRequest(),preview)
 const values=preview.WorkbookPresentation!.rows[0].values
 expect(values[0].values).toEqual(['Нотатки з картки']);expect(values[4]).toMatchObject({state:'known',values:['']});expect(values[5]).toMatchObject({state:'null',values:[]})
 expect(values[1].references?.map(ref=>ref.id)).toEqual(['9007199254740993','9223372036854775807'])
 expect(()=>bindWorkbookPreview({...productColumnsRequest(),workbookPresentation:{version:4,additionalFields:[68,67,70,69,73,74],ordering:null}},preview)).toThrow()
 for(const field of [71,72,75]) {const bad=productColumnsPreview();bad.workbookPresentation.selection.additionalFields[0]=field;bad.workbookPresentation.fields[0].type=field;bad.workbookPresentation.rows[0].values[0].type=field;expect(()=>normalizeNativeReportPreview({Preview:bad})).toThrow()}
})
it('requires a named product-row profile and never infers a current field on a synthetic row',()=>{
 for(const change of [{dataSource:45},{reportProfile:undefined},{returnsOnly:true}]) expect(workbookConfigurationError({...productColumnsRequest(),...change},productColumnsDataset)).not.toBeNull()
 const row=productColumnsRequest();row.sorted.Col=row.sorted.Row;row.sorted.Row=[];expect(workbookConfigurationError(row,productColumnsDataset)).not.toBeNull()
 const raw=productColumnsPreview();raw.Rows[0].Values[0].Identity.Value='-1';expect(()=>normalizeNativeReportPreview({Preview:raw})).toThrow()
 const stale=productColumnsPreview();stale.workbookPresentation.resultSha256='f'.repeat(64);expect(()=>normalizeNativeReportPreview({Preview:stale})).toThrow()
})
it('downgrades only after an explicit edit removes unsupported fields and keeps v4 on current server',()=>{
 const selected={version:4 as const,additionalFields:[70,67,2],ordering:null}
 expect(nextCurrentProductFieldsSelection(currentProductCapability(productGroupsDataset),selected,[67,2])).toEqual({version:3,additionalFields:[67,2],ordering:null})
 expect(nextCurrentProductFieldsSelection(currentProductCapability(productDataset),selected,[2])).toEqual({version:2,additionalFields:[2],ordering:null})
 expect(nextCurrentProductFieldsSelection(currentProductCapability(productColumnsDataset),selected,[2])).toEqual({version:4,additionalFields:[2],ordering:null})
})

it('permits only valid scoped v4 templates to open for explicit repair, never silently mutating them',()=>{
 const request=productColumnsRequest(), before=structuredClone(request)
 expect(editableProductColumnsTemplate(request,productGroupsDataset)).not.toHaveProperty('workbookPresentation')
 expect(request).toEqual(before)
 for(const change of [{returnsOnly:true},{dataSource:45},{reportProfile:undefined},
   {workbookPresentation:{version:4,additionalFields:[71],ordering:null}},
   {workbookPresentation:{version:4,additionalFields:[70,70],ordering:null}},
   {WorkbookPresentation:request.workbookPresentation}]) {
   const invalid={...request,...change};expect(editableProductColumnsTemplate(invalid,productGroupsDataset)).toBe(invalid)
 }
 expect(editableProductColumnsTemplate(request,productColumnsDataset)).toBe(request)
})

it('does not upgrade existing scalar or group selections merely because the new capability is advertised',()=>{
 for(const version of [2,3] as const){
  const fields=version===2?[66,2]:[67,66,2]
  const selection={version,additionalFields:fields,ordering:null}
  expect(nextCurrentProductFieldsSelection(currentProductCapability(productColumnsDataset),selection,fields)).toEqual(selection)
  expect(nextCurrentProductFieldsSelection(currentProductCapability(productColumnsDataset),selection,[...fields,70])?.version).toBe(4)
 }
})
