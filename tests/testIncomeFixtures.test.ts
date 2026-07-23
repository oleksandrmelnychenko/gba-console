import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import {
  TEST_INCOME_CUSTOMS_DATE,
  TEST_INCOME_RATES,
  TEST_INCOME_SUPPLIERS,
  type TestIncomeSupplierFixture,
} from './fixtures/testIncomeManifest'

const testIncomeRoot = path.resolve(process.cwd(), 'SQL/TestIncome')

const cellAddress = (row: number, column: number) =>
  XLSX.utils.encode_cell({ r: row - 1, c: column - 1 })

const getCell = (sheet: XLSX.WorkSheet, row: number, column: number) =>
  sheet[cellAddress(row, column)]

const getRequiredText = (sheet: XLSX.WorkSheet, row: number, column: number) => {
  const value = getCell(sheet, row, column)?.v
  const text = String(value ?? '').trim()

  expect(text, `Expected text at row ${row}, column ${column}`).not.toBe('')

  return text
}

const getRequiredNumber = (sheet: XLSX.WorkSheet, row: number, column: number) => {
  const value = Number(getCell(sheet, row, column)?.v)

  expect(Number.isFinite(value), `Expected number at row ${row}, column ${column}`).toBe(true)

  return value
}

const roundCurrency = (value: number) => Number(value.toFixed(2))

const readSupplierWorkbook = (fixture: TestIncomeSupplierFixture) => {
  const workbookPath = path.join(
    testIncomeRoot,
    fixture.directory,
    'Розмитнення',
    `CCD_${fixture.declarationNumber} — копия.xlsx`,
  )

  expect(fs.existsSync(workbookPath), workbookPath).toBe(true)

  const workbook = XLSX.read(fs.readFileSync(workbookPath), {
    type: 'buffer',
    cellFormula: true,
  })
  const firstSheetName = workbook.SheetNames[0]

  expect(firstSheetName).toBeTruthy()

  return workbook.Sheets[firstSheetName]
}

describe('TestIncome source workbooks', () => {
  it('contains the complete seven-supplier, 507-line delivery', () => {
    expect(TEST_INCOME_SUPPLIERS).toHaveLength(7)
    expect(
      TEST_INCOME_SUPPLIERS.reduce((total, fixture) => total + fixture.expected.rows, 0),
    ).toBe(507)
    expect(TEST_INCOME_CUSTOMS_DATE).toBe('2026-07-20')
  })

  for (const fixture of TEST_INCOME_SUPPLIERS) {
    it(`${fixture.supplier} matches its upload contract and financial control totals`, () => {
      const sheet = readSupplierWorkbook(fixture)
      const config = fixture.parseConfiguration
      const rowKeys = new Set<string>()
      const canonicalRows: string[] = []
      const externalFormulaCells: XLSX.CellObject[] = []
      let qty = 0
      let sourceInvoiceTotal = 0
      let customsValue = 0
      let duty = 0
      let vatValue = 0

      expect(config.endRow - config.startRow + 1).toBe(fixture.expected.rows)

      for (let row = config.startRow; row <= config.endRow; row += 1) {
        const vendorCodeCell = getCell(sheet, row, config.vendorCode)
        const vendorCode = getRequiredText(sheet, row, config.vendorCode)
        const specificationCode = getRequiredText(sheet, row, config.specificationCode)
        const price = getRequiredNumber(sheet, row, config.price)
        const rowQty = getRequiredNumber(sheet, row, config.qty)
        const rowCustomsValue = getRequiredNumber(sheet, row, config.customsValue)
        const rowDuty = getRequiredNumber(sheet, row, config.duty)
        const rowVatValue = getRequiredNumber(sheet, row, config.vatValue)

        expect(specificationCode).not.toBe('')
        expect(price).toBeGreaterThan(0)
        expect(rowQty).toBeGreaterThan(0)
        expect(rowCustomsValue).toBeGreaterThan(0)
        expect(rowDuty).toBeGreaterThanOrEqual(0)
        expect(rowVatValue).toBeGreaterThan(0)

        if (vendorCodeCell?.f?.includes('[')) {
          externalFormulaCells.push(vendorCodeCell)
          expect(String(vendorCodeCell.v ?? '').trim()).not.toBe('')
        }

        const rowKey = `${vendorCode}|${rowQty}|${price.toFixed(4)}`
        expect(rowKeys.has(rowKey), `Duplicate import key ${rowKey}`).toBe(false)
        rowKeys.add(rowKey)

        canonicalRows.push(
          [
            row,
            vendorCode,
            specificationCode,
            price.toFixed(4),
            rowQty.toFixed(6),
            rowCustomsValue.toFixed(2),
            rowDuty.toFixed(2),
            rowVatValue.toFixed(2),
          ].join('|'),
        )

        qty += rowQty
        sourceInvoiceTotal += price * rowQty
        customsValue += rowCustomsValue
        duty += rowDuty
        vatValue += rowVatValue
      }

      expect(rowKeys.size).toBe(fixture.expected.rows)
      expect(createHash('sha256').update(canonicalRows.join('\n'), 'utf8').digest('hex')).toBe(
        fixture.expectedRowDigest,
      )
      expect(externalFormulaCells).toHaveLength(fixture.expectedExternalFormulaCells)
      expect(qty).toBe(fixture.expected.qty)
      expect(roundCurrency(sourceInvoiceTotal)).toBe(fixture.expected.sourceInvoiceTotal)
      expect(roundCurrency(customsValue)).toBe(fixture.expected.customsValue)
      expect(roundCurrency(duty)).toBe(fixture.expected.duty)
      expect(roundCurrency(vatValue)).toBe(fixture.expected.vatValue)
    })
  }

  it('keeps repeated vendor codes as separate, distinguishable invoice lines', () => {
    const vendorCodeCounts = new Map<string, number>()

    for (const fixture of TEST_INCOME_SUPPLIERS) {
      const sheet = readSupplierWorkbook(fixture)
      const config = fixture.parseConfiguration

      for (let row = config.startRow; row <= config.endRow; row += 1) {
        const vendorCode = getRequiredText(sheet, row, config.vendorCode)
        vendorCodeCounts.set(vendorCode, (vendorCodeCounts.get(vendorCode) ?? 0) + 1)
      }
    }

    expect(
      [...vendorCodeCounts.entries()]
        .filter(([, count]) => count > 1)
        .sort(([left], [right]) => left.localeCompare(right)),
    ).toEqual(
      [
        ['101-U11-108-2 MAYER', 2],
        ['1231528712 NR', 2],
        ['13460CNT', 2],
      ],
    )
  })

  it('keeps the NBU customs rates and allocated supplier totals intact', () => {
    const deliveryWorkbookPath = path.join(testIncomeRoot, 'доставка контех.xlsx')
    const workbook = XLSX.read(fs.readFileSync(deliveryWorkbookPath), { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]

    expect(sheet.Q1?.v).toBe('Євро')
    expect(sheet.R1?.v).toBe(TEST_INCOME_RATES.nbuEur)
    expect(sheet.Q2?.v).toBe('Долар США')
    expect(sheet.R2?.v).toBe(TEST_INCOME_RATES.nbuUsd)

    let supplierInvoiceTotal = 0
    let allocatedDeliveryTotal = 0

    for (const fixture of TEST_INCOME_SUPPLIERS) {
      const invoiceTotal = Number(sheet[`E${fixture.deliveryRow}`]?.v)
      const deliveryTotal = Number(sheet[`J${fixture.deliveryRow}`]?.v)

      expect(roundCurrency(invoiceTotal)).toBe(fixture.expected.deliveryInvoiceTotalEur)
      expect(Number.isFinite(deliveryTotal)).toBe(true)

      supplierInvoiceTotal += invoiceTotal
      allocatedDeliveryTotal += deliveryTotal
    }

    expect(roundCurrency(supplierInvoiceTotal)).toBe(88748.35)
    expect(allocatedDeliveryTotal).toBeCloseTo(Number(sheet.J12?.v), 10)
    expect(allocatedDeliveryTotal).toBeCloseTo(1926.8625818897563, 10)
  })

  it('does not confuse the commercial EUR rate with the customs NBU rate', () => {
    expect(TEST_INCOME_RATES.commercialEur).toBe(51.35)
    expect(TEST_INCOME_RATES.nbuEur).toBe(51.0595)
    expect(TEST_INCOME_RATES.commercialEur).not.toBe(TEST_INCOME_RATES.nbuEur)
    expect(TEST_INCOME_RATES.nbuPln).toBe(11.7512)
  })
})
