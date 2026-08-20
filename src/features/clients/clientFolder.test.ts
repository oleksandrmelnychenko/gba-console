import { describe, expect, it } from 'vitest'
import type { Client, ClientSubClient } from './types'
import { getClientFolderChildren, isClientFolder } from './clientFolder'

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

  it('treats a non-00 card as a direct client even if stale nested links are present', () => {
    const directClient = createClient(1, 'XM05201', 'ФОП Назаришин')
    directClient.SubClients = [createLink(1, createClient(2, 'XM05202', 'МАГРОМ ТОВ'))]

    expect(isClientFolder(directClient)).toBe(false)
    expect(getClientFolderChildren(directClient)).toEqual([])
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
