import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { theme } from '../../../shared/theme/theme'
import type { Client } from '../types'
import { ClientFolderChildren } from './ClientFolderChildren'

describe('ClientFolderChildren', () => {
  it('renders every exact child from XM05200 and selects the clicked counterparty', () => {
    const magrom = createClient(2, 'XM05202', 'МАГРОМ ТОВ')
    const folder = createClient(100, 'XM05200', 'Хмельницький - Назаришин В. М.')
    const children = [
      magrom,
      createClient(3, 'XM05203', 'НАЗАРИШИН ВАЛЕРІЙ МИКОЛАЙОВИЧ ФОП'),
      createClient(5, 'XM05205', 'ДОМАТЕВИЧ СЕРГІЙ ОЛЕКСАНДРОВИЧ ФОП'),
      createClient(6, 'XM05206', 'МАЛИЧ ДІАНА ОЛЕКСАНДРІВНА ФОП'),
      createClient(1, 'XM05201', 'Хмельницький - ФОП Назаришин Валерій Миколайович'),
      createClient(4, 'XM05204', "Кам'янець Подільський - ФОП Назаришин Валерій Миколайович"),
    ]
    folder.SubClients = children.map((child, index) => ({ Id: index + 1, SubClient: child }))
    const onSelect = vi.fn()

    render(
      <MantineProvider env="test" theme={theme}>
        <I18nProvider>
          <ClientFolderChildren client={folder} onSelect={onSelect} />
        </I18nProvider>
      </MantineProvider>,
    )

    const list = screen.getByRole('list', { name: 'Клієнти папки XM05200' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(6)

    fireEvent.click(within(list).getByRole('button', { name: 'XM05202 · МАГРОМ ТОВ' }))
    expect(onSelect).toHaveBeenCalledWith(magrom)
  })

  it('renders persisted children for a consolidated root whose code does not end in 00', () => {
    const child = createClient(3, 'VI03503', 'РЕШЕТНІК ВАДИМ ІГОРОВИЧ ФОП')
    const root = createClient(1, 'VI03501', 'РЕШЕТНІК ІГОР ВОЛОДИМИРОВИЧ ФОП')
    root.SubClients = [{ Id: 1, SubClient: child }]
    const onSelect = vi.fn()

    render(
      <MantineProvider env="test" theme={theme}>
        <I18nProvider>
          <ClientFolderChildren client={root} onSelect={onSelect} />
        </I18nProvider>
      </MantineProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'VI03503 · РЕШЕТНІК ВАДИМ ІГОРОВИЧ ФОП' }))
    expect(onSelect).toHaveBeenCalledWith(child)
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
