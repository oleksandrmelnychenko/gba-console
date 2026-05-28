import { Accordion, Group, Loader, ScrollArea, Stack, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { TranslationKey } from '../../../shared/i18n/types'
import type { SyncHistoryItem } from '../types'

type SyncHistoryPanelProps = {
  history: SyncHistoryItem[]
  isLoading: boolean
}

const syncDateFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: '2-digit',
  second: '2-digit',
  year: 'numeric',
})

const syncTypeLabels: Record<number, TranslationKey> = {
  0: 'Товари',
  1: 'Клієнти',
  2: 'Залишки',
  3: 'Взаєморозрахунки',
  4: 'Грошові рахунки',
  5: 'Прибуткові документи',
  6: 'Видаткові документи',
}

export function SyncHistoryPanel({ history, isLoading }: SyncHistoryPanelProps) {
  const { t } = useI18n()
  const latestDate = history[0]?.Date ? formatSyncDate(history[0].Date) : ''

  return (
    <Accordion variant="contained" defaultValue="history" className="sync-history-panel">
      <Accordion.Item value="history">
        <Accordion.Control>
          {t('Остання зміна')}
          {latestDate ? ` ${latestDate}` : ''}
        </Accordion.Control>
        <Accordion.Panel>
          {isLoading && (
            <Group gap="xs" justify="center" className="sync-history-state">
              <Loader size="xs" color="violet" />
              <Text size="sm" c="dimmed">
                {t('Завантаження')}
              </Text>
            </Group>
          )}

          {!isLoading && history.length === 0 && (
            <Text size="sm" c="dimmed" className="sync-history-state">
              {t('Історія синхронізації порожня')}
            </Text>
          )}

          {!isLoading && history.length > 0 && (
            <ScrollArea h={138} type="auto">
              <Stack gap={4} className="sync-history-list">
                {history.map((item) => (
                  <Group key={`${item.Date || 'date'}-${item.Type || 0}`} gap="xs" wrap="nowrap" className="sync-history-row">
                    <Text size="xs" className="sync-history-date">
                      {formatSyncDate(item.Date)}
                    </Text>
                    <Text size="xs" fw={600} className="sync-history-type">
                      {t(getSyncTypeLabel(item.Type))}
                    </Text>
                  </Group>
                ))}
              </Stack>
            </ScrollArea>
          )}
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  )
}

function getSyncTypeLabel(type?: number): TranslationKey {
  return typeof type === 'number' ? syncTypeLabels[type] || 'Невідомий тип' : 'Невідомий тип'
}

function formatSyncDate(value?: string | Date): string {
  if (!value) {
    return ''
  }

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? '' : syncDateFormatter.format(date)
}
