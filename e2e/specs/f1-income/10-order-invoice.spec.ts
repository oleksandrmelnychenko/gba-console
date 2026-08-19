import { TEST_INCOME_SUPPLIERS } from '../../data/testIncome';
import { expect, test } from '../../fixtures/test';
import { addInvoiceFromCcd, createDirectOrderFromCcd, createProForma } from '../../flows/income';

test.describe.configure({ mode: 'serial' });

for (const supplier of TEST_INCOME_SUPPLIERS) {
  const tag = supplier.key === 'AYMEKS' ? ' @smoke' : '';

  test(`прихід ${supplier.key}: замовлення + інвойс з файлу${tag}`, async ({ page, db, entities }) => {
    const order = await createDirectOrderFromCcd(page, supplier, entities.runId);
    entities.record(`income.${supplier.key}.order`, order);

    await createProForma(page, supplier, entities.runId, order.orderNetId);

    const invoice = await addInvoiceFromCcd(page, supplier, entities.runId, order.orderNetId);
    entities.record(`income.${supplier.key}.invoice`, invoice);

    const rows = await db.query<{ cnt: number; qty: number; net: number; sourceNet: number }>(
      `SELECT COUNT(*) AS cnt,
              COALESCE(SUM(it.Qty), 0) AS qty,
              COALESCE(SUM(it.UnitPrice * it.Qty), 0) AS net,
              COALESCE(SUM(COALESCE(it.SourceTotalNetPrice, it.UnitPrice * it.Qty)), 0) AS sourceNet
       FROM dbo.SupplyInvoiceOrderItem it
       JOIN dbo.SupplyInvoice si ON si.ID = it.SupplyInvoiceID
       WHERE si.Number = @number AND si.Deleted = 0 AND it.Deleted = 0`,
      { number: invoice.invoiceNumber },
    );
    expect(rows[0].cnt, 'кількість рядків інвойса').toBe(supplier.rows);
    expect(rows[0].qty, 'сума Qty інвойса').toBe(supplier.qty);
    expect(
      Math.abs(rows[0].sourceNet - supplier.invoiceAmount),
      `сума інвойса ${rows[0].sourceNet} vs ${supplier.invoiceAmount}`,
    ).toBeLessThanOrEqual(0.011);

    const header = await db.query<{ NetPrice: number }>(
      `SELECT si.NetPrice FROM dbo.SupplyInvoice si WHERE si.Number = @number AND si.Deleted = 0`,
      { number: invoice.invoiceNumber },
    );
    expect(header).toHaveLength(1);
    expect(
      Math.abs(header[0].NetPrice - supplier.invoiceAmount),
      `SupplyInvoice.NetPrice ${header[0].NetPrice} vs ${supplier.invoiceAmount}`,
    ).toBeLessThanOrEqual(0.011);

    const distinct = await db.query<{ cnt: number; products: number }>(
      `SELECT COUNT(*) AS cnt, COUNT(DISTINCT it.ProductID) AS products
       FROM dbo.SupplyInvoiceOrderItem it
       JOIN dbo.SupplyInvoice si ON si.ID = it.SupplyInvoiceID
       WHERE si.Number = @number AND si.Deleted = 0 AND it.Deleted = 0`,
      { number: invoice.invoiceNumber },
    );
    if (supplier.key === 'MAYER' || supplier.key === 'NOIR') {
      expect(distinct[0].products, 'повторні артикули мають лишатися окремими рядками').toBeLessThan(distinct[0].cnt);
    }
  });
}
