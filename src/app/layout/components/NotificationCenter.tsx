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
import { Bell, CheckCheck, ChevronRight, Heart, ShoppingCart, Sparkles, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useConsoleNotificationCenter } from '../../../shared/notification-center/store'
import type { ConsoleNotification } from '../../../shared/notification-center/types'
import { TableChip } from '../../../shared/ui/TableChip'
import { NotificationProducts } from './NotificationProducts'

type NotificationCenterProps = {
  userKey?: string
}

const notificationDateFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  month: '2-digit',
})

const notificationClockFormatter = new Intl.DateTimeFormat('uk-UA', {
  hour: '2-digit',
  minute: '2-digit',
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
      offset={10}
      shadow="sm"
      width={420}
      withinPortal
    >
      <Popover.Target>
        <ActionIcon
          aria-label={bellLabel}
          className="console-header-action console-notification-trigger"
          color="gray"
          data-opened={opened || undefined}
          size="lg"
          title={t('Сповіщення')}
          variant="subtle"
          onClick={() => setOpened((current) => !current)}
        >
          <Indicator
            color="orange"
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
          <Group className="console-notification-heading" wrap="nowrap">
            <Box className="console-notification-heading-copy">
              <Text className="console-notification-title">{t('Сповіщення')}</Text>
              {unreadCount > 0 ? (
                <TableChip tone="document" value={unreadCount} title={`${unreadCount} ${t('непрочитаних')}`} />
              ) : (
                <Text className="console-notification-subtitle">{t('Усе переглянуто')}</Text>
              )}
            </Box>
          </Group>

          <Group className="console-notification-header-actions" gap={6} wrap="nowrap">
            <Tooltip label={t('Позначити все прочитаним')}>
              <ActionIcon
                aria-label={t('Позначити все прочитаним')}
                className="console-notification-header-action"
                disabled={unreadCount === 0}
                size={30}
                variant="subtle"
                onClick={markAllRead}
              >
                <CheckCheck size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Очистити сповіщення')}>
              <ActionIcon
                aria-label={t('Очистити сповіщення')}
                className="console-notification-header-action"
                disabled={items.length === 0}
                size={30}
                variant="subtle"
                onClick={clear}
              >
                <Trash2 size={15} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        {items.length === 0 ? (
          <Box className="console-notification-empty">
            <Box className="console-notification-empty-icon" aria-hidden="true">
              <Bell size={20} strokeWidth={1.6} />
            </Box>
            <Text c="dimmed" size="sm">{t('Нових сповіщень немає')}</Text>
          </Box>
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
                    <Group className="console-notification-item-heading" gap={8} justify="space-between" wrap="nowrap">
                      <Text className="console-notification-item-title">
                        {notification.title}
                      </Text>
                    </Group>
                    <Text className="console-notification-time" component="time" dateTime={notification.createdAt}>
                      {formatNotificationTime(notification.createdAt)}
                    </Text>
                    <Box className="console-notification-message">
                      {renderNotificationMessage(notification)}
                    </Box>
                  </Box>
                  <ChevronRight
                    aria-hidden="true"
                    className="console-notification-chevron"
                    size={16}
                    strokeWidth={1.7}
                  />
                  {notification.kind === 'ecommerce-order' && notification.entityNetUid ? (
                    <NotificationProducts saleNetUid={notification.entityNetUid} />
                  ) : null}
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
  return Number.isNaN(date.getTime())
    ? ''
    : `${notificationDateFormatter.format(date)} ${notificationClockFormatter.format(date)}`
}

function renderNotificationMessage(notification: ConsoleNotification) {
  const parts = notification.message.split(' · ')

  return parts.map((part, index) => {
    const isCommerceMetadata = notification.kind === 'ecommerce-order'
      || notification.kind === 'ecommerce-interest'
    const isReference = isCommerceMetadata && index === 0
    const isClient = isCommerceMetadata && index === 1
    const isAmount = notification.kind === 'ecommerce-order' && /\d[\d\s.,]*\s[A-Z]{3}$/.test(part)
    const isPositions = notification.kind === 'ecommerce-order' && /^\d+\s+поз\.?$/i.test(part.trim())
    const isQuantity = notification.kind === 'ecommerce-interest' && /^\d+(?:[.,]\d+)?\s+шт\.?$/i.test(part.trim())
    const amount = isAmount ? part.match(/^(.*)\s([A-Z]{3})$/) : null
    return (
      <span
        key={`${notification.id}-message-${index}`}
        className={isClient ? 'console-notification-client' : amount ? 'console-notification-amount' : undefined}
      >
        {isReference ? (
          <TableChip tone={notification.kind === 'ecommerce-interest' ? 'product' : 'document'} value={part} />
        ) : isPositions || isQuantity ? (
          <TableChip tone="document" value={part} />
        ) : amount ? (
          <><strong>{amount[1]}</strong><TableChip tone="source" value={amount[2]} /></>
        ) : part}
      </span>
    )
  })
}

function getNotificationIcon(kind: ConsoleNotification['kind']) {
  if (kind === 'ecommerce-ai-image-search') {
    return <Sparkles size={15} strokeWidth={1.8} />
  }

  if (kind === 'ecommerce-interest') {
    return <Heart size={15} strokeWidth={1.8} />
  }

  return <ShoppingCart size={15} strokeWidth={1.8} />
}
