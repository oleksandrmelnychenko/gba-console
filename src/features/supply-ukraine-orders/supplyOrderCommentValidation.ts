import type { TranslateFunction } from '../../shared/i18n/types'

export const SUPPLY_ORDER_COMMENT_MAX_LENGTH = 500

export function getSupplyOrderCommentValidationError(
  comment: string | null | undefined,
  t: TranslateFunction,
): string | null {
  if ((comment?.trim().length || 0) <= SUPPLY_ORDER_COMMENT_MAX_LENGTH) {
    return null
  }

  return t('Коментар: не більше {count} символів', {
    count: SUPPLY_ORDER_COMMENT_MAX_LENGTH,
  })
}
