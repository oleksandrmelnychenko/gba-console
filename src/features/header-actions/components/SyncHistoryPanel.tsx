import { Badge, Box, Group, Loader, ScrollArea, SimpleGrid, Stack, Text, ThemeIcon } from '@mantine/core'
import { IconAlertCircle, IconClock, IconHistory } from '@tabler/icons-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getSyncTypeLabel } from '../syncHistoryLabels'
import type { SyncHistoryItem } from '../types'

type SyncHistoryPanelProps = {
  historyKind: 'daily' | 'entity'
  history: SyncHistoryItem[]
  isError: boolean
  isLoading: boolean
  isSyncing: boolean
  messages: string[]
  sourceLabel: string
}

type SyncHistoryRow = SyncHistoryItem & {
  key: string
}

type SyncMessageRow = {
  key: string
  message: string
}

const syncDateFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: '2-digit',
  second: '2-digit',
  year: 'numeric',
})

export function SyncHistoryPanel({
  history,
  historyKind,
  isError,
  isLoading,
  isSyncing,
  messages,
  sourceLabel,
}: SyncHistoryPanelProps) {
  const { t } = useI18n()
  const recentHistory = getRecentHistory(history)
  const latestHistoryItem = recentHistory[0]
  const latestDate = formatSyncDate(latestHistoryItem?.Date)
  const latestType = latestHistoryItem ? t(getSyncTypeLabel(latestHistoryItem.Type, historyKind)) : ''
  const latestMessages = getLatestMessages(messages)
  const statusColor = getStatusColor(isError, isSyncing, latestMessages.length > 0)
  const statusLabel = getStatusLabel({
    hasMessages: latestMessages.length > 0,
    isError,
    isSyncing,
    t,
  })
  const currentMessage = getCurrentMessage(latestMessages, isError, isSyncing, t)

  return (
    <Stack gap="sm" className={`sync-history-panel${isSyncing ? ' is-active' : ''}${isError ? ' is-error' : ''}`}>
      <Group justify="space-between" align="flex-start" gap="md" wrap="nowrap">
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon
            color={statusColor}
            variant={isSyncing || isError ? 'filled' : 'light'}
            radius={8}
            size={34}
          >
            <SyncStatusIcon isError={isError} isSyncing={isSyncing} />
          </ThemeIcon>
          <Box className="sync-status-heading">
            <Text fw={700} size="sm" lh={1.25}>
              {t('Процес синхронізації')}
            </Text>
            <Text size="xs" c="dimmed" className="sync-status-source">
              {sourceLabel}
            </Text>
          </Box>
        </Group>
        <Badge color={statusColor} variant="light">
          {statusLabel}
        </Badge>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
        <Box className="sync-status-card">
          <Text size="xs" c="dimmed" fw={700} className="sync-status-label">
            {t('Поточний стан')}
          </Text>
          <Text size="sm" fw={600} className="sync-status-value">
            {currentMessage}
          </Text>
        </Box>

        <Box className="sync-status-card">
          <Text size="xs" c="dimmed" fw={700} className="sync-status-label">
            {t('Остання зміна')}
          </Text>
          {isLoading ? (
            <Group gap="xs" className="sync-history-state">
              <Loader size="xs" color="violet" />
              <Text size="sm" c="dimmed">
                {t('Завантаження')}
              </Text>
            </Group>
          ) : (
            <>
              <Text size="sm" fw={600} className="sync-status-value">
                {latestType || t('Немає даних')}
              </Text>
              <Text size="xs" c="dimmed" className="sync-history-date">
                {latestDate || t('Синхронізація ще не запускалась')}
              </Text>
            </>
          )}
        </Box>
      </SimpleGrid>

      <Box className="sync-history-feed">
        <Group justify="space-between" mb={6} wrap="nowrap">
          <Text size="xs" c="dimmed" fw={700} className="sync-status-label">
            {t('Останні події')}
          </Text>
          <IconClock size={15} stroke={1.8} className="sync-history-clock" />
        </Group>
        {isLoading ? (
          <Group gap="xs" justify="center" className="sync-history-state">
            <Loader size="xs" color="violet" />
            <Text size="sm" c="dimmed">
              {t('Завантаження')}
            </Text>
          </Group>
        ) : recentHistory.length === 0 ? (
          <Text size="sm" c="dimmed" className="sync-history-state">
            {t('Історія синхронізації порожня')}
          </Text>
        ) : (
          <ScrollArea h={118} type="auto">
            <Stack gap={0} className="sync-history-list">
              {recentHistory.map((item) => (
                <Group
                  key={item.key}
                  gap="xs"
                  wrap="nowrap"
                  className="sync-history-row"
                >
                  <Text size="xs" className="sync-history-date">
                    {formatSyncDate(item.Date) || t('Немає даних')}
                  </Text>
                  <Text size="xs" fw={600} className="sync-history-type">
                    {t(getSyncTypeLabel(item.Type, historyKind))}
                  </Text>
                </Group>
              ))}
            </Stack>
          </ScrollArea>
        )}
      </Box>

      {latestMessages.length > 0 && (
        <Box className="sync-message-feed">
          <Text size="xs" c="dimmed" fw={700} mb={6} className="sync-status-label">
            {t('Останні повідомлення')}
          </Text>
          <Stack gap={3}>
            {latestMessages.map(({ key, message }) => (
              <Text key={key} size="xs" className="sync-message">
                {message}
              </Text>
            ))}
          </Stack>
        </Box>
      )}
    </Stack>
  )
}

function getCurrentMessage(
  messages: SyncMessageRow[],
  isError: boolean,
  isSyncing: boolean,
  t: (key: string) => string,
): string {
  if (messages[0]?.message) {
    return messages[0].message
  }

  if (isError) {
    return t('Помилка синку')
  }

  return isSyncing ? t('Очікуємо повідомлення від сервера') : t('Немає активної синхронізації')
}

function SyncStatusIcon({ isError, isSyncing }: { isError: boolean; isSyncing: boolean }) {
  if (isSyncing) {
    return <Loader color="white" size={14} type="oval" />
  }

  if (isError) {
    return <IconAlertCircle size={18} stroke={1.8} />
  }

  return <IconHistory size={18} stroke={1.8} />
}

function getStatusColor(isError: boolean, isSyncing: boolean, hasMessages: boolean): 'gray' | 'green' | 'red' | 'violet' {
  if (isError) {
    return 'red'
  }

  if (isSyncing) {
    return 'violet'
  }

  return hasMessages ? 'green' : 'gray'
}

function getStatusLabel({
  hasMessages,
  isError,
  isSyncing,
  t,
}: {
  hasMessages: boolean
  isError: boolean
  isSyncing: boolean
  t: (key: string) => string
}): string {
  if (isError) {
    return t('Помилка синку')
  }

  if (isSyncing) {
    return t('Виконується')
  }

  return hasMessages ? t('Готово') : t('Очікує запуску')
}

function getRecentHistory(history: SyncHistoryItem[]): SyncHistoryRow[] {
  const occurrences = new Map<string, number>()

  return history
    .map((item) => {
      const keyBase = getHistoryItemKey(item)
      const occurrence = occurrences.get(keyBase) ?? 0
      occurrences.set(keyBase, occurrence + 1)

      return {
        ...item,
        key: `${keyBase}:${occurrence}`,
      }
    })
    .toSorted((first, second) => getDateTime(second.Date) - getDateTime(first.Date))
    .slice(0, 10)
}

function getLatestMessages(messages: string[]): SyncMessageRow[] {
  const occurrences = new Map<string, number>()
  const latestMessages: SyncMessageRow[] = []

  for (const message of messages) {
    if (message.trim().length === 0) {
      continue
    }

    const keyBase = getMessageKey(message)
    const occurrence = occurrences.get(keyBase) ?? 0
    occurrences.set(keyBase, occurrence + 1)
    latestMessages.push({
      key: `${keyBase}:${occurrence}`,
      message,
    })

    if (latestMessages.length === 4) {
      break
    }
  }

  return latestMessages
}

function formatSyncDate(value?: string | Date): string {
  if (!value) {
    return ''
  }

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? '' : syncDateFormatter.format(date)
}

function getDateTime(value?: string | Date): number {
  if (!value) {
    return 0
  }

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

function getHistoryItemKey(item: SyncHistoryItem): string {
  return `${getDateKey(item.Date)}:${item.Type ?? 'unknown'}`
}

function getDateKey(value?: string | Date): string {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? 'invalid-date' : value.toISOString()
  }

  return value?.trim() || 'no-date'
}

function getMessageKey(message: string): string {
  let hash = 0

  for (let index = 0; index < message.length; index += 1) {
    hash = (hash * 31 + message.charCodeAt(index)) | 0
  }

  return `${message.length}:${hash.toString(36)}`
}
