import { Button, Group, Loader } from '@mantine/core'
import { lazy, Suspense, useRef, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import type { CatalogueLaunchChoice } from '../data/reportCatalogueLaunch'
import type { ReportCatalogue } from '../types'

const ReportCataloguePanel = lazy(() => import('./ReportCataloguePanel').then(module => ({ default: module.ReportCataloguePanel })))

export function ReportCatalogueControl({ enabled, disabled = false, presentation = 'inline', onOpen }: {
  enabled: boolean
  disabled?: boolean
  presentation?: 'inline' | 'dialog'
  onOpen?: (choice: CatalogueLaunchChoice, catalogue: ReportCatalogue) => boolean
}) {
  const { t } = useI18n()
  const [opened, setOpened] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const dialog = presentation === 'dialog'
  const panel = enabled && opened ? <Suspense fallback={<Loader size="sm" aria-label={t('Завантаження каталогу звітів')} />}>
    <ReportCataloguePanel disabled={disabled} onOpen={onOpen ? (choice, catalogue) => {
      if (!enabled || disabled || !onOpen(choice, catalogue)) return false
      setOpened(false)
      return true
    } : undefined} />
  </Suspense> : null
  return <>
    <Group>
      <Button ref={trigger} type="button" variant={dialog ? 'default' : 'subtle'} disabled={!enabled || disabled}
        aria-haspopup={dialog ? 'dialog' : undefined} aria-expanded={enabled && opened}
        onClick={() => setOpened(value => !value)}>
        {!dialog && opened ? t('Сховати каталог звітів 1С') : t('Каталог усіх звітів 1С')}
      </Button>
    </Group>
    {dialog ? <AppModal opened={enabled && opened} onClose={() => setOpened(false)}
      title={t('Каталог усіх звітів 1С')} size={1120} className="report-catalogue-dialog"
      closeButtonProps={{ 'aria-label': t('Закрити каталог звітів') }} returnFocus={false}
      onExitTransitionEnd={() => trigger.current?.focus()}>
      {panel}
    </AppModal> : panel}
  </>
}
