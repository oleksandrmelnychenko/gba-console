import type { ClientIdentityAttentionSummary } from './types'

type TranslateAttentionText = (value: string) => string

export function getClientIdentityAttentionTitle(
  attention: ClientIdentityAttentionSummary,
  t: TranslateAttentionText,
): string {
  if (attention.HasOwnOverdueDebt) {
    return `${t('Є прострочений борг')} · ${attention.OwnMaxOverdueDays} ${t('дн.')}`
  }

  if (attention.HasRelatedOverdueDebt) {
    return `${t('Прострочення в іншій картці')} · ${attention.RelatedMaxOverdueDays} ${t('дн.')}`
  }

  if (attention.IsTargetBlocked) {
    return t('Картку клієнта заблоковано')
  }

  if (attention.HasRelatedBlockedCard) {
    return t('Заблоковано іншу пов’язану картку')
  }

  if (attention.RequiresReview) {
    return t('Потрібно перевірити зв’язок карток')
  }

  if (attention.LegalCodeQuality === 'invalid') {
    return t('ЄДРПОУ / ІПН заповнений некоректно')
  }

  return t('Дані клієнта потребують уваги')
}

export function getClientIdentityAttentionMessage(
  attention: ClientIdentityAttentionSummary,
  t: TranslateAttentionText,
): string {
  if (attention.HasOwnOverdueDebt) {
    const debtMessage = t('Це повідомлення стосується простроченої заборгованості, а не відсутніх реквізитів. Перевірте борг і умови договору у «Платоспроможність».')
    const relatedDebtMessage = attention.HasRelatedOverdueDebt
      ? ` ${t('В іншій картці структури також є прострочення. Перевірте її у «Структура клієнта».')}`
      : ''

    if (attention.LegalCodeQuality === 'missing' || attention.LegalCodeQuality === 'invalid') {
      return `${debtMessage}${relatedDebtMessage} ${t('Окремо перевірте ЄДРПОУ / ІПН: код відсутній або некоректний.')}`
    }

    return `${debtMessage}${relatedDebtMessage}`
  }

  if (attention.HasRelatedOverdueDebt) {
    return t('Прострочений борг є в іншій картці цієї структури. Відкрийте «Структура клієнта» або «Платоспроможність», щоб побачити джерело боргу.')
  }

  if (attention.IsTargetBlocked) {
    return t('Картку заблоковано для фінансових операцій. Перевірте причину блокування та кредитні умови у «Платоспроможність».')
  }

  if (attention.RequiresReview) {
    return attention.Candidates.length > 1
      ? `${t('Знайдено карток')}: ${attention.Candidates.length}. ${t('Перевірте зв’язки у «Структура клієнта» перед зміною основної картки.')}`
      : t('Перевірте зв’язок з основною карткою у «Структура клієнта».')
  }

  if (attention.LegalCodeQuality === 'missing') {
    return t('ЄДРПОУ / ІПН не заповнений. Додайте код або перевірте сирі дані у «Дані 1С».')
  }

  if (attention.LegalCodeQuality === 'invalid') {
    return t('ЄДРПОУ / ІПН має некоректний формат. Перевірте код і реквізити клієнта.')
  }

  if (attention.Candidates.length > 1) {
    return `${t('Знайдено карток')}: ${attention.Candidates.length}. ${t('Перевірте ролі, контакти та фінансові дані перед зміною клієнта.')}`
  }

  return t('Перегляньте позначені дані клієнта.')
}
