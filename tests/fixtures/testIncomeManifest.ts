export type TestIncomeParseConfiguration = {
  startRow: number
  endRow: number
  vendorCode: number
  specificationCode: number
  price: number
  qty: number
  customsValue: number
  duty: number
  vatValue: number
}

export type TestIncomeSupplierFixture = {
  supplier: string
  directory: string
  declarationNumber: string
  sourceCurrency: 'EUR' | 'USD'
  deliveryRow: number
  expectedExternalFormulaCells: number
  expectedRowDigest: string
  parseConfiguration: TestIncomeParseConfiguration
  expected: {
    rows: number
    qty: number
    sourceInvoiceTotal: number
    deliveryInvoiceTotalEur: number
    customsValue: number
    duty: number
    vatValue: number
  }
}

export const TEST_INCOME_CUSTOMS_DATE = '2026-07-20'

export const TEST_INCOME_RATES = {
  commercialEur: 51.35,
  nbuEur: 51.0595,
  nbuUsd: 44.6676,
  nbuPln: 11.7512,
} as const

export const TEST_INCOME_SUPPLIERS: readonly TestIncomeSupplierFixture[] = [
  {
    supplier: 'AYMEKS',
    directory: 'AYMEKS AYM2026000000665 03.07.2026',
    declarationNumber: '26UA400040014346U4',
    sourceCurrency: 'EUR',
    deliveryRow: 5,
    expectedExternalFormulaCells: 0,
    expectedRowDigest: '5952c67b5bb3fa1cdf8eafe4e3091868397a05d9618fa608f528aa54f17f54ff',
    parseConfiguration: {
      vendorCode: 2,
      customsValue: 9,
      specificationCode: 1,
      duty: 10,
      price: 6,
      qty: 7,
      vatValue: 11,
      startRow: 5,
      endRow: 37,
    },
    expected: {
      rows: 33,
      qty: 923,
      sourceInvoiceTotal: 5248.5,
      deliveryInvoiceTotalEur: 5248.5,
      customsValue: 283546.99,
      duty: 15947.77,
      vatValue: 59898.95,
    },
  },
  {
    supplier: 'FSS',
    directory: 'FSS FS32026000000137 03.07.2026',
    declarationNumber: '26UA400040014350U4',
    sourceCurrency: 'USD',
    deliveryRow: 6,
    expectedExternalFormulaCells: 0,
    expectedRowDigest: '258fe61b2d77138afd4b023b043556f402b6f40ce7fec29b1b46b54d38a3fe2b',
    parseConfiguration: {
      vendorCode: 3,
      customsValue: 11,
      specificationCode: 1,
      duty: 12,
      price: 7,
      qty: 8,
      vatValue: 13,
      startRow: 5,
      endRow: 110,
    },
    expected: {
      rows: 106,
      qty: 589,
      sourceInvoiceTotal: 17645.2,
      deliveryInvoiceTotalEur: 15436.26,
      customsValue: 792529.09,
      duty: 28016.37,
      vatValue: 164109.1,
    },
  },
  {
    supplier: 'HP',
    directory: 'HP HP32026000000026 10.07.2026',
    declarationNumber: '26UA400040014352U2',
    sourceCurrency: 'USD',
    deliveryRow: 7,
    expectedExternalFormulaCells: 0,
    expectedRowDigest: '8e367d8de79763b263b9e0bfef31d73ea1c462675030a142470b18d29a032788',
    parseConfiguration: {
      vendorCode: 3,
      customsValue: 11,
      specificationCode: 1,
      duty: 12,
      price: 7,
      qty: 8,
      vatValue: 13,
      startRow: 5,
      endRow: 35,
    },
    expected: {
      rows: 31,
      qty: 4035,
      sourceInvoiceTotal: 16965.5,
      deliveryInvoiceTotalEur: 14841.69,
      customsValue: 776252.22,
      duty: 10089.9,
      vatValue: 157268.42,
    },
  },
  {
    supplier: 'MAYER',
    directory: 'MAYER MYR2026000000008 08.07.2026',
    declarationNumber: '26UA400040014349U1',
    sourceCurrency: 'EUR',
    deliveryRow: 8,
    expectedExternalFormulaCells: 23,
    expectedRowDigest: 'db7b82c86167dc45f78c500eeb38272aca3951651a4b33c294264733adcb7514',
    parseConfiguration: {
      vendorCode: 3,
      customsValue: 10,
      specificationCode: 1,
      duty: 11,
      price: 7,
      qty: 8,
      vatValue: 12,
      startRow: 5,
      endRow: 47,
    },
    expected: {
      rows: 43,
      qty: 549,
      sourceInvoiceTotal: 8687.3,
      deliveryInvoiceTotalEur: 8687.3,
      customsValue: 455073.2,
      duty: 38975.63,
      vatValue: 98809.76,
    },
  },
  {
    supplier: 'NOIR',
    directory: 'NOIR IHR20260000000034 08.07.2026',
    declarationNumber: '26UA400040014348U2',
    sourceCurrency: 'EUR',
    deliveryRow: 11,
    expectedExternalFormulaCells: 0,
    expectedRowDigest: '2cb281e1607c5d4b4d013f44ed8bcad37f28aa2e1f6bf40d7cc5ec643090d73f',
    parseConfiguration: {
      vendorCode: 3,
      customsValue: 10,
      specificationCode: 1,
      duty: 11,
      price: 7,
      qty: 8,
      vatValue: 12,
      startRow: 5,
      endRow: 80,
    },
    expected: {
      rows: 76,
      qty: 10170,
      sourceInvoiceTotal: 12201.9,
      deliveryInvoiceTotalEur: 12201.9,
      customsValue: 643216.03,
      duty: 33128.9,
      vatValue: 135268.98,
    },
  },
  {
    supplier: 'OSMANLI',
    directory: 'OSMANLI (TRUCKEXPERT) OSD2026000000030 19.06.2026',
    declarationNumber: '26UA400040014347U3',
    sourceCurrency: 'EUR',
    deliveryRow: 9,
    expectedExternalFormulaCells: 0,
    expectedRowDigest: '6a7b977c8a56926be4352f3f3c4e35c4896ec5c1e9ef49541738d2f781ee5a70',
    parseConfiguration: {
      vendorCode: 3,
      customsValue: 10,
      specificationCode: 1,
      duty: 11,
      price: 7,
      qty: 8,
      vatValue: 12,
      startRow: 5,
      endRow: 100,
    },
    expected: {
      rows: 96,
      qty: 2900,
      sourceInvoiceTotal: 11289.7,
      deliveryInvoiceTotalEur: 11289.7,
      customsValue: 588037.52,
      duty: 55435.12,
      vatValue: 128694.54,
    },
  },
  {
    supplier: 'REMI MAY',
    directory: 'REMI MAY RE02026000000150 09.07.2026',
    declarationNumber: '26UA400040014351U3',
    sourceCurrency: 'EUR',
    deliveryRow: 10,
    expectedExternalFormulaCells: 0,
    expectedRowDigest: '15baee42b89c4ed721bb5ab08b8ad937a172340f1a12abca18ae8a0cdf7913a0',
    parseConfiguration: {
      vendorCode: 3,
      customsValue: 10,
      specificationCode: 1,
      duty: 11,
      price: 7,
      qty: 8,
      vatValue: 12,
      startRow: 5,
      endRow: 126,
    },
    expected: {
      rows: 122,
      qty: 2216,
      sourceInvoiceTotal: 21043,
      deliveryInvoiceTotalEur: 21043,
      customsValue: 1080273.58,
      duty: 71567.38,
      vatValue: 230368.18,
    },
  },
] as const
