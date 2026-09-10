import { Button, Group, Loader } from '@mantine/core'
import { lazy, Suspense, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { CatalogueLaunchChoice } from '../data/reportCatalogueLaunch'
import type { ReportCatalogue } from '../types'

const ReportCataloguePanel = lazy(() => import('./ReportCataloguePanel').then(module => ({ default: module.ReportCataloguePanel })))

export function ReportCatalogueControl({ enabled, disabled = false, onOpen }: {
  enabled: boolean
  disabled?: boolean
  onOpen?: (choice: CatalogueLaunchChoice, catalogue: ReportCatalogue) => boolean
}) {
  const { t } = useI18n()
  const [opened, setOpened] = useState(false)
  return <>
    <Group>
      <Button type="button" variant="subtle" disabled={!enabled || disabled} onClick={() => setOpened(value => !value)}>
        {opened ? t('Сховати каталог звітів 1С') : t('Каталог усіх звітів 1С')}
      </Button>
    </Group>
    {enabled && opened && <Suspense fallback={<Loader size="sm" />}><ReportCataloguePanel disabled={disabled}
      onOpen={onOpen ? (choice, catalogue) => {
        if (!enabled || disabled || !onOpen(choice, catalogue)) return false
        setOpened(false)
        return true
      } : undefined} /></Suspense>}
  </>
}
