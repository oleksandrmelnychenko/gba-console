import type { RegisterField, SourceRegisterDescriptorWire, SourceRegisterQueryDraft, SourceRegisterQueryWire, SourceRegisterResultWire } from './types'

// Synthetic operands for tests only. Never import this module from a production component.
export const testUuid = (index: number) => `11111111-2222-3333-4444-${index.toString(16).padStart(12, '0')}`
export function testDescriptor(resourceCount = 2): SourceRegisterDescriptorWire {
  const dimension = (index: number, caption: string): RegisterField => ({ uuid: testUuid(index), caption, isResource: false, referenceLayout: 'None', alternatives: [{ kind: 'String' }] })
  return { version: 1, kind: 'register-schema', schema: { world: 'synthetic-ui-test', schemaHash: 'a'.repeat(64), registerUuid: testUuid(1) },
    dimensions: [dimension(2, 'Договір'), dimension(3, 'Ціна'), dimension(4, 'Одиниця')],
    resources: Array.from({ length: resourceCount }, (_, index) => ({ uuid: testUuid(100 + index), caption: `Ресурс ${index + 1}`, isResource: true,
      referenceLayout: 'None', alternatives: [{ kind: 'Number', precision: '38', scale: '4' }] })) }
}
export function testDraft(descriptor = testDescriptor()): SourceRegisterQueryDraft {
  return { from: { date: '2026-04-02', time: '00:00:00', fraction: '0000001' }, toExclusive: { date: '2026-04-03', time: '00:00:00', fraction: '0000002' },
    rowFields: [descriptor.dimensions[0].uuid], columnFields: [descriptor.dimensions[1].uuid], selections: [{ resourceUuid: descriptor.resources[0].uuid, stage: 'Closing' }] }
}
export function testQuery(descriptor = testDescriptor()): SourceRegisterQueryWire {
  return { version: 1, kind: 'register-query', schema: descriptor.schema, from: '2026-04-02T00:00:00.0000001', toExclusive: '2026-04-03T00:00:00.0000002',
    rowFields: [descriptor.dimensions[0].uuid], columnFields: [descriptor.dimensions[1].uuid], selections: [{ resourceUuid: descriptor.resources[0].uuid, stage: 'Closing' }] }
}
export function testResult(descriptor = testDescriptor()): SourceRegisterResultWire {
  return { version: 1, kind: 'register-statement', schema: descriptor.schema,
    publication: { metadata: { schema: descriptor.schema, scopeHash: 'b'.repeat(64), principalPolicyHash: 'c'.repeat(64), captureId: testUuid(9), revision: '9007199254740993',
      coverageStart: '2026-04-01T00:00:00.0000000', coverageEndExclusive: '2026-04-05T00:00:00.0000000', sourceReceiptHash: 'd'.repeat(64), complete: true }, contentHash: 'e'.repeat(64) },
    query: testQuery(descriptor), groups: [
      { rowKey: [{ kind: 'String', value: 'Договір А' }], columnKey: [{ kind: 'String', value: 'Ціна 10,01' }], values: [{ coefficient: '-123401', scale: '4' }] },
      { rowKey: [{ kind: 'String', value: 'Договір Б' }], columnKey: [{ kind: 'String', value: 'Ціна 10,02' }], values: [{ coefficient: '2', scale: '0' }] },
    ], grandValues: [{ coefficient: '-103401', scale: '4' }], sourceParityVerified: false }
}
