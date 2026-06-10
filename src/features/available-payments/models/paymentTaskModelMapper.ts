import type {
  AvailablePaymentColumn,
  AvailablePaymentDocument,
  AvailablePaymentMergeKind,
  AvailablePaymentTaskModel,
  AvailablePaymentTaskRow,
  AvailablePaymentsCurrency,
  AvailablePaymentsOrganization,
  GroupedPaymentTask,
  NamedEntity,
  SupplyPaymentTask,
} from '../types'

type Translate = (key: string) => string

type DataRecord = Record<string, unknown>

type BuildContext = {
  index: number
  serviceIndex: number
  t: Translate
  task: SupplyPaymentTask
}

export function buildTaskModels(
  group: GroupedPaymentTask | null,
  t: Translate,
): AvailablePaymentTaskModel[] {
  if (!group?.SupplyPaymentTasks) {
    return []
  }

  return group.SupplyPaymentTasks.flatMap((task, index) => buildModelsFromTask(task, index, t))
}

function buildModelsFromTask(
  task: SupplyPaymentTask,
  index: number,
  t: Translate,
): AvailablePaymentTaskModel[] {
  const record = task as DataRecord
  const models: AvailablePaymentTaskModel[] = []
  let serviceIndex = 0

  const next = (): BuildContext => ({ index, serviceIndex: serviceIndex++, t, task })

  const consumableOrder = asRecord(record.ConsumablesOrder)
  if (consumableOrder) {
    models.push(buildConsumableOrderModel(consumableOrder, next()))
  }

  readArray(record.SupplyOrderPolandPaymentDeliveryProtocols).forEach((service) =>
    models.push(buildPolandProtocolModel(service, next())),
  )

  readArray(record.SupplyOrderUkrainePaymentDeliveryProtocols).forEach((service) =>
    models.push(buildUkraineProtocolModel(service, next())),
  )

  readArray(record.CustomAgencyServices).forEach((service) =>
    models.push(
      buildServiceModel(service, next(), {
        iconServiceNameKey: 'Митна агенція в Перемишлі',
        organization: asRecord(service.CustomAgencyOrganization),
      }),
    ),
  )

  readArray(record.VehicleDeliveryServices).forEach((service) =>
    models.push(
      buildServiceModel(service, next(), {
        iconServiceNameKey: 'Доставка товару вантажівкою',
        organization: asRecord(service.VehicleDeliveryOrganization),
      }),
    ),
  )

  readArray(record.TransportationServices).forEach((service) =>
    models.push(
      buildServiceModel(service, next(), {
        iconServiceNameKey: 'Транспортні послуги',
        organization: asRecord(service.TransportationOrganization),
      }),
    ),
  )

  readArray(record.PortCustomAgencyServices).forEach((service) =>
    models.push(
      buildServiceModel(service, next(), {
        iconServiceNameKey: 'Митна агенція в порту',
        organization: asRecord(service.PortCustomAgencyOrganization),
      }),
    ),
  )

  readArray(record.PlaneDeliveryServices).forEach((service) =>
    models.push(
      buildServiceModel(service, next(), {
        iconServiceNameKey: 'Доставка товару літаком',
        organization: asRecord(service.PlaneDeliveryOrganization),
      }),
    ),
  )

  for (const service of readArray(record.BrokerServices)) {
    if (asRecord(service.ExciseDutyOrganization) || asRecord(service.CustomOrganization)) {
      const exciseOrganization = asRecord(service.ExciseDutyOrganization)
      const organization = exciseOrganization || asRecord(service.CustomOrganization)

      models.push(
        buildServiceModel(service, next(), {
          iconServiceNameKey: exciseOrganization ? 'Акцизний збір' : 'Мито',
          organization,
          payForOrganization: asRecord(asRecord(service.SupplyOrder)?.Organization),
          supplyOrderNetUid: readString(asRecord(service.SupplyOrder), ['NetUid']),
        }),
      )
    }
  }

  for (const service of readArray(record.PaymentDeliveryProtocols)) {
    if (asRecord(service.SupplyProForm) || asRecord(service.SupplyInvoice)) {
      models.push(buildPaymentDeliveryProtocolModel(service, next()))
    }
  }

  const portWorkServices = readArray(record.PortWorkServices)
  if (portWorkServices.length >= 2) {
    models.push(buildPortWorkServicesModel(portWorkServices, next()))
  } else {
    portWorkServices.forEach((service) =>
      models.push(
        buildServiceModel(service, next(), {
          iconServiceNameKey: 'Портові роботи',
          mergeKind: 'portWorkService',
          organization: asRecord(service.PortWorkOrganization),
        }),
      ),
    )
  }

  readArray(record.MergedServices).forEach((service) =>
    models.push(buildMergedServiceModel(service, next())),
  )

  const containerServices = readArray(record.ContainerServices)
  if (containerServices.length >= 2) {
    models.push(buildContainerServicesModel(containerServices, next()))
  } else {
    containerServices.forEach((service) =>
      models.push(buildContainerServiceModel(service, next())),
    )
  }

  readArray(record.VehicleServices).forEach((service) =>
    models.push(buildVehicleServiceModel(service, next())),
  )

  const billOfLadingServices = readArray(record.BillOfLadingServices)
  if (billOfLadingServices.length >= 2) {
    models.push(buildBillOfLadingServicesModel(billOfLadingServices, next()))
  } else {
    billOfLadingServices.forEach((service) =>
      models.push(buildBillOfLadingServiceModel(service, next())),
    )
  }

  if (models.length === 0) {
    models.push(buildFallbackModel(next()))
  }

  return models
}

function buildConsumableOrderModel(consumableOrder: DataRecord, context: BuildContext): AvailablePaymentTaskModel {
  const { t, task } = context
  const agreement = asRecord(consumableOrder.SupplyOrganizationAgreement)
  const organization = asRecord(consumableOrder.ConsumableProductOrganization)
  const currency = asRecord(agreement?.Currency)

  const rows: AvailablePaymentTaskRow[] = readArray(consumableOrder.ConsumablesOrderItems).map((item) => {
    const product = asRecord(item.ConsumableProduct)
    const category = asRecord(item.ConsumableProductCategory)
    const measureUnit = asRecord(product?.MeasureUnit)

    return {
      category: readString(category, ['Name']),
      grossPrice: readNumber(item, ['TotalPriceWithVAT']),
      name: readString(product, ['Name']),
      vendorCode: readString(product, ['VendorCode']),
      pricePerUnit: readNumber(item, ['PricePerItem']),
      quantity: `${displayValue(item.Qty)}${measureUnit?.Name ? ` ${String(measureUnit.Name)}` : ''}`,
      total: readNumber(item, ['TotalPriceWithVAT']),
      totalWithoutVat: readNumber(item, ['TotalPrice']),
      vatAmount: readNumber(item, ['VAT']),
      vatPercent: readNumber(item, ['VatPercent']),
    }
  })

  return baseModel(context, {
    columns: consumableOrderColumns(t),
    consumableOrderNetUid: readString(consumableOrder, ['NetUid']),
    currency: currency as AvailablePaymentsCurrency | null,
    documents: readDocuments(consumableOrder.ConsumablesOrderDocuments),
    organization: organization as AvailablePaymentsOrganization | null,
    organizationName: readString(organization, ['Name']),
    payForOrganization: asRecord(agreement?.Organization),
    rows,
    serviceAgreementNetId: readString(agreement, ['NetUid']),
    serviceName: serviceName('Прихідна накладна на товар', task, t),
    serviceNumber: readString(consumableOrder, ['Number']),
  })
}

function buildPolandProtocolModel(service: DataRecord, context: BuildContext): AvailablePaymentTaskModel {
  const { t, task } = context
  const supplyOrder = asRecord(service.SupplyOrder)
  const client = asRecord(supplyOrder?.Client)
  const clientAgreements = readArray(client?.ClientAgreements)
  const clientAgreementId = supplyOrder?.ClientAgreementId
  const clientAgreement =
    clientAgreements.find((agreement) => agreement.Id === clientAgreementId) || null
  const agreement = asRecord(clientAgreement?.Agreement)
  const currency = asRecord(agreement?.Currency)
  const organization = asRecord(agreement?.Organization)

  const row: AvailablePaymentTaskRow = {
    discount: undefined,
    grossPrice: readNumber(service, ['GrossPrice']),
    name: readString(service, ['Name']),
    netPrice: readNumber(service, ['NetPrice']),
    number: readString(service, ['Number']),
    date: readDate(service, ['FromDate']),
    serviceNumber: readString(service, ['ServiceNumber']),
    symbol: paymentSymbol(task, t),
    vatAmount: readNumber(service, ['Vat']),
    vatPercent: readNumber(service, ['VatPercent']),
  }

  return baseModel(context, {
    columns: protocolColumns(t),
    currency: currency as AvailablePaymentsCurrency | null,
    documents: readDocuments(service.InvoiceDocuments),
    organizationName: t('Фактура'),
    organizationNetUid: readString(supplyOrder, ['NetUid']),
    payForClient: client as NamedEntity | null,
    payForOrganization: organization,
    rows: [row],
    serviceName: serviceName('Інвойс', task, t),
    serviceNumber: readString(service, ['ServiceNumber']),
    supplyOrderNetUid: readString(supplyOrder, ['NetUid']),
  })
}

function buildUkraineProtocolModel(service: DataRecord, context: BuildContext): AvailablePaymentTaskModel {
  const { t, task } = context
  const supplyOrderUkraine = asRecord(service.SupplyOrderUkraine)
  const supplier = asRecord(supplyOrderUkraine?.Supplier)
  const organization = asRecord(supplyOrderUkraine?.Organization)
  const clientAgreement = asRecord(supplyOrderUkraine?.ClientAgreement)
  const currency = asRecord(asRecord(clientAgreement?.Agreement)?.Currency)
  const supplierName = readString(supplier, ['FullName'])

  const row: AvailablePaymentTaskRow = {
    discount: readNumber(service, ['Discount']),
    grossPrice: roundTwo(readNumber(service, ['Value'])),
    name: supplierName,
    netPrice: roundTwo(readNumber(supplyOrderUkraine, ['TotalNetPriceLocal'])),
    number: readString(supplyOrderUkraine, ['InvNumber']),
    date: readDate(supplyOrderUkraine, ['FromDate']),
    currency: readString(currency, ['Code']),
    paymentType: t('Прихід на Україну'),
    serviceNumber: readString(supplyOrderUkraine, ['Number']),
    symbol: paymentSymbol(task, t),
    vatAmount: roundTwo(readNumber(supplyOrderUkraine, ['TotalVatAmount'])),
    vatPercent: readNumber(supplyOrderUkraine, ['VatPercent']),
  }

  return baseModel(context, {
    columns: paymentDeliveryProtocolColumns(t),
    currency: currency as AvailablePaymentsCurrency | null,
    organization: organization as AvailablePaymentsOrganization | null,
    organizationName: supplierName,
    organizationNetUid: readString(organization, ['NetUid']),
    paymentAmount: readNumber(task as DataRecord, ['NetPrice']) || readNumber(task as DataRecord, ['GrossPrice']),
    payForOrganization: organization,
    rows: [row],
    serviceAgreementNetId: readString(clientAgreement, ['NetUid']),
    serviceName: serviceName('Прихід на Україну', task, t),
    serviceNumber: readString(supplyOrderUkraine, ['Number']),
    supplyOrderUkraineNetUid: readString(supplyOrderUkraine, ['NetUid']),
  })
}

function buildPaymentDeliveryProtocolModel(service: DataRecord, context: BuildContext): AvailablePaymentTaskModel {
  const { t, task } = context
  const proForm = asRecord(service.SupplyProForm)

  if (proForm) {
    const supplyOrders = readArray(proForm.SupplyOrders)
    const supplyOrder = supplyOrders[0] || null
    const client = asRecord(supplyOrder?.Client)
    const clientAgreement = asRecord(supplyOrder?.ClientAgreement)
    const currency = asRecord(asRecord(clientAgreement?.Agreement)?.Currency)

    const row: AvailablePaymentTaskRow = {
      discount: readNumber(service, ['Discount']),
      grossPrice: readNumber(service, ['Value']),
      name: t('Проформа'),
      netPrice: readNumber(supplyOrder, ['NetPrice']),
      number: readString(proForm, ['Number']),
      date: readDate(proForm, ['DateFrom']),
      currency: readString(currency, ['Code']),
      paymentType: t('Проформа'),
      serviceNumber: readString(proForm, ['ServiceNumber']),
      symbol: paymentSymbol(task, t),
      vatAmount: undefined,
      vatPercent: undefined,
    }

    return baseModel(context, {
      columns: paymentDeliveryProtocolColumns(t),
      currency: currency as AvailablePaymentsCurrency | null,
      documents: readDocuments(proForm.ProFormDocuments),
      organizationName: readString(client, ['FullName']),
      payForClient: client as NamedEntity | null,
      payForOrganization: asRecord(supplyOrder?.Organization) || asRecord(asRecord(clientAgreement?.Agreement)?.Organization),
      rows: [row],
      serviceAgreementNetId: readString(clientAgreement, ['NetUid']),
      serviceName: serviceName('Проформа', task, t),
      serviceNumber: readString(proForm, ['ServiceNumber']),
      supplyOrderNetUid: readString(supplyOrder, ['NetUid']),
    })
  }

  const invoice = asRecord(service.SupplyInvoice)
  const supplyOrder = asRecord(invoice?.SupplyOrder)
  const client = asRecord(supplyOrder?.Client)
  const clientAgreement = readArray(client?.ClientAgreements)[0] || null
  const currency = asRecord(asRecord(clientAgreement?.Agreement)?.Currency)

  const row: AvailablePaymentTaskRow = {
    discount: readNumber(service, ['Discount']),
    grossPrice: readNumber(service, ['Value']),
    name: t('Інвойс'),
    netPrice: readNumber(invoice, ['NetPrice']) - readNumber(invoice, ['DiscountAmount']),
    number: readString(invoice, ['Number']),
    date: readDate(invoice, ['DateFrom']),
    currency: readString(currency, ['Code']),
    paymentType: t('Інвойс'),
    serviceNumber: readString(invoice, ['ServiceNumber']),
    symbol: paymentSymbol(task, t),
    vatAmount: undefined,
    vatPercent: undefined,
  }

  return baseModel(context, {
    columns: paymentDeliveryProtocolColumns(t),
    currency: currency as AvailablePaymentsCurrency | null,
    documents: readDocuments(invoice?.InvoiceDocuments),
    organizationName: readString(client, ['FullName']),
    payForClient: client as NamedEntity | null,
    payForOrganization: asRecord(supplyOrder?.Organization) || asRecord(asRecord(clientAgreement?.Agreement)?.Organization),
    rows: [row],
    serviceAgreementNetId: readString(clientAgreement, ['NetUid']),
    serviceName: serviceName('Інвойс', task, t),
    serviceNumber: readString(invoice, ['ServiceNumber']),
    supplyOrderNetUid: readString(supplyOrder, ['NetUid']),
  })
}

function buildMergedServiceModel(service: DataRecord, context: BuildContext): AvailablePaymentTaskModel {
  const { t, task } = context
  const supplyOrder = asRecord(service.SupplyOrder)
  const supplyOrderUkraine = asRecord(service.SupplyOrderUkraine)
  const deliveryProtocol = asRecord(service.DeliveryProductProtocol)
  const agreement = asRecord(service.SupplyOrganizationAgreement)
  const supplyOrganization = asRecord(service.SupplyOrganization)
  const consumableProduct = asRecord(service.ConsumableProduct)

  let payForOrganization: DataRecord | null = null
  if (supplyOrder) {
    payForOrganization = asRecord(supplyOrder.Organization)
  } else if (supplyOrderUkraine) {
    payForOrganization = asRecord(supplyOrderUkraine.Organization)
  } else if (deliveryProtocol) {
    payForOrganization = asRecord(deliveryProtocol.Organization)
  }

  const mergedServiceName = consumableProduct
    ? readString(consumableProduct, ['Name']) + (task.IsAccounting ? ' (Бух.)' : '')
    : serviceName('Об’єднаний сервіс', task, t)

  return baseModel(context, {
    columns: mergedServiceColumns(t),
    currency: asRecord(agreement?.Currency) as AvailablePaymentsCurrency | null,
    documents: readDocuments(service.InvoiceDocuments),
    organization: supplyOrganization as AvailablePaymentsOrganization | null,
    organizationName: readString(supplyOrganization, ['Name']),
    payForOrganization,
    rows: rowsFromBaseService(service, task, agreement),
    serviceAgreementNetId: readString(agreement, ['NetUid']),
    serviceName: mergedServiceName,
    serviceNumber: readString(service, ['ServiceNumber']),
    supplyOrderNetUid: readString(supplyOrder, ['NetUid']),
    supplyOrderUkraineNetUid: readString(supplyOrderUkraine, ['NetUid']),
    deliveryProductProtocolNetUid: readString(deliveryProtocol, ['NetUid']),
  })
}

function buildPortWorkServicesModel(services: DataRecord[], context: BuildContext): AvailablePaymentTaskModel {
  const { t, task } = context
  const firstService = services[0] || {}
  const agreement = asRecord(firstService.SupplyOrganizationAgreement)
  const organization = asRecord(firstService.PortWorkOrganization)
  const supplyOrder = asRecord(firstService.SupplyOrder)
  const supplyOrders = readArray(firstService.SupplyOrders)

  return baseModel(context, {
    columns: serviceColumns(t, services.some(hasServiceDetails)),
    currency: asRecord(agreement?.Currency) as AvailablePaymentsCurrency | null,
    documents: services.flatMap((service) => readDocuments(service.InvoiceDocuments)),
    organization: organization as AvailablePaymentsOrganization | null,
    organizationName: readString(organization, ['Name']),
    mergeKind: 'portWorkService',
    mergeOrganizationNetUid: getEntityValue(organization),
    payForOrganization: asRecord(supplyOrders[0]?.Organization),
    rows: services.flatMap((service) => rowsFromBaseService(service, task, asRecord(service.SupplyOrganizationAgreement))),
    serviceAgreementNetId: readString(agreement, ['NetUid']),
    serviceName: serviceName('Портові роботи', task, t),
    serviceNumber: readString(firstService, ['ServiceNumber']),
    supplyOrderNetUid: readString(supplyOrder, ['NetUid']) || readString(supplyOrders[0] || null, ['NetUid']),
  })
}

function buildContainerServiceModel(service: DataRecord, context: BuildContext): AvailablePaymentTaskModel {
  const { t, task } = context
  const agreement = asRecord(service.SupplyOrganizationAgreement)
  const organization = asRecord(service.ContainerOrganization)
  const firstLink = readArray(service.SupplyOrderContainerServices)[0] || null

  return baseModel(context, {
    columns: deliveryServiceColumns(t, true),
    currency: asRecord(agreement?.Currency) as AvailablePaymentsCurrency | null,
    documents: readDocuments(service.InvoiceDocuments),
    organization: organization as AvailablePaymentsOrganization | null,
    organizationName: readString(organization, ['Name']),
    mergeKind: 'containerService',
    mergeOrganizationNetUid: getEntityValue(organization),
    payForOrganization: asRecord(agreement?.Organization),
    rows: [containerServiceRow(service, task, agreement)],
    serviceAgreementNetId: readString(agreement, ['NetUid']),
    serviceName: serviceName('Контейнер', task, t),
    serviceNumber: readString(service, ['ServiceNumber']),
    supplyOrderNetUid: readString(asRecord(firstLink?.SupplyOrder), ['NetUid']),
  })
}

function buildContainerServicesModel(services: DataRecord[], context: BuildContext): AvailablePaymentTaskModel {
  const { t, task } = context
  const firstService = services[0] || {}
  const agreement = asRecord(firstService.SupplyOrganizationAgreement)
  const organization = asRecord(firstService.ContainerOrganization)
  const firstLink = readArray(firstService.SupplyOrderContainerServices)[0] || null

  return baseModel(context, {
    columns: deliveryServiceColumns(t, true),
    currency: asRecord(agreement?.Currency) as AvailablePaymentsCurrency | null,
    documents: services.flatMap((service) => readDocuments(service.InvoiceDocuments)),
    organization: organization as AvailablePaymentsOrganization | null,
    organizationName: readString(organization, ['Name']),
    mergeKind: 'containerService',
    mergeOrganizationNetUid: getEntityValue(organization),
    payForOrganization: asRecord(agreement?.Organization),
    rows: services.map((service) => containerServiceRow(service, task, asRecord(service.SupplyOrganizationAgreement))),
    serviceAgreementNetId: readString(agreement, ['NetUid']),
    serviceName: serviceName('Контейнер', task, t),
    serviceNumber: readString(firstService, ['ServiceNumber']),
    supplyOrderNetUid: readString(asRecord(firstLink?.SupplyOrder), ['NetUid']),
  })
}

function buildVehicleServiceModel(service: DataRecord, context: BuildContext): AvailablePaymentTaskModel {
  const { t, task } = context
  const agreement = asRecord(service.SupplyOrganizationAgreement)
  const organization = asRecord(service.VehicleOrganization)
  const firstLink = readArray(service.SupplyOrderVehicleServices)[0] || null

  return baseModel(context, {
    columns: deliveryServiceColumns(t, false),
    currency: asRecord(agreement?.Currency) as AvailablePaymentsCurrency | null,
    documents: readDocuments(service.InvoiceDocuments),
    organization: organization as AvailablePaymentsOrganization | null,
    organizationName: readString(organization, ['Name']),
    payForOrganization: asRecord(agreement?.Organization),
    rows: [deliveryRow(service, task, agreement, readString(service, ['VehicleNumber']))],
    serviceAgreementNetId: readString(agreement, ['NetUid']),
    serviceName: serviceName('Вантажівка', task, t),
    serviceNumber: readString(service, ['ServiceNumber']),
    supplyOrderNetUid: readString(asRecord(firstLink?.SupplyOrder), ['NetUid']),
  })
}

function buildBillOfLadingServicesModel(services: DataRecord[], context: BuildContext): AvailablePaymentTaskModel {
  const { t, task } = context
  const firstService = services[0] || {}
  const agreement = asRecord(firstService.SupplyOrganizationAgreement)
  const supplyOrganization = asRecord(firstService.SupplyOrganization)
  const deliveryProtocol = asRecord(firstService.DeliveryProductProtocol)
  const isContainer = readNumber(firstService, ['TypeBillOfLadingService']) === 0

  const documents = services.flatMap((service) => [
    ...readDocuments(service.InvoiceDocuments),
    ...readDocuments(service.BillOfLadingDocuments),
  ])

  return baseModel(context, {
    columns: deliveryServiceColumns(t, isContainer),
    currency: asRecord(agreement?.Currency) as AvailablePaymentsCurrency | null,
    documents,
    organization: supplyOrganization as AvailablePaymentsOrganization | null,
    organizationName: readString(supplyOrganization, ['Name']),
    payForOrganization: asRecord(agreement?.Organization),
    rows: services.flatMap((service) => billOfLadingRows(service, task, asRecord(service.SupplyOrganizationAgreement))),
    serviceAgreementNetId: readString(agreement, ['NetUid']),
    serviceName: serviceName(isContainer ? 'Контейнер' : 'Вантажівка', task, t),
    serviceNumber: readString(firstService, ['ServiceNumber']),
    deliveryProductProtocolNetUid: readString(deliveryProtocol, ['NetUid']),
  })
}

function buildBillOfLadingServiceModel(service: DataRecord, context: BuildContext): AvailablePaymentTaskModel {
  const { t, task } = context
  const agreement = asRecord(service.SupplyOrganizationAgreement)
  const supplyOrganization = asRecord(service.SupplyOrganization)
  const deliveryProtocol = asRecord(service.DeliveryProductProtocol)
  const isContainer = readNumber(service, ['TypeBillOfLadingService']) === 0

  const documents = [
    ...readDocuments(service.InvoiceDocuments),
    ...readDocuments(service.BillOfLadingDocuments),
  ]

  return baseModel(context, {
    columns: deliveryServiceColumns(t, isContainer),
    currency: asRecord(agreement?.Currency) as AvailablePaymentsCurrency | null,
    documents,
    organization: supplyOrganization as AvailablePaymentsOrganization | null,
    organizationName: readString(supplyOrganization, ['Name']),
    payForOrganization: asRecord(agreement?.Organization),
    rows: billOfLadingRows(service, task, agreement),
    serviceAgreementNetId: readString(agreement, ['NetUid']),
    serviceName: serviceName(isContainer ? 'Контейнер' : 'Вантажівка', task, t),
    serviceNumber: readString(service, ['ServiceNumber']),
    deliveryProductProtocolNetUid: readString(deliveryProtocol, ['NetUid']),
  })
}

function buildServiceModel(
  service: DataRecord,
  context: BuildContext,
  options: {
    iconServiceNameKey: string
    mergeKind?: AvailablePaymentMergeKind
    organization: DataRecord | null
    payForOrganization?: DataRecord | null
    supplyOrderNetUid?: string
  },
): AvailablePaymentTaskModel {
  const { t, task } = context
  const agreement = asRecord(service.SupplyOrganizationAgreement)
  const supplyOrder = asRecord(service.SupplyOrder)
  const supplyOrders = readArray(service.SupplyOrders)
  const payForOrganization =
    options.payForOrganization !== undefined
      ? options.payForOrganization
      : asRecord(supplyOrders[0]?.Organization)
  const supplyOrderNetUid =
    options.supplyOrderNetUid !== undefined
      ? options.supplyOrderNetUid
      : readString(supplyOrder, ['NetUid']) || readString(supplyOrders[0] || null, ['NetUid'])

  return baseModel(context, {
    columns: serviceColumns(t, hasServiceDetails(service)),
    currency: asRecord(agreement?.Currency) as AvailablePaymentsCurrency | null,
    documents: readDocuments(service.InvoiceDocuments),
    organization: options.organization as AvailablePaymentsOrganization | null,
    organizationName: readString(options.organization, ['Name']),
    mergeKind: options.mergeKind,
    mergeOrganizationNetUid: options.mergeKind ? getEntityValue(options.organization) : undefined,
    payForOrganization,
    rows: rowsFromBaseService(service, task, agreement),
    serviceAgreementNetId: readString(agreement, ['NetUid']),
    serviceName: serviceName(options.iconServiceNameKey, task, t),
    serviceNumber: readString(service, ['ServiceNumber']),
    supplyOrderNetUid,
  })
}

function buildFallbackModel(context: BuildContext): AvailablePaymentTaskModel {
  const { t, task } = context

  return baseModel(context, {
    columns: [],
    currency: null,
    documents: readDocuments(task.SupplyPaymentTaskDocuments),
    isUnsupported: true,
    organizationName: '',
    rows: [],
    serviceName: t('Платіжна задача'),
    serviceNumber: readString(task as DataRecord, ['Number']),
  })
}

function rowsFromBaseService(
  service: DataRecord,
  task: SupplyPaymentTask,
  agreement: DataRecord | null,
): AvailablePaymentTaskRow[] {
  const isAccounting = Boolean(task.IsAccounting)
  const currency = readString(asRecord(agreement?.Currency), ['Code'])
  const details = readArray(service.ServiceDetailItems)

  if (details.length > 0) {
    return details.map((detail) => {
      const key = asRecord(detail.ServiceDetailItemKey)

      return {
        currency,
        grossPrice: readNumber(detail, ['GrossPrice']),
        name: readString(key, ['Name']),
        netPrice: readNumber(detail, ['NetPrice']),
        number: readString(service, ['Number']),
        date: readDate(service, ['FromDate']),
        quantity: readNumber(detail, ['Qty']),
        serviceNumber: readString(service, ['ServiceNumber']),
        symbol: readString(key, ['Symbol']),
        vatAmount: readNumber(detail, ['Vat']),
        vatPercent: readNumber(detail, ['VatPercent']),
      }
    })
  }

  return [
    {
      currency,
      grossPrice: readNumber(service, isAccounting ? ['AccountingGrossPrice'] : ['GrossPrice']),
      mergedServiceNumber: readString(service, ['Number']),
      name: readString(service, ['Name']) || readString(service, ['Number']),
      netPrice: readNumber(service, isAccounting ? ['AccountingNetPrice'] : ['NetPrice']),
      number: readString(service, ['Number']),
      date: readDate(service, ['FromDate']),
      serviceNumber: readString(service, ['ServiceNumber']),
      symbol: '',
      vatAmount: readNumber(service, isAccounting ? ['AccountingVat'] : ['Vat']),
      vatPercent: readNumber(service, isAccounting ? ['AccountingVatPercent'] : ['VatPercent']),
    },
  ]
}

function containerServiceRow(
  service: DataRecord,
  task: SupplyPaymentTask,
  agreement: DataRecord | null,
): AvailablePaymentTaskRow {
  const billOfLadingDocument = asRecord(service.BillOfLadingDocument)

  return deliveryRow(
    service,
    task,
    agreement,
    readString(service, ['ContainerNumber']),
    billOfLadingDocument,
  )
}

function billOfLadingRows(
  service: DataRecord,
  task: SupplyPaymentTask,
  agreement: DataRecord | null,
): AvailablePaymentTaskRow[] {
  const documents = readArray(service.BillOfLadingDocuments)

  if (documents.length === 0) {
    return [deliveryRow(service, task, agreement, readString(service, ['BillOfLadingNumber']))]
  }

  return documents.map((document) =>
    deliveryRow(service, task, agreement, readString(service, ['BillOfLadingNumber']), document),
  )
}

function deliveryRow(
  service: DataRecord,
  task: SupplyPaymentTask,
  agreement: DataRecord | null,
  containerNumber: string,
  document?: DataRecord | null,
): AvailablePaymentTaskRow {
  const isAccounting = Boolean(task.IsAccounting)

  return {
    containerNumber,
    currency: readString(asRecord(agreement?.Currency), ['Code']),
    grossPrice: readNumber(service, isAccounting ? ['AccountingGrossPrice'] : ['GrossPrice']),
    netPrice: readNumber(service, isAccounting ? ['AccountingNetPrice'] : ['NetPrice']),
    number: readString(document, ['Number']) || readString(service, ['Number']),
    date: readDate(document, ['Date']) || readDate(service, ['FromDate']),
    serviceNumber: readString(service, ['ServiceNumber']),
  }
}

function baseModel(
  context: BuildContext,
  init: {
    columns: AvailablePaymentColumn[]
    consumableOrderNetUid?: string
    currency?: AvailablePaymentsCurrency | null
    deliveryProductProtocolNetUid?: string
    documents?: AvailablePaymentDocument[]
    isUnsupported?: boolean
    organization?: AvailablePaymentsOrganization | null
    organizationName: string
    organizationNetUid?: string
    mergeKind?: AvailablePaymentMergeKind
    mergeOrganizationNetUid?: string
    paymentAmount?: number
    payForClient?: NamedEntity | null
    payForOrganization?: DataRecord | null
    rows: AvailablePaymentTaskRow[]
    serviceAgreementNetId?: string
    serviceName: string
    serviceNumber: string
    supplyOrderNetUid?: string
    supplyOrderUkraineNetUid?: string
  },
): AvailablePaymentTaskModel {
  const { index, serviceIndex, task } = context
  const organization = init.organization ?? null
  const payForOrganization = (init.payForOrganization ?? null) as AvailablePaymentsOrganization | null
  const currency = init.currency ?? null

  return {
    columns: init.columns,
    consumableOrderNetUid: init.consumableOrderNetUid || '',
    currency,
    currencyCode: readString(currency as DataRecord | null, ['Code']),
    deliveryProductProtocolNetUid: init.deliveryProductProtocolNetUid || '',
    documents: init.documents || [],
    grossPrice: task.GrossPrice || 0,
    id: getTaskModelId(task, `${index}-${serviceIndex}`),
    isUnsupported: init.isUnsupported || undefined,
    organization: payForOrganization || organization,
    organizationName: init.organizationName,
    organizationNetUid: init.organizationNetUid ?? getEntityValue(payForOrganization || organization),
    paidOrder: getPaidOrder(task),
    paymentAmount: init.paymentAmount ?? task.GrossPrice ?? 0,
    payForClient: init.payForClient ?? null,
    rows: init.rows,
    mergeKind: init.mergeKind,
    mergeOrganizationNetUid: init.mergeOrganizationNetUid,
    serviceAgreementNetId: init.serviceAgreementNetId || '',
    serviceName: init.serviceName,
    serviceNumber: init.serviceNumber,
    supplyOrderNetUid: init.supplyOrderNetUid || '',
    supplyOrderUkraineNetUid: init.supplyOrderUkraineNetUid || '',
    task,
  }
}

function consumableOrderColumns(t: Translate): AvailablePaymentColumn[] {
  return [
    { format: 'text', header: t('Артикул'), key: 'vendorCode' },
    { format: 'text', header: t('Назва'), key: 'name' },
    { format: 'text', header: t('Категорія'), key: 'category' },
    { format: 'text', header: t('Кількість'), key: 'quantity' },
    { align: 'right', format: 'price', header: t('Ціна за одиницю'), key: 'pricePerUnit' },
    { align: 'right', format: 'price', header: t('Сума'), key: 'totalWithoutVat' },
    { align: 'right', format: 'text', header: `${t('ПДВ')} %`, key: 'vatPercent' },
    { align: 'right', format: 'price', header: t('Сума ПДВ'), key: 'vatAmount' },
    { align: 'right', format: 'price', header: t('Сума з ПДВ'), key: 'total' },
  ]
}

function serviceColumns(t: Translate, includeQuantityColumn = false): AvailablePaymentColumn[] {
  const quantityColumn: AvailablePaymentColumn[] = includeQuantityColumn
    ? [
        { align: 'right', format: 'text', header: t('Кількість'), key: 'quantity' },
      ]
    : []

  return [
    { format: 'date', header: t('Дата'), key: 'date' },
    { format: 'text', header: t('Номер документу'), key: 'serviceNumber' },
    { format: 'text', header: t('Номер'), key: 'number' },
    { format: 'text', header: t('Назва'), key: 'name' },
    { format: 'text', header: t('Символ'), key: 'symbol' },
    ...quantityColumn,
    { format: 'text', header: t('Валюта'), key: 'currency' },
    { align: 'right', format: 'price', header: t('Вартість Нетто'), key: 'netPrice' },
    { align: 'right', format: 'text', header: `${t('ПДВ')} %`, key: 'vatPercent' },
    { align: 'right', format: 'price', header: t('ПДВ'), key: 'vatAmount' },
    { align: 'right', format: 'price', header: t('Вартість'), key: 'grossPrice' },
  ]
}

function mergedServiceColumns(t: Translate): AvailablePaymentColumn[] {
  return [
    { format: 'date', header: t('Дата'), key: 'date' },
    { format: 'text', header: t('Номер документу'), key: 'serviceNumber' },
    { format: 'text', header: t('Номер'), key: 'number' },
    { format: 'text', header: t('Номер об’єднаного сервісу'), key: 'mergedServiceNumber' },
    { format: 'text', header: t('Валюта'), key: 'currency' },
    { align: 'right', format: 'price', header: t('Вартість Нетто'), key: 'netPrice' },
    { align: 'right', format: 'text', header: `${t('ПДВ')} %`, key: 'vatPercent' },
    { align: 'right', format: 'price', header: t('ПДВ'), key: 'vatAmount' },
    { align: 'right', format: 'price', header: t('Вартість'), key: 'grossPrice' },
  ]
}

function deliveryServiceColumns(t: Translate, isContainer: boolean): AvailablePaymentColumn[] {
  return [
    { format: 'date', header: t('Дата'), key: 'date' },
    { format: 'text', header: t('Номер документу'), key: 'serviceNumber' },
    { format: 'text', header: t('Номер'), key: 'number' },
    { format: 'text', header: t(isContainer ? 'Номер контейнера' : 'Номер Автомобіля'), key: 'containerNumber' },
    { format: 'text', header: t('Валюта'), key: 'currency' },
    { align: 'right', format: 'price', header: t('Вартість Нетто'), key: 'netPrice' },
    { align: 'right', format: 'price', header: t('Вартість'), key: 'grossPrice' },
  ]
}

function protocolColumns(t: Translate): AvailablePaymentColumn[] {
  return [
    { format: 'date', header: t('Дата'), key: 'date' },
    { format: 'text', header: t('Номер документу'), key: 'serviceNumber' },
    { format: 'text', header: t('Номер'), key: 'number' },
    { format: 'text', header: t('Назва'), key: 'name' },
    { format: 'text', header: t('Стан документа'), key: 'symbol' },
    { align: 'right', format: 'text', header: t('Відсоток знижки'), key: 'discount' },
    { align: 'right', format: 'text', header: `${t('ПДВ')} %`, key: 'vatPercent' },
    { align: 'right', format: 'price', header: t('ПДВ'), key: 'vatAmount' },
    { align: 'right', format: 'price', header: t('Вартість Нетто'), key: 'netPrice' },
    { align: 'right', format: 'price', header: t('Вартість Брутто'), key: 'grossPrice' },
  ]
}

function paymentDeliveryProtocolColumns(t: Translate): AvailablePaymentColumn[] {
  return [
    { format: 'date', header: t('Дата'), key: 'date' },
    { format: 'text', header: t('Номер документу'), key: 'serviceNumber' },
    { format: 'text', header: t('Номер'), key: 'number' },
    { format: 'text', header: t('Тип'), key: 'paymentType' },
    { format: 'text', header: t('Назва'), key: 'name' },
    { format: 'text', header: t('Валюта'), key: 'currency' },
    { format: 'text', header: t('Стан документа'), key: 'symbol' },
    { align: 'right', format: 'text', header: t('Відсоток оплати'), key: 'discount' },
    { align: 'right', format: 'text', header: `${t('ПДВ')} %`, key: 'vatPercent' },
    { align: 'right', format: 'price', header: t('ПДВ'), key: 'vatAmount' },
    { align: 'right', format: 'price', header: t('Вартість інвойса'), key: 'netPrice' },
    { align: 'right', format: 'price', header: t('Вартість до оплати'), key: 'grossPrice' },
  ]
}

function serviceName(key: string, task: SupplyPaymentTask, t: Translate): string {
  if (task.IsAccounting) {
    return `${t(key)} (${t('Бух.')})`
  }

  return t(key)
}

function paymentSymbol(task: SupplyPaymentTask, t: Translate): string {
  return (task.OutcomePaymentOrderSupplyPaymentTasks || []).length > 0
    ? t('Оплачено')
    : t('Не оплачено')
}

function getPaidOrder(task: SupplyPaymentTask) {
  return task.OutcomePaymentOrderSupplyPaymentTasks?.[0]?.OutcomePaymentOrder || null
}

function getTaskModelId(task: SupplyPaymentTask, fallback: string): string {
  const taskId = String(task.NetUid || task.Id || 'task')

  return `${taskId}-${fallback}`
}

function getEntityValue(entity?: { Id?: number; NetUid?: string } | null): string {
  return String(entity?.NetUid || entity?.Id || '')
}

function roundTwo(value: number): number {
  return Math.round(value * 100) / 100
}

function hasServiceDetails(service: DataRecord): boolean {
  return readArray(service.ServiceDetailItems).length > 0
}

function readDocuments(value: unknown): AvailablePaymentDocument[] {
  return readArray(value).map((document) => document as AvailablePaymentDocument)
}

function readArray(value: unknown): DataRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is DataRecord => Boolean(item && typeof item === 'object'))
    : []
}

function asRecord(value: unknown): DataRecord | null {
  return value && typeof value === 'object' ? (value as DataRecord) : null
}

function readString(record: DataRecord | null | undefined, keys: string[]): string {
  if (!record) {
    return ''
  }

  for (const key of keys) {
    const value = record[key]

    if (typeof value === 'string' && value) {
      return value
    }

    if (typeof value === 'number') {
      return String(value)
    }
  }

  return ''
}

function readNumber(record: DataRecord | null | undefined, keys: string[]): number {
  if (!record) {
    return 0
  }

  for (const key of keys) {
    const value = record[key]

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
  }

  return 0
}

function readDate(record: DataRecord | null | undefined, keys: string[]): Date | string | undefined {
  if (!record) {
    return undefined
  }

  for (const key of keys) {
    const value = record[key]

    if (value instanceof Date || (typeof value === 'string' && value)) {
      return value
    }
  }

  return undefined
}

function displayValue(value: unknown): string {
  if (value === null || typeof value === 'undefined' || value === '') {
    return ''
  }

  return String(value)
}
