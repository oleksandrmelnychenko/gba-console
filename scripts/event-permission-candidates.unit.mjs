import assert from 'node:assert/strict'
import test from 'node:test'
import {
  scanSourceText,
  serializeReport,
} from './event-permission-candidates.mjs'

const fixture = `
  const canCreate = can('sales.ukraine.sale.create')
  export function Fixture() {
    return (
      <>
        <Button disabled={!canCreate} onClick={openCreate}>Створити</Button>
        <PermissionGate permissionKey="sales.ukraine.sale.delete">
          <Button onClick={deleteSale}>Видалити</Button>
        </PermissionGate>
        <ActionIcon aria-label="Скинути" onClick={resetFilters} />
      </>
    )
  }
`

test('extracts deterministic action candidates and a resolved permission binding', () => {
  const first = scanSourceText({ file: 'fixture.tsx', sourceText: fixture })
  const second = scanSourceText({ file: 'fixture.tsx', sourceText: fixture })
  const createAction = first.find(
    (candidate) => candidate.kind === 'action' && candidate.humanLabel === 'Створити',
  )
  const resetAction = first.find(
    (candidate) => candidate.kind === 'action' && candidate.humanLabel === 'Скинути',
  )
  const deleteAction = first.find(
    (candidate) => candidate.kind === 'action' && candidate.humanLabel === 'Видалити',
  )

  assert.deepEqual(first, second)
  assert.deepEqual(createAction?.permissionKeys, ['sales.ukraine.sale.create'])
  assert.equal(createAction?.status, 'binding-candidate')
  assert.deepEqual(deleteAction?.permissionKeys, ['sales.ukraine.sale.delete'])
  assert.equal(deleteAction?.status, 'binding-candidate')
  assert.deepEqual(resetAction?.permissionKeys, [])
  assert.equal(resetAction?.status, 'needs-review')
  assert.equal(serializeReport({ candidates: first }), serializeReport({ candidates: second }))
})
