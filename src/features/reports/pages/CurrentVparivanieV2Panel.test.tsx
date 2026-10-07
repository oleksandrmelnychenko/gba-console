import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { readCurrentVparivanieV2 } from '../api/currentVparivanieV2Api'
import { currentVparivanieDataset } from '../data/currentVparivanie.test-fixtures'
import type { ReportDataset } from '../types'
import { CurrentVparivanieV2Panel } from './CurrentVparivanieV2Panel'

vi.mock('../api/currentVparivanieV2Api',()=>({readCurrentVparivanieV2:vi.fn()}))
const enabled={...currentVparivanieDataset,currentVparivanie:{
  ...currentVparivanieDataset.currentVparivanie as object,
  RegionalV2Available:true,RegionalV2Day:'2026-09-03',
}}
const show=(dataset: ReportDataset=enabled)=>render(<MantineProvider env="test"><CurrentVparivanieV2Panel dataset={dataset}/></MantineProvider>)

it('does not offer a V2 read when the server has not published it',()=>{
  vi.clearAllMocks();show(currentVparivanieDataset)
  expect(screen.queryByRole('button',{name:'Показати V2'})).toBeNull()
  expect(screen.getByText(/очікує перевірки повного SQL-плану/)).toBeTruthy()
  expect(readCurrentVparivanieV2).not.toHaveBeenCalled()
  expect(screen.queryByRole('button',{name:'Завантажити XLSX'})).toBeNull()
  expect(screen.queryByRole('button',{name:'Завантажити PDF'})).toBeNull()
})

it('renders typed regional cells and keeps absent cells distinct from explicit null',async()=>{
  vi.clearAllMocks()
  vi.mocked(readCurrentVparivanieV2).mockResolvedValue({Version:2,Day:'2026-09-03',ProductCount:631,
    SaleFacts:1,ReturnFacts:0,Rows:[{ProductId:'1',Article:'A1',Name:'Goods',Description:null,
      Group:'AL-KO',OE:null,Size:null,Top:null,Cells:[
        {Column:'Stock',RegionCode:null,Quantity:'7.00',UnitId:'5',FactCount:1},
        {Column:'Sales',RegionCode:null,Quantity:null,UnitId:null,FactCount:1},
        {Column:'CounterpartyRegionCode',RegionCode:'RI00100',Quantity:'3',UnitId:'5',FactCount:1},
      ]},{ProductId:'2',Article:'A2',Name:'Empty',Description:null,Group:'AL-KO',OE:null,
      Size:null,Top:null,Cells:[]}]})
  show();fireEvent.click(screen.getByRole('button',{name:'Показати V2'}))
  await waitFor(()=>expect(readCurrentVparivanieV2).toHaveBeenCalledOnce())
  expect(screen.getByText('7.00')).toBeTruthy()
  expect(screen.getByText('∅')).toBeTruthy()
  expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  expect((screen.getByRole('button',{name:'Експорт CSV'}) as HTMLButtonElement).disabled).toBe(false)
  expect((screen.getByRole('button',{name:'Завантажити XLSX'}) as HTMLButtonElement).disabled).toBe(false)
  expect((screen.getByRole('button',{name:'Завантажити PDF'}) as HTMLButtonElement).disabled).toBe(false)
  expect(screen.getByText(/чернетка; звірку з 1С не підтверджено/)).toBeTruthy()
})

it('downloads real XLSX and PDF blobs with draft filenames from the current result', async () => {
  vi.clearAllMocks()
  vi.mocked(readCurrentVparivanieV2).mockResolvedValue({Version:2,Day:'2026-09-03',ProductCount:631,
    SaleFacts:0,ReturnFacts:0,Rows:[{ProductId:'1',Article:'A1',Name:'Товар',Description:null,
      Group:'AL-KO',OE:null,Size:null,Top:null,Cells:[]}]})
  const blobs: Blob[]=[]
  const files: string[]=[]
  Object.defineProperty(URL,'createObjectURL',{configurable:true,value:vi.fn((blob:Blob)=>{
    blobs.push(blob);return `blob:matrix-${blobs.length}`
  })})
  Object.defineProperty(URL,'revokeObjectURL',{configurable:true,value:vi.fn()})
  const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(function(this:HTMLAnchorElement){
    files.push(this.download)
  })
  try {
    show();fireEvent.click(screen.getByRole('button',{name:'Показати V2'}))
    await screen.findByText('Товар')
    fireEvent.click(screen.getByRole('button',{name:'Завантажити XLSX'}))
    await waitFor(()=>expect(files).toHaveLength(1))
    fireEvent.click(screen.getByRole('button',{name:'Завантажити PDF'}))
    await waitFor(()=>expect(files).toHaveLength(2))
    expect(files).toEqual([
      'vparivanie-region-v2-current-data-draft-2026-09-03.xlsx',
      'vparivanie-region-v2-current-data-draft-2026-09-03.pdf',
    ])
    expect(blobs.map(blob=>blob.type)).toEqual([
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/pdf',
    ])
    expect(await blobs[1].slice(0,8).text()).toBe('%PDF-1.3')
  } finally { click.mockRestore() }
},30_000)
