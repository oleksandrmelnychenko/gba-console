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

---

## Phase 3 — legacy inspection (direct reads, 2026-06-02; the 2 spec workflows returned empty/infra)

### Review confirm + carrier + recipient (sale.single.review.view.tsx)
- **Carrier mandatory**: `OnSaleUpdate`/`OnNewSale` bail with crouton `UnselectedCarrier` if
  `SelectedTransporter.Id === 0` — UNLESS `SelectedTransporter.CssClass === 'self_checkout_item_class'`
  (self-checkout needs no carrier/recipient).
- **Recipient mandatory** (new sale, non-self-checkout): `OnNewSale` bails if `SelectedRecipient.Id === 0`.
- **Set carrier** = `POST /sales/set/change` (`SET_SALE_CARRIER_API`), multipart **FormData {sale, file?}**,
  `GetAuthrizationHeaderWithFileContent` → returns updated sale Body. Distinct action `SetSaleCarrierAction`.
- **Confirm window**: `ConfirmationWindowView` with `OnSaleUpdate` (existing sale) callback; `OnNewSale` for new.
  Create branch: `IsVatSale ? UpdateVATSaleAndGetPaymentDocument(/sales/update/get/payment/document)
  : NewSale(/sales/new) | UpdateSaleFromData(/sales/update/file)`.
- Recipients preloaded from `DeliveryState.DeliveryRecipients`; pre-select from `session.Sale.DeliveryRecipient`
  (+ its `DeliveryRecipientAddresses` → `session.Sale.DeliveryRecipientAddress`).

### Delivery recipients (endpoints — all MISSING in console salesUkraineApi)
`GET /deliveries/recipients/all/client?netId={clientNetId}` → recipient list (each has DeliveryRecipientAddresses[]).
`POST /deliveries/recipients/new` {Name, City, Department, PhoneNumber, …}. `POST /deliveries/recipients/addresses/new`
{RecipientNetId, …}. `POST /sales/update/recipient?netId={saleNetId}` (sale with DeliveryRecipient).
`POST /sales/update/recipient/address?netId={saleNetId}`.

### Carousel data + availability (MISSING — console carousel is search-only)
`POST /products/reservations/current/carousel` + `GET /products/reservations/current/carousel/agreement?clientAgreementNetId=`
(reservation/availability per product: reserved count, available qty, price+VAT). `GET /products/all/availabilities/product?netId=&clientAgreementNetId=`.
`GET /products/get/analogues?productNetId=&clientAgreementNetId=`. Live refresh via reservation-hub
`GetProductWithoutReservedCount` → console `realtimeEvents.productReservationUpdated`.

### Cart totals/recompute
Server-recomputed: add/update order-item returns the recomputed sale (line totals + Sum/VAT/EUR/Local). The
client sends Product+Qty (+ optional price/discount); the server sets PricePerItem/TotalAmount*. The wizard cart
should display server totals (reload sale after each change — already does via onCartChanged) + a totals footer.

### Keyboard state-machine (product step — ~11 states)
ProductSearch→ProductSelection→FullDetail→AnalogueSelection/AnalogueFullDetail→ComponentSelection/…→
EditShoppingCart→ViewImage→Interest. Controllers track previous-state for back-nav; `SkipKeyCode` swallows the
dup keyup. ←/→ move carousel focus, Enter selects/adds, Esc backs out a state, Del removes, F2 edits qty.
Pragmatic console layer: ProductPickerCarousel already does ←/→/Enter; add Esc (clear search) + Del/F2 on the cart.

### merged-sales / future-sales (deeper edge flows — defer unless needed)
Merged: `/clients/all/subclients/client`, `/sales/get/merged`, `/sales/update/merged` — combine sub-client carts
when a client has sub-clients ordering together. Future: `/sales/reservations/new` (IsReservation) when a product
is out of stock. Both are advanced; recommend building after the core finalize (carrier+recipient) lands.

### Build order (new files / non-WIP only; wizard step files are now user-WIP)
1. `new-sale-wizard/newSaleWizardApi.ts` — setSaleCarrier(/sales/set/change FormData), delivery-recipient
   GET/POST, /sales/update/recipient(/address). 2. Review step: carrier-required validation + recipient select +
   finalize via setSaleCarrier then create-branch. 3. Carousel availability enrichment. 4. Totals footer.
5. (later) keyboard Esc/Del/F2, merged, future.
