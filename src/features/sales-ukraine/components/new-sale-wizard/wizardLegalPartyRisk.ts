import type { ClientLegalPartySalesRiskSummary } from '../../../clients/types'

export function getLegalPartyRiskLabel(
  risk: ClientLegalPartySalesRiskSummary,
  t: (value: string) => string,
): string {
  if (risk.HasOverdueDebt) {
    return `${t('Прострочено по юрособі')} · ${risk.MaxOverdueDays} ${t('дн.')}`
  }

  if (risk.HasBlockedClient) {
    return t('Заблокована пов’язана картка')
  }

  return `${t('Можливий дубль')} · ${risk.DuplicateClientCount}`
}
