import { expect, it } from 'vitest'
import { saleAgreementLabel, saleAgreementTitle } from './saleAgreementLabel'

it('preserves valid Ukrainian names and empty values', () => {
  expect(saleAgreementLabel(' Основний договір ТОВ ')).toBe('Основний договір ТОВ')
  expect(saleAgreementLabel(null)).toBe('')
})

it('keeps intact words without inventing missing letters', () => {
  expect(saleAgreementLabel('������ Concord')).toBe('Concord')
  expect(saleAgreementLabel('До�овір Concord')).toBe('Concord')
  expect(saleAgreementTitle('������ Concord')).toContain('пошкоджена у джерелі')
})

it('shows an explicit fallback when the whole name is damaged', () => {
  expect(saleAgreementLabel('����')).toBe('Назва договору недоступна')
})
