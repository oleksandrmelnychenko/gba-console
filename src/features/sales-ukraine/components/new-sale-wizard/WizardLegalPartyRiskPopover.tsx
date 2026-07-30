import { Box, Group, Popover, Stack, Text } from '@mantine/core'
import { TriangleAlert } from 'lucide-react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import type { ClientLegalPartySalesRiskSummary } from '../../../clients/types'
import { getLegalPartyRiskLabel } from './wizardLegalPartyRisk'

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})

export function WizardLegalPartyRiskPopover({
  risk,
}: {
  risk: ClientLegalPartySalesRiskSummary
}) {
  const { t } = useI18n()
  const isCritical = risk.HasOverdueDebt || risk.HasBlockedClient

  return (
    <Popover position="bottom-start" shadow="md" width={430} withinPortal>
      <Popover.Target>
        <Box
          aria-label={t('Ризик юридичної особи')}
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
              {t('Ризик по юридичній особі')}
            </Text>
            <Text c="dimmed" size="xs">
              {risk.NormalizedUsreou
                ? `${t('ЄДРПОУ')} ${risk.NormalizedUsreou}`
                : t('Немає надійного ідентифікатора для об’єднання')}
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
          {risk.HasDuplicates && (
            <Box>
              <Text fw={700} size="xs">
                {t('Пов’язані картки клієнта')}: {risk.DuplicateClientCount}
              </Text>
              {risk.Clients.map((item) => (
                <Text c={item.IsBlocked ? 'red' : 'dimmed'} key={item.ClientNetUid} size="xs">
                  {item.FullName || item.ClientNumber || item.ClientNetUid}
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
