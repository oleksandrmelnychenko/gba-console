import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ClientAgreement } from '../../../clients/types'
import { WizardAgreementItem } from './WizardAgreementItem'
import { WizardClientAgreementsStrip } from './WizardClientAgreementsStrip'

vi.mock('../../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: (value: string) => value }),
}))

const agreementWithoutLimit: ClientAgreement = {
  NetUid: 'client-agreement-1',
  AccountBalance: 999,
  CurrentAmount: 120,
  Agreement: {
    Name: 'Основний договір',
    IsControlAmountDebt: false,
    NumberDaysDebt: 30,
    Currency: { Code: 'EUR' },
    ClientInDebts: [{ Debt: { Days: 42, Total: 75 } }],
  },
}

const expectedLabels = [
  'Доступний аванс',
  'Непогашений борг',
  'Вік боргу',
  'Днів прострочення',
  'Кредитний ліміт',
]

describe('wizard agreement debt metrics', () => {
  it('renders unambiguous labels in the agreement dropdown', () => {
    render(
      <MantineProvider>
        <WizardAgreementItem clientAgreement={agreementWithoutLimit} />
      </MantineProvider>,
    )

    expectedLabels.forEach((label) => expect(screen.getByText(label)).toBeTruthy())
    expect(screen.getByText('Ліміт не налаштовано')).toBeTruthy()
    expect(screen.getByText('120')).toBeTruthy()
    expect(screen.getByText('75')).toBeTruthy()
    expect(screen.getByText('42 дн.')).toBeTruthy()
    expect(screen.getByText('12 дн.')).toBeTruthy()
    expect(screen.queryByText('Баланс')).toBeNull()
    expect(screen.queryByText('999')).toBeNull()
  })

  it('renders the same metrics in the agreement strip and remains selectable', () => {
    const onSelect = vi.fn()

    render(
      <MantineProvider>
        <WizardClientAgreementsStrip
          agreements={[agreementWithoutLimit]}
          onSelect={onSelect}
          selectedKey=""
        />
      </MantineProvider>,
    )

    expectedLabels.forEach((label) => expect(screen.getByText(label)).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /Основний договір/i }))
    expect(onSelect).toHaveBeenCalledWith(agreementWithoutLimit)
  })
})
