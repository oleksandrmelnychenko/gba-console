

export const CURRENT_VPARIVANIE_V2_COLUMNS = ['Stock', 'Sales', 'CounterpartyTotal',
  'CounterpartyRegionCode', 'CounterpartyUnknown'] as const
type CurrentVparivanieV2Column = typeof CURRENT_VPARIVANIE_V2_COLUMNS[number]
export type CurrentVparivanieV2Cell = { Column: CurrentVparivanieV2Column; RegionCode: string | null;
  Quantity: string | null; UnitId: string | null; FactCount: number }
export type CurrentVparivanieV2Row = { ProductId: string; Article: string | null; Name: string | null;
  Description: string | null; Group: string | null; OE: string | null; Size: string | null;
  Top: string | null; Cells: CurrentVparivanieV2Cell[] }
export type CurrentVparivanieV2Result = { Version: 2; Day: '2026-09-03';
  ProductCount: 631; SaleFacts: number; ReturnFacts: number; Rows: CurrentVparivanieV2Row[] }
