import { BUG_1141_SAMPIYON } from '../../data/bug1141Sampiyon';
import { expect, test } from '../../fixtures/test';
import {
  addInvoiceFromCcd,
  addPackingListFromCcd,
  createArrivedDeliveryProtocol,
  createDirectOrderFromCcd,
  createProForma,
  createProFormaPaymentTask,
  markDeliveryProtocolArrived,
  postIncome,
  uploadCustomsCodes,
} from '../../flows/income';
import { createBug1141SampiyonWorkbook } from '../../helpers/bug1141SampiyonWorkbook';

test('BUG-1141: три SAMPIYON JSON-сценарії проходять одним наскрізним маршрутом', async ({ page, db, entities }) => {
  test.setTimeout(600_000);
  const workbook = createBug1141SampiyonWorkbook();
  const supplier = BUG_1141_SAMPIYON;
  const invoiceNumber = `222222-${entities.runId}`;

  try {
    const order = await createDirectOrderFromCcd(page, supplier, entities.runId, {
      filePath: workbook.filePath,
      parse: { startRow: 5, endRow: 20 },
    });

    const importedOrder = await db.query<{ amount: number; qty: number; rows: number }>(
      `SELECT COUNT(item.ID) AS rows,
              COALESCE(SUM(item.Qty), 0) AS qty,
              COALESCE(SUM(item.Qty * item.UnitPrice), 0) AS amount
       FROM dbo.SupplyOrder supplyOrder
       JOIN dbo.SupplyOrderItem item ON item.SupplyOrderID = supplyOrder.ID AND item.Deleted = 0
       WHERE supplyOrder.NetUID = @orderNetId AND supplyOrder.Deleted = 0`,
      { orderNetId: order.orderNetId },
    );
    expect(importedOrder[0].rows, 'order rows 5–20').toBe(16);
    expect(importedOrder[0].qty, 'order Qty').toBe(463);
    expect(Math.abs(importedOrder[0].amount - 7720.69), 'order amount').toBeLessThanOrEqual(0.011);

    await createProForma(page, supplier, entities.runId, order.orderNetId, { filePath: workbook.filePath });
    await createProFormaPaymentTask(page, order.orderNetId, 50, 'Самолюк Алла');

    const payment = await db.query<{
      discount: number;
      isAccounting: boolean;
      proFormAmount: number;
      responsible: string;
      tasks: number;
      value: number;
    }>(
      `SELECT COUNT(*) AS tasks,
              MIN(protocol.Value) AS value,
              MIN(protocol.Discount) AS discount,
              MIN(proForm.NetPrice) AS proFormAmount,
              CONVERT(bit, MIN(CONVERT(int, task.IsAccounting))) AS isAccounting,
              MIN(CONCAT(paymentUser.LastName, N' ', paymentUser.FirstName)) AS responsible
       FROM dbo.SupplyOrder supplyOrder
       JOIN dbo.SupplyProForm proForm ON proForm.ID = supplyOrder.SupplyProFormID AND proForm.Deleted = 0
       JOIN dbo.SupplyOrderPaymentDeliveryProtocol protocol
         ON protocol.SupplyProFormID = proForm.ID AND protocol.Deleted = 0
       JOIN dbo.SupplyPaymentTask task ON task.ID = protocol.SupplyPaymentTaskID AND task.Deleted = 0
       LEFT JOIN dbo.[User] paymentUser ON paymentUser.ID = task.UserID
       WHERE supplyOrder.NetUID = @orderNetId AND supplyOrder.Deleted = 0`,
      { orderNetId: order.orderNetId },
    );
    expect(payment[0].tasks, 'one active proforma payment task').toBe(1);
    expect(payment[0].discount, 'payment percent').toBe(50);
    expect(Math.abs(payment[0].value - payment[0].proFormAmount * 0.5), '50% of proforma').toBeLessThanOrEqual(0.011);
    expect(Boolean(payment[0].isAccounting), 'accounting payment task').toBe(true);
    expect(payment[0].responsible, 'responsible user').toBe('Самолюк Алла');

    const invoice = await addInvoiceFromCcd(page, supplier, entities.runId, order.orderNetId, {
      filePath: workbook.filePath,
      number: invoiceNumber,
    });
    const invoiceRows = await db.query<{ amount: number; qty: number; rows: number }>(
      `SELECT COUNT(item.ID) AS rows,
              COALESCE(SUM(item.Qty), 0) AS qty,
              COALESCE(SUM(COALESCE(item.SourceTotalNetPrice, item.Qty * item.UnitPrice)), 0) AS amount
       FROM dbo.SupplyInvoice invoice
       JOIN dbo.SupplyInvoiceOrderItem item ON item.SupplyInvoiceID = invoice.ID AND item.Deleted = 0
       WHERE invoice.NetUID = @invoiceNetId AND invoice.Deleted = 0`,
      { invoiceNetId: invoice.invoiceNetId },
    );
    expect(invoiceRows[0].rows, 'invoice rows 4–21').toBe(18);
    expect(invoiceRows[0].qty, 'invoice Qty').toBe(502);
    expect(Math.abs(invoiceRows[0].amount - 8292.61), 'invoice amount').toBeLessThanOrEqual(0.011);

    await addPackingListFromCcd(page, supplier, order.orderNetId, invoiceNumber, {
      filePath: workbook.filePath,
      number: `2222-${entities.runId}`,
      parse: { startRow: 4, endRow: 10 },
    });
    await addPackingListFromCcd(page, supplier, order.orderNetId, invoiceNumber, {
      filePath: workbook.filePath,
      number: `3333-${entities.runId}`,
      parse: { startRow: 11, endRow: 21 },
    });

    const packing = await db.query<{ listCount: number; qty: number; rows: number }>(
      `SELECT COUNT(DISTINCT packingList.ID) AS listCount,
              COUNT(item.ID) AS rows,
              COALESCE(SUM(item.Qty), 0) AS qty
       FROM dbo.PackingList packingList
       JOIN dbo.PackingListPackageOrderItem item ON item.PackingListID = packingList.ID AND item.Deleted = 0
       JOIN dbo.SupplyInvoice invoice ON invoice.ID = packingList.SupplyInvoiceID
       WHERE invoice.NetUID = @invoiceNetId AND invoice.Deleted = 0 AND packingList.Deleted = 0`,
      { invoiceNetId: invoice.invoiceNetId },
    );
    expect(packing[0].listCount, 'two physical packing lists').toBe(2);
    expect(packing[0].rows, 'packing rows 7 + 11').toBe(18);
    expect(packing[0].qty, 'packing Qty 75 + 427').toBe(502);

    const protocol = await createArrivedDeliveryProtocol(page, order, invoice, ['В дорозі']);
    await uploadCustomsCodes(page, supplier, order.orderNetId, {
      filePath: workbook.filePath,
      parse: { startRow: 4, endRow: 24 },
    });
    await markDeliveryProtocolArrived(page, protocol.protocolNetId);

    const customs = await db.query<{ coveredLines: number; realSpecs: number }>(
      `SELECT COUNT(DISTINCT specificationLink.SupplyInvoiceOrderItemID) AS coveredLines,
              SUM(CASE WHEN specification.CustomsValue > 0 THEN 1 ELSE 0 END) AS realSpecs
       FROM dbo.OrderProductSpecification specificationLink
       JOIN dbo.ProductSpecification specification ON specification.ID = specificationLink.ProductSpecificationId
       JOIN dbo.SupplyInvoice invoice ON invoice.ID = specificationLink.SupplyInvoiceId
       WHERE invoice.NetUID = @invoiceNetId AND invoice.Deleted = 0
         AND specificationLink.Deleted = 0 AND specification.Deleted = 0`,
      { invoiceNetId: invoice.invoiceNetId },
    );
    expect(customs[0].coveredLines, 'one customs link per invoice row').toBe(18);
    expect(customs[0].realSpecs, 'one real customs specification per invoice row').toBe(18);

    const arrived = await db.query<{ arrived: boolean; linked: number }>(
      `SELECT COUNT(*) AS linked, CONVERT(bit, MIN(CONVERT(int, protocol.IsCompleted))) AS arrived
       FROM dbo.SupplyInvoice invoice
       JOIN dbo.DeliveryProductProtocol protocol ON protocol.ID = invoice.DeliveryProductProtocolID
       WHERE invoice.NetUID = @invoiceNetId AND invoice.Deleted = 0 AND protocol.Deleted = 0`,
      { invoiceNetId: invoice.invoiceNetId },
    );
    expect(arrived[0].linked, 'invoice linked to delivery protocol').toBe(1);
    expect(Boolean(arrived[0].arrived), 'delivery protocol arrived').toBe(true);

    await postIncome(page, order.orderNetId);

    const incomeScope = `
      FROM dbo.ProductIncomeItem incomeItem
      JOIN dbo.ProductIncome income ON income.ID = incomeItem.ProductIncomeID
      JOIN dbo.PackingListPackageOrderItem packingItem ON packingItem.ID = incomeItem.PackingListPackageOrderItemID
      JOIN dbo.PackingList packingList ON packingList.ID = packingItem.PackingListID
      JOIN dbo.SupplyInvoice invoice ON invoice.ID = packingList.SupplyInvoiceID
      WHERE invoice.NetUID = @invoiceNetId AND invoice.Deleted = 0 AND packingList.Deleted = 0
        AND packingItem.Deleted = 0 AND incomeItem.Deleted = 0 AND income.Deleted = 0`;
    const income = await db.query<{ incomes: number; qty: number; rows: number }>(
      `SELECT COUNT(DISTINCT income.ID) AS incomes,
              COUNT(incomeItem.ID) AS rows,
              COALESCE(SUM(incomeItem.Qty), 0) AS qty ${incomeScope}`,
      { invoiceNetId: invoice.invoiceNetId },
    );
    expect(income[0].incomes, 'one product income').toBe(1);
    expect(income[0].rows, 'income items').toBe(18);
    expect(income[0].qty, 'income Qty').toBe(502);

    const outbox = await db.poll<{ pending: number; total: number }>(
      `SELECT SUM(CASE WHEN outbox.CompletedAt IS NULL THEN 1 ELSE 0 END) AS pending, COUNT(*) AS total
       FROM dbo.ProductIncomeConsignmentOutbox outbox
       WHERE outbox.ProductIncomeID IN (SELECT DISTINCT income.ID ${incomeScope})`,
      (rows) => rows[0].total > 0 && rows[0].pending === 0,
      { timeoutMs: 120_000, label: 'BUG-1141 consignment outbox' },
      { invoiceNetId: invoice.invoiceNetId },
    );
    expect(outbox[0].pending, 'consignment outbox completed').toBe(0);

    const consignments = await db.poll<{ consignments: number; items: number; qty: number }>(
      `SELECT COUNT(DISTINCT consignment.ID) AS consignments,
              COUNT(consignmentItem.ID) AS items,
              COALESCE(SUM(consignmentItem.Qty), 0) AS qty
       FROM dbo.Consignment consignment
       JOIN dbo.ConsignmentItem consignmentItem ON consignmentItem.ConsignmentID = consignment.ID AND consignmentItem.Deleted = 0
       WHERE consignment.Deleted = 0
         AND consignment.ProductIncomeID IN (SELECT DISTINCT income.ID ${incomeScope})`,
      (rows) => rows[0].items >= 18,
      { timeoutMs: 120_000, label: 'BUG-1141 consignments' },
      { invoiceNetId: invoice.invoiceNetId },
    );
    expect(consignments[0].consignments, 'no consignment twin').toBe(1);
    expect(consignments[0].items, 'one consignment item per invoice row').toBe(18);
    expect(consignments[0].qty, 'consignment Qty').toBe(502);
  } finally {
    workbook.cleanup();
  }
});
