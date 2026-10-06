import { orderAnalysisDefinitions, orderAnalysisDefaultMeasures, orderAnalysisMeasures, orderAnalysisRows, orderAnalysisRequest, type OrderAnalysisKind, type OrderAnalysisCapability, type OrderAnalysisRequest } from './originalOrderAnalyses'
export function orderCapabilityFixture(kind: OrderAnalysisKind = 1): OrderAnalysisCapability {
  return { Version: 1, World: 'fenix', Definition: { ...orderAnalysisDefinitions[kind] }, DefaultRows: orderAnalysisRows(kind), DefaultMeasures: orderAnalysisDefaultMeasures(kind), Measures: orderAnalysisMeasures(kind),
    OurOnlyReaderImplemented: true, OriginalSavedVariantsVerified: false, SourceParityVerified: false }
}
export const orderRequestFixture = (kind: OrderAnalysisKind = 1) => { const cap = orderCapabilityFixture(kind); return orderAnalysisRequest(cap, '2026-10-01', '2026-10-06', cap.DefaultRows, cap.DefaultMeasures, [], null, null) }

import type { OrderAnalysisResult, OrderAnalysisChoices } from './originalOrderAnalysisResponse'
export function orderEchoFixture(request: OrderAnalysisRequest) {
  return { Definition: { ...orderAnalysisDefinitions[request.Kind] }, From: request.From, Through: request.Through, Rows: [...request.Rows], Measures: [...request.Measures], Filters: request.Filters.map(v => ({ Field: v.Field, Value: { ...v.Value } })), Shipment: null, Payment: null, ShipmentStates: request.ShipmentStates, PaymentStates: request.PaymentStates }
}
export const orderNumberFixture = (value = '10') => ({ Observed: true, Value: { Numerator: value, Denominator: '1' } })
export function orderChoicesFixture(request = orderRequestFixture()): OrderAnalysisChoices {
  return { Request: request, OurSnapshotVerified: true, InputWitnessSha256: 'd'.repeat(64), Choices: [{ Field: 4, Value: { Reference: 'A'.repeat(32), Type: null, Table: null }, Caption: 'Наш товар', MappingSource: 'ProductCurrent', WitnessSha256: 'e'.repeat(64) }],
    UnresolvedChoices: [{ Field: 3, Value: { Reference: 'B'.repeat(32), Type: '08', Table: '00000263' }, Code: 'order_name_mapping_unavailable' }],
    Inputs: [{ Family: 'BuyerOrders', Published: true, Replayed: true, OpeningRunId: '11111111-1111-1111-1111-111111111111', InputWitnessSha256: 'c'.repeat(64), PhysicalGrains: 1, Code: 'complete' }], MissingDependencies: [], NormalReportAccepted: false }
}
export const orderChoicesWireFixture = (request = orderRequestFixture()) => ({ ...orderChoicesFixture(request), Request: orderEchoFixture(request) })
export function orderResultFixture(request = orderRequestFixture()): OrderAnalysisResult {
  const choices = orderChoicesFixture(request), shipment = { Observed: true, Caption: null, NumericZero: true }
  return { Request: request, OurSnapshotVerified: choices.OurSnapshotVerified, InputWitnessSha256: choices.InputWitnessSha256, Choices: choices.Choices, UnresolvedChoices: choices.UnresolvedChoices, Inputs: choices.Inputs, MissingDependencies: [],
    Available: true, Code: 'original_order_analysis_available', NormalInputsComplete: true, SelectedNumbersObserved: true, Rows: [],
    Groups: [{ Key: [], Measures: Object.fromEntries(request.Measures.map(name => [name, orderNumberFixture()])), Shipment: shipment, Payment: request.Kind === 0 ? null : { ...shipment } }] }
}
export const orderResultWireFixture = (request = orderRequestFixture()) => ({ ...orderResultFixture(request), Request: orderEchoFixture(request), NativeVirtualTableVerified: false, CommonSourceSnapshotVerified: false, SourceParityVerified: false, OriginalSavedVariantsVerified: false, OriginalAclVerified: false, AppliesFxConversion: false })
