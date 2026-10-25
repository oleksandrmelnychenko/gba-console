import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DocumentaryDebtNotice } from './DocumentaryDebtNotice'
import { documentaryAgreementPresentation, indexDocumentaryDebt } from './documentaryDebtAging'
import { documentaryOverlayFixture, documentarySummaryFixture } from './documentaryDebtAging.test-fixtures'
vi.mock('../i18n/useI18n', () => ({ useI18n: () => ({ t: (value: string) => value }) }))

it('keeps business dates unchanged and distinguishes all unknown reasons', () => {
  const index = indexDocumentaryDebt({ DocumentaryDebtAging: documentaryOverlayFixture({ Agreements: [documentarySummaryFixture({
    UnknownDateDebtCount: 2, UnknownTermsDebtCount: 1, UnknownScopeDebtCount: 1, HasCompleteAging: false, OverdueTotal: null,
  })] }) })
  render(<DocumentaryDebtNotice presentation={documentaryAgreementPresentation(index, { ClientId: 7, AgreementId: 9 })} asOf="2026-10-25T00:00:00" />)
  const text = screen.getByRole('note').textContent
  expect(text).toContain('25.10.2026')
  expect(text).toContain('Без підтвердженої дати: 2')
  expect(text).toContain('Без строку оплати: 1')
  expect(text).toContain('Без підтвердженої належності: 1')
  expect(text).not.toContain('Строки боргу підтверджено')
})

describe('documentary loading distinction', () => {
  it('does not announce known zero for an absent overlay', () => {
    render(<DocumentaryDebtNotice presentation={documentaryAgreementPresentation(indexDocumentaryDebt({}), {})} />)
    expect(screen.queryByRole('note')).toBeNull()
  })
  it('marks present but missing exact summary unavailable', () => {
    render(<DocumentaryDebtNotice presentation={documentaryAgreementPresentation(indexDocumentaryDebt({ DocumentaryDebtAging: documentaryOverlayFixture() }), { ClientId: 8, AgreementId: 9 })} />)
    expect(screen.getByRole('note').textContent).toContain('Дані про строки боргу не визначено')
  })
})
