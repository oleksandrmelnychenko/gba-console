import { SMOKE_SUPPLIER } from '../../data/testIncome';
import { expect, test } from '../../fixtures/test';
import type { CreatedInvoiceRef, CreatedOrderRef } from '../../flows/income';
import { uploadCustomsCodes } from '../../flows/income';

test.describe.configure({ mode: 'serial' });

const supplier = SMOKE_SUPPLIER;

const SNAPSHOT_SQL = `
  SELECT
    (SELECT COUNT(*) FROM dbo.SupplyInvoiceOrderItem it JOIN dbo.SupplyInvoice si ON si.ID = it.SupplyInvoiceID
      WHERE si.Number = @number AND si.Deleted = 0 AND it.Deleted = 0) AS invoiceItems,
    (SELECT COUNT(*) FROM dbo.OrderProductSpecification ops JOIN dbo.SupplyInvoice si ON si.ID = ops.SupplyInvoiceId
      WHERE si.Number = @number AND si.Deleted = 0 AND ops.Deleted = 0) AS specs,
    (SELECT COUNT(*) FROM dbo.PackingListPackageOrderItem pli JOIN dbo.PackingList pl ON pl.ID = pli.PackingListID
      JOIN dbo.SupplyInvoice si ON si.ID = pl.SupplyInvoiceID
      WHERE si.Number = @number AND si.Deleted = 0 AND pl.Deleted = 0 AND pli.Deleted = 0) AS packItems,
    (SELECT COUNT(*) FROM dbo.ProductIncomeItem pii JOIN dbo.ProductIncome pi ON pi.ID = pii.ProductIncomeID
      JOIN dbo.PackingListPackageOrderItem pli ON pli.ID = pii.PackingListPackageOrderItemID
      JOIN dbo.PackingList pl ON pl.ID = pli.PackingListID
      JOIN dbo.SupplyInvoice si ON si.ID = pl.SupplyInvoiceID
      WHERE si.Number = @number AND si.Deleted = 0 AND pl.Deleted = 0 AND pli.Deleted = 0 AND pii.Deleted = 0 AND pi.Deleted = 0) AS incomeItems,
    (SELECT COUNT(*) FROM dbo.ConsignmentItem ci JOIN dbo.Consignment c ON c.ID = ci.ConsignmentID
      WHERE ci.Deleted = 0 AND c.Deleted = 0 AND c.ProductIncomeID IN (
        SELECT DISTINCT pi.ID FROM dbo.ProductIncomeItem pii JOIN dbo.ProductIncome pi ON pi.ID = pii.ProductIncomeID
        JOIN dbo.PackingListPackageOrderItem pli ON pli.ID = pii.PackingListPackageOrderItemID
        JOIN dbo.PackingList pl ON pl.ID = pli.PackingListID
        JOIN dbo.SupplyInvoice si ON si.ID = pl.SupplyInvoiceID
        WHERE si.Number = @number AND si.Deleted = 0 AND pl.Deleted = 0 AND pli.Deleted = 0 AND pii.Deleted = 0 AND pi.Deleted = 0)) AS consignmentItems`;

test(`прихід ${supplier.key}: повторна специфікація без дублів @smoke`, async ({ page, db, entities }) => {
  const order = entities.require<CreatedOrderRef>(
    `income.${supplier.key}.order`,
    'спочатку має пройти 10-order-invoice',
  );
  const invoice = entities.require<CreatedInvoiceRef>(
    `income.${supplier.key}.invoice`,
    'спочатку має пройти 10-order-invoice',
  );

  const before = await db.query<Record<string, number>>(SNAPSHOT_SQL, { number: invoice.invoiceNumber });
  expect(before[0].specs, 'до replay має бути рівно одна активна специфікація на рядок').toBe(supplier.rows);

  await uploadCustomsCodes(page, supplier, order.orderNetId);

  const after = await db.query<Record<string, number>>(SNAPSHOT_SQL, { number: invoice.invoiceNumber });

  expect(after[0], 'replay специфікації не має створювати нові рядки').toEqual(before[0]);
});
