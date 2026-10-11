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
