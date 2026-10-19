import { Box, Group, Popover, Stack, Text } from '@mantine/core'
import { TriangleAlert } from 'lucide-react'
import { TableChip } from '../../../../shared/ui/TableChip'
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
    <Popover position="bottom-start" shadow="md" width={360} withinPortal>
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
      <Popover.Dropdown className={`new-sale-client-legal-risk ${isCritical ? 'is-critical' : 'is-warning'}`}>
        <Stack gap={10}>
          <Box className="new-sale-client-legal-risk__header">
            <Group gap={7} wrap="nowrap">
              <TriangleAlert size={16} aria-hidden="true" />
              <Text className="new-sale-client-legal-risk__title">{t('Що потребує уваги')}</Text>
            </Group>
            <TableChip tone={risk.NormalizedLegalCode ? 'neutral' : 'warning'} value={getLegalCodeDescription(risk, t)} />
          </Box>
          {risk.OverdueByCurrency.map((currency) => (
            <Group
              className="new-sale-client-legal-risk__overdue"
              justify="space-between"
              key={`${currency.CurrencyNetUid || currency.CurrencyId || 'none'}:${currency.CurrencyCode || 'unknown'}`}
            >
              <Text size="sm">
                {t('Прострочено')} · {currency.MaxOverdueDays} {t('дн.')}
              </Text>
              <Text className="app-money" fw={700} size="sm">
                {moneyFormatter.format(currency.OverdueAmount)}{' '}
                <TableChip tone="source" value={currency.CurrencyCode || t('валюта не вказана')} />
              </Text>
            </Group>
          ))}
          {risk.AttentionReasons.length > 0 && (
            <Box component="ul" className="new-sale-client-legal-risk__reasons">
              {risk.AttentionReasons.map((reason) => (
                <Box component="li" key={reason}>
                  <span className="new-sale-client-legal-risk__bullet" aria-hidden="true" />
                  <Text>{getAttentionReasonLabel(reason, t)}</Text>
                </Box>
              ))}
            </Box>
          )}
          {risk.Candidates.length > 1 && (
            <Box className="new-sale-client-legal-risk__candidates">
              <Group gap={6}>
                <Text className="new-sale-client-legal-risk__section-title">{t('Картки для перевірки')}</Text>
                <TableChip value={risk.Candidates.length} />
              </Group>
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
