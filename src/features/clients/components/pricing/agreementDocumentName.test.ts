import { describe, expect, it } from 'vitest'
import { agreementDocumentFileBaseName, agreementDocumentTitle } from './agreementDocumentName'

describe('agreement document naming', () => {
  it('titles and names the warranty export apart from the contract', () => {
    expect(agreementDocumentTitle('warranty')).toBe('Друк гарантійних умов')
    expect(agreementDocumentTitle('contract')).toBe('Друк договору')
    expect(agreementDocumentFileBaseName('warranty', 'QA Договір №5')).toBe('Гарантійні_умови_QA_Договір_5')
    expect(agreementDocumentFileBaseName('contract', '')).toBe('Договір')
  })
})
