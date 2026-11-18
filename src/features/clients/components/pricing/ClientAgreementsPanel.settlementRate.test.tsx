import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { theme } from '../../../../shared/theme/theme'
import { prepareClientSavePayload } from '../../api/clientFormApi'
import type { Agreement, ClientAgreement, Currency, Pricing } from '../../types'
import { ClientAgreementsPanel } from './ClientAgreementsPanel'

vi.mock('../../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}))

const pricings = [{ ForVat: false, Id: 1, Name: 'Роздріб' }] as Pricing[]
const currencies = [{ Id: 7, Name: 'EUR' }, { Id: 8, Name: 'UAH' }] as Currency[]

function renderPanel(agreements: ClientAgreement[], isProvider = true) {
  const onSave = vi.fn<(agreement: Agreement, isEdit: boolean) => void>()
  render(
    <MantineProvider env="test" theme={theme}>
      <I18nProvider>
        <ClientAgreementsPanel
          agreements={agreements}
          currencies={currencies}
          isProvider={isProvider}
          organizations={[]}
          pricings={pricings}
          promotionalPricings={[]}
          sourceEditMode="manual"
          onDeleteAgreement={vi.fn()}
          onSaveAgreement={onSave}
        />
      </I18nProvider>
    </MantineProvider>,
  )
  return onSave
}

function supplierAgreement(settlementRateKind: Agreement['SettlementRateKind']): ClientAgreement {
  return {
    Id: 1,
    NetUid: 'client-agreement-1',
    Agreement: {
      Currency: currencies[1],
      Id: 2,
      Name: 'Постачання',
      NetUid: 'agreement-2',
      ProviderPricing: { Id: 3, Name: 'Закупівля' },
      SettlementRateKind: settlementRateKind,
    },
  }
}

function openEditDialog(index = 0) {
  fireEvent.click(screen.getAllByRole('button', { name: 'Редагувати' })[index])
  return screen.getByRole('dialog')
}

describe('agreement dialog «Курс розрахунків»', () => {
  it('sends the stored kind back unchanged when something else is edited', () => {
    const onSave = renderPanel([supplierAgreement(2)])
    const dialog = openEditDialog()

    expect((within(dialog).getByRole('combobox', { name: /^Курс розрахунків/ }) as HTMLInputElement).value).toBe('Комерційний')
    fireEvent.change(within(dialog).getByRole('textbox', { name: /^Найменування/ }), { target: { value: 'Постачання 2' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Зберегти' }))

    const [saved] = onSave.mock.calls[0]
    expect(saved).toMatchObject({ Name: 'Постачання 2', SettlementRateKind: 2 })
    expect(prepareClientSavePayload({ ClientAgreements: [{ Agreement: saved }] }).ClientAgreements?.[0]?.Agreement)
      .toMatchObject({ SettlementRateKind: 2 })
  })

  it('stores НБУ and goes back to the default as an explicit null', () => {
    const onSave = renderPanel([supplierAgreement(null), { ...supplierAgreement(1), Id: 5, NetUid: 'client-agreement-5', Agreement: { ...supplierAgreement(1).Agreement, Id: 6, NetUid: 'agreement-6' } }])
    let dialog = openEditDialog(0)
    const select = within(dialog).getByRole('combobox', { name: /^Курс розрахунків/ })

    expect((select as HTMLInputElement).value).toBe('Як за замовчуванням')
    expect(within(dialog).getByText('За замовчуванням прихід — за курсом НБУ, оплата — за комерційним курсом.')).toBeTruthy()
    fireEvent.click(select)
    fireEvent.click(screen.getByRole('option', { name: 'НБУ' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Зберегти' }))
    expect(onSave.mock.calls[0][0]).toMatchObject({ SettlementRateKind: 1 })

    dialog = openEditDialog(1)
    expect((within(dialog).getByRole('combobox', { name: /^Курс розрахунків/ }) as HTMLInputElement).value).toBe('НБУ')
    fireEvent.click(within(dialog).getByRole('combobox', { name: /^Курс розрахунків/ }))
    fireEvent.click(screen.getByRole('option', { name: 'Як за замовчуванням' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Зберегти' }))

    const saved = onSave.mock.calls[1][0]
    expect(saved.SettlementRateKind).toBeNull()
    expect(JSON.stringify(prepareClientSavePayload({ ClientAgreements: [{ Agreement: saved }] })))
      .toContain('"SettlementRateKind":null')
  })

  it('is not offered on a buyer agreement', () => {
    renderPanel([{ ...supplierAgreement(null), Agreement: { ...supplierAgreement(null).Agreement, Pricing: pricings[0] } }], false)
    const dialog = openEditDialog()

    expect(within(dialog).queryByRole('combobox', { name: /^Курс розрахунків/ })).toBeNull()
  })
})
