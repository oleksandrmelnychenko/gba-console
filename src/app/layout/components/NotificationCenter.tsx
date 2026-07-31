import {
  ActionIcon,
  Box,
  Group,
  Indicator,
  Popover,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core'
import { Bell, CheckCheck, Heart, ShoppingCart, Sparkles, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useConsoleNotificationCenter } from '../../../shared/notification-center/store'
import type { ConsoleNotification } from '../../../shared/notification-center/types'

type NotificationCenterProps = {
  userKey?: string
}

const notificationTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: '2-digit',
})

export function NotificationCenter({ userKey }: NotificationCenterProps) {
  const [opened, setOpened] = useState(false)
  const navigate = useNavigate()
  const { t } = useI18n()
  const { clear, items, markAllRead, markRead, unreadCount } = useConsoleNotificationCenter(userKey)
  const unreadLabel = unreadCount > 99 ? '99+' : String(unreadCount)
  const bellLabel = unreadCount > 0
    ? `${t('Сповіщення')}: ${unreadCount} ${t('непрочитаних')}`
    : t('Сповіщення')

  function openNotification(notification: ConsoleNotification) {
    markRead(notification.id)
    setOpened(false)

    if (notification.route) {
      navigate(notification.route)
    }
  }

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-end"
      shadow="md"
      width={390}
      withinPortal
    >
      <Popover.Target>
        <ActionIcon
          aria-label={bellLabel}
          className="console-header-action console-notification-trigger"
          color="gray"
          size="lg"
          title={t('Сповіщення')}
          variant="subtle"
          onClick={() => setOpened((current) => !current)}
        >
          <Indicator
            color="red"
            disabled={unreadCount === 0}
            label={unreadLabel}
            offset={3}
            size={17}
          >
            <Bell size={24} strokeWidth={1.7} />
          </Indicator>
        </ActionIcon>
      </Popover.Target>

      <Popover.Dropdown className="console-notification-dropdown" p={0}>
        <Group className="console-notification-header" justify="space-between" wrap="nowrap">
          <Box>
            <Text fw={700} size="sm">{t('Сповіщення')}</Text>
            <Text c="dimmed" size="xs">
              {unreadCount > 0 ? `${unreadCount} ${t('непрочитаних')}` : t('Усе переглянуто')}
            </Text>
          </Box>

          <Group gap={4} wrap="nowrap">
            <Tooltip label={t('Позначити все прочитаним')}>
              <ActionIcon
                aria-label={t('Позначити все прочитаним')}
                color="gray"
                disabled={unreadCount === 0}
                size="sm"
                variant="subtle"
                onClick={markAllRead}
              >
                <CheckCheck size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Очистити сповіщення')}>
              <ActionIcon
                aria-label={t('Очистити сповіщення')}
                color="gray"
                disabled={items.length === 0}
                size="sm"
                variant="subtle"
                onClick={clear}
              >
                <Trash2 size={15} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        {items.length === 0 ? (
          <Stack align="center" className="console-notification-empty" gap={6}>
            <Bell aria-hidden="true" size={22} strokeWidth={1.5} />
            <Text c="dimmed" size="sm">{t('Нових сповіщень немає')}</Text>
          </Stack>
        ) : (
          <ScrollArea.Autosize mah={420} type="auto">
            <Stack gap={0}>
              {items.map((notification) => (
                <UnstyledButton
                  key={notification.id}
                  className={`console-notification-item${notification.readAt ? '' : ' is-unread'}`}
                  onClick={() => openNotification(notification)}
                >
                  <Box
                    className={`console-notification-icon is-${notification.kind}`}
                    aria-hidden="true"
                  >
                    {getNotificationIcon(notification.kind)}
                  </Box>
                  <Box className="console-notification-copy">
                    <Group gap="xs" justify="space-between" wrap="nowrap">
                      <Text fw={notification.readAt ? 600 : 700} size="sm">
                        {notification.title}
                      </Text>
                      <Text c="dimmed" className="console-notification-time" size="xs">
                        {formatNotificationTime(notification.createdAt)}
                      </Text>
                    </Group>
                    {notification.message ? (
                      <Text c="dimmed" className="console-notification-message" size="xs">
                        {notification.message}
                      </Text>
                    ) : null}
                  </Box>
                </UnstyledButton>
              ))}
            </Stack>
          </ScrollArea.Autosize>
        )}
      </Popover.Dropdown>
    </Popover>
  )
}

function formatNotificationTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : notificationTimeFormatter.format(date)
}

function getNotificationIcon(kind: ConsoleNotification['kind']) {
  if (kind === 'ecommerce-ai-image-search') {
    return <Sparkles size={17} strokeWidth={1.8} />
  }

  if (kind === 'ecommerce-interest') {
    return <Heart size={17} strokeWidth={1.8} />
  }

  return <ShoppingCart size={17} strokeWidth={1.8} />
}
