export const PermissionKeys = {
  SystemPages: {
    BudgetCart: {
      View: 'orders.budget_cart.page.view',
    },
    PurchaseCockpit: {
      View: 'orders.purchase_cockpit.page.view',
    },
    SupplyDashboard: {
      View: 'orders.supply_dashboard.page.view',
    },
    SalesCockpit: {
      View: 'sales.cockpit.page.view',
    },
    SalesHeadDashboard: {
      View: 'sales.head_dashboard.page.view',
    },
    SalesUkraineOffers: {
      View: 'sales.ukraine_offers.page.view',
    },
    SalesUkraineInterest: {
      View: 'sales.ukraine_interest.page.view',
    },
    SalesUkraineCartReserve: {
      View: 'sales.ukraine_cart_reserve.page.view',
    },
    SalesUkraineClientProductMovement: {
      View: 'sales.ukraine_client_product_movement.page.view',
    },
    SalesUkraineDebtors: {
      View: 'sales.ukraine_debtors.page.view',
    },
    SalesUkrainePrediction: {
      View: 'sales.ukraine_prediction.page.view',
    },
    SalesUkraineReturns: {
      View: 'sales.ukraine_returns.page.view',
    },
    SalesCharts: {
      View: 'sales.charts.page.view',
    },
    SalesGeography: {
      View: 'sales.geography.page.view',
    },
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
    SyncDocuments: {
      View: 'administration.sync_documents.page.view',
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
    ConsignmentBalances: {
      View: 'warehouse_accounting.consignment_balances.page.view',
    },
    WriteOff: {
      View: 'warehouse_accounting.write_off.page.view',
    },
    OnlineShopPayment: {
      View: 'payments.online_shop_payment.page.view',
    },
    AdvancePayments: {
      View: 'payments.advance_payments.page.view',
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
    SalesOnlineShop: {
      View: 'sales.online_shop_sales.page.view',
    },
  },
  Operational: {
    SchedulerTasks: {
      MergeAllSales: 'administration.scheduler_tasks.sales.merge_all',
      ClearInvalidShoppingCarts:
        'administration.scheduler_tasks.shopping_carts.clear_invalid',
      GenerateExpiredBillNotifications:
        'administration.scheduler_tasks.expired_bill_notifications.generate',
      DeferExpiredBillNotifications:
        'administration.scheduler_tasks.expired_bill_notifications.defer',
      UpdateProductPrices:
        'administration.scheduler_tasks.product_prices.update',
      UpdateProductAvailabilityPl:
        'administration.scheduler_tasks.product_availability_pl.update',
      UpdateProductAvailabilityUa:
        'administration.scheduler_tasks.product_availability_ua.update',
    },
    ShopOrders: {
      ReadAll: 'sales.online_shop_sales.order.read_all',
    },
    GbaData: {
      Read: 'integration.gba_data.dataset.read',
    },
  },
  SupplyCart: {
    Document: {
      Assemble: 'orders.supply_cart.document.assemble',
    },
    File: {
      Import: 'orders.supply_cart.file.import',
    },
    Item: {
      EditReservation: 'orders.supply_cart.item.edit_reservation',
    },
  },
  PurchaseCockpit: {
    Document: {
      Export: 'orders.purchase_cockpit.document.export',
    },
    DraftOrder: {
      Create: 'orders.purchase_cockpit.draft_order.create',
    },
    Feedback: {
      Submit: 'orders.purchase_cockpit.feedback.submit',
    },
    ProducerProfile: {
      Edit: 'orders.purchase_cockpit.producer_profile.edit',
    },
    ProductTerms: {
      Edit: 'orders.purchase_cockpit.product_terms.edit',
    },
  },
  SalesCockpit: {
    Task: {
      TakeInProgress: 'sales.cockpit.task.take_in_progress',
      Complete: 'sales.cockpit.task.complete',
      Snooze: 'sales.cockpit.task.snooze',
      Dismiss: 'sales.cockpit.task.dismiss',
      AddNote: 'sales.cockpit.task.add_note',
      Generate: 'sales.cockpit.task.generate',
    },
  },
  SalesHeadDashboard: {
    Task: {
      Create: 'sales.head_dashboard.task.create',
      AddNote: 'sales.head_dashboard.task.add_note',
      Dismiss: 'sales.head_dashboard.task.dismiss',
      Generate: 'sales.head_dashboard.task.generate',
    },
  },
  SalesUkraineOffers: {
    Offer: {
      Create: 'sales.ukraine.offer.create',
      Edit: 'sales.ukraine.offer.edit',
      Delete: 'sales.ukraine.offer.delete',
      ExtendValidity: 'sales.ukraine.offer.extend_validity',
    },
  },
  SalesUkraineInterest: {
    Preorder: {
      Create: 'sales.ukraine_interest.preorder.create',
    },
  },
  SupplySales: {
    Sale: {
      Open: 'orders.supply_sales.sale.open',
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
      AccountingSettingsEdit:
        'counterparties.clients.contract.accounting_settings.edit',
      ExportDocument: 'counterparties.clients.contract.export_document',
      Edit: 'counterparties.clients.contract.edit',
      PricingScopeOverride:
        'counterparties.clients.contract.pricing_scope.override',
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
    AvailablePayments: {
      Page: {
        View: 'payments.available_payments.page.view',
      },
      OutcomeOrder: {
        Create: 'payments.available_payments.outcome_order.create',
      },
      Task: {
        MarkAvailable: 'payments.available_payments.task.mark_available',
        Merge: 'payments.available_payments.task.merge',
      },
      CashFlow: {
        Open: 'payments.available_payments.cash_flow.open',
      },
    },
    IncomeCashflows: {
      IncomeOrder: {
        CreateClientPayment:
          'accounting.income_cashflows.client_payment.create',
        CreateSupplierReturn:
          'accounting.income_cashflows.supplier_return.create',
        CreateCounterpartyIncome:
          'accounting.income_cashflows.counterparty_income.create',
        CreateOtherIncome: 'accounting.income_cashflows.other_income.create',
        CreateColleagueReturn:
          'accounting.income_cashflows.colleague_return.create',
      },
      Order: {
        OpenDetails: 'accounting.income_cashflows.order.open_details',
        ReassignClient: 'accounting.income_cashflows.order.reassign_client',
        Cancel: 'accounting.income_cashflows.order.cancel',
      },
    },
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
    Invoice: {
      Merge: 'orders.delivery_protocol.invoice.merge',
    },
    LogisticWay: {
      Open: 'orders.delivery_protocol.logistic_way.open',
    },
    Options: {
      Open: 'orders.delivery_protocol.options.open',
    },
    ProductIncome: {
      Capitalize: 'orders.delivery_protocol.product_income.capitalize',
      DownloadDocument: 'orders.delivery_protocol.product_income.download_document',
      Open: 'orders.delivery_protocol.product_income.open',
      EditPlacement: 'orders.delivery_protocol.product_income.edit_placement',
      Post: 'orders.delivery_protocol.product_income.post',
      UpdateReadiness: 'orders.delivery_protocol.product_income.update_readiness',
    },
    Protocol: {
      Create: 'orders.delivery_protocol.protocol.create',
      EditCompleted: 'orders.delivery_protocol.completed_protocol.edit',
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
  ProductHistory: {
    Page: {
      View: 'products.history.page.view',
    },
    Document: {
      Export: 'products.history.document.export',
    },
  },
  ProductPlacements: {
    Page: {
      View: 'products.placements.page.view',
    },
    File: {
      Import: 'products.placements.file.import',
    },
    Document: {
      Export: 'products.placements.document.export',
    },
  },
  ProductIncomeDocuments: {
    Page: {
      View: 'warehouse_accounting.income_documents.page.view',
    },
    Document: {
      OpenDetails: 'warehouse_accounting.income_documents.document.open_details',
      OpenRemainings: 'warehouse_accounting.income_documents.document.open_remainings',
      Export: 'warehouse_accounting.income_documents.document.export',
    },
  },
  ProductTransfers: {
    Page: {
      View: 'warehouse_accounting.transfers.page.view',
    },
    Transfer: {
      Create: 'warehouse_accounting.transfers.transfer.create',
      CreateManagement:
        'warehouse_accounting.transfers.transfer.create_management',
      OpenDetails: 'warehouse_accounting.transfers.transfer.open_details',
    },
    Document: {
      Export: 'warehouse_accounting.transfers.document.export',
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
      Edit: 'services.supplier_organizations.supplier.edit',
      Delete: 'services.supplier_organizations.supplier.delete',
    },
    Agreement: {
      Create: 'services.supplier_organizations.agreement.create',
      Edit: 'services.supplier_organizations.agreement.edit',
    },
    Settlements: {
      Open: 'services.supplier_organizations.settlements.open',
      Export: 'services.supplier_organizations.settlements.export',
    },
    Overview: {
      Open: 'services.supplier_organizations.overview.open',
    },
    Document: {
      Export: 'services.supplier_organizations.document.export',
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
        Delete: 'warehouses.company_cars.car.delete',
        Edit: 'warehouses.company_cars.car.edit',
      },
      RoadList: {
        Create: 'warehouses.company_cars.road_list.create',
        Delete: 'warehouses.company_cars.road_list.delete',
        Edit: 'warehouses.company_cars.road_list.edit',
        Open: 'warehouses.company_cars.road_list.open',
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
    WriteOff: {
      Order: {
        Create: 'warehouse_accounting.write_off.order.create',
        CreateManagement:
          'warehouse_accounting.write_off.order.create_management',
        OpenDetails: 'warehouse_accounting.write_off.order.open_details',
      },
      Document: {
        Export: 'warehouse_accounting.write_off.document.export',
      },
    },
    ConsignmentBalances: {
      Document: {
        Export: 'warehouse_accounting.consignment_balances.document.export',
      },
    },
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
      Document: {
        Export: 'warehouse_accounting.storages.document.export',
      },
      Preview: {
        Open: 'warehouse_accounting.storages.preview.open',
      },
      PositionAction: {
        Management:
          'warehouse_accounting.storages.position_action.management',
        Open: 'warehouse_accounting.storages.position_action.open',
      },
    },
  },
  TaxFreeCarriers: {
    Carrier: {
      Create: 'warehouse_accounting.tax_free_carriers.carrier.create',
      Delete: 'warehouse_accounting.tax_free_carriers.carrier.delete',
      Edit: 'warehouse_accounting.tax_free_carriers.carrier.edit',
    },
    Document: {
      Export: 'warehouse_accounting.tax_free_carriers.document.export',
    },
  },
  TaxFreeDocuments: {
    Document: {
      Edit: 'warehouse_accounting.tax_free_documents.document.edit',
      Export: 'warehouse_accounting.tax_free_documents.document.export',
      OpenDetails: 'warehouse_accounting.tax_free_documents.document.open_details',
      Print: 'warehouse_accounting.tax_free_documents.document.print',
    },
    Status: {
      Change: 'warehouse_accounting.tax_free_documents.status.change',
    },
    Accounting: {
      CreateIncome: 'warehouse_accounting.tax_free_documents.accounting.create_income',
      CreateOutcome: 'warehouse_accounting.tax_free_documents.accounting.create_outcome',
    },
  },
  TaxFreePackLists: {
    PackList: {
      Break: 'warehouse_accounting.tax_free_pack_lists.pack_list.break',
      Delete: 'warehouse_accounting.tax_free_pack_lists.pack_list.delete',
      Edit: 'warehouse_accounting.tax_free_pack_lists.pack_list.edit',
      OpenDetails: 'warehouse_accounting.tax_free_pack_lists.pack_list.open_details',
      Send: 'warehouse_accounting.tax_free_pack_lists.pack_list.send',
    },
    Document: {
      Delete: 'warehouse_accounting.tax_free_pack_lists.document.delete',
      Export: 'warehouse_accounting.tax_free_pack_lists.document.export',
      Upload: 'warehouse_accounting.tax_free_pack_lists.document.upload',
    },
    SupplyOrder: {
      Create: 'warehouse_accounting.tax_free_pack_lists.supply_order.create',
    },
  },
  Sad: {
    Sad: {
      OpenDetails: 'warehouse_accounting.sad.sad.open_details',
      Edit: 'warehouse_accounting.sad.sad.edit',
      Send: 'warehouse_accounting.sad.sad.send',
      Delete: 'warehouse_accounting.sad.sad.delete',
    },
    Pallet: {
      Edit: 'warehouse_accounting.sad.pallet.edit',
    },
    Document: {
      Export: 'warehouse_accounting.sad.document.export',
      Upload: 'warehouse_accounting.sad.document.upload',
      Delete: 'warehouse_accounting.sad.document.delete',
    },
    Specification: {
      Edit: 'warehouse_accounting.sad.specification.edit',
      Import: 'warehouse_accounting.sad.specification.import',
    },
    SupplyOrder: {
      Create: 'warehouse_accounting.sad.supply_order.create',
    },
    Accounting: {
      CreateIncome: 'warehouse_accounting.sad.accounting.create_income',
      CreateOutcome: 'warehouse_accounting.sad.accounting.create_outcome',
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
      Import: 'products.specification_codes.code.import',
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
      ChangeDeliveryDocumentStatus:
        'orders.ukraine.logistic_way.change_delivery_document_status',
      DeletePaymentTask: 'orders.ukraine.logistic_way.delete_payment_task',
      EditInvoice: 'orders.ukraine.logistic_way.edit_invoice',
      EditOrderQuantity: 'orders.ukraine.logistic_way.edit_order_quantity',
      UploadDeliveryDocument:
        'orders.ukraine.logistic_way.upload_delivery_document',
    },
    Order: {
      AddDeliveryCosts: 'orders.ukraine.order.add_delivery_costs',
      MutateCompletedService:
        'orders.ukraine.order.completed_service_mutation',
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
      CancelAnyReturn: 'sales.ukraine.sale_return.cancel_any',
      CreateAnyReturn: 'sales.ukraine.sale_return.create_any',
      OpenCreateDialog: 'sales.ukraine.sale.open_create_dialog',
      Create: 'sales.ukraine.sale.create',
      OpenDetails: 'sales.ukraine.sale.open_details',
      OpenContextMenu: 'sales.ukraine.sale.open_context_menu',
      Edit: 'sales.ukraine.sale.edit',
      ConvertMergedToBill: 'sales.ukraine.sale.convert_merged_to_bill',
      Delete: 'sales.ukraine.sale.delete',
      OpenDeliveryDetails: 'sales.ukraine.sale.open_delivery_details',
      Unlock: 'sales.ukraine.sale.unlock',
      UnlockForShipping: 'sales.ukraine.sale.unlock_for_shipping',
      PrintConsignmentNote: 'sales.ukraine.sale.print_consignment_note',
      SaveConsignmentNoteSetting: 'sales.ukraine.consignment_note_setting.save',
      DeleteConsignmentNoteSetting: 'sales.ukraine.consignment_note_setting.delete',
      CreateFutureReservation: 'sales.ukraine.future_reservation.create',
      Reassign: 'sales.ukraine.sale.reassign',
      ExportInvoice: 'sales.ukraine.sale.export_invoice',
      ExportBeforePacking: 'sales.ukraine.sale.export_before_packing',
      ExportShipmentList: 'sales.ukraine.sale.export_shipment_list',
      ExportPaymentInvoice: 'sales.ukraine.sale.export_payment_invoice',
      ExportPz: 'sales.ukraine.sale.export_pz',
      ExportRevisionDocuments: 'sales.ukraine.sale.export_revision_documents',
      ViewAudit: 'sales.ukraine.sale.view_audit',
      SellWithoutPayment: 'sales.ukraine.sale.sell_without_payment',
      EditProductComment: 'sales.ukraine.sale.edit_product_comment',
    },
  },
  OnlineShopPayment: {
    Payment: {
      Create: 'payments.online_shop_payment.payment.create',
      Edit: 'payments.online_shop_payment.payment.edit',
    },
    IncomeOrder: {
      Create: 'accounting.income_cashflows.client_payment.create',
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
  ReportsSaleFile: {
    Page: {
      View: 'reports.sale_file.page.view',
    },
    Document: {
      Export: 'reports.sale_file.document.export',
      Print: 'reports.sale_file.document.print',
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

export type ReportsSaleFilePermissionKey =
  | Values<typeof PermissionKeys.ReportsSaleFile.Page>
  | Values<typeof PermissionKeys.ReportsSaleFile.Document>

export type AdvancedReportsPermissionKey =
  | Values<typeof PermissionKeys.AdvancedReports.Report>
  | Values<typeof PermissionKeys.AdvancedReports.DocumentStructure>

export type OutgoingCashflowsPermissionKey =
  Values<typeof PermissionKeys.OutgoingCashflows.Order>

export type ProductAvailabilitiesPermissionKey =
  Values<typeof PermissionKeys.ProductAvailabilities.Document>

type Values<T> = T[keyof T]

export type SystemPagePermissionKey =
  | Values<typeof PermissionKeys.SystemPages.BudgetCart>
  | Values<typeof PermissionKeys.SystemPages.PurchaseCockpit>
  | Values<typeof PermissionKeys.SystemPages.SupplyDashboard>
  | Values<typeof PermissionKeys.SystemPages.SalesCockpit>
  | Values<typeof PermissionKeys.SystemPages.SalesHeadDashboard>
  | Values<typeof PermissionKeys.SystemPages.SalesUkraineOffers>
  | Values<typeof PermissionKeys.SystemPages.SalesUkraineInterest>
  | Values<typeof PermissionKeys.SystemPages.SalesUkraineCartReserve>
  | Values<typeof PermissionKeys.SystemPages.SalesUkraineClientProductMovement>
  | Values<typeof PermissionKeys.SystemPages.SalesUkraineDebtors>
  | Values<typeof PermissionKeys.SystemPages.SalesUkrainePrediction>
  | Values<typeof PermissionKeys.SystemPages.SalesUkraineReturns>
  | Values<typeof PermissionKeys.SystemPages.SalesCharts>
  | Values<typeof PermissionKeys.SystemPages.Dashboard>
  | Values<typeof PermissionKeys.SystemPages.Users>
  | Values<typeof PermissionKeys.SystemPages.Roles>
  | Values<typeof PermissionKeys.SystemPages.VehicleRegistry>
  | Values<typeof PermissionKeys.SystemPages.ExpenseArticles>
  | Values<typeof PermissionKeys.SystemPages.AdvancedReports>
  | Values<typeof PermissionKeys.SystemPages.OutgoingCashflows>
  | Values<typeof PermissionKeys.SystemPages.ProductAvailabilities>
  | Values<typeof PermissionKeys.SystemPages.ConsignmentBalances>
  | Values<typeof PermissionKeys.SystemPages.WriteOff>
  | Values<typeof PermissionKeys.SystemPages.OnlineShopPayment>
  | Values<typeof PermissionKeys.SystemPages.IncomeCashflows>
  | Values<typeof PermissionKeys.SystemPages.SupplyCart>
  | Values<typeof PermissionKeys.SystemPages.SupplySales>
  | Values<typeof PermissionKeys.SystemPages.ServiceOrganisations>
  | Values<typeof PermissionKeys.SystemPages.Sad>
  | Values<typeof PermissionKeys.SystemPages.TaxFreeCarriers>
  | Values<typeof PermissionKeys.SystemPages.TaxFreeDocuments>
  | Values<typeof PermissionKeys.SystemPages.TaxFreePackLists>
  | Values<typeof PermissionKeys.SystemPages.SalesOnlineShop>

export type OperationalPermissionKey =
  | Values<typeof PermissionKeys.Operational.SchedulerTasks>
  | Values<typeof PermissionKeys.Operational.ShopOrders>
  | Values<typeof PermissionKeys.Operational.GbaData>

export type SupplyCartPermissionKey =
  | Values<typeof PermissionKeys.SupplyCart.Document>
  | Values<typeof PermissionKeys.SupplyCart.File>
  | Values<typeof PermissionKeys.SupplyCart.Item>

export type PurchaseCockpitPermissionKey =
  | Values<typeof PermissionKeys.PurchaseCockpit.Document>
  | Values<typeof PermissionKeys.PurchaseCockpit.DraftOrder>
  | Values<typeof PermissionKeys.PurchaseCockpit.Feedback>
  | Values<typeof PermissionKeys.PurchaseCockpit.ProducerProfile>
  | Values<typeof PermissionKeys.PurchaseCockpit.ProductTerms>

export type SalesCockpitPermissionKey =
  | Values<typeof PermissionKeys.SalesCockpit.Task>

export type SalesHeadDashboardPermissionKey =
  | Values<typeof PermissionKeys.SalesHeadDashboard.Task>

export type SalesUkraineOffersPermissionKey =
  | Values<typeof PermissionKeys.SalesUkraineOffers.Offer>

export type SalesUkraineInterestPermissionKey =
  | Values<typeof PermissionKeys.SalesUkraineInterest.Preorder>

export type SupplySalesPermissionKey =
  Values<typeof PermissionKeys.SupplySales.Sale>

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
  | Values<typeof PermissionKeys.ProductDeliveryProtocols.Invoice>
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

export type ProductHistoryPermissionKey =
  | Values<typeof PermissionKeys.ProductHistory.Page>
  | Values<typeof PermissionKeys.ProductHistory.Document>

export type ProductPlacementsPermissionKey =
  | Values<typeof PermissionKeys.ProductPlacements.Page>
  | Values<typeof PermissionKeys.ProductPlacements.File>
  | Values<typeof PermissionKeys.ProductPlacements.Document>

export type ProductIncomeDocumentsPermissionKey =
  | Values<typeof PermissionKeys.ProductIncomeDocuments.Page>
  | Values<typeof PermissionKeys.ProductIncomeDocuments.Document>

export type ProductTransfersPermissionKey =
  | Values<typeof PermissionKeys.ProductTransfers.Page>
  | Values<typeof PermissionKeys.ProductTransfers.Transfer>
  | Values<typeof PermissionKeys.ProductTransfers.Document>

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
  | Values<typeof PermissionKeys.SupplierOrganizations.Agreement>
  | Values<typeof PermissionKeys.SupplierOrganizations.Settlements>
  | Values<typeof PermissionKeys.SupplierOrganizations.Overview>
  | Values<typeof PermissionKeys.SupplierOrganizations.Document>

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
  | Values<typeof PermissionKeys.Warehouses.CompanyCars.RoadList>
  | Values<typeof PermissionKeys.Warehouses.Premises.Page>
  | Values<typeof PermissionKeys.Warehouses.Premises.Premise>
  | Values<typeof PermissionKeys.Warehouses.Premises.WriteOff>
  | Values<typeof PermissionKeys.Warehouses.Ukraine.Page>
  | Values<typeof PermissionKeys.Warehouses.Ukraine.Invoices>
  | Values<typeof PermissionKeys.Warehouses.Ukraine.Shipments>
  | Values<typeof PermissionKeys.Warehouses.Ukraine.Orders>

export type WarehouseAccountingPermissionKey =
  | Values<typeof PermissionKeys.WarehouseAccounting.WriteOff.Order>
  | Values<typeof PermissionKeys.WarehouseAccounting.WriteOff.Document>
  | Values<typeof PermissionKeys.WarehouseAccounting.ConsignmentBalances.Document>
  | Values<typeof PermissionKeys.WarehouseAccounting.Capitalization.Page>
  | Values<typeof PermissionKeys.WarehouseAccounting.Capitalization.Capitalization>
  | Values<typeof PermissionKeys.WarehouseAccounting.Capitalization.Document>
  | Values<typeof PermissionKeys.WarehouseAccounting.SupplierReturns.Page>
  | Values<typeof PermissionKeys.WarehouseAccounting.SupplierReturns.Return>
  | Values<typeof PermissionKeys.WarehouseAccounting.SupplierReturns.Document>
  | Values<typeof PermissionKeys.WarehouseAccounting.Storages.Page>
  | Values<typeof PermissionKeys.WarehouseAccounting.Storages.Document>
  | Values<typeof PermissionKeys.WarehouseAccounting.Storages.Preview>
  | Values<typeof PermissionKeys.WarehouseAccounting.Storages.PositionAction>

export type TaxFreeCarriersPermissionKey =
  | Values<typeof PermissionKeys.TaxFreeCarriers.Carrier>
  | Values<typeof PermissionKeys.TaxFreeCarriers.Document>

export type TaxFreeDocumentsPermissionKey =
  | Values<typeof PermissionKeys.TaxFreeDocuments.Document>
  | Values<typeof PermissionKeys.TaxFreeDocuments.Status>
  | Values<typeof PermissionKeys.TaxFreeDocuments.Accounting>

export type TaxFreePackListsPermissionKey =
  | Values<typeof PermissionKeys.TaxFreePackLists.PackList>
  | Values<typeof PermissionKeys.TaxFreePackLists.Document>
  | Values<typeof PermissionKeys.TaxFreePackLists.SupplyOrder>

export type SadPermissionKey =
  | Values<typeof PermissionKeys.Sad.Sad>
  | Values<typeof PermissionKeys.Sad.Pallet>
  | Values<typeof PermissionKeys.Sad.Document>
  | Values<typeof PermissionKeys.Sad.Specification>
  | Values<typeof PermissionKeys.Sad.SupplyOrder>
  | Values<typeof PermissionKeys.Sad.Accounting>

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

export type OnlineShopPaymentPermissionKey =
  | Values<typeof PermissionKeys.OnlineShopPayment.Payment>
  | Values<typeof PermissionKeys.OnlineShopPayment.IncomeOrder>

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
  | Values<typeof PermissionKeys.FinancialAdministration.AvailablePayments.Page>
  | Values<
      typeof PermissionKeys.FinancialAdministration.AvailablePayments.OutcomeOrder
    >
  | Values<typeof PermissionKeys.FinancialAdministration.AvailablePayments.Task>
  | Values<
      typeof PermissionKeys.FinancialAdministration.AvailablePayments.CashFlow
    >
  | Values<
      typeof PermissionKeys.FinancialAdministration.IncomeCashflows.IncomeOrder
    >
  | Values<
      typeof PermissionKeys.FinancialAdministration.IncomeCashflows.Order
    >
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
  | OperationalPermissionKey
  | SupplyCartPermissionKey
  | PurchaseCockpitPermissionKey
  | SalesCockpitPermissionKey
  | SalesHeadDashboardPermissionKey
  | SalesUkraineOffersPermissionKey
  | SalesUkraineInterestPermissionKey
  | SupplySalesPermissionKey
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
  | OnlineShopPaymentPermissionKey
  | NewEcommerceClientsPermissionKey
  | OnlineShopSeoPermissionKey
  | ProductDeliveryProtocolsPermissionKey
  | ProductGroupsPermissionKey
  | ProductPricingPermissionKey
  | ProductsAssortmentPermissionKey
  | ProductHistoryPermissionKey
  | ProductPlacementsPermissionKey
  | ProductIncomeDocumentsPermissionKey
  | ProductTransfersPermissionKey
  | ProductSpecificationCodesPermissionKey
  | ProvidingServiceActsPermissionKey
  | TransportersPermissionKey
  | SalesUkraineSalePermissionKey
  | ResalesPermissionKey
  | ReportsStocksPermissionKey
  | ReportsSaleFilePermissionKey
  | SupplierOrganizationsPermissionKey
  | TaxFreeCarriersPermissionKey
  | TaxFreeDocumentsPermissionKey
  | TaxFreePackListsPermissionKey
  | SadPermissionKey
  | WarehouseAccountingPermissionKey
  | WarehousesPermissionKey

const eventPermissionKeyList = [
  ...Object.values(PermissionKeys.Operational.SchedulerTasks),
  ...Object.values(PermissionKeys.Operational.ShopOrders),
  ...Object.values(PermissionKeys.Operational.GbaData),
  ...Object.values(PermissionKeys.ActReconciliations.Page),
  ...Object.values(PermissionKeys.ActReconciliations.Act),
  ...Object.values(PermissionKeys.ActReconciliations.History),
  ...Object.values(PermissionKeys.ActReconciliations.Action),
  ...Object.values(PermissionKeys.ActReconciliations.Disposition),
  ...Object.values(PermissionKeys.SystemPages.BudgetCart),
  ...Object.values(PermissionKeys.SystemPages.PurchaseCockpit),
  ...Object.values(PermissionKeys.SystemPages.SupplyDashboard),
  ...Object.values(PermissionKeys.SystemPages.SalesCockpit),
  ...Object.values(PermissionKeys.SystemPages.SalesHeadDashboard),
  ...Object.values(PermissionKeys.SystemPages.SalesUkraineOffers),
  ...Object.values(PermissionKeys.SystemPages.SalesUkraineInterest),
  ...Object.values(PermissionKeys.SystemPages.SalesUkraineCartReserve),
  ...Object.values(PermissionKeys.SystemPages.SalesUkraineClientProductMovement),
  ...Object.values(PermissionKeys.SystemPages.SalesUkraineDebtors),
  ...Object.values(PermissionKeys.SystemPages.SalesUkrainePrediction),
  ...Object.values(PermissionKeys.SystemPages.SalesUkraineReturns),
  ...Object.values(PermissionKeys.SystemPages.SalesCharts),
  ...Object.values(PermissionKeys.SystemPages.SalesGeography),
  ...Object.values(PermissionKeys.SystemPages.Dashboard),
  ...Object.values(PermissionKeys.SystemPages.Users),
  ...Object.values(PermissionKeys.SystemPages.Roles),
  ...Object.values(PermissionKeys.SystemPages.VehicleRegistry),
  ...Object.values(PermissionKeys.SystemPages.SyncDocuments),
  ...Object.values(PermissionKeys.SystemPages.ExpenseArticles),
  ...Object.values(PermissionKeys.SystemPages.AdvancedReports),
  ...Object.values(PermissionKeys.SystemPages.OutgoingCashflows),
  ...Object.values(PermissionKeys.SystemPages.ProductAvailabilities),
  ...Object.values(PermissionKeys.SystemPages.ConsignmentBalances),
  ...Object.values(PermissionKeys.SystemPages.WriteOff),
  ...Object.values(PermissionKeys.SystemPages.OnlineShopPayment),
  ...Object.values(PermissionKeys.SystemPages.AdvancePayments),
  ...Object.values(PermissionKeys.SystemPages.IncomeCashflows),
  ...Object.values(PermissionKeys.SystemPages.SupplyCart),
  ...Object.values(PermissionKeys.SystemPages.SupplySales),
  ...Object.values(PermissionKeys.SystemPages.ServiceOrganisations),
  ...Object.values(PermissionKeys.SystemPages.Sad),
  ...Object.values(PermissionKeys.SystemPages.TaxFreeCarriers),
  ...Object.values(PermissionKeys.SystemPages.TaxFreeDocuments),
  ...Object.values(PermissionKeys.SystemPages.TaxFreePackLists),
  ...Object.values(PermissionKeys.SystemPages.SalesOnlineShop),
  ...Object.values(PermissionKeys.SupplyCart.Document),
  ...Object.values(PermissionKeys.SupplyCart.File),
  ...Object.values(PermissionKeys.SupplyCart.Item),
  ...Object.values(PermissionKeys.PurchaseCockpit.Document),
  ...Object.values(PermissionKeys.PurchaseCockpit.DraftOrder),
  ...Object.values(PermissionKeys.PurchaseCockpit.Feedback),
  ...Object.values(PermissionKeys.PurchaseCockpit.ProducerProfile),
  ...Object.values(PermissionKeys.PurchaseCockpit.ProductTerms),
  ...Object.values(PermissionKeys.SalesCockpit.Task),
  ...Object.values(PermissionKeys.SalesHeadDashboard.Task),
  ...Object.values(PermissionKeys.SalesUkraineOffers.Offer),
  ...Object.values(PermissionKeys.SalesUkraineInterest.Preorder),
  ...Object.values(PermissionKeys.SupplySales.Sale),
  ...Object.values(PermissionKeys.Users.User),
  ...Object.values(PermissionKeys.Roles.Role),
  ...Object.values(PermissionKeys.Roles.PagePermissions),
  ...Object.values(PermissionKeys.Roles.PermissionDefinition),
  ...Object.values(PermissionKeys.Roles.EventPermissions),
  ...Object.values(PermissionKeys.VehicleRegistry.Vehicle),
  ...Object.values(PermissionKeys.VehicleRegistry.Import),
  ...Object.values(PermissionKeys.ClientResources.Page),
  ...Object.values(PermissionKeys.ClientResources.Country),
  ...Object.values(PermissionKeys.ClientResources.Currency),
  ...Object.values(PermissionKeys.ClientResources.Incoterm),
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
  ...Object.values(PermissionKeys.Clients.Recommendations),
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
  ...Object.values(PermissionKeys.ProductDeliveryProtocols.Invoice),
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
  ...Object.values(PermissionKeys.ProductHistory.Page),
  ...Object.values(PermissionKeys.ProductHistory.Document),
  ...Object.values(PermissionKeys.ProductPlacements.Page),
  ...Object.values(PermissionKeys.ProductPlacements.File),
  ...Object.values(PermissionKeys.ProductPlacements.Document),
  ...Object.values(PermissionKeys.ProductIncomeDocuments.Page),
  ...Object.values(PermissionKeys.ProductIncomeDocuments.Document),
  ...Object.values(PermissionKeys.ProductTransfers.Page),
  ...Object.values(PermissionKeys.ProductTransfers.Transfer),
  ...Object.values(PermissionKeys.ProductTransfers.Document),
  ...Object.values(PermissionKeys.ConsumableProducts.Page),
  ...Object.values(PermissionKeys.ConsumableProducts.Category),
  ...Object.values(PermissionKeys.ConsumableProducts.Product),
  ...Object.values(PermissionKeys.AccountableExpenses.Page),
  ...Object.values(PermissionKeys.ConsumableOrders.Page),
  ...Object.values(PermissionKeys.ConsumableOrders.Order),
  ...Object.values(PermissionKeys.SupplierOrganizations.Page),
  ...Object.values(PermissionKeys.SupplierOrganizations.Supplier),
  ...Object.values(PermissionKeys.SupplierOrganizations.Agreement),
  ...Object.values(PermissionKeys.SupplierOrganizations.Settlements),
  ...Object.values(PermissionKeys.SupplierOrganizations.Overview),
  ...Object.values(PermissionKeys.SupplierOrganizations.Document),
  ...Object.values(PermissionKeys.ProvidingServiceActs.Page),
  ...Object.values(PermissionKeys.ProvidingServiceActs.Act),
  ...Object.values(PermissionKeys.ProvidingServiceActs.LogisticWay),
  ...Object.values(PermissionKeys.ProvidingServiceActs.Overview),
  ...Object.values(PermissionKeys.Transporters.Page),
  ...Object.values(PermissionKeys.Transporters.Transporter),
  ...Object.values(PermissionKeys.Warehouses.CompanyCars.Page),
  ...Object.values(PermissionKeys.Warehouses.CompanyCars.Car),
  ...Object.values(PermissionKeys.Warehouses.CompanyCars.RoadList),
  ...Object.values(PermissionKeys.Warehouses.Premises.Page),
  ...Object.values(PermissionKeys.Warehouses.Premises.Premise),
  ...Object.values(PermissionKeys.Warehouses.Premises.WriteOff),
  ...Object.values(PermissionKeys.Warehouses.Ukraine.Page),
  ...Object.values(PermissionKeys.Warehouses.Ukraine.Invoices),
  ...Object.values(PermissionKeys.Warehouses.Ukraine.Shipments),
  ...Object.values(PermissionKeys.Warehouses.Ukraine.Orders),
  ...Object.values(PermissionKeys.Warehouses.Ukraine.Editing),
  ...Object.values(PermissionKeys.Warehouses.Ukraine.InvoiceRegister),
  ...Object.values(PermissionKeys.Warehouses.Ukraine.Verification),
  ...Object.values(PermissionKeys.Warehouses.Ukraine.Shipment),
  ...Object.values(PermissionKeys.Warehouses.Ukraine.Invoice),
  ...Object.values(PermissionKeys.WarehouseAccounting.Capitalization.Page),
  ...Object.values(PermissionKeys.WarehouseAccounting.WriteOff.Order),
  ...Object.values(PermissionKeys.WarehouseAccounting.WriteOff.Document),
  ...Object.values(PermissionKeys.WarehouseAccounting.ConsignmentBalances.Document),
  ...Object.values(PermissionKeys.WarehouseAccounting.Capitalization.Capitalization),
  ...Object.values(PermissionKeys.WarehouseAccounting.Capitalization.Document),
  ...Object.values(PermissionKeys.WarehouseAccounting.Storages.Page),
  ...Object.values(PermissionKeys.WarehouseAccounting.Storages.Document),
  ...Object.values(PermissionKeys.WarehouseAccounting.Storages.Preview),
  ...Object.values(PermissionKeys.WarehouseAccounting.Storages.PositionAction),
  ...Object.values(PermissionKeys.WarehouseAccounting.SupplierReturns.Page),
  ...Object.values(PermissionKeys.WarehouseAccounting.SupplierReturns.Return),
  ...Object.values(PermissionKeys.WarehouseAccounting.SupplierReturns.Document),
  ...Object.values(PermissionKeys.TaxFreeCarriers.Carrier),
  ...Object.values(PermissionKeys.TaxFreeCarriers.Document),
  ...Object.values(PermissionKeys.TaxFreeDocuments.Document),
  ...Object.values(PermissionKeys.TaxFreeDocuments.Status),
  ...Object.values(PermissionKeys.TaxFreeDocuments.Accounting),
  ...Object.values(PermissionKeys.TaxFreePackLists.PackList),
  ...Object.values(PermissionKeys.TaxFreePackLists.Document),
  ...Object.values(PermissionKeys.TaxFreePackLists.SupplyOrder),
  ...Object.values(PermissionKeys.Sad.Sad),
  ...Object.values(PermissionKeys.Sad.Pallet),
  ...Object.values(PermissionKeys.Sad.Document),
  ...Object.values(PermissionKeys.Sad.Specification),
  ...Object.values(PermissionKeys.Sad.SupplyOrder),
  ...Object.values(PermissionKeys.Sad.Accounting),
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
  ...Object.values(PermissionKeys.OnlineShopPayment.Payment),
  ...Object.values(PermissionKeys.NewEcommerceClients.Page),
  ...Object.values(PermissionKeys.IncompleteSalesOnlineShop.Page),
  ...Object.values(PermissionKeys.IncompleteSalesOnlineShop.Sale),
  ...Object.values(PermissionKeys.ProductGroups.Page),
  ...Object.values(PermissionKeys.ProductGroups.Group),
  ...Object.values(PermissionKeys.ProductPricing.Page),
  ...Object.values(PermissionKeys.ProductPricing.CompetitorSearch),
  ...Object.values(PermissionKeys.ProductSpecificationCodes.Page),
  ...Object.values(PermissionKeys.ProductSpecificationCodes.Code),
  ...Object.values(
    PermissionKeys.FinancialAdministration.AvailablePayments.Page,
  ),
  ...Object.values(
    PermissionKeys.FinancialAdministration.AvailablePayments.OutcomeOrder,
  ),
  ...Object.values(
    PermissionKeys.FinancialAdministration.AvailablePayments.Task,
  ),
  ...Object.values(
    PermissionKeys.FinancialAdministration.AvailablePayments.CashFlow,
  ),
  ...Object.values(
    PermissionKeys.FinancialAdministration.IncomeCashflows.IncomeOrder,
  ),
  ...Object.values(
    PermissionKeys.FinancialAdministration.IncomeCashflows.Order,
  ),
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
  ...Object.values(PermissionKeys.ReportsSaleFile.Page),
  ...Object.values(PermissionKeys.ReportsSaleFile.Document),
  ...Object.values(PermissionKeys.AdvancedReports.Report),
  ...Object.values(PermissionKeys.AdvancedReports.DocumentStructure),
  ...Object.values(PermissionKeys.OutgoingCashflows.Order),
  ...Object.values(PermissionKeys.ProductAvailabilities.Document),
] as const

const uniqueEventPermissionKeys = new Set<string>(eventPermissionKeyList)
if (uniqueEventPermissionKeys.size !== eventPermissionKeyList.length) {
  throw new Error('Duplicate canonical event permission key in PermissionKeys')
}

export const EVENT_PERMISSION_KEYS = Object.freeze(
  [...uniqueEventPermissionKeys].sort((left, right) => left.localeCompare(right, 'en')),
)

const eventPermissionKeys = uniqueEventPermissionKeys

export function isEventPermissionKey(
  permissionKey: string,
): permissionKey is PermissionKey {
  return eventPermissionKeys.has(permissionKey)
}
