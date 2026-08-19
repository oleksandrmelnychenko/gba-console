export interface TestIncomeParseConfig {
  productCode: number;
  customsValue: number;
  uktzed: number;
  duty: number;
  price: number;
  qty: number;
  vat: number;
  startRow: number;
  endRow: number;
  netWeight: number;
  grossWeight: number;
}

export interface TestIncomeSupplier {
  key: string;
  dirPrefix: string;
  invoiceNumber: string;
  invoiceDate: string;
  md: string;
  parse: TestIncomeParseConfig;
  rows: number;
  qty: number;
  invoiceCurrency: 'EUR' | 'USD';
  invoiceAmount: number;
  invoiceAmountEur: number;
  customsValue: number;
  duty: number;
  vat: number;
}

export const CUSTOMS_DATE = '2026-07-20';
// Official NBU EUR/UAH rate for the customs declaration date (20.07.2026).
// The following day's 51.0955 must never leak into this date-only workflow.
export const NBU_EUR_RATE = 51.0595;
export const COMMERCIAL_EUR_RATE = 51.35;
export const NBU_USD_RATE = 44.6676;

export const TEST_INCOME_TOTALS = {
  rows: 507,
  qty: 21382,
  invoiceEur: 88748.35,
  customsValue: 4618928.63,
  duty: 253161.07,
  vat: 974417.93,
} as const;

export const TEST_INCOME_SUPPLIERS: TestIncomeSupplier[] = [
  {
    key: 'AYMEKS',
    dirPrefix: 'AYMEKS',
    invoiceNumber: 'AYM2026000000665',
    invoiceDate: '2026-07-03',
    md: '26UA400040014346U4',
    parse: { productCode: 2, customsValue: 9, uktzed: 1, duty: 10, price: 6, qty: 7, vat: 11, startRow: 5, endRow: 37, netWeight: 5, grossWeight: 4 },
    rows: 33,
    qty: 923,
    invoiceCurrency: 'EUR',
    invoiceAmount: 5248.5,
    invoiceAmountEur: 5248.5,
    customsValue: 283546.99,
    duty: 15947.77,
    vat: 59898.95,
  },
  {
    key: 'FSS',
    dirPrefix: 'FSS',
    invoiceNumber: 'FS32026000000137',
    invoiceDate: '2026-07-03',
    md: '26UA400040014350U4',
    parse: { productCode: 3, customsValue: 11, uktzed: 1, duty: 12, price: 7, qty: 8, vat: 13, startRow: 5, endRow: 110, netWeight: 4, grossWeight: 5 },
    rows: 106,
    qty: 589,
    invoiceCurrency: 'USD',
    invoiceAmount: 17645.2,
    invoiceAmountEur: 15436.26,
    customsValue: 792529.09,
    duty: 28016.37,
    vat: 164109.1,
  },
  {
    key: 'HP',
    dirPrefix: 'HP',
    invoiceNumber: 'HP32026000000026',
    invoiceDate: '2026-07-10',
    md: '26UA400040014352U2',
    parse: { productCode: 3, customsValue: 11, uktzed: 1, duty: 12, price: 7, qty: 8, vat: 13, startRow: 5, endRow: 35, netWeight: 4, grossWeight: 5 },
    rows: 31,
    qty: 4035,
    invoiceCurrency: 'USD',
    invoiceAmount: 16965.5,
    invoiceAmountEur: 14841.69,
    customsValue: 776252.22,
    duty: 10089.9,
    vat: 157268.42,
  },
  {
    key: 'MAYER',
    dirPrefix: 'MAYER',
    invoiceNumber: 'MYR2026000000008',
    invoiceDate: '2026-07-08',
    md: '26UA400040014349U1',
    parse: { productCode: 3, customsValue: 10, uktzed: 1, duty: 11, price: 7, qty: 8, vat: 12, startRow: 5, endRow: 47, netWeight: 4, grossWeight: 5 },
    rows: 43,
    qty: 549,
    invoiceCurrency: 'EUR',
    invoiceAmount: 8687.3,
    invoiceAmountEur: 8687.3,
    customsValue: 455073.2,
    duty: 38975.63,
    vat: 98809.76,
  },
  {
    key: 'NOIR',
    dirPrefix: 'NOIR',
    invoiceNumber: 'IHR20260000000034',
    invoiceDate: '2026-07-08',
    md: '26UA400040014348U2',
    parse: { productCode: 3, customsValue: 10, uktzed: 1, duty: 11, price: 7, qty: 8, vat: 12, startRow: 5, endRow: 80, netWeight: 4, grossWeight: 5 },
    rows: 76,
    qty: 10170,
    invoiceCurrency: 'EUR',
    invoiceAmount: 12201.9,
    invoiceAmountEur: 12201.9,
    customsValue: 643216.03,
    duty: 33128.9,
    vat: 135268.98,
  },
  {
    key: 'OSMANLI',
    dirPrefix: 'OSMANLI',
    invoiceNumber: 'OSD2026000000030',
    invoiceDate: '2026-06-19',
    md: '26UA400040014347U3',
    parse: { productCode: 3, customsValue: 10, uktzed: 1, duty: 11, price: 7, qty: 8, vat: 12, startRow: 5, endRow: 100, netWeight: 4, grossWeight: 5 },
    rows: 96,
    qty: 2900,
    invoiceCurrency: 'EUR',
    invoiceAmount: 11289.7,
    invoiceAmountEur: 11289.7,
    customsValue: 588037.52,
    duty: 55435.12,
    vat: 128694.54,
  },
  {
    key: 'REMI MAY',
    dirPrefix: 'REMI MAY',
    invoiceNumber: 'RE02026000000150',
    invoiceDate: '2026-07-09',
    md: '26UA400040014351U3',
    parse: { productCode: 3, customsValue: 10, uktzed: 1, duty: 11, price: 7, qty: 8, vat: 12, startRow: 5, endRow: 126, netWeight: 4, grossWeight: 5 },
    rows: 122,
    qty: 2216,
    invoiceCurrency: 'EUR',
    invoiceAmount: 21043,
    invoiceAmountEur: 21043,
    customsValue: 1080273.58,
    duty: 71567.38,
    vat: 230368.18,
  },
];

export const SMOKE_SUPPLIER = TEST_INCOME_SUPPLIERS[0];
