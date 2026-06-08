# Backend SQL bug report (gba-server) — 2026-06-08

Read-only SQL correctness audit of gba-server money/quantity Dapper queries (run `wf_f54b8671`,
4 areas × 3-vote adversarial verification, several DB-verified against ConcordDb_V5).
**These live in gba-server (the user's repo) — surfaced only, NOT edited here.**

Scope: sales/order/offer totals, product-availability aggregation, accounting cash-flow/balances,
returns. Excluded: DataSync (already reviewed), tax-free, SAD, ecommerce/shop, Poland/PLN, resale,
warehouse/supply.

## HIGH

1. **Dashboard day/month sales total treats absolute `DiscountAmount` as a percent** — produces negative unit prices.
   `Sales/Repositories/SaleRepository.cs:13244`. `PricePerItem - (DiscountAmount/100 * PricePerItem)`.
   `DiscountAmount` is an absolute money line-discount (0..34139 in live data, 49,822 rows >100), and
   `PricePerItem` is already net → double-count + nonsense (e.g. 20.89 → −33.47). Dashboard value-by-day/month
   (VAT + non-VAT) corrupted/negative, up/down arrows flip.
   **Fix:** use net `PricePerItem` directly: `SUM((Qty - ReturnedQty) * PricePerItem)`; never `DiscountAmount/100 * PricePerItem`.

2. **Sales report pivot SUM doesn't re-apply the product/group/Top filter at the aggregation stage** — inflated totals.
   `Report/Repositories/ReportSaleRepository.cs:757`. Stage-2 filters only `ReportSale.ID IN @ids`; a sale qualifies
   if it has ANY matching product, then ALL its lines are summed. Grouped by Day/Org → totals include unrelated products.
   **Fix:** carry the `ProductId IN @ProductIds` / group / Top predicate into the stage-2 WHERE (or restrict the OrderItemHistory join).

3. **Cash-flow period turnover seeded with the opening balance** — turnover overstated by the whole opening balance.
   `Clients/Repositories/ClientCashFlowRepository.cs:1798` (+ 5610-5613, 7877-7880, 9885-9888 — all four active V2 methods).
   `AfterRangeIn/OutAmount` (Обороти за період) are set to `BeforeRange…` then in-period rows added on top.
   Opening IN 100k + 5k in-period → shows 105k.
   **Fix:** init the in-period accumulators to 0 before the row callback (keep `currentStepBalance` from `BeforeRangeBalance`).

4. **PaymentCurrencyRegister opening-balance join uses the wrong key** — income leg of opening balance always 0.
   `PaymentOrders/Repositories/PaymentCurrencyRegisterRepository.cs:955` (+ 1031-1032).
   `JOIN PaymentRegister ON PaymentRegister.ID = PaymentCurrencyRegister.ID` (should be `= PaymentCurrencyRegister.PaymentRegisterID`).
   DB-verified: 0/118 match → income sub-select keyed on NULL → ISNULL→0; prior-period income dropped from opening balance.
   **Fix:** join on `PaymentRegister.ID = PaymentCurrencyRegister.PaymentRegisterID`.

5. **Returns grouped-by-reason `SUM(Qty)` inflated by the `ClientUserProfile` join** — DB-verified 65 → 357 (~5.5×).
   `SaleReturns/Repositories/SaleReturnRepository.cs:1879`. `ClientUserProfile` is 1-to-many (2680 clients have >1, some 11);
   join is unconditional (present even when `forMyClient=false`) → each return item duplicated per profile before SUM.
   **Fix:** only join `ClientUserProfile` when `forMyClient && userId!=0`, or pre-aggregate items / use `EXISTS` for the profile filter.

## MEDIUM

6. **Manager-statistics sale counts miss `Sale.Deleted = 0` (and `IsMerged = 0`)** — counts soft-deleted sales (~6.7% of data).
   `Sales/Repositories/SaleRepository.cs:13042` (sibling at 13139/13155 has the filter). **Fix:** add `AND Sale.Deleted = 0 AND Sale.IsMerged = 0` to both subqueries.

7. **Manager-statistics amount vs count/qty filtered on different date columns** — amount no longer matches counted items.
   `Sales/Repositories/SaleRepository.cs:13112` (amount on `Sale.Updated`, qty/count on `OrderItemMovement.Created`).
   **Fix:** filter the amount metric on `OrderItemMovement.Created` too.

8. **Product search/analogue/component availability sums stock across ALL organizations (no org scoping)** — list overstates vs org-scoped detail page.
   `Products/Repositories/GetMultipleProductsRepository.cs:385` (single-product path gates `storage.OrganizationId == organizationId`, GetSingleProductRepository.cs:158; DB-verified 2 UK orgs hold stock).
   **Fix:** pass + filter `Storage.OrganizationID = @OrganizationId` (and the resale UNION) like the single-product path.

9. **Register opening balance `BeforeRangeTotal` omits `IsCanceled = 0`** on income/outcome/transfer/exchange legs.
   `PaymentOrders/Repositories/PaymentCurrencyRegisterRepository.cs:905` (sibling at 990/999/1008/1017 has it). **Fix:** add `AND …IsCanceled = 0` to each leg.

10. **Under-report (підзвіт) remaining sums `ConsumablesOrderItem` without `Deleted = 0`** — DB-verified 44/56 rows deleted.
    `Accounting/Repositories/AccountingPayableInfoRepository.cs:66` (+ 124/177/377/783/841/894/952; OutcomePaymentOrderRepository.cs:875/1856/3196; sibling 480/1196 has it). **Fix:** add `AND ConsumablesOrderItem.Deleted = 0`.

11. **Cancelled returns (`IsCanceled=1`) counted in all return report totals/qty** — only `Deleted=0` is filtered.
    `SaleReturns/Repositories/SaleReturnRepository.cs:47` (+ the other 3 report queries). Cancel is meant to void (BaseSaleReturnsGetActor:99). **Fix:** add `AND SaleReturn.IsCanceled = 0`.

## LOW

12. **Manager-stats packed-item count uses `DISTINCT COUNT(x)` (no-op) instead of `COUNT(DISTINCT x)`** — multi-movement items over-counted.
    `Sales/Repositories/SaleRepository.cs:13056`. **Fix:** `COUNT(DISTINCT OrderItemMovement.OrderItemID)`.

13. **VAT-resale storage stock added into `AvailableQtyUk` instead of `AvailableQtyUkReSale`** in the list/search/analogue/component mappers — overstates regular UK availability vs the detail page.
    `Products/Repositories/GetMultipleProductsRepository.cs:421` (+ 422/452/530/566/706/…). **Fix:** route VAT-resale qty to `AvailableQtyUkReSale` as the single-product path does. *(Interacts with the console wizard `getSellableQty` fix — once corrected server-side, the console formula `UK + ReSale` stays faithful to legacy.)*

14. **In-period `IncomePaymentOrder` turnover rounded to 14 decimals instead of 2** (V2) — sub-cent mismatch vs the running balance.
    `Clients/Repositories/ClientCashFlowRepository.cs:1987`. **Fix:** `Math.Round(…, 2)`.

## Rejected (verified NOT bugs)
- `GetAllByIds` sale TotalAmount ignoring qty/discount (0/3).
- Cash-flow / register / returns `FromDate <= @To` midnight-boundary (0/3, 0/3, 1/3) — `FromDate` is `datetime2` mostly stored end-of-day, and/or compensated. *(The returns **report-export** frontend already sends end-of-day `to` — commit a74f82f — which is the safe fix regardless.)*
