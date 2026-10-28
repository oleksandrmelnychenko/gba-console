import { expect, it } from 'vitest'
import { customerGroupsError, customerGroupsRequest, initialCustomerGroups } from './customerGroups'
import type { ReportDataset } from '../types'
import { defaultDatasetRequest } from './reportDatasets'

it('keeps one period and explicit source column without hiding the empty setup',()=>{
  const dataset: ReportDataset={DataSource:44,Name:'Порівняння',Description:'',PeriodSupported:true,PeriodRequired:true,Limitations:[],
    Groupings:[2,3,5,6,7,82,83].map(Type=>({Type,Name:String(Type)})),Measurements:[109,110,111,112,113,114].map(Type=>({Type,Name:String(Type)})),Filters:[]}
  const request=customerGroupsRequest(defaultDatasetRequest(dataset,'2026-10-01','2026-10-31'),dataset)
  expect(request.sorted.Col.map(field=>field.type)).toEqual([82])
  expect(request.sorted.Measurements.map(field=>field.Type)).toEqual([109,112])
  expect(request.from).toBe('2026-10-01')
  expect(customerGroupsError(request.customerGroups)).not.toBeNull()
  const groups=initialCustomerGroups();groups.Groups[0].ClientIds=[1];groups.Groups[1].ClientIds=[2]
  expect(customerGroupsError(groups)).toBeNull()
  groups.Groups[1].Name='Еталон';expect(customerGroupsError(groups)).not.toBeNull()
})
