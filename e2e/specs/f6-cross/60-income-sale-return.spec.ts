import { SMOKE_SUPPLIER } from '../../data/testIncome';
import { expect, test } from '../../fixtures/test';
import {
  addInvoiceFromCcd,
  addPackingListFromCcd,
  createDirectOrderFromCcd,
  createProForma,
  postIncome,
  uploadCustomsCodes,
  type CreatedInvoiceRef,
  type CreatedOrderRef,
} from '../../flows/income';
import { createClientReturn } from '../../flows/returns';
import { createSaleViaWizard } from '../../flows/sales';
import { createProductTransfer } from '../../flows/transfers';

test.describe.configure({ mode: 'serial' });

const SALE_QTY = 2;
const RETURN_QTY = 1;
const RETURN_STATUS = 4;
const RETURN_STATUS_LABEL = 'Відмова від товару кінцевим покупцем';
const CHAIN_VENDOR_CODE = '11517CNT';
const CHAIN_SUPPLIER = {
  ...SMOKE_SUPPLIER,
  key: 'CHAIN-AYMEKS',
  parse: {
    ...SMOKE_SUPPLIER.parse,
    endRow: 10,
    startRow: 10,
  },
  qty: 30,
  rows: 1,
};

interface IncomeStockCandidate {
  FromAvailabilityBefore: number;
  FromPlacementBefore: number;
  FromStorageID: number;
  FromStorageName: string;
  IncomeQty: number;
  OrganizationID: number;
  OrganizationName: string;
  OrganizationNetUid: string;
  ProductID: number;
  ProductIncomeID: number;
  ProductIncomeItemID: number;
  ProductNetUid: string;
  SourceConsignmentItemID: number;
  SourceRemainingBefore: number;
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
  IsAcceptedToPacking: boolean;
  FromAvailability: number;
  FromPlacement: number;
  FromRemaining: number;
  IncomeMovementCount: number;
  IncomeMovementQty: number;
  MutationCompleted: boolean;
  ReceiptCount: number;
  TargetConsignmentItemID: number;
  TargetQty: number;
  TargetRemaining: number;
  TargetRootConsignmentItemID: number;
  ToAvailability: number;
  ToPlacement: number;
  ToRemaining: number;
  TransferItemCount: number;
  TransferItemQty: number;
}

interface SaleClientCandidate {
  AgreementID: number;
  AgreementNetUid: string;
  ClientID: number;
  ClientName: string;
  ClientNetUid: string;
  ClientSearchValue: string;
}

interface SaleMovementProjection {
  AgreementID: number;
  ClientID: number;
  ClientName: string;
  ClientNetUid: string;
  ClientSearchValue: string;
  DispatchedOutboxCount: number;
  FailedOutboxCount: number;
  MovementCountAnchor: number;
  MovementConsignmentItemID: number;
  MovementCount: number;
  MovementOrderItemID: number;
  MovementOrderItemNetUid: string;
  MovementQty: number;
  MovementRemainingQty: number;
  OrganizationName: string;
  OrganizationNetUid: string;
  ReceiptCount: number;
  ReturnedQtyBefore: number;
  SaleID: number;
  SaleNetUid: string;
  SaleNumber: string;
  SourceLotRemaining: number;
  TargetAvailability: number;
}

interface ReturnProjection {
  ConsignmentItemCount: number;
  ConsignmentQty: number;
  FamilyRemainingQty: number;
  OriginalSourceRemainingQty: number;
  OutboxCompleted: number;
  OutboxCount: number;
  ProductAvailabilityAmount: number;
  ProductIncomeCount: number;
  ProductIncomeItemCount: number;
  ProductIncomeQty: number;
  ProductIncomeRemainingQty: number;
  ReturnedQty: number;
  ReturnMovementCount: number;
  ReturnMovementQty: number;
  ReturnQty: number;
  ReturnRootConsignmentItemID: number;
  ReturnStatus: number;
  SaleReturnNetUid: string;
  SourceMovementRemainingQty: number;
  SourceTransferLotRemainingQty: number;
}

test('наскрізний: прихід → переміщення → продаж → повернення зберігає одну партійну lineage @smoke', async ({
  page,
  db,
  entities,
}) => {
  test.setTimeout(12 * 60_000);

  let order = entities.get<CreatedOrderRef>(`income.${SMOKE_SUPPLIER.key}.order`);
  let invoice = entities.get<CreatedInvoiceRef>(`income.${SMOKE_SUPPLIER.key}.invoice`);

  if (Boolean(order) !== Boolean(invoice)) {
    throw new Error('The shared smoke income boundary is incomplete; refusing to create a duplicate chain receipt.');
  }

  if (!order || !invoice) {
    const chainRunId = `${entities.runId}-chain`;
    order = await createDirectOrderFromCcd(page, CHAIN_SUPPLIER, chainRunId);
    await createProForma(page, CHAIN_SUPPLIER, chainRunId, order.orderNetId);
    invoice = await addInvoiceFromCcd(page, CHAIN_SUPPLIER, chainRunId, order.orderNetId);
    await addPackingListFromCcd(page, CHAIN_SUPPLIER, order.orderNetId, invoice.invoiceNumber);
    await uploadCustomsCodes(page, CHAIN_SUPPLIER, order.orderNetId);
    await postIncome(page, order.orderNetId);
  }

  const incomeRows = await db.poll<IncomeStockCandidate>(
    `SELECT TOP 1
       product.ID AS ProductID,
       LOWER(CONVERT(varchar(36), product.NetUID)) AS ProductNetUid,
       product.VendorCode,
       productIncome.ID AS ProductIncomeID,
       productIncomeItem.ID AS ProductIncomeItemID,
       productIncomeItem.Qty AS IncomeQty,
       sourceItem.ID AS SourceConsignmentItemID,
       sourceItem.RemainingQty AS SourceRemainingBefore,
       sourceStorage.ID AS FromStorageID,
       sourceStorage.Name AS FromStorageName,
       organization.ID AS OrganizationID,
       organization.Name AS OrganizationName,
       LOWER(CONVERT(varchar(36), organization.NetUID)) AS OrganizationNetUid,
       targetStorage.ID AS ToStorageID,
       targetStorage.Name AS ToStorageName,
       sourceAvailability.Amount AS FromAvailabilityBefore,
       COALESCE(targetAvailability.Amount, 0) AS ToAvailabilityBefore,
       sourcePlacement.Qty AS FromPlacementBefore,
       COALESCE(targetPlacement.Qty, 0) AS ToPlacementBefore,
       COALESCE(targetLots.RemainingQty, 0) AS ToRemainingBefore
     FROM dbo.ProductIncomeItem productIncomeItem
     JOIN dbo.ProductIncome productIncome
       ON productIncome.ID = productIncomeItem.ProductIncomeID
      AND productIncome.Deleted = 0
     JOIN dbo.PackingListPackageOrderItem packingItem
       ON packingItem.ID = productIncomeItem.PackingListPackageOrderItemID
      AND packingItem.Deleted = 0
     JOIN dbo.PackingList packingList
       ON packingList.ID = packingItem.PackingListID
      AND packingList.Deleted = 0
     JOIN dbo.SupplyInvoice invoice
       ON invoice.ID = packingList.SupplyInvoiceID
      AND invoice.Deleted = 0
     JOIN dbo.Consignment sourceConsignment
       ON sourceConsignment.ProductIncomeID = productIncome.ID
      AND sourceConsignment.Deleted = 0
     JOIN dbo.ConsignmentItem sourceItem
       ON sourceItem.ConsignmentID = sourceConsignment.ID
      AND sourceItem.ProductIncomeItemID = productIncomeItem.ID
      AND sourceItem.Deleted = 0
     JOIN dbo.Product product
       ON product.ID = sourceItem.ProductID
      AND product.Deleted = 0
     JOIN dbo.Storage sourceStorage
       ON sourceStorage.ID = sourceConsignment.StorageID
      AND sourceStorage.Deleted = 0
      AND sourceStorage.ForVatProducts = 1
      AND sourceStorage.ForDefective = 0
      AND sourceStorage.IsResale = 0
     JOIN dbo.Organization organization
       ON organization.ID = sourceStorage.OrganizationID
      AND organization.Deleted = 0
     JOIN dbo.Storage targetStorage
       ON targetStorage.ID = organization.StorageID
      AND targetStorage.ID <> sourceStorage.ID
      AND targetStorage.Deleted = 0
      AND targetStorage.ForVatProducts = 1
      AND targetStorage.ForDefective = 0
      AND targetStorage.IsResale = 0
     JOIN dbo.ProductAvailability sourceAvailability
       ON sourceAvailability.ProductID = product.ID
      AND sourceAvailability.StorageID = sourceStorage.ID
      AND sourceAvailability.Deleted = 0
     LEFT JOIN dbo.ProductAvailability targetAvailability
       ON targetAvailability.ProductID = product.ID
      AND targetAvailability.StorageID = targetStorage.ID
      AND targetAvailability.Deleted = 0
     CROSS APPLY (
       SELECT COALESCE(SUM(placement.Qty), 0) AS Qty
       FROM dbo.ProductPlacement placement
       WHERE placement.ProductID = product.ID
         AND placement.StorageID = sourceStorage.ID
         AND placement.Deleted = 0
     ) sourcePlacement
     OUTER APPLY (
       SELECT COALESCE(SUM(placement.Qty), 0) AS Qty
       FROM dbo.ProductPlacement placement
       WHERE placement.ProductID = product.ID
         AND placement.StorageID = targetStorage.ID
         AND placement.Deleted = 0
     ) targetPlacement
     OUTER APPLY (
       SELECT COALESCE(SUM(item.RemainingQty), 0) AS RemainingQty
       FROM dbo.ConsignmentItem item
       JOIN dbo.Consignment consignment
         ON consignment.ID = item.ConsignmentID
        AND consignment.Deleted = 0
        AND consignment.StorageID = targetStorage.ID
       WHERE item.ProductID = product.ID
         AND item.Deleted = 0
     ) targetLots
     WHERE invoice.Number = @invoiceNumber
       AND product.VendorCode = @vendorCode
       AND productIncomeItem.Deleted = 0
       AND sourceItem.Qty >= @qty
       AND sourceItem.RemainingQty = sourceItem.Qty
       AND sourceAvailability.Amount >= @qty
       AND sourcePlacement.Qty >= @qty
       AND product.VendorCode IS NOT NULL
       AND LEN(product.VendorCode) BETWEEN 5 AND 18
       AND product.VendorCode NOT LIKE '%[^0-9A-Za-z-]%'
       AND (SELECT COUNT(*) FROM dbo.Product duplicate
            WHERE duplicate.Deleted = 0
              AND duplicate.VendorCode = product.VendorCode) = 1
       AND NOT EXISTS (
         SELECT 1
         FROM dbo.ConsignmentItem otherItem
         JOIN dbo.Consignment otherConsignment
           ON otherConsignment.ID = otherItem.ConsignmentID
          AND otherConsignment.Deleted = 0
         WHERE otherItem.ProductID = product.ID
           AND otherItem.ID <> sourceItem.ID
           AND otherItem.Deleted = 0
           AND otherItem.RemainingQty > 0
           AND otherConsignment.StorageID IN (sourceStorage.ID, targetStorage.ID))
     ORDER BY sourceItem.Qty DESC, sourceItem.ID`,
    (rows) => rows.length === 1,
    { timeoutMs: 120_000, label: 'single exact income lot ready for transfer' },
    { invoiceNumber: invoice.invoiceNumber, qty: SALE_QTY, vendorCode: CHAIN_VENDOR_CODE },
  );
  const income = incomeRows[0];
  expect(income.IncomeQty).toBe(CHAIN_SUPPLIER.qty);
  expect(income.SourceRemainingBefore).toBe(income.IncomeQty);
  expect(income.ToRemainingBefore).toBe(0);

  const transfer = await createProductTransfer(page, {
    fromStorageName: income.FromStorageName,
    organizationName: income.OrganizationName,
    qty: SALE_QTY,
    toStorageName: income.ToStorageName,
    vendorCode: income.VendorCode,
  });

  const transferRows = await db.poll<TransferProjection>(
    `SELECT
       operation.IsCompleted AS MutationCompleted,
       (SELECT COUNT(*) FROM dbo.ProductTransferItem item
        WHERE item.ProductTransferID = operation.ProductTransferID
          AND item.ProductID = @productId AND item.Deleted = 0) AS TransferItemCount,
       COALESCE((SELECT SUM(item.Qty) FROM dbo.ProductTransferItem item
        WHERE item.ProductTransferID = operation.ProductTransferID
          AND item.ProductID = @productId AND item.Deleted = 0), 0) AS TransferItemQty,
       (SELECT COUNT(*) FROM dbo.ProductTransferConsignmentOutbox outbox
        WHERE outbox.ProductTransferID = operation.ProductTransferID
          AND outbox.DispatchedAt IS NOT NULL) AS DispatchedOutboxCount,
       (SELECT COUNT(*) FROM dbo.ProductTransferConsignmentOutbox outbox
        WHERE outbox.ProductTransferID = operation.ProductTransferID
          AND (outbox.DispatchedAt IS NULL OR outbox.LastError IS NOT NULL)) AS FailedOutboxCount,
       (SELECT COUNT(*)
        FROM dbo.ProductTransferConsignmentReceipt receipt
        JOIN dbo.ProductTransferConsignmentOutbox outbox
          ON outbox.EventNetUid = receipt.EventNetUid
        WHERE outbox.ProductTransferID = operation.ProductTransferID
          AND receipt.ConsumerName = N'product-transfer-consignment') AS ReceiptCount,
       targetItem.ID AS TargetConsignmentItemID,
       targetItem.Qty AS TargetQty,
       targetItem.RemainingQty AS TargetRemaining,
       targetItem.RootConsignmentItemID AS TargetRootConsignmentItemID,
       (SELECT COUNT(*) FROM dbo.ConsignmentItemMovement movement
        WHERE movement.ConsignmentItemID = targetItem.ID
          AND movement.ProductTransferItemID = transferItem.ID
          AND movement.MovementType = 7
          AND movement.IsIncomeMovement = 1
          AND movement.Deleted = 0) AS IncomeMovementCount,
       COALESCE((SELECT SUM(movement.Qty) FROM dbo.ConsignmentItemMovement movement
        WHERE movement.ConsignmentItemID = targetItem.ID
          AND movement.ProductTransferItemID = transferItem.ID
          AND movement.MovementType = 7
          AND movement.IsIncomeMovement = 1
          AND movement.Deleted = 0), 0) AS IncomeMovementQty,
       sourceItem.RemainingQty AS FromRemaining,
       sourceAvailability.Amount AS FromAvailability,
       targetAvailability.Amount AS ToAvailability,
       COALESCE((SELECT SUM(placement.Qty) FROM dbo.ProductPlacement placement
        WHERE placement.ProductID = @productId AND placement.StorageID = @fromStorageId
          AND placement.Deleted = 0), 0) AS FromPlacement,
       COALESCE((SELECT SUM(placement.Qty) FROM dbo.ProductPlacement placement
        WHERE placement.ProductID = @productId AND placement.StorageID = @toStorageId
          AND placement.Deleted = 0), 0) AS ToPlacement,
       COALESCE((SELECT SUM(item.RemainingQty) FROM dbo.ConsignmentItem item
        JOIN dbo.Consignment consignment ON consignment.ID = item.ConsignmentID
         AND consignment.Deleted = 0 AND consignment.StorageID = @toStorageId
        WHERE item.ProductID = @productId AND item.Deleted = 0), 0) AS ToRemaining
     FROM dbo.ProductTransferMutationOperation operation
     JOIN dbo.ProductTransferItem transferItem
       ON transferItem.ProductTransferID = operation.ProductTransferID
      AND transferItem.ProductID = @productId
      AND transferItem.Deleted = 0
     JOIN dbo.ConsignmentItemMovement targetMovement
       ON targetMovement.ProductTransferItemID = transferItem.ID
      AND targetMovement.MovementType = 7
      AND targetMovement.IsIncomeMovement = 1
      AND targetMovement.Deleted = 0
     JOIN dbo.ConsignmentItem targetItem
       ON targetItem.ID = targetMovement.ConsignmentItemID
      AND targetItem.Deleted = 0
     JOIN dbo.Consignment targetConsignment
       ON targetConsignment.ID = targetItem.ConsignmentID
      AND targetConsignment.StorageID = @toStorageId
      AND targetConsignment.Deleted = 0
     JOIN dbo.ConsignmentItem sourceItem
       ON sourceItem.ID = @sourceConsignmentItemId
     JOIN dbo.ProductAvailability sourceAvailability
       ON sourceAvailability.ProductID = @productId
      AND sourceAvailability.StorageID = @fromStorageId
      AND sourceAvailability.Deleted = 0
     JOIN dbo.ProductAvailability targetAvailability
       ON targetAvailability.ProductID = @productId
      AND targetAvailability.StorageID = @toStorageId
      AND targetAvailability.Deleted = 0
     WHERE operation.OperationNetUid = @operationNetUid`,
    (rows) => rows.length === 1 && Boolean(rows[0].MutationCompleted) &&
      rows[0].DispatchedOutboxCount === 1 && rows[0].ReceiptCount === 1,
    { timeoutMs: 120_000, label: 'income lot transferred to sale storage' },
    {
      fromStorageId: income.FromStorageID,
      operationNetUid: transfer.operationNetUid,
      productId: income.ProductID,
      sourceConsignmentItemId: income.SourceConsignmentItemID,
      toStorageId: income.ToStorageID,
    },
  );
  const transferred = transferRows[0];
  expect(transferred.FailedOutboxCount).toBe(0);
  expect(transferred.TransferItemCount).toBe(1);
  expect(transferred.TransferItemQty).toBe(SALE_QTY);
  expect(transferred.TargetQty).toBe(SALE_QTY);
  expect(transferred.TargetRemaining).toBe(SALE_QTY);
  expect(transferred.TargetRootConsignmentItemID).toBe(income.SourceConsignmentItemID);
  expect(transferred.IncomeMovementCount).toBe(1);
  expect(transferred.IncomeMovementQty).toBe(SALE_QTY);
  expect(transferred.FromRemaining).toBe(income.SourceRemainingBefore - SALE_QTY);
  expect(transferred.ToRemaining).toBe(income.ToRemainingBefore + SALE_QTY);
  expect(transferred.FromAvailability).toBe(income.FromAvailabilityBefore - SALE_QTY);
  expect(transferred.ToAvailability).toBe(income.ToAvailabilityBefore + SALE_QTY);
  expect(transferred.FromPlacement).toBe(income.FromPlacementBefore - SALE_QTY);
  expect(transferred.ToPlacement).toBe(income.ToPlacementBefore + SALE_QTY);

  const clients = await db.query<SaleClientCandidate>(
    `SELECT TOP 1
       agreement.ID AS AgreementID,
       LOWER(CONVERT(varchar(36), agreement.NetUID)) AS AgreementNetUid,
       client.ID AS ClientID,
       client.FullName AS ClientName,
       LOWER(CONVERT(varchar(36), client.NetUID)) AS ClientNetUid,
       regionCode.Value AS ClientSearchValue
     FROM dbo.ClientAgreement agreement
     JOIN dbo.Agreement terms
       ON terms.ID = agreement.AgreementID
      AND terms.Deleted = 0
      AND terms.OrganizationID = @organizationId
      AND terms.WithVATAccounting = 1
      AND terms.NumberDaysDebt > 0
     JOIN dbo.Client client
       ON client.ID = agreement.ClientID
      AND client.Deleted = 0
     JOIN dbo.RegionCode regionCode
       ON regionCode.ID = client.RegionCodeID
      AND regionCode.Deleted = 0
     WHERE agreement.Deleted = 0
       AND client.FullName IS NOT NULL
       AND LEN(client.FullName) BETWEEN 4 AND 80
       AND regionCode.Value IS NOT NULL
       AND LEN(regionCode.Value) BETWEEN 4 AND 20
       AND (SELECT COUNT(*) FROM dbo.ClientAgreement onlyAgreement
            WHERE onlyAgreement.ClientID = client.ID
              AND onlyAgreement.Deleted = 0) = 1
       AND EXISTS (
         SELECT 1
         FROM dbo.Sale historicalSale
         JOIN dbo.[Order] historicalOrder
           ON historicalOrder.ID = historicalSale.OrderID
          AND historicalOrder.Deleted = 0
         JOIN dbo.OrderItem historicalItem
           ON historicalItem.OrderID = historicalOrder.ID
          AND historicalItem.Deleted = 0
          AND historicalItem.ProductID = @productId
         WHERE historicalSale.ClientAgreementID = agreement.ID
           AND historicalSale.Deleted = 0)
       AND NOT EXISTS (
         SELECT 1
         FROM dbo.Sale openSale
         JOIN dbo.BaseLifeCycleStatus openStatus
           ON openStatus.ID = openSale.BaseLifeCycleStatusID
         WHERE openSale.ClientAgreementID = agreement.ID
           AND openSale.Deleted = 0
           AND openSale.IsMerged = 0
           AND openStatus.SaleLifeCycleType = 0
           AND openSale.Updated >= CONVERT(date, GETDATE()))
     ORDER BY (
       SELECT COUNT(*)
       FROM dbo.Sale historicalSale
       JOIN dbo.[Order] historicalOrder
         ON historicalOrder.ID = historicalSale.OrderID
        AND historicalOrder.Deleted = 0
       JOIN dbo.OrderItem historicalItem
         ON historicalItem.OrderID = historicalOrder.ID
        AND historicalItem.Deleted = 0
        AND historicalItem.ProductID = @productId
       WHERE historicalSale.ClientAgreementID = agreement.ID
         AND historicalSale.Deleted = 0) DESC,
       agreement.ID`,
    { organizationId: income.OrganizationID, productId: income.ProductID },
  );
  expect(clients, 'знайдено однозначного клієнта, який уже купував exact товар').toHaveLength(1);
  const client = clients[0];

  const createdSale = await createSaleViaWizard(page, {
    agreementNetUid: client.AgreementNetUid,
    clientName: client.ClientName,
    clientNetUid: client.ClientNetUid,
    clientSearchValue: client.ClientSearchValue,
    qty: SALE_QTY,
    vendorCode: income.VendorCode,
  });
  const saleRows = await db.poll<SaleMovementProjection>(
    `SELECT
       sale.ID AS SaleID,
       LOWER(CONVERT(varchar(36), sale.NetUID)) AS SaleNetUid,
       saleNumber.Value AS SaleNumber,
       sale.IsAcceptedToPacking,
       clientAgreement.ID AS AgreementID,
       client.ID AS ClientID,
       client.FullName AS ClientName,
       LOWER(CONVERT(varchar(36), client.NetUID)) AS ClientNetUid,
       regionCode.Value AS ClientSearchValue,
       organization.Name AS OrganizationName,
       LOWER(CONVERT(varchar(36), organization.NetUID)) AS OrganizationNetUid,
       movement.ID AS MovementCountAnchor,
       movement.ConsignmentItemID AS MovementConsignmentItemID,
       movement.OrderItemID AS MovementOrderItemID,
       LOWER(CONVERT(varchar(36), orderItem.NetUID)) AS MovementOrderItemNetUid,
       orderItem.ReturnedQty AS ReturnedQtyBefore,
       movement.Qty AS MovementQty,
       movement.RemainingQty AS MovementRemainingQty,
       sourceLot.RemainingQty AS SourceLotRemaining,
       availability.Amount AS TargetAvailability,
       (SELECT COUNT(*) FROM dbo.ConsignmentItemMovement exactMovement
        JOIN dbo.OrderItem exactItem ON exactItem.ID = exactMovement.OrderItemID
        WHERE exactItem.OrderID = sale.OrderID
          AND exactItem.ProductID = @productId
          AND exactMovement.MovementType = 0
          AND exactMovement.IsIncomeMovement = 0
          AND exactMovement.Deleted = 0) AS MovementCount,
       (SELECT COUNT(*) FROM dbo.SalesDurableEffectOutbox outbox
        WHERE outbox.SaleID = sale.ID
          AND outbox.EffectType = N'sale:consignment-movement'
          AND outbox.DispatchedAt IS NOT NULL) AS DispatchedOutboxCount,
       (SELECT COUNT(*) FROM dbo.SalesDurableEffectOutbox outbox
        WHERE outbox.SaleID = sale.ID
          AND outbox.EffectType = N'sale:consignment-movement'
          AND (outbox.DispatchedAt IS NULL OR outbox.LastError IS NOT NULL)) AS FailedOutboxCount,
       (SELECT COUNT(*)
        FROM dbo.SalesDurableEffectReceipt receipt
        JOIN dbo.SalesDurableEffectOutbox outbox
          ON outbox.EventNetUid = receipt.EventNetUid
        WHERE outbox.SaleID = sale.ID
          AND outbox.EffectType = N'sale:consignment-movement'
          AND receipt.ConsumerName = N'sales-consignment-movement') AS ReceiptCount
     FROM dbo.Sale sale
     JOIN dbo.SaleNumber saleNumber ON saleNumber.ID = sale.SaleNumberID
     JOIN dbo.ClientAgreement clientAgreement ON clientAgreement.ID = sale.ClientAgreementID
     JOIN dbo.Client client ON client.ID = clientAgreement.ClientID
     JOIN dbo.RegionCode regionCode ON regionCode.ID = client.RegionCodeID
     JOIN dbo.Agreement agreement ON agreement.ID = clientAgreement.AgreementID
     JOIN dbo.Organization organization ON organization.ID = agreement.OrganizationID
     JOIN dbo.OrderItem orderItem
       ON orderItem.OrderID = sale.OrderID
      AND orderItem.ProductID = @productId
      AND orderItem.Deleted = 0
     JOIN dbo.ConsignmentItemMovement movement
       ON movement.OrderItemID = orderItem.ID
      AND movement.MovementType = 0
      AND movement.IsIncomeMovement = 0
      AND movement.Deleted = 0
     JOIN dbo.ConsignmentItem sourceLot
       ON sourceLot.ID = movement.ConsignmentItemID
     JOIN dbo.ProductAvailability availability
       ON availability.ProductID = @productId
      AND availability.StorageID = @storageId
      AND availability.Deleted = 0
     WHERE sale.NetUID = @saleNetUid
       AND sale.Deleted = 0`,
    (rows) => rows.length === 1 && rows[0].MovementCount === 1 &&
      rows[0].DispatchedOutboxCount === 1 && rows[0].ReceiptCount === 1,
    { timeoutMs: 120_000, label: 'sale durable movement from exact transferred lot' },
    {
      productId: income.ProductID,
      saleNetUid: createdSale.saleNetId,
      storageId: income.ToStorageID,
    },
  );
  const sold = saleRows[0];
  expect(sold.SaleNetUid).toBe(createdSale.saleNetId);
  expect(sold.ClientID).toBe(client.ClientID);
  expect(sold.AgreementID).toBe(client.AgreementID);
  expect(sold.IsAcceptedToPacking).toBe(true);
  expect(sold.FailedOutboxCount).toBe(0);
  expect(sold.MovementConsignmentItemID).toBe(transferred.TargetConsignmentItemID);
  expect(sold.MovementQty).toBe(SALE_QTY);
  expect(sold.MovementRemainingQty).toBe(SALE_QTY);
  expect(sold.SourceLotRemaining).toBe(0);

  const createdReturn = await createClientReturn(page, {
    clientName: sold.ClientName,
    clientNetUid: sold.ClientNetUid,
    clientSearchValue: sold.ClientSearchValue,
    orderItemId: sold.MovementOrderItemID,
    orderItemNetUid: sold.MovementOrderItemNetUid,
    organizationName: sold.OrganizationName,
    organizationNetUid: sold.OrganizationNetUid,
    qty: RETURN_QTY,
    saleNetUid: sold.SaleNetUid,
    saleNumber: sold.SaleNumber,
    status: RETURN_STATUS,
    statusLabel: RETURN_STATUS_LABEL,
    storageId: income.ToStorageID,
    storageName: income.ToStorageName,
    storageNetUid: await db.scalar<string>(
      `SELECT LOWER(CONVERT(varchar(36), NetUID)) FROM dbo.Storage WHERE ID = @storageId`,
      { storageId: income.ToStorageID },
    ) ?? '',
    vendorCode: income.VendorCode,
  });

  const returnedRows = await db.poll<ReturnProjection>(
    `WITH LotFamily AS (
       SELECT item.ID, item.RemainingQty
       FROM dbo.ConsignmentItem item
       WHERE item.ID = @originalSourceConsignmentItemId
       UNION ALL
       SELECT child.ID, child.RemainingQty
       FROM dbo.ConsignmentItem child
       JOIN LotFamily parent ON child.RootConsignmentItemID = parent.ID
       WHERE child.Deleted = 0
     )
     SELECT
       LOWER(CONVERT(varchar(36), saleReturn.NetUID)) AS SaleReturnNetUid,
       returnItem.Qty AS ReturnQty,
       returnItem.SaleReturnItemStatus AS ReturnStatus,
       orderItem.ReturnedQty AS ReturnedQty,
       COUNT(DISTINCT productIncome.ID) AS ProductIncomeCount,
       COUNT(DISTINCT productIncomeItem.ID) AS ProductIncomeItemCount,
       COALESCE(SUM(DISTINCT productIncomeItem.Qty), 0) AS ProductIncomeQty,
       COALESCE(SUM(DISTINCT productIncomeItem.RemainingQty), 0) AS ProductIncomeRemainingQty,
       COUNT(DISTINCT outbox.ID) AS OutboxCount,
       COUNT(DISTINCT CASE WHEN outbox.CompletedAt IS NOT NULL THEN outbox.ID END) AS OutboxCompleted,
       COUNT(DISTINCT returnConsignmentItem.ID) AS ConsignmentItemCount,
       COALESCE(SUM(DISTINCT returnConsignmentItem.Qty), 0) AS ConsignmentQty,
       MIN(returnConsignmentItem.RootConsignmentItemID) AS ReturnRootConsignmentItemID,
       COUNT(DISTINCT returnMovement.ID) AS ReturnMovementCount,
       COALESCE(SUM(DISTINCT returnMovement.Qty), 0) AS ReturnMovementQty,
       sourceMovement.RemainingQty AS SourceMovementRemainingQty,
       sourceTransferLot.RemainingQty AS SourceTransferLotRemainingQty,
       originalSourceLot.RemainingQty AS OriginalSourceRemainingQty,
       availability.Amount AS ProductAvailabilityAmount,
       (SELECT COALESCE(SUM(RemainingQty), 0) FROM LotFamily) AS FamilyRemainingQty
     FROM dbo.SaleReturn saleReturn
     JOIN dbo.SaleReturnItem returnItem
       ON returnItem.SaleReturnID = saleReturn.ID
      AND returnItem.OrderItemID = @orderItemId
      AND returnItem.Deleted = 0
     JOIN dbo.OrderItem orderItem ON orderItem.ID = returnItem.OrderItemID
     LEFT JOIN dbo.ProductIncomeItem productIncomeItem
       ON productIncomeItem.SaleReturnItemID = returnItem.ID
      AND productIncomeItem.Deleted = 0
     LEFT JOIN dbo.ProductIncome productIncome
       ON productIncome.ID = productIncomeItem.ProductIncomeID
      AND productIncome.Deleted = 0
     LEFT JOIN dbo.ProductIncomeConsignmentOutbox outbox
       ON outbox.ProductIncomeID = productIncome.ID
     LEFT JOIN dbo.Consignment returnConsignment
       ON returnConsignment.ProductIncomeID = productIncome.ID
      AND returnConsignment.Deleted = 0
     LEFT JOIN dbo.ConsignmentItem returnConsignmentItem
       ON returnConsignmentItem.ConsignmentID = returnConsignment.ID
      AND returnConsignmentItem.ProductIncomeItemID = productIncomeItem.ID
      AND returnConsignmentItem.ProductID = @productId
      AND returnConsignmentItem.Deleted = 0
     LEFT JOIN dbo.ConsignmentItemMovement returnMovement
       ON returnMovement.ConsignmentItemID = returnConsignmentItem.ID
      AND returnMovement.ProductIncomeItemID = productIncomeItem.ID
      AND returnMovement.IsIncomeMovement = 1
      AND returnMovement.MovementType = 1
      AND returnMovement.Deleted = 0
     JOIN dbo.ConsignmentItemMovement sourceMovement
       ON sourceMovement.ID = @sourceMovementId
     JOIN dbo.ConsignmentItem sourceTransferLot
       ON sourceTransferLot.ID = @sourceTransferConsignmentItemId
     JOIN dbo.ConsignmentItem originalSourceLot
       ON originalSourceLot.ID = @originalSourceConsignmentItemId
     JOIN dbo.ProductAvailability availability
       ON availability.ProductID = @productId
      AND availability.StorageID = @storageId
      AND availability.Deleted = 0
     WHERE saleReturn.NetUID = @saleReturnNetUid
       AND saleReturn.Deleted = 0
     GROUP BY saleReturn.NetUID, returnItem.Qty, returnItem.SaleReturnItemStatus,
       orderItem.ReturnedQty, sourceMovement.RemainingQty,
       sourceTransferLot.RemainingQty, originalSourceLot.RemainingQty,
       availability.Amount`,
    (rows) => rows.length === 1 && rows[0].OutboxCompleted === 1 &&
      rows[0].ConsignmentItemCount === 1,
    { timeoutMs: 120_000, label: 'return restored exact transferred sale lineage' },
    {
      orderItemId: sold.MovementOrderItemID,
      originalSourceConsignmentItemId: income.SourceConsignmentItemID,
      productId: income.ProductID,
      saleReturnNetUid: createdReturn.saleReturnNetUid,
      sourceMovementId: sold.MovementCountAnchor,
      sourceTransferConsignmentItemId: transferred.TargetConsignmentItemID,
      storageId: income.ToStorageID,
    },
  );
  const returned = returnedRows[0];
  expect(returned.SaleReturnNetUid).toBe(createdReturn.saleReturnNetUid);
  expect(returned.ReturnQty).toBe(RETURN_QTY);
  expect(returned.ReturnStatus).toBe(RETURN_STATUS);
  expect(returned.ReturnedQty).toBe(sold.ReturnedQtyBefore + RETURN_QTY);
  expect(returned.ProductIncomeCount).toBe(1);
  expect(returned.ProductIncomeItemCount).toBe(1);
  expect(returned.ProductIncomeQty).toBe(RETURN_QTY);
  expect(returned.ProductIncomeRemainingQty).toBe(RETURN_QTY);
  expect(returned.OutboxCount).toBe(1);
  expect(returned.OutboxCompleted).toBe(1);
  expect(returned.ConsignmentItemCount).toBe(1);
  expect(returned.ConsignmentQty).toBe(RETURN_QTY);
  expect(returned.ReturnRootConsignmentItemID).toBe(transferred.TargetConsignmentItemID);
  expect(returned.ReturnMovementCount).toBe(1);
  expect(returned.ReturnMovementQty).toBe(RETURN_QTY);
  expect(returned.SourceMovementRemainingQty).toBe(SALE_QTY - RETURN_QTY);
  expect(returned.SourceTransferLotRemainingQty).toBe(0);
  expect(returned.OriginalSourceRemainingQty).toBe(income.IncomeQty - SALE_QTY);
  expect(returned.ProductAvailabilityAmount).toBe(sold.TargetAvailability + RETURN_QTY);
  expect(returned.FamilyRemainingQty).toBe(income.IncomeQty - SALE_QTY + RETURN_QTY);

  entities.record('cross.income-sale-return', {
    invoiceNumber: invoice.invoiceNumber,
    productId: income.ProductID,
    saleId: sold.SaleID,
    saleNetUid: sold.SaleNetUid,
    saleReturnNetUid: returned.SaleReturnNetUid,
    sourceConsignmentItemId: income.SourceConsignmentItemID,
    transferConsignmentItemId: transferred.TargetConsignmentItemID,
    vendorCode: income.VendorCode,
  });
});
