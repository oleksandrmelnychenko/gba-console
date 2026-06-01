# GBA Console Migration Route Matrix

Generated from `../gba_client/src/code/master.page/routes/route.config.ts`. Keep this file as the migration checklist for moving CRM screens into `gba_console`.

## Migration Rules

- Keep route paths compatible unless there is a deliberate redirect decision.
- Port vertical slices: API/types, list page, edit/create flow, actions/modals, permissions, smoke checks.
- Do not carry previous Redux/epic/SASS structure forward by default; rebuild against the new console API/session/layout primitives.
- Each row should move from `todo` to `route`, `api`, `ui`, `verified`, or `deferred`.

## Summary

- Total old route entries: 141
- P0 foundation: 1
- P1 clients: 12
- P2 products: 15
- P3 admin-directory: 13
- P4 supply-warehouse: 27
- P5 sales-reports: 14
- P6 customs-extra: 15
- P7 accounting: 43
- P9 triage: 1

## Current Status Snapshot

- `ui`: 132
- `route`: 0
- `shell`: 0
- `todo`: 3
- `deferred`: 6
- Poland-specific skipped rows: 3

## Area Counts

| Area | Routes |
| --- | ---: |
| accounting | 43 |
| orders | 14 |
| products | 11 |
| clients | 8 |
| sales | 7 |
| tax-free | 6 |
| sad | 5 |
| product-delivery-protocols | 4 |
| suppliers | 4 |
| users | 4 |
| clients-online-shop | 3 |
| organization-clients | 3 |
| resales | 3 |
| warehouse | 3 |
| act-providing-services | 2 |
| product-groups | 2 |
| reports | 2 |
| supply-orders | 2 |
| ukraine | 2 |
| basket-supply-ukraine-order | 1 |
| dashboard | 1 |
| incomplete-sales-online-shop | 1 |
| new-clients-from-ecommerce | 1 |
| online-shop-cities | 1 |
| online-shop-seo | 1 |
| payments | 1 |
| recommendations | 1 |
| root | 1 |
| sales-online-shop | 1 |
| service | 1 |
| supplies | 1 |
| transporters | 1 |

## Routes

| # | Phase | Area | Source route | Source component | Status | Notes |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | P7 accounting | accounting | `/accounting/consumable-product` | `AllConsumableProductsView` | ui | consumable product categories/products wired with search, create/edit/delete, service-details flag, measure-unit autocomplete, and permission gates |
| 2 | P7 accounting | accounting | `/accounting/company-cars/edit/:id` | `NewCompanyCarView` | ui | company car edit wired with organization lookup, load by NetUid, corrected fuel/mileage validation, tank capacity guard, save, delete, and return navigation |
| 3 | P7 accounting | accounting | `/accounting/company-cars/new` | `NewCompanyCarView` | ui | company car create wired with organization selection, car brand/license plate/tank/fuel/mileage/consumption fields, validation, save, and return navigation |
| 4 | P7 accounting | accounting | `/accounting/company-cars/:id/road-lists` | `AllRoadListsView` | ui | company car road-list screen wired with car load, legacy date range filters, road-list table, create modal, server calculation, outcome order selection, drivers, delete modal, refresh, and return navigation |
| 5 | P7 accounting | accounting | `/accounting/company-cars` | `AllCompanyCarsView` | ui | company cars list wired with search, refresh, create permission gate, edit navigation, road-list navigation, car/fuel/tank/consumption/mileage/organization columns, and stable row actions |
| 6 | P7 accounting | accounting | `/accounting/currency-convertors/edit/:id` | `NewCurrencyConvertorsView` | ui | currency trader edit wired with load by NetUid, personal/contact fields, edit permission gate, save, and return navigation |
| 7 | P7 accounting | accounting | `/accounting/currency-convertors/new` | `NewCurrencyConvertorsView` | ui | currency trader create wired with personal/contact fields, create permission gate, save, and return navigation |
| 8 | P7 accounting | accounting | `/accounting/currency-convertors` | `AllCurrencyConvertorsView` | ui | currency trader list wired with add/edit permissions, trader table, exchange-rate drawer, date range filters, add/edit/delete rates, EUR/USD ordering, and full-date today detection; third old currency intentionally skipped |
| 9 | P7 accounting | accounting | `/accounting/supplier-organizations/cash-flow/:id` | `CashFlowSupplyOrganizationsPage` | ui | supplier organization cash-flow wired with date/type filters, agreement scope, export, and detail drawer |
| 10 | P7 accounting | accounting | `/accounting/supplier-organizations/edit/:id` | `NewSupplyOrganizationView` | ui | supplier organization edit tabs wired for general info, non-PL bank details, contact person, agreements, agreement files, delete, and reload |
| 11 | P7 accounting | accounting | `/accounting/supplier-organizations/new` | `NewSupplyOrganizationView` | ui | supplier organization create form wired with validation and redirect to edit after save |
| 12 | P7 accounting | accounting | `/accounting/supplier-organizations` | `AllSupplyOrganizationsView` | ui | supplier organization list wired with persisted search, reset through empty input, print/export, row action modal, edit, and cash-flow navigation |
| 13 | P7 accounting | accounting | `/accounting/payment-cashflow-articles/edit/:id` | `NewPaymentMovementView` | ui | payment movement edit form wired with load, validation, save, delete, and return navigation |
| 14 | P7 accounting | accounting | `/accounting/payment-cashflow-articles/new` | `NewPaymentMovementView` | ui | payment movement create form wired with validation, save, and return navigation |
| 15 | P7 accounting | accounting | `/accounting/payment-cashflow-articles` | `AllPaymentMovementView` | ui | payment movement list wired with search, refresh, table actions, and edit/create navigation |
| 16 | P7 accounting | accounting | `/accounting/income-cashflows/new/:step` | `NewAccountingIncomeCashOrderView` | ui | client, conversion, user, and shop steps wired; client supports buyer payment, supplier return, and other-with-counterparties for cash/bank with counterparty search, organization/register/currency/agreement state, debt rows, exchange calculation, VAT, auto allocation, and income create; user supports return-from-colleague with organization/register/currency, movement, VAT, accounting flags, and income create; shop supports retail client search or payment-list query params, retail agreements, organization/register/currency, sale debt selection, exchange calculation, auto allocation, and income create |
| 17 | P7 accounting | accounting | `/accounting/income-cashflows/new` | `NewAccountingIncomeCashOrderView` | ui | redirects to the implemented conversion create flow with cash default, preserving a working default instead of the old empty select-option shell |
| 18 | P7 accounting | accounting | `/accounting/income-cashflows` | `AccountingIncomeCashOrderView` | ui | income cashflow list wired with date/search/currency/register/organization filters, load-more paging, cancel action, accounting flags, payer return state, and detail drawer |
| 19 | P7 accounting | accounting | `/accounting/payment-expense-articles/edit/:id` | `NewPaymentCostsMovementView` | ui | payment expense article edit form wired with load, validation, save, delete, and return navigation |
| 20 | P7 accounting | accounting | `/accounting/payment-expense-articles/new` | `NewPaymentCostsMovementView` | ui | payment expense article create form wired with validation, save, and return navigation |
| 21 | P7 accounting | accounting | `/accounting/payment-expense-articles` | `AllPaymentCostsView` | ui | payment expense article list wired with search, refresh, table actions, and edit/create navigation |
| 22 | P7 accounting | accounting | `/accounting/outgoing-cashflow/new` | `OutComeHostView` | ui | create host wired with simple order form, service-supplier balance top-up, client return, group cash/bank operations (supplier payment, buyer return, other-with-counterparty, other funds), old subpath compatibility, and payment-task redirect into available payments |
| 23 | P7 accounting | accounting | `/accounting/outgoing-cashflow/:id/advanced-report/view` | `DetailsAdvanceReportView` | ui | advance report view wired with products/fuel rows, recalculate/remove/save, auto-income checkbox, and fixed total-vs-order amount comparison |
| 24 | P7 accounting | accounting | `/accounting/outgoing-cashflow` | `AccountingOutComeCashOrderView` | ui | outgoing cashflow list wired with date/search filters, currency/register/payment-movement filters, organization multiselect, load-more paging, cancel action, accounting flags, and detail drawer |
| 25 | P7 accounting | accounting | `/accounting/advanced-reports` | `AdvancedReportsView` | ui | advanced reports list wired with date/search filters, currency/register/payment-movement filters, debit/credit totals, row filtering by advance number, and detail drawer |
| 26 | P7 accounting | accounting | `/accounting/consumable-services` | `AllServicesView` | ui | accountable expenses list wired with legacy period filters, search endpoint, item rows, payment status, and detail drawer |
| 27 | P7 accounting | accounting | `/accounting/consumable-orders/pay/:id` | `NewAccountingOutComeProductsView` | ui | consumable order pay route loads target order, recalculates amount, selects organization/register/currency/payment movement, supports inline movement creation, and posts outcome payment |
| 28 | P7 accounting | accounting | `/accounting/consumable-orders/edit/:id` | `NewConsumableOrderView` | ui | consumable order edit form loads supplier/agreement/storage/documents/items, blocks item editing when paid, supports document delete/restore, recalculation, payment-task state, and multipart update |
| 29 | P7 accounting | accounting | `/accounting/consumable-orders/new` | `NewConsumableOrderView` | ui | consumable order create form wired with supplier/agreement, invoice date/time, storage, document upload, item editor, VAT totals, optional payment task, and multipart create |
| 30 | P7 accounting | accounting | `/accounting/consumable-orders` | `AllConsumableOrdersView` | ui | consumable order list wired with legacy date/search filters, invoice/service organization columns, item details, payment structure, and read-only detail drawer |
| 31 | P7 accounting | accounting | `/accounting/storages/edit/:id` | `NewConsumablesStoragesView` | ui | consumable storage edit form wired with load, readonly organization parity, responsible user, validation, save, and return navigation |
| 32 | P7 accounting | accounting | `/accounting/storages/new` | `NewConsumablesStoragesView` | ui | consumable storage create form wired with organization/responsible user lookups, validation, save, and return navigation |
| 33 | P7 accounting | accounting | `/accounting/storages` | `AllConsumablesStoragesView` | ui | consumable storage list wired with search, edit/create/delete, permission gates, responsible and organization fields, product remnants, totals, and read-only written-goods tab |
| 34 | P7 accounting | accounting | `/accounting/payment-accounts/edit/:Id` | `NewAccountingPaymentRegisterView` | ui | payment account edit wired with load, type-specific fields, bank/org/currency lookups, validation, save, delete, and return navigation |
| 35 | P7 accounting | accounting | `/accounting/payment-accounts/new` | `NewAccountingPaymentRegisterView` | ui | payment account create wired for cash/card/bank types, organization/bank/currency selection, opening amounts, and create-to-edit redirect |
| 36 | P7 accounting | accounting | `/accounting/payment-accounts` | `AllAccountingPaymentView` | ui | payment account list wired with search, type and organization filters, add/edit permission gates, currency balances, and total EUR |
| 37 | P7 accounting | accounting | `/accounting/specification-codes` | `ProductSpecificationCodesView` | ui | customs/specification codes list with region+search filters, load-more, edit Change drawer (3-mode) |
| 38 | P7 accounting | accounting | `/accounting/vat-reports` | `VatReportsView` | ui | VAT report list wired with date filters, load-more paging, invoice/facture rows, VAT rate, and EU VAT amount; Poland amount column intentionally skipped |
| 39 | P7 accounting | accounting | `/accounting/advance-payments` | `AllAdvancePaymentsView` | ui | advance payments list wired with legacy one-month date range, amount, VAT, organization, responsible, comment, loading, and empty state |
| 40 | P7 accounting | accounting | `/accounting/available-payments` | `PaymentsAvailableView` | ui | available payments wired with filters, totals, detail drawer tabs, task document upload, move-to-payment, marked tasks, and outcome creation |
| 41 | P7 accounting | accounting | `/accounting/banks` | `AllBanks` | ui | banks list wired with search, add/edit modal, validation, soft delete, and permission gates |
| 42 | P7 accounting | accounting | `/accounting/sync/documents` | `BalancesView` | ui | sync documents wired with date/name/type filters, load-more paging, totals, and document table |
| 43 | P7 accounting | accounting | `/accounting/payment-online-shop` | `AllPaymentOnlineShopRegisterView` | ui | payment shop register wired with sale/payment filters, payment image detail drawer, add/edit image payments, paid/status columns, and create-income-order action into the shop income flow |
| 44 | P6 customs-extra | payments | `/payments/available` | `PaymentsAvailableView` | ui | shared available payments page wired through compatibility route |
| 45 | P4 supply-warehouse | basket-supply-ukraine-order | `/basket-supply-ukraine-order` | `SupplyUkraineBasketPivotView` | ui | basket pivot with cart, sales, recommendations tabs; cart and sales support selection, transfer, totals, and TaxFree/SAD create flows |
| 46 | P6 customs-extra | recommendations | `/recommendations` | `SupplyUkraineSalesBasketRecommendationsView` | ui | wired to basket recommendations tab for compatibility |
| 47 | P5 sales-reports | sales | `/sales` | `SupplyUkraineSalesBasketView` | ui | wired to basket sales tab; preserves one-client selection flow and TaxFree/SAD create flow |
| 48 | P9 triage | root | `/` | `SupplyUkraineBasketView` | deferred | console root redirects to `/dashboard`; basket flow tracked by `/basket-supply-ukraine-order` |
| 49 | P1 clients | clients | `/clients/new/:step` | `NewClientView` | ui | full wizard: role/general/contact/bank/perfect-client/pricing with lookups, validation, subclient flow |
| 50 | P1 clients | clients | `/clients/new` | `NewClientView` | ui | redirects to role step; full wizard migrated |
| 51 | P1 clients | clients | `/clients/edit/:netid/:step` | `EditClientView` | ui | all tabs migrated: general/contact/bank, pricing, structure, perfect-client, sales, recommendations, e-commerce; editable type/role panel |
| 52 | P1 clients | clients | `/clients/edit/:netid` | `EditClientView` | ui | redirects to first edit step; full edit card migrated |
| 53 | P1 clients | clients | `/clients/resources/:step` | `ClientResourcesView` | ui | resource navigation, loaders, CRUD/resource actions, reserve-day editing, carrier multipart upload, and permission gates wired; remaining gaps tracked in `docs/clients-functional-inventory.md` |
| 54 | P1 clients | clients | `/clients/resources` | `ClientResourcesView` | ui | redirects to default resource step |
| 55 | P1 clients | clients | `/clients/accounting-cash-flow/:id` | `AccountingCashFlowClientView` | ui | client cash-flow slice wired with date range, agreement scope, details drawer, and export |
| 56 | P1 clients | clients | `/clients` | `ClientsView` | ui | list parity slice includes dynamic filters, sort descriptors, reserve days, export, active switch, and subclient structure |
| 57 | P0 foundation | dashboard | `/dashboard` | `DashboardPage` | ui | dashboard route registered and lazy-loaded |
| 58 | P1 clients | new-clients-from-ecommerce | `/new-clients-from-ecommerce` | `NewEcommerceClientsView` | ui | read-only table/API slice implemented; row navigation opens client edit |
| 59 | P4 supply-warehouse | orders | `/orders/develop/all/edit/:netUid/specifications` | `SupplySpecificationContainer` | deferred | obsolete: unfinished, unreachable dev prototype (route.config.ts:212, no nav link, renders JSON.stringify stub). Superseded by `SupplySpecificationGridView`, already migrated at `/orders/ukraine/all/edit/:id/specifications` (#69) |
| 64 | P4 supply-warehouse | supply-orders | `/supply-orders/product-placement/:id` | `SupplyProductPlacementView` | ui | read-only supply order product placement view wired to `/products/incomes/supply/order/get`, with order/invoice/packing-list status, product rows, placement positions, VAT/customs/weight totals |
| 67 | P4 supply-warehouse | orders | `/orders/ukraine/all/new` | `NewSupplyOrderView` | ui | direct Ukraine order create-from-file route migrated with supplier/org/agreement selection, delivery type, parse columns, upload error preview, and no inside-country foreign branch |
| 68 | P4 supply-warehouse | orders | `/orders/ukraine/all/edit/:id/supply-invoices` | `SupplyInvoiceOperationView` | ui | direct order invoice/packing-list route wired with order products, invoice and pack-list tabs, permission-gated upload/delete actions, old one-pack-list upload visibility, totals, and reload |
| 69 | P4 supply-warehouse | orders | `/orders/ukraine/all/edit/:id/specifications` | `SupplySpecificationGridView` | ui | direct order specifications wired with invoice/pack-list selection, permission-gated customs-code upload, delivery document upload, downloadable spec documents, vendor-code search, per-row spec-code edit drawer, totals, and currency/accounting toggles |
| 70 | P4 supply-warehouse | orders | `/orders/ukraine/all/edit/:id/product-income` | `SupplyProductIncomeView` | ui | direct order product-income flow wired with order/invoice/packing selectors, organization-scoped storage, placed income header, VAT calc, dynamic columns, remnants move, save/cancel, create/carry out income, vendor-code search, grid parity columns, permission gates, and weight-history audit drawer |
| 71 | P4 supply-warehouse | supply-orders | `/supply-orders/product-placement/:id` | `SupplyProductPlacementView` | ui | duplicate old route covered by shared product placement compatibility page |
| 72 | P4 supply-warehouse | orders | `/orders/ukraine/all/edit/:id` | `SupplyLogisticsPage` | ui | direct order logistic/detail route wired with status badges, supplier/org/agreement/totals, delivery type save tied to amount-edit mode, permission-gated approve/amount edit/credit notes/shortcuts, delivery document upload/status/file removal after shipping, and linked invoice/spec/product-income actions |
| 73 | P4 supply-warehouse | orders | `/orders/ukraine/all/edit/:id/new` | `LogisticPathView` | ui | compatibility alias wired to the direct order logistic/detail route while old nested path remains inactive in navigation |
| 74 | P4 supply-warehouse | orders | `/orders/ukraine/all` | `AllSupplyUkraineOrdersView` | ui | list shell migrated with saved filters, currencies, type split, two-source loading, paging, invoice expand, permission-gated delete, print document modal, and row actions to migrated placement/view/protocol/official-costs/logistic/invoice/spec/product-income routes |
| 75 | P4 supply-warehouse | orders | `/orders/ukraine/all` | `AllUkraineSuppliesView` | deferred | old alternate screen was commented/TODO; covered by main `/orders/ukraine/all` route |
| 76 | P4 supply-warehouse | product-delivery-protocols | `/product-delivery-protocols/:id/product-income` | `ProductDeliveryProtocolIncomePage` | ui | product income placement flow wired with invoice/packing selectors, organization-scoped storage, placed income header, VAT calc, dynamic columns, remnants move, save/cancel, create/carry out income, old dynamic toolbar visibility, vendor-code search, legacy grid columns, dynamic action permission gates, and weight-history audit drawer |
| 77 | P4 supply-warehouse | product-delivery-protocols | `/product-delivery-protocols/:id/specifications` | `ProductDeliveryProtocolSpecification` | ui | specification view wired with invoice/packing selectors, currency/accounting toggles, upload/download/merge flows, delivery document supplier organization/agreement selection, vendor-code search, totals, permission gates, and per-row spec-code edit drawer with product history |
| 78 | P4 supply-warehouse | product-delivery-protocols | `/product-delivery-protocols/:id` | `ProductDeliveryProtocolLogisticPathPage` | ui | logistic path view wired with protocol status/details, invoices, merged invoice numbers, invoice customs declaration, delivery document upload/delete/restore/save, detailed invoice expenses drawer, approved invoice assignment, merged service create/edit/view/calculate/assign/remove, permission gates, and payment-task document display/edit parity |
| 79 | P4 supply-warehouse | product-delivery-protocols | `/product-delivery-protocols` | `ProductDeliveryProtocolPage` | ui | protocols list wired with filters, load more, permission-gated create/export, row options, and option-level logistic/specification/income navigation gates |
| 80 | P4 supply-warehouse | act-providing-services | `/act-providing-services/:id` | `ActProvidintServicePage` | ui | detail view wired with load, date/comment edit, save, and explicit missing-act/error states |
| 81 | P4 supply-warehouse | act-providing-services | `/act-providing-services` | `ActProvidintServiceGridPage` | ui | list wired with date filters, paging, source-state mapping, row option modal, and safe handling for not-yet-migrated linked logistics routes |
| 82 | P4 supply-warehouse | orders | `/orders/ukraine/view/:netid` | `SupplyUkraineOverview` | ui | read/detail view wired with order header, product rows, local search, totals, placement navigation, order/item VAT edit, and order document upload/view/delete-restore flow |
| 83 | P4 supply-warehouse | orders | `/orders/ukraine/placement/:netid` | `SupplyUkrainePlacement` | ui | compatibility route wired to warehouse Ukraine order placement workflow |
| 84 | P4 supply-warehouse | orders | `/orders/ukraine/protocols/:netid` | `SupplyUkrainePaymentProtocolsView` | ui | payment protocols route wired with order/protocol keys loading, protocol create/edit sections, merged service upload, and row action entry |
| 85 | P4 supply-warehouse | orders | `/orders/depreciated` | `DepreciatedOrdersView` | ui | depreciated-orders (write-offs) list with filters, detail drawer (items+placements), exceptions modal, export |
| 86 | P4 supply-warehouse | orders | `/orders/ukraine/:netid/product-income` | `SupplyOrderUkraineProductIncomeView` | ui | compatibility route reuses product placement view with Ukraine-specific income endpoint |
| 87 | P3 admin-directory | organization-clients | `/organization-clients/edit/:netId` | `EditOrganziationClientView` | ui | edit form, agreements, save, and delete wired |
| 88 | P3 admin-directory | organization-clients | `/organization-clients/new` | `NewOrganizationClientView` | ui | create form and agreement add flow wired |
| 89 | P3 admin-directory | organization-clients | `/organization-clients` | `OrganizationClientsView` | ui | list/search/table and row navigation wired |
| 90 | P2 products | products | `/products/income/poland` | `ProductsIncomePolandView` | deferred | skipped: Poland-specific route |
| 91 | P2 products | product-income | `/products/income/ukraine` | `ProductsIncomeUkraineView` | ui | header and empty state wired; source screen has no data load |
| 92 | P2 products | products | `/products/income/documents` | `ProductsIncomeDocumentsView` | ui | list/detail/export and consignment remainings slice wired with persisted filters plus row-level product movement and storage-location history drawers |
| 94 | P2 products | product-transfers | `/products/transfers` | `ProductTransfersView` | ui | list/detail drawer and create-from-file wired |
| 95 | P2 products | product-remains | `/products/storages/incomes` | `StorageRemainsPivot` | ui | batches/products tabs, filters, load-more, drawers, export, and product movement history wired |
| 96 | P2 products | product-storages | `/products/storages` | `ProductStoragesView` | ui | read/list/export slice wired to storage availability endpoints with row-level product movement/storage-location history, permission-gated bulk action preview, editable quantities, validation, transfer, write-off, and return flows |
| 97 | P2 products | product-placements | `/products/placements` | `ProductPlacementsView` | ui | list/search/storage filters, paging, export, import, and returned-products correction wired |
| 98 | P2 products | products | `/products/history` | `ProductPlacementsHistoryView` | ui | read/list/export slice wired with storage multi-select, search, date, and paging |
| 99 | P2 products | products | `/products/capitalization` | `ProductCapitalizationsView` | ui | list/detail/export plus create panel and Excel import-to-items flow wired to capitalization endpoints |
| 100 | P2 products | products | `/products` | `ProductsView` | ui | list/search/filters/table and readonly detail route `/products/:netId` wired |
| 101 | P2 products | product-availabilities | `/products/consignments/availabilities` | `ProductsAvailabilitiesView` | ui | list with storage/date/vendor filters, paging, and export wired |
| 102 | P5 sales-reports | sales | `/sales/allegro/new` | `AddProductToAllegroView` | todo | old line 263 |
| 103 | P5 sales-reports | sales | `/sales/allegro` | `AllegroDashboard` | todo | old line 264 |
| 104 | P5 sales-reports | sales | `/sales/ukraine/all/returns/new` | `ClientReturnsPivot` | ui | returns list/create slice wired with search, paging, drawer, export, cancel, sale-item selection, validation |
| 105 | P5 sales-reports | sales | `/sales/ukraine/all` | `SalesManagerDashboard` | ui | SalesAndInvoices tab fully migrated (feature `sales-ukraine`): grid + filters (date/status/manager/org/client/search) + paginated `/sales/all/filtered`; faithful row actions (documents incl. A/B/C history, discount, ship, will-not-ship, unlock, transporter panel, TTN); SaleMasterView editor (open/edit qty/add/remove/switch agreement/delivery/convert/merges) + new-sale via current cart. Other 8 dashboard tabs (Offers/Debtors/Interest/Returns/ClientProductMovement/Prediction/Charts) deferred |
| 106 | P5 sales-reports | sales | `/sales/poland/all` | `SalesManagerDashboard` | deferred | skipped: Poland-specific route |
| 107 | P5 sales-reports | sales-online-shop | `/sales-online-shop` | `SalesManagerDashboard` | ui | read-only list/detail slice wired to `/sales/all/filtered` with online-shop flags |
| 108 | P5 sales-reports | sales | `/sales/return/client` | `SalesReturnClient` | ui | direct client return creation wired with organization/storage/client/agreement/product/batch selection |
| 109 | P5 sales-reports | incomplete-sales-online-shop | `/incomplete-sales-online-shop` | `IncompleteSalesOnlineShop` | ui | list/filter/detail drawer, assign current user, mark done, and client-sales navigation wired |
| 110 | P5 sales-reports | resales | `/resales/new` | `NewResalePage` | ui | availability filters, manual/automatic process flow, recalculation, create, and selection document export wired |
| 111 | P5 sales-reports | resales | `/resales` | `ResalesPage` | ui | list filters, paging, detail navigation, delete, payment/invoice export, and TTN settings/print wired |
| 112 | P5 sales-reports | resales | `/resales/:id` | `ResalePage` | ui | detail edit/recalculate/save, invoice conversion, completion, exports, and TTN settings/print wired |
| 113 | P6 customs-extra | sad | `/sad/edit/:netid` | `EditSadView` | ui | base SAD edit wired with organization/client/agreement, carrier/car, item editing, save/send, documents, and print-document links |
| 114 | P6 customs-extra | sad | `/sad/edit/:netid/sale` | `EditSaleSadView` | ui | sale SAD edit wired with shared editor, sale update endpoint, documents, and read/send state handling |
| 115 | P6 customs-extra | sad | `/sad/edit/:netid/tir` | `EditTirSadView` | ui | TIR SAD edit wired with organization-client flow, pallet/item move state machine, pallet types, and save/send |
| 116 | P6 customs-extra | sad | `/sad/edit/:id/specifications` | `SpecificationsSadView` | ui | SAD specifications wired with product spec edit, import, refresh, and downloadable document links |
| 117 | P6 customs-extra | sad | `/sad/all` | `AllSadView` | ui | SAD list wired with period filters, pagination/load-more, action modal, edit/spec navigation, and delete guard |
| 118 | P3 admin-directory | service | `/service/organisations` | `OrganisationServicesView` | ui | organization services mutual-settlements search wired with organization autocomplete, service filters, document filters, totals |
| 119 | P3 admin-directory | suppliers | `/suppliers/edit/:netid/:step` | `EditClientView` | ui | shared edit card (provider tabs: general/contact/bank/pricing); supplier passport |
| 120 | P3 admin-directory | suppliers | `/suppliers/edit/:netid` | `EditClientView` | ui | redirects to first edit step; shared edit card migrated |
| 121 | P3 admin-directory | suppliers | `/suppliers/accounting-cash-flow/:id` | `AccountingCashFlowSupplierClientView` | ui | supplier cash-flow slice wired with AccountingType.All, agreement scope, details drawer, and export |
| 122 | P4 supply-warehouse | supplies | `/supplies/returns` | `SupplyReturnsView` | ui | read-only supply-returns list with date filters, detail drawer, document export |
| 123 | P3 admin-directory | suppliers | `/suppliers` | `SuppliersView` | ui | list parity slice includes dynamic filters, sort descriptors, export, active switch, and shared table controls |
| 124 | P6 customs-extra | tax-free | `/tax-free/pack-list/edit/:id` | `EditTaxFreePackListView` | ui | Tax Free pack-list editor wired with source/item movement, split, carrier, documents, print-document links, save, and send |
| 125 | P6 customs-extra | tax-free | `/tax-free/pack-list/all` | `AllTaxFreePackListView` | ui | Tax Free pack-list list wired with period filters, paging, delete guard, export, edit action, and create-order modal |
| 126 | P6 customs-extra | tax-free | `/tax-free/carriers/all` | `AllTaxFreeCarriersView` | ui | carrier list wired with search, archive/restore, car/passport drawers, print permission, and edit navigation |
| 127 | P6 customs-extra | tax-free | `/tax-free/carriers/edit/:id` | `EditTaxFreeCarrierView` | ui | carrier form wired with personal fields, passport drawer, car modal, status/archive handling, and save |
| 128 | P6 customs-extra | tax-free | `/tax-free/carriers/new` | `NewTaxFreeCarrierView` | ui | carrier create form wired with passenger/organization mode, passport drawer, car modal, and save |
| 129 | P6 customs-extra | tax-free | `/tax-free/all` | `AllTaxFreeView` | ui | Tax Free documents list wired with filters, status progression, carrier/passport edit, details drawer, and print preview |
| 130 | P3 admin-directory | transporters | `/transporters` | `TransportersView` | ui | type selection, status filter, table, refresh, and archive action wired |
| 131 | P6 customs-extra | ukraine | `/ukraine/act/reconcoliation/:netid` | `ViewActReconciliationsView` | ui | act reconciliation detail wired with placements, shifts, applied actions, history drawer, save/cancel, approve, and delete |
| 132 | P6 customs-extra | ukraine | `/ukraine/act/reconcoliation` | `AllActReconciliationsView` | ui | act reconciliation list wired with date filters, paging, action modal, create, delete, and detail navigation |
| 133 | P3 admin-directory | users | `/users/new` | `UserView` | ui | create form with role, region, and password validation wired |
| 134 | P3 admin-directory | users | `/users/edit/:netid` | `UserView` | ui | profile edit, delete, and password reset wired |
| 135 | P3 admin-directory | users | `/users/roles` | `UserRolesView` | ui | roles and assigned pages/permissions overview wired |
| 136 | P3 admin-directory | users | `/users` | `UsersView` | ui | list/search/table and row navigation wired |
| 137 | P4 supply-warehouse | warehouse | `/warehouse/poland` | `WarehouseView` | deferred | skipped: Poland-specific route |
| 138 | P4 supply-warehouse | warehouse | `/warehouse/ukraine/orders/:id/placements` | `WarehouseUkraineOrderPlacementsView` | ui | order placements wired with dynamic columns, edit drawer, zero-qty clearing, remnant move, add/remove column, save/cancel and totals |
| 139 | P4 supply-warehouse | warehouse | `/warehouse/ukraine` | `WarehouseView` | ui | shell, invoices, orders, placements, register, verification, editing lists/actions, auto-shipments, all shipments list/edit/print wired |
| 140 | P2 products | product-groups | `/product-groups` | `ProductsGroupsGridView` | ui | list/search/table and create modal wired |
| 141 | P2 products | product-groups | `/product-groups/:id` | `ProductGroupView` | ui | detail edit shell, parent group, subgroups, and products panels wired |
| 142 | P2 products | online-shop-seo | `/online-shop-seo` | `SeoOnlineShopView` | ui | SEO pages, contact info, personnel contacts with photo upload, payment text, shop clients, bank cards, and ecommerce warehouses wired |
| 143 | P2 products | online-shop-cities | `/online-shop-cities` | `FastAllCities` | ui | list/search/create/edit/archive city settings wired |
| 144 | P1 clients | clients-online-shop | `/clients-online-shop` | `FastClientsView` | ui | list/search/cart preview and sales drawer slice implemented |
| 145 | P1 clients | clients-online-shop | `/clients-online-shop/client/:netUid` | `FastClientAllSalesPage` | ui | shop-sales page loads by retail client net uid |
| 146 | P1 clients | clients-online-shop | `/clients-online-shop/incomplete-sale/:netUid` | `FastIncompleteSalePage` | ui | product list loads by misplaced sale net uid |
| 147 | P5 sales-reports | reports | `/reports/stocks` | `ReportsStocksView` | ui | stock report builder wired with measurements, row/column grouping, filters, templates, API export links, CSV preview |
| 148 | P5 sales-reports | reports | `/reports/sale` | `ReportsSaleView` | ui | sale report file viewer wired for XLSX/CSV/TSV/TXT, filters, totals, print, CSV export; legacy XLS rejected to avoid vulnerable parser |
