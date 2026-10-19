import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { DiscountsTree } from './DiscountsTree'

vi.mock('../../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../../api/clientAgreementsApi', () => ({
  getAgreementProductGroupDiscounts: vi.fn().mockResolvedValue([
    { ProductGroup: { NetUid: 'al-ko', Name: 'AL-KO' }, DiscountRate: 16, IsActive: true },
  ]),
}))

it('keeps the agreement and discount visible when selecting rows', async () => {
  const apply = vi.fn()
  render(<MantineProvider env="test"><I18nProvider>
    <DiscountsTree clientAgreementNetId="agreement" selectedAgreementName="Основний договір" productGroupDiscounts={[]} onApplyChanges={apply} />
  </I18nProvider></MantineProvider>)
  expect(await screen.findByText('16 %')).toBeTruthy()
  expect(screen.getByText('Основний договір')).toBeTruthy()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Вибрати всі' }))
  expect(screen.getByText('16 %')).toBeTruthy()
  expect((screen.getByRole('checkbox', { name: 'Вибрати: AL-KO' }) as HTMLInputElement).checked).toBe(true)
  expect(apply).not.toHaveBeenCalled()
})
