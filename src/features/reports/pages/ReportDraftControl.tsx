import { AppModalFooter } from '../../../shared/ui/AppModal'
import { Alert, Button, Stack, Text } from '@mantine/core'
import { History, RotateCcw, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { ReportModal } from './ReportModal'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { formatDateTime } from '../utils'

type Props = {
  renderTrigger?: (props: { onOpen: () => void; disabled: boolean; opened: boolean }) => ReactNode
  pending: boolean
  canRestore: boolean
  canUndo: boolean
  disabled: boolean
  savedAt: string | null
  error: string | null
  onRestore: () => boolean
  onUndo: () => boolean
  onDiscard: () => boolean
}

/** Recovery is an optional action; it never takes over the report workspace. */
export function ReportDraftControl({ renderTrigger, pending, canRestore, canUndo, disabled, savedAt, error,
  onRestore, onUndo, onDiscard }: Props) {
  const { t } = useI18n()
  const [opened, setOpened] = useState(false)
  const available = pending || canUndo || Boolean(savedAt || error)
  const apply = (action: () => boolean) => { if (action()) setOpened(false) }
  return <>
    {renderTrigger ? renderTrigger({ onOpen: () => setOpened(true), disabled: !available || disabled, opened }) : <Button type="button" variant="subtle" color="gray" className="workbook-quiet-action"
      leftSection={<History size={15} aria-hidden="true" />} disabled={!available || disabled}
      aria-haspopup="dialog" aria-expanded={opened} onClick={() => setOpened(true)}>{t('Чернетка')}</Button>}
    <ReportModal opened={opened} onClose={() => setOpened(false)} title={t('Чернетка звіту')} size={496} centered
      closeButtonProps={{ 'aria-label': t('Закрити чернетку') }}>
      <Stack gap={10}>
        {savedAt ? <dl className="report-draft__saved">
          <dt>{t('Збережено')}</dt>
          <dd><time dateTime={savedAt}>{formatDateTime(savedAt)}</time></dd>
        </dl> : <Text size="sm" c="gray.7">{t('Є збережена чернетка')}</Text>}
        {error ? <Alert color="red">{error}</Alert> : null}
        {pending || canUndo ? <AppModalFooter>
          {pending ? <Button type="button" variant="default" leftSection={<Trash2 size={15} aria-hidden="true" />}
            disabled={disabled} onClick={() => apply(onDiscard)}>
            {t('Відкинути чернетку')}
          </Button> : null}
          <Button type="button" color={CREATE_ACTION_COLOR} leftSection={<RotateCcw size={15} aria-hidden="true" />}
            disabled={disabled || (pending && !canRestore)} onClick={() => apply(pending ? onRestore : onUndo)}>
            {pending ? t('Відновити чернетку') : t('Повернути попередні налаштування')}
          </Button>
        </AppModalFooter> : null}
      </Stack>
    </ReportModal>
  </>
}
