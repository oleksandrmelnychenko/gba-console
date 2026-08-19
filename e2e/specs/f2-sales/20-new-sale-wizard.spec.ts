import { expect, test } from '../../fixtures/test';
import { createSaleViaWizard } from '../../flows/sales';

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
  ClientID: number;
  LifeCycleType: number;
  MovementCount: number;
  SaleID: number;
  SaleNetUid: string;
  TargetLines: number;
  TargetQty: number;
  TotalLines: number;
}

test('продаж: візард створює точну накладну для вибраного клієнта @smoke', async ({ page, db, entities }) => {
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

  const rows = await db.poll<CreatedSaleProjection>(
    `SELECT
       s.ID AS SaleID,
       LOWER(CONVERT(varchar(36), s.NetUID)) AS SaleNetUid,
       ca.ID AS AgreementID,
       ca.ClientID,
       status.SaleLifeCycleType AS LifeCycleType,
       COUNT(DISTINCT movement.ID) AS MovementCount,
       COUNT(oi.ID) AS TotalLines,
       SUM(CASE WHEN oi.ProductID = @productId THEN 1 ELSE 0 END) AS TargetLines,
       COALESCE(SUM(CASE WHEN oi.ProductID = @productId THEN oi.Qty ELSE 0 END), 0) AS TargetQty
     FROM dbo.Sale s
     JOIN dbo.[Order] o ON o.ID = s.OrderID AND o.Deleted = 0
     JOIN dbo.ClientAgreement ca ON ca.ID = o.ClientAgreementID AND ca.Deleted = 0
     JOIN dbo.BaseLifeCycleStatus status ON status.ID = s.BaseLifeCycleStatusID
     LEFT JOIN dbo.OrderItem oi ON oi.OrderID = o.ID AND oi.Deleted = 0
     LEFT JOIN dbo.ConsignmentItemMovement movement ON movement.OrderItemID = oi.ID AND movement.Deleted = 0
     WHERE s.Deleted = 0 AND s.NetUID = @saleNetId
     GROUP BY s.ID, s.NetUID, ca.ID, ca.ClientID, status.SaleLifeCycleType`,
    (result) => result.length === 1,
    { timeoutMs: 30_000, label: 'exact created sale projection' },
    { productId: candidate.ProductID, saleNetId: created.saleNetId },
  );
  const sale = rows[0];

  expect(sale.SaleNetUid).toBe(created.saleNetId);
  expect(sale.ClientID).toBe(candidate.ClientID);
  expect(sale.AgreementID).toBe(candidate.AgreementID);
  expect(sale.LifeCycleType, 'ПДВ-гілка створює видаткову накладну').toBe(1);
  expect(sale.MovementCount, 'стік списується на пізнішому lifecycle, а не при створенні').toBe(0);
  expect(sale.TotalLines).toBe(1);
  expect(sale.TargetLines).toBe(1);
  expect(sale.TargetQty).toBe(SALE_QTY);

  entities.record('sale.smoke', {
    saleId: sale.SaleID,
    saleNetId: sale.SaleNetUid,
    agreementId: sale.AgreementID,
    clientId: sale.ClientID,
    productId: candidate.ProductID,
    vendorCode: candidate.VendorCode,
    qty: SALE_QTY,
  });
});
