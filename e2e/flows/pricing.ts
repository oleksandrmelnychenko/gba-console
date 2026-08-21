import type { E2eDb } from '../fixtures/db';

export interface RetailPricingCandidate {
  AgreementNetUid: string;
  PriceSourceIsAmg: boolean;
  ProductNetUid: string;
}

interface RetailPricingProbe {
  RetailPrice: number;
}

export async function selectPricingHealthyCandidate<T extends RetailPricingCandidate>(
  db: E2eDb,
  candidates: T[],
): Promise<T> {
  for (const candidate of candidates) {
    const prices = await db.query<RetailPricingProbe>(
      `DECLARE @SourceModeReady bit = dbo.GetPricingSourceModeReady();

       SELECT TOP (1)
         dbo.GetCalculatedProductPriceForPricingSource(
           @productNetUid,
           pricing.NetUID,
           @agreementNetUid) AS RetailPrice
       FROM views.PricingView pricing
       WHERE pricing.Deleted = 0
         AND pricing.CultureCode = N'uk'
         AND pricing.Name IN (N'ЦР', N'ЦP')
         AND (
           @SourceModeReady = 0
           OR NOT EXISTS (
             SELECT 1
             FROM dbo.PricingSourceDefinition anyDefinition
             WHERE anyDefinition.PricingID = pricing.ID)
           OR EXISTS (
             SELECT 1
             FROM dbo.PricingSourceDefinition sourceDefinition
             WHERE sourceDefinition.PricingID = pricing.ID
               AND sourceDefinition.ImportedForAmg = @forAmg))
         AND dbo.GetCalculatedProductPriceForPricingSource(
           @productNetUid,
           pricing.NetUID,
           @agreementNetUid) IS NOT NULL
       ORDER BY pricing.SortingPriority, pricing.Name
       OPTION (RECOMPILE, MAXDOP 1)`,
      {
        agreementNetUid: candidate.AgreementNetUid,
        forAmg: candidate.PriceSourceIsAmg,
        productNetUid: candidate.ProductNetUid,
      },
    );

    if (prices.length === 1 && Number(prices[0].RetailPrice) > 0) {
      return candidate;
    }
  }

  throw new Error(
    `No candidate has healthy retail source pricing (${candidates.length} candidates checked).`,
  );
}
