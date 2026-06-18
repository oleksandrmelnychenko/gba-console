USE ConcordDb_V5

-- Disable constraints
--EXEC sp_msforeachtable "ALTER TABLE ? NOCHECK CONSTRAINT ALL";


-- Enable constraints again
--EXEC sp_msforeachtable "ALTER TABLE ? WITH CHECK CHECK CONSTRAINT ALL";

UPDATE [SupplyOrderUkraineItem] SET ConsignmentItemID = NULL

UPDATE [Agreement] SET [AmountDebt] = 0

UPDATE [ClientAgreement] SET [CurrentAmount] = 0

UPDATE [SupplyOrganizationAgreement] SET [CurrentAmount] = 0

DELETE FROM SaleReturnItemProductPlacement
DELETE FROM [SupplyOrderUkraineCartItemReservationProductPlacement]
DELETE FROM [ProductPlacement]
DELETE FROM [SupplyInvoiceMergedService]
DELETE FROM [SupplyInvoiceBillOfLadingService]
DELETE FROM [BillOfLadingDocument]
DELETE FROM [BillOfLadingService]
DELETE FROM [SupplyInvoiceDeliveryDocument]
DELETE FROM [ConsignmentItemMovement]
DELETE FROM [ConsignmentItem]
DELETE FROM CreditNoteDocument
DELETE FROM SadPalletItem
DELETE FROM SadItem
DELETE FROM SadPallet
DELETE FROM Sad
DELETE FROM [SupplyOrderUkraineCartItemReservation]
DELETE FROM [SupplyOrderUkraineCartItem]
DELETE FROM [TaxFreePackListOrderItem]
DELETE FROM [TaxFreeItem]
DELETE FROM [TaxFree]
DELETE FROM [TaxFreePackList]
DELETE FROM [ServiceDetailItem]
DELETE FROM [InvoiceDocument]
DELETE FROM [CustomService]
DELETE FROM [SupplyOrderDeliveryDocument]
DELETE FROM [ProductLocation]
DELETE FROM [ProductPlacementMovement]
DELETE FROM [ProductPlacement]
DELETE FROM [ProductReservation]
DELETE FROM [PackingListPackageOrderItem]
DELETE FROM [PackingListPackage]
DELETE FROM [PackingListDocument]
DELETE FROM [PackingList]
DELETE FROM [SupplyInformationDeliveryProtocol]
DELETE FROM [SupplyOrderPolandPaymentDeliveryProtocol]
DELETE FROM [SupplyOrderPaymentDeliveryProtocol]
DELETE FROM [SupplyOrderUkrainePaymentDeliveryProtocol]
DELETE FROM [OrderProductSpecification]
DELETE FROM [SupplyInvoiceOrderItem]
DELETE FROM [SupplyInvoice]
DELETE FROM [SupplyOrderItem]
DELETE FROM [ResponsibilityDeliveryProtocol]
DELETE FROM [SupplyOrderContainerService]
DELETE FROM [SupplyOrderVehicleService]
DELETE FROM [ContainerService]
DELETE FROM [VehicleService]
DELETE FROM [MergedService]
DELETE FROM [SupplyOrder]
DELETE FROM [SupplyOrderNumber]
DELETE FROM [VehicleDeliveryService]
DELETE FROM [CustomAgencyService]
DELETE FROM [PortCustomAgencyService]
DELETE FROM [PortWorkService]
DELETE FROM [TransportationService]
DELETE FROM [PlaneDeliveryService]
DELETE FROM [SupplyPaymentTaskDocument]

UPDATE [Sale] SET TaxFreePackListID = NULL, SadID = NULL

DELETE FROM [DepreciatedOrderItem]
DELETE FROM [DepreciatedOrder]
DELETE FROM [OutcomePaymentOrderSupplyPaymentTask]
DELETE FROM [ActReconciliationItem]
DELETE FROM [ActReconciliation]
DELETE FROM [ProductTransferItem]
DELETE FROM [ProductTransfer]
DELETE FROM [ProductTransferItem]
DELETE FROM [ProductTransfer]
DELETE FROM [SupplyPaymentTask]
DELETE FROM [DynamicProductPlacement]
DELETE FROM [DynamicProductPlacementRow]
DELETE FROM [DynamicProductPlacementColumn]
DELETE FROM [SadItem]
DELETE FROM [SadDocument]
DELETE FROM [Sad]
DELETE FROM [SupplyOrderUkraineCartItem]
DELETE FROM [TaxFreeItem]
DELETE FROM [TaxFreeDocument]
DELETE FROM [TaxFree]
DELETE FROM [TaxFreePackList]
DELETE FROM [SupplyOrderUkraineItem]
DELETE FROM [SupplyOrderUkraine]
DELETE FROM [SupplyReturnItem]
DELETE FROM [SupplyReturn]
DELETE FROM [ProductIncomeItem]
DELETE FROM [ProductIncome]


DELETE FROM [BillOfLadingDocument]
DELETE FROM [BillOfLadingService]

DELETE FROM [DeliveryProductProtocolNumber]
DELETE FROM [DeliveryProductProtocolDocument]
DELETE FROM [DeliveryProductProtocol]

DELETE FROM [ProductAvailability]

DELETE FROM [MisplacedSale]
DELETE FROM [DeliveryExpense]