import { describe, expect, it } from 'vitest'
import type { Client, ClientSubClient } from './types'
import {
  getClientFolderChildren,
  getClientFolderSelection,
  isClientFolder,
} from './clientFolder'

describe('1C client folder policy', () => {
  it('keeps every explicitly linked XM05200 child even without legacy hierarchy flags', () => {
    const children = [
      createClient(1, 'XM05202', 'МАГРОМ ТОВ'),
      createClient(2, 'XM05203', 'НАЗАРИШИН ВАЛЕРІЙ МИКОЛАЙОВИЧ ФОП'),
      createClient(3, 'XM05205', 'ДОМАТЕВИЧ СЕРГІЙ ОЛЕКСАНДРОВИЧ ФОП'),
      createClient(4, 'XM05206', 'МАЛИЧ ДІАНА ОЛЕКСАНДРІВНА ФОП'),
      createClient(5, 'XM05201', 'Хмельницький - ФОП Назаришин Валерій Миколайович'),
      createClient(6, 'XM05204', "Кам'янець Подільський - ФОП Назаришин Валерій Миколайович"),
    ]
    const folder = createClient(100, 'XM05200', 'Хмельницький - Назаришин В. М.')

    folder.SubClients = [
      ...children.map((child, index) => createLink(index + 1, child)),
      createLink(99, children[0]),
    ]

    expect(isClientFolder(folder)).toBe(true)
    expect(getClientFolderChildren(folder).map((child) => child.RegionCode?.Value)).toEqual([
      'XM05202',
      'XM05203',
      'XM05205',
      'XM05206',
      'XM05201',
      'XM05204',
    ])
  })

  it('expands a consolidated non-00 root when persisted relationships exist', () => {
    const root = createClient(1, 'VI03501', 'РЕШЕТНІК ІГОР ВОЛОДИМИРОВИЧ ФОП')
    root.SubClients = [
      createLink(1, createClient(2, 'VI03503', 'РЕШЕТНІК ВАДИМ ІГОРОВИЧ ФОП')),
      createLink(2, createClient(3, 'VI03504', 'РЕШЕТНІК ЮЛІЯ ВАСИЛІВНА ФОП')),
      createLink(3, createClient(4, 'VI03505', 'ТРЕТЯК ІННА ІГОРІВНА ФОП')),
    ]

    expect(isClientFolder(root)).toBe(true)
    expect(getClientFolderChildren(root).map((child) => child.RegionCode?.Value)).toEqual([
      'VI03503',
      'VI03504',
      'VI03505',
    ])
  })

  it('does not expand a regular client without persisted relationships', () => {
    const directClient = createClient(1, 'XM05201', 'ФОП Назаришин')

    expect(isClientFolder(directClient)).toBe(false)
    expect(getClientFolderChildren(directClient)).toEqual([])
  })

  it('ignores a malformed self-link instead of creating a recursive row', () => {
    const client = createClient(1, 'VI03501', 'РЕШЕТНІК ІГОР ВОЛОДИМИРОВИЧ ФОП')
    client.SubClients = [createLink(1, client)]

    expect(isClientFolder(client)).toBe(false)
    expect(getClientFolderChildren(client)).toEqual([])
  })

  it('opens a virtual source folder through its deterministic persisted anchor', () => {
    const anchor = createClient(1, 'TE01401', 'ФОП Варченко Олег Іванович')
    const folder = createClient(100, 'TE01400', 'Тернопіль - Варченко')
    folder.NetUid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    folder.SubClients = [
      createLink(1, anchor),
      createLink(2, createClient(2, 'TE01402', 'ФОП Закусіло Марія Ігорівна')),
    ]

    expect(getClientFolderSelection(folder)).toBe(anchor)
    expect(getClientFolderSelection(anchor)).toBe(anchor)
  })

  it('does not open a suffix-only virtual folder without a persisted anchor', () => {
    const emptyFolder = createClient(100, 'TE01400', 'Тернопіль - Варченко')

    expect(isClientFolder(emptyFolder)).toBe(true)
    expect(getClientFolderSelection(emptyFolder)).toBeNull()
  })
})

function createClient(id: number, code: string, fullName: string): Client {
  return {
    FullName: fullName,
    Id: id,
    IsActive: true,
    NetUid: `00000000-0000-0000-0000-${String(id).padStart(12, '0')}`,
    RegionCode: { Value: code },
  }
}

function createLink(id: number, child: Client): ClientSubClient {
  return {
    Id: id,
    NetUid: `10000000-0000-0000-0000-${String(id).padStart(12, '0')}`,
    SubClient: child,
  }
}
