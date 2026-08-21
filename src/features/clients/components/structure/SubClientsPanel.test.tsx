import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { theme } from '../../../../shared/theme/theme'
import { getClientSubClients } from '../../api/clientCabinetApi'
import type { Client } from '../../types'
import {
  extractRelatedClients,
  isClientRelationshipKind,
} from './clientRelationship'
import { SubClientsPanel } from './SubClientsPanel'

vi.mock('../../api/clientCabinetApi', () => ({
  getClientSubClients: vi.fn(),
}))

const getClientSubClientsMock = vi.mocked(getClientSubClients)

describe('SubClientsPanel relationship kinds', () => {
  beforeEach(() => {
    getClientSubClientsMock.mockReset()
  })

  it('separates source-folder structural units from actual subclients', () => {
    const structuralUnit = createClient('structural', 'VI03503', {
      IsTradePoint: true,
    })
    const subclient = createClient('subclient', 'VI03501', {
      IsSubClient: true,
    })
    const root = createClient('root', 'VI03500', {
      SubClients: [
        { Id: 1, SubClient: structuralUnit },
        { Id: 2, SubClient: subclient },
      ],
    })

    expect(extractRelatedClients(root, 'structural-unit')).toEqual([structuralUnit])
    expect(extractRelatedClients(root, 'subclient')).toEqual([subclient])
    expect(isClientRelationshipKind(structuralUnit, 'subclient')).toBe(false)
    expect(isClientRelationshipKind(subclient, 'structural-unit')).toBe(false)
  })

  it('opens the same full client card for a selected structural unit', async () => {
    const structuralUnit = createClient('structural', 'VI03503', {
      FullName: 'РЕШЕТНІК ВАДИМ ІГОРОВИЧ ФОП',
      IsTradePoint: true,
    })
    const ordinarySubclient = createClient('subclient', 'VI03501', {
      FullName: 'РЕШЕТНІК ІГОР ВОЛОДИМИРОВИЧ ФОП',
      IsSubClient: true,
    })
    getClientSubClientsMock.mockResolvedValueOnce([
      { Id: 1, SubClient: structuralUnit },
      { Id: 2, SubClient: ordinarySubclient },
    ])

    renderPanel(createClient('root', 'VI03500'), 'structural-unit')

    const structuralButton = await screen.findByRole('button', {
      name: /РЕШЕТНІК ВАДИМ ІГОРОВИЧ ФОП/u,
    })
    expect(screen.queryByText('РЕШЕТНІК ІГОР ВОЛОДИМИРОВИЧ ФОП')).toBeNull()

    fireEvent.click(structuralButton)

    expect(await screen.findByText('FULL CARD structural')).toBeTruthy()
  })
})

function renderPanel(client: Client, relationKind: 'structural-unit' | 'subclient') {
  return render(
    <MantineProvider env="test" theme={theme}>
      <I18nProvider>
        <MemoryRouter initialEntries={['/clients']}>
          <Routes>
            <Route path="/clients" element={<SubClientsPanel client={client} relationKind={relationKind} />} />
            <Route path="/clients/edit/:netid" element={<FullCardProbe />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

function FullCardProbe() {
  const { netid } = useParams()

  return <div>FULL CARD {netid}</div>
}

function createClient(netUid: string, code: string, overrides: Partial<Client> = {}): Client {
  return {
    FullName: code,
    Id: code.length,
    IsActive: true,
    NetUid: netUid,
    RegionCode: { Value: code },
    ...overrides,
  }
}
