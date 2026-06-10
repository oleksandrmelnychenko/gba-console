# Clients Functional Inventory

This is the parity contract for moving the clients area into `gba_console`.
The target implementation should keep the same business capabilities, while using the new console auth/session/API/layout patterns.

## Current Audit Update (2026-06-10)

The client/supplier micro-surface was freshly re-audited against the current code. No high-confidence active UI parity gap was found in the migrated basics: client/supplier lists, dynamic filters, sort descriptors, reserve days, active switch, exports, role selection, new/edit general/contact/bank/provider fields, editable type/role panel, pricing, structure, perfect-client, sales, recommendations, e-commerce, resources, online-shop clients, and client/supplier cash-flow routes are present in code.

The historical "remaining parity gaps" below are retained as migration notes where useful, but they are not the current missing-list unless a later audit re-confirms a specific item. Remaining work is runtime/backend verification and polish-level behavior such as virtualization differences.

## Source Surface

Main source client files:

- `gba_client/src/code/modules/clients`
- `gba_client/src/actions/client.actions.ts`
- `gba_client/src/store/client`
- `gba_client/src/store/client.fast`
- `gba_client/src/web.api/client.api.ts`
- `gba_client/src/web.api/api.constants.ts`
- `gba_client/src/forms/clients`

Backend sources checked:

- `gba-server/src/Global.Business.Assistant.Api/Controllers/Clients`
- `gba-server/src/Global.Business.Assistant.WebApi/WebApi/RoutingConfiguration/Maps/Clients/ClientsSegments.cs`

## Route Contract

Top-level routes currently in scope:

- `/clients`
- `/clients/new`
- `/clients/new/:step`
- `/clients/edit/:netid`
- `/clients/edit/:netid/:step`
- `/clients/resources`
- `/clients/resources/:step`
- `/clients/accounting-cash-flow/:id`
- `/new-clients-from-ecommerce`
- `/clients-online-shop`
- `/clients-online-shop/client/:netUid`
- `/clients-online-shop/incomplete-sale/:netUid`

Related supplier routes share the same edit client implementation and must be planned together:

- `/suppliers`
- `/suppliers/edit/:netid`
- `/suppliers/edit/:netid/:step`
- `/suppliers/accounting-cash-flow/:id`

## `/clients` List

Source component: `all/clients.view.tsx`.

Must keep:

- Server search through `/search/by/query` with table `Client`.
- Search fields: `RegionCode.Value/Client.FullName/Client.USREOU`.
- Pagination or virtual loading equivalent to source `Limit=30`, `Offset=current length`.
- Total count from `/clients/get/total?type=Buyer`.
- Client type and role filter from `/clients/types/all` plus dynamic filter metadata.
- Active/inactive filter capability. Source UI had the boolean controls mostly disabled; new UI should either implement it cleanly or mark it as intentionally unavailable.
- Export document from `/clients/document?filter=...`.
- Row action modal with:
  - accounting cash flow
  - view/edit
- Permission checks:
  - `Header_NewClient_clientsAllView_PKEY`
  - `AccountingCashFlow_row_clientModal_clientsAll_PKEY`
  - `View_row_clientModal_clientsAll_PKEY`
- Columns:
  - status
  - region code
  - full name
  - TIN
  - SROI
  - USREOU
  - reservation days
  - city
  - district
  - phone
  - email
  - role
- Change active state via `/clients/switch/active?netId=...`.
- Reservation days modal via `/clients/update/order/expire?clientNetId=...&days=...`.
- Subclients panel from row structure action.

Current console status:

- List UI and typed list APIs exist.
- Implemented parity items: total count, wider source column set, dynamic search field metadata from `/filteritems/all?type=0`, active filter, role filter, document export modal, active switch, reserve-days modal, row action modal, create/view/cash-flow permission checks, subclients structure modal, and `Column`/`Dir` sort descriptor payload wiring.
- Residual verification items: source grid virtualization behavior and live backend verification of client sort descriptor effect.

## Suppliers List

Source components: `all/suppliers.view.tsx`, `all/suppliers.modal.tsx`.

Must keep:

- Separate supplier route and title.
- Default create flow should preselect supplier mode.
- Server search with `FilterEntityType.Supplier` (`FilterItem.Type = 7`).
- Total count from `/clients/get/total?type=Provider`.
- Row action modal:
  - supplier accounting cash flow
  - view/edit through `/clients/edit/:netid`
- Columns:
  - status
  - code
  - full name
  - phone
  - current balance
  - email
  - not resident
  - role
- Active state handling shared with clients.
- Export/download modal behavior from the source supplier list.

Current console status:

- `/suppliers` list UI and typed APIs exist.
- Implemented parity items: provider count, supplier search through `FilterItem.Type = 7`, dynamic search field metadata from `/filteritems/all?type=7`, source column set, active filter, supplier role filter, active switch, row action modal, route to shared edit card, route to supplier cash flow, source supplier export modal, shared table layout controls, and `Column`/`Dir` sort descriptor payload wiring.
- Residual verification items: source grid virtualization behavior and live backend verification of supplier sort descriptor/export filter effect.

## New Client Wizard

Sources:

- `new/new.client.view.tsx`
- `new/router.config/new.client.nested.routes.ts`
- `new/wizard/*`
- `shared/components/client.role.selector.*`
- `forms/clients/*`

Wizard steps:

- `/clients/new/role`
- `/clients/new/general-information`
- `/clients/new/contact-information`
- `/clients/new/bank-details`
- `/clients/new/perfect-client`
- `/clients/new/pricing`
- finish/create step

Must keep:

- Role selection based on `/clients/types/all`.
- Permission keys generated by client type and role:
  - `${ClientTypeIcon}_clientsNew_PKEY`
  - `${ClientTypeRoleNameWithoutSpaces}_sub_clientsNew_PKEY`
- Buyer flow hides bank details.
- Supplier flow hides perfect client and shows bank details.
- Session-like draft state across wizard steps.
- Reset draft state when leaving the wizard.
- Parent client support for subclient/trade point creation.
- New client POST `/clients/new?parentId=...`.
- General info fields: USREOU, TIN, name, full name, first/middle/last name, individual/legal entity, region, city, district.
- Contact fields: actual/legal/delivery addresses, phone, mobile, SMS, director/accountant phones, email, fax, ICQ, manager.
- Supplier fields: manufacturer, brand, country, incoterm, incoterm custom text, packing marking, packing marking payment, supplier name/code, not-resident flag, contract documents.
- Supplier bank details: branch code, swift, bank and branch, bank address, account currency/number, IBAN currency/number.
- Pricing step: managers, agreements, active agreement, service payers, product group discounts, uploaded supplier contracts.
- Perfect client selections for buyer flow.

Current console status:

- `/clients/new` and `/clients/new/:step` route to the new console wizard shell.
- Implemented foundation: client type/role loading from `/clients/types/all`, role permission key checks, buyer/provider step visibility, basic general/contact/provider bank fields, create through `/clients/new?parentId=...`, and redirect to `/clients` or `/suppliers`.
- Residual verification items: route-reload draft behavior, live lookup edge cases, and deployed API validation for pricing/agreement, perfect-client, supplier contract document upload, and parent subclient/trade-point flows.

## Edit Client

Sources:

- `edit/edit.client.view.tsx`
- `edit/router.config/edit.client.nested.routing.tsx`
- `edit/components/*`
- shared client form components

Base route:

- `/clients/edit/:netid`

Nested tabs:

- `general-information`
- `contact-information`
- `pricing`
- `sales`
- `perfect-client`
- `client-types`
- `bank-details`
- `e-commerce`
- `most-purchased-products`
- `most-purchased-products/:productNetId`

Currently disabled/commented in source, but noted:

- `e-commerce-users`

Must keep:

- Load client by `/clients/get?netId=...`.
- Save with `/clients/update`.
- Delete with `/clients/delete?netId=...` and confirmation.
- Active checkbox in header.
- Header shortcuts to pricing/agreement/contact data/client type.
- Buyer dynamic tabs:
  - sales
  - perfect client
  - client structure
  - e-commerce
  - recommendations / most purchased products
- Supplier dynamic tab:
  - bank details
- Pricing tab only when `EditClient_Body_EditClientPricingView_PKEY` is allowed.
- E-commerce tab only when `EditClient_Body_EditClientEcommerceView_PKEY` is allowed.
- Header permissions:
  - `EditClient_HEADER_EditClientHeaderClientType_PKEY`
  - `EditClient_HEADER_ActiveCheck_PKEY`
  - `EditClient_HEADER_OnDelete_PKEY`
- Agreement print actions through `/agreements/get/document?netId=...&type=...`.
- Ordered products through `/clients/get/orders/items?netId=...`.
- Client structure and subclient management through:
  - `/clients/all/subclients/client?netId=...`
  - `/clients/all/clientsubclients/client?netId=...`
  - `/clients/clientagreements/all/sub/client?netId=...`
  - `/clients/subclients/clientagreements/any?clientNetId=...`
- Client groups/workplaces:
  - `/clients/new/group?name=...`
  - `/clients/update/client/group`
  - `/clients/all/groups?clientNetId=...`
  - `/clients/new/workplace`
  - `/clients/all/workplaces/by/client?netId=...`
  - `/clients/remove/workplace?netId=...`
  - `/clients/update/workplace`

Current console status:

- `/clients/edit/:netid`, `/clients/edit/:netid/:step`, `/suppliers/edit/:netid`, and `/suppliers/edit/:netid/:step` route to the new console edit shell.
- Implemented foundation: load full client through `/clients/get?netId=...`, first valid tab redirect, buyer/provider dynamic tabs, pricing/e-commerce tab permission checks, active header check permission, delete permission, full object save through `/clients/update`, delete through `/clients/delete?netId=...`, and redirect to `/clients` or `/suppliers`.
- Implemented basic editable fields for general info, contacts, and supplier bank details.
- Residual verification items: backend/live-data validation for field lookups, validation edge cases, agreement print actions, document upload/delete, and route tests.

## Accounting Cash Flow

Sources:

- `all/accounting.cash.flow.client.view.tsx`
- `all/accounting.cash.flow.supplier.client.view.tsx`

Must keep:

- Buyer and supplier cash-flow routes.
- Load current client/supplier.
- Date range filters.
- Agreement selector.
- Cash-flow grid.
- Drill-down panels/modals for income, outcome, sale, resale, supply invoice/order-related rows.
- Export/print through `/accounting/cashflow/document/export`.

## New E-commerce Clients

Source: `all/new.ecommerce.clients.view.tsx`.

Must keep:

- Route `/new-clients-from-ecommerce`.
- Load from `/clients/all/ecommerce`.
- Grid columns:
  - created date
  - status individual/legal entity
  - full name
  - last name
  - first name
  - phone
  - email
  - role
- Row click to `/clients/edit/:netid`.
- Sorting.

Current status:

- Console route is wired to `NewEcommerceClientsPage`.
- API wrapper loads `/clients/all/ecommerce` through the shared console API client.
- Read-only table keeps the source columns, local sortable headers, and row click into the client edit route.

## Online Shop Clients

Sources:

- `online.shop/fast.clients.online.shop.tsx`
- `online.shop/fast.client.all.sales.tsx`
- `online.shop/fast.client.all.sales.page.tsx`
- `online.shop/fast.incomplete.sale.tsx`
- `store/client.fast`

Must keep:

- `/clients-online-shop` list of retail clients from `/retail/clients/all`.
- Search retail clients through `/retail/clients/sales/filtered?value=...`.
- Select client and load cart through `/retail/clients/cart?netId=...`.
- Cart product display: image, vendor code, name, unit price, line total, quantity.
- Sales drawer and page through `/retail/clients/sales?netId=...`.
- `/clients-online-shop/client/:netUid` sales page.
- `/clients-online-shop/incomplete-sale/:netUid` product list from `/sales/misplaced/get?netId=...`.
- Incomplete sales list/update support from:
  - `/sales/misplaced/get/all`
  - `/sales/misplaced/update`

Current status:

- Console route `/clients-online-shop` is wired to `OnlineShopClientsPage`.
- API wrappers cover `/retail/clients/all`, `/retail/clients/sales/filtered?value=...`, `/retail/clients/cart?netId=...`, `/retail/clients/sales?netId=...`, `/sales/misplaced/get?netId=...`, `/sales/misplaced/get/all`, and `/sales/misplaced/update`.
- First UI slice loads/searches retail clients, selects a client, and renders cart product image/name/vendor code/quantity/unit price/line total.
- Sales drawer and `/clients-online-shop/client/:netUid` load shop sales and render expanded product rows.
- `/clients-online-shop/incomplete-sale/:netUid` loads one misplaced sale by sale net uid and renders product rows, skipping rows without product data.

## Resources

Source route: `/clients/resources`.

Nested resources:

- `/clients/resources/regions`
- `/clients/resources/organizations`
- `/clients/resources/currencies`
- `/clients/resources/pricing`
- `/clients/resources/perfect-clients`
- `/clients/resources/tax-inspectation`
- `/clients/resources/map`
- `/clients/resources/storages`
- `/clients/resources/measure-unit`
- `/clients/resources/product-reserve`
- `/clients/resources/carrier`

Must keep:

- Left navigation and direct nested routes.
- New/edit/delete panels where present.
- Region map route.
- Permission-gated add/edit/delete controls.

Current console status:

- `/clients/resources` and `/clients/resources/:step` route to `ClientResourcesPage`.
- Implemented parity items: direct nested step routing, default redirect to `/clients/resources/regions`, side navigation for all source resource sections, loading/error/empty/refresh states, local search on list sections, create/edit/delete for regions, region codes, organizations, tax inspections, currencies, pricing rules, perfect-client parameters, storages, measure units, and carriers, pricing priority changes, calculated-price base/extra-charge handling, organization main payment register selection, buyer role reserve-day editing, permission-gated controls where the source screen had active permission checks, privileged Administrator/GBA permission fallback, and multipart carrier image upload.
- Residual verification items: region map parity and runtime verification of each endpoint against deployed API data.

Resource API groups:

- Regions and region codes:
  - `/regions/all/codes`
  - `/regions/all`
  - `/regions/new`
  - `/regions/update`
  - `/regions/codes/new`
  - `/regions/codes/update`
  - `/regions/delete/?netId=...`
  - `/regions/codes/delete?netId=...`
  - `/regions/codes/get/available`
- Organizations:
  - `/organizations/all`
  - `/organizations/new`
  - `/organizations/update`
  - `/organizations/delete?netId=...`
- Tax inspections:
  - `/tax/inspections/all`
  - `/tax/inspections/get?netId=...`
  - `/tax/inspections/new`
  - `/tax/inspections/update`
  - `/tax/inspections/delete?netId=...`
- Currencies:
  - `/currencies/all`
  - `/currencies/new`
  - `/currencies/update`
  - `/currencies/delete?netId=...`
- Pricing:
  - `/pricings/all`
  - `/pricings/types/all`
  - `/pricings/new`
  - `/pricings/update`
  - `/pricings/delete?netId=...`
  - `/pricings/update/priority?pricingId=...`
- Perfect clients:
  - `/clients/perfect/all/role?id=...`
  - `/clients/perfect/new`
  - `/clients/perfect/update`
  - `/clients/perfect/delete?netId=...`
- Storages:
  - `/storages/all`
  - `/storages/new`
  - `/storages/update`
  - `/storages/delete?netId=...`
- Measure units:
  - `/measureunits/all`
  - `/measureunits/search?value=...`
  - `/measureunits/new`
  - `/measureunits/update`
  - `/measureunits/delete?netId=...`
- Product reserve:
  - client type role reserve days via `/clients/types/roles/update`
  - per-client reserve days via `/clients/update/order/expire?clientNetId=...&days=...`
- Carrier/transporters:
  - `/transporters/types/all`
  - `/transporters/all/type?netId=...`
  - `/transporters/new` via multipart `entity` + optional `image`
  - `/transporters/update` via multipart `entity` + optional `image`
  - `/transporters/delete?netId=...`

Important permission keys seen in resources:

- `REGIONS_ClientsResources_NewRegionBtn_PKEY`
- `REGIONS_ClientsResources_NewBtn_PKEY`
- `REGIONS_ClientsResources_EditBtn_PKEY`
- `REGIONS_ClientsResources_DeleteBtn_PKEY`
- `ORGANIZATIONS_ClientsResources_NewBtn_PKEY`
- `ORGANIZATIONS_ClientsResources_EditBtn_PKEY`
- `ORGANIZATIONS_ClientsResources_DeleteBtn_PKEY`
- `TAX_INSPECTATION_ClientsResources_NewRowBtn_PKEY`
- `TAX_INSPECTATION_ClientsResources_EditRowBtn_PKEY`
- `TAX_INSPECTATION_ClientsResources_DeleteBtn_PKEY`
- `CURRENCIES_ClientsResources_NewBtn_PKEY`
- `CURRENCIES_ClientsResources_EditBtn_PKEY`
- `CURRENCIES_ClientsResources_DeleteBtn_PKEY`
- `PRICING_ClientsResources_NewBtn_PKEY`
- `PRICING_ClientsResources_EditBtn_PKEY`
- `PRICING_ClientsResources_DeleteBtn_PKEY`
- `PRICING_ClientsResources_Priority_PKEY`
- `PERFECTCLIENT_ClientsResources_NewBtn_PKEY`
- `PERFECTCLIENT_ClientsResources_EditBtn_PKEY`
- `PERFECTCLIENT_ClientsResources_DeleteBtn_PKEY`
- `STORAGES_ClientsResources_NewBtn_PKEY`
- `STORAGES_ClientsResources_EditBtn_PKEY`
- `STORAGES_ClientsResources_DeleteBtn_PKEY`
- `MEASURE_UNIT_ClientsResources_NewBtn_PKEY`
- `MEASURE_UNIT_ClientsResources_EditBtn_PKEY`
- `MEASURE_UNIT_ClientsResources_DeleteBtn_PKEY`

## Cross-cutting Data Requirements

Clients slice depends on these shared datasets and controls:

- client types and client type roles
- search filter items and filter operators
- regions and region codes
- countries
- incoterms
- packing markings and packing marking payments
- sales/purchase managers
- organizations
- pricings and pricing types
- product groups and product group discounts
- agreements and agreement documents
- service payers
- delivery recipients
- audit data
- shared download modal behavior
- shared confirmation modal behavior
- shared progress/error/crouton behavior

## Migration Principles

- Preserve route compatibility unless a redirect is explicitly recorded.
- Build typed API clients per capability group instead of recreating source Redux epics.
- Use server-side pagination/search where the backend already supports it.
- Keep permission checks at action level; hiding a button must not be the only protection.
- Avoid hidden draft state in `localStorage` for new code; use route-safe React state plus explicit persistence where a reload must survive.
- Keep source disabled/commented features out of the first UI pass, but record them here so the decision is visible.

## Remaining Verification

The first-pass parity backlog above is historical. The current client/supplier surface is considered migrated; remaining work is targeted runtime verification and polish:

1. Verify `/clients` and `/suppliers` sort descriptors against deployed backend data.
2. Re-check source grid virtualization only if real list sizes make the current table interaction too slow.
3. Re-run `/clients/resources` endpoint checks after backend/API changes, especially region map behavior and multipart carrier upload.
