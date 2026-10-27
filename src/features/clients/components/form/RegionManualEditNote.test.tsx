import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { theme } from '../../../../shared/theme/theme'
import type { Client, ClientRegionManualEdit } from '../../types'
import { GeneralInfoFields, type ClientFormRole } from './GeneralInfoFields'

const role: ClientFormRole = { isBuyer: true, isProvider: false, isSubClient: false }
const edit: ClientRegionManualEdit = {
  ClientId: 10,
  EditedByName: 'Петренко Олена Іванівна',
  EditedAtUtc: '2026-10-27T09:30:00',
  Source: 1,
  RegionCodeValue: 'XM01000',
}
const client = {
  FullName: 'ТОВ МАГРОМ',
  Name: 'МАГРОМ ТОВ',
  Region: { Id: 1, Name: 'XM' },
  RegionCode: { Id: 100, Value: 'XM01000' },
} as Client

function renderFields(sourceManaged: boolean, regionManualEdit: ClientRegionManualEdit | null) {
  return render(
    <MantineProvider env="test" theme={theme}>
      <I18nProvider>
        <GeneralInfoFields
          client={client}
          countries={[]}
          incoterms={[]}
          packingMarkings={[]}
          packingMarkingPayments={[]}
          regionManualEdit={regionManualEdit}
          regions={[{ Id: 1, Name: 'XM' }]}
          role={role}
          sourceManaged={sourceManaged}
          onAddDocuments={vi.fn()}
          onChange={vi.fn()}
          onCreateCountry={vi.fn()}
          onCreateIncoterm={vi.fn()}
          onCreateRegion={vi.fn()}
          onRegionChange={vi.fn()}
          onRegionCodeFieldChange={vi.fn()}
          onRemoveDocument={vi.fn()}
          onSaveDocuments={vi.fn()}
        />
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('region manual edit note', () => {
  it('appears under the region in the read-only card of a 1C client', () => {
    renderFields(true, edit)

    expect(screen.getByTestId('client-region-manual-edit').textContent)
      .toBe('Код по регіону змінено вручну: Петренко Олена Іванівна, 27.10.2026, 11:30. Синхронізація з 1С його не змінює.')
  })

  it('appears under the region inputs in the edit form', () => {
    renderFields(false, edit)

    expect(screen.getByTestId('client-region-manual-edit').textContent).toContain('Петренко Олена Іванівна')
  })

  it('is absent when nobody changed the region by hand', () => {
    renderFields(true, null)

    expect(screen.queryByTestId('client-region-manual-edit')).toBeNull()
  })
})
