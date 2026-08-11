import { describe, expect, it } from 'vitest'
import { clientNetUidKey, indexByClientNetUid } from './clientNetUidIndex'

describe('clientNetUidIndex', () => {
  it('matches API GUIDs regardless of casing used by the client row', () => {
    const quality = {
      ClientNetUid: '924413fc-d9d9-44f1-974b-01898646f938',
      State: 'review_required',
    }

    const index = indexByClientNetUid([quality])

    expect(index.get(clientNetUidKey(
      '924413FC-D9D9-44F1-974B-01898646F938',
    ))).toBe(quality)
  })

  it('trims identifiers and excludes empty keys', () => {
    const item = { ClientNetUid: '  Client-1  ' }

    const index = indexByClientNetUid([
      item,
      { ClientNetUid: '   ' },
    ])

    expect(index.get('client-1')).toBe(item)
    expect(index.has('')).toBe(false)
  })
})
