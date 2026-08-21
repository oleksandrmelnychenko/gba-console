import { NBU_EUR_RATE, NBU_USD_RATE, TEST_INCOME_SUPPLIERS } from '../../data/testIncome';
import { expect, test } from '../../fixtures/test';
import type { CreatedInvoiceRef, CreatedOrderRef } from '../../flows/income';
import { uploadCustomsCodes } from '../../flows/income';

test.describe.configure({ mode: 'serial' });

for (const supplier of TEST_INCOME_SUPPLIERS) {
  const tag = supplier.key === 'AYMEKS' ? ' @smoke' : '';

  test(`прихід ${supplier.key}: митна специфікація${tag}`, async ({ page, db, entities }) => {
    const order = entities.require<CreatedOrderRef>(
      `income.${supplier.key}.order`,
      'спочатку має пройти 10-order-invoice',
    );
    const invoice = entities.require<CreatedInvoiceRef>(
      `income.${supplier.key}.invoice`,
      'спочатку має пройти 10-order-invoice',
    );

    await uploadCustomsCodes(page, supplier, order.orderNetId);

    const spec = await db.query<{ activeSpecs: number; realSpecs: number; coveredLines: number; missingFk: number; customs: number; duty: number; vat: number }>(
      `SELECT COUNT(*) AS activeSpecs,
              SUM(CASE WHEN ps.CustomsValue > 0 THEN 1 ELSE 0 END) AS realSpecs,
              COUNT(DISTINCT ops.SupplyInvoiceOrderItemID) AS coveredLines,
              SUM(CASE WHEN ops.SupplyInvoiceOrderItemID IS NULL THEN 1 ELSE 0 END) AS missingFk,
              COALESCE(SUM(ps.CustomsValue), 0) AS customs,
              COALESCE(SUM(ps.Duty), 0) AS duty,
              COALESCE(SUM(ps.VATValue), 0) AS vat
       FROM dbo.OrderProductSpecification ops
       JOIN dbo.ProductSpecification ps ON ps.ID = ops.ProductSpecificationId
       JOIN dbo.SupplyInvoice si ON si.ID = ops.SupplyInvoiceId
       WHERE si.Number = @number AND si.Deleted = 0 AND ops.Deleted = 0 AND ps.Deleted = 0`,
      { number: invoice.invoiceNumber },
    );
    expect(spec[0].activeSpecs, 'рівно одна активна специфікація на рядок інвойса').toBe(supplier.rows);
    expect(spec[0].realSpecs, 'реальних (з митною вартістю) специфікацій == рядки інвойса').toBe(supplier.rows);
    expect(spec[0].coveredLines, 'кожен рядок інвойса має специфікацію').toBe(supplier.rows);
    expect(spec[0].missingFk, 'кожна специфікація має FK на свій SupplyInvoiceOrderItemID').toBe(0);
    expect(Math.abs(spec[0].customs - supplier.customsValue), `митна вартість ${spec[0].customs}`).toBeLessThanOrEqual(0.011);
    expect(Math.abs(spec[0].duty - supplier.duty), `мито ${spec[0].duty}`).toBeLessThanOrEqual(0.011);
    expect(Math.abs(spec[0].vat - supplier.vat), `ПДВ ${spec[0].vat}`).toBeLessThanOrEqual(0.011);

    const fkDistinct = await db.query<{ realCnt: number; distinctFk: number }>(
      `SELECT SUM(CASE WHEN ps.CustomsValue > 0 THEN 1 ELSE 0 END) AS realCnt,
              COUNT(DISTINCT CASE WHEN ps.CustomsValue > 0 THEN ops.SupplyInvoiceOrderItemID END) AS distinctFk
       FROM dbo.OrderProductSpecification ops
       JOIN dbo.ProductSpecification ps ON ps.ID = ops.ProductSpecificationId
       JOIN dbo.SupplyInvoice si ON si.ID = ops.SupplyInvoiceId
       WHERE si.Number = @number AND si.Deleted = 0 AND ops.Deleted = 0 AND ps.Deleted = 0`,
      { number: invoice.invoiceNumber },
    );
    expect(fkDistinct[0].distinctFk, 'кожна реальна специфікація на своєму рядку інвойса').toBe(fkDistinct[0].realCnt);

    // Rate invariant: every packing row must carry the official NBU rate for its invoice
    // currency on the exact date-only МД value. For EUR this also rejects the next day's
    // 51.0955 regression; USD suppliers must retain their independent 44.6676 rate.
    const rate = await db.query<{ distinctRates: number; rateValue: number }>(
      `SELECT COUNT(DISTINCT pli.ExchangeRateAmount) AS distinctRates,
              MIN(pli.ExchangeRateAmount) AS rateValue
       FROM dbo.PackingListPackageOrderItem pli
       JOIN dbo.PackingList pl ON pl.ID = pli.PackingListID
       JOIN dbo.SupplyInvoice si ON si.ID = pl.SupplyInvoiceID
       WHERE si.Number = @number AND si.Deleted = 0 AND pl.Deleted = 0 AND pli.Deleted = 0`,
      { number: invoice.invoiceNumber },
    );
    expect(rate[0].distinctRates, 'усі рядки паклиста мають один курс (без розбіжності по рядках)').toBe(1);
    const expectedRate = supplier.invoiceCurrency === 'USD' ? NBU_USD_RATE : NBU_EUR_RATE;
    expect(Math.abs(rate[0].rateValue - expectedRate), `курс ${rate[0].rateValue} vs очікуваний ${expectedRate}`).toBeLessThanOrEqual(0.0001);
  });
}
