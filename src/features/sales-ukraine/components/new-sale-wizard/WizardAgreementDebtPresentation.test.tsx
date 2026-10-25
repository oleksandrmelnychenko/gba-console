import { documentaryOverlayFixture, documentarySummaryFixture } from '../../../../shared/debt/documentaryDebtAging.test-fixtures'
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


describe('documentary agreement read overlay', () => {
  const documented = (unknown: boolean): ClientAgreement => ({
    ...agreementWithoutLimit, ClientId: 7, AgreementId: 9,
    Agreement: { ...agreementWithoutLimit.Agreement, Id: 9, DebtAgeDays: 90, OverdueDays: 60, IsOverdue: true },
    DocumentaryDebtAging: documentaryOverlayFixture({ Agreements: [documentarySummaryFixture(unknown ? {
      UnknownDateDebtCount: 1, KnownNotOverdueCount: 0, HasCompleteAging: false,
      OverdueTotal: null, MaxKnownDebtAgeDays: null, MaxKnownDaysPastDue: null,
    } : { CreditBalance: 100 })] }),
  })

  it.each(['dropdown', 'strip'])('shows unknown rather than old operational90/60 in %s and keeps selection enabled', (variant) => {
    const agreement = documented(true)
    const onSelect = vi.fn()
    render(<MantineProvider>{variant === 'dropdown'
      ? <WizardAgreementItem clientAgreement={agreement} onSelect={onSelect} />
      : <WizardClientAgreementsStrip agreements={[agreement]} onSelect={onSelect} selectedKey="" />
    }</MantineProvider>)
    expect(screen.getByText('Макс. відомий вік боргу')).toBeTruthy()
    expect(screen.getByText('Макс. відоме прострочення')).toBeTruthy()
    expect(screen.getAllByText('Не визначено')).toHaveLength(2)
    expect(screen.queryByText('90 дн.')).toBeNull()
    expect(screen.queryByText('60 дн.')).toBeNull()
    expect(screen.getByRole('note').textContent).toContain('Без підтвердженої дати: 1')
    expect(screen.getByRole('note').textContent).toContain('25.10.2026')
    fireEvent.click(screen.getByRole('button', { name: /Основний договір/ }))
    expect(onSelect).toHaveBeenCalledOnce()
    expect(agreement.Agreement?.IsOverdue).toBe(true)
  })

  it('shows known zero and separate positive debt and credit even when net balance is zero', () => {
    render(<MantineProvider><WizardAgreementItem clientAgreement={documented(false)} /></MantineProvider>)
    expect(screen.getAllByText('0 дн.')).toHaveLength(2)
    expect(screen.getByText('Кредитовий залишок')).toBeTruthy()
    expect(screen.getAllByText('100')).toHaveLength(2)
    expect(screen.queryByText('Прострочено')).toBeNull()
  })
})
