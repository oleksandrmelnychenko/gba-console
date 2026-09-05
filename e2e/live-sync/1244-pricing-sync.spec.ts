import { expect, test } from '@playwright/test';
import sql from 'mssql';
import { AYMEKS_ROWS, BUG_1244, SAMPIYON_ROWS } from './bug1244PricingMatrix';

type ReceiptRow = {
  SourceWorld: string;
  ReceiptId: string;
  ContractVersion: string;
  CurrentStateAsOfUtc: Date;
  RawRows: number;
  CanonicalRows: number;
  EligibleRows: number;
  ExcludedRows: number;
  UnclassifiedRows: number;
};

type EvidenceMatrixRow = {
  VendorCode: string;
  Qty: number;
  CurrentQty: number;
  UnitPrice: number;
  ExpenseUnit: number;
  ProjectionRows: number;
  StorageCount: number;
};

type ImportedIncomeRow = {
  ImportedForAmg: boolean;
  VendorCode: string;
  Qty: number;
  RemainingQty: number;
  UnitPrice: number;
};

const SERVER_IDENTITY = '01934d77f334';
const DATABASE_NAME = 'ConcordDb_V5';

let pool: sql.ConnectionPool;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const password = process.env.LIVE_SYNC_SQL_PASSWORD ?? process.env.E2E_SQL_PASSWORD;
  if (!password) {
    throw new Error('Set LIVE_SYNC_SQL_PASSWORD or E2E_SQL_PASSWORD for the DEV SQL instance.');
  }

  const database = process.env.LIVE_SYNC_SQL_DB ?? DATABASE_NAME;
  if (database !== DATABASE_NAME) {
    throw new Error(`BUG-1244 live audit refuses database "${database}"; expected "${DATABASE_NAME}".`);
  }

  pool = await new sql.ConnectionPool({
    server: process.env.LIVE_SYNC_SQL_HOST ?? '127.0.0.1',
    port: Number(process.env.LIVE_SYNC_SQL_PORT ?? 1433),
    database,
    user: process.env.LIVE_SYNC_SQL_USER ?? 'sa',
    password,
    options: { trustServerCertificate: true, encrypt: false },
    pool: { max: 2 },
    requestTimeout: 120_000,
  }).connect();

  const fence = await query<{ ServerName: string; DbName: string }>(
    'SELECT CONVERT(nvarchar(128), @@SERVERNAME) AS ServerName, DB_NAME() AS DbName',
  );
  expect(fence).toEqual([{ ServerName: SERVER_IDENTITY, DbName: DATABASE_NAME }]);
});

test.afterAll(async () => {
  await pool?.close();
});

test('BUG-1244: latest 1C evidence is complete V7 data from both worlds', async () => {
  const receipts = await query<ReceiptRow>(`
    WITH latest AS (
      SELECT receipt.*,
             ROW_NUMBER() OVER (
               PARTITION BY receipt.ForAmg
               ORDER BY receipt.DestinationCommittedAtUtc DESC
             ) AS rn
      FROM dbo.DataSyncOneCInboundReceipt AS receipt
    )
    SELECT SourceWorld, CONVERT(varchar(36), ReceiptId) AS ReceiptId,
           ContractVersion, CurrentStateAsOfUtc, RawRows, CanonicalRows,
           EligibleRows, ExcludedRows, UnclassifiedRows
    FROM latest
    WHERE rn = 1
    ORDER BY SourceWorld;
  `);

  expect(receipts.map((row) => row.SourceWorld)).toEqual(['AMG', 'FENIX']);
  for (const receipt of receipts) {
    expect(receipt.ContractVersion).toBe('GBA-ONEC-INBOUND-V7');
    expect(receipt.CurrentStateAsOfUtc.getTime()).toBeGreaterThanOrEqual(
      new Date(`${BUG_1244.customsDate}T00:00:00Z`).getTime(),
    );
    expect(Number(receipt.RawRows)).toBe(Number(receipt.CanonicalRows));
    expect(Number(receipt.CanonicalRows)).toBe(
      Number(receipt.EligibleRows) + Number(receipt.ExcludedRows),
    );
    expect(Number(receipt.UnclassifiedRows)).toBe(0);
  }
});

test('BUG-1244: AYMEKS Excel matches Fenix prices, quantities, expenses and storage split', async () => {
  const rows = await query<EvidenceMatrixRow>(`
    WITH latest AS (
      SELECT TOP (1) ReceiptId
      FROM dbo.DataSyncOneCInboundReceipt
      WHERE ForAmg = 0
      ORDER BY DestinationCommittedAtUtc DESC
    )
    SELECT line.VendorCode,
           MAX(line.OriginalQty) AS Qty,
           SUM(line.CurrentQty) AS CurrentQty,
           MAX(line.ExpectedUnitPriceEur) AS UnitPrice,
           MAX(line.SourceDeliveryExpenseUnitAmountEur) AS ExpenseUnit,
           COUNT_BIG(*) AS ProjectionRows,
           COUNT(DISTINCT line.ResolvedStorageID) AS StorageCount
    FROM dbo.DataSyncOneCInboundReceiptLine AS line
    WHERE line.ReceiptId = (SELECT ReceiptId FROM latest)
      AND line.ExpectedCustomsNumber = N'${BUG_1244.aymeks.customsNumber}'
      AND line.ExcludedReason IS NULL
    GROUP BY line.VendorCode
    ORDER BY line.VendorCode;
  `);

  expect(rows).toHaveLength(BUG_1244.aymeks.rows);
  expectMatrix(
    rows,
    AYMEKS_ROWS.map((row) => ({
      vendorCode: row.vendorCode,
      qty: row.qty,
      unitPrice: row.unitPriceEur,
    })),
  );
  expect(sum(rows, (row) => Number(row.Qty))).toBe(BUG_1244.aymeks.qty);
  expect(sum(rows, (row) => Number(row.Qty) * Number(row.UnitPrice))).toBeCloseTo(
    BUG_1244.aymeks.invoiceEur,
    4,
  );
  expect(sum(rows, (row) => Number(row.Qty) * Number(row.ExpenseUnit))).toBeCloseTo(
    BUG_1244.aymeks.fenixExpenseEur,
    4,
  );

  const split = rows.find((row) => row.VendorCode === '12856CNT');
  expect(split).toBeDefined();
  expect(Number(split?.Qty)).toBe(150);
  expect(Number(split?.CurrentQty)).toBe(150);
  expect(Number(split?.ProjectionRows)).toBe(2);
  expect(Number(split?.StorageCount)).toBe(2);
  expect(rows.filter((row) => row.VendorCode !== '12856CNT').every((row) => Number(row.ProjectionRows) === 1)).toBe(true);

  const target = await query<{
    Incomes: number;
    Storages: number;
    SourceDocuments: number;
    Items: number;
    Products: number;
    RemainingQty: number;
  }>(`
    SELECT COUNT(DISTINCT income.ID) AS Incomes,
           COUNT(DISTINCT income.StorageID) AS Storages,
           COUNT(DISTINCT CONVERT(varchar(34), income.SourceDocumentID, 1)) AS SourceDocuments,
           COUNT_BIG(item.ID) AS Items,
           COUNT(DISTINCT invoiceItem.ProductID) AS Products,
           SUM(item.RemainingQty) AS RemainingQty
    FROM dbo.ProductIncome AS income
    INNER JOIN dbo.ProductIncomeItem AS item
      ON item.ProductIncomeID = income.ID AND item.Deleted = 0
    INNER JOIN dbo.PackingListPackageOrderItem AS packingItem
      ON packingItem.ID = item.PackingListPackageOrderItemID AND packingItem.Deleted = 0
    INNER JOIN dbo.SupplyInvoiceOrderItem AS invoiceItem
      ON invoiceItem.ID = packingItem.SupplyInvoiceOrderItemID AND invoiceItem.Deleted = 0
    INNER JOIN dbo.PackingList AS packing
      ON packing.ID = packingItem.PackingListID AND packing.Deleted = 0
    INNER JOIN dbo.SupplyInvoice AS invoice
      ON invoice.ID = packing.SupplyInvoiceID AND invoice.Deleted = 0
    WHERE income.Deleted = 0 AND income.IsFromOneC = 1 AND income.IsHide = 1
      AND invoice.NumberCustomDeclaration = N'${BUG_1244.aymeks.customsNumber}';
  `);
  expect({
    Incomes: Number(target[0].Incomes),
    Storages: Number(target[0].Storages),
    SourceDocuments: Number(target[0].SourceDocuments),
    Items: Number(target[0].Items),
    Products: Number(target[0].Products),
    RemainingQty: Number(target[0].RemainingQty),
  }).toEqual({
    Incomes: 2,
    Storages: 2,
    SourceDocuments: 1,
    Items: 36,
    Products: 35,
    RemainingQty: 2082,
  });

  const amgExpense = await exactExpenseForSourceDocument(
    true,
    BUG_1244.aymeks.amgDocumentNumber,
    BUG_1244.aymeks.invoiceNumber,
    'OriginalQty',
  );
  expect(amgExpense.Products).toBe(35);
  expect(amgExpense.Qty).toBe(2082);
  expect(amgExpense.Expense).toBeCloseTo(BUG_1244.aymeks.amgExpenseEur, 4);
});

test('BUG-1244: SAMPIYON preserves all lines, currencies and sold-out history', async () => {
  const rows = await query<ImportedIncomeRow>(`
    SELECT income.ImportedForAmg, product.VendorCode,
           item.Qty, item.RemainingQty, packingItem.UnitPrice
    FROM dbo.ProductIncome AS income
    INNER JOIN dbo.ProductIncomeItem AS item
      ON item.ProductIncomeID = income.ID AND item.Deleted = 0
    INNER JOIN dbo.PackingListPackageOrderItem AS packingItem
      ON packingItem.ID = item.PackingListPackageOrderItemID AND packingItem.Deleted = 0
    INNER JOIN dbo.SupplyInvoiceOrderItem AS invoiceItem
      ON invoiceItem.ID = packingItem.SupplyInvoiceOrderItemID AND invoiceItem.Deleted = 0
    INNER JOIN dbo.Product AS product
      ON product.ID = invoiceItem.ProductID AND product.Deleted = 0
    INNER JOIN dbo.PackingList AS packing
      ON packing.ID = packingItem.PackingListID AND packing.Deleted = 0
    INNER JOIN dbo.SupplyInvoice AS invoice
      ON invoice.ID = packing.SupplyInvoiceID AND invoice.Deleted = 0
    WHERE income.Deleted = 0 AND income.IsFromOneC = 1 AND income.IsHide = 0
      AND invoice.NumberCustomDeclaration = N'${BUG_1244.sampiyon.customsNumber}'
    ORDER BY income.ImportedForAmg, product.VendorCode;
  `);

  const fenixRows = rows.filter((row) => !row.ImportedForAmg);
  const amgRows = rows.filter((row) => row.ImportedForAmg);
  expect(fenixRows).toHaveLength(BUG_1244.sampiyon.rows);
  expect(amgRows).toHaveLength(BUG_1244.sampiyon.rows);
  expectMatrix(
    fenixRows.map((row) => ({ VendorCode: row.VendorCode, Qty: row.Qty, UnitPrice: row.UnitPrice })),
    SAMPIYON_ROWS.map((row) => ({ vendorCode: row.vendorCode, qty: row.qty, unitPrice: row.unitPriceEur })),
  );
  expectMatrix(
    amgRows.map((row) => ({ VendorCode: row.VendorCode, Qty: row.Qty, UnitPrice: row.UnitPrice })),
    SAMPIYON_ROWS.map((row) => ({ vendorCode: row.vendorCode, qty: row.qty, unitPrice: row.unitPriceUsd })),
  );
  expect(sum(fenixRows, (row) => Number(row.Qty))).toBe(BUG_1244.sampiyon.qty);
  expect(sum(amgRows, (row) => Number(row.Qty))).toBe(BUG_1244.sampiyon.qty);

  const sourceDuplicates = SAMPIYON_ROWS
    .filter((row) => row.sourceRows > 1)
    .map((row) => row.vendorCode)
    .sort();
  expect(sourceDuplicates).toEqual(['CH1228-SF', 'CR0059-SF', 'CR0137-SF']);
  for (const vendorCode of sourceDuplicates) {
    expect(fenixRows.filter((row) => row.VendorCode === vendorCode)).toHaveLength(1);
    expect(amgRows.filter((row) => row.VendorCode === vendorCode)).toHaveLength(1);
  }

  const invoices = await query<{ ImportedForAmg: boolean; NetPrice: number; CurrencyCode: number }>(`
    SELECT income.ImportedForAmg, MAX(invoice.NetPrice) AS NetPrice,
           MAX(currency.CodeOneC) AS CurrencyCode
    FROM dbo.ProductIncome AS income
    INNER JOIN dbo.ProductIncomeItem AS item
      ON item.ProductIncomeID = income.ID AND item.Deleted = 0
    INNER JOIN dbo.PackingListPackageOrderItem AS packingItem
      ON packingItem.ID = item.PackingListPackageOrderItemID AND packingItem.Deleted = 0
    INNER JOIN dbo.PackingList AS packing
      ON packing.ID = packingItem.PackingListID AND packing.Deleted = 0
    INNER JOIN dbo.SupplyInvoice AS invoice
      ON invoice.ID = packing.SupplyInvoiceID AND invoice.Deleted = 0
    INNER JOIN dbo.SupplyOrder AS supplyOrder ON supplyOrder.ID = invoice.SupplyOrderID
    INNER JOIN dbo.ClientAgreement AS clientAgreement ON clientAgreement.ID = supplyOrder.ClientAgreementID
    INNER JOIN dbo.Agreement AS agreement ON agreement.ID = clientAgreement.AgreementID
    INNER JOIN dbo.Currency AS currency ON currency.ID = agreement.CurrencyID
    WHERE income.Deleted = 0 AND income.IsFromOneC = 1 AND income.IsHide = 0
      AND invoice.NumberCustomDeclaration = N'${BUG_1244.sampiyon.customsNumber}'
    GROUP BY income.ImportedForAmg
    ORDER BY income.ImportedForAmg;
  `);
  expect(invoices).toHaveLength(2);
  expect(invoices[0].ImportedForAmg).toBe(false);
  expect(Number(invoices[0].CurrencyCode)).toBe(978);
  expect(Number(invoices[0].NetPrice)).toBeCloseTo(BUG_1244.sampiyon.invoiceEur, 2);
  expect(invoices[1].ImportedForAmg).toBe(true);
  expect(Number(invoices[1].CurrencyCode)).toBe(840);
  expect(Number(invoices[1].NetPrice)).toBeCloseTo(BUG_1244.sampiyon.invoiceUsd, 2);

  const soldOut = rows.filter((row) => row.VendorCode === 'CS1558-SF');
  expect(soldOut).toHaveLength(2);
  expect(soldOut.every((row) => Number(row.Qty) === 12 && Number(row.RemainingQty) === 0)).toBe(true);

  const currentEvidence = await query<{ Products: number; HasSoldOutLine: number; Expense: number }>(`
    WITH latest AS (
      SELECT TOP (1) ReceiptId
      FROM dbo.DataSyncOneCInboundReceipt
      WHERE ForAmg = 0
      ORDER BY DestinationCommittedAtUtc DESC
    ), grouped AS (
      SELECT line.VendorCode, MAX(line.OriginalQty) AS Qty,
             MAX(line.SourceDeliveryExpenseUnitAmountEur) AS ExpenseUnit
      FROM dbo.DataSyncOneCInboundReceiptLine AS line
      WHERE line.ReceiptId = (SELECT ReceiptId FROM latest)
        AND line.ExpectedCustomsNumber = N'${BUG_1244.sampiyon.customsNumber}'
        AND line.ExcludedReason IS NULL
      GROUP BY line.VendorCode
    )
    SELECT COUNT_BIG(*) AS Products,
           SUM(CASE WHEN VendorCode = N'CS1558-SF' THEN 1 ELSE 0 END) AS HasSoldOutLine,
           SUM(Qty * ExpenseUnit) AS Expense
    FROM grouped;
  `);
  expect(Number(currentEvidence[0].Products)).toBe(30);
  expect(Number(currentEvidence[0].HasSoldOutLine)).toBe(0);
  expect(Number(currentEvidence[0].Expense)).toBeCloseTo(
    BUG_1244.sampiyon.fenixExpenseEurForCurrentProducts,
    4,
  );

  const services = await query<{ ImportedForAmg: boolean; Value: number; AccountingValue: number }>(`
    SELECT income.ImportedForAmg, MAX(serviceLink.Value) AS Value,
           MAX(serviceLink.AccountingValue) AS AccountingValue
    FROM dbo.ProductIncome AS income
    INNER JOIN dbo.ProductIncomeItem AS item
      ON item.ProductIncomeID = income.ID AND item.Deleted = 0
    INNER JOIN dbo.PackingListPackageOrderItem AS packingItem
      ON packingItem.ID = item.PackingListPackageOrderItemID AND packingItem.Deleted = 0
    INNER JOIN dbo.PackingList AS packing
      ON packing.ID = packingItem.PackingListID AND packing.Deleted = 0
    INNER JOIN dbo.SupplyInvoice AS invoice
      ON invoice.ID = packing.SupplyInvoiceID AND invoice.Deleted = 0
    INNER JOIN dbo.SupplyInvoiceMergedService AS serviceLink
      ON serviceLink.SupplyInvoiceID = invoice.ID AND serviceLink.Deleted = 0
    INNER JOIN dbo.MergedService AS service
      ON service.ID = serviceLink.MergedServiceID AND service.Deleted = 0
    WHERE income.Deleted = 0 AND income.IsFromOneC = 1 AND income.IsHide = 0
      AND invoice.NumberCustomDeclaration = N'${BUG_1244.sampiyon.customsNumber}'
    GROUP BY income.ImportedForAmg
    ORDER BY income.ImportedForAmg;
  `);
  expect(Number(services[0].Value)).toBeCloseTo(1840.31, 4);
  expect(Number(services[1].AccountingValue)).toBeCloseTo(
    BUG_1244.sampiyon.amgAccountingExpenseEur,
    8,
  );

  // The attachment marks AF-Trans + broker as accounting cost and explicitly
  // excludes parking + TPO. 1C allocates each expense document at its own
  // rounded register rate, so the reverse conversion has a small UAH delta.
  const allocatedAccountingEur =
    BUG_1244.aymeks.amgExpenseEur + Number(services[1].AccountingValue);
  const reconstructedAccountingUah =
    allocatedAccountingEur * BUG_1244.sampiyon.eurRate;
  expect(
    Math.abs(
      reconstructedAccountingUah - BUG_1244.expenseAttachment.accountingIncludedUah,
    ),
  ).toBeLessThan(20);
  expect(
    Math.abs(
      reconstructedAccountingUah -
        (BUG_1244.expenseAttachment.accountingIncludedUah +
          BUG_1244.expenseAttachment.accountingExcludedUah),
    ),
  ).toBeGreaterThan(2_000);
});

test('BUG-1244: repeated sync has no true duplicates; zero and negative source rows fail closed', async () => {
  const duplicates = await query<{ DuplicateGroups: number }>(`
    SELECT COUNT_BIG(*) AS DuplicateGroups
    FROM (
      SELECT income.ImportedForAmg, income.SourceDocumentID,
             income.SourceDocumentType, income.StorageID, invoiceItem.ProductID
      FROM dbo.ProductIncome AS income
      INNER JOIN dbo.ProductIncomeItem AS item
        ON item.ProductIncomeID = income.ID AND item.Deleted = 0
      INNER JOIN dbo.PackingListPackageOrderItem AS packingItem
        ON packingItem.ID = item.PackingListPackageOrderItemID AND packingItem.Deleted = 0
      INNER JOIN dbo.SupplyInvoiceOrderItem AS invoiceItem
        ON invoiceItem.ID = packingItem.SupplyInvoiceOrderItemID AND invoiceItem.Deleted = 0
      WHERE income.Deleted = 0 AND income.IsFromOneC = 1 AND income.IsHide = 1
        AND item.RemainingQty > 0
      GROUP BY income.ImportedForAmg, income.SourceDocumentID,
               income.SourceDocumentType, income.StorageID, invoiceItem.ProductID
      HAVING COUNT_BIG(*) > 1
    ) AS duplicate;
  `);
  expect(Number(duplicates[0].DuplicateGroups)).toBe(0);

  const sourceEdges = await query<{
    NonPositiveRows: number;
    UnexcludedNonPositiveRows: number;
    NegativeSourceRows: number;
    MissingExactExpenseRows: number;
    NegativeExactExpenseRows: number;
  }>(`
    WITH latest AS (
      SELECT receipt.ReceiptId,
             ROW_NUMBER() OVER (
               PARTITION BY receipt.ForAmg
               ORDER BY receipt.DestinationCommittedAtUtc DESC
             ) AS rn
      FROM dbo.DataSyncOneCInboundReceipt AS receipt
    )
    SELECT
      SUM(CASE WHEN line.CurrentQty <= 0 THEN 1 ELSE 0 END) AS NonPositiveRows,
      SUM(CASE WHEN line.CurrentQty <= 0 AND line.ExcludedReason IS NULL THEN 1 ELSE 0 END)
        AS UnexcludedNonPositiveRows,
      SUM(CASE WHEN line.CurrentQty < 0 THEN 1 ELSE 0 END) AS NegativeSourceRows,
      SUM(CASE WHEN line.ForAmg = 0 AND line.SourceDocumentType = 3
                    AND line.ExcludedReason IS NULL
                    AND line.SourceDeliveryExpenseUnitAmountEur IS NULL THEN 1 ELSE 0 END)
        AS MissingExactExpenseRows,
      SUM(CASE WHEN line.SourceDeliveryExpenseUnitAmountEur < 0 THEN 1 ELSE 0 END)
        AS NegativeExactExpenseRows
    FROM latest
    INNER JOIN dbo.DataSyncOneCInboundReceiptLine AS line
      ON line.ReceiptId = latest.ReceiptId
    WHERE latest.rn = 1;
  `);
  expect(Number(sourceEdges[0].NonPositiveRows)).toBeGreaterThan(0);
  expect(Number(sourceEdges[0].NegativeSourceRows)).toBeGreaterThan(0);
  expect(Number(sourceEdges[0].UnexcludedNonPositiveRows)).toBe(0);
  expect(Number(sourceEdges[0].MissingExactExpenseRows)).toBe(0);
  expect(Number(sourceEdges[0].NegativeExactExpenseRows)).toBe(0);

  const targetEdges = await query<{
    NegativePrices: number;
    NegativeQuantities: number;
    ZeroPrices: number;
  }>(`
    SELECT
      SUM(CASE WHEN packingItem.UnitPrice < 0 OR packingItem.UnitPriceEur < 0
                    OR consignmentItem.Price < 0 OR consignmentItem.NetPrice < 0
                    OR consignmentItem.AccountingPrice < 0 THEN 1 ELSE 0 END) AS NegativePrices,
      SUM(CASE WHEN incomeItem.Qty < 0 OR incomeItem.RemainingQty < 0
                    OR consignmentItem.Qty < 0 OR consignmentItem.RemainingQty < 0 THEN 1 ELSE 0 END)
        AS NegativeQuantities,
      SUM(CASE WHEN packingItem.UnitPrice = 0 THEN 1 ELSE 0 END) AS ZeroPrices
    FROM dbo.ProductIncome AS income
    INNER JOIN dbo.ProductIncomeItem AS incomeItem
      ON incomeItem.ProductIncomeID = income.ID AND incomeItem.Deleted = 0
    INNER JOIN dbo.PackingListPackageOrderItem AS packingItem
      ON packingItem.ID = incomeItem.PackingListPackageOrderItemID AND packingItem.Deleted = 0
    INNER JOIN dbo.ConsignmentItem AS consignmentItem
      ON consignmentItem.ProductIncomeItemID = incomeItem.ID AND consignmentItem.Deleted = 0
    INNER JOIN dbo.Consignment AS consignment
      ON consignment.ID = consignmentItem.ConsignmentID AND consignment.Deleted = 0
    WHERE income.Deleted = 0 AND income.IsFromOneC = 1 AND income.IsHide = 1;
  `);
  expect(Number(targetEdges[0].NegativePrices)).toBe(0);
  expect(Number(targetEdges[0].NegativeQuantities)).toBe(0);
  expect(Number(targetEdges[0].ZeroPrices)).toBeGreaterThan(0);

  const zeroPrice = await query<{
    FenixPrice: number;
    FenixDocument: string;
    AmgOtherDocumentPrice: number;
    AmgOtherDocument: string;
  }>(`
    WITH latest AS (
      SELECT receipt.ReceiptId, receipt.ForAmg,
             ROW_NUMBER() OVER (
               PARTITION BY receipt.ForAmg
               ORDER BY receipt.DestinationCommittedAtUtc DESC
             ) AS rn
      FROM dbo.DataSyncOneCInboundReceipt AS receipt
    ), fenix AS (
      SELECT TOP (1) line.ExpectedUnitPriceEur AS Price, line.DocumentNumber
      FROM latest
      INNER JOIN dbo.DataSyncOneCInboundReceiptLine AS line
        ON line.ReceiptId = latest.ReceiptId
      WHERE latest.rn = 1 AND latest.ForAmg = 0 AND line.VendorCode = N'I0007'
        AND line.ExcludedReason IS NULL
    ), amg AS (
      SELECT TOP (1) line.ExpectedUnitPriceEur AS Price, line.DocumentNumber
      FROM latest
      INNER JOIN dbo.DataSyncOneCInboundReceiptLine AS line
        ON line.ReceiptId = latest.ReceiptId
      WHERE latest.rn = 1 AND latest.ForAmg = 1 AND line.VendorCode = N'I0007'
        AND line.ExpectedUnitPriceEur > 0
      ORDER BY line.RawDocumentDate DESC
    )
    SELECT fenix.Price AS FenixPrice, fenix.DocumentNumber AS FenixDocument,
           amg.Price AS AmgOtherDocumentPrice, amg.DocumentNumber AS AmgOtherDocument
    FROM fenix CROSS JOIN amg;
  `);
  expect(Number(zeroPrice[0].FenixPrice)).toBe(0);
  expect(Number(zeroPrice[0].AmgOtherDocumentPrice)).toBe(440);
  expect(zeroPrice[0].FenixDocument).not.toBe(zeroPrice[0].AmgOtherDocument);
});

async function exactExpenseForSourceDocument(
  forAmg: boolean,
  documentNumber: string,
  invoiceNumber: string,
  quantityColumn: 'OriginalQty' | 'CurrentQty',
): Promise<{ Products: number; Qty: number; Expense: number }> {
  const rows = await query<{ Products: number; Qty: number; Expense: number }>(`
    WITH latest AS (
      SELECT TOP (1) ReceiptId
      FROM dbo.DataSyncOneCInboundReceipt
      WHERE ForAmg = ${forAmg ? 1 : 0}
      ORDER BY DestinationCommittedAtUtc DESC
    ), grouped AS (
      SELECT line.VendorCode, MAX(line.${quantityColumn}) AS Qty,
             MAX(line.SourceDeliveryExpenseUnitAmountEur) AS ExpenseUnit
      FROM dbo.DataSyncOneCInboundReceiptLine AS line
      WHERE line.ReceiptId = (SELECT ReceiptId FROM latest)
        AND line.DocumentNumber = N'${documentNumber}'
        AND line.InvoiceNumber = N'${invoiceNumber}'
      GROUP BY line.VendorCode
    )
    SELECT COUNT_BIG(*) AS Products, SUM(Qty) AS Qty,
           SUM(Qty * ExpenseUnit) AS Expense
    FROM grouped;
  `);
  return {
    Products: Number(rows[0].Products),
    Qty: Number(rows[0].Qty),
    Expense: Number(rows[0].Expense),
  };
}

function expectMatrix(
  actualRows: Array<{ VendorCode: string; Qty: number; UnitPrice: number }>,
  expectedRows: Array<{ vendorCode: string; qty: number; unitPrice: number }>,
): void {
  const actualByVendor = new Map(actualRows.map((row) => [row.VendorCode, row]));
  expect([...actualByVendor.keys()].sort()).toEqual(
    expectedRows.map((row) => row.vendorCode).sort(),
  );
  for (const expected of expectedRows) {
    const actual = actualByVendor.get(expected.vendorCode);
    expect(actual, `missing ${expected.vendorCode}`).toBeDefined();
    expect(Number(actual?.Qty), `${expected.vendorCode} quantity`).toBe(expected.qty);
    expect(Number(actual?.UnitPrice), `${expected.vendorCode} unit price`).toBeCloseTo(
      expected.unitPrice,
      4,
    );
  }
}

function sum<T>(rows: readonly T[], selector: (row: T) => number): number {
  return rows.reduce((total, row) => total + selector(row), 0);
}

async function query<T>(queryText: string): Promise<T[]> {
  const result = await pool.request().query(queryText);
  return result.recordset as T[];
}
