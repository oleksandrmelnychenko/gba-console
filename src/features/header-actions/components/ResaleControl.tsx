import { ActionIcon, Tooltip } from '@mantine/core'
import { ClipboardList } from 'lucide-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useGuardedNavigate } from '../../../shared/router/navigationGuard'

/** Header shortcut to the Resale screen (/resales). */
export function ResaleControl() {
  const { t } = useI18n()
  const navigate = useGuardedNavigate()

  return (
    <Tooltip label={t('Перепродаж (Resale)')} openDelay={300}>
      <ActionIcon
        aria-label={t('Перепродаж (Resale)')}
        className="console-header-action"
        variant="subtle"
        color="gray"
        size="lg"
        onClick={() => navigate('/resales')}
      >
        <ClipboardList size={24} strokeWidth={1.7} />
      </ActionIcon>
    </Tooltip>
  )
}
