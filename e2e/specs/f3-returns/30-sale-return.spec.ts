import { expect, test } from '../../fixtures/test';
import { createClientReturn } from '../../flows/returns';

test.describe.configure({ mode: 'serial' });

const RETURN_QTY = 1;
const RETURN_STATUS = 4;
const RETURN_STATUS_LABEL = 'Відмова від товару кінцевим покупцем';

interface ReturnCandidate {
  AgreementID: number;
  AvailabilityBefore: number;
  ClientID: number;
  ClientName: string;
  ClientNetUid: string;
  ClientSearchValue: string;
  ConsignmentItemID: number;
  ConsignmentItemRemainingBefore: number;
  OrderItemID: number;
  OrderItemNetUid: string;
  OrganizationID: number;
  OrganizationName: string;
  OrganizationNetUid: string;
  ProductID: number;
  ReturnedQtyBefore: number;
  SaleID: number;
  SaleNetUid: string;
  SaleNumber: string;
  SaleQty: number;
  StorageID: number;
  StorageName: string;
  StorageNetUid: string;
  VendorCode: string;
}

interface CreatedReturnProjection {
  AgreementID: number;
  ClientID: number;
  ConsignmentCount: number;
  ConsignmentItemCount: number;
  ConsignmentQty: number;
  OutboxCompleted: number;
  OutboxCount: number;
  ProductAvailabilityAmount: number;
  ProductIncomeCount: number;
  ProductIncomeItemCount: number;
  ProductIncomeQty: number;
  ProductIncomeRemainingQty: number;
  RootConsignmentItemID: number;
  ReturnedQty: number;
  ReturnMovementCount: number;
  ReturnMovementQty: number;
  ReturnItemCount: number;
  ReturnQty: number;
  ReturnStatus: number;
  SaleReturnNetUid: string;
  SourceLotRemainingQty: number;
  SourceMovementRemainingQty: number;
  StorageID: number;
}

test('повернення: точна позиція продажу повертається в той самий склад і лот @smoke', async ({ page, db, entities }) => {
  const candidates = await db.query<ReturnCandidate>(
    `SELECT TOP 1
       s.ID AS SaleID,
       LOWER(CONVERT(varchar(36), s.NetUID)) AS SaleNetUid,
       sn.Value AS SaleNumber,
       oi.ID AS OrderItemID,
       LOWER(CONVERT(varchar(36), oi.NetUID)) AS OrderItemNetUid,
       oi.Qty AS SaleQty,
       oi.ReturnedQty AS ReturnedQtyBefore,
       p.ID AS ProductID,
       p.VendorCode,
       ca.ID AS AgreementID,
       c.ID AS ClientID,
       c.FullName AS ClientName,
       LOWER(CONVERT(varchar(36), c.NetUID)) AS ClientNetUid,
       regionCode.Value AS ClientSearchValue,
       organization.ID AS OrganizationID,
       COALESCE(NULLIF(organization.FullName, N''), organization.Name) AS OrganizationName,
       LOWER(CONVERT(varchar(36), organization.NetUID)) AS OrganizationNetUid,
       sourceStorage.ID AS StorageID,
       sourceStorage.Name AS StorageName,
       LOWER(CONVERT(varchar(36), sourceStorage.NetUID)) AS StorageNetUid,
       sourceAvailability.Amount AS AvailabilityBefore,
       sourceLot.ID AS ConsignmentItemID,
       sourceLot.RemainingQty AS ConsignmentItemRemainingBefore
     FROM dbo.Sale s
     JOIN dbo.SaleNumber sn ON sn.ID = s.SaleNumberID
     JOIN dbo.[Order] o ON o.ID = s.OrderID AND o.Deleted = 0
     JOIN dbo.OrderItem oi ON oi.OrderID = o.ID AND oi.Deleted = 0
     JOIN dbo.Product p ON p.ID = oi.ProductID AND p.Deleted = 0
     JOIN dbo.ClientAgreement ca ON ca.ID = s.ClientAgreementID AND ca.Deleted = 0
     JOIN dbo.Client c ON c.ID = ca.ClientID AND c.Deleted = 0
     JOIN dbo.RegionCode regionCode
       ON regionCode.ID = c.RegionCodeID
      AND regionCode.Deleted = 0
     JOIN dbo.Agreement agreement ON agreement.ID = ca.AgreementID AND agreement.Deleted = 0
     JOIN dbo.Organization organization ON organization.ID = agreement.OrganizationID AND organization.Deleted = 0
     CROSS APPLY (
       SELECT TOP 1
         reservation.ProductAvailabilityID
       FROM dbo.ProductReservation reservation
       JOIN dbo.ProductAvailability availability
         ON availability.ID = reservation.ProductAvailabilityID
        AND availability.Deleted = 0
        AND availability.ProductID = oi.ProductID
       JOIN dbo.Storage storage
         ON storage.ID = availability.StorageID
        AND storage.Deleted = 0
        AND storage.OrganizationID = organization.ID
        AND storage.ForDefective = 0
       WHERE reservation.OrderItemID = oi.ID
         AND reservation.Deleted = 0
         AND reservation.Qty > 0
       ORDER BY reservation.ID
     ) sourceReservation
     JOIN dbo.ProductAvailability sourceAvailability
       ON sourceAvailability.ID = sourceReservation.ProductAvailabilityID
     JOIN dbo.Storage sourceStorage
       ON sourceStorage.ID = sourceAvailability.StorageID
     CROSS APPLY (
       SELECT TOP 1
         consignmentItem.ID,
         consignmentItem.RemainingQty
       FROM dbo.ConsignmentItem consignmentItem
       JOIN dbo.Consignment consignment
         ON consignment.ID = consignmentItem.ConsignmentID
        AND consignment.Deleted = 0
        AND consignment.StorageID = sourceStorage.ID
       WHERE consignmentItem.Deleted = 0
         AND consignmentItem.ProductID = oi.ProductID
         AND consignmentItem.RemainingQty >= oi.Qty
       ORDER BY consignmentItem.ID
     ) sourceLot
     WHERE s.Deleted = 0
       AND s.IsMerged = 0
       AND s.ChangedToInvoice IS NOT NULL
       AND s.Created < DATEADD(day, -1, SYSUTCDATETIME())
       AND s.Updated >= DATEADD(year, -5, SYSUTCDATETIME())
       AND ISNULL(s.Comment, N'') <> N'Ввід боргів з 1С'
       AND oi.IsFromShiftedItem = 0
       AND oi.Qty - oi.ReturnedQty >= @qty
       AND oi.PricePerItem > 0
       AND oi.ExchangeRateAmount > 0
       AND c.FullName IS NOT NULL
       AND LEN(c.FullName) BETWEEN 4 AND 80
       AND regionCode.Value IS NOT NULL
       AND LEN(regionCode.Value) BETWEEN 4 AND 20
       AND p.VendorCode IS NOT NULL
       AND LEN(p.VendorCode) BETWEEN 5 AND 18
       AND NOT EXISTS (
         SELECT 1
         FROM dbo.ConsignmentItemMovement existingSaleMovement
         WHERE existingSaleMovement.OrderItemID = oi.ID
           AND existingSaleMovement.Deleted = 0
           AND existingSaleMovement.MovementType = 0
       )
       AND NOT EXISTS (
         SELECT 1
         FROM dbo.DataSyncAccountingSourceTarget accountingTarget
         WHERE accountingTarget.TargetEntityType = N'Sale'
           AND accountingTarget.TargetEntityID = s.ID
           AND accountingTarget.IsCurrent = 1
           AND accountingTarget.IsPrimary = 1
           AND accountingTarget.OwnershipType = 1
       )
     ORDER BY s.ID DESC, oi.ID`,
    { qty: RETURN_QTY },
  );
  expect(candidates, 'одна точна проведена позиція зі складською lineage знайдена').toHaveLength(1);
  const candidate = candidates[0];

  // Shipment UI is the next domain in this suite. Until it is automated, seed only
  // its canonical persisted boundary in the isolated E2E clone: the source lot is
  // consumed and a reversible Sale movement is attached to the exact order item.
  const movementRows = await db.query<{ MovementID: number }>(
    `SET XACT_ABORT ON;
     BEGIN TRANSACTION;

     UPDATE dbo.ConsignmentItem
     SET RemainingQty = RemainingQty - @saleQty,
         Updated = SYSUTCDATETIME()
     WHERE ID = @consignmentItemId
       AND Deleted = 0
       AND ProductID = @productId
       AND RemainingQty = @remainingBefore
       AND RemainingQty >= @saleQty;

     IF @@ROWCOUNT <> 1
       THROW 51000, 'The exact E2E source lot changed before shipment setup.', 1;

     INSERT dbo.ConsignmentItemMovement
       (IsIncomeMovement, Qty, RemainingQty, MovementType,
        ConsignmentItemID, OrderItemID, Updated)
     OUTPUT INSERTED.ID AS MovementID
     VALUES
       (0, @saleQty, @saleQty, 0,
        @consignmentItemId, @orderItemId, SYSUTCDATETIME());

     COMMIT TRANSACTION;`,
    {
      consignmentItemId: candidate.ConsignmentItemID,
      orderItemId: candidate.OrderItemID,
      productId: candidate.ProductID,
      remainingBefore: candidate.ConsignmentItemRemainingBefore,
      saleQty: candidate.SaleQty,
    },
  );
  expect(movementRows, 'канонічний рух відвантаження створено у тестовому стенді').toHaveLength(1);
  const sourceMovementId = movementRows[0].MovementID;

  const created = await createClientReturn(page, {
    clientName: candidate.ClientName,
    clientNetUid: candidate.ClientNetUid,
    clientSearchValue: candidate.ClientSearchValue,
    orderItemId: candidate.OrderItemID,
    orderItemNetUid: candidate.OrderItemNetUid,
    organizationName: candidate.OrganizationName,
    organizationNetUid: candidate.OrganizationNetUid,
    qty: RETURN_QTY,
    saleNetUid: candidate.SaleNetUid,
    saleNumber: candidate.SaleNumber,
    status: RETURN_STATUS,
    statusLabel: RETURN_STATUS_LABEL,
    storageId: candidate.StorageID,
    storageName: candidate.StorageName,
    storageNetUid: candidate.StorageNetUid,
    vendorCode: candidate.VendorCode,
  });

  const projection = await db.poll<CreatedReturnProjection>(
    `SELECT
       LOWER(CONVERT(varchar(36), saleReturn.NetUID)) AS SaleReturnNetUid,
       saleReturn.ClientID,
       saleReturn.ClientAgreementID AS AgreementID,
       COUNT(DISTINCT returnItem.ID) AS ReturnItemCount,
       COALESCE(SUM(DISTINCT returnItem.Qty), 0) AS ReturnQty,
       MIN(returnItem.SaleReturnItemStatus) AS ReturnStatus,
       MIN(returnItem.StorageID) AS StorageID,
       MIN(orderItem.ReturnedQty) AS ReturnedQty,
       COUNT(DISTINCT productIncome.ID) AS ProductIncomeCount,
       COUNT(DISTINCT productIncomeItem.ID) AS ProductIncomeItemCount,
       COALESCE(SUM(DISTINCT productIncomeItem.Qty), 0) AS ProductIncomeQty,
       COALESCE(SUM(DISTINCT productIncomeItem.RemainingQty), 0) AS ProductIncomeRemainingQty,
       COUNT(DISTINCT outbox.ID) AS OutboxCount,
       COUNT(DISTINCT CASE WHEN outbox.CompletedAt IS NOT NULL THEN outbox.ID END) AS OutboxCompleted,
       COUNT(DISTINCT consignment.ID) AS ConsignmentCount,
       COUNT(DISTINCT consignmentItem.ID) AS ConsignmentItemCount,
       COALESCE(SUM(DISTINCT consignmentItem.Qty), 0) AS ConsignmentQty,
       MIN(consignmentItem.RootConsignmentItemID) AS RootConsignmentItemID,
       COUNT(DISTINCT returnMovement.ID) AS ReturnMovementCount,
       COALESCE(SUM(DISTINCT returnMovement.Qty), 0) AS ReturnMovementQty,
       (SELECT sourceMovement.RemainingQty
        FROM dbo.ConsignmentItemMovement sourceMovement
        WHERE sourceMovement.ID = @sourceMovementId) AS SourceMovementRemainingQty,
       (SELECT sourceLot.RemainingQty
        FROM dbo.ConsignmentItem sourceLot
        WHERE sourceLot.ID = @sourceConsignmentItemId) AS SourceLotRemainingQty,
       MIN(availability.Amount) AS ProductAvailabilityAmount
     FROM dbo.SaleReturn saleReturn
     JOIN dbo.SaleReturnItem returnItem
       ON returnItem.SaleReturnID = saleReturn.ID
      AND returnItem.Deleted = 0
     JOIN dbo.OrderItem orderItem
       ON orderItem.ID = returnItem.OrderItemID
     LEFT JOIN dbo.ProductIncomeItem productIncomeItem
       ON productIncomeItem.SaleReturnItemID = returnItem.ID
      AND productIncomeItem.Deleted = 0
     LEFT JOIN dbo.ProductIncome productIncome
       ON productIncome.ID = productIncomeItem.ProductIncomeID
      AND productIncome.Deleted = 0
     LEFT JOIN dbo.ProductIncomeConsignmentOutbox outbox
       ON outbox.ProductIncomeID = productIncome.ID
     LEFT JOIN dbo.Consignment consignment
       ON consignment.ProductIncomeID = productIncome.ID
      AND consignment.Deleted = 0
     LEFT JOIN dbo.ConsignmentItem consignmentItem
       ON consignmentItem.ConsignmentID = consignment.ID
      AND consignmentItem.ProductIncomeItemID = productIncomeItem.ID
      AND consignmentItem.ProductID = @productId
      AND consignmentItem.Deleted = 0
     LEFT JOIN dbo.ConsignmentItemMovement returnMovement
       ON returnMovement.ConsignmentItemID = consignmentItem.ID
      AND returnMovement.ProductIncomeItemID = productIncomeItem.ID
      AND returnMovement.Deleted = 0
      AND returnMovement.IsIncomeMovement = 1
      AND returnMovement.MovementType = 1
     LEFT JOIN dbo.ProductAvailability availability
       ON availability.ProductID = @productId
      AND availability.StorageID = @storageId
      AND availability.Deleted = 0
     WHERE saleReturn.Deleted = 0
       AND saleReturn.NetUID = @saleReturnNetUid
       AND returnItem.OrderItemID = @orderItemId
     GROUP BY saleReturn.NetUID, saleReturn.ClientID, saleReturn.ClientAgreementID`,
    (rows) => rows.length === 1 && rows[0].OutboxCompleted === 1 && rows[0].ConsignmentItemCount === 1,
    { timeoutMs: 120_000, label: 'exact return income, outbox and consignment' },
    {
      orderItemId: candidate.OrderItemID,
      productId: candidate.ProductID,
      saleReturnNetUid: created.saleReturnNetUid,
      sourceConsignmentItemId: candidate.ConsignmentItemID,
      sourceMovementId,
      storageId: candidate.StorageID,
    },
  );
  const result = projection[0];

  expect(result.SaleReturnNetUid).toBe(created.saleReturnNetUid);
  expect(result.ClientID).toBe(candidate.ClientID);
  expect(result.AgreementID).toBe(candidate.AgreementID);
  expect(result.ReturnItemCount).toBe(1);
  expect(result.ReturnQty).toBe(RETURN_QTY);
  expect(result.ReturnStatus).toBe(RETURN_STATUS);
  expect(result.StorageID).toBe(candidate.StorageID);
  expect(result.ReturnedQty).toBe(candidate.ReturnedQtyBefore + RETURN_QTY);
  expect(result.ProductIncomeCount).toBe(1);
  expect(result.ProductIncomeItemCount).toBe(1);
  expect(result.ProductIncomeQty).toBe(RETURN_QTY);
  expect(result.ProductIncomeRemainingQty).toBe(RETURN_QTY);
  expect(result.OutboxCount).toBe(1);
  expect(result.OutboxCompleted).toBe(1);
  expect(result.ConsignmentCount).toBe(1);
  expect(result.ConsignmentItemCount).toBe(1);
  expect(result.ConsignmentQty).toBe(RETURN_QTY);
  expect(result.RootConsignmentItemID).toBe(candidate.ConsignmentItemID);
  expect(result.ReturnMovementCount).toBe(1);
  expect(result.ReturnMovementQty).toBe(RETURN_QTY);
  expect(result.SourceMovementRemainingQty).toBe(candidate.SaleQty - RETURN_QTY);
  expect(result.SourceLotRemainingQty).toBe(
    candidate.ConsignmentItemRemainingBefore - candidate.SaleQty,
  );
  expect(result.ProductAvailabilityAmount).toBe(candidate.AvailabilityBefore + RETURN_QTY);

  entities.record('return.smoke', {
    orderItemId: candidate.OrderItemID,
    productId: candidate.ProductID,
    qty: RETURN_QTY,
    saleReturnNetUid: created.saleReturnNetUid,
    sourceMovementId,
    storageId: candidate.StorageID,
  });
});
