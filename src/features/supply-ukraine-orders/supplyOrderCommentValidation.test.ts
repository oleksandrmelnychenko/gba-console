import { describe, expect, it } from 'vitest'
import { translate } from '../../shared/i18n/translate'
import {
  getSupplyOrderCommentValidationError,
  SUPPLY_ORDER_COMMENT_MAX_LENGTH,
} from './supplyOrderCommentValidation'

describe('supply order comment validation', () => {
  it('rejects the database-truncation scenario with a short user-facing message', () => {
    expect(getSupplyOrderCommentValidationError(
      '2'.repeat(SUPPLY_ORDER_COMMENT_MAX_LENGTH + 1),
      translate,
    )).toBe('Коментар: не більше 500 символів')
  })

  it('accepts the exact database boundary after payload normalization', () => {
    expect(getSupplyOrderCommentValidationError(
      `  ${'2'.repeat(SUPPLY_ORDER_COMMENT_MAX_LENGTH)}  `,
      translate,
    )).toBeNull()
  })
})
