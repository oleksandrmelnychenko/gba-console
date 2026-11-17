import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { theme } from '../../../../shared/theme/theme'
import type { ClientAgreement, Pricing } from '../../types'
import { ClientAgreementsPanel } from './ClientAgreementsPanel'

vi.mock('../../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}))

const pricings = [{ ForVat: false, Id: 1, Name: 'Роздріб' }] as Pricing[]

function renderPanel(agreements: ClientAgreement[], onSaveAgreement = vi.fn()) {
  render(
    <MantineProvider env="test" theme={theme}>
      <I18nProvider>
        <ClientAgreementsPanel
          agreements={agreements}
          currencies={[]}
          isProvider={false}
          organizations={[]}
          pricings={pricings}
          promotionalPricings={[]}
          sourceEditMode="manual"
          onDeleteAgreement={vi.fn()}
          onSaveAgreement={onSaveAgreement}
        />
      </I18nProvider>
    </MantineProvider>,
  )
  return onSaveAgreement
}

function agreement(patch: Partial<NonNullable<ClientAgreement['Agreement']>>): ClientAgreement {
  return {
    Id: 1,
    NetUid: 'client-agreement-1',
    Agreement: { Id: 2, NetUid: 'agreement-2', Name: 'Основний', Pricing: pricings[0], ...patch },
  }
}

describe('agreement dialog validation', () => {
  it('rejects «Діє з» after «Діє по» under the end-date field and does not save', () => {
    const onSave = renderPanel([agreement({ FromDate: '2030-01-01', ToDate: '2020-01-01' })])

    fireEvent.click(screen.getByRole('button', { name: 'Редагувати' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Зберегти' }))

    const toDate = within(dialog).getByLabelText('Діє по')
    expect(toDate.getAttribute('aria-invalid')).toBe('true')
    expect(within(dialog).getByText('Дата «Діє по» не може бути раніше за «Діє з»')).toBeTruthy()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('shows the required «Найменування» error under the field, not only at the bottom', () => {
    const onSave = renderPanel([agreement({ Name: '' })])

    fireEvent.click(screen.getByRole('button', { name: 'Редагувати' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Зберегти' }))

    const name = within(dialog).getByRole('textbox', { name: /Найменування/ })
    expect(name.getAttribute('aria-invalid')).toBe('true')
    expect(within(dialog).getAllByText('Вкажіть найменування')).toHaveLength(1)
    expect(within(dialog).queryByText('*', { selector: '.mantine-InputWrapper-error' })).toBeNull()
    expect(onSave).not.toHaveBeenCalled()
  })
})
