import { expect, test } from '../../fixtures/test';
import { acceptSaleForPackingViaList, createSaleViaWizard } from '../../flows/sales';

test.describe.configure({ mode: 'serial' });

const SALE_QTY = 2;

interface SaleCandidate {
  AgreementID: number;
  AgreementNetUid: string;
  ClientID: number;
  ClientName: string;
  ClientNetUid: string;
  ProductID: number;
  VendorCode: string;
}

interface CreatedSaleProjection {
  AgreementID: number;
  ChangedToInvoice: string | null;
  ClientID: number;
  DispatchedOutboxCount: number;
  FailedOutboxCount: number;
  IsAcceptedToPacking: boolean;
  LastOutboxError: string | null;
  LifeCycleType: number;
  MovementCount: number;
  MovementQty: number;
  OutboxCount: number;
  PaymentFinalizeCompleted: number;
  ReceiptCount: number;
  SaleID: number;
  SaleNetUid: string;
  SaleNumber: string;
  TargetLines: number;
  TargetQty: number;
  TotalLines: number;
}

test('продаж: візард створює точну накладну для вибраного клієнта @smoke', async ({ page, db, entities }) => {
  test.setTimeout(300_000);

  const candidates = await db.query<SaleCandidate>(
    `SELECT TOP 1
       ca.ID AS AgreementID,
       LOWER(CONVERT(varchar(36), ca.NetUID)) AS AgreementNetUid,
       c.ID AS ClientID,
       c.FullName AS ClientName,
       LOWER(CONVERT(varchar(36), c.NetUID)) AS ClientNetUid,
       p.ID AS ProductID,
       p.VendorCode
     FROM dbo.Sale s
     JOIN dbo.[Order] o ON o.ID = s.OrderID AND o.Deleted = 0
     JOIN dbo.ClientAgreement ca ON ca.ID = o.ClientAgreementID AND ca.Deleted = 0
     JOIN dbo.Agreement agreement ON agreement.ID = ca.AgreementID AND agreement.Deleted = 0
     JOIN dbo.Client c ON c.ID = ca.ClientID AND c.Deleted = 0
     JOIN dbo.OrderItem oi ON oi.OrderID = o.ID AND oi.Deleted = 0
     JOIN dbo.Product p ON p.ID = oi.ProductID AND p.Deleted = 0
     WHERE s.Deleted = 0
       AND agreement.WithVATAccounting = 1
       AND c.FullName IS NOT NULL AND LEN(c.FullName) BETWEEN 4 AND 80
       AND p.VendorCode IS NOT NULL AND LEN(p.VendorCode) BETWEEN 5 AND 18
       AND (SELECT COUNT(*) FROM dbo.ClientAgreement candidateAgreement
            WHERE candidateAgreement.ClientID = c.ID AND candidateAgreement.Deleted = 0) = 1
       AND NOT EXISTS (
         SELECT 1
         FROM dbo.Sale openSale
         JOIN dbo.BaseLifeCycleStatus openStatus ON openStatus.ID = openSale.BaseLifeCycleStatusID
         WHERE openSale.ClientAgreementID = ca.ID
           AND openSale.Deleted = 0
           AND openSale.IsMerged = 0
           AND openStatus.SaleLifeCycleType = 0
           AND openSale.Updated >= CONVERT(date, GETDATE()))
       AND (SELECT COALESCE(SUM(ci.RemainingQty), 0)
            FROM dbo.ConsignmentItem ci
            JOIN dbo.Consignment cn ON cn.ID = ci.ConsignmentID AND cn.Deleted = 0
            WHERE ci.Deleted = 0 AND ci.ProductID = p.ID) > @qty
     ORDER BY s.ID DESC`,
    { qty: SALE_QTY },
  );
  expect(candidates, 'однозначна пара клієнт+договір+товар зі стоком знайдена').toHaveLength(1);
  const candidate = candidates[0];

  const created = await createSaleViaWizard(page, {
    agreementNetUid: candidate.AgreementNetUid,
    clientName: candidate.ClientName,
    clientNetUid: candidate.ClientNetUid,
    vendorCode: candidate.VendorCode,
    qty: SALE_QTY,
  });
  expect(created.availabilityAfter, 'BUG-1130: список показує залишок після кошика').toBe(
    created.availabilityBefore - SALE_QTY,
  );

  const rows = await db.poll<CreatedSaleProjection>(
    `SELECT
       s.ID AS SaleID,
       LOWER(CONVERT(varchar(36), s.NetUID)) AS SaleNetUid,
       ca.ID AS AgreementID,
       ca.ClientID,
       s.ChangedToInvoice,
       s.IsAcceptedToPacking,
       status.SaleLifeCycleType AS LifeCycleType,
       saleNumber.Value AS SaleNumber,
       (SELECT COUNT(*) FROM dbo.SalesMutationOperation operation
        WHERE operation.SaleID = s.ID
          AND operation.SaleNetUid = s.NetUID
          AND operation.OperationKind = N'sale:finalize-payment-documents'
          AND operation.IsCompleted = 1) AS PaymentFinalizeCompleted,
       (SELECT COUNT(*) FROM dbo.SalesDurableEffectOutbox outbox
        WHERE outbox.SaleID = s.ID
          AND outbox.EffectType = N'sale:consignment-movement') AS OutboxCount,
       (SELECT COUNT(*) FROM dbo.SalesDurableEffectOutbox outbox
        WHERE outbox.SaleID = s.ID
          AND outbox.EffectType = N'sale:consignment-movement'
          AND outbox.DispatchedAt IS NOT NULL) AS DispatchedOutboxCount,
       (SELECT COUNT(*) FROM dbo.SalesDurableEffectOutbox outbox
        WHERE outbox.SaleID = s.ID
          AND outbox.EffectType = N'sale:consignment-movement'
          AND (outbox.DispatchedAt IS NULL OR outbox.LastError IS NOT NULL)) AS FailedOutboxCount,
       (SELECT TOP 1 outbox.LastError FROM dbo.SalesDurableEffectOutbox outbox
        WHERE outbox.SaleID = s.ID
          AND outbox.EffectType = N'sale:consignment-movement'
        ORDER BY outbox.ID DESC) AS LastOutboxError,
       (SELECT COUNT(*)
        FROM dbo.SalesDurableEffectReceipt receipt
        JOIN dbo.SalesDurableEffectOutbox outbox
          ON outbox.EventNetUid = receipt.EventNetUid
        WHERE outbox.SaleID = s.ID
          AND outbox.EffectType = N'sale:consignment-movement'
          AND receipt.ConsumerName = N'sales-consignment-movement') AS ReceiptCount,
       (SELECT COUNT(*)
        FROM dbo.ConsignmentItemMovement movement
        JOIN dbo.OrderItem movementItem
          ON movementItem.ID = movement.OrderItemID
         AND movementItem.OrderID = o.ID
         AND movementItem.ProductID = @productId
         AND movementItem.Deleted = 0
        WHERE movement.Deleted = 0
          AND movement.MovementType = 0
          AND movement.IsIncomeMovement = 0) AS MovementCount,
       (SELECT COALESCE(SUM(movement.Qty), 0)
        FROM dbo.ConsignmentItemMovement movement
        JOIN dbo.OrderItem movementItem
          ON movementItem.ID = movement.OrderItemID
         AND movementItem.OrderID = o.ID
         AND movementItem.ProductID = @productId
         AND movementItem.Deleted = 0
        WHERE movement.Deleted = 0
          AND movement.MovementType = 0
          AND movement.IsIncomeMovement = 0) AS MovementQty,
       (SELECT COUNT(*) FROM dbo.OrderItem item
        WHERE item.OrderID = o.ID AND item.Deleted = 0) AS TotalLines,
       (SELECT COUNT(*) FROM dbo.OrderItem item
        WHERE item.OrderID = o.ID AND item.ProductID = @productId AND item.Deleted = 0) AS TargetLines,
       (SELECT COALESCE(SUM(item.Qty), 0) FROM dbo.OrderItem item
        WHERE item.OrderID = o.ID AND item.ProductID = @productId AND item.Deleted = 0) AS TargetQty
     FROM dbo.Sale s
     JOIN dbo.[Order] o ON o.ID = s.OrderID AND o.Deleted = 0
     JOIN dbo.ClientAgreement ca ON ca.ID = o.ClientAgreementID AND ca.Deleted = 0
     JOIN dbo.BaseLifeCycleStatus status ON status.ID = s.BaseLifeCycleStatusID
     JOIN dbo.SaleNumber saleNumber ON saleNumber.ID = s.SaleNumberID
     WHERE s.Deleted = 0 AND s.NetUID = @saleNetId
     `,
    (result) => result.length === 1 && Boolean(result[0].ChangedToInvoice) &&
      result[0].LifeCycleType === 1 && result[0].PaymentFinalizeCompleted === 1,
    { timeoutMs: 30_000, label: 'exact created sale projection' },
    { productId: candidate.ProductID, saleNetId: created.saleNetId },
  );
  const sale = rows[0];

  expect(sale.SaleNetUid).toBe(created.saleNetId);
  expect(sale.ClientID).toBe(candidate.ClientID);
  expect(sale.AgreementID).toBe(candidate.AgreementID);
  expect(sale.LifeCycleType, 'ПДВ-гілка створює видаткову накладну').toBe(1);
  expect(sale.ChangedToInvoice).toBeTruthy();
  expect(sale.IsAcceptedToPacking).toBe(false);
  expect(sale.MovementCount, 'стік списується на пізнішому lifecycle, а не при створенні').toBe(0);
  expect(sale.TotalLines).toBe(1);
  expect(sale.TargetLines).toBe(1);
  expect(sale.TargetQty).toBe(SALE_QTY);

  await acceptSaleForPackingViaList(page, {
    saleNetId: sale.SaleNetUid,
    saleNumber: sale.SaleNumber,
  });

  const acceptedRows = await db.poll<CreatedSaleProjection>(
    `SELECT
       s.ID AS SaleID,
       LOWER(CONVERT(varchar(36), s.NetUID)) AS SaleNetUid,
       ca.ID AS AgreementID,
       ca.ClientID,
       s.ChangedToInvoice,
       s.IsAcceptedToPacking,
       status.SaleLifeCycleType AS LifeCycleType,
       saleNumber.Value AS SaleNumber,
       (SELECT COUNT(*) FROM dbo.SalesMutationOperation operation
        WHERE operation.SaleID = s.ID
          AND operation.SaleNetUid = s.NetUID
          AND operation.OperationKind = N'sale:finalize-payment-documents'
          AND operation.IsCompleted = 1) AS PaymentFinalizeCompleted,
       (SELECT COUNT(*) FROM dbo.SalesDurableEffectOutbox outbox
        WHERE outbox.SaleID = s.ID
          AND outbox.EffectType = N'sale:consignment-movement') AS OutboxCount,
       (SELECT COUNT(*) FROM dbo.SalesDurableEffectOutbox outbox
        WHERE outbox.SaleID = s.ID
          AND outbox.EffectType = N'sale:consignment-movement'
          AND outbox.DispatchedAt IS NOT NULL) AS DispatchedOutboxCount,
       (SELECT COUNT(*) FROM dbo.SalesDurableEffectOutbox outbox
        WHERE outbox.SaleID = s.ID
          AND outbox.EffectType = N'sale:consignment-movement'
          AND (outbox.DispatchedAt IS NULL OR outbox.LastError IS NOT NULL)) AS FailedOutboxCount,
       (SELECT TOP 1 outbox.LastError FROM dbo.SalesDurableEffectOutbox outbox
        WHERE outbox.SaleID = s.ID
          AND outbox.EffectType = N'sale:consignment-movement'
        ORDER BY outbox.ID DESC) AS LastOutboxError,
       (SELECT COUNT(*)
        FROM dbo.SalesDurableEffectReceipt receipt
        JOIN dbo.SalesDurableEffectOutbox outbox
          ON outbox.EventNetUid = receipt.EventNetUid
        WHERE outbox.SaleID = s.ID
          AND outbox.EffectType = N'sale:consignment-movement'
          AND receipt.ConsumerName = N'sales-consignment-movement') AS ReceiptCount,
       (SELECT COUNT(*)
        FROM dbo.ConsignmentItemMovement movement
        JOIN dbo.OrderItem movementItem
          ON movementItem.ID = movement.OrderItemID
         AND movementItem.OrderID = o.ID
         AND movementItem.ProductID = @productId
         AND movementItem.Deleted = 0
        WHERE movement.Deleted = 0
          AND movement.MovementType = 0
          AND movement.IsIncomeMovement = 0) AS MovementCount,
       (SELECT COALESCE(SUM(movement.Qty), 0)
        FROM dbo.ConsignmentItemMovement movement
        JOIN dbo.OrderItem movementItem
          ON movementItem.ID = movement.OrderItemID
         AND movementItem.OrderID = o.ID
         AND movementItem.ProductID = @productId
         AND movementItem.Deleted = 0
        WHERE movement.Deleted = 0
          AND movement.MovementType = 0
          AND movement.IsIncomeMovement = 0) AS MovementQty,
       (SELECT COUNT(*) FROM dbo.OrderItem item
        WHERE item.OrderID = o.ID AND item.Deleted = 0) AS TotalLines,
       (SELECT COUNT(*) FROM dbo.OrderItem item
        WHERE item.OrderID = o.ID AND item.ProductID = @productId AND item.Deleted = 0) AS TargetLines,
       (SELECT COALESCE(SUM(item.Qty), 0) FROM dbo.OrderItem item
        WHERE item.OrderID = o.ID AND item.ProductID = @productId AND item.Deleted = 0) AS TargetQty
     FROM dbo.Sale s
     JOIN dbo.[Order] o ON o.ID = s.OrderID AND o.Deleted = 0
     JOIN dbo.ClientAgreement ca ON ca.ID = o.ClientAgreementID AND ca.Deleted = 0
     JOIN dbo.BaseLifeCycleStatus status ON status.ID = s.BaseLifeCycleStatusID
     JOIN dbo.SaleNumber saleNumber ON saleNumber.ID = s.SaleNumberID
     WHERE s.Deleted = 0 AND s.NetUID = @saleNetId
     `,
    (result) => result.length === 1 && result[0].IsAcceptedToPacking &&
      result[0].OutboxCount === 1 && result[0].DispatchedOutboxCount === 1 &&
      result[0].FailedOutboxCount === 0 && result[0].ReceiptCount === 1 &&
      result[0].MovementCount > 0 && result[0].MovementQty === SALE_QTY,
    { timeoutMs: 120_000, label: 'accepted sale durable consignment movement' },
    { productId: candidate.ProductID, saleNetId: sale.SaleNetUid },
  );
  const acceptedSale = acceptedRows[0];
  expect(acceptedSale.IsAcceptedToPacking).toBe(true);
  expect(acceptedSale.OutboxCount).toBe(1);
  expect(acceptedSale.DispatchedOutboxCount).toBe(1);
  expect(acceptedSale.FailedOutboxCount).toBe(0);
  expect(acceptedSale.LastOutboxError).toBeNull();
  expect(acceptedSale.ReceiptCount).toBe(1);
  expect(acceptedSale.MovementCount).toBe(1);
  expect(acceptedSale.MovementQty).toBe(SALE_QTY);

  entities.record('sale.smoke', {
    saleId: acceptedSale.SaleID,
    saleNetId: acceptedSale.SaleNetUid,
    saleNumber: acceptedSale.SaleNumber,
    agreementId: acceptedSale.AgreementID,
    clientId: acceptedSale.ClientID,
    productId: candidate.ProductID,
    vendorCode: candidate.VendorCode,
    qty: SALE_QTY,
  });
});
