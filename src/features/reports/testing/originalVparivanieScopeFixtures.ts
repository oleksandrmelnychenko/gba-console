import { currentVparivanieRequest, exactSelection } from '../data/currentVparivanie.test-fixtures'
import { matrixFixture, matrixWire } from './originalVparivanieFixtures'
import type { MatrixScopeBinding } from '../data/originalVparivanieScope'

export function originalScopeRequest() {
  return { ...currentVparivanieRequest(), from: '2025-01-01', to: '2026-10-09',
    currentVparivanieFullScope: true, selections: [exactSelection(4, 6, ['3569'])] }
}
export const originalScopeBinding = (): MatrixScopeBinding => ({ ...matrixWire(), From: '2025-01-01', Through: '2026-10-09',
  GroupCaption: 'Наша група', AdmissionPolicy: 'ExactCurrentInputWitnessV1', AcceptedInputWitnessSha256: 'a'.repeat(64), AcceptanceProofSha256: 'b'.repeat(64) })
export const scopedMatrixFixture = () => ({ ...matrixFixture(), ...originalScopeBinding(), ExactScopeAccepted: true })

/** The saved .NET DTO uses these two PascalCase aliases, unlike the builder request. */
export function originalScopeWireTemplate() {
  const data = originalScopeRequest()
  return { Id: 'scope', Revision: 1, Name: 'Оригінальна повна матриця', Data: {
    DataSource: data.dataSource, From: data.from, To: data.to, CurrentVparivanieFullScope: true,
    Selections: structuredClone(data.selections), Sorted: { ...structuredClone(data.sorted),
      Measurements: data.sorted.Measurements.map(item => Object.fromEntries(Object.entries(item)
        .map(([key, value]) => [key === 'parentName' ? 'ParentName' : key, value])) as typeof item) },
  } }
}
