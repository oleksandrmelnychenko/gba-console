import { describe, expect, it } from 'vitest'
import { getSaleReviewIssues } from '../../saleReviewGuards'
import type { SalesUkraineSale } from '../../types'
import { formatSaleReviewIssues } from './useWizardSaleSubmission'

describe('«Створити накладну» preflight message', () => {
  it('lists every missing field of an empty delivery at once', () => {
    const issues = getSaleReviewIssues({} as SalesUkraineSale)

    expect(formatSaleReviewIssues(issues, (value) => value)).toBe(
      'Не вибраний перевізник; Не вибраний одержувач; Вкажіть мобільний телефон одержувача',
    )
  })
})
