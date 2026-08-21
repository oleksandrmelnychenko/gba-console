import { expect, test } from '../../fixtures/test';
import { createClientReturn } from '../../flows/returns';
import { acceptSaleForPackingViaList, createSaleViaWizard } from '../../flows/sales';

test.describe.configure({ mode: 'serial' });

const RETURN_QTY = 1;
const SALE_QTY = 2;
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
  DispatchedOutboxCount: number;
  FailedOutboxCount: number;
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
  SourceMovementID: number;
  SourceMovementRemainingBefore: number;
  StorageID: number;
  StorageName: string;
  StorageNetUid: string;
  VendorCode: string;
  ReceiptCount: number;
}

type ReturnSaleCandidate = Pick<ReturnCandidate,
  'AgreementID' | 'ClientID' | 'ClientName' | 'ClientNetUid' |
  'ClientSearchValue' | 'OrderItemID' | 'OrderItemNetUid' |
  'OrganizationID' | 'OrganizationName' | 'OrganizationNetUid' |
  'ProductID' | 'ReturnedQtyBefore' | 'SaleID' | 'SaleNetUid' |
  'SaleNumber' | 'SaleQty' | 'VendorCode'>;

type ReturnMovementCandidate = Pick<ReturnCandidate,
  'AvailabilityBefore' | 'ConsignmentItemID' |
  'ConsignmentItemRemainingBefore' | 'DispatchedOutboxCount' |
  'FailedOutboxCount' | 'OrderItemID' | 'OrderItemNetUid' |
  'ReceiptCount' | 'ReturnedQtyBefore' | 'SaleQty' | 'SourceMovementID' |
  'SourceMovementRemainingBefore' | 'StorageID' | 'StorageName' |
  'StorageNetUid'>;

interface SaleSeedCandidate {
  AgreementID: number;
  AgreementNetUid: string;
  ClientID: number;
  ClientName: string;
  ClientNetUid: string;
  ProductID: number;
  VendorCode: string;
}

interface CreatedInvoiceProjection {
  ChangedToInvoice: string | null;
  IsAcceptedToPacking: boolean;
  LifeCycleType: number;
  PaymentFinalizeCompleted: number;
  SaleNetUid: string;
  SaleNumber: string;
}

interface RecordedSale {
  saleNetUid: string;
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
  test.setTimeout(360_000);

  let saleNetUid = entities.get<RecordedSale>('sale.smoke')?.saleNetUid;
  if (!saleNetUid) {
    const seedCandidates = await db.query<SaleSeedCandidate>(
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
    expect(seedCandidates, 'однозначна пара клієнт+договір+товар для повертабельного продажу знайдена').toHaveLength(1);
    const seed = seedCandidates[0];
    const createdSale = await createSaleViaWizard(page, {
      agreementNetUid: seed.AgreementNetUid,
      clientName: seed.ClientName,
      clientNetUid: seed.ClientNetUid,
      vendorCode: seed.VendorCode,
      qty: SALE_QTY,
    });
    const invoiceRows = await db.poll<CreatedInvoiceProjection>(
      `SELECT
         LOWER(CONVERT(varchar(36), sale.NetUID)) AS SaleNetUid,
         saleNumber.Value AS SaleNumber,
         sale.ChangedToInvoice,
         sale.IsAcceptedToPacking,
         status.SaleLifeCycleType AS LifeCycleType,
         (SELECT COUNT(*) FROM dbo.SalesMutationOperation operation
          WHERE operation.SaleID = sale.ID
            AND operation.SaleNetUid = sale.NetUID
            AND operation.OperationKind = N'sale:finalize-payment-documents'
            AND operation.IsCompleted = 1) AS PaymentFinalizeCompleted
       FROM dbo.Sale sale
       JOIN dbo.SaleNumber saleNumber ON saleNumber.ID = sale.SaleNumberID
       JOIN dbo.BaseLifeCycleStatus status ON status.ID = sale.BaseLifeCycleStatusID
       WHERE sale.Deleted = 0 AND sale.NetUID = @saleNetUid`,
      (rows) => rows.length === 1 && Boolean(rows[0].ChangedToInvoice) &&
        rows[0].LifeCycleType === 1 && rows[0].PaymentFinalizeCompleted === 1,
      { timeoutMs: 30_000, label: 'return prerequisite invoice' },
      { saleNetUid: createdSale.saleNetId },
    );
    saleNetUid = invoiceRows[0].SaleNetUid;
    await acceptSaleForPackingViaList(page, {
      alreadyAccepted: invoiceRows[0].IsAcceptedToPacking,
      saleNetId: saleNetUid,
      saleNumber: invoiceRows[0].SaleNumber,
    });
  }

  const saleRows = await db.query<ReturnSaleCandidate>(
    `SELECT
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
       LOWER(CONVERT(varchar(36), organization.NetUID)) AS OrganizationNetUid
     FROM dbo.Sale s
     JOIN dbo.SaleNumber sn ON sn.ID = s.SaleNumberID
     JOIN dbo.[Order] o ON o.ID = s.OrderID AND o.Deleted = 0
     JOIN dbo.OrderItem oi ON oi.OrderID = o.ID AND oi.Deleted = 0
     JOIN dbo.Product p ON p.ID = oi.ProductID AND p.Deleted = 0
     JOIN dbo.ClientAgreement ca ON ca.ID = s.ClientAgreementID AND ca.Deleted = 0
     JOIN dbo.Client c ON c.ID = ca.ClientID AND c.Deleted = 0
     JOIN dbo.RegionCode regionCode ON regionCode.ID = c.RegionCodeID AND regionCode.Deleted = 0
     JOIN dbo.Agreement agreement ON agreement.ID = ca.AgreementID AND agreement.Deleted = 0
     JOIN dbo.Organization organization ON organization.ID = agreement.OrganizationID AND organization.Deleted = 0
     WHERE s.Deleted = 0
       AND s.IsMerged = 0
       AND s.NetUID = @saleNetUid
       AND s.ChangedToInvoice IS NOT NULL
       AND ISNULL(s.Comment, N'') <> N'Ввід боргів з 1С'
       AND oi.IsFromShiftedItem = 0
       AND oi.Qty - oi.ReturnedQty >= @qty
       AND oi.PricePerItem > 0
       AND oi.ExchangeRateAmount > 0
       AND c.FullName IS NOT NULL AND LEN(c.FullName) BETWEEN 4 AND 80
       AND regionCode.Value IS NOT NULL AND LEN(regionCode.Value) BETWEEN 4 AND 20
       AND p.VendorCode IS NOT NULL AND LEN(p.VendorCode) BETWEEN 5 AND 18
       AND NOT EXISTS (
         SELECT 1
         FROM dbo.DataSyncAccountingSourceTarget accountingTarget
         WHERE accountingTarget.TargetEntityType = N'Sale'
           AND accountingTarget.TargetEntityID = s.ID
           AND accountingTarget.IsCurrent = 1
           AND accountingTarget.IsPrimary = 1
           AND accountingTarget.OwnershipType = 1)
     OPTION (RECOMPILE, MAXDOP 1)`,
    { qty: RETURN_QTY, saleNetUid },
  );
  expect(saleRows, 'точна проведена позиція належить створеному продажу').toHaveLength(1);
  const sale = saleRows[0];
  const saleId = Number(sale.SaleID);
  const organizationId = Number(sale.OrganizationID);
  const productId = Number(sale.ProductID);
  for (const [name, value] of Object.entries({ saleId, organizationId, productId })) {
    expect(Number.isSafeInteger(value) && value > 0, `${name} is a safe positive SQL identity`).toBe(true);
  }

  const movementRows = await db.poll<ReturnMovementCandidate>(
    `SELECT TOP 1
       sourceStorage.ID AS StorageID,
       sourceStorage.Name AS StorageName,
       LOWER(CONVERT(varchar(36), sourceStorage.NetUID)) AS StorageNetUid,
       availability.Amount AS AvailabilityBefore,
       sourceLot.ID AS ConsignmentItemID,
       sourceLot.RemainingQty AS ConsignmentItemRemainingBefore,
       sourceMovement.ID AS SourceMovementID,
       sourceMovement.RemainingQty AS SourceMovementRemainingBefore,
       movementItem.ID AS OrderItemID,
       LOWER(CONVERT(varchar(36), movementItem.NetUID)) AS OrderItemNetUid,
       movementItem.Qty AS SaleQty,
       movementItem.ReturnedQty AS ReturnedQtyBefore,
       (SELECT COUNT(*) FROM dbo.SalesDurableEffectOutbox outbox
        WHERE outbox.SaleID = @saleId
          AND outbox.EffectType = N'sale:consignment-movement'
          AND outbox.DispatchedAt IS NOT NULL) AS DispatchedOutboxCount,
       (SELECT COUNT(*) FROM dbo.SalesDurableEffectOutbox outbox
        WHERE outbox.SaleID = @saleId
          AND outbox.EffectType = N'sale:consignment-movement'
          AND (outbox.DispatchedAt IS NULL OR outbox.LastError IS NOT NULL)) AS FailedOutboxCount,
       (SELECT COUNT(*)
        FROM dbo.SalesDurableEffectReceipt receipt
        JOIN dbo.SalesDurableEffectOutbox outbox ON outbox.EventNetUid = receipt.EventNetUid
        WHERE outbox.SaleID = @saleId
          AND outbox.EffectType = N'sale:consignment-movement'
          AND receipt.ConsumerName = N'sales-consignment-movement') AS ReceiptCount
     FROM dbo.ConsignmentItemMovement sourceMovement
     JOIN dbo.OrderItem movementItem
       ON movementItem.ID = sourceMovement.OrderItemID
      AND movementItem.Deleted = 0
      AND movementItem.ProductID = @productId
     JOIN dbo.[Order] movementOrder
       ON movementOrder.ID = movementItem.OrderID
      AND movementOrder.Deleted = 0
     JOIN dbo.Sale movementSale
       ON movementSale.OrderID = movementOrder.ID
      AND movementSale.ID = @saleId
      AND movementSale.Deleted = 0
     JOIN dbo.ConsignmentItem sourceLot
       ON sourceLot.ID = sourceMovement.ConsignmentItemID
      AND sourceLot.Deleted = 0
      AND sourceLot.ProductID = @productId
     JOIN dbo.Consignment sourceConsignment
       ON sourceConsignment.ID = sourceLot.ConsignmentID
      AND sourceConsignment.Deleted = 0
     JOIN dbo.Storage sourceStorage
       ON sourceStorage.ID = sourceConsignment.StorageID
      AND sourceStorage.Deleted = 0
      AND sourceStorage.OrganizationID = @organizationId
      AND sourceStorage.ForDefective = 0
     JOIN dbo.ProductAvailability availability
       ON availability.ProductID = @productId
      AND availability.StorageID = sourceStorage.ID
      AND availability.Deleted = 0
     WHERE sourceMovement.Deleted = 0
       AND sourceMovement.IsIncomeMovement = 0
       AND sourceMovement.MovementType = 0
       AND sourceMovement.RemainingQty >= @qty
     ORDER BY sourceMovement.ID
     OPTION (RECOMPILE, MAXDOP 1)`,
    (rows) => rows.length === 1 && rows[0].DispatchedOutboxCount === 1 &&
      rows[0].FailedOutboxCount === 0 && rows[0].ReceiptCount === 1,
    {
      timeoutMs: 120_000,
      label: `returnable sale ${JSON.stringify({ saleId, organizationId, productId })}`,
    },
    {
      organizationId,
      productId,
      qty: RETURN_QTY,
      saleId,
    },
  );
  const candidate: ReturnCandidate = { ...sale, ...movementRows[0] };
  expect(
    Number.isSafeInteger(Number(candidate.OrderItemID)) && Number(candidate.OrderItemID) > 0,
    'durable movement resolves the final active order-item revision',
  ).toBe(true);

  const sourceMovementId = candidate.SourceMovementID;

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
  expect(result.SourceMovementRemainingQty).toBe(
    candidate.SourceMovementRemainingBefore - RETURN_QTY,
  );
  expect(result.SourceLotRemainingQty).toBe(candidate.ConsignmentItemRemainingBefore);
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
