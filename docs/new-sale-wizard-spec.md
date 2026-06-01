# New Sale 3-step wizard — extraction spec (24 agents, 3 passes, 2026-06-02)

Build bible for the faithful migration of the legacy `managers/sale` new-sale master into a
console modal wizard. Runs: `wf_323bc768` (shell/steps/keyboard), `wf_4c82949d` (signals/cart/APIs/heavy),
`wf_ab978f9a` (per-cluster 100%). Legacy root: `gba_client/.../managers/sale`.

## Steps
3 linear steps (session-backed state, `SaleSessionProvider`): **1 Клієнти → 2 Товари → 3 Перевізник/Рев'ю**.
- Step indicator = pivot tabs; back-nav free (click tab); forward-nav gated.
- Gate → step 2: `session.Client && session.ClientAgreement.Id > 0`. Gate → step 3: `session.Sale` exists.
- Final confirm (`ConfirmationWindowView.AsseptQty`): create/update sale, then UNLOAD sales/products/transporters + clear sessions.

## Keyboard (state-machine, 4-tier: Client/Product/Review/PaymentTask)
- Step nav: **Alt+1/Alt+2/Alt+3**. Confirm: **Enter** (in confirmation window) / **Ctrl+Enter**. Cancel/back: **Esc** (honours `SkipKeyCode` to swallow dup keyup). **F2**, **Del**, **Space**, **↑↓←→** (carousel focus/selection).
- Product step has ~11 micro-states (ProductSearch, ProductSelection, FullDetail, Analogue*, Component*, EditShoppingCart, ViewImage, Interest) — carousel consumes keyboard state to move focus. **Build a pragmatic subset first** (step-nav + Enter/Esc + carousel ←/→/Enter); full micro-state machine is a later refinement.

## SignalR (cart realtime via the Reservation hub — no dedicated cart hub)
Hub `/hubs/products/reservation`:
- `NewSaleAdded` → updates cart OrderItems  → console `realtimeEvents.saleAdded` ✓
- `SaleUpdated` → (legacy commented-out!) → console `realtimeEvents.saleUpdated` ✓
- `GetProductWithoutReservedCount` → live availability/reservation counts → console `realtimeEvents.productReservationUpdated` ✓
Also `/hubs/exchangerates` (ExchangeRateUpdated/CrossExchangeRateUpdated → pricing), `/hubs/resale`
(UpdatedReSaleAvailabilities). *Why realtime*: multi-device concurrent edit of the same cart + server-recomputed totals.

## Endpoints — keep vs missing (console = salesUkraineApi unless noted)
STEP 1 Clients: `/clients/payers/search/all` ✓ · `/agreements/client/all` ✓ · `/clients/get/debt/total` ✓ ·
**MISSING** `/clients/all/clientsubclients/client` (sub-sub-clients) · `/clients/all/subclients/client` (merged).
STEP 2 Products/cart: `/products/search/vendorcode` ✓ · `/sales/get/current` ✓ · `/orders/items/new` ✓ ·
`/orders/items/update` ✓ · `/orders/items/delete` ✓ · **MISSING** `/products/reservations/current/carousel/agreement`
(carousel data) · `/products/all/availabilities/product` · `/products/get/analogues`.
STEP 3 Review: `/transporters/types/all` ✓ · `/transporters/all/type(/hidden)` ✓ · `/sales/new` ✓ (createSale) ·
`/sales/update/file` ✓ · `/sales/update/get/payment/document` ✓ (VAT branch) · **MISSING** `/sales/set/change`
(set carrier) · `/deliveries/recipients/all/client` + `/new` + `/sales/update/recipient(/address)`.
Create branch: `IsVatSale ? convertVatSaleAndGetPaymentDocument : createSale/updateSaleFromData`.

## Heavy edge-logic (capture but phase)
Session flags (IsNewSale/IsFromShop/IsFromMergedSale), merged-sales (combine sub-client carts),
invoice-builder (payment types), future sales (`/sales/reservations/*` when no stock), reservation/shift of
available order items, analogues, product-interest. → Phase 2 after the core wizard works.

## File plan (all NEW files — no collision with active sales-ukraine WIP)
`features/sales-ukraine/components/new-sale-wizard/`:
- `newSaleWizardState.ts` — wizard state (client/agreement/cart/review) + step-gating helpers.
- `NewSaleWizard.tsx` — modal shell: Mantine Stepper (3) + keyboard nav + Next/Back gating + final confirm.
- `NewSaleClientStep.tsx` — client payer search + agreement select (reuse existing API).
- `NewSaleProductsStep.tsx` — product picker (carousel) + cart (qty/price/discount/remove + totals) + realtime.
- `NewSaleReviewStep.tsx` — summary + transporter + comment + VAT → create.
`features/products/components/ProductPickerCarousel.tsx` — extracted reusable carousel (from ProductsPage selection mode).
Wire: 1-line swap `NewSaleModal`→`NewSaleWizard` in `SalesUkrainePage` — **handed to the user** (their WIP).
