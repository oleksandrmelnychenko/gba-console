# Clients Migration Slice

Source routes:

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
- `/suppliers`
- `/suppliers/edit/:netid`
- `/suppliers/edit/:netid/:step`
- `/suppliers/accounting-cash-flow/:id`

## Current Status

- Routes are registered in `src/app/routes/consoleRoutes.tsx`.
- `/clients` has the first parity UI/API slice for the list screen.
- `/suppliers` has the first parity UI/API slice for the list screen.
- `/clients/new*`, `/clients/edit*`, and `/suppliers/edit*` have the first route/API shell for form migration.
- `/clients/resources*` has the first resource navigation/read-only loader slice.
- `/new-clients-from-ecommerce` has a read-only UI/API slice with source columns, local sorting, and edit-route row navigation.
- `/clients-online-shop*` has the first retail-client UI/API slice for list, search, client selection, cart preview, shop-sales display, and incomplete-sale product display.
- The full parity contract is tracked in `docs/clients-functional-inventory.md`.
- Accounting routes are still placeholders and must not be considered functionally moved.

## Target

Move the full clients area with route compatibility and full business capability coverage, while rebuilding it on the new console API/auth/layout primitives.

This includes:

- client list
- supplier list
- new client wizard
- edit client tabs
- accounting cash flow
- e-commerce registered clients
- online-shop clients
- client resources
- exports/downloads/modals/permissions used by those flows

## Source Entry Points

- List screen: `gba_client/src/code/modules/clients/all/clients.view.tsx`
- Supplier list: `gba_client/src/code/modules/clients/all/suppliers.view.tsx`
- New client wizard: `gba_client/src/code/modules/clients/new`
- Edit client: `gba_client/src/code/modules/clients/edit`
- Resources: `gba_client/src/code/modules/clients/resources`
- Online shop clients: `gba_client/src/code/modules/clients/online.shop`
- Lightweight client store: `gba_client/src/store/client`
- Fast clients store: `gba_client/src/store/client.fast`
- Existing actions/reducers: `gba_client/src/actions/client.actions.ts`, `gba_client/src/reducers/clients`
- Main entity: `gba_client/src/entities/client.ts`

## Backend Calls

Core list calls:

- `GET /search/by/query?filter=...`
  - server search table: `Client`
  - server filter SQL: `RegionCode.Value/Client.FullName/Client.USREOU`
  - supports `Offset`, `Limit`, `Filter`, `TypeRoleFilter`, `SortDescriptors`, `forReSale`
- `GET /clients/get/total?type=...`
  - clients use `ClientTypeType.Buyer`; suppliers use `ClientTypeType.Provider`
- `GET /clients/types/all`
  - required for client type / role filters
- `GET /filteritems/...`
  - source screen uses dynamic filter metadata
- `GET /clients/document?filter=...`
  - export
- `GET /clients/document?filter=...`
  - supplier export uses the same filtered contract as the suppliers table

Core client actions:

- `GET /clients/get?netId=...`
- `POST /clients/update`
- `POST /clients/new?parentId=...`
- `DELETE /clients/delete?netId=...`
- `GET /clients/switch/active?netId=...`
- `POST /clients/update/order/expire?clientNetId=...&days=...`
- `GET /clients/get/orders/items`
- `GET /agreements/get/document`

Full endpoint inventory is in `docs/clients-functional-inventory.md`.

## Current Verification

This file is the historical migration plan. The active client/supplier implementation is now tracked in
`docs/clients-functional-inventory.md` and `docs/migration-route-matrix.md`.

Remaining client work is verification rather than first-pass migration:

1. Verify `/clients` and `/suppliers` sort descriptors against live backend data.
2. Revisit source grid virtualization only if production-sized lists show real interaction cost.
3. Re-run `/clients/resources` endpoint checks after backend/API changes.

## Done So Far

- Route registry exists for the P1 client routes.
- Shared `/search/by/query` builder exists.
- `/clients` table loads data with count, source-oriented columns, dynamic filter metadata, field/status/role filters, row action modal, export, active switch, reserve-days action, subclients structure modal, sort descriptor payload wiring, and core permission checks.
- `/suppliers` table loads provider data with count, source-oriented columns, dynamic filter metadata, status/role filters, row action modal, export, active switch, sort descriptor payload wiring, shared table layout controls, and provider route wiring.
- `/clients/new*`, `/clients/edit*`, and `/suppliers/edit*` route to console pages backed by typed form APIs.
- `/clients/resources*` renders all source resource sections with direct nested routes, loaders, permission gates, and core write actions for regions, currencies, organizations, pricing, tax inspections, storages, measure units, product reserve, perfect-client role data, and carriers. Simple resource create actions are exposed in the section header, region create validation matches the source limit, protected system carriers are guarded from archive, product-reserve roles deep-link to filtered clients, and perfect-client creation defaults to toggle.
- `/new-clients-from-ecommerce` loads newly registered e-commerce clients from `/clients/all/ecommerce`, keeps source table columns, sorts locally, and opens `/clients/edit/:netid`.
- `/clients-online-shop*` loads retail clients from `/retail/clients/all`, searches through `/retail/clients/sales/filtered`, previews cart items from `/retail/clients/cart`, loads sales from `/retail/clients/sales`, and loads incomplete-sale products from `/sales/misplaced/get`.
- Client permission constants exist for list, new wizard, edit header, pricing, and e-commerce gates.

## Do Not Drop

- Permissions around create/edit/delete/export/cash-flow/resource actions.
- Export/download document flows.
- Supplier-specific behavior.
- Subclient/client-structure behavior.
- Product-group discount behavior in pricing.
- Online-shop client cart/sales/incomplete-sale flows.
- Client resources CRUD screens.
