export const PermissionKeys = {
  SystemPages: {
    Dashboard: {
      View: 'dashboard.overview.page.view',
    },
    Users: {
      View: 'administration.users.page.view',
    },
    Roles: {
      View: 'administration.roles.page.view',
    },
    VehicleRegistry: {
      View: 'administration.vehicle_registry.page.view',
    },
    ExpenseArticles: {
      View: 'accounting.expense_articles.page.view',
    },
    AdvancedReports: {
      View: 'accounting.advanced_reports.page.view',
    },
    OutgoingCashflows: {
      View: 'accounting.outgoing_cashflows.page.view',
    },
    ProductAvailabilities: {
      View: 'products.availability.page.view',
    },
    IncomeCashflows: {
      View: 'accounting.income_cashflows.page.view',
    },
    SupplyCart: {
      View: 'orders.supply_cart.page.view',
    },
    SupplySales: {
      View: 'orders.supply_sales.page.view',
    },
    ServiceOrganisations: {
      View: 'services.organisations.page.view',
    },
    Sad: {
      View: 'warehouse_accounting.sad.page.view',
    },
    TaxFreeCarriers: {
      View: 'warehouse_accounting.tax_free_carriers.page.view',
    },
    TaxFreeDocuments: {
      View: 'warehouse_accounting.tax_free_documents.page.view',
    },
    TaxFreePackLists: {
      View: 'warehouse_accounting.tax_free_pack_lists.page.view',
    },
  },
  Users: {
    User: {
      OpenDetails: 'administration.users.user.open_details',
      Create: 'administration.users.user.create',
      Edit: 'administration.users.user.edit',
      Delete: 'administration.users.user.delete',
      ResetPassword: 'administration.users.user.password_reset',
    },
  },
  Roles: {
    Role: {
      Create: 'administration.roles.role.create',
      Edit: 'administration.roles.role.edit',
      Delete: 'administration.roles.role.delete',
    },
    PagePermissions: {
      Edit: 'administration.roles.page_permissions.edit',
    },
    PermissionDefinition: {
      Create: 'administration.roles.permission_definition.create',
      Edit: 'administration.roles.permission_definition.edit',
    },
    EventPermissions: {
      Edit: 'administration.roles.event_permissions.edit',
    },
  },
  ActReconciliations: {
    Page: {
      View: 'orders.reconciliation_acts.page.view',
    },
    Act: {
      OpenDetails: 'orders.reconciliation_acts.act.open_details',
    },
    History: {
      View: 'orders.reconciliation_acts.history.view',
    },
    Action: {
      CreateProductIncome: 'orders.reconciliation_acts.action.create_product_income',
      CreateProductTransfer: 'orders.reconciliation_acts.action.create_product_transfer',
      CreateWriteOff: 'orders.reconciliation_acts.action.create_write_off',
    },
    Disposition: {
      Change: 'orders.reconciliation_acts.disposition.change',
    },
  },
  VehicleRegistry: {
    Vehicle: {
      OpenDetails: 'administration.vehicle_registry.vehicle.open_details',
      UpdateWorkflow: 'administration.vehicle_registry.workflow.update',
    },
    Import: {
      Create: 'administration.vehicle_registry.import.create',
      ViewIssues: 'administration.vehicle_registry.import.view_issues',
    },
  },
  ClientResources: {
    Page: {
      View: 'counterparties.company_resources.page.view',
    },
    Country: {
      Create: 'counterparties.resources.country.create',
    },
    Currency: {
      Create: 'counterparties.resources.currency.create',
      Delete: 'counterparties.resources.currency.delete',
      Edit: 'counterparties.resources.currency.edit',
    },
    Incoterm: {
      Create: 'counterparties.resources.incoterm.create',
    },
    MeasureUnit: {
      Create: 'counterparties.resources.measure_unit.create',
      Delete: 'counterparties.resources.measure_unit.delete',
      Edit: 'counterparties.resources.measure_unit.edit',
    },
    Organization: {
      Create: 'counterparties.resources.organization.create',
      Delete: 'counterparties.resources.organization.delete',
      Edit: 'counterparties.resources.organization.edit',
    },
    PerfectClient: {
      Create: 'counterparties.resources.perfect_client.create',
      Delete: 'counterparties.resources.perfect_client.delete',
      Edit: 'counterparties.resources.perfect_client.edit',
    },
    PricingRule: {
      Create: 'counterparties.resources.pricing_rule.create',
      Delete: 'counterparties.resources.pricing_rule.delete',
      Edit: 'counterparties.resources.pricing_rule.edit',
      SetPriority: 'counterparties.resources.pricing_rule.set_priority',
    },
    Region: {
      Create: 'counterparties.resources.region.create',
      Delete: 'counterparties.resources.region.delete',
      Edit: 'counterparties.resources.region.edit',
    },
    RegionCode: {
      Create: 'counterparties.resources.region_code.create',
    },
    Storage: {
      Create: 'counterparties.resources.storage.create',
      Delete: 'counterparties.resources.storage.delete',
      Edit: 'counterparties.resources.storage.edit',
    },
    TaxInspection: {
      Create: 'counterparties.resources.tax_inspection.create',
      Delete: 'counterparties.resources.tax_inspection.delete',
      Edit: 'counterparties.resources.tax_inspection.edit',
    },
    VatRate: {
      Create: 'counterparties.resources.vat_rate.create',
    },
    Transporter: {
      Create: 'counterparties.resources.transporter.create',
      Delete: 'counterparties.resources.transporter.delete',
      Edit: 'counterparties.resources.transporter.edit',
    },
  },
  Clients: {
    Page: {
      View: 'counterparties.clients.page.view',
    },
    AccountingCashFlow: {
      Open: 'counterparties.clients.accounting_cash_flow.open',
      Export: 'counterparties.clients.accounting_cash_flow.export',
    },
    Client: {
      Create: 'counterparties.clients.client.create',
      Edit: 'counterparties.clients.client.edit',
      Delete: 'counterparties.clients.client.delete',
    },
    ClientType: {
      Change: 'counterparties.clients.client_type.change',
      SelectBuyer: 'counterparties.clients.client_type.select_buyer',
      SelectPolishBuyer:
        'counterparties.clients.client_type.select_polish_buyer',
      SelectPolishClient:
        'counterparties.clients.client_type.select_polish_client',
      SelectPolishUaBuyer:
        'counterparties.clients.client_type.select_polish_ua_buyer',
      SelectProductSupplier:
        'counterparties.clients.client_type.select_product_supplier',
      SelectShopClient: 'counterparties.clients.client_type.select_shop_client',
      SelectSupplier: 'counterparties.clients.client_type.select_supplier',
      SelectUkraineBuyer:
        'counterparties.clients.client_type.select_ukraine_buyer',
    },
    Contract: {
      ExportDocument: 'counterparties.clients.contract.export_document',
      Edit: 'counterparties.clients.contract.edit',
      SelectAll: 'counterparties.clients.contract.select_all',
    },
    Details: {
      Open: 'counterparties.clients.details.open',
    },
    Ecommerce: {
      ChangePassword: 'counterparties.clients.ecommerce.change_password',
      Open: 'counterparties.clients.ecommerce.open',
    },
    Pricing: {
      Open: 'counterparties.clients.pricing.open',
    },
    Promotion: {
      EditText: 'counterparties.clients.promotion.edit_text',
      Toggle: 'counterparties.clients.promotion.toggle',
    },
    Status: {
      ToggleActive: 'counterparties.clients.status.toggle_active',
    },
    Document: {
      Export: 'counterparties.clients.document.export',
    },
    ReservationDays: {
      Edit: 'counterparties.clients.reservation_days.edit',
    },
    Structure: {
      Open: 'counterparties.clients.structure.open',
      ManageGroups: 'counterparties.clients.structure.manage_groups',
      ManageWorkplaces: 'counterparties.clients.structure.manage_workplaces',
      DeleteWorkplace: 'counterparties.clients.structure.delete_workplace',
      CreateDeliveryRecipient: 'counterparties.clients.structure.create_delivery_recipient',
      DeleteDeliveryRecipient: 'counterparties.clients.structure.delete_delivery_recipient',
    },
    Recommendations: {
      ExcludeProduct: 'counterparties.clients.recommendations.exclude_product',
    },
    IdentityReview: {
      Open: 'counterparties.clients.identity_review.open',
      Manage: 'counterparties.clients.identity_review.manage',
    },
  },
  Suppliers: {
    Page: {
      View: 'counterparties.suppliers.page.view',
    },
    Passport: {
      Open: 'counterparties.suppliers.passport.open',
    },
    Document: {
      Export: 'counterparties.suppliers.document.export',
    },
  },
  OrganizationClients: {
    Page: {
      View: 'counterparties.buyer_organizations.page.view',
    },
    Client: {
      Create: 'counterparties.buyer_organizations.client.create',
      OpenDetails: 'counterparties.buyer_organizations.client.open_details',
      Edit: 'counterparties.buyer_organizations.client.edit',
      Delete: 'counterparties.buyer_organizations.client.delete',
    },
  },
  FinancialAdministration: {
    Banks: {
      Page: {
        View: 'payments.banks.page.view',
      },
      Bank: {
        Create: 'payments.banks.bank.create',
        Delete: 'payments.banks.bank.delete',
        Save: 'payments.banks.bank.save',
      },
    },
    CashflowArticles: {
      Page: {
        View: 'accounting.cashflow_articles.page.view',
      },
      Article: {
        Create: 'accounting.cashflow_articles.article.create',
        Delete: 'accounting.cashflow_articles.article.delete',
        Save: 'accounting.cashflow_articles.article.save',
      },
    },
    ExpenseArticles: {
      Article: {
        Create: 'accounting.expense_articles.article.create',
        Delete: 'accounting.expense_articles.article.delete',
        Save: 'accounting.expense_articles.article.save',
      },
    },
    CurrencyConvertors: {
      Page: {
        View: 'payments.currency_convertors.page.view',
      },
      Converter: {
        Create: 'payments.currency_convertors.converter.create',
        Edit: 'payments.currency_convertors.converter.edit',
      },
    },
    PaymentAccounts: {
      Page: {
        View: 'payments.payment_accounts.page.view',
      },
      Account: {
        Create: 'payments.payment_accounts.account.create',
        Edit: 'payments.payment_accounts.account.edit',
      },
      Transfer: {
        Create: 'payments.payment_accounts.transfer.create',
        Cancel: 'payments.payment_accounts.transfer.cancel',
      },
      Exchange: {
        Create: 'payments.payment_accounts.exchange.create',
        Cancel: 'payments.payment_accounts.exchange.cancel',
      },
    },
  },
  ProductDeliveryProtocols: {
    Page: {
      View: 'orders.product_delivery_protocols.page.view',
    },
    DeliveryDocuments: {
      Download: 'orders.delivery_protocol.delivery_documents.download',
    },
    Document: {
      Download: 'orders.delivery_protocol.document.download',
    },
    Documents: {
      Download: 'orders.delivery_protocol.documents.download',
    },
    InvoiceManagement: {
      Open: 'orders.delivery_protocol.invoice_management.open',
    },
    LogisticWay: {
      Open: 'orders.delivery_protocol.logistic_way.open',
    },
    Options: {
      Open: 'orders.delivery_protocol.options.open',
    },
    ProductIncome: {
      Open: 'orders.delivery_protocol.product_income.open',
    },
    Protocol: {
      Create: 'orders.delivery_protocol.protocol.create',
    },
    SpecificationCodes: {
      Download: 'orders.delivery_protocol.specification_codes.download',
      Open: 'orders.delivery_protocol.specification_codes.open',
    },
    SpecificationHistory: {
      Open: 'orders.delivery_protocol.specification_history.open',
    },
    UnifiedService: {
      AddInvoice: 'orders.delivery_protocol.unified_service.add_invoice',
      Calculate: 'orders.delivery_protocol.unified_service.calculate',
      ChangeStatus: 'orders.delivery_protocol.unified_service.change_status',
      Create: 'orders.delivery_protocol.unified_service.create',
      Delete: 'orders.delivery_protocol.unified_service.delete',
      Edit: 'orders.delivery_protocol.unified_service.edit',
    },
  },
  ProductsAssortment: {
    Page: {
      View: 'products.assortment.page.view',
    },
    Analytics: {
      Open: 'products.assortment_analytics.page.view',
    },
    Audit: {
      Open: 'products.assortment.audit.open',
    },
    Product: {
      Edit: 'products.assortment.product.edit',
    },
    Specification: {
      Edit: 'products.assortment.specification.edit',
    },
    Image: {
      Upload: 'products.assortment.image.upload',
      Delete: 'products.assortment.image.delete',
    },
    ConsignmentBalances: {
      Open: 'products.assortment.consignment_balances.open',
    },
    Movement: {
      Open: 'products.assortment.movement.open',
      Export: 'products.assortment.movement.export',
    },
    Placement: {
      Edit: 'products.assortment.placement.edit',
    },
    StorageHistory: {
      Open: 'products.assortment.storage_history.open',
    },
    WriteOffRules: {
      Open: 'products.assortment.write_off_rules.open',
      Create: 'products.assortment.write_off_rules.create',
      Delete: 'products.assortment.write_off_rules.delete',
    },
    Document: {
      Upload: 'products.assortment.document.upload',
    },
    Legacy77: {
      Execute: 'products.assortment.legacy_77.execute',
    },
  },
  ConsumableProducts: {
    Page: {
      View: 'services.consumable_products.page.view',
    },
    Category: {
      Create: 'services.consumable_products.category.create',
      Edit: 'services.consumable_products.subcategory.edit',
    },
    Product: {
      Create: 'services.consumable_products.subcategory.create',
      Edit: 'services.consumable_products.category.edit',
      Delete: 'services.consumable_products.category.delete',
    },
  },
  AccountableExpenses: {
    Page: {
      View: 'services.accountable_expenses.page.view',
    },
  },
  ConsumableOrders: {
    Page: {
      View: 'services.consumable_orders.page.view',
    },
    Order: {
      Create: 'services.consumable_orders.order.create',
      Edit: 'services.consumable_orders.order.edit',
      Pay: 'services.consumable_orders.order.pay',
    },
  },
  SupplierOrganizations: {
    Page: {
      View: 'services.supplier_organizations.page.view',
    },
    Supplier: {
      Create: 'services.supplier_organizations.supplier.create',
      Delete: 'services.supplier_organizations.supplier.delete',
    },
    Settlements: {
      Open: 'services.supplier_organizations.settlements.open',
    },
    Overview: {
      Open: 'services.supplier_organizations.overview.open',
    },
  },
  ProvidingServiceActs: {
    Page: {
      View: 'services.providing_service_acts.page.view',
    },
    Act: {
      Edit: 'services.providing_service_acts.act.edit',
    },
    LogisticWay: {
      Open: 'services.providing_service_acts.logistic_way.open',
    },
    Overview: {
      Open: 'services.providing_service_acts.overview.open',
    },
  },
  Transporters: {
    Page: {
      View: 'services.transporters.page.view',
    },
    Transporter: {
      Archive: 'services.transporters.transporter.archive',
      Create: 'services.transporters.transporter.create',
      Edit: 'services.transporters.transporter.edit',
    },
  },
  Warehouses: {
    CompanyCars: {
      Page: {
        View: 'warehouses.company_cars.page.view',
      },
      Car: {
        Create: 'warehouses.company_cars.car.create',
      },
    },
    Premises: {
      Page: {
        View: 'warehouses.premises.page.view',
      },
      Premise: {
        Create: 'warehouses.premises.premise.create',
        Edit: 'warehouses.premises.premise.edit',
        Delete: 'warehouses.premises.premise.delete',
      },
      WriteOff: {
        Create: 'warehouses.premises.write_off.create',
        Edit: 'warehouses.premises.write_off.edit',
        Delete: 'warehouses.premises.write_off.delete',
      },
    },
    Ukraine: {
      Page: {
        View: 'warehouses.ukraine.page.view',
      },
      Invoices: {
        Open: 'warehouses.ukraine.invoices.open',
      },
      Shipments: {
        Open: 'warehouses.ukraine.shipments.open',
      },
      Orders: {
        Open: 'warehouses.ukraine.orders.open',
      },
      Editing: {
        Open: 'warehouses.ukraine.editing.open',
        Process: 'warehouses.ukraine.editing.process',
      },
      InvoiceRegister: {
        Open: 'warehouses.ukraine.invoice_register.open',
        Export: 'warehouses.ukraine.invoice_register.export',
      },
      Verification: {
        Open: 'warehouses.ukraine.verification.open',
        Export: 'warehouses.ukraine.verification.export',
      },
      Shipment: {
        Create: 'warehouses.ukraine.shipment.create',
        Edit: 'warehouses.ukraine.shipment.edit',
        CarryOut: 'warehouses.ukraine.shipment.carry_out',
        Print: 'warehouses.ukraine.shipment.print',
      },
      Invoice: {
        Print: 'warehouses.ukraine.invoice.print',
        PrintEditAct: 'warehouses.ukraine.invoice.print_edit_act',
      },
    },
  },
  WarehouseAccounting: {
    Capitalization: {
      Page: {
        View: 'warehouse_accounting.capitalization.page.view',
      },
      Capitalization: {
        Create: 'warehouse_accounting.capitalization.capitalization.create',
        OpenDetails: 'warehouse_accounting.capitalization.capitalization.open_details',
      },
      Document: {
        Export: 'warehouse_accounting.capitalization.document.export',
      },
    },
    SupplierReturns: {
      Page: {
        View: 'warehouse_accounting.supplier_returns.page.view',
      },
      Return: {
        OpenDetails: 'warehouse_accounting.supplier_returns.return.open_details',
      },
      Document: {
        Export: 'warehouse_accounting.supplier_returns.document.export',
      },
    },
    Storages: {
      Page: {
        View: 'warehouse_accounting.storages.page.view',
      },
      Preview: {
        Open: 'warehouse_accounting.storages.preview.open',
      },
      PositionAction: {
        Open: 'warehouse_accounting.storages.position_action.open',
      },
    },
  },
  OnlineShopSeo: {
    Client: {
      Toggle: 'administration.online_shop_seo.client.toggle',
    },
    Contact: {
      Create: 'administration.online_shop_seo.contact.create',
      Delete: 'administration.online_shop_seo.contact.delete',
      Edit: 'administration.online_shop_seo.contact.edit',
    },
    GeneralInfo: {
      Edit: 'administration.online_shop_seo.general_info.edit',
    },
    Page: {
      View: 'administration.online_shop_seo.page.view',
    },
    PaymentInfo: {
      Edit: 'administration.online_shop_seo.payment_info.edit',
    },
    PaymentRegister: {
      Select: 'administration.online_shop_seo.payment_register.select',
    },
    Resale: {
      Open: 'administration.online_shop_seo.resale.open',
    },
    SeoPage: {
      Edit: 'administration.online_shop_seo.seo_page.edit',
    },
    Storage: {
      Add: 'administration.online_shop_seo.storage.add',
      Remove: 'administration.online_shop_seo.storage.remove',
      SetPriority: 'administration.online_shop_seo.storage.set_priority',
    },
    Synchronization: {
      Run: 'administration.online_shop_seo.synchronization.run',
    },
  },
  OnlineShopCities: {
    Page: {
      View: 'administration.online_shop_cities.page.view',
    },
    City: {
      Archive: 'administration.online_shop_cities.city.archive',
      Create: 'administration.online_shop_cities.city.create',
      Edit: 'administration.online_shop_cities.city.edit',
    },
  },
  OnlineShopClients: {
    Page: {
      View: 'counterparties.online_shop_clients.page.view',
    },
    Cart: {
      Open: 'counterparties.online_shop_clients.cart.open',
    },
    Sales: {
      Open: 'counterparties.online_shop_clients.sales.open',
    },
  },
  NewEcommerceClients: {
    Page: {
      View: 'counterparties.new_ecommerce_clients.page.view',
    },
  },
  IncompleteSalesOnlineShop: {
    Page: {
      View: 'sales.incomplete_online_shop_sales.page.view',
    },
    Sale: {
      AssignToSelf: 'sales.incomplete_online_shop.sale.assign_to_self',
      MarkCompleted: 'sales.incomplete_online_shop.sale.mark_completed',
    },
  },
  ProductGroups: {
    Page: {
      View: 'products.groups.page.view',
    },
    Group: {
      Create: 'products.groups.group.create',
      Edit: 'products.groups.group.edit',
      OpenDetails: 'products.groups.group.open_details',
    },
  },
  ProductPricing: {
    Page: {
      View: 'products.pricing.page.view',
    },
    CompetitorSearch: {
      Run: 'products.pricing.competitor_search.run',
    },
  },
  ProductSpecificationCodes: {
    Page: {
      View: 'products.specification_codes.page.view',
    },
    Code: {
      Edit: 'products.specification_codes.code.edit',
    },
  },
  OrdersUkraine: {
    Page: {
      View: 'orders.ukraine_orders.page.view',
    },
    Invoice: {
      Delete: 'orders.ukraine.invoice.delete',
      Upload: 'orders.ukraine.invoice.upload',
    },
    LogisticWay: {
      AddInvoice: 'orders.ukraine.logistic_way.add_invoice',
      ApproveOrder: 'orders.ukraine.logistic_way.approve_order',
      CreateCreditNote: 'orders.ukraine.logistic_way.create_credit_note',
      CreatePaymentTask: 'orders.ukraine.logistic_way.create_payment_task',
      CreateProforma: 'orders.ukraine.logistic_way.create_proforma',
      DeletePaymentTask: 'orders.ukraine.logistic_way.delete_payment_task',
      EditInvoice: 'orders.ukraine.logistic_way.edit_invoice',
      EditOrderQuantity: 'orders.ukraine.logistic_way.edit_order_quantity',
    },
    Order: {
      AddDeliveryCosts: 'orders.ukraine.order.add_delivery_costs',
      CreatePaymentTask: 'orders.ukraine.order.create_payment_task',
      Delete: 'orders.ukraine.order.delete',
      DownloadDocuments: 'orders.ukraine.order.download_documents',
      OpenArrival: 'orders.ukraine.order.open_arrival',
      OpenLogisticWay: 'orders.ukraine.order.open_logistic_way',
      OpenOrder: 'orders.ukraine.order.open_order',
      OpenOverview: 'orders.ukraine.order.open_overview',
      OpenPlacement: 'orders.ukraine.order.open_placement',
      OpenProductIncome: 'orders.ukraine.order.open_product_income',
      OpenProducts: 'orders.ukraine.order.open_products',
      OpenSpecificationCodes: 'orders.ukraine.order.open_specification_codes',
    },
    PackList: {
      Delete: 'orders.ukraine.pack_list.delete',
      Upload: 'orders.ukraine.pack_list.upload',
    },
    Placement: {
      Calculate: 'orders.ukraine.placement.calculate',
      Capitalize: 'orders.ukraine.placement.capitalize',
      CreateReconciliation: 'orders.ukraine.placement.create_reconciliation',
      OpenProductPlacement: 'orders.ukraine.placement.open_product_placement',
      Post: 'orders.ukraine.placement.post',
      Save: 'orders.ukraine.placement.save',
      UploadDocuments: 'orders.ukraine.placement.upload_documents',
    },
    ProductIncome: {
      Add: 'orders.ukraine.product_income.add',
      Capitalize: 'orders.ukraine.product_income.capitalize',
      Delete: 'orders.ukraine.product_income.delete',
      Post: 'orders.ukraine.product_income.post',
      ViewWeightHistory: 'orders.ukraine.product_income.view_weight_history',
    },
    SpecificationCodes: {
      DownloadApplicationFiles:
        'orders.ukraine.specification_codes.download_application_files',
      DownloadCodes: 'orders.ukraine.specification_codes.download_codes',
      DownloadCustomsDocuments:
        'orders.ukraine.specification_codes.download_customs_documents',
      Edit: 'orders.ukraine.specification_codes.edit',
      ViewHistory: 'orders.ukraine.specification_codes.view_history',
    },
  },
  SalesUkraine: {
    Sale: {
      View: 'sales.ukraine.sale.view',
      OpenCreateDialog: 'sales.ukraine.sale.open_create_dialog',
      Create: 'sales.ukraine.sale.create',
      OpenDetails: 'sales.ukraine.sale.open_details',
      OpenContextMenu: 'sales.ukraine.sale.open_context_menu',
      Edit: 'sales.ukraine.sale.edit',
      Delete: 'sales.ukraine.sale.delete',
      OpenDeliveryDetails: 'sales.ukraine.sale.open_delivery_details',
      Unlock: 'sales.ukraine.sale.unlock',
      UnlockForShipping: 'sales.ukraine.sale.unlock_for_shipping',
      PrintConsignmentNote: 'sales.ukraine.sale.print_consignment_note',
      ViewAudit: 'sales.ukraine.sale.view_audit',
      SellWithoutPayment: 'sales.ukraine.sale.sell_without_payment',
      EditProductComment: 'sales.ukraine.sale.edit_product_comment',
    },
  },
  Resales: {
    Page: {
      View: 'sales.resales.page.view',
    },
    Resale: {
      Create: 'sales.resales.resale.create',
      Edit: 'sales.resales.resale.edit',
      Delete: 'sales.resales.resale.delete',
      ConvertToInvoice: 'sales.resales.resale.convert_to_invoice',
      Complete: 'sales.resales.resale.complete',
    },
    Availability: {
      Export: 'sales.resales.availability.export',
    },
    Document: {
      Export: 'sales.resales.document.export',
    },
    ConsignmentNote: {
      Print: 'sales.resales.consignment_note.print',
    },
  },
  ReportsStocks: {
    Page: {
      View: 'reports.stocks_constructor.page.view',
    },
    Report: {
      Generate: 'reports.stocks_constructor.report.generate',
    },
  },
  AdvancedReports: {
    Report: {
      Open: 'accounting.advanced_reports.report.open',
      Edit: 'accounting.advanced_reports.report.edit',
    },
    DocumentStructure: {
      Open: 'accounting.advanced_reports.document_structure.open',
    },
  },
  OutgoingCashflows: {
    Order: {
      Create: 'accounting.outgoing_cashflows.order.create',
      Cancel: 'accounting.outgoing_cashflows.order.cancel',
    },
  },
  ProductAvailabilities: {
    Document: {
      Export: 'products.availability.document.export',
    },
  },
} as const

export type SalesUkraineSalePermissionKey =
  (typeof PermissionKeys.SalesUkraine.Sale)[keyof typeof PermissionKeys.SalesUkraine.Sale]

export type ResalesPermissionKey =
  | Values<typeof PermissionKeys.Resales.Page>
  | Values<typeof PermissionKeys.Resales.Resale>
  | Values<typeof PermissionKeys.Resales.Availability>
  | Values<typeof PermissionKeys.Resales.Document>
  | Values<typeof PermissionKeys.Resales.ConsignmentNote>

export type ReportsStocksPermissionKey =
  | Values<typeof PermissionKeys.ReportsStocks.Page>
  | Values<typeof PermissionKeys.ReportsStocks.Report>

export type AdvancedReportsPermissionKey =
  | Values<typeof PermissionKeys.AdvancedReports.Report>
  | Values<typeof PermissionKeys.AdvancedReports.DocumentStructure>

export type OutgoingCashflowsPermissionKey =
  Values<typeof PermissionKeys.OutgoingCashflows.Order>

export type ProductAvailabilitiesPermissionKey =
  Values<typeof PermissionKeys.ProductAvailabilities.Document>

type Values<T> = T[keyof T]

export type SystemPagePermissionKey =
  | Values<typeof PermissionKeys.SystemPages.Dashboard>
  | Values<typeof PermissionKeys.SystemPages.Users>
  | Values<typeof PermissionKeys.SystemPages.Roles>
  | Values<typeof PermissionKeys.SystemPages.VehicleRegistry>
  | Values<typeof PermissionKeys.SystemPages.ExpenseArticles>
  | Values<typeof PermissionKeys.SystemPages.AdvancedReports>
  | Values<typeof PermissionKeys.SystemPages.OutgoingCashflows>
  | Values<typeof PermissionKeys.SystemPages.ProductAvailabilities>
  | Values<typeof PermissionKeys.SystemPages.IncomeCashflows>
  | Values<typeof PermissionKeys.SystemPages.SupplyCart>
  | Values<typeof PermissionKeys.SystemPages.SupplySales>
  | Values<typeof PermissionKeys.SystemPages.ServiceOrganisations>
  | Values<typeof PermissionKeys.SystemPages.Sad>
  | Values<typeof PermissionKeys.SystemPages.TaxFreeCarriers>
  | Values<typeof PermissionKeys.SystemPages.TaxFreeDocuments>
  | Values<typeof PermissionKeys.SystemPages.TaxFreePackLists>

export type UsersPermissionKey =
  Values<typeof PermissionKeys.Users.User>

export type RolesPermissionKey =
  | Values<typeof PermissionKeys.Roles.Role>
  | Values<typeof PermissionKeys.Roles.PagePermissions>
  | Values<typeof PermissionKeys.Roles.PermissionDefinition>
  | Values<typeof PermissionKeys.Roles.EventPermissions>

export type VehicleRegistryPermissionKey =
  | Values<typeof PermissionKeys.VehicleRegistry.Vehicle>
  | Values<typeof PermissionKeys.VehicleRegistry.Import>

export type OrdersUkrainePermissionKey =
  | Values<typeof PermissionKeys.OrdersUkraine.Page>
  | Values<typeof PermissionKeys.OrdersUkraine.Invoice>
  | Values<typeof PermissionKeys.OrdersUkraine.LogisticWay>
  | Values<typeof PermissionKeys.OrdersUkraine.Order>
  | Values<typeof PermissionKeys.OrdersUkraine.PackList>
  | Values<typeof PermissionKeys.OrdersUkraine.Placement>
  | Values<typeof PermissionKeys.OrdersUkraine.ProductIncome>
  | Values<typeof PermissionKeys.OrdersUkraine.SpecificationCodes>

export type ClientResourcesPermissionKey =
  | Values<typeof PermissionKeys.ClientResources.Page>
  | Values<typeof PermissionKeys.ClientResources.Currency>
  | Values<typeof PermissionKeys.ClientResources.MeasureUnit>
  | Values<typeof PermissionKeys.ClientResources.Organization>
  | Values<typeof PermissionKeys.ClientResources.PerfectClient>
  | Values<typeof PermissionKeys.ClientResources.PricingRule>
  | Values<typeof PermissionKeys.ClientResources.Region>
  | Values<typeof PermissionKeys.ClientResources.RegionCode>
  | Values<typeof PermissionKeys.ClientResources.Storage>
  | Values<typeof PermissionKeys.ClientResources.TaxInspection>
  | Values<typeof PermissionKeys.ClientResources.VatRate>
  | Values<typeof PermissionKeys.ClientResources.Transporter>

export type ClientsPermissionKey =
  | Values<typeof PermissionKeys.Clients.Page>
  | Values<typeof PermissionKeys.Clients.AccountingCashFlow>
  | Values<typeof PermissionKeys.Clients.Client>
  | Values<typeof PermissionKeys.Clients.ClientType>
  | Values<typeof PermissionKeys.Clients.Contract>
  | Values<typeof PermissionKeys.Clients.Details>
  | Values<typeof PermissionKeys.Clients.Ecommerce>
  | Values<typeof PermissionKeys.Clients.Pricing>
  | Values<typeof PermissionKeys.Clients.Promotion>
  | Values<typeof PermissionKeys.Clients.Status>
  | Values<typeof PermissionKeys.Clients.Document>
  | Values<typeof PermissionKeys.Clients.ReservationDays>
  | Values<typeof PermissionKeys.Clients.Structure>
  | Values<typeof PermissionKeys.Clients.IdentityReview>

export type SuppliersPermissionKey =
  | Values<typeof PermissionKeys.Suppliers.Page>
  | Values<typeof PermissionKeys.Suppliers.Passport>
  | Values<typeof PermissionKeys.Suppliers.Document>

export type OrganizationClientsPermissionKey =
  | Values<typeof PermissionKeys.OrganizationClients.Page>
  | Values<typeof PermissionKeys.OrganizationClients.Client>

export type ProductDeliveryProtocolsPermissionKey =
  | Values<typeof PermissionKeys.ProductDeliveryProtocols.Page>
  | Values<typeof PermissionKeys.ProductDeliveryProtocols.DeliveryDocuments>
  | Values<typeof PermissionKeys.ProductDeliveryProtocols.Document>
  | Values<typeof PermissionKeys.ProductDeliveryProtocols.Documents>
  | Values<typeof PermissionKeys.ProductDeliveryProtocols.InvoiceManagement>
  | Values<typeof PermissionKeys.ProductDeliveryProtocols.LogisticWay>
  | Values<typeof PermissionKeys.ProductDeliveryProtocols.Options>
  | Values<typeof PermissionKeys.ProductDeliveryProtocols.ProductIncome>
  | Values<typeof PermissionKeys.ProductDeliveryProtocols.Protocol>
  | Values<typeof PermissionKeys.ProductDeliveryProtocols.SpecificationCodes>
  | Values<typeof PermissionKeys.ProductDeliveryProtocols.SpecificationHistory>
  | Values<typeof PermissionKeys.ProductDeliveryProtocols.UnifiedService>

export type ProductsAssortmentPermissionKey =
  | Values<typeof PermissionKeys.ProductsAssortment.Page>
  | Values<typeof PermissionKeys.ProductsAssortment.Analytics>
  | Values<typeof PermissionKeys.ProductsAssortment.Audit>
  | Values<typeof PermissionKeys.ProductsAssortment.Product>
  | Values<typeof PermissionKeys.ProductsAssortment.Specification>
  | Values<typeof PermissionKeys.ProductsAssortment.Image>
  | Values<typeof PermissionKeys.ProductsAssortment.ConsignmentBalances>
  | Values<typeof PermissionKeys.ProductsAssortment.Movement>
  | Values<typeof PermissionKeys.ProductsAssortment.Placement>
  | Values<typeof PermissionKeys.ProductsAssortment.StorageHistory>
  | Values<typeof PermissionKeys.ProductsAssortment.WriteOffRules>
  | Values<typeof PermissionKeys.ProductsAssortment.Document>
  | Values<typeof PermissionKeys.ProductsAssortment.Legacy77>

export type ConsumableProductsPermissionKey =
  | Values<typeof PermissionKeys.ConsumableProducts.Page>
  | Values<typeof PermissionKeys.ConsumableProducts.Category>
  | Values<typeof PermissionKeys.ConsumableProducts.Product>

export type ConsumableOrdersPermissionKey =
  | Values<typeof PermissionKeys.AccountableExpenses.Page>
  | Values<typeof PermissionKeys.ConsumableOrders.Page>
  | Values<typeof PermissionKeys.ConsumableOrders.Order>

export type SupplierOrganizationsPermissionKey =
  | Values<typeof PermissionKeys.SupplierOrganizations.Page>
  | Values<typeof PermissionKeys.SupplierOrganizations.Supplier>
  | Values<typeof PermissionKeys.SupplierOrganizations.Settlements>
  | Values<typeof PermissionKeys.SupplierOrganizations.Overview>

export type ProvidingServiceActsPermissionKey =
  | Values<typeof PermissionKeys.ProvidingServiceActs.Page>
  | Values<typeof PermissionKeys.ProvidingServiceActs.Act>
  | Values<typeof PermissionKeys.ProvidingServiceActs.LogisticWay>
  | Values<typeof PermissionKeys.ProvidingServiceActs.Overview>

export type TransportersPermissionKey =
  | Values<typeof PermissionKeys.Transporters.Page>
  | Values<typeof PermissionKeys.Transporters.Transporter>

export type WarehousesPermissionKey =
  | Values<typeof PermissionKeys.Warehouses.CompanyCars.Page>
  | Values<typeof PermissionKeys.Warehouses.CompanyCars.Car>
  | Values<typeof PermissionKeys.Warehouses.Premises.Page>
  | Values<typeof PermissionKeys.Warehouses.Premises.Premise>
  | Values<typeof PermissionKeys.Warehouses.Premises.WriteOff>
  | Values<typeof PermissionKeys.Warehouses.Ukraine.Page>
  | Values<typeof PermissionKeys.Warehouses.Ukraine.Invoices>
  | Values<typeof PermissionKeys.Warehouses.Ukraine.Shipments>
  | Values<typeof PermissionKeys.Warehouses.Ukraine.Orders>

export type WarehouseAccountingPermissionKey =
  | Values<typeof PermissionKeys.WarehouseAccounting.Capitalization.Page>
  | Values<typeof PermissionKeys.WarehouseAccounting.Capitalization.Capitalization>
  | Values<typeof PermissionKeys.WarehouseAccounting.Capitalization.Document>
  | Values<typeof PermissionKeys.WarehouseAccounting.SupplierReturns.Page>
  | Values<typeof PermissionKeys.WarehouseAccounting.SupplierReturns.Return>
  | Values<typeof PermissionKeys.WarehouseAccounting.SupplierReturns.Document>
  | Values<typeof PermissionKeys.WarehouseAccounting.Storages.Page>
  | Values<typeof PermissionKeys.WarehouseAccounting.Storages.Preview>
  | Values<typeof PermissionKeys.WarehouseAccounting.Storages.PositionAction>

export type OnlineShopSeoPermissionKey =
  | Values<typeof PermissionKeys.OnlineShopSeo.Client>
  | Values<typeof PermissionKeys.OnlineShopSeo.Contact>
  | Values<typeof PermissionKeys.OnlineShopSeo.GeneralInfo>
  | Values<typeof PermissionKeys.OnlineShopSeo.Page>
  | Values<typeof PermissionKeys.OnlineShopSeo.PaymentInfo>
  | Values<typeof PermissionKeys.OnlineShopSeo.PaymentRegister>
  | Values<typeof PermissionKeys.OnlineShopSeo.Resale>
  | Values<typeof PermissionKeys.OnlineShopSeo.SeoPage>
  | Values<typeof PermissionKeys.OnlineShopSeo.Storage>
  | Values<typeof PermissionKeys.OnlineShopSeo.Synchronization>

export type OnlineShopCitiesPermissionKey =
  | Values<typeof PermissionKeys.OnlineShopCities.City>
  | Values<typeof PermissionKeys.OnlineShopCities.Page>

export type OnlineShopClientsPermissionKey =
  | Values<typeof PermissionKeys.OnlineShopClients.Page>
  | Values<typeof PermissionKeys.OnlineShopClients.Cart>
  | Values<typeof PermissionKeys.OnlineShopClients.Sales>

export type NewEcommerceClientsPermissionKey =
  Values<typeof PermissionKeys.NewEcommerceClients.Page>

export type IncompleteSalesOnlineShopPermissionKey =
  | Values<typeof PermissionKeys.IncompleteSalesOnlineShop.Page>
  | Values<typeof PermissionKeys.IncompleteSalesOnlineShop.Sale>

export type ProductGroupsPermissionKey =
  | Values<typeof PermissionKeys.ProductGroups.Page>
  | Values<typeof PermissionKeys.ProductGroups.Group>

export type ActReconciliationsPermissionKey =
  | Values<typeof PermissionKeys.ActReconciliations.Page>
  | Values<typeof PermissionKeys.ActReconciliations.Act>
  | Values<typeof PermissionKeys.ActReconciliations.History>
  | Values<typeof PermissionKeys.ActReconciliations.Action>
  | Values<typeof PermissionKeys.ActReconciliations.Disposition>

export type ProductPricingPermissionKey =
  | Values<typeof PermissionKeys.ProductPricing.Page>
  | Values<typeof PermissionKeys.ProductPricing.CompetitorSearch>

export type ProductSpecificationCodesPermissionKey =
  | Values<typeof PermissionKeys.ProductSpecificationCodes.Page>
  | Values<typeof PermissionKeys.ProductSpecificationCodes.Code>

export type FinancialAdministrationPermissionKey =
  | Values<typeof PermissionKeys.FinancialAdministration.Banks.Page>
  | Values<typeof PermissionKeys.FinancialAdministration.Banks.Bank>
  | Values<typeof PermissionKeys.FinancialAdministration.CashflowArticles.Page>
  | Values<
      typeof PermissionKeys.FinancialAdministration.CashflowArticles.Article
    >
  | Values<
      typeof PermissionKeys.FinancialAdministration.ExpenseArticles.Article
    >
  | Values<
      typeof PermissionKeys.FinancialAdministration.CurrencyConvertors.Page
    >
  | Values<
      typeof PermissionKeys.FinancialAdministration.CurrencyConvertors.Converter
    >
  | Values<typeof PermissionKeys.FinancialAdministration.PaymentAccounts.Page>
  | Values<
      typeof PermissionKeys.FinancialAdministration.PaymentAccounts.Account
    >
  | Values<
      typeof PermissionKeys.FinancialAdministration.PaymentAccounts.Transfer
    >
  | Values<
      typeof PermissionKeys.FinancialAdministration.PaymentAccounts.Exchange
    >

export type PermissionKey =
  | SystemPagePermissionKey
  | UsersPermissionKey
  | RolesPermissionKey
  | AdvancedReportsPermissionKey
  | OutgoingCashflowsPermissionKey
  | ProductAvailabilitiesPermissionKey
  | ActReconciliationsPermissionKey
  | VehicleRegistryPermissionKey
  | ClientResourcesPermissionKey
  | ClientsPermissionKey
  | SuppliersPermissionKey
  | OrganizationClientsPermissionKey
  | ConsumableProductsPermissionKey
  | ConsumableOrdersPermissionKey
  | FinancialAdministrationPermissionKey
  | OrdersUkrainePermissionKey
  | IncompleteSalesOnlineShopPermissionKey
  | OnlineShopCitiesPermissionKey
  | OnlineShopClientsPermissionKey
  | NewEcommerceClientsPermissionKey
  | OnlineShopSeoPermissionKey
  | ProductDeliveryProtocolsPermissionKey
  | ProductGroupsPermissionKey
  | ProductPricingPermissionKey
  | ProductsAssortmentPermissionKey
  | ProductSpecificationCodesPermissionKey
  | ProvidingServiceActsPermissionKey
  | TransportersPermissionKey
  | SalesUkraineSalePermissionKey
  | ResalesPermissionKey
  | ReportsStocksPermissionKey
  | SupplierOrganizationsPermissionKey
  | WarehouseAccountingPermissionKey
  | WarehousesPermissionKey

export const LegacyPermissionKeys = {
  ClientResources: {
    Currency: {
      Create: 'CURRENCIES_ClientsResources_NewBtn_PKEY',
      Delete: 'CURRENCIES_ClientsResources_DeleteBtn_PKEY',
      Edit: 'CURRENCIES_ClientsResources_EditBtn_PKEY',
    },
    MeasureUnit: {
      Create: 'MEASURE_UNIT_ClientsResources_NewBtn_PKEY',
      Delete: 'MEASURE_UNIT_ClientsResources_DeleteBtn_PKEY',
      Edit: 'MEASURE_UNIT_ClientsResources_EditBtn_PKEY',
    },
    Organization: {
      Create: 'ORGANIZATIONS_ClientsResources_NewBtn_PKEY',
      Delete: 'ORGANIZATIONS_ClientsResources_DeleteBtn_PKEY',
      Edit: 'ORGANIZATIONS_ClientsResources_EditBtn_PKEY',
    },
    PerfectClient: {
      Create: 'PERFECTCLIENT_ClientsResources_NewBtn_PKEY',
      Delete: 'PERFECTCLIENT_ClientsResources_DeleteBtn_PKEY',
      Edit: 'PERFECTCLIENT_ClientsResources_EditBtn_PKEY',
    },
    PricingRule: {
      Create: 'PRICING_ClientsResources_NewBtn_PKEY',
      Delete: 'PRICING_ClientsResources_DeleteBtn_PKEY',
      Edit: 'PRICING_ClientsResources_EditBtn_PKEY',
      SetPriority: 'PRICING_ClientsResources_Priority_PKEY',
    },
    Region: {
      Create: 'REGIONS_ClientsResources_NewRegionBtn_PKEY',
      Delete: 'REGIONS_ClientsResources_DeleteBtn_PKEY',
      Edit: 'REGIONS_ClientsResources_EditBtn_PKEY',
    },
    RegionCode: {
      Create: 'REGIONS_ClientsResources_NewBtn_PKEY',
    },
    Storage: {
      Create: 'STORAGES_ClientsResources_NewBtn_PKEY',
      Delete: 'STORAGES_ClientsResources_DeleteBtn_PKEY',
      Edit: 'STORAGES_ClientsResources_EditBtn_PKEY',
    },
    TaxInspection: {
      Create: 'TAX_INSPECTATION_ClientsResources_NewRowBtn_PKEY',
      Delete: 'TAX_INSPECTATION_ClientsResources_DeleteBtn_PKEY',
      Edit: 'TAX_INSPECTATION_ClientsResources_EditRowBtn_PKEY',
    },
  },
  Clients: {
    AccountingCashFlow: {
      Open: 'AccountingCashFlow_row_clientModal_clientsAll_PKEY',
    },
    Client: {
      Create: 'Header_NewClient_clientsAllView_PKEY',
      Delete: 'EditClient_HEADER_OnDelete_PKEY',
    },
    ClientType: {
      Change: 'EditClient_HEADER_EditClientHeaderClientType_PKEY',
      SelectBuyer: 'client_icon_clientsNew_PKEY',
      SelectPolishBuyer: 'ПокупціПЛ_sub_clientsNew_PKEY',
      SelectPolishClient: 'Польськіклієнти_sub_clientsNew_PKEY',
      SelectPolishUaBuyer: 'ПокупціПЛУкраїна_sub_clientsNew_PKEY',
      SelectProductSupplier: 'Постачальникитовару_sub_clientsNew_PKEY',
      SelectShopClient: 'ShopClient_sub_clientsNew_PKEY',
      SelectSupplier: 'supplier_icon_clientsNew_PKEY',
      SelectUkraineBuyer: 'ПокупціУкраїна_sub_clientsNew_PKEY',
    },
    Contract: {
      Edit: 'Clients_Edit_Contract_Pricing_EditBtn_PKEY',
      SelectAll: 'Clients_Select_All_Contract_Pricing_Btn_PKEY',
    },
    Details: {
      Open: 'View_row_clientModal_clientsAll_PKEY',
    },
    Ecommerce: {
      Open: 'EditClient_Body_EditClientEcommerceView_PKEY',
    },
    Pricing: {
      Open: 'EditClient_Body_EditClientPricingView_PKEY',
    },
    Promotion: {
      EditText: 'Clients_Select_All_Contract_Pricing_Input_PKEY',
      Toggle: 'Clients_Select_All_Contract_Pricing_CheckBox_Btn_PKEY',
    },
    Status: {
      ToggleActive: 'EditClient_HEADER_ActiveCheck_PKEY',
    },
  },
  FinancialAdministration: {
    Banks: {
      Bank: {
        Create: 'Accounting_Banks_All_ADDBtn_PKEY',
        Delete: 'Accounting_Banks_All_Modal_edit_DelBtn_PKEY',
        Save: 'Accounting_Banks_All_Modal_edit_SaveBtn_PKEY',
      },
    },
    CashflowArticles: {
      Article: {
        Create: 'Accounting_Payment_Cashflow_Articles_AddBtn_PKEY',
        Delete: 'Accounting_Payment_Cashflow_Articles_DelBtn_PKEY',
        Save: 'Accounting_Payment_Cashflow_Articles_saveBtn_PKEY',
      },
    },
    ExpenseArticles: {
      Article: {
        Create: 'Accounting_Payment_Expense_Articles_ADDBtn_PKEY',
        Delete:
          'Accounting_Payment_Expense_Articles_Edit_DeleteBtn_PKEY',
        Save: 'Accounting_Payment_Expense_Articles_Edit_SaveBtn_PKEY',
      },
    },
    CurrencyConvertors: {
      Converter: {
        Create: 'Accounting_Currency_Convertors_AddBtn_PKEY',
        Edit: 'Accounting_Currency_Convertors_EditBtn_PKEY',
      },
    },
    PaymentAccounts: {
      Account: {
        Create: 'Accounting_Payment_accounts_All_ADDBtn_PKEY',
        Edit: 'Accounting_Payment_accounts_All_Edit_EditBtn_PKEY',
      },
    },
  },
  ProductDeliveryProtocols: {
    DeliveryDocuments: {
      Download:
        'ProductDeliveryProtocols_specifications_download_exel_upload_documents_PKEY',
    },
    Document: {
      Download: 'ProductDeliveryProtocols_Load_PKEY',
    },
    Documents: {
      Download: 'ProductDeliveryProtocols_specifications_download_exel_PKEY',
    },
    InvoiceManagement: {
      Open: 'ProductDeliveryProtocols_logistic_path_card_invoices_infoBtn_PKEY',
    },
    LogisticWay: {
      Open: 'ProductDeliveryProtocols_SelectAnOption_LogisticWay_PKEY',
    },
    Options: {
      Open: 'ProductDeliveryProtocols_SelectAnOption_SelectOptionBtn_PKEY',
    },
    ProductIncome: {
      Open: 'ProductDeliveryProtocols_SelectAnOption_PlacementSupplyOrder_PKEY',
    },
    Protocol: {
      Create: 'ProductDeliveryProtocols_AddNew_PKEY',
    },
    SpecificationCodes: {
      Download:
        'ProductDeliveryProtocols_specifications_download_exel_upload_PKEY',
      Open: 'ProductDeliveryProtocols_SelectAnOption_ProductSpecificationCodes_PKEY',
    },
    SpecificationHistory: {
      Open: 'ProductDeliveryProtocols_specifications_customs_codes_infoBtn_PKEY',
    },
    UnifiedService: {
      AddInvoice: 'ProductDeliveryProtocols_unified_services_AddInvoceBtn_PKEY',
      Calculate: 'ProductDeliveryProtocols_unified_services_CalculateBtn_PKEY',
      ChangeStatus:
        'ProductDeliveryProtocols_unified_services_ChangeStatusBtn_PKEY',
      Create: 'ProductDeliveryProtocols_unified_services_AddBtn_PKEY',
      Delete: 'ProductDeliveryProtocols_unified_services_DeleteBtn_PKEY',
      Edit: 'ProductDeliveryProtocols_unified_services_EditBtn_PKEY',
    },
  },
  ProductsAssortment: {
    Product: {
      Edit: 'Product_Entire_Assortment_EditBtn_PKEY',
    },
    Specification: {
      Edit: 'Product_Entire_Assortment_Specification_ChangeBtn_PKEY',
    },
    Image: {
      Upload: 'Product_Entire_Assortment_Picture_AddBtn_PKEY',
      Delete: 'Product_Entire_Assortment_Picture_DelBtn_PKEY',
    },
    ConsignmentBalances: {
      Open: 'Product_Entire_Assortment_BalancesOnParties_Btn_PKEY',
    },
    Movement: {
      Open: 'Product_Entire_Assortment_Product_Movement_Btn_PKEY',
    },
    WriteOffRules: {
      Open: 'Product_Entire_Assortment_Product_WriteOff_Rule_Btn_PKEY',
    },
    Document: {
      Upload: 'Product_Entire_Assortment_Product_Upload_Document_Btn_PKEY',
    },
    Legacy77: {
      Execute: '77',
    },
  },
  ConsumableProducts: {
    Category: {
      Create: 'SERVICE_Accounting_Consumable_Product_AddBtn_PKEY',
      Edit: 'SERVICE_Accounting_Consumable_Product_edit_categoryBtn_PKEY',
    },
    Product: {
      Create: 'SERVICE_Accounting_Consumable_Product_addSupCategoryBtn_PKEY',
      Edit: 'SERVICE_Accounting_Consumable_Product_editBtn_PKEY',
      Delete: 'SERVICE_Accounting_Consumable_Product_removeBtn_PKEY',
    },
  },
  SupplierOrganizations: {
    Supplier: {
      Create: 'SERVICE_Accounting_Supplier_Organizations_AddBtn_PKEY',
      Delete: 'SERVICE_Accounting_Supplier_Organizations_DelBtn_PKEY',
    },
    Settlements: {
      Open: 'SERVICE_Accounting_Supplier_Organizations_SettlementsBtn_PKEY',
    },
    Overview: {
      Open: 'SERVICE_Accounting_Supplier_Organizations_OverviewBtn_PKEY',
    },
  },
  ProvidingServiceActs: {
    LogisticWay: {
      Open: 'ActProvidingServices_SelectAnOption_LogisticWayBtn_PKEY',
    },
    Overview: {
      Open: 'ActProvidingServices_SelectAnOption_viewBtn_PKEY',
    },
  },
  Warehouses: {
    CompanyCars: {
      Car: {
        Create: 'STORAGES_Accounting_Company-cars_AddBtn_PKEY',
      },
    },
    Premises: {
      Premise: {
        Create: 'STORAGES_Accounting_Storages_AddBtn_PKEY',
        Edit: 'STORAGES_Accounting_Storages_edit__control_PKEY',
        Delete: 'STORAGES_Accounting_Storages_remove__control_PKEY',
      },
    },
    Ukraine: {
      Invoices: {
        Open: 'STORAGES_Ukraine_Invoices_Warehouse_Ukraine_PKEY',
      },
      Shipments: {
        Open: 'STORAGES_Ukraine_Shipments_Warehouse_Ukraine_PKEY',
      },
      Orders: {
        Open: 'STORAGES_Ukraine_UkraineOrder_Warehouse_Ukraine_PKEY',
      },
    },
  },
  WarehouseAccounting: {
    Storages: {
      Preview: {
        Open: 'Products_Storages_Preview_Btn_PKEY',
      },
      PositionAction: {
        Open: 'Products_Storages_Action_WithAPosition_Btn_PKEY',
      },
    },
  },
  OnlineShopSeo: {
    Resale: {
      Open: 'HEADER_ReSalesPage_BTN',
    },
    Synchronization: {
      Run: 'HEADER_SyncButton_BTN',
    },
  },
  ProductGroups: {
    Group: {
      Create: 'Product_Groups_ADDBtn_PKEY',
    },
  },
  ProductSpecificationCodes: {
    Code: {
      Edit: 'Accounting_Specification_codes_ChangeBtn_PKEY',
    },
  },
  OrdersUkraine: {
    Invoice: {
      Delete: 'SUPPLY_INVOICES_ordersUkraineAllEdit_RemoveInvoiceBtn_PKEY',
      Upload: 'SUPPLY_INVOICES_ordersUkraineAllEdit_NewInvoiceBtn_PKEY',
    },
    LogisticWay: {
      AddInvoice: 'LOGISTIC_WAY_ordersUkraineAllEdit_AddNewInvoice_PKEY',
      ApproveOrder:
        'LOGISTIC_WAY_ordersUkraineAllEdit_ApprovedSupplyOrderStatus_PKEY',
      CreateCreditNote: 'LOGISTIC_WAY_ordersUkraineAllEdit_CreditNotes_PKEY',
      CreatePaymentTask:
        'LOGISTIC_WAY_ordersUkraineAllEdit_AddPaymentProtocolToProform_PKEY',
      CreateProforma: 'LOGISTIC_WAY_ordersUkraineAllEdit_SaveProform_PKEY',
      DeletePaymentTask:
        'LOGISTIC_WAY_ordersUkraineAllEdit_RemovePaymentTask_PKEY',
      EditInvoice: 'LOGISTIC_WAY_ordersUkraineAllEdit_EditInvoice_PKEY',
      EditOrderQuantity:
        'LOGISTIC_WAY_ordersUkraineAllEdit_EditSupplyNewAmount_PKEY',
    },
    Order: {
      AddDeliveryCosts:
        'UkraineAllOrders_SelectAnOption_AddingOfficialCostsForProductDelivery_PKEY',
      CreatePaymentTask:
        'UkraineAllOrders_SelectAnOption_NewPaymentProtocol_PKEY',
      Delete: 'UkraineAllOrders_SelectAnOption_Delete_PKEY',
      DownloadDocuments: 'SupplyOrderPrintDocumentUrls_Load_PKEY',
      OpenArrival: 'Supply_Order_To_Ukraine_PKEY',
      OpenLogisticWay: 'UkraineAllOrders_SelectAnOption_LogisticWay_PKEY',
      OpenOrder: 'Ukraine_Order_PKEY',
      OpenOverview: 'UkraineAllOrders_SelectAnOption_View_PKEY',
      OpenPlacement: 'UkraineAllOrders_SelectAnOption_ProductPlacement_PKEY',
      OpenProductIncome:
        'UkraineAllOrders_SelectAnOption_PlacementSupplyOrder_PKEY',
      OpenProducts: 'UkraineAllOrders_SelectAnOption_Products_PKEY',
      OpenSpecificationCodes:
        'UkraineAllOrders_SelectAnOption_ProductSpecificationCodes_PKEY',
    },
    PackList: {
      Delete: 'SUPPLY_INVOICES_ordersUkraineAllEdit_RemovePackListBtn_PKEY',
      Upload: 'SUPPLY_INVOICES_ordersUkraineAllEdit_NewPackListBtn_PKEY',
    },
    Placement: {
      Calculate: 'PlacementHeader_Calculate_ordersUkraineView_PKEY',
      Capitalize: 'PlacementHeader_GetUp_ordersUkrainePlacement_PKEY',
      CreateReconciliation:
        'PlacementHeader_ActReconciliationNew_ordersUkrainePlacement_PKEY',
      OpenProductPlacement:
        'PlacementHeader_ProductPlacement_ordersUkraineView_PKEY',
      Post: 'PlacementHeader_CarryOut_ordersUkrainePlacement_PKEY',
      Save: 'PlacementHeader_AddCancelSave_ordersUkrainePlacement_PKEY',
      UploadDocuments: 'PlacementHeader_LoadingSales_ordersUkraineView_PKEY',
    },
    ProductIncome: {
      Add: 'PRODUCT_INCOME_ordersUkraineAllEdit_NewInvoiceBtn_PKEY',
      Capitalize: 'PRODUCT_INCOME_ordersUkraineAllEdit_CapitalizeBtn_PKEY',
      Delete: 'PRODUCT_INCOME_ordersUkraineAllEdit_RemoveBtn_PKEY',
      Post: 'PRODUCT_INCOME_ordersUkraineAllEdit_CarryOutBtn_PKEY',
      ViewWeightHistory:
        'PRODUCT_INCOME_ordersUkraineAllEdit_historyOfChangesInWeight_PKEY',
    },
    SpecificationCodes: {
      DownloadApplicationFiles:
        'SPECIFICATION_CODES_ordersUkraineAllEdit_DownloadFilesFromTheApplication_PKEY',
      DownloadCodes:
        'SPECIFICATION_CODES_ordersUkraineAllEdit_DownloadingSpecificationDocuments_PKEY',
      DownloadCustomsDocuments:
        'SPECIFICATION_CODES_ordersUkraineAllEdit_DownloadingShippingDocuments_PKEY',
      Edit: 'SPECIFICATION_CODES_ordersUkraineAllEdit_SaveModalBtn_PKEY',
      ViewHistory: 'SPECIFICATION_CODES_ordersUkraineAllEdit_History_PKEY',
    },
  },
  SalesUkraine: {
    Sale: {
      Edit: 'UkraineAllActOfEdit_Change_PKEY',
      Unlock: 'UnclockSale_Btn_PKEY',
      UnlockForShipping: 'OrderWillNotBeShipped_Btn_PKEY',
      SellWithoutPayment: '5',
      EditProductComment: 'Sales_Ukraine_all_Change_Products_Btn_PKEY',
    },
  },
} as const

/**
 * Temporary read aliases for the staged migration. They preserve the current
 * behaviour until the server backfills role assignments to canonical keys.
 * The backend remains the final authorization boundary.
 */
export const PermissionAliases: Readonly<
  Partial<Record<PermissionKey, readonly string[]>>
> = {
  [PermissionKeys.ClientResources.Currency.Create]: [
    LegacyPermissionKeys.ClientResources.Currency.Create,
  ],
  [PermissionKeys.ClientResources.Currency.Delete]: [
    LegacyPermissionKeys.ClientResources.Currency.Delete,
  ],
  [PermissionKeys.ClientResources.Currency.Edit]: [
    LegacyPermissionKeys.ClientResources.Currency.Edit,
  ],
  [PermissionKeys.ClientResources.MeasureUnit.Create]: [
    LegacyPermissionKeys.ClientResources.MeasureUnit.Create,
  ],
  [PermissionKeys.ClientResources.MeasureUnit.Delete]: [
    LegacyPermissionKeys.ClientResources.MeasureUnit.Delete,
  ],
  [PermissionKeys.ClientResources.MeasureUnit.Edit]: [
    LegacyPermissionKeys.ClientResources.MeasureUnit.Edit,
  ],
  [PermissionKeys.ClientResources.Organization.Create]: [
    LegacyPermissionKeys.ClientResources.Organization.Create,
  ],
  [PermissionKeys.ClientResources.Organization.Delete]: [
    LegacyPermissionKeys.ClientResources.Organization.Delete,
  ],
  [PermissionKeys.ClientResources.Organization.Edit]: [
    LegacyPermissionKeys.ClientResources.Organization.Edit,
  ],
  [PermissionKeys.ClientResources.PerfectClient.Create]: [
    LegacyPermissionKeys.ClientResources.PerfectClient.Create,
  ],
  [PermissionKeys.ClientResources.PerfectClient.Delete]: [
    LegacyPermissionKeys.ClientResources.PerfectClient.Delete,
  ],
  [PermissionKeys.ClientResources.PerfectClient.Edit]: [
    LegacyPermissionKeys.ClientResources.PerfectClient.Edit,
  ],
  [PermissionKeys.ClientResources.PricingRule.Create]: [
    LegacyPermissionKeys.ClientResources.PricingRule.Create,
  ],
  [PermissionKeys.ClientResources.PricingRule.Delete]: [
    LegacyPermissionKeys.ClientResources.PricingRule.Delete,
  ],
  [PermissionKeys.ClientResources.PricingRule.Edit]: [
    LegacyPermissionKeys.ClientResources.PricingRule.Edit,
  ],
  [PermissionKeys.ClientResources.PricingRule.SetPriority]: [
    LegacyPermissionKeys.ClientResources.PricingRule.SetPriority,
  ],
  [PermissionKeys.ClientResources.Region.Create]: [
    LegacyPermissionKeys.ClientResources.Region.Create,
  ],
  [PermissionKeys.ClientResources.Region.Delete]: [
    LegacyPermissionKeys.ClientResources.Region.Delete,
  ],
  [PermissionKeys.ClientResources.Region.Edit]: [
    LegacyPermissionKeys.ClientResources.Region.Edit,
  ],
  [PermissionKeys.ClientResources.RegionCode.Create]: [
    LegacyPermissionKeys.ClientResources.RegionCode.Create,
  ],
  [PermissionKeys.ClientResources.Storage.Create]: [
    LegacyPermissionKeys.ClientResources.Storage.Create,
  ],
  [PermissionKeys.ClientResources.Storage.Delete]: [
    LegacyPermissionKeys.ClientResources.Storage.Delete,
  ],
  [PermissionKeys.ClientResources.Storage.Edit]: [
    LegacyPermissionKeys.ClientResources.Storage.Edit,
  ],
  [PermissionKeys.ClientResources.TaxInspection.Create]: [
    LegacyPermissionKeys.ClientResources.TaxInspection.Create,
  ],
  [PermissionKeys.ClientResources.TaxInspection.Delete]: [
    LegacyPermissionKeys.ClientResources.TaxInspection.Delete,
  ],
  [PermissionKeys.ClientResources.TaxInspection.Edit]: [
    LegacyPermissionKeys.ClientResources.TaxInspection.Edit,
  ],
  [PermissionKeys.Clients.AccountingCashFlow.Open]: [
    LegacyPermissionKeys.Clients.AccountingCashFlow.Open,
  ],
  [PermissionKeys.Clients.Client.Create]: [
    LegacyPermissionKeys.Clients.Client.Create,
  ],
  [PermissionKeys.Clients.Client.Delete]: [
    LegacyPermissionKeys.Clients.Client.Delete,
  ],
  [PermissionKeys.Clients.ClientType.Change]: [
    LegacyPermissionKeys.Clients.ClientType.Change,
  ],
  [PermissionKeys.Clients.ClientType.SelectBuyer]: [
    LegacyPermissionKeys.Clients.ClientType.SelectBuyer,
  ],
  [PermissionKeys.Clients.ClientType.SelectPolishBuyer]: [
    LegacyPermissionKeys.Clients.ClientType.SelectPolishBuyer,
  ],
  [PermissionKeys.Clients.ClientType.SelectPolishClient]: [
    LegacyPermissionKeys.Clients.ClientType.SelectPolishClient,
  ],
  [PermissionKeys.Clients.ClientType.SelectPolishUaBuyer]: [
    LegacyPermissionKeys.Clients.ClientType.SelectPolishUaBuyer,
  ],
  [PermissionKeys.Clients.ClientType.SelectProductSupplier]: [
    LegacyPermissionKeys.Clients.ClientType.SelectProductSupplier,
  ],
  [PermissionKeys.Clients.ClientType.SelectShopClient]: [
    LegacyPermissionKeys.Clients.ClientType.SelectShopClient,
  ],
  [PermissionKeys.Clients.ClientType.SelectSupplier]: [
    LegacyPermissionKeys.Clients.ClientType.SelectSupplier,
  ],
  [PermissionKeys.Clients.ClientType.SelectUkraineBuyer]: [
    LegacyPermissionKeys.Clients.ClientType.SelectUkraineBuyer,
  ],
  [PermissionKeys.Clients.Contract.Edit]: [
    LegacyPermissionKeys.Clients.Contract.Edit,
  ],
  [PermissionKeys.Clients.Contract.SelectAll]: [
    LegacyPermissionKeys.Clients.Contract.SelectAll,
  ],
  [PermissionKeys.Clients.Details.Open]: [
    LegacyPermissionKeys.Clients.Details.Open,
  ],
  [PermissionKeys.Clients.Ecommerce.Open]: [
    LegacyPermissionKeys.Clients.Ecommerce.Open,
  ],
  [PermissionKeys.Clients.Pricing.Open]: [
    LegacyPermissionKeys.Clients.Pricing.Open,
  ],
  [PermissionKeys.Clients.Promotion.EditText]: [
    LegacyPermissionKeys.Clients.Promotion.EditText,
  ],
  [PermissionKeys.Clients.Promotion.Toggle]: [
    LegacyPermissionKeys.Clients.Promotion.Toggle,
  ],
  [PermissionKeys.Clients.Status.ToggleActive]: [
    LegacyPermissionKeys.Clients.Status.ToggleActive,
  ],
  [PermissionKeys.FinancialAdministration.Banks.Bank.Create]: [
    LegacyPermissionKeys.FinancialAdministration.Banks.Bank.Create,
  ],
  [PermissionKeys.FinancialAdministration.Banks.Bank.Delete]: [
    LegacyPermissionKeys.FinancialAdministration.Banks.Bank.Delete,
  ],
  [PermissionKeys.FinancialAdministration.Banks.Bank.Save]: [
    LegacyPermissionKeys.FinancialAdministration.Banks.Bank.Save,
  ],
  [PermissionKeys.FinancialAdministration.CashflowArticles.Article.Create]: [
    LegacyPermissionKeys.FinancialAdministration.CashflowArticles.Article
      .Create,
  ],
  [PermissionKeys.FinancialAdministration.CashflowArticles.Article.Delete]: [
    LegacyPermissionKeys.FinancialAdministration.CashflowArticles.Article
      .Delete,
  ],
  [PermissionKeys.FinancialAdministration.CashflowArticles.Article.Save]: [
    LegacyPermissionKeys.FinancialAdministration.CashflowArticles.Article.Save,
  ],
  [PermissionKeys.FinancialAdministration.ExpenseArticles.Article.Create]: [
    LegacyPermissionKeys.FinancialAdministration.ExpenseArticles.Article
      .Create,
  ],
  [PermissionKeys.FinancialAdministration.ExpenseArticles.Article.Delete]: [
    LegacyPermissionKeys.FinancialAdministration.ExpenseArticles.Article
      .Delete,
  ],
  [PermissionKeys.FinancialAdministration.ExpenseArticles.Article.Save]: [
    LegacyPermissionKeys.FinancialAdministration.ExpenseArticles.Article.Save,
  ],
  [PermissionKeys.FinancialAdministration.CurrencyConvertors.Converter.Create]:
    [
      LegacyPermissionKeys.FinancialAdministration.CurrencyConvertors.Converter
        .Create,
    ],
  [PermissionKeys.FinancialAdministration.CurrencyConvertors.Converter.Edit]: [
    LegacyPermissionKeys.FinancialAdministration.CurrencyConvertors.Converter
      .Edit,
  ],
  [PermissionKeys.FinancialAdministration.PaymentAccounts.Account.Create]: [
    LegacyPermissionKeys.FinancialAdministration.PaymentAccounts.Account.Create,
  ],
  [PermissionKeys.FinancialAdministration.PaymentAccounts.Account.Edit]: [
    LegacyPermissionKeys.FinancialAdministration.PaymentAccounts.Account.Edit,
  ],
  [PermissionKeys.ProductDeliveryProtocols.DeliveryDocuments.Download]: [
    LegacyPermissionKeys.ProductDeliveryProtocols.DeliveryDocuments.Download,
  ],
  [PermissionKeys.ProductDeliveryProtocols.Document.Download]: [
    LegacyPermissionKeys.ProductDeliveryProtocols.Document.Download,
  ],
  [PermissionKeys.ProductDeliveryProtocols.Documents.Download]: [
    LegacyPermissionKeys.ProductDeliveryProtocols.Documents.Download,
  ],
  [PermissionKeys.ProductDeliveryProtocols.InvoiceManagement.Open]: [
    LegacyPermissionKeys.ProductDeliveryProtocols.InvoiceManagement.Open,
  ],
  [PermissionKeys.ProductDeliveryProtocols.LogisticWay.Open]: [
    LegacyPermissionKeys.ProductDeliveryProtocols.LogisticWay.Open,
  ],
  [PermissionKeys.ProductDeliveryProtocols.Options.Open]: [
    LegacyPermissionKeys.ProductDeliveryProtocols.Options.Open,
  ],
  [PermissionKeys.ProductDeliveryProtocols.ProductIncome.Open]: [
    LegacyPermissionKeys.ProductDeliveryProtocols.ProductIncome.Open,
  ],
  [PermissionKeys.ProductDeliveryProtocols.Protocol.Create]: [
    LegacyPermissionKeys.ProductDeliveryProtocols.Protocol.Create,
  ],
  [PermissionKeys.ProductDeliveryProtocols.SpecificationCodes.Download]: [
    LegacyPermissionKeys.ProductDeliveryProtocols.SpecificationCodes.Download,
  ],
  [PermissionKeys.ProductDeliveryProtocols.SpecificationCodes.Open]: [
    LegacyPermissionKeys.ProductDeliveryProtocols.SpecificationCodes.Open,
  ],
  [PermissionKeys.ProductDeliveryProtocols.SpecificationHistory.Open]: [
    LegacyPermissionKeys.ProductDeliveryProtocols.SpecificationHistory.Open,
  ],
  [PermissionKeys.ProductDeliveryProtocols.UnifiedService.AddInvoice]: [
    LegacyPermissionKeys.ProductDeliveryProtocols.UnifiedService.AddInvoice,
  ],
  [PermissionKeys.ProductDeliveryProtocols.UnifiedService.Calculate]: [
    LegacyPermissionKeys.ProductDeliveryProtocols.UnifiedService.Calculate,
  ],
  [PermissionKeys.ProductDeliveryProtocols.UnifiedService.ChangeStatus]: [
    LegacyPermissionKeys.ProductDeliveryProtocols.UnifiedService.ChangeStatus,
  ],
  [PermissionKeys.ProductDeliveryProtocols.UnifiedService.Create]: [
    LegacyPermissionKeys.ProductDeliveryProtocols.UnifiedService.Create,
  ],
  [PermissionKeys.ProductDeliveryProtocols.UnifiedService.Delete]: [
    LegacyPermissionKeys.ProductDeliveryProtocols.UnifiedService.Delete,
  ],
  [PermissionKeys.ProductDeliveryProtocols.UnifiedService.Edit]: [
    LegacyPermissionKeys.ProductDeliveryProtocols.UnifiedService.Edit,
  ],
  [PermissionKeys.ProductsAssortment.Product.Edit]: [
    LegacyPermissionKeys.ProductsAssortment.Product.Edit,
  ],
  [PermissionKeys.ProductsAssortment.Specification.Edit]: [
    LegacyPermissionKeys.ProductsAssortment.Specification.Edit,
  ],
  [PermissionKeys.ProductsAssortment.Image.Upload]: [
    LegacyPermissionKeys.ProductsAssortment.Image.Upload,
  ],
  [PermissionKeys.ProductsAssortment.Image.Delete]: [
    LegacyPermissionKeys.ProductsAssortment.Image.Delete,
  ],
  [PermissionKeys.ProductsAssortment.ConsignmentBalances.Open]: [
    LegacyPermissionKeys.ProductsAssortment.ConsignmentBalances.Open,
  ],
  [PermissionKeys.ProductsAssortment.Movement.Open]: [
    LegacyPermissionKeys.ProductsAssortment.Movement.Open,
  ],
  [PermissionKeys.ProductsAssortment.WriteOffRules.Open]: [
    LegacyPermissionKeys.ProductsAssortment.WriteOffRules.Open,
  ],
  [PermissionKeys.ProductsAssortment.Document.Upload]: [
    LegacyPermissionKeys.ProductsAssortment.Document.Upload,
  ],
  [PermissionKeys.ProductsAssortment.Legacy77.Execute]: [
    LegacyPermissionKeys.ProductsAssortment.Legacy77.Execute,
  ],
  [PermissionKeys.ConsumableProducts.Category.Create]: [
    LegacyPermissionKeys.ConsumableProducts.Category.Create,
  ],
  [PermissionKeys.ConsumableProducts.Category.Edit]: [
    LegacyPermissionKeys.ConsumableProducts.Category.Edit,
  ],
  [PermissionKeys.ConsumableProducts.Product.Create]: [
    LegacyPermissionKeys.ConsumableProducts.Product.Create,
  ],
  [PermissionKeys.ConsumableProducts.Product.Edit]: [
    LegacyPermissionKeys.ConsumableProducts.Product.Edit,
  ],
  [PermissionKeys.ConsumableProducts.Product.Delete]: [
    LegacyPermissionKeys.ConsumableProducts.Product.Delete,
  ],
  [PermissionKeys.SupplierOrganizations.Supplier.Create]: [
    LegacyPermissionKeys.SupplierOrganizations.Supplier.Create,
  ],
  [PermissionKeys.SupplierOrganizations.Supplier.Delete]: [
    LegacyPermissionKeys.SupplierOrganizations.Supplier.Delete,
  ],
  [PermissionKeys.SupplierOrganizations.Settlements.Open]: [
    LegacyPermissionKeys.SupplierOrganizations.Settlements.Open,
  ],
  [PermissionKeys.SupplierOrganizations.Overview.Open]: [
    LegacyPermissionKeys.SupplierOrganizations.Overview.Open,
  ],
  [PermissionKeys.ProvidingServiceActs.LogisticWay.Open]: [
    LegacyPermissionKeys.ProvidingServiceActs.LogisticWay.Open,
  ],
  [PermissionKeys.ProvidingServiceActs.Overview.Open]: [
    LegacyPermissionKeys.ProvidingServiceActs.Overview.Open,
  ],
  [PermissionKeys.Warehouses.CompanyCars.Car.Create]: [
    LegacyPermissionKeys.Warehouses.CompanyCars.Car.Create,
  ],
  [PermissionKeys.Warehouses.Premises.Premise.Create]: [
    LegacyPermissionKeys.Warehouses.Premises.Premise.Create,
  ],
  [PermissionKeys.Warehouses.Premises.Premise.Edit]: [
    LegacyPermissionKeys.Warehouses.Premises.Premise.Edit,
  ],
  [PermissionKeys.Warehouses.Premises.Premise.Delete]: [
    LegacyPermissionKeys.Warehouses.Premises.Premise.Delete,
  ],
  [PermissionKeys.Warehouses.Ukraine.Invoices.Open]: [
    LegacyPermissionKeys.Warehouses.Ukraine.Invoices.Open,
  ],
  [PermissionKeys.Warehouses.Ukraine.Shipments.Open]: [
    LegacyPermissionKeys.Warehouses.Ukraine.Shipments.Open,
  ],
  [PermissionKeys.Warehouses.Ukraine.Orders.Open]: [
    LegacyPermissionKeys.Warehouses.Ukraine.Orders.Open,
  ],
  [PermissionKeys.WarehouseAccounting.Storages.Preview.Open]: [
    LegacyPermissionKeys.WarehouseAccounting.Storages.Preview.Open,
  ],
  [PermissionKeys.WarehouseAccounting.Storages.PositionAction.Open]: [
    LegacyPermissionKeys.WarehouseAccounting.Storages.PositionAction.Open,
  ],
  [PermissionKeys.OnlineShopSeo.Resale.Open]: [
    LegacyPermissionKeys.OnlineShopSeo.Resale.Open,
  ],
  [PermissionKeys.OnlineShopSeo.Synchronization.Run]: [
    LegacyPermissionKeys.OnlineShopSeo.Synchronization.Run,
  ],
  [PermissionKeys.ProductGroups.Group.Create]: [
    LegacyPermissionKeys.ProductGroups.Group.Create,
  ],
  [PermissionKeys.ProductSpecificationCodes.Code.Edit]: [
    LegacyPermissionKeys.ProductSpecificationCodes.Code.Edit,
  ],
  [PermissionKeys.OrdersUkraine.Invoice.Delete]: [
    LegacyPermissionKeys.OrdersUkraine.Invoice.Delete,
  ],
  [PermissionKeys.OrdersUkraine.Invoice.Upload]: [
    LegacyPermissionKeys.OrdersUkraine.Invoice.Upload,
  ],
  [PermissionKeys.OrdersUkraine.LogisticWay.AddInvoice]: [
    LegacyPermissionKeys.OrdersUkraine.LogisticWay.AddInvoice,
  ],
  [PermissionKeys.OrdersUkraine.LogisticWay.ApproveOrder]: [
    LegacyPermissionKeys.OrdersUkraine.LogisticWay.ApproveOrder,
  ],
  [PermissionKeys.OrdersUkraine.LogisticWay.CreateCreditNote]: [
    LegacyPermissionKeys.OrdersUkraine.LogisticWay.CreateCreditNote,
  ],
  [PermissionKeys.OrdersUkraine.LogisticWay.CreatePaymentTask]: [
    LegacyPermissionKeys.OrdersUkraine.LogisticWay.CreatePaymentTask,
  ],
  [PermissionKeys.OrdersUkraine.LogisticWay.CreateProforma]: [
    LegacyPermissionKeys.OrdersUkraine.LogisticWay.CreateProforma,
  ],
  [PermissionKeys.OrdersUkraine.LogisticWay.DeletePaymentTask]: [
    LegacyPermissionKeys.OrdersUkraine.LogisticWay.DeletePaymentTask,
  ],
  [PermissionKeys.OrdersUkraine.LogisticWay.EditInvoice]: [
    LegacyPermissionKeys.OrdersUkraine.LogisticWay.EditInvoice,
  ],
  [PermissionKeys.OrdersUkraine.LogisticWay.EditOrderQuantity]: [
    LegacyPermissionKeys.OrdersUkraine.LogisticWay.EditOrderQuantity,
  ],
  [PermissionKeys.OrdersUkraine.Order.AddDeliveryCosts]: [
    LegacyPermissionKeys.OrdersUkraine.Order.AddDeliveryCosts,
  ],
  [PermissionKeys.OrdersUkraine.Order.CreatePaymentTask]: [
    LegacyPermissionKeys.OrdersUkraine.Order.CreatePaymentTask,
  ],
  [PermissionKeys.OrdersUkraine.Order.Delete]: [
    LegacyPermissionKeys.OrdersUkraine.Order.Delete,
  ],
  [PermissionKeys.OrdersUkraine.Order.DownloadDocuments]: [
    LegacyPermissionKeys.OrdersUkraine.Order.DownloadDocuments,
  ],
  [PermissionKeys.OrdersUkraine.Order.OpenArrival]: [
    LegacyPermissionKeys.OrdersUkraine.Order.OpenArrival,
  ],
  [PermissionKeys.OrdersUkraine.Order.OpenLogisticWay]: [
    LegacyPermissionKeys.OrdersUkraine.Order.OpenLogisticWay,
  ],
  [PermissionKeys.OrdersUkraine.Order.OpenOrder]: [
    LegacyPermissionKeys.OrdersUkraine.Order.OpenOrder,
  ],
  [PermissionKeys.OrdersUkraine.Order.OpenOverview]: [
    LegacyPermissionKeys.OrdersUkraine.Order.OpenOverview,
  ],
  [PermissionKeys.OrdersUkraine.Order.OpenPlacement]: [
    LegacyPermissionKeys.OrdersUkraine.Order.OpenPlacement,
  ],
  [PermissionKeys.OrdersUkraine.Order.OpenProductIncome]: [
    LegacyPermissionKeys.OrdersUkraine.Order.OpenProductIncome,
  ],
  [PermissionKeys.OrdersUkraine.Order.OpenProducts]: [
    LegacyPermissionKeys.OrdersUkraine.Order.OpenProducts,
  ],
  [PermissionKeys.OrdersUkraine.Order.OpenSpecificationCodes]: [
    LegacyPermissionKeys.OrdersUkraine.Order.OpenSpecificationCodes,
  ],
  [PermissionKeys.OrdersUkraine.PackList.Delete]: [
    LegacyPermissionKeys.OrdersUkraine.PackList.Delete,
  ],
  [PermissionKeys.OrdersUkraine.PackList.Upload]: [
    LegacyPermissionKeys.OrdersUkraine.PackList.Upload,
  ],
  [PermissionKeys.OrdersUkraine.Placement.Calculate]: [
    LegacyPermissionKeys.OrdersUkraine.Placement.Calculate,
  ],
  [PermissionKeys.OrdersUkraine.Placement.Capitalize]: [
    LegacyPermissionKeys.OrdersUkraine.Placement.Capitalize,
  ],
  [PermissionKeys.OrdersUkraine.Placement.CreateReconciliation]: [
    LegacyPermissionKeys.OrdersUkraine.Placement.CreateReconciliation,
  ],
  [PermissionKeys.OrdersUkraine.Placement.OpenProductPlacement]: [
    LegacyPermissionKeys.OrdersUkraine.Placement.OpenProductPlacement,
  ],
  [PermissionKeys.OrdersUkraine.Placement.Post]: [
    LegacyPermissionKeys.OrdersUkraine.Placement.Post,
  ],
  [PermissionKeys.OrdersUkraine.Placement.Save]: [
    LegacyPermissionKeys.OrdersUkraine.Placement.Save,
  ],
  [PermissionKeys.OrdersUkraine.Placement.UploadDocuments]: [
    LegacyPermissionKeys.OrdersUkraine.Placement.UploadDocuments,
  ],
  [PermissionKeys.OrdersUkraine.ProductIncome.Add]: [
    LegacyPermissionKeys.OrdersUkraine.ProductIncome.Add,
  ],
  [PermissionKeys.OrdersUkraine.ProductIncome.Capitalize]: [
    LegacyPermissionKeys.OrdersUkraine.ProductIncome.Capitalize,
  ],
  [PermissionKeys.OrdersUkraine.ProductIncome.Delete]: [
    LegacyPermissionKeys.OrdersUkraine.ProductIncome.Delete,
  ],
  [PermissionKeys.OrdersUkraine.ProductIncome.Post]: [
    LegacyPermissionKeys.OrdersUkraine.ProductIncome.Post,
  ],
  [PermissionKeys.OrdersUkraine.ProductIncome.ViewWeightHistory]: [
    LegacyPermissionKeys.OrdersUkraine.ProductIncome.ViewWeightHistory,
  ],
  [PermissionKeys.OrdersUkraine.SpecificationCodes.DownloadApplicationFiles]: [
    LegacyPermissionKeys.OrdersUkraine.SpecificationCodes
      .DownloadApplicationFiles,
  ],
  [PermissionKeys.OrdersUkraine.SpecificationCodes.DownloadCodes]: [
    LegacyPermissionKeys.OrdersUkraine.SpecificationCodes.DownloadCodes,
  ],
  [PermissionKeys.OrdersUkraine.SpecificationCodes.DownloadCustomsDocuments]: [
    LegacyPermissionKeys.OrdersUkraine.SpecificationCodes
      .DownloadCustomsDocuments,
  ],
  [PermissionKeys.OrdersUkraine.SpecificationCodes.Edit]: [
    LegacyPermissionKeys.OrdersUkraine.SpecificationCodes.Edit,
  ],
  [PermissionKeys.OrdersUkraine.SpecificationCodes.ViewHistory]: [
    LegacyPermissionKeys.OrdersUkraine.SpecificationCodes.ViewHistory,
  ],
  [PermissionKeys.SalesUkraine.Sale.OpenCreateDialog]: [
    LegacyPermissionKeys.SalesUkraine.Sale.Edit,
  ],
  [PermissionKeys.SalesUkraine.Sale.Create]: [
    LegacyPermissionKeys.SalesUkraine.Sale.Edit,
  ],
  [PermissionKeys.SalesUkraine.Sale.Edit]: [
    LegacyPermissionKeys.SalesUkraine.Sale.Edit,
  ],
  [PermissionKeys.SalesUkraine.Sale.Unlock]: [
    LegacyPermissionKeys.SalesUkraine.Sale.Unlock,
  ],
  [PermissionKeys.SalesUkraine.Sale.UnlockForShipping]: [
    LegacyPermissionKeys.SalesUkraine.Sale.UnlockForShipping,
  ],
  [PermissionKeys.SalesUkraine.Sale.SellWithoutPayment]: [
    LegacyPermissionKeys.SalesUkraine.Sale.SellWithoutPayment,
  ],
  [PermissionKeys.SalesUkraine.Sale.EditProductComment]: [
    LegacyPermissionKeys.SalesUkraine.Sale.EditProductComment,
  ],
}

const eventPermissionKeys = new Set<string>([
  ...Object.values(PermissionKeys.ActReconciliations.Page),
  ...Object.values(PermissionKeys.ActReconciliations.Act),
  ...Object.values(PermissionKeys.ActReconciliations.History),
  ...Object.values(PermissionKeys.ActReconciliations.Action),
  ...Object.values(PermissionKeys.ActReconciliations.Disposition),
  ...Object.values(PermissionKeys.SystemPages.Dashboard),
  ...Object.values(PermissionKeys.SystemPages.Users),
  ...Object.values(PermissionKeys.SystemPages.Roles),
  ...Object.values(PermissionKeys.SystemPages.VehicleRegistry),
  ...Object.values(PermissionKeys.SystemPages.ExpenseArticles),
  ...Object.values(PermissionKeys.SystemPages.AdvancedReports),
  ...Object.values(PermissionKeys.SystemPages.OutgoingCashflows),
  ...Object.values(PermissionKeys.SystemPages.ProductAvailabilities),
  ...Object.values(PermissionKeys.SystemPages.IncomeCashflows),
  ...Object.values(PermissionKeys.SystemPages.SupplyCart),
  ...Object.values(PermissionKeys.SystemPages.SupplySales),
  ...Object.values(PermissionKeys.SystemPages.ServiceOrganisations),
  ...Object.values(PermissionKeys.SystemPages.Sad),
  ...Object.values(PermissionKeys.SystemPages.TaxFreeCarriers),
  ...Object.values(PermissionKeys.SystemPages.TaxFreeDocuments),
  ...Object.values(PermissionKeys.SystemPages.TaxFreePackLists),
  ...Object.values(PermissionKeys.Users.User),
  ...Object.values(PermissionKeys.Roles.Role),
  ...Object.values(PermissionKeys.Roles.PagePermissions),
  ...Object.values(PermissionKeys.Roles.PermissionDefinition),
  ...Object.values(PermissionKeys.Roles.EventPermissions),
  ...Object.values(PermissionKeys.VehicleRegistry.Vehicle),
  ...Object.values(PermissionKeys.VehicleRegistry.Import),
  ...Object.values(PermissionKeys.ClientResources.Page),
  ...Object.values(PermissionKeys.ClientResources.Currency),
  ...Object.values(PermissionKeys.ClientResources.MeasureUnit),
  ...Object.values(PermissionKeys.ClientResources.Organization),
  ...Object.values(PermissionKeys.ClientResources.PerfectClient),
  ...Object.values(PermissionKeys.ClientResources.PricingRule),
  ...Object.values(PermissionKeys.ClientResources.Region),
  ...Object.values(PermissionKeys.ClientResources.RegionCode),
    ...Object.values(PermissionKeys.ClientResources.Storage),
    ...Object.values(PermissionKeys.ClientResources.TaxInspection),
    ...Object.values(PermissionKeys.ClientResources.VatRate),
    ...Object.values(PermissionKeys.ClientResources.Transporter),
  ...Object.values(PermissionKeys.Clients.Page),
  ...Object.values(PermissionKeys.Clients.AccountingCashFlow),
  ...Object.values(PermissionKeys.Clients.Client),
  ...Object.values(PermissionKeys.Clients.ClientType),
  ...Object.values(PermissionKeys.Clients.Contract),
  ...Object.values(PermissionKeys.Clients.Details),
  ...Object.values(PermissionKeys.Clients.Ecommerce),
  ...Object.values(PermissionKeys.Clients.Pricing),
  ...Object.values(PermissionKeys.Clients.Promotion),
  ...Object.values(PermissionKeys.Clients.Status),
  ...Object.values(PermissionKeys.Clients.Document),
  ...Object.values(PermissionKeys.Clients.ReservationDays),
  ...Object.values(PermissionKeys.Clients.Structure),
  ...Object.values(PermissionKeys.Clients.IdentityReview),
  ...Object.values(PermissionKeys.Suppliers.Page),
  ...Object.values(PermissionKeys.Suppliers.Passport),
  ...Object.values(PermissionKeys.Suppliers.Document),
  ...Object.values(PermissionKeys.OrganizationClients.Page),
  ...Object.values(PermissionKeys.OrganizationClients.Client),
  ...Object.values(PermissionKeys.ProductDeliveryProtocols.Page),
  ...Object.values(PermissionKeys.ProductDeliveryProtocols.DeliveryDocuments),
  ...Object.values(PermissionKeys.ProductDeliveryProtocols.Document),
  ...Object.values(PermissionKeys.ProductDeliveryProtocols.Documents),
  ...Object.values(PermissionKeys.ProductDeliveryProtocols.InvoiceManagement),
  ...Object.values(PermissionKeys.ProductDeliveryProtocols.LogisticWay),
  ...Object.values(PermissionKeys.ProductDeliveryProtocols.Options),
  ...Object.values(PermissionKeys.ProductDeliveryProtocols.ProductIncome),
  ...Object.values(PermissionKeys.ProductDeliveryProtocols.Protocol),
  ...Object.values(PermissionKeys.ProductDeliveryProtocols.SpecificationCodes),
  ...Object.values(
    PermissionKeys.ProductDeliveryProtocols.SpecificationHistory,
  ),
  ...Object.values(PermissionKeys.ProductDeliveryProtocols.UnifiedService),
  ...Object.values(PermissionKeys.ProductsAssortment.Page),
  ...Object.values(PermissionKeys.ProductsAssortment.Analytics),
  ...Object.values(PermissionKeys.ProductsAssortment.Audit),
  ...Object.values(PermissionKeys.ProductsAssortment.Product),
  ...Object.values(PermissionKeys.ProductsAssortment.Specification),
  ...Object.values(PermissionKeys.ProductsAssortment.Image),
  ...Object.values(PermissionKeys.ProductsAssortment.ConsignmentBalances),
  ...Object.values(PermissionKeys.ProductsAssortment.Movement),
  ...Object.values(PermissionKeys.ProductsAssortment.Placement),
  ...Object.values(PermissionKeys.ProductsAssortment.StorageHistory),
  ...Object.values(PermissionKeys.ProductsAssortment.WriteOffRules),
  ...Object.values(PermissionKeys.ProductsAssortment.Document),
  ...Object.values(PermissionKeys.ProductsAssortment.Legacy77),
  ...Object.values(PermissionKeys.ConsumableProducts.Page),
  ...Object.values(PermissionKeys.ConsumableProducts.Category),
  ...Object.values(PermissionKeys.ConsumableProducts.Product),
  ...Object.values(PermissionKeys.AccountableExpenses.Page),
  ...Object.values(PermissionKeys.ConsumableOrders.Page),
  ...Object.values(PermissionKeys.ConsumableOrders.Order),
  ...Object.values(PermissionKeys.SupplierOrganizations.Page),
  ...Object.values(PermissionKeys.SupplierOrganizations.Supplier),
  ...Object.values(PermissionKeys.SupplierOrganizations.Settlements),
  ...Object.values(PermissionKeys.SupplierOrganizations.Overview),
  ...Object.values(PermissionKeys.ProvidingServiceActs.Page),
  ...Object.values(PermissionKeys.ProvidingServiceActs.Act),
  ...Object.values(PermissionKeys.ProvidingServiceActs.LogisticWay),
  ...Object.values(PermissionKeys.ProvidingServiceActs.Overview),
  ...Object.values(PermissionKeys.Transporters.Page),
  ...Object.values(PermissionKeys.Transporters.Transporter),
  ...Object.values(PermissionKeys.Warehouses.CompanyCars.Page),
  ...Object.values(PermissionKeys.Warehouses.CompanyCars.Car),
  ...Object.values(PermissionKeys.Warehouses.Premises.Page),
  ...Object.values(PermissionKeys.Warehouses.Premises.Premise),
  ...Object.values(PermissionKeys.Warehouses.Ukraine.Page),
  ...Object.values(PermissionKeys.Warehouses.Ukraine.Invoices),
  ...Object.values(PermissionKeys.Warehouses.Ukraine.Shipments),
  ...Object.values(PermissionKeys.Warehouses.Ukraine.Orders),
  ...Object.values(PermissionKeys.WarehouseAccounting.Capitalization.Page),
  ...Object.values(PermissionKeys.WarehouseAccounting.Capitalization.Capitalization),
  ...Object.values(PermissionKeys.WarehouseAccounting.Capitalization.Document),
  ...Object.values(PermissionKeys.WarehouseAccounting.Storages.Page),
  ...Object.values(PermissionKeys.WarehouseAccounting.Storages.Preview),
  ...Object.values(PermissionKeys.WarehouseAccounting.Storages.PositionAction),
  ...Object.values(PermissionKeys.WarehouseAccounting.SupplierReturns.Page),
  ...Object.values(PermissionKeys.WarehouseAccounting.SupplierReturns.Return),
  ...Object.values(PermissionKeys.WarehouseAccounting.SupplierReturns.Document),
  ...Object.values(PermissionKeys.OnlineShopSeo.Client),
  ...Object.values(PermissionKeys.OnlineShopSeo.Contact),
  ...Object.values(PermissionKeys.OnlineShopSeo.GeneralInfo),
  ...Object.values(PermissionKeys.OnlineShopSeo.Page),
  ...Object.values(PermissionKeys.OnlineShopSeo.PaymentInfo),
  ...Object.values(PermissionKeys.OnlineShopSeo.PaymentRegister),
  ...Object.values(PermissionKeys.OnlineShopSeo.Resale),
  ...Object.values(PermissionKeys.OnlineShopSeo.SeoPage),
  ...Object.values(PermissionKeys.OnlineShopSeo.Storage),
  ...Object.values(PermissionKeys.OnlineShopSeo.Synchronization),
  ...Object.values(PermissionKeys.OnlineShopCities.City),
  ...Object.values(PermissionKeys.OnlineShopCities.Page),
  ...Object.values(PermissionKeys.OnlineShopClients.Page),
  ...Object.values(PermissionKeys.OnlineShopClients.Cart),
  ...Object.values(PermissionKeys.OnlineShopClients.Sales),
  ...Object.values(PermissionKeys.NewEcommerceClients.Page),
  ...Object.values(PermissionKeys.IncompleteSalesOnlineShop.Page),
  ...Object.values(PermissionKeys.IncompleteSalesOnlineShop.Sale),
  ...Object.values(PermissionKeys.ProductGroups.Page),
  ...Object.values(PermissionKeys.ProductGroups.Group),
  ...Object.values(PermissionKeys.ProductPricing.Page),
  ...Object.values(PermissionKeys.ProductPricing.CompetitorSearch),
  ...Object.values(PermissionKeys.ProductSpecificationCodes.Page),
  ...Object.values(PermissionKeys.ProductSpecificationCodes.Code),
  ...Object.values(PermissionKeys.FinancialAdministration.Banks.Page),
  ...Object.values(PermissionKeys.FinancialAdministration.Banks.Bank),
  ...Object.values(
    PermissionKeys.FinancialAdministration.CashflowArticles.Page,
  ),
  ...Object.values(
    PermissionKeys.FinancialAdministration.CashflowArticles.Article,
  ),
  ...Object.values(
    PermissionKeys.FinancialAdministration.ExpenseArticles.Article,
  ),
  ...Object.values(
    PermissionKeys.FinancialAdministration.CurrencyConvertors.Page,
  ),
  ...Object.values(
    PermissionKeys.FinancialAdministration.CurrencyConvertors.Converter,
  ),
  ...Object.values(PermissionKeys.FinancialAdministration.PaymentAccounts.Page),
  ...Object.values(
    PermissionKeys.FinancialAdministration.PaymentAccounts.Account,
  ),
  ...Object.values(
    PermissionKeys.FinancialAdministration.PaymentAccounts.Transfer,
  ),
  ...Object.values(
    PermissionKeys.FinancialAdministration.PaymentAccounts.Exchange,
  ),
  ...Object.values(PermissionKeys.OrdersUkraine.Invoice),
  ...Object.values(PermissionKeys.OrdersUkraine.Page),
  ...Object.values(PermissionKeys.OrdersUkraine.LogisticWay),
  ...Object.values(PermissionKeys.OrdersUkraine.Order),
  ...Object.values(PermissionKeys.OrdersUkraine.PackList),
  ...Object.values(PermissionKeys.OrdersUkraine.Placement),
  ...Object.values(PermissionKeys.OrdersUkraine.ProductIncome),
  ...Object.values(PermissionKeys.OrdersUkraine.SpecificationCodes),
  ...Object.values(PermissionKeys.SalesUkraine.Sale),
  ...Object.values(PermissionKeys.Resales.Page),
  ...Object.values(PermissionKeys.Resales.Resale),
  ...Object.values(PermissionKeys.Resales.Availability),
  ...Object.values(PermissionKeys.Resales.Document),
  ...Object.values(PermissionKeys.Resales.ConsignmentNote),
  ...Object.values(PermissionKeys.ReportsStocks.Page),
  ...Object.values(PermissionKeys.ReportsStocks.Report),
  ...Object.values(PermissionKeys.AdvancedReports.Report),
  ...Object.values(PermissionKeys.AdvancedReports.DocumentStructure),
  ...Object.values(PermissionKeys.OutgoingCashflows.Order),
  ...Object.values(PermissionKeys.ProductAvailabilities.Document),
])

export function isEventPermissionKey(
  permissionKey: string,
): permissionKey is PermissionKey {
  return eventPermissionKeys.has(permissionKey)
}
