import { describe, expect, it } from 'vitest'
import { buildToStorageOptions, isSameStorageOrganization } from './transferTargetStorages'

/* chaos3 N3-01: «На склад» of the storages-page transfer offers only the source organisation's storages. */
describe('transfer target storages', () => {
  const source = { Id: 1, Name: 'C3 Склад A', NetUid: 's-a', Organization: { Id: 10, Name: 'QA ТОВ Тест Україна' } }
  const storages = [
    source,
    { Id: 2, Name: 'C3 Склад B', NetUid: 's-b', OrganizationId: 10 },
    { Id: 3, Name: 'СКЛАД -1 (Фенікс)', NetUid: 's-f', Organization: { Id: 20, Name: 'Фенікс' } },
    { Id: 4, Name: 'Конкорд', NetUid: 's-k', Organization: { Id: 30, NetUid: 'org-k', Name: 'АМГ «КОНКОРД»' } },
  ]

  it('lists only other storages of the same organisation', () => {
    expect(buildToStorageOptions(storages, source).map((option) => option.value)).toEqual(['s-b'])
  })

  it('compares by organisation NetUid when ids are missing', () => {
    const byNetUid = { NetUid: 's-x', Organization: { NetUid: 'org-k' } }

    expect(isSameStorageOrganization({ NetUid: 's-k', Organization: { NetUid: 'org-k' } }, byNetUid)).toBe(true)
    expect(isSameStorageOrganization({ NetUid: 's-y', Organization: { NetUid: 'org-other' } }, byNetUid)).toBe(false)
    expect(isSameStorageOrganization({ NetUid: 's-z' }, byNetUid)).toBe(false)
  })

  it('does not filter when the source organisation is unknown (the server still refuses)', () => {
    expect(buildToStorageOptions(storages, { NetUid: 's-a' })).toHaveLength(3)
  })
})
