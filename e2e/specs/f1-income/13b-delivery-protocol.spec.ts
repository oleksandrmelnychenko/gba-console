import { TEST_INCOME_SUPPLIERS } from '../../data/testIncome';
import { expect, test } from '../../fixtures/test';
import {
  createArrivedDeliveryProtocol,
  type CreatedInvoiceRef,
  type CreatedOrderRef,
} from '../../flows/income';

test.describe.configure({ mode: 'serial' });

for (const supplier of TEST_INCOME_SUPPLIERS) {
  const tag = supplier.key === 'AYMEKS' ? ' @smoke' : '';

  test(`прихід ${supplier.key}: протокол доставки привʼязує інвойс і прибув${tag}`, async ({ page, db, entities }) => {
    const order = entities.require<CreatedOrderRef>(
      `income.${supplier.key}.order`,
      'спочатку має пройти 10-order-invoice',
    );
    const invoice = entities.require<CreatedInvoiceRef>(
      `income.${supplier.key}.invoice`,
      'спочатку має пройти 10-order-invoice',
    );

    const protocol = await createArrivedDeliveryProtocol(page, order, invoice);
    const rows = await db.query<{ linked: number; arrived: boolean }>(
      `SELECT COUNT(*) AS linked,
              CONVERT(bit, MIN(CONVERT(int, protocol.IsCompleted))) AS arrived
       FROM dbo.SupplyInvoice supplyInvoice
       JOIN dbo.DeliveryProductProtocol protocol
         ON protocol.ID = supplyInvoice.DeliveryProductProtocolID
        AND protocol.Deleted = 0
       WHERE supplyInvoice.NetUID = @invoiceNetId
         AND supplyInvoice.Deleted = 0
         AND protocol.NetUID = @protocolNetId`,
      { invoiceNetId: invoice.invoiceNetId, protocolNetId: protocol.protocolNetId },
    );
    expect(rows[0].linked, 'інвойс привʼязано до одного протоколу').toBe(1);
    expect(Boolean(rows[0].arrived), 'протокол має статус «Прибув»').toBe(true);
    entities.record(`income.${supplier.key}.deliveryProtocol`, protocol);
  });
}
