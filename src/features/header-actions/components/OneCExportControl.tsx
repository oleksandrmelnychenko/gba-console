import { ActionIcon, Button, Group, Select, Stack, TextInput, Tooltip } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { FileUp } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { startGbaToOneCSync } from '../api/syncApi'
import { TypeOfXmlDocument } from '../types'
import { parseDateInputValue, toDateInputValue } from '../utils'

const EXPORT_COMBOBOX_PROPS = {
  classNames: { dropdown: 'sync-modal-dropdown' },
}

export function OneCExportControl() {
  const { t } = useI18n()
  const [documentType, setDocumentType] = useState(String(TypeOfXmlDocument.Sales))
  const [fromDate, setFromDate] = useState(() => new Date())
  const [isExporting, setIsExporting] = useState(false)
  const [opened, setOpened] = useState(false)
  const [toDate, setToDate] = useState(() => new Date())

  async function runExport() {
    if (fromDate.getTime() > toDate.getTime()) {
      notifications.show({ color: 'red', message: t('Дата початку має бути раніше дати завершення') })
      return
    }

    setIsExporting(true)

    try {
      const response = await startGbaToOneCSync({
        from: fromDate,
        to: toDate,
        typeDocument: Number(documentType) as TypeOfXmlDocument,
      })
      notifications.show({
        color: 'green',
        message: response?.Message || t('Вивантаження запущено'),
      })
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : t('Не вдалося запустити вивантаження'),
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <>
      <Tooltip label={t('Вивантаження GBA в 1С')} openDelay={300}>
        <ActionIcon
          aria-label={t('Вивантаження GBA в 1С')}
          className="console-header-action"
          color="gray"
          onClick={() => setOpened(true)}
          size="lg"
          variant="subtle"
        >
          <FileUp size={23} strokeWidth={1.7} />
        </ActionIcon>
      </Tooltip>

      <AppModal
        centered
        opened={opened}
        onClose={() => setOpened(false)}
        size="md"
        title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Вивантаження GBA в 1С')}</span>}
      >
        <Stack gap="md">
          <Group align="end" grow>
            <TextInput
              label={t('З')}
              type="date"
              value={toDateInputValue(fromDate)}
              onChange={(event) =>
                setFromDate(parseDateInputValue(event.currentTarget.value, fromDate))
              }
            />
            <TextInput
              label={t('По')}
              type="date"
              value={toDateInputValue(toDate)}
              onChange={(event) =>
                setToDate(parseDateInputValue(event.currentTarget.value, toDate, true))
              }
            />
          </Group>
          <Select
            comboboxProps={EXPORT_COMBOBOX_PROPS}
            data={[
              { value: String(TypeOfXmlDocument.Sales), label: t('Продажі') },
              {
                value: String(TypeOfXmlDocument.ProductIncomes),
                label: t('Прихідні накладні на товар'),
              },
            ]}
            label={t('Тип документа')}
            onChange={(value) => value && setDocumentType(value)}
            value={documentType}
          />
          <Group justify="flex-end">
            <Button
              color={CREATE_ACTION_COLOR}
              leftSection={<FileUp size={16} strokeWidth={1.9} />}
              loading={isExporting}
              onClick={() => void runExport()}
            >
              {t('Вивантажити')}
            </Button>
          </Group>
        </Stack>
      </AppModal>
    </>
  )
}
