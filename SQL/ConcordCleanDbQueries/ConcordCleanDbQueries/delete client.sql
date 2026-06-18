USE ConcordDb_V6

DELETE FROM ExchangeRateHistory

DELETE FROM CrossExchangeRateHistory

DELETE FROM GovExchangeRateHistory

DELETE FROM GovCrossExchangeRateHistory

DELETE FROM ProductGroupDiscount

DELETE FROM [ClientBalanceMovement]

DELETE FROM [WorkplaceClientAgreement]

DELETE FROM [ClientAgreement]

DELETE FROM [ClientInRole]

DELETE FROM [DeliveryRecipientAddress]

DELETE FROM [DeliveryRecipient]

DELETE FROM [ClientSubClient]

DELETE FROM [PreOrder]

DELETE FROM [Workplace]

DELETE FROM [ClientGroup]

DELETE FROM [Client]

DELETE FROM [Agreement]

DELETE FROM [SupplyOrganizationDocument]

DELETE FROM [SupplyOrganizationAgreement]

DELETE FROM [SupplyOrganization]

DELETE FROM CompanyCar

DELETE FROM ConsumablesStorage

DELETE FROM ServicePayer

DELETE FROM ClientContractDocument

UPDATE Storage
SET OrganizationID = NULL

UPDATE Organization
SET StorageID = NULL

DELETE FROM Storage

DELETE FROM [Organization]

DELETE FROM [RegionCode]

DELETE FROM Region

--DELETE FROM [RetailClient]
--DELETE FROM [OrganizationClientAgreement]
--DELETE FROM [OrganizationClient]
--DELETE FROM CurrencyTrader
--DELETE FROM CurrencyTraderExchangeRate



