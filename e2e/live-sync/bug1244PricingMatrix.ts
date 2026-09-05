export type AymeksPricingRow = {
  vendorCode: string;
  qty: number;
  unitPriceEur: number;
};

export type SampiyonPricingRow = {
  vendorCode: string;
  qty: number;
  unitPriceUsd: number;
  unitPriceEur: number;
  sourceRows: number;
};

/**
 * BUG-1244 source-of-truth transcribed from the two Excel files attached to the
 * Desk task. Keeping the complete matrices here makes the audit independent of
 * mutable product IDs and catches a missing, duplicated, or repriced line.
 */
export const AYMEKS_ROWS: readonly AymeksPricingRow[] = [
  { vendorCode: '11484CNT', qty: 60, unitPriceEur: 6.5 },
  { vendorCode: '11515CNT', qty: 60, unitPriceEur: 6 },
  { vendorCode: '37532CNT', qty: 10, unitPriceEur: 7.5 },
  { vendorCode: '14731CNT', qty: 10, unitPriceEur: 3.25 },
  { vendorCode: '11516CNT', qty: 80, unitPriceEur: 10.5 },
  { vendorCode: '11517CNT', qty: 30, unitPriceEur: 9.5 },
  { vendorCode: '11518CNT', qty: 10, unitPriceEur: 5.5 },
  { vendorCode: '14744CNT', qty: 8, unitPriceEur: 25 },
  { vendorCode: '13564CNT', qty: 10, unitPriceEur: 7 },
  { vendorCode: '37139CNT', qty: 10, unitPriceEur: 5.25 },
  { vendorCode: '38774CNT', qty: 10, unitPriceEur: 4.25 },
  { vendorCode: '38776CNT', qty: 20, unitPriceEur: 4.5 },
  { vendorCode: '37538CNT', qty: 30, unitPriceEur: 0.75 },
  { vendorCode: '11519CNT', qty: 40, unitPriceEur: 8.5 },
  { vendorCode: '11785CNT', qty: 10, unitPriceEur: 20 },
  { vendorCode: '37534CNT', qty: 20, unitPriceEur: 24.5 },
  { vendorCode: '12853CNT', qty: 10, unitPriceEur: 35 },
  { vendorCode: '11787CNT', qty: 80, unitPriceEur: 6.75 },
  { vendorCode: '12855CNT', qty: 4, unitPriceEur: 11 },
  { vendorCode: '91053-1CNT', qty: 60, unitPriceEur: 5 },
  { vendorCode: '37535CNT', qty: 40, unitPriceEur: 4 },
  { vendorCode: '10806CNT', qty: 2, unitPriceEur: 5.75 },
  { vendorCode: '92191CNT', qty: 50, unitPriceEur: 0.45 },
  { vendorCode: '90302CNT', qty: 20, unitPriceEur: 0.55 },
  { vendorCode: '37539CNT', qty: 150, unitPriceEur: 0.4 },
  { vendorCode: '12987CNT', qty: 1000, unitPriceEur: 0.8 },
  { vendorCode: '12856CNT', qty: 150, unitPriceEur: 0.85 },
  { vendorCode: '12858CNT', qty: 20, unitPriceEur: 3.75 },
  { vendorCode: '12857CNT', qty: 15, unitPriceEur: 3 },
  { vendorCode: '100906CNT', qty: 15, unitPriceEur: 6 },
  { vendorCode: '40248CNT', qty: 10, unitPriceEur: 5.5 },
  { vendorCode: '92385CNT', qty: 10, unitPriceEur: 6 },
  { vendorCode: '92366CNT', qty: 10, unitPriceEur: 10 },
  { vendorCode: '92343CNT', qty: 10, unitPriceEur: 7.5 },
  { vendorCode: '19245CNT', qty: 8, unitPriceEur: 20 },
] as const;

export const SAMPIYON_ROWS: readonly SampiyonPricingRow[] = [
  { vendorCode: 'CR0189KIT-SF', qty: 10, unitPriceUsd: 22.76, unitPriceEur: 19.519, sourceRows: 1 },
  { vendorCode: 'CH1173-SF', qty: 10, unitPriceUsd: 6.79, unitPriceEur: 5.823, sourceRows: 1 },
  { vendorCode: 'CH1190-SF', qty: 8, unitPriceUsd: 18.94, unitPriceEur: 16.2425, sourceRows: 1 },
  { vendorCode: 'CR0018-SF', qty: 30, unitPriceUsd: 14.52, unitPriceEur: 12.4523, sourceRows: 1 },
  { vendorCode: 'CR0067-SF', qty: 40, unitPriceUsd: 16.11, unitPriceEur: 13.8158, sourceRows: 1 },
  { vendorCode: 'CH1228-SF', qty: 16, unitPriceUsd: 9.6, unitPriceEur: 8.2331, sourceRows: 2 },
  { vendorCode: 'CH1495-SF', qty: 4, unitPriceUsd: 13.25, unitPriceEur: 11.3625, sourceRows: 1 },
  { vendorCode: 'CR0059-SF', qty: 30, unitPriceUsd: 18.94, unitPriceEur: 16.2427, sourceRows: 2 },
  { vendorCode: 'CR0069-SF', qty: 20, unitPriceUsd: 18.27, unitPriceEur: 15.668, sourceRows: 1 },
  { vendorCode: 'CR0125L-SF', qty: 25, unitPriceUsd: 19.9, unitPriceEur: 17.066, sourceRows: 1 },
  { vendorCode: 'CR0221FR-SF', qty: 4, unitPriceUsd: 19.18, unitPriceEur: 16.4475, sourceRows: 1 },
  { vendorCode: 'CR0237/CR0238-SF', qty: 50, unitPriceUsd: 25.8, unitPriceEur: 22.1258, sourceRows: 1 },
  { vendorCode: 'CH1225-SF', qty: 10, unitPriceUsd: 15.63, unitPriceEur: 13.404, sourceRows: 1 },
  { vendorCode: 'CR0065-SF', qty: 40, unitPriceUsd: 18, unitPriceEur: 15.4365, sourceRows: 1 },
  { vendorCode: 'CR0137-SF', qty: 20, unitPriceUsd: 15.04, unitPriceEur: 12.898, sourceRows: 2 },
  { vendorCode: 'CK0114-SF', qty: 36, unitPriceUsd: 2.1, unitPriceEur: 1.8008, sourceRows: 1 },
  { vendorCode: 'CK0089K-SF', qty: 20, unitPriceUsd: 5.8, unitPriceEur: 4.974, sourceRows: 1 },
  { vendorCode: 'CK0130-SF', qty: 88, unitPriceUsd: 2.05, unitPriceEur: 1.7581, sourceRows: 1 },
  { vendorCode: 'CS0134MMB-SF', qty: 36, unitPriceUsd: 5.2, unitPriceEur: 4.4594, sourceRows: 1 },
  { vendorCode: 'CS1532M-SF', qty: 24, unitPriceUsd: 4.53, unitPriceEur: 3.885, sourceRows: 1 },
  { vendorCode: 'CS0049M-SF', qty: 12, unitPriceUsd: 4.83, unitPriceEur: 4.1425, sourceRows: 1 },
  { vendorCode: 'CS0066MMB-SF', qty: 24, unitPriceUsd: 3.5, unitPriceEur: 3.0017, sourceRows: 1 },
  { vendorCode: 'CS1672M-SF', qty: 12, unitPriceUsd: 8.03, unitPriceEur: 6.8867, sourceRows: 1 },
  { vendorCode: 'CS1556M-SF', qty: 36, unitPriceUsd: 6.48, unitPriceEur: 5.5572, sourceRows: 1 },
  { vendorCode: 'CS1673MMB-SF', qty: 24, unitPriceUsd: 7.42, unitPriceEur: 6.3633, sourceRows: 1 },
  { vendorCode: 'CS0220MG-SF', qty: 72, unitPriceUsd: 11.41, unitPriceEur: 9.7851, sourceRows: 1 },
  { vendorCode: 'CS1504-SF', qty: 15, unitPriceUsd: 4.45, unitPriceEur: 3.816, sourceRows: 1 },
  { vendorCode: 'CS1557-SF', qty: 24, unitPriceUsd: 4.6, unitPriceEur: 3.945, sourceRows: 1 },
  { vendorCode: 'CS1558-SF', qty: 12, unitPriceUsd: 5.51, unitPriceEur: 4.725, sourceRows: 1 },
  { vendorCode: 'CE1137EX-SF', qty: 20, unitPriceUsd: 2.6, unitPriceEur: 2.2295, sourceRows: 1 },
  { vendorCode: 'CK0126-SF', qty: 10, unitPriceUsd: 2.99, unitPriceEur: 2.564, sourceRows: 1 },
] as const;

export const BUG_1244 = {
  customsDate: '2026-08-26',
  aymeks: {
    customsNumber: '26UA400040016983U6',
    documentNumber: 'К0000000334',
    invoiceNumber: 'AYM2026000000863',
    rows: 35,
    qty: 2082,
    invoiceEur: 6631.5,
    fenixExpenseEur: 1746.88,
    amgDocumentNumber: 'К0000000680',
    amgExpenseEur: 1469.11,
  },
  sampiyon: {
    customsNumber: '26UA400040016975U0',
    documentNumber: 'К0000000335',
    invoiceNumber: 'IHR2026000000185',
    rows: 31,
    sourceRows: 34,
    qty: 782,
    invoiceUsd: 8172.83,
    invoiceEur: 7008.92,
    usdRate: 44.6716,
    eurRate: 52.0898,
    fenixExpenseEurForCurrentProducts: 1825.42,
    amgDocumentNumber: 'К0000000681',
    amgAccountingExpenseEur: 753.59036428909747,
  },
  expenseAttachment: {
    accountingIncludedUah: 107295.4 + 8500,
    accountingExcludedUah: 1380 + 1210,
    managementTransportUsd: 2200,
  },
} as const;
