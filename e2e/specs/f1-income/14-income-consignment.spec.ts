import type { Route } from '@playwright/test';
import { TEST_INCOME_SUPPLIERS } from '../../data/testIncome';
import { expect, test } from '../../fixtures/test';
import type { CreatedInvoiceRef, CreatedOrderRef } from '../../flows/income';
import { postIncome } from '../../flows/income';

test.describe.configure({ mode: 'serial' });

test('прихід: додавання колонки чекає завантаження паклиста @smoke', async ({ page, entities }) => {
  const order = entities.require<CreatedOrderRef>(
    'income.AYMEKS.order',
    'спочатку має пройти 10-order-invoice',
  );
  entities.require<CreatedInvoiceRef>(
    'income.AYMEKS.invoice',
    'спочатку має пройти 10-order-invoice',
  );
  const packingListPattern = '**/supplies/packinglists/product-income/direct-supply-order/specification/products?**';

  let signalRequestStarted: () => void = () => undefined;
  const requestStarted = new Promise<void>((resolve) => {
    signalRequestStarted = resolve;
  });

  let releasePackingList: () => void = () => undefined;
  const packingListGate = new Promise<void>((resolve) => {
    releasePackingList = resolve;
  });

  let signalRouteFinished: () => void = () => undefined;
  const routeFinished = new Promise<void>((resolve) => {
    signalRouteFinished = resolve;
  });

  const delayPackingList = async (route: Route) => {
    signalRequestStarted();
    try {
      await packingListGate;
      await route.continue();
    } finally {
      signalRouteFinished();
    }
  };

  await page.route(packingListPattern, delayPackingList);
  await page.goto(`/orders/ukraine/all/edit/${order.orderNetId}/product-income`);

  try {
    await requestStarted;
    await expect(page.getByTestId('income-add-column')).toHaveCount(0);
  } finally {
    releasePackingList();
    await routeFinished;
    await page.unroute(packingListPattern, delayPackingList);
  }

  await expect(page.getByTestId('income-add-column')).toBeVisible({ timeout: 20_000 });
});

for (const supplier of TEST_INCOME_SUPPLIERS) {
  const tag = supplier.key === 'AYMEKS' ? ' @smoke' : '';

  test(`прихід ${supplier.key}: оприходування + консигнація${tag}`, async ({ page, db, entities }) => {
    // Placement deliberately exercises one UI drawer + persisted row per invoice line.
    // Large real invoices (FSS/REMI MAY contain 100+ lines) cannot fit the global
    // two-minute default even when every request succeeds, so scale only this scenario.
    test.setTimeout(180_000 + supplier.rows * 4_000);

    const order = entities.require<CreatedOrderRef>(
      `income.${supplier.key}.order`,
      'спочатку має пройти 10-order-invoice',
    );
    const invoice = entities.require<CreatedInvoiceRef>(
      `income.${supplier.key}.invoice`,
      'спочатку має пройти 10-order-invoice',
    );

    await postIncome(page, order.orderNetId);

    const incomeScope = `
      FROM dbo.ProductIncomeItem pii
      JOIN dbo.ProductIncome pi ON pi.ID = pii.ProductIncomeID
      JOIN dbo.PackingListPackageOrderItem pli ON pli.ID = pii.PackingListPackageOrderItemID
      JOIN dbo.PackingList pl ON pl.ID = pli.PackingListID
      JOIN dbo.SupplyInvoice si ON si.ID = pl.SupplyInvoiceID
      WHERE si.Number = @number AND si.Deleted = 0 AND pl.Deleted = 0
        AND pli.Deleted = 0 AND pii.Deleted = 0 AND pi.Deleted = 0`;

    const income = await db.query<{ cnt: number; qty: number; incomes: number }>(
      `SELECT COUNT(*) AS cnt, COALESCE(SUM(pii.Qty), 0) AS qty, COUNT(DISTINCT pi.ID) AS incomes ${incomeScope}`,
      { number: invoice.invoiceNumber },
    );
    expect(income[0].incomes, 'рівно один прихід на інвойс').toBe(1);
    expect(income[0].cnt, 'позиції приходу == рядки інвойса').toBe(supplier.rows);
    expect(income[0].qty, 'Qty приходу == Qty інвойса').toBe(supplier.qty);

    const outbox = await db.poll<{ pending: number; total: number }>(
      `SELECT SUM(CASE WHEN o.CompletedAt IS NULL THEN 1 ELSE 0 END) AS pending, COUNT(*) AS total
       FROM dbo.ProductIncomeConsignmentOutbox o
       WHERE o.ProductIncomeID IN (SELECT DISTINCT pi.ID ${incomeScope})`,
      (rows) => rows[0].total > 0 && rows[0].pending === 0,
      { timeoutMs: 120_000, label: `outbox ${supplier.key}` },
      { number: invoice.invoiceNumber },
    );
    expect(outbox[0].pending, 'outbox опрацьований').toBe(0);

    const consignment = await db.poll<{ consignments: number; items: number; qty: number; distinctRates: number; positiveCost: number }>(
      `SELECT COUNT(DISTINCT c.ID) AS consignments,
              COUNT(ci.ID) AS items,
              COALESCE(SUM(ci.Qty), 0) AS qty,
              COUNT(DISTINCT ci.ExchangeRate) AS distinctRates,
              SUM(CASE WHEN ci.Price > 0 THEN 1 ELSE 0 END) AS positiveCost
       FROM dbo.Consignment c
       JOIN dbo.ConsignmentItem ci ON ci.ConsignmentID = c.ID AND ci.Deleted = 0
       WHERE c.Deleted = 0 AND c.ProductIncomeID IN (SELECT DISTINCT pi.ID ${incomeScope})`,
      (rows) => rows[0].items >= supplier.rows,
      { timeoutMs: 120_000, label: `consignment ${supplier.key}` },
      { number: invoice.invoiceNumber },
    );
    expect(consignment[0].consignments, 'консигнація створена (fire-and-forget не загубився)').toBeGreaterThanOrEqual(1);
    expect(consignment[0].items, 'партії == позиції приходу').toBe(supplier.rows);
    expect(consignment[0].qty, 'Qty партій == Qty інвойса').toBe(supplier.qty);
    // Consignment cost is stored in the accounting base currency (ExchangeRate=1 post-conversion),
    // not the customs NBU rate. Assert every partія shares ONE rate and carries a positive cost.
    expect(consignment[0].distinctRates, 'усі партії мають один курс').toBe(1);
    expect(consignment[0].positiveCost, 'кожна партія має додатну собівартість').toBe(supplier.rows);

    const twin = await db.query<{ duplicated: number }>(
      `SELECT COUNT(*) AS duplicated FROM (
         SELECT c.ProductIncomeID
         FROM dbo.Consignment c
         WHERE c.Deleted = 0 AND c.ProductIncomeID IN (SELECT DISTINCT pi.ID ${incomeScope})
         GROUP BY c.ProductIncomeID
         HAVING COUNT(*) > 1
       ) d`,
      { number: invoice.invoiceNumber },
    );
    expect(twin[0].duplicated, 'рівно одна активна консигнація на прихід').toBe(0);

    const placement = await db.query<{ placedQty: number }>(
      `SELECT COALESCE(SUM(pli.PlacedQty), 0) AS placedQty
       FROM dbo.PackingListPackageOrderItem pli
       JOIN dbo.PackingList pl ON pl.ID = pli.PackingListID
       JOIN dbo.SupplyInvoice si ON si.ID = pl.SupplyInvoiceID
       WHERE si.Number = @number AND si.Deleted = 0 AND pl.Deleted = 0 AND pli.Deleted = 0`,
      { number: invoice.invoiceNumber },
    );
    entities.record(`income.${supplier.key}.placedQty`, placement[0].placedQty);
  });
}
