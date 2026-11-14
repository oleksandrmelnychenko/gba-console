import { ConsoleNavRow } from '../../../../app/layout/components/ConsoleNavRow'
import { useI18n } from '../../../../shared/i18n/useI18n'

export function ReportsSubmenu({ onDraft, draftDisabled = true, draftOpened = false, onTemplates, templatesDisabled, templatesOpened,
  onCatalogue, catalogueDisabled, published = false,
}: {
  onDraft?: () => void; draftDisabled?: boolean; draftOpened?: boolean
  onTemplates: () => void; templatesDisabled: boolean; templatesOpened: boolean
  onCatalogue: () => void; catalogueDisabled: boolean; published?: boolean
}) {
  const { t } = useI18n()
  const catalogue = { key: 'catalogue', label: t('Каталог'), active: !published && !draftOpened && !templatesOpened, badge: null, disabled: catalogueDisabled, onSelect: onCatalogue }
  return <nav aria-label={t('Каталог звітів')} style={{ width: '100%', minWidth: 0 }}>
    <ConsoleNavRow kind="item" className="console-subnav-row console-subnav-items" entries={published ? [catalogue] : [
      catalogue,
      { key: 'draft', label: t('Чернетка'), active: draftOpened, badge: null, disabled: draftDisabled, onSelect: () => onDraft?.() },
      { key: 'templates', label: t('Шаблони'), active: templatesOpened, badge: null, disabled: templatesDisabled, onSelect: onTemplates },
    ]} />
  </nav>
}
