import type {
  AvailablePaymentColumn,
  AvailablePaymentDocument,
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

  readArray(record.BrokerServices)
    .filter((service) => asRecord(service.ExciseDutyOrganization) || asRecord(service.CustomOrganization))
    .forEach((service) => {
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
    })

  readArray(record.PaymentDeliveryProtocols)
    .filter((service) => asRecord(service.SupplyProForm) || asRecord(service.SupplyInvoice))
    .forEach((service) =>
      models.push(buildPaymentDeliveryProtocolModel(service, next())),
    )

  readArray(record.PortWorkServices).forEach((service) =>
    models.push(
      buildServiceModel(service, next(), {
        iconServiceNameKey: 'Портові роботи',
        organization: asRecord(service.PortWorkOrganization),
      }),
    ),
  )

  readArray(record.MergedServices).forEach((service) =>
    models.push(buildMergedServiceModel(service, next())),
  )

  readArray(record.ContainerServices).forEach((service) =>
    models.push(buildContainerServiceModel(service, next())),
  )

  readArray(record.VehicleServices).forEach((service) =>
    models.push(buildVehicleServiceModel(service, next())),
  )

  readArray(record.BillOfLadingServices).forEach((service) =>
    models.push(buildBillOfLadingServiceModel(service, next())),
  )

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
  const currency = asRecord(asRecord(clientAgreement?.Agreement)?.Currency)

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
      organizationNetUid: readString(client, ['NetUid']),
      payForClient: client as NamedEntity | null,
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
    organizationNetUid: readString(client, ['NetUid']),
    payForClient: client as NamedEntity | null,
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
    columns: serviceColumns(t),
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
    payForOrganization: asRecord(agreement?.Organization),
    rows: [deliveryRow(service, task, agreement, readString(service, ['ContainerNumber']))],
    serviceAgreementNetId: readString(agreement, ['NetUid']),
    serviceName: serviceName('Контейнер', task, t),
    serviceNumber: readString(service, ['ServiceNumber']),
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
    rows: [deliveryRow(service, task, agreement, readString(service, ['BillOfLadingNumber']))],
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
    columns: serviceColumns(t),
    currency: asRecord(agreement?.Currency) as AvailablePaymentsCurrency | null,
    documents: readDocuments(service.InvoiceDocuments),
    organization: options.organization as AvailablePaymentsOrganization | null,
    organizationName: readString(options.organization, ['Name']),
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

  return [
    {
      currency: readString(asRecord(agreement?.Currency), ['Code']),
      grossPrice: readNumber(service, isAccounting ? ['AccountingGrossPrice'] : ['GrossPrice']),
      netPrice: readNumber(service, isAccounting ? ['AccountingNetPrice'] : ['NetPrice']),
      number: readString(service, ['Number']),
      date: readDate(service, ['FromDate']),
      serviceNumber: readString(service, ['ServiceNumber']),
      vatAmount: readNumber(service, isAccounting ? ['AccountingVat'] : ['Vat']),
      vatPercent: readNumber(service, isAccounting ? ['AccountingVatPercent'] : ['VatPercent']),
    },
  ]
}

function deliveryRow(
  service: DataRecord,
  task: SupplyPaymentTask,
  agreement: DataRecord | null,
  containerNumber: string,
): AvailablePaymentTaskRow {
  const isAccounting = Boolean(task.IsAccounting)

  return {
    containerNumber,
    currency: readString(asRecord(agreement?.Currency), ['Code']),
    grossPrice: readNumber(service, isAccounting ? ['AccountingGrossPrice'] : ['GrossPrice']),
    netPrice: readNumber(service, isAccounting ? ['AccountingNetPrice'] : ['NetPrice']),
    number: readString(service, ['Number']),
    date: readDate(service, ['FromDate']),
    serviceNumber: readString(service, ['ServiceNumber']),
  }
}

function baseModel(
  context: BuildContext,
  init: {
    columns: AvailablePaymentColumn[]
    currency?: AvailablePaymentsCurrency | null
    deliveryProductProtocolNetUid?: string
    documents?: AvailablePaymentDocument[]
    organization?: AvailablePaymentsOrganization | null
    organizationName: string
    organizationNetUid?: string
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
    currency,
    currencyCode: readString(currency as DataRecord | null, ['Code']),
    deliveryProductProtocolNetUid: init.deliveryProductProtocolNetUid || '',
    documents: init.documents || [],
    grossPrice: task.GrossPrice || 0,
    id: getTaskModelId(task, `${index}-${serviceIndex}`),
    organization: payForOrganization || organization,
    organizationName: init.organizationName,
    organizationNetUid: init.organizationNetUid ?? getEntityValue(organization),
    paidOrder: getPaidOrder(task),
    payForClient: init.payForClient ?? null,
    rows: init.rows,
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

function serviceColumns(t: Translate): AvailablePaymentColumn[] {
  return [
    { format: 'date', header: t('Дата'), key: 'date' },
    { format: 'text', header: t('Номер документу'), key: 'serviceNumber' },
    { format: 'text', header: t('Номер'), key: 'number' },
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
    { format: 'text', header: t('Назва'), key: 'name' },
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
    : t('Неоплаченно')
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
