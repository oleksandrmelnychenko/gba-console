import { Button, Group, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { BUG_1274_WORKBOOKS_INTRO, BUG_1274_WORKBOOKS_TITLE, bug1274WorkbookGuide } from '../data/bug1274WorkbookGuide'
import type { WorkbookLaunch } from '../data/bug1274WorkbookLaunch'
import './bug1274-workbook-shortcuts.css'

type Props = {
  launches: readonly WorkbookLaunch[]
  active: string | null
  disabled: boolean
  onOpen: (launch: WorkbookLaunch) => void
}

export function Bug1274WorkbookShortcuts({ launches, active, disabled, onOpen }: Props) {
  const { t } = useI18n()
  const title = t(BUG_1274_WORKBOOKS_TITLE)
  if (active) return <section className="app-section-card workbook-shortcuts workbook-shortcuts--compact" aria-label={title}>
    <Group gap={8} wrap="wrap" align="center">
      <Text className="workbook-shortcuts__compact-title" size="sm" fw={600}>{title}:</Text>
      {launches.map(item => <Button key={item.fileName} type="button" size="compact-sm"
        variant={item.fileName === active ? 'filled' : 'light'} disabled={disabled}
        aria-label={t('Відкрити {file}', { file: item.fileName })} title={bug1274WorkbookGuide(item.fileName)?.title}
        aria-current={item.fileName === active ? 'true' : undefined} onClick={() => onOpen(item)}>{item.fileName}</Button>)}
    </Group>
  </section>
  return <section className="app-section-card workbook-shortcuts" aria-label={title}>
    <Text component="h2" className="workbook-shortcuts__title" fw={600}>{title}</Text>
    <Text size="xs" c="dimmed">{t(BUG_1274_WORKBOOKS_INTRO)}</Text>
    <div className="workbook-shortcuts__list">{launches.map(item => {
      const guide = bug1274WorkbookGuide(item.fileName)
      return <div key={item.fileName} className="workbook-shortcuts__item">
        <div className="workbook-shortcuts__text">
          <Group gap={8} wrap="wrap" align="baseline">
            <Text size="sm" fw={600}>{t(guide?.title ?? item.label)}</Text>
            <Text size="xs" c="dimmed">{item.fileName}</Text>
          </Group>
          <Text size="xs">{t(guide?.summary ?? item.notice)}</Text>
        </div>
        <Button type="button" size="xs" variant="light" disabled={disabled}
          aria-label={t('Відкрити {file}', { file: item.fileName })} onClick={() => onOpen(item)}>{t('Відкрити')}</Button>
      </div>
    })}</div>
  </section>
}
