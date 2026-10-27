import { describe, expect, it } from 'vitest'
import {
  canEditClientLifecycle,
  isSourceManagedAgreement,
  isSourceManagedClient,
} from './clientSourceOwnership'
import type { Client } from './types'

describe('client source ownership', () => {
  it.each([
    [{ SourceAmgCode: 3968 }, true],
    [{ SourceFenixCode: 7630 }, true],
    [{ SourceAmgCode: 0 }, true],
    [{ SourceAmgId: '' }, true],
    [{ SourceFenixId: [] }, true],
    [{}, false],
    [null, false],
  ] as Array<[Partial<Client> | null, boolean]>)('detects source-managed clients', (client, expected) => {
    expect(isSourceManagedClient(client as Client | null)).toBe(expected)
  })

  it('blocks lifecycle edits for source-managed clients even with permission', () => {
    expect(canEditClientLifecycle({ SourceAmgCode: 3968 } as Client, true)).toBe(false)
    expect(canEditClientLifecycle({} as Client, true)).toBe(true)
    expect(canEditClientLifecycle({} as Client, false)).toBe(false)
  })

  it('treats imported clients and agreements as native after the cutover', () => {
    expect(isSourceManagedClient({ SourceFenixCode: 7630 } as Client, true)).toBe(false)
    expect(isSourceManagedAgreement({ SourceAmgId: '' }, true)).toBe(false)
    expect(canEditClientLifecycle({ SourceAmgCode: 3968 } as Client, true, true)).toBe(true)
    expect(canEditClientLifecycle({ SourceAmgCode: 3968 } as Client, false, true)).toBe(false)
  })

  it('detects source-managed agreements by code or source id', () => {
    expect(isSourceManagedAgreement({ SourceFenixCode: 0 })).toBe(true)
    expect(isSourceManagedAgreement({ SourceAmgId: '' })).toBe(true)
    expect(isSourceManagedAgreement({})).toBe(false)
  })
})
