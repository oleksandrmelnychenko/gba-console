USE ConcordDb_V6

DELETE FROM ProductProductGroup

DELETE FROM ProductAnalogue

DELETE FROM ProductCarBrand

DELETE FROM ProductOriginalNumber

DELETE FROM ProductSlug

DELETE FROM ProductSpecification

DELETE FROM ProductImage

DELETE FROM [PreOrder]

DELETE FROM ProductSet

DELETE TOP(100000) FROM Product

DELETE FROM EcommerceDefaultPricing

DELETE FROM ProviderPricing

DELETE FROM Pricing