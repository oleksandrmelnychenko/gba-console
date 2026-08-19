import { TEST_INCOME_SUPPLIERS } from '../../data/testIncome';
import { expect, test } from '../../fixtures/test';
import type { CreatedInvoiceRef, CreatedOrderRef } from '../../flows/income';
import { addPackingListFromCcd } from '../../flows/income';

test.describe.configure({ mode: 'serial' });

for (const supplier of TEST_INCOME_SUPPLIERS) {
  const tag = supplier.key === 'AYMEKS' ? ' @smoke' : '';

  test(`прихід ${supplier.key}: пак лист${tag}`, async ({ page, db, entities }) => {
    const order = entities.require<CreatedOrderRef>(
      `income.${supplier.key}.order`,
      'спочатку має пройти 10-order-invoice',
    );
    const invoice = entities.require<CreatedInvoiceRef>(
      `income.${supplier.key}.invoice`,
      'спочатку має пройти 10-order-invoice',
    );

    await addPackingListFromCcd(page, supplier, order.orderNetId, invoice.invoiceNumber);

    const packed = await db.query<{ cnt: number; qty: number; badFk: number }>(
      `SELECT COUNT(*) AS cnt,
              COALESCE(SUM(pli.Qty), 0) AS qty,
              SUM(CASE WHEN pli.SupplyInvoiceOrderItemID IS NULL THEN 1 ELSE 0 END) AS badFk
       FROM dbo.PackingListPackageOrderItem pli
       JOIN dbo.PackingList pl ON pl.ID = pli.PackingListID
       JOIN dbo.SupplyInvoice si ON si.ID = pl.SupplyInvoiceID
       WHERE si.Number = @number AND si.Deleted = 0 AND pl.Deleted = 0 AND pli.Deleted = 0`,
      { number: invoice.invoiceNumber },
    );
    expect(packed[0].cnt, 'рядки паклиста == рядки інвойса').toBe(supplier.rows);
    expect(packed[0].qty, 'Qty паклиста == Qty інвойса').toBe(supplier.qty);
    expect(packed[0].badFk, 'кожен рядок паклиста привʼязаний до фізичного рядка інвойса').toBe(0);
  });
}
