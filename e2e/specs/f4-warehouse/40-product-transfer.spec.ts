import { expect, test } from '../../fixtures/test';
import { createProductTransfer } from '../../flows/transfers';

test.describe.configure({ mode: 'serial' });

const TRANSFER_QTY = 1;

interface TransferCandidate {
  FromAvailabilityBefore: number;
  FromPlacementBefore: number;
  FromRemainingBefore: number;
  FromStorageID: number;
  FromStorageName: string;
  OrganizationName: string;
  ProductID: number;
  ToAvailabilityBefore: number;
  ToPlacementBefore: number;
  ToRemainingBefore: number;
  ToStorageID: number;
  ToStorageName: string;
  VendorCode: string;
}

interface TransferProjection {
  DispatchedOutboxCount: number;
  FailedOutboxCount: number;
  FromAvailability: number;
  FromMovementCount: number;
  FromMovementQty: number;
  FromPlacement: number;
  FromRemaining: number;
  IncomeMovementCount: number;
  IncomeMovementQty: number;
  MutationCompleted: number;
  ProductLocationQty: number;
  ProductTransferID: number;
  ProductTransferItemCount: number;
  ReceiptCount: number;
  ToAvailability: number;
  ToPlacement: number;
  ToRemaining: number;
  TransferConsignmentCount: number;
  TransferItemQty: number;
}

test('склад: переміщення має один ledger, receipt і консервативні складські ефекти @smoke', async ({ page, db }) => {
  const candidates = await db.query<TransferCandidate>(
    `SELECT TOP 1
       product.ID AS ProductID,
       product.VendorCode,
       sourceStorage.ID AS FromStorageID,
       sourceStorage.Name AS FromStorageName,
       targetStorage.ID AS ToStorageID,
       targetStorage.Name AS ToStorageName,
       organization.Name AS OrganizationName,
       sourceAvailability.Amount AS FromAvailabilityBefore,
       COALESCE(targetAvailability.Amount, 0) AS ToAvailabilityBefore,
       sourceTotals.PlacementQty AS FromPlacementBefore,
       COALESCE(targetTotals.PlacementQty, 0) AS ToPlacementBefore,
       sourceTotals.RemainingQty AS FromRemainingBefore,
       COALESCE(targetTotals.RemainingQty, 0) AS ToRemainingBefore
     FROM dbo.ProductAvailability sourceAvailability
     JOIN dbo.Product product
       ON product.ID = sourceAvailability.ProductID
      AND product.Deleted = 0
     JOIN dbo.Storage sourceStorage
       ON sourceStorage.ID = sourceAvailability.StorageID
      AND sourceStorage.Deleted = 0
      AND sourceStorage.ForDefective = 0
      AND sourceStorage.IsResale = 0
     JOIN dbo.Organization organization
       ON organization.ID = sourceStorage.OrganizationID
      AND organization.Deleted = 0
     JOIN dbo.Storage targetStorage
       ON targetStorage.OrganizationID = sourceStorage.OrganizationID
      AND targetStorage.ID <> sourceStorage.ID
      AND targetStorage.Deleted = 0
      AND targetStorage.ForDefective = 0
      AND targetStorage.IsResale = 0
     LEFT JOIN dbo.ProductAvailability targetAvailability
       ON targetAvailability.ProductID = product.ID
      AND targetAvailability.StorageID = targetStorage.ID
      AND targetAvailability.Deleted = 0
     CROSS APPLY (
       SELECT
         (SELECT SUM(consignmentItem.RemainingQty)
          FROM dbo.ConsignmentItem consignmentItem
          JOIN dbo.Consignment consignment
            ON consignment.ID = consignmentItem.ConsignmentID
           AND consignment.Deleted = 0
           AND consignment.StorageID = sourceStorage.ID
          WHERE consignmentItem.Deleted = 0
            AND consignmentItem.ProductID = product.ID) AS RemainingQty,
         (SELECT SUM(placement.Qty)
          FROM dbo.ProductPlacement placement
          WHERE placement.Deleted = 0
            AND placement.StorageID = sourceStorage.ID
            AND placement.ProductID = product.ID) AS PlacementQty
     ) sourceTotals
     OUTER APPLY (
       SELECT
         (SELECT SUM(consignmentItem.RemainingQty)
          FROM dbo.ConsignmentItem consignmentItem
          JOIN dbo.Consignment consignment
            ON consignment.ID = consignmentItem.ConsignmentID
           AND consignment.Deleted = 0
           AND consignment.StorageID = targetStorage.ID
          WHERE consignmentItem.Deleted = 0
            AND consignmentItem.ProductID = product.ID) AS RemainingQty,
         (SELECT SUM(placement.Qty)
          FROM dbo.ProductPlacement placement
          WHERE placement.Deleted = 0
            AND placement.StorageID = targetStorage.ID
            AND placement.ProductID = product.ID) AS PlacementQty
     ) targetTotals
     WHERE sourceAvailability.Deleted = 0
       AND sourceAvailability.Amount >= @qty
       AND sourceTotals.RemainingQty >= @qty
       AND sourceTotals.PlacementQty >= @qty
       AND product.VendorCode IS NOT NULL
       AND LEN(product.VendorCode) BETWEEN 5 AND 18
       AND product.VendorCode NOT LIKE '%[^0-9A-Za-z-]%'
       AND LEN(sourceStorage.Name) BETWEEN 3 AND 40
       AND LEN(targetStorage.Name) BETWEEN 3 AND 40
     ORDER BY sourceTotals.PlacementQty DESC, product.ID`,
    { qty: TRANSFER_QTY },
  );
  expect(candidates, 'знайдено точний товар і два звичайні склади однієї організації').toHaveLength(1);
  const candidate = candidates[0];

  const created = await createProductTransfer(page, {
    fromStorageName: candidate.FromStorageName,
    organizationName: candidate.OrganizationName,
    qty: TRANSFER_QTY,
    toStorageName: candidate.ToStorageName,
    vendorCode: candidate.VendorCode,
  });

  const projection = await db.poll<TransferProjection>(
    `SELECT
       operation.IsCompleted AS MutationCompleted,
       operation.ProductTransferID,
       (SELECT COUNT(*) FROM dbo.ProductTransferItem item
        WHERE item.ProductTransferID = operation.ProductTransferID
          AND item.Deleted = 0 AND item.ProductID = @productId) AS ProductTransferItemCount,
       COALESCE((SELECT SUM(item.Qty) FROM dbo.ProductTransferItem item
        WHERE item.ProductTransferID = operation.ProductTransferID
          AND item.Deleted = 0 AND item.ProductID = @productId), 0) AS TransferItemQty,
       (SELECT COUNT(*) FROM dbo.ProductTransferConsignmentOutbox outbox
        WHERE outbox.ProductTransferID = operation.ProductTransferID
          AND outbox.DispatchedAt IS NOT NULL) AS DispatchedOutboxCount,
       (SELECT COUNT(*) FROM dbo.ProductTransferConsignmentOutbox outbox
        WHERE outbox.ProductTransferID = operation.ProductTransferID
          AND (outbox.LastError IS NOT NULL OR outbox.DispatchedAt IS NULL)) AS FailedOutboxCount,
       (SELECT COUNT(*)
        FROM dbo.ProductTransferConsignmentReceipt receipt
        JOIN dbo.ProductTransferConsignmentOutbox outbox
          ON outbox.EventNetUid = receipt.EventNetUid
        WHERE outbox.ProductTransferID = operation.ProductTransferID
          AND receipt.ConsumerName = N'product-transfer-consignment') AS ReceiptCount,
       (SELECT COUNT(*) FROM dbo.Consignment consignment
        WHERE consignment.ProductTransferID = operation.ProductTransferID
          AND consignment.Deleted = 0
          AND consignment.StorageID = @toStorageId) AS TransferConsignmentCount,
       (SELECT COUNT(*)
        FROM dbo.ConsignmentItemMovement movement
        JOIN dbo.ProductTransferItem item
          ON item.ID = movement.ProductTransferItemID
        JOIN dbo.ConsignmentItem consignmentItem
          ON consignmentItem.ID = movement.ConsignmentItemID
        JOIN dbo.Consignment consignment
          ON consignment.ID = consignmentItem.ConsignmentID
        WHERE item.ProductTransferID = operation.ProductTransferID
          AND item.ProductID = @productId
          AND movement.Deleted = 0
          AND movement.MovementType = 7
          AND movement.IsIncomeMovement = 0
          AND consignment.StorageID = @fromStorageId) AS FromMovementCount,
       COALESCE((SELECT SUM(movement.Qty)
        FROM dbo.ConsignmentItemMovement movement
        JOIN dbo.ProductTransferItem item ON item.ID = movement.ProductTransferItemID
        WHERE item.ProductTransferID = operation.ProductTransferID
          AND item.ProductID = @productId
          AND movement.Deleted = 0
          AND movement.MovementType = 7
          AND movement.IsIncomeMovement = 0), 0) AS FromMovementQty,
       (SELECT COUNT(*)
        FROM dbo.ConsignmentItemMovement movement
        JOIN dbo.ProductTransferItem item
          ON item.ID = movement.ProductTransferItemID
        JOIN dbo.ConsignmentItem consignmentItem
          ON consignmentItem.ID = movement.ConsignmentItemID
        JOIN dbo.Consignment consignment
          ON consignment.ID = consignmentItem.ConsignmentID
        WHERE item.ProductTransferID = operation.ProductTransferID
          AND item.ProductID = @productId
          AND movement.Deleted = 0
          AND movement.MovementType = 7
          AND movement.IsIncomeMovement = 1
          AND consignment.StorageID = @toStorageId
          AND consignmentItem.RootConsignmentItemID IS NOT NULL) AS IncomeMovementCount,
       COALESCE((SELECT SUM(movement.Qty)
        FROM dbo.ConsignmentItemMovement movement
        JOIN dbo.ProductTransferItem item ON item.ID = movement.ProductTransferItemID
        WHERE item.ProductTransferID = operation.ProductTransferID
          AND item.ProductID = @productId
          AND movement.Deleted = 0
          AND movement.MovementType = 7
          AND movement.IsIncomeMovement = 1), 0) AS IncomeMovementQty,
       COALESCE((SELECT SUM(location.Qty)
        FROM dbo.ProductLocation location
        JOIN dbo.ProductTransferItem item ON item.ID = location.ProductTransferItemID
        WHERE item.ProductTransferID = operation.ProductTransferID
          AND item.ProductID = @productId
          AND location.Deleted = 0
          AND location.StorageID = @fromStorageId), 0) AS ProductLocationQty,
       COALESCE((SELECT SUM(amount.Amount) FROM dbo.ProductAvailability amount
        WHERE amount.Deleted = 0 AND amount.ProductID = @productId
          AND amount.StorageID = @fromStorageId), 0) AS FromAvailability,
       COALESCE((SELECT SUM(amount.Amount) FROM dbo.ProductAvailability amount
        WHERE amount.Deleted = 0 AND amount.ProductID = @productId
          AND amount.StorageID = @toStorageId), 0) AS ToAvailability,
       COALESCE((SELECT SUM(placement.Qty) FROM dbo.ProductPlacement placement
        WHERE placement.Deleted = 0 AND placement.ProductID = @productId
          AND placement.StorageID = @fromStorageId), 0) AS FromPlacement,
       COALESCE((SELECT SUM(placement.Qty) FROM dbo.ProductPlacement placement
        WHERE placement.Deleted = 0 AND placement.ProductID = @productId
          AND placement.StorageID = @toStorageId), 0) AS ToPlacement,
       COALESCE((SELECT SUM(item.RemainingQty)
        FROM dbo.ConsignmentItem item JOIN dbo.Consignment consignment
          ON consignment.ID = item.ConsignmentID AND consignment.Deleted = 0
        WHERE item.Deleted = 0 AND item.ProductID = @productId
          AND consignment.StorageID = @fromStorageId), 0) AS FromRemaining,
       COALESCE((SELECT SUM(item.RemainingQty)
        FROM dbo.ConsignmentItem item JOIN dbo.Consignment consignment
          ON consignment.ID = item.ConsignmentID AND consignment.Deleted = 0
        WHERE item.Deleted = 0 AND item.ProductID = @productId
          AND consignment.StorageID = @toStorageId), 0) AS ToRemaining
     FROM dbo.ProductTransferMutationOperation operation
     WHERE operation.OperationNetUid = @operationNetUid`,
    (rows) =>
      rows.length === 1 &&
      Boolean(rows[0].MutationCompleted) &&
      rows[0].DispatchedOutboxCount === 1 &&
      rows[0].ReceiptCount === 1 &&
      rows[0].FailedOutboxCount === 0,
    { timeoutMs: 90_000, label: 'exact transfer ledger/outbox/receipt' },
    {
      fromStorageId: candidate.FromStorageID,
      operationNetUid: created.operationNetUid,
      productId: candidate.ProductID,
      toStorageId: candidate.ToStorageID,
    },
  );
  const result = projection[0];

  expect(result.ProductTransferItemCount).toBe(1);
  expect(result.TransferItemQty).toBe(TRANSFER_QTY);
  expect(result.TransferConsignmentCount).toBeGreaterThanOrEqual(1);
  expect(result.FromMovementCount).toBeGreaterThanOrEqual(1);
  expect(result.FromMovementQty).toBe(TRANSFER_QTY);
  expect(result.IncomeMovementCount).toBeGreaterThanOrEqual(1);
  expect(result.IncomeMovementQty).toBe(TRANSFER_QTY);
  expect(result.ProductLocationQty).toBe(TRANSFER_QTY);
  expect(result.FromAvailability).toBe(candidate.FromAvailabilityBefore - TRANSFER_QTY);
  expect(result.ToAvailability).toBe(candidate.ToAvailabilityBefore + TRANSFER_QTY);
  expect(result.FromPlacement).toBe(candidate.FromPlacementBefore - TRANSFER_QTY);
  expect(result.ToPlacement).toBe(candidate.ToPlacementBefore + TRANSFER_QTY);
  expect(result.FromRemaining).toBe(candidate.FromRemainingBefore - TRANSFER_QTY);
  expect(result.ToRemaining).toBe(candidate.ToRemainingBefore + TRANSFER_QTY);
  expect(result.FromAvailability + result.ToAvailability).toBe(
    candidate.FromAvailabilityBefore + candidate.ToAvailabilityBefore,
  );
  expect(result.FromPlacement + result.ToPlacement).toBe(
    candidate.FromPlacementBefore + candidate.ToPlacementBefore,
  );
  expect(result.FromRemaining + result.ToRemaining).toBe(
    candidate.FromRemainingBefore + candidate.ToRemainingBefore,
  );
});
