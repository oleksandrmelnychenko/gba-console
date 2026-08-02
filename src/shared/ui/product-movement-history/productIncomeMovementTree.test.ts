import { describe, expect, it } from 'vitest'
import {
  buildProductIncomeMovementTree,
  formatProductIncomeMovementDateTime,
  hasCrossSourceStockCollision,
} from './productIncomeMovementTree'

describe('buildProductIncomeMovementTree', () => {
  it('groups two source projections under one logical arrival', () => {
    const visible = {
      Currency: 'EUR',
      ImportedForAmg: true,
      IncomeQty: 10,
      IncomeToStorageDate: '2026-06-19T10:00:00',
      IncomeToStorageNumber: 'OSD2026000000030',
      IsHide: false,
      NetPrice: 2.19,
      OrganizationName: 'ТОВ «АМГ «КОНКОРД»',
      RemainingQty: 0,
      SourceDocumentId: 'amg-osd30',
      SourceDocumentType: 3,
      StorageName: 'СКЛАД -3',
      SupplierName: 'OSMANLI',
    }
    const stock = {
      Currency: 'EUR',
      ImportedForAmg: false,
      IncomeQty: 10,
      IncomeToStorageDate: '2026-07-20T15:31:45',
      IncomeToStorageNumber: ' osd2026000000030 ',
      IsHide: true,
      NetPrice: 2.19,
      OrganizationName: 'ТОВ «АМГ «КОНКОРД»',
      RemainingQty: 2,
      SourceDocumentId: 'fenix-osd30',
      SourceDocumentType: 3,
      StorageName: 'СКЛАД -3',
      SupplierName: 'OSMANLI',
    }

    const result = buildProductIncomeMovementTree([visible, stock])

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject(stock)
    expect(result[0]?.Branches).toEqual([visible, stock])
  })

  it('does not group the same number across different organizations', () => {
    const result = buildProductIncomeMovementTree([
      { IncomeToStorageNumber: 'IN-1', OrganizationName: 'AMG' },
      { IncomeToStorageNumber: 'IN-1', OrganizationName: 'FENIX' },
    ])

    expect(result).toHaveLength(2)
  })

  it('keeps records without a document number as independent roots', () => {
    const result = buildProductIncomeMovementTree([
      { IncomeToStorageDate: '2026-07-20' },
      { IncomeToStorageDate: '2026-07-20' },
    ])

    expect(result).toHaveLength(2)
    expect(result.every((row) => row.Branches.length === 1)).toBe(true)
  })

  it('does not merge reused numbers with distinct same-source document identities', () => {
    const shared = {
      Currency: 'EUR',
      ImportedForAmg: false,
      IncomeQty: 1,
      IncomeToStorageNumber: 'EXМр0000003',
      OrganizationName: 'FENIX',
      NetPrice: 10,
      SourceDocumentType: 3,
      StorageName: '2443',
      SupplierName: 'Supplier',
    }

    const result = buildProductIncomeMovementTree([
      {
        ...shared,
        IncomeToStorageDate: '2025-01-10T09:15:00',
        SourceDocumentId: 'fenix-document-a',
      },
      {
        ...shared,
        IncomeToStorageDate: '2026-01-10T10:20:00',
        SourceDocumentId: 'fenix-document-b',
      },
    ])

    expect(result).toHaveLength(2)
    expect(result.every((row) => row.Branches.length === 1)).toBe(true)
  })

  it('does not merge complementary sources when financial document values differ', () => {
    const shared = {
      Currency: 'EUR',
      IncomeQty: 10,
      IncomeToStorageNumber: 'OSD2026000000030',
      IsHide: false,
      OrganizationName: 'AMG CONCORD',
      SourceDocumentType: 3,
      StorageName: 'СКЛАД -3',
      SupplierName: 'OSMANLI',
    }

    const result = buildProductIncomeMovementTree([
      {
        ...shared,
        ImportedForAmg: true,
        NetPrice: 2.19,
        SourceDocumentId: 'amg-osd30',
      },
      {
        ...shared,
        ImportedForAmg: false,
        IsHide: true,
        NetPrice: 2.2,
        SourceDocumentId: 'fenix-osd30',
      },
    ])

    expect(result).toHaveLength(2)
  })

  it('does not merge complementary sources when financial identity is absent', () => {
    const shared = {
      IncomeToStorageNumber: 'OSD2026000000030',
      IsHide: false,
      OrganizationName: 'AMG CONCORD',
      SourceDocumentType: 3,
      StorageName: 'СКЛАД -3',
      SupplierName: 'OSMANLI',
    }

    const result = buildProductIncomeMovementTree([
      {
        ...shared,
        ImportedForAmg: true,
        SourceDocumentId: 'amg-osd30',
      },
      {
        ...shared,
        ImportedForAmg: false,
        IsHide: true,
        SourceDocumentId: 'fenix-osd30',
      },
    ])

    expect(result).toHaveLength(2)
  })

  it('does not merge different source document types under a reused number', () => {
    const shared = {
      Currency: 'EUR',
      IncomeQty: 10,
      IncomeToStorageNumber: 'OSD2026000000030',
      IsHide: false,
      NetPrice: 2.19,
      OrganizationName: 'AMG CONCORD',
      StorageName: 'СКЛАД -3',
      SupplierName: 'OSMANLI',
    }

    const result = buildProductIncomeMovementTree([
      {
        ...shared,
        ImportedForAmg: true,
        SourceDocumentId: 'amg-osd30',
        SourceDocumentType: 2,
      },
      {
        ...shared,
        ImportedForAmg: false,
        IsHide: true,
        SourceDocumentId: 'fenix-osd30',
        SourceDocumentType: 3,
      },
    ])

    expect(result).toHaveLength(2)
  })

  it('never merges two stock-bearing source projections', () => {
    const shared = {
      Currency: 'EUR',
      IncomeQty: 2,
      IncomeToStorageNumber: 'OSD2026000000030',
      IsHide: true,
      NetPrice: 8.6,
      OrganizationName: 'ТОВ «АМГ «КОНКОРД»',
      RemainingQty: 2,
      SourceDocumentType: 3,
      StorageName: 'СКЛАД -3',
      SupplierName: 'OSMANLI',
    }

    const result = buildProductIncomeMovementTree([
      {
        ...shared,
        ImportedForAmg: true,
        SourceDocumentId: 'amg-osd30',
      },
      {
        ...shared,
        ImportedForAmg: false,
        SourceDocumentId: 'fenix-osd30',
      },
    ])

    expect(result).toHaveLength(2)
    expect(result.every((row) => row.Branches.length === 1)).toBe(true)
    expect(hasCrossSourceStockCollision(result)).toBe(true)
  })

  it('does not report a historical and operational pair as double stock', () => {
    const shared = {
      Currency: 'EUR',
      IncomeQty: 2,
      IncomeToStorageNumber: 'OSD2026000000030',
      NetPrice: 8.6,
      OrganizationName: 'ТОВ «АМГ «КОНКОРД»',
      SourceDocumentType: 3,
      StorageName: 'СКЛАД -3',
      SupplierName: 'OSMANLI',
    }

    expect(hasCrossSourceStockCollision([
      {
        ...shared,
        ImportedForAmg: true,
        IsHide: false,
        SourceDocumentId: 'amg-osd30',
      },
      {
        ...shared,
        ImportedForAmg: false,
        IsHide: true,
        SourceDocumentId: 'fenix-osd30',
      },
    ])).toBe(false)
  })

  it('renders the OSD2026000000030 naive API wall-clock values literally with seconds', () => {
    expect(formatProductIncomeMovementDateTime('2026-06-19T10:00:00'))
      .toBe('19.06.2026, 10:00:00')
    expect(formatProductIncomeMovementDateTime('2026-07-20T15:31:45'))
      .toBe('20.07.2026, 15:31:45')
  })

  it('honors explicit offsets instead of treating them as naive wall-clock values', () => {
    const value = '2026-06-19T10:00:00+03:00'
    const expected = new Intl.DateTimeFormat('uk-UA', {
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
      minute: '2-digit',
      month: '2-digit',
      second: '2-digit',
      year: 'numeric',
    }).format(new Date(value))

    expect(formatProductIncomeMovementDateTime(value)).toBe(expected)
  })
})
