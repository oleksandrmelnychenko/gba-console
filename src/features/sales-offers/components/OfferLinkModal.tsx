import { ActionIcon, Anchor, Button, Group, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { Copy, ExternalLink } from 'lucide-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { getPublicOfferLink } from '../api/salesOffersApi'
import type { ClientShoppingCart } from '../types'

const validUntilFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short' })

export function OfferLinkModal({
  offer,
  onClose,
}: {
  offer: ClientShoppingCart | null
  onClose: () => void
}) {
  const { t } = useI18n()
  const link = offer?.NetUid ? getPublicOfferLink(offer.NetUid) : ''
  const validUntil = formatValidUntil(offer?.ValidUntil)

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      notifications.show({ color: 'green', message: t('Посилання скопійовано') })
    } catch {
      notifications.show({ color: 'red', message: t('Не вдалося скопіювати посилання') })
    }
  }

  return (
    <AppModal
      opened={Boolean(offer)}
      title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Оферту створено')}</span>}
      onClose={onClose}
    >
      <Stack gap="md">
        <Stack gap={4}>
          {offer?.Number && (
            <Text size="sm">
              {t('Номер оферти')}: <strong>{offer.Number}</strong>
            </Text>
          )}
          {validUntil && (
            <Text c="dimmed" size="xs">
              {t('Дійсна до')}: {validUntil}
            </Text>
          )}
        </Stack>

        <Group align="flex-end" gap="xs" wrap="nowrap">
          <TextInput label={t('Посилання для клієнта')} readOnly style={{ flex: 1 }} value={link} />
          <Tooltip label={t('Скопіювати')}>
            <ActionIcon aria-label={t('Скопіювати')} size={36} variant="light" onClick={copyLink}>
              <Copy size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t('Відкрити')}>
            <ActionIcon
              aria-label={t('Відкрити')}
              component="a"
              href={link}
              rel="noreferrer"
              size={36}
              target="_blank"
              variant="light"
            >
              <ExternalLink size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>

        <Text c="dimmed" size="xs">
          {t('Пропозиція також зʼявиться у кабінеті клієнта в інтернет-магазині — розділ «Пропозиції» — після входу.')}
        </Text>

        <Group justify="space-between">
          <Anchor href="/sales/ukraine/offers" size="xs">
            {t('Всі оферти')}
          </Anchor>
          <Button color="gray" variant="light" onClick={onClose}>
            {t('Закрити')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function formatValidUntil(value: Date | string | undefined): string | null {
  if (!value) {
    return null
  }

  const parsed = value instanceof Date ? value : new Date(value)

  return Number.isNaN(parsed.getTime()) ? null : validUntilFormatter.format(parsed)
}
