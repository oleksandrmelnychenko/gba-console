import { describe, expect, it } from 'vitest'
import {
  LegacyPermissionKeys,
  PermissionAliases,
  PermissionKeys,
} from './permissionKeys'

const EXPECTED_SALES_UKRAINE_KEYS = [
  'sales.ukraine.sale.view',
  'sales.ukraine.sale.open_create_dialog',
  'sales.ukraine.sale.create',
  'sales.ukraine.sale.open_details',
  'sales.ukraine.sale.open_context_menu',
  'sales.ukraine.sale.edit',
  'sales.ukraine.sale.delete',
  'sales.ukraine.sale.open_delivery_details',
  'sales.ukraine.sale.unlock',
  'sales.ukraine.sale.unlock_for_shipping',
  'sales.ukraine.sale.print_consignment_note',
  'sales.ukraine.sale.view_audit',
  'sales.ukraine.sale.sell_without_payment',
  'sales.ukraine.sale.edit_product_comment',
] as const

const EXPECTED_SUPPLIER_ORGANIZATION_KEYS = [
  'services.supplier_organizations.page.view',
  'services.supplier_organizations.supplier.create',
  'services.supplier_organizations.supplier.edit',
  'services.supplier_organizations.supplier.delete',
  'services.supplier_organizations.agreement.create',
  'services.supplier_organizations.agreement.edit',
  'services.supplier_organizations.settlements.open',
  'services.supplier_organizations.overview.open',
] as const

const EXPECTED_PROVIDING_SERVICE_ACT_KEYS = [
  'services.providing_service_acts.page.view',
  'services.providing_service_acts.act.edit',
  'services.providing_service_acts.logistic_way.open',
  'services.providing_service_acts.overview.open',
] as const

const EXPECTED_NEW_PAGE_KEYS = [
  'dashboard.overview.page.view',
  'administration.users.page.view',
  'administration.roles.page.view',
  'administration.vehicle_registry.page.view',
  'accounting.expense_articles.page.view',
  'accounting.advanced_reports.page.view',
  'accounting.outgoing_cashflows.page.view',
  'products.availability.page.view',
  'warehouse_accounting.consignment_balances.page.view',
  'payments.online_shop_payment.page.view',
  'accounting.income_cashflows.page.view',
  'orders.supply_cart.page.view',
  'orders.supply_sales.page.view',
  'services.organisations.page.view',
  'warehouse_accounting.sad.page.view',
  'warehouse_accounting.tax_free_carriers.page.view',
  'warehouse_accounting.tax_free_documents.page.view',
  'warehouse_accounting.tax_free_pack_lists.page.view',
  'sales.online_shop_sales.page.view',
] as const

const EXPECTED_ONLINE_SHOP_SEO_ACTION_KEYS = [
  'administration.online_shop_seo.client.toggle',
  'administration.online_shop_seo.contact.create',
  'administration.online_shop_seo.contact.delete',
  'administration.online_shop_seo.contact.edit',
  'administration.online_shop_seo.general_info.edit',
  'administration.online_shop_seo.payment_info.edit',
  'administration.online_shop_seo.payment_register.select',
  'administration.online_shop_seo.seo_page.edit',
  'administration.online_shop_seo.storage.add',
  'administration.online_shop_seo.storage.remove',
  'administration.online_shop_seo.storage.set_priority',
] as const

describe('newly classified page permission catalog', () => {
  it('contains nineteen unique business page keys and no technical controls', () => {
    const actual = Object.values(PermissionKeys.SystemPages).flatMap(
      Object.values,
    )

    expect(actual).toEqual(EXPECTED_NEW_PAGE_KEYS)
    expect(new Set(actual).size).toBe(EXPECTED_NEW_PAGE_KEYS.length)
    expect(actual.every((key) => key.endsWith('.page.view'))).toBe(true)
  })
})

describe('human-reviewed company resource actions', () => {
  it('contains only the four approved VAT/transporter business actions', () => {
    const actual = [
      ...Object.values(PermissionKeys.ClientResources.VatRate),
      ...Object.values(PermissionKeys.ClientResources.Transporter),
    ]

    expect(actual).toEqual([
      'counterparties.resources.vat_rate.create',
      'counterparties.resources.transporter.create',
      'counterparties.resources.transporter.delete',
      'counterparties.resources.transporter.edit',
    ])
    expect(new Set(actual).size).toBe(4)
  })
})

describe('human-reviewed vehicle registry actions', () => {
  it('contains four business permissions and no technical form controls', () => {
    const actual = [
      ...Object.values(PermissionKeys.VehicleRegistry.Vehicle),
      ...Object.values(PermissionKeys.VehicleRegistry.Import),
    ]

    expect(actual).toEqual([
      'administration.vehicle_registry.vehicle.open_details',
      'administration.vehicle_registry.workflow.update',
      'administration.vehicle_registry.import.create',
      'administration.vehicle_registry.import.view_issues',
    ])
    expect(new Set(actual).size).toBe(4)
  })
})

describe('human-reviewed online shop SEO actions', () => {
  it('contains eleven unique business permissions and no technical clicks', () => {
    const actual = [
      ...Object.values(PermissionKeys.OnlineShopSeo.Client),
      ...Object.values(PermissionKeys.OnlineShopSeo.Contact),
      ...Object.values(PermissionKeys.OnlineShopSeo.GeneralInfo),
      ...Object.values(PermissionKeys.OnlineShopSeo.PaymentInfo),
      ...Object.values(PermissionKeys.OnlineShopSeo.PaymentRegister),
      ...Object.values(PermissionKeys.OnlineShopSeo.SeoPage),
      ...Object.values(PermissionKeys.OnlineShopSeo.Storage),
    ]

    expect(actual).toEqual(EXPECTED_ONLINE_SHOP_SEO_ACTION_KEYS)
    expect(new Set(actual).size).toBe(EXPECTED_ONLINE_SHOP_SEO_ACTION_KEYS.length)
  })
})

describe('human-reviewed online shop city actions', () => {
  it('contains create, edit and archive once without modal or confirmation keys', () => {
    const actual = Object.values(PermissionKeys.OnlineShopCities.City)

    expect(actual).toEqual([
      'administration.online_shop_cities.city.archive',
      'administration.online_shop_cities.city.create',
      'administration.online_shop_cities.city.edit',
    ])
    expect(new Set(actual).size).toBe(3)
    expect(PermissionKeys.OnlineShopCities.Page.View).toBe(
      'administration.online_shop_cities.page.view',
    )
  })
})

describe('human-reviewed product pricing actions', () => {
  it('contains one competitor-search business action without trigger duplicates', () => {
    expect(Object.values(PermissionKeys.ProductPricing.CompetitorSearch)).toEqual([
      'products.pricing.competitor_search.run',
    ])
    expect(PermissionKeys.ProductPricing.Page.View).toBe(
      'products.pricing.page.view',
    )
  })
})

describe('human-reviewed product-group actions', () => {
  it('contains create, open-details and edit once without row or pagination keys', () => {
    expect(Object.values(PermissionKeys.ProductGroups.Group)).toEqual([
      'products.groups.group.create',
      'products.groups.group.edit',
      'products.groups.group.open_details',
    ])
    expect(PermissionKeys.ProductGroups.Page.View).toBe(
      'products.groups.page.view',
    )
  })
})

describe('human-reviewed Company Car actions', () => {
  it('keeps car and road-list actions independent without technical draft controls', () => {
    const actual = [
      ...Object.values(PermissionKeys.Warehouses.CompanyCars.Car),
      ...Object.values(PermissionKeys.Warehouses.CompanyCars.RoadList),
    ]

    expect(actual).toEqual([
      'warehouses.company_cars.car.create',
      'warehouses.company_cars.car.delete',
      'warehouses.company_cars.car.edit',
      'warehouses.company_cars.road_list.create',
      'warehouses.company_cars.road_list.delete',
      'warehouses.company_cars.road_list.edit',
      'warehouses.company_cars.road_list.open',
    ])
    expect(new Set(actual).size).toBe(7)
  })
})

describe('human-reviewed product-assortment actions', () => {
  it('adds six missing business rights and reuses the existing analytics page right', () => {
    const actual = [
      ...Object.values(PermissionKeys.ProductsAssortment.Analytics),
      ...Object.values(PermissionKeys.ProductsAssortment.Audit),
      PermissionKeys.ProductsAssortment.Movement.Export,
      ...Object.values(PermissionKeys.ProductsAssortment.Placement),
      ...Object.values(PermissionKeys.ProductsAssortment.StorageHistory),
      PermissionKeys.ProductsAssortment.WriteOffRules.Create,
      PermissionKeys.ProductsAssortment.WriteOffRules.Delete,
    ]

    expect(actual).toEqual([
      'products.assortment_analytics.page.view',
      'products.assortment.audit.open',
      'products.assortment.movement.export',
      'products.assortment.placement.edit',
      'products.assortment.storage_history.open',
      'products.assortment.write_off_rules.create',
      'products.assortment.write_off_rules.delete',
    ])
    expect(new Set(actual).size).toBe(actual.length)
  })
})

describe('human-reviewed act-reconciliation actions', () => {
  it('contains six independent business actions plus the existing page key', () => {
    const actual = [
      ...Object.values(PermissionKeys.ActReconciliations.Page),
      ...Object.values(PermissionKeys.ActReconciliations.Act),
      ...Object.values(PermissionKeys.ActReconciliations.History),
      ...Object.values(PermissionKeys.ActReconciliations.Action),
      ...Object.values(PermissionKeys.ActReconciliations.Disposition),
    ]

    expect(actual).toEqual([
      'orders.reconciliation_acts.page.view',
      'orders.reconciliation_acts.act.open_details',
      'orders.reconciliation_acts.history.view',
      'orders.reconciliation_acts.action.create_product_income',
      'orders.reconciliation_acts.action.create_product_transfer',
      'orders.reconciliation_acts.action.create_write_off',
      'orders.reconciliation_acts.disposition.change',
    ])
    expect(new Set(actual).size).toBe(7)
  })
})

describe('new e-commerce clients review', () => {
  it('reuses client details and adds no row-click permission', () => {
    expect(PermissionKeys.NewEcommerceClients.Page.View).toBe(
      'counterparties.new_ecommerce_clients.page.view',
    )
    expect(PermissionKeys.Clients.Details.Open).toBe(
      'counterparties.clients.details.open',
    )
  })
})

describe('online-shop client review', () => {
  it('contains cart and sales reads once without row or drawer trigger keys', () => {
    expect([
      ...Object.values(PermissionKeys.OnlineShopClients.Cart),
      ...Object.values(PermissionKeys.OnlineShopClients.Sales),
    ]).toEqual([
      'counterparties.online_shop_clients.cart.open',
      'counterparties.online_shop_clients.sales.open',
    ])
  })
})

describe('Sales Ukraine canonical permission catalog', () => {
  it('contains every agreed key exactly once', () => {
    const actual = Object.values(PermissionKeys.SalesUkraine.Sale)

    expect(actual).toEqual(EXPECTED_SALES_UKRAINE_KEYS)
    expect(new Set(actual).size).toBe(EXPECTED_SALES_UKRAINE_KEYS.length)
  })
})

describe('Services canonical permission catalogs', () => {
  it('contains every Supplier Organizations key exactly once', () => {
    const actual = [
      ...Object.values(PermissionKeys.SupplierOrganizations.Page),
      ...Object.values(PermissionKeys.SupplierOrganizations.Supplier),
      ...Object.values(PermissionKeys.SupplierOrganizations.Agreement),
      ...Object.values(PermissionKeys.SupplierOrganizations.Settlements),
      ...Object.values(PermissionKeys.SupplierOrganizations.Overview),
    ]

    expect(actual).toEqual(EXPECTED_SUPPLIER_ORGANIZATION_KEYS)
    expect(new Set(actual).size).toBe(
      EXPECTED_SUPPLIER_ORGANIZATION_KEYS.length,
    )
  })

  it('contains every Providing Service Acts key exactly once', () => {
    const actual = [
      ...Object.values(PermissionKeys.ProvidingServiceActs.Page),
      ...Object.values(PermissionKeys.ProvidingServiceActs.Act),
      ...Object.values(PermissionKeys.ProvidingServiceActs.LogisticWay),
      ...Object.values(PermissionKeys.ProvidingServiceActs.Overview),
    ]

    expect(actual).toEqual(EXPECTED_PROVIDING_SERVICE_ACT_KEYS)
    expect(new Set(actual).size).toBe(
      EXPECTED_PROVIDING_SERVICE_ACT_KEYS.length,
    )
  })
})

describe('human-reviewed supplier-return actions', () => {
  it('contains one detail right and one export right without duplicate row controls', () => {
    const actual = [
      ...Object.values(PermissionKeys.WarehouseAccounting.SupplierReturns.Return),
      ...Object.values(PermissionKeys.WarehouseAccounting.SupplierReturns.Document),
    ]

    expect(actual).toEqual([
      'warehouse_accounting.supplier_returns.return.open_details',
      'warehouse_accounting.supplier_returns.document.export',
    ])
    expect(new Set(actual).size).toBe(2)
  })
})

describe('human-reviewed transporter actions', () => {
  it('contains create, edit and archive once without modal or submit duplicates', () => {
    expect(Object.values(PermissionKeys.Transporters.Transporter)).toEqual([
      'services.transporters.transporter.archive',
      'services.transporters.transporter.create',
      'services.transporters.transporter.edit',
    ])
    expect(PermissionKeys.Transporters.Page.View).toBe(
      'services.transporters.page.view',
    )
  })
})

describe('human-reviewed supplier registry actions', () => {
  it('adds only passport and export while reusing generic client business rights', () => {
    expect([
      ...Object.values(PermissionKeys.Suppliers.Passport),
      ...Object.values(PermissionKeys.Suppliers.Document),
    ]).toEqual([
      'counterparties.suppliers.passport.open',
      'counterparties.suppliers.document.export',
    ])
    expect(PermissionKeys.Suppliers.Page.View).toBe(
      'counterparties.suppliers.page.view',
    )
  })
})

describe('human-reviewed buyer-organization actions', () => {
  it('contains four business actions without local modal or submit duplicates', () => {
    expect(Object.values(PermissionKeys.OrganizationClients.Client)).toEqual([
      'counterparties.buyer_organizations.client.create',
      'counterparties.buyer_organizations.client.open_details',
      'counterparties.buyer_organizations.client.edit',
      'counterparties.buyer_organizations.client.delete',
    ])
    expect(PermissionKeys.OrganizationClients.Page.View).toBe(
      'counterparties.buyer_organizations.page.view',
    )
  })
})

describe('human-reviewed available-payments actions', () => {
  it('contains one page boundary and four unique business capabilities', () => {
    const actual = [
      ...Object.values(PermissionKeys.FinancialAdministration.AvailablePayments.Page),
      ...Object.values(PermissionKeys.FinancialAdministration.AvailablePayments.OutcomeOrder),
      ...Object.values(PermissionKeys.FinancialAdministration.AvailablePayments.Task),
      ...Object.values(PermissionKeys.FinancialAdministration.AvailablePayments.CashFlow),
    ]

    expect(actual).toEqual([
      'payments.available_payments.page.view',
      'payments.available_payments.outcome_order.create',
      'payments.available_payments.task.mark_available',
      'payments.available_payments.task.merge',
      'payments.available_payments.cash_flow.open',
    ])
    expect(new Set(actual).size).toBe(5)
  })
})

describe('human-reviewed income cashflow actions', () => {
  it('contains eight independent capabilities without a duplicate shop-create key', () => {
    const actual = [
      ...Object.values(PermissionKeys.FinancialAdministration.IncomeCashflows.IncomeOrder),
      ...Object.values(PermissionKeys.FinancialAdministration.IncomeCashflows.Order),
    ]

    expect(actual).toEqual([
      'accounting.income_cashflows.client_payment.create',
      'accounting.income_cashflows.supplier_return.create',
      'accounting.income_cashflows.counterparty_income.create',
      'accounting.income_cashflows.other_income.create',
      'accounting.income_cashflows.colleague_return.create',
      'accounting.income_cashflows.order.open_details',
      'accounting.income_cashflows.order.reassign_client',
      'accounting.income_cashflows.order.cancel',
    ])
    expect(new Set(actual).size).toBe(8)
    expect(PermissionKeys.OnlineShopPayment.IncomeOrder.Create).toBe(actual[0])
    expect(PermissionAliases[actual[0]]).toEqual([
      LegacyPermissionKeys.OnlineShopPayment.IncomeOrder.Create,
    ])
  })
})

describe('human-reviewed sale-file report actions', () => {
  it('contains page, export, and print without sheet-tab or filter permissions', () => {
    const actual = [
      ...Object.values(PermissionKeys.ReportsSaleFile.Page),
      ...Object.values(PermissionKeys.ReportsSaleFile.Document),
    ]

    expect(actual).toEqual([
      'reports.sale_file.page.view',
      'reports.sale_file.document.export',
      'reports.sale_file.document.print',
    ])
    expect(new Set(actual).size).toBe(3)
  })
})
