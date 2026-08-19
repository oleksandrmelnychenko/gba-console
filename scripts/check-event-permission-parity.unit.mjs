import assert from 'node:assert/strict'
import test from 'node:test'
import { assertPermissionKeyParity } from './check-event-permission-parity.mjs'

test('accepts equal unique canonical key sets independent of order', () => {
  assert.deepEqual(
    assertPermissionKeyParity({
      backendKeys: ['domain.resource.delete', 'domain.resource.create'],
      expectedCount: 2,
      frontendKeys: ['domain.resource.create', 'domain.resource.delete'],
    }),
    { backendCount: 2, frontendCount: 2, permissionCount: 2 },
  )
})

test('fails with exact missing and extra keys', () => {
  assert.throws(
    () => assertPermissionKeyParity({
      backendKeys: ['domain.resource.create', 'domain.resource.edit'],
      expectedCount: 2,
      frontendKeys: ['domain.resource.create', 'domain.resource.delete'],
    }),
    /missing from frontend: domain\.resource\.edit; extra in frontend: domain\.resource\.delete/,
  )
})

test('fails on duplicate keys before comparing sets', () => {
  assert.throws(
    () => assertPermissionKeyParity({
      backendKeys: ['domain.resource.create'],
      expectedCount: 1,
      frontendKeys: ['domain.resource.create', 'domain.resource.create'],
    }),
    /frontend contains duplicate key domain\.resource\.create/,
  )
})

test('fails when equal sets drift from the required catalog size', () => {
  assert.throws(
    () => assertPermissionKeyParity({
      backendKeys: ['domain.resource.create'],
      expectedCount: 2,
      frontendKeys: ['domain.resource.create'],
    }),
    /frontend count 1, expected 2; backend count 1, expected 2/,
  )
})
