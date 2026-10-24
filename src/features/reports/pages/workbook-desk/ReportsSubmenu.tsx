import { useContext } from 'react'
import { PageHeaderActionsContext } from '../../../../shared/ui/page-header-actions/pageHeaderActionsContext'
import { useElementSize } from '@mantine/hooks'
import { ConsoleNavRow } from '../../../../app/layout/components/ConsoleNavRow'
import { useI18n } from '../../../../shared/i18n/useI18n'

export function ReportsSubmenu({ onDraft, draftDisabled = true, draftOpened = false, onTemplates, templatesDisabled, templatesOpened,
  onCatalogue, catalogueDisabled,
}: {
  onDraft?: () => void; draftDisabled?: boolean; draftOpened?: boolean
  onTemplates: () => void; templatesDisabled: boolean; templatesOpened: boolean
  onCatalogue: () => void; catalogueDisabled: boolean
}) {
  const { submenuContainer } = useContext(PageHeaderActionsContext)
  const { ref, width } = useElementSize()
  const { t } = useI18n()
  return <nav ref={ref} aria-label={t('Каталог звітів')} style={{ width: '100%', minWidth: 0 }}>
    <ConsoleNavRow kind="item" className="console-subnav-row console-subnav-items" availableWidth={submenuContainer ? width || undefined : undefined} entries={[
      { key: 'catalogue', label: t('Каталог'), active: !draftOpened && !templatesOpened, badge: null, disabled: catalogueDisabled, onSelect: onCatalogue },
      { key: 'draft', label: t('Чернетка'), active: draftOpened, badge: null, disabled: draftDisabled, onSelect: () => onDraft?.() },
      { key: 'templates', label: t('Шаблони'), active: templatesOpened, badge: null, disabled: templatesDisabled, onSelect: onTemplates },
    ]} />
  </nav>
}
