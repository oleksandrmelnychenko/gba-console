import { Button, Group, Loader } from '@mantine/core'
import { lazy, Suspense, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'

const ReportCataloguePanel = lazy(() => import('./ReportCataloguePanel').then(module => ({ default: module.ReportCataloguePanel })))

export function ReportCatalogueControl({ enabled }: { enabled: boolean }) {
  const { t } = useI18n()
  const [opened, setOpened] = useState(false)
  return <>
    <Group>
      <Button variant="subtle" disabled={!enabled} onClick={() => setOpened(value => !value)}>
        {opened ? t('Сховати каталог звітів 1С') : t('Каталог усіх звітів 1С')}
      </Button>
    </Group>
    {enabled && opened && <Suspense fallback={<Loader size="sm" />}><ReportCataloguePanel /></Suspense>}
  </>
}
