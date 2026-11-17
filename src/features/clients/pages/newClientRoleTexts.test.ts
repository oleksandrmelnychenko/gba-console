import { describe, expect, it } from 'vitest'
import { newClientRoleTexts } from './newClientRoleTexts'

const t = (value: string) => value

describe('newClientRoleTexts', () => {
  it('speaks about a supplier in the supplier wizard', () => {
    const texts = newClientRoleTexts(true, t)
    expect(texts.nameRequired).toBe('Вкажіть назву постачальника')
    expect(texts.created).toBe('Постачальника створено')
    expect(texts.createDisabledReason).toContain('типом цін постачальника')
  })

  it('keeps the client wording for buyers', () => {
    expect(newClientRoleTexts(false, t).created).toBe('Клієнта створено')
  })
})
