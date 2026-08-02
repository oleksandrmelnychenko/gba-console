import type { ClientIdentityAttentionSummary } from '../../../clients/types'

export function getLegalPartyRiskLabel(
  risk: ClientIdentityAttentionSummary,
  t: (value: string) => string,
): string {
  if (risk.HasRelatedOverdueDebt) {
    return `${t('Прострочення в іншій картці')} · ${risk.MaxOverdueDays} ${t('дн.')}`
  }

  if (risk.HasOwnOverdueDebt) {
    return `${t('Є прострочений борг')} · ${risk.MaxOverdueDays} ${t('дн.')}`
  }

  if (risk.IsTargetBlocked) {
    return t('Картку клієнта заблоковано')
  }

  if (risk.HasRelatedBlockedCard) {
    return t('Заблоковано іншу пов’язану картку')
  }

  if (risk.RequiresReview) {
    return t('Потрібно перевірити зв’язок карток')
  }

  if (risk.LegalCodeQuality === 'invalid') {
    return t('Некоректний ЄДРПОУ / ІПН')
  }

  if (risk.LegalCodeQuality === 'missing') {
    return t('Не заповнений ЄДРПОУ / ІПН')
  }

  return `${t('Пов’язані картки')} · ${risk.RelatedCardCount}`
}
