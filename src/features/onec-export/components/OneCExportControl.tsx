import { ActionIcon, Tooltip } from '@mantine/core'
import { FileUp } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { OneCExportPanel } from './OneCExportPanel'

export function OneCExportControl() {
  const { t } = useI18n()
  const [opened, setOpened] = useState(false)

  return (
    <>
      <Tooltip label={t('Вивантаження в 1С')} openDelay={300}>
        <ActionIcon
          aria-label={t('Вивантаження в 1С')}
          className="console-header-action"
          variant="subtle"
          color="gray"
          size="lg"
          onClick={() => setOpened(true)}
        >
          <FileUp size={24} strokeWidth={1.7} />
        </ActionIcon>
      </Tooltip>
      <AppModal
        opened={opened}
        onClose={() => setOpened(false)}
        title={t('Вивантаження в 1С')}
        size="xl"
        className="sync-modal"
        centered
      >
        {opened && <OneCExportPanel />}
      </AppModal>
    </>
  )
}
