import { Box, Group, Popover, Stack, Text } from '@mantine/core'
import { TriangleAlert } from 'lucide-react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import type { ClientIdentityAttentionSummary } from '../../../clients/types'
import { getLegalPartyRiskLabel } from './wizardLegalPartyRisk'

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})

export function WizardLegalPartyRiskPopover({
  risk,
}: {
  risk: ClientIdentityAttentionSummary
}) {
  const { t } = useI18n()
  const isCritical = risk.AttentionLevel === 'critical'

  return (
    <Popover position="bottom-start" shadow="md" width={430} withinPortal>
      <Popover.Target>
        <Box
          aria-label={t('Дані клієнта потребують уваги')}
          className={`new-sale-client-hero__legal-risk ${isCritical ? 'is-critical' : 'is-warning'}`}
          component="button"
          type="button"
        >
          <TriangleAlert size={12} />
          {getLegalPartyRiskLabel(risk, t)}
        </Box>
      </Popover.Target>
      <Popover.Dropdown className="new-sale-client-legal-risk">
        <Stack gap={10}>
          <Box>
            <Text fw={700} size="sm">
              {t('Що потребує уваги')}
            </Text>
            <Text c="dimmed" size="xs">
              {getLegalCodeDescription(risk, t)}
            </Text>
          </Box>
          {risk.OverdueByCurrency.map((currency) => (
            <Group
              justify="space-between"
              key={`${currency.CurrencyNetUid || currency.CurrencyId || 'none'}:${currency.CurrencyCode || 'unknown'}`}
            >
              <Text size="sm">
                {t('Прострочено')} · {currency.MaxOverdueDays} {t('дн.')}
              </Text>
              <Text fw={700} size="sm">
                {moneyFormatter.format(currency.OverdueAmount)}{' '}
                {currency.CurrencyCode || t('валюта не вказана')}
              </Text>
            </Group>
          ))}
          {risk.AttentionReasons.length > 0 && (
            <Stack gap={3}>
              {risk.AttentionReasons.map((reason) => (
                <Text key={reason} size="xs">
                  {getAttentionReasonLabel(reason, t)}
                </Text>
              ))}
            </Stack>
          )}
          {risk.Candidates.length > 1 && (
            <Box>
              <Text fw={700} size="xs">
                {t('Картки для перевірки')}: {risk.Candidates.length}
              </Text>
              {risk.Candidates.map((item) => (
                <Text c={item.IsBlocked ? 'red' : 'dimmed'} key={item.ClientNetUid} size="xs">
                  {item.FullName || item.ClientNumber || item.ClientNetUid}
                  {item.RoleName ? ` · ${item.RoleName}` : ''}
                  {item.HasOwnOverdueDebt ? ` · ${t('є прострочення')}` : ''}
                  {item.IsBlocked ? ` · ${t('заблоковано')}` : ''}
                </Text>
              ))}
            </Box>
          )}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  )
}

function getLegalCodeDescription(
  risk: ClientIdentityAttentionSummary,
  t: (value: string) => string,
): string {
  if (risk.NormalizedLegalCode) {
    return `${t('ЄДРПОУ / ІПН')} ${risk.NormalizedLegalCode}`
  }

  return risk.LegalCodeQuality === 'invalid'
    ? t('ЄДРПОУ / ІПН заповнений некоректно')
    : t('Немає надійного ЄДРПОУ / ІПН')
}

function getAttentionReasonLabel(
  reason: string,
  t: (value: string) => string,
): string {
  const labels: Record<string, string> = {
    invalid_legal_code: 'ЄДРПОУ / ІПН має некоректний формат',
    missing_legal_code: 'Для активного договору не заповнений ЄДРПОУ / ІПН',
    missing_manager: 'Не визначено відповідального менеджера з даних 1С',
    multiple_buyer_cards: 'Знайдено кілька карток покупця',
    own_blocked_card: 'Поточна картка клієнта заблокована',
    own_overdue_debt: 'У поточній картці є прострочений борг',
    related_blocked_card: 'Одна з пов’язаних карток заблокована',
    related_overdue_debt: 'У групі карток є прострочений борг',
    suspicious_shared_code: 'Код використовується у підозріло великій кількості карток',
  }

  return t(labels[reason] || reason)
}
