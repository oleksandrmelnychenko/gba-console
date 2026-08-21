import { Box, Text, UnstyledButton } from '@mantine/core'
import { ChevronRight } from 'lucide-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getClientFolderChildren, getClientRegionCode, getClientStableKey } from '../clientFolder'
import type { Client } from '../types'
import './client-folder-children.css'

export function ClientFolderChildren({
  client,
  onSelect,
}: {
  client: Client
  onSelect: (client: Client) => void
}) {
  const { t } = useI18n()
  const folderCode = getClientRegionCode(client)
  const children = getClientFolderChildren(client)

  if (children.length === 0) {
    return (
      <Text className="client-folder-children__empty" c="dimmed" size="sm">
        {t('У папці немає пов’язаних клієнтів')}
      </Text>
    )
  }

  return (
    <Box
      aria-label={`${t('Клієнти папки')} ${folderCode}`.trim()}
      className="client-folder-children"
      component="ul"
    >
      {children.map((child) => {
        const code = getClientRegionCode(child)
        const name = getClientName(child, t)
        const role = child.ClientInRole?.ClientTypeRole?.Name?.trim()
        const isActive = child.IsActive !== false

        return (
          <li className="client-folder-children__item" key={getClientStableKey(child)}>
            <UnstyledButton
              aria-label={[code, name].filter(Boolean).join(' · ')}
              className="client-folder-children__button"
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onSelect(child)
              }}
            >
              <span
                aria-hidden="true"
                className={isActive ? 'app-status-dot is-active' : 'app-status-dot is-inactive'}
              />
              <span className="client-folder-children__identity">
                {code ? <span className="client-folder-children__code">{code}</span> : null}
                <span className="client-folder-children__name">{name}</span>
              </span>
              {role ? <span className="client-folder-children__role">{role}</span> : null}
              <ChevronRight aria-hidden="true" className="client-folder-children__chevron" size={15} />
            </UnstyledButton>
          </li>
        )
      })}
    </Box>
  )
}

function getClientName(client: Client, t: (value: string) => string): string {
  return client.FullName?.trim()
    || client.Name?.trim()
    || [client.LastName, client.FirstName, client.MiddleName].filter(Boolean).join(' ').trim()
    || t('Без назви')
}
