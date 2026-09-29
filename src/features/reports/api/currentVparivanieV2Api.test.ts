import { expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { currentVparivanieDataset } from '../data/currentVparivanie.test-fixtures'
import { readCurrentVparivanieV2 } from './currentVparivanieV2Api'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))

it('keeps the V2 route closed before any network call without explicit server capability', async () => {
  vi.clearAllMocks()
  await expect(readCurrentVparivanieV2(currentVparivanieDataset)).rejects.toThrow('не підтвердив')
  expect(apiRequest).not.toHaveBeenCalled()
})

it('transports only the pinned day and exact optional identities', async () => {
  vi.clearAllMocks()
  const enabled={ ...currentVparivanieDataset, currentVparivanie: {
    ...currentVparivanieDataset.currentVparivanie as object,
    RegionalV2Available: true, RegionalV2Day: '2026-09-03',
  } }
  const rows=Array.from({length:631},(_,index)=>({ProductId:String(index+1),Article:`A${index+1}`,
    Name:null,Description:null,Group:null,OE:null,Size:null,Top:null,
    Cells:index===0?[{Column:'Sales',RegionCode:null,Quantity:'-1',UnitId:'7',FactCount:1}]:[]}))
  vi.mocked(apiRequest).mockResolvedValue({Version:2,Day:'2026-09-03',ProductCount:631,
    SaleFacts:0,ReturnFacts:1,Rows:rows})
  const result=await readCurrentVparivanieV2(enabled,'9223372036854775807','abcdef1234567890abcdef1234567890')
  expect(result.Rows[0].Cells[0].Quantity).toBe('-1')
  expect(apiRequest).toHaveBeenCalledWith('/report/datasets/39/region-v2',{
    query:{day:'2026-09-03',buyerId:'9223372036854775807',
      buyerManager:'ABCDEF1234567890ABCDEF1234567890'},signal:undefined,
  })
})
