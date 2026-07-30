import { Box, Group, Popover, Stack, Text } from '@mantine/core'
import { useI18n } from '../../../../shared/i18n/useI18n'
import type { ClientAgreement } from '../../../clients/types'
import { WizardAgreementItem } from './WizardAgreementItem'

const metricCountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 0,
})

export function WizardClientAgreementsPopover({
  activeAgreementNetId,
  agreements,
}: {
  activeAgreementNetId?: string | null
  agreements: ClientAgreement[]
}) {
  const { t } = useI18n()

  return (
    <Popover position="bottom-end" shadow="md" width={500} withinPortal>
      <Popover.Target>
        <Box
          aria-label={t('Договори')}
          className="new-sale-client-metric is-clickable"
          component="button"
          type="button"
        >
          <strong>{metricCountFormatter.format(agreements.length)}</strong>
          <span>{t('Договори')}</span>
        </Box>
      </Popover.Target>
      <Popover.Dropdown className="new-sale-hero-agreements-dropdown">
        <Group
          className="new-sale-hero-agreements-dropdown__head"
          justify="space-between"
          wrap="nowrap"
        >
          <Text className="new-sale-hero-agreements-dropdown__title">
            {t('Договори')}
          </Text>
          <span>{agreements.length}</span>
        </Group>
        <Stack className="new-sale-hero-agreements-dropdown__list" gap={7}>
          {agreements.map((item) => {
            const key = getHeroAgreementKey(item)

            return (
              <WizardAgreementItem
                key={key}
                clientAgreement={item}
                selected={Boolean(activeAgreementNetId) && key === activeAgreementNetId}
              />
            )
          })}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  )
}

function getHeroAgreementKey(agreement: ClientAgreement): string {
  return String(
    agreement.NetUid ||
      agreement.Id ||
      agreement.AgreementId ||
      agreement.Agreement?.NetUid ||
      agreement.Agreement?.Id,
  )
}
