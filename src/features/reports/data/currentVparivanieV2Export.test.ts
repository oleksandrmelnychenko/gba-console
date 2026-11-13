import { expect, it } from 'vitest'
import type { CurrentVparivanieV2Row } from './currentVparivanieV2'
import { currentVparivanieV2CellKey, currentVparivanieV2ColumnCaption, currentVparivanieV2Columns } from './currentVparivanieV2Export'

const row = (ProductId: string, Cells: CurrentVparivanieV2Row['Cells']): CurrentVparivanieV2Row =>
  ({ ProductId, Article: `A${ProductId}`, Name: `Товар ${ProductId}`, Description: null, Group: 'AL-KO', OE: null, Size: null, Top: null, Cells })

it('orders the distinct columns by kind and region and keeps a colon in a region code', () => {
  const columns = currentVparivanieV2Columns({ Rows: [
    row('1', [
      { Column: 'CounterpartyRegionCode', RegionCode: 'RI:001:00', Quantity: '0.00000001', UnitId: '12', FactCount: 1 },
      { Column: 'Sales', RegionCode: null, Quantity: null, UnitId: null, FactCount: 1 },
      { Column: 'Stock', RegionCode: null, Quantity: '9007199254740993.00000001', UnitId: '12', FactCount: 1 },
    ]),
    row('2', [{ Column: 'Sales', RegionCode: null, Quantity: '-1.2000', UnitId: '12', FactCount: 1 }]),
    row('3', []),
  ] })
  expect(columns).toEqual([
    currentVparivanieV2CellKey({ Column: 'Stock', RegionCode: null, Quantity: null, UnitId: null, FactCount: 1 }),
    currentVparivanieV2CellKey({ Column: 'Sales', RegionCode: null, Quantity: null, UnitId: null, FactCount: 1 }),
    currentVparivanieV2CellKey({ Column: 'CounterpartyRegionCode', RegionCode: 'RI:001:00', Quantity: null, UnitId: null, FactCount: 1 }),
  ])
  expect(columns.map(currentVparivanieV2ColumnCaption)).toEqual(['Остатки', 'Продажи', 'Регіон / RI:001:00'])
})
