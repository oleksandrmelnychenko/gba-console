import { currentVparivanieDataset, currentVparivaniePreview } from './currentVparivanie.test-fixtures'

export const movementDataset = { ...currentVparivanieDataset, currentVparivanie: {
  ...currentVparivanieDataset.currentVparivanie as object, MovementQuantityVersion: 1,
  MovementQuantityColumns: ['Incoming', 'Outgoing'], MovementFilterScope: 'ProductGroupWarehouse',
} }
export function movementPreview() {
  const base = currentVparivaniePreview()
  const selection = { Incoming: true, Outgoing: true }
  const rowIdentity = { Kind: 'signedInteger', Value: '123', Provenance: 'rowAxisKey' }
  const columns = (['Прихід', 'Розхід'] as const).map((caption, index) => {
    const column = structuredClone(base.Columns[0]); column.Ordinal = 4 + index; column.SourceIndex = 4 + index
    column.Values[0].Caption = caption; column.Values[0].Identity.Value = String(4 + index)
    return column
  })
  return { ...base, Request: { ...base.Request, CurrentVparivanieMovements: selection },
    Rows: [{ ...base.Rows[0], Values: [{ ...base.Rows[0].Values[0], Identity: rowIdentity }] }],
    Columns: [...base.Columns, ...columns], Cells: [...base.Cells, ...columns.map(column => ({
      RowSourceIndex: 12, ColumnSourceIndex: column.SourceIndex, Value: { Kind: 'null', Value: null, Provenance: 'producerCell' },
    }))], CurrentVparivanieMovements: { Version: 1, ...selection, ResultSha256: base.ResultSha256,
      ProductCoverage: [{ ProductId: 123, Complete: false, Reasons: ['history_period_uncovered'] }],
      TotalProducts: 1, IncompleteProducts: 1, OldestCapturedAtUtc: '2026-09-26T12:00:00Z', NewestCapturedAtUtc: '2026-09-26T12:00:00Z' },
  }
}

