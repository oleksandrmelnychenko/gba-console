USE ConcordDb_V5
DELETE FROM ProductLocation
DELETE FROM ProductLocationHistory
DELETE FROM ShipmentListItem
DELETE FROM ShipmentList

DELETE FROM WarehousesShipment
DELETE FROM ReSaleItem
DELETE FROM ReSale
DELETE FROM ReSaleAvailability
DELETE FROM ExpiredBillUserNotification
DELETE FROM OrderItemBaseShiftStatus
DELETE FROM SaleMerged
DELETE FROM SaleExchangeRate
DELETE FROM ClientInDebt
DELETE FROM Debt
DELETE FROM Sale
DELETE FROM SaleNumber
DELETE FROM OrderPackageItem
DELETE FROM OrderPackage
DELETE FROM SaleReturnItemProductPlacement

DELETE FROM [SaleReturnItem]
DELETE FROM [SaleReturn]
DELETE FROM OrderItemMerged
DELETE FROM ConsignmentItemMovement
DELETE FROM OrderItem
DELETE FROM [Order]
DELETE FROM [ClientShoppingCart]
DELETE FROM [BaseLifeCycleStatus]
DELETE FROM [BaseSalePaymentStatus]
DELETE FROM [RetailClientPaymentImage]
DELETE FROM [RetailClientPaymentImageItem]
DELETE FROM [HistoryinvoiceEdit]

DELETE FROM OrderItemMovement