import { MantineProvider } from '@mantine/core'
import { render, screen, within, cleanup } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { normalizeNativeReportPreview } from '../data/nativeReportPreview'
import { ReportInlinePreview } from './ReportInlinePreview'

// Column schemas/measure identities and captions copied from retained actual producer wires.
// Hash/path provenance is p10-render-wire-provenance.json. Only captions and NULL/66 cells are synthetic;
// these cases exercise presentation, not an accounting oracle or a claim of a newly generated live report.
afterEach(cleanup)
const wireMetadata = {
  "NativeSalesNet": {
    "ColumnSchema": [
      {
        "Position": 0,
        "Identity": "$measureGroup",
        "Caption": "Група показників",
        "DisplayKind": "Text",
        "KeyKind": "Text",
        "Captioned": false,
        "AgreementRole": "none"
      },
      {
        "Position": 1,
        "Identity": "$measure",
        "Caption": "Показник",
        "DisplayKind": "Text",
        "KeyKind": "Text",
        "Captioned": false,
        "AgreementRole": "none"
      }
    ],
    "Columns": [
      {
        "Values": [
          {
            "Identity": {
              "Kind": "text",
              "Value": "Вартість продажу, EUR",
              "Provenance": "columnAxisKey"
            },
            "Caption": "Вартість продажу, EUR"
          },
          {
            "Identity": {
              "Kind": "reportField",
              "Value": "SalesValueWithoutVAT",
              "Provenance": "columnAxisKey"
            },
            "Caption": "Продажі без ПДВ з урахуванням повернень"
          }
        ]
      },
      {
        "Values": [
          {
            "Identity": {
              "Kind": "text",
              "Value": "Вартість продажу, EUR",
              "Provenance": "columnAxisKey"
            },
            "Caption": "Вартість продажу, EUR"
          },
          {
            "Identity": {
              "Kind": "reportField",
              "Value": "SalesValueVAT",
              "Provenance": "columnAxisKey"
            },
            "Caption": "ПДВ продажів і повернень"
          }
        ]
      },
      {
        "Values": [
          {
            "Identity": {
              "Kind": "text",
              "Value": "Вартість продажу, EUR",
              "Provenance": "columnAxisKey"
            },
            "Caption": "Вартість продажу, EUR"
          },
          {
            "Identity": {
              "Kind": "reportField",
              "Value": "SalesValueWithVAT",
              "Provenance": "columnAxisKey"
            },
            "Caption": "Продажі з ПДВ з урахуванням повернень"
          }
        ]
      },
      {
        "Values": [
          {
            "Identity": {
              "Kind": "text",
              "Value": "Собівартість, EUR",
              "Provenance": "columnAxisKey"
            },
            "Caption": "Собівартість, EUR"
          },
          {
            "Identity": {
              "Kind": "reportField",
              "Value": "CostWithoutVAT",
              "Provenance": "columnAxisKey"
            },
            "Caption": "Собівартість без ПДВ"
          }
        ]
      }
    ],
    "ProductSchema": {
      "Position": 2,
      "Identity": "Product",
      "Caption": "Товар",
      "DisplayKind": "Text",
      "KeyKind": "Numeric",
      "Captioned": true,
      "AgreementRole": "none"
    },
    "RawSchema": {
      "Position": 0,
      "Identity": "ProductDescription",
      "Caption": "Поточний опис товару",
      "DisplayKind": "Text",
      "KeyKind": "Text",
      "Captioned": false,
      "AgreementRole": "none"
    }
  },
  "NativePurchases": {
    "ColumnSchema": [
      {
        "Position": 0,
        "Identity": "$measureGroup",
        "Caption": "Група показників",
        "DisplayKind": "Text",
        "KeyKind": "Text",
        "Captioned": false,
        "AgreementRole": "none"
      },
      {
        "Position": 1,
        "Identity": "$measure",
        "Caption": "Показник",
        "DisplayKind": "Text",
        "KeyKind": "Text",
        "Captioned": false,
        "AgreementRole": "none"
      }
    ],
    "Columns": [
      {
        "Values": [
          {
            "Identity": {
              "Kind": "text",
              "Value": "Кількість надходження",
              "Provenance": "columnAxisKey"
            },
            "Caption": "Кількість надходження"
          },
          {
            "Identity": {
              "Kind": "reportField",
              "Value": "SalesQuantity",
              "Provenance": "columnAxisKey"
            },
            "Caption": "Кількість надходження"
          }
        ]
      },
      {
        "Values": [
          {
            "Identity": {
              "Kind": "text",
              "Value": "Вартість надходження без ПДВ, EUR",
              "Provenance": "columnAxisKey"
            },
            "Caption": "Вартість надходження без ПДВ, EUR"
          },
          {
            "Identity": {
              "Kind": "reportField",
              "Value": "SalesValueWithoutVAT",
              "Provenance": "columnAxisKey"
            },
            "Caption": "Вартість надходження без ПДВ, EUR"
          }
        ]
      },
      {
        "Values": [
          {
            "Identity": {
              "Kind": "text",
              "Value": "ПДВ надходження, EUR",
              "Provenance": "columnAxisKey"
            },
            "Caption": "ПДВ надходження, EUR"
          },
          {
            "Identity": {
              "Kind": "reportField",
              "Value": "SalesValueVAT",
              "Provenance": "columnAxisKey"
            },
            "Caption": "ПДВ надходження, EUR"
          }
        ]
      },
      {
        "Values": [
          {
            "Identity": {
              "Kind": "text",
              "Value": "Вага (нетто), кг",
              "Provenance": "columnAxisKey"
            },
            "Caption": "Вага (нетто), кг"
          },
          {
            "Identity": {
              "Kind": "reportField",
              "Value": "PurchaseNetWeight",
              "Provenance": "columnAxisKey"
            },
            "Caption": "Вага (нетто), кг"
          }
        ]
      }
    ],
    "ProductSchema": {
      "Position": 2,
      "Identity": "Product",
      "Caption": "Товар",
      "DisplayKind": "Text",
      "KeyKind": "Numeric",
      "Captioned": true,
      "AgreementRole": "none"
    },
    "RawSchema": {
      "Position": 0,
      "Identity": "ProductDescription",
      "Caption": "Опис товару",
      "DisplayKind": "Text",
      "KeyKind": "Text",
      "Captioned": false,
      "AgreementRole": "none"
    }
  },
  "NativeCustomerGroupComparison": {
    "ColumnSchema": [
      {
        "Position": 0,
        "Identity": "CustomerComparisonSource",
        "Caption": "Джерело даних",
        "DisplayKind": "Text",
        "KeyKind": "Text",
        "Captioned": false,
        "AgreementRole": "none"
      },
      {
        "Position": 1,
        "Identity": "$measureGroup",
        "Caption": "Група показників",
        "DisplayKind": "Text",
        "KeyKind": "Text",
        "Captioned": false,
        "AgreementRole": "none"
      },
      {
        "Position": 2,
        "Identity": "$measure",
        "Caption": "Показник",
        "DisplayKind": "Text",
        "KeyKind": "Text",
        "Captioned": false,
        "AgreementRole": "none"
      }
    ],
    "Columns": [
      {
        "Values": [
          {
            "Identity": {
              "Kind": "text",
              "Value": "Еталон",
              "Provenance": "columnAxisKey"
            },
            "Caption": "Еталон"
          },
          {
            "Identity": {
              "Kind": "text",
              "Value": "Інше",
              "Provenance": "columnAxisKey"
            },
            "Caption": "Інше"
          },
          {
            "Identity": {
              "Kind": "reportField",
              "Value": "CustomerGroupQuantity",
              "Provenance": "columnAxisKey"
            },
            "Caption": "Кількість"
          }
        ]
      },
      {
        "Values": [
          {
            "Identity": {
              "Kind": "text",
              "Value": "Еталон",
              "Provenance": "columnAxisKey"
            },
            "Caption": "Еталон"
          },
          {
            "Identity": {
              "Kind": "text",
              "Value": "Інше",
              "Provenance": "columnAxisKey"
            },
            "Caption": "Інше"
          },
          {
            "Identity": {
              "Kind": "reportField",
              "Value": "CustomerGroupValue",
              "Provenance": "columnAxisKey"
            },
            "Caption": "Вартість без ПДВ, EUR"
          }
        ]
      },
      {
        "Values": [
          {
            "Identity": {
              "Kind": "text",
              "Value": "Еталон",
              "Provenance": "columnAxisKey"
            },
            "Caption": "Еталон"
          },
          {
            "Identity": {
              "Kind": "text",
              "Value": "Інше",
              "Provenance": "columnAxisKey"
            },
            "Caption": "Інше"
          },
          {
            "Identity": {
              "Kind": "reportField",
              "Value": "CustomerGroupValueDelta",
              "Provenance": "columnAxisKey"
            },
            "Caption": "Відхилення вартості, EUR"
          }
        ]
      },
      {
        "Values": [
          {
            "Identity": {
              "Kind": "text",
              "Value": "Еталон",
              "Provenance": "columnAxisKey"
            },
            "Caption": "Еталон"
          },
          {
            "Identity": {
              "Kind": "text",
              "Value": "Інше",
              "Provenance": "columnAxisKey"
            },
            "Caption": "Інше"
          },
          {
            "Identity": {
              "Kind": "reportField",
              "Value": "CustomerGroupValueDeltaPercent",
              "Provenance": "columnAxisKey"
            },
            "Caption": "Відхилення вартості, %"
          }
        ]
      }
    ],
    "ProductSchema": {
      "Position": 0,
      "Identity": "Product",
      "Caption": "Товар",
      "DisplayKind": "Text",
      "KeyKind": "Numeric",
      "Captioned": true,
      "AgreementRole": "none"
    },
    "RawSchema": {
      "Position": 1,
      "Identity": "ProductTop",
      "Caption": "Поточний TOP товару",
      "DisplayKind": "Text",
      "KeyKind": "Text",
      "Captioned": false,
      "AgreementRole": "none"
    }
  },
  "NativeStockPeriod": {
    "ColumnSchema": [
      {
        "Position": 0,
        "Identity": "$measureGroup",
        "Caption": "Група показників",
        "DisplayKind": "Text",
        "KeyKind": "Text",
        "Captioned": false,
        "AgreementRole": "none"
      },
      {
        "Position": 1,
        "Identity": "$measure",
        "Caption": "Показник",
        "DisplayKind": "Text",
        "KeyKind": "Text",
        "Captioned": false,
        "AgreementRole": "none"
      }
    ],
    "Columns": [
      {
        "Values": [
          {
            "Identity": {
              "Kind": "text",
              "Value": "Початковий залишок: кількість",
              "Provenance": "columnAxisKey"
            },
            "Caption": "Початковий залишок: кількість"
          },
          {
            "Identity": {
              "Kind": "reportField",
              "Value": "StockPeriodOpeningQuantity",
              "Provenance": "columnAxisKey"
            },
            "Caption": "Початковий залишок: кількість"
          }
        ]
      },
      {
        "Values": [
          {
            "Identity": {
              "Kind": "text",
              "Value": "Прихід: собівартість з витратами без ПДВ, EUR",
              "Provenance": "columnAxisKey"
            },
            "Caption": "Прихід: собівартість з витратами без ПДВ, EUR"
          },
          {
            "Identity": {
              "Kind": "reportField",
              "Value": "StockPeriodIncomingValue",
              "Provenance": "columnAxisKey"
            },
            "Caption": "Прихід: собівартість з витратами без ПДВ, EUR"
          }
        ]
      },
      {
        "Values": [
          {
            "Identity": {
              "Kind": "text",
              "Value": "Кінцевий залишок: собівартість з витратами без ПДВ, EUR",
              "Provenance": "columnAxisKey"
            },
            "Caption": "Кінцевий залишок: собівартість з витратами без ПДВ, EUR"
          },
          {
            "Identity": {
              "Kind": "reportField",
              "Value": "StockPeriodClosingValue",
              "Provenance": "columnAxisKey"
            },
            "Caption": "Кінцевий залишок: собівартість з витратами без ПДВ, EUR"
          }
        ]
      },
      {
        "Values": [
          {
            "Identity": {
              "Kind": "text",
              "Value": "Кінцевий залишок: ПДВ, EUR",
              "Provenance": "columnAxisKey"
            },
            "Caption": "Кінцевий залишок: ПДВ, EUR"
          },
          {
            "Identity": {
              "Kind": "reportField",
              "Value": "StockPeriodClosingVat",
              "Provenance": "columnAxisKey"
            },
            "Caption": "Кінцевий залишок: ПДВ, EUR"
          }
        ]
      }
    ],
    "ProductSchema": {
      "Position": 2,
      "Identity": "Product",
      "Caption": "Товар",
      "DisplayKind": "Text",
      "KeyKind": "Numeric",
      "Captioned": true,
      "AgreementRole": "none"
    },
    "RawSchema": {
      "Position": 0,
      "Identity": "ProductSize",
      "Caption": "Номенклатура.Розмір",
      "DisplayKind": "Text",
      "KeyKind": "Text",
      "Captioned": false,
      "AgreementRole": "none"
    }
  },
  "NativePriceComparison": {
    "ColumnSchema": [
      {
        "Position": 0,
        "Identity": "$measureGroup",
        "Caption": "Група показників",
        "DisplayKind": "Text",
        "KeyKind": "Text",
        "Captioned": false,
        "AgreementRole": "none"
      },
      {
        "Position": 1,
        "Identity": "$measure",
        "Caption": "Показник",
        "DisplayKind": "Text",
        "KeyKind": "Text",
        "Captioned": false,
        "AgreementRole": "none"
      }
    ],
    "Columns": [
      {
        "Values": [
          {
            "Identity": {
              "Kind": "text",
              "Value": "Кількість продажу",
              "Provenance": "columnAxisKey"
            },
            "Caption": "Кількість продажу"
          },
          {
            "Identity": {
              "Kind": "reportField",
              "Value": "SalesQuantity",
              "Provenance": "columnAxisKey"
            },
            "Caption": "Кількість продажів мінус повернення (GBA)"
          }
        ]
      },
      {
        "Values": [
          {
            "Identity": {
              "Kind": "text",
              "Value": "Інше",
              "Provenance": "columnAxisKey"
            },
            "Caption": "Інше"
          },
          {
            "Identity": {
              "Kind": "reportField",
              "Value": "OneCSalesValueBeforeDiscount",
              "Provenance": "columnAxisKey"
            },
            "Caption": "Продажі до знижки без ПДВ, EUR"
          }
        ]
      },
      {
        "Values": [
          {
            "Identity": {
              "Kind": "text",
              "Value": "Інше",
              "Provenance": "columnAxisKey"
            },
            "Caption": "Інше"
          },
          {
            "Identity": {
              "Kind": "reportField",
              "Value": "OneCPriceTypeValue",
              "Provenance": "columnAxisKey"
            },
            "Caption": "Сума за глобальним типом цін, EUR"
          }
        ]
      },
      {
        "Values": [
          {
            "Identity": {
              "Kind": "text",
              "Value": "Інше",
              "Provenance": "columnAxisKey"
            },
            "Caption": "Інше"
          },
          {
            "Identity": {
              "Kind": "reportField",
              "Value": "OneCPriceTypeDifference",
              "Provenance": "columnAxisKey"
            },
            "Caption": "Різниця із сумою за типом цін, EUR"
          }
        ]
      }
    ],
    "ProductSchema": {
      "Position": 2,
      "Identity": "Product",
      "Caption": "Товар",
      "DisplayKind": "Text",
      "KeyKind": "Numeric",
      "Captioned": true,
      "AgreementRole": "none"
    },
    "RawSchema": {
      "Position": 0,
      "Identity": "ProductDescription",
      "Caption": "Поточний опис товару",
      "DisplayKind": "Text",
      "KeyKind": "Text",
      "Captioned": false,
      "AgreementRole": "none"
    }
  }
}
const scalar = (value: string | null, provenance = 'producerCell') => ({
  Kind: value === null ? 'null' : 'decimal', Value: value, Provenance: provenance,
})
const axisValue = (caption: string, identity: string = caption, kind = 'text') => ({
  Caption: caption, Identity: { Kind: kind, Value: identity, Provenance: 'rowAxisKey' },
})
function fixture(source: keyof typeof wireMetadata, identity: string, caption: string) {
  const metadata = wireMetadata[source]
  const columns = metadata.Columns.map((column, index) => ({ ...column, Ordinal: index, SourceIndex: index }))
  const raw = { ...metadata.RawSchema, Position: 0, Identity: identity, Caption: identity }
  const product = { ...metadata.ProductSchema, Position: 1 }
  const cells = (row: number, provenance: string) => columns.map((_, column) => ({
    RowSourceIndex: row, ColumnSourceIndex: column, Value: scalar(column === 1 ? '66.00' : null, provenance),
  }))
  return {
    Version: 1, ResultSha256: 'b'.repeat(64), PresentationOnly: true,
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: 1, ReturnedRows: 1, HasMore: false },
    Request: { DataSource: source, IsCurrentSnapshot: false, HasPeriod: true,
      PeriodFrom: '20.10.2026', PeriodTo: '20.10.2026', RowGroupings: [raw.Caption, product.Caption],
      ColumnGroupings: source === 'NativeCustomerGroupComparison' ? ['Джерело даних'] : [],
      Measures: columns.map(column => column.Values.at(-1)!.Caption), Filters: [], IgnoredFilters: [], Notes: [] },
    RowSchema: [raw, product], ColumnSchema: metadata.ColumnSchema,
    Rows: [{ Ordinal: 0, SourceIndex: 0, Values: [axisValue(caption), axisValue('Товар [38242326]', '38242326', 'signedInteger')] }],
    Columns: columns, Cells: cells(0, 'producerCell'),
    Totals: { State: 'materialized', Values: cells(-1, 'presentationTotal'),
      Groups: [{ Level: 0, RowSourceIndex: 0, RowCount: 1, Values: cells(0, 'presentationTotal') }] },
  }
}
function show(wire: ReturnType<typeof fixture>) {
  return render(<MantineProvider env="test"><ReportInlinePreview preview={normalizeNativeReportPreview({ Preview: wire })} /></MantineProvider>)
}
const sourceRows: Array<[keyof typeof wireMetadata, string, string]> = [
  ['NativeSalesNet', 'ProductDescription', 'Опис [123]'],
  ['NativePurchases', 'ProductDescription', 'Опис [123], серія [id=7]'],
  ['NativeCustomerGroupComparison', 'ProductTop', 'TOP [456]'],
  ['NativeStockPeriod', 'ProductSize', 'XL [-2]'],
  ['NativePriceComparison', 'ProductDescription', 'Опис [123]'],
  ['NativePriceComparison', 'Organization', 'Організація [123]'],
]
it.each(sourceRows)('preserves raw %s/%s leaf, the one nonleaf subtotal and unrelated cells through the normalizer', (source, identity, caption) => {
  const wire = fixture(source, identity, caption)
  const view = show(wire)
  expect(screen.getByRole('rowheader', { name: caption })).toBeTruthy()
  expect(screen.getByRole('rowheader', { name: 'Підсумок: ' + caption })).toBeTruthy()
  expect(screen.getByRole('rowheader', { name: source === 'NativePurchases' || source === 'NativeStockPeriod' ? 'Товар [38242326]' : 'Товар' })).toBeTruthy()
  for (const row of view.container.querySelectorAll('tbody tr, tfoot tr'))
    expect(within(row as HTMLElement).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['∅', '66,00', '∅', '∅'])
})
it('retains an exact profile identity caption even when the generic dataset can group that field as text', () => {
  const wire = fixture('NativeSalesNet', 'Organization', 'Організація [123]')
  wire.RowSchema[0] = { ...wire.RowSchema[0], DisplayKind: 'Text', KeyKind: 'Numeric', Captioned: true }
  wire.Rows[0].Values[0] = axisValue('Організація [123]', '123', 'signedInteger')
  show(wire)
  expect(screen.getByRole('rowheader', { name: 'Організація' })).toBeTruthy()
  expect(screen.getByRole('rowheader', { name: 'Підсумок: Організація' })).toBeTruthy()
  expect(screen.queryByRole('rowheader', { name: 'Організація [123]' })).toBeNull()
})

it.each([
  ['NativePurchases', 'Organization'], ['NativeStockPeriod', 'StockWarehouse'],
] as const)('retains globally supplied %s/%s leaf and subtotal captions on each one-row page', (source, identity) => {
  for (const id of ['101', '102']) {
    const caption = 'Однакова назва [' + id + ']'
    const wire = fixture(source, identity, caption)
    wire.Page = { ...wire.Page, Offset: Number(id) - 101, Limit: 1, TotalVisibleRows: 2, HasMore: id === '101' }
    wire.Rows[0].Ordinal = wire.Page.Offset
    wire.RowSchema[0] = { ...wire.RowSchema[0], Captioned: true, KeyKind: 'Numeric', DisplayKind: 'Text' }
    wire.Rows[0].Values[0] = axisValue(caption, id, 'signedInteger')
    const view = show(wire)
    expect(screen.getByRole('rowheader', { name: caption })).toBeTruthy()
    expect(screen.getByRole('rowheader', { name: 'Підсумок: ' + caption })).toBeTruthy()
    for (const row of view.container.querySelectorAll('tbody tr, tfoot tr'))
      expect(within(row as HTMLElement).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['∅', '66,00', '∅', '∅'])
    view.unmount()
  }
})
