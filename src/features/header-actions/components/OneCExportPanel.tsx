import { Box, Button, Group, Select, SimpleGrid, Stack, Text, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { FileUp } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { startGbaToOneCSync } from '../api/syncApi'
import { TypeOfXmlDocument } from '../types'
import { parseDateInputValue, toDateInputValue } from '../utils'

const EXPORT_COMBOBOX_PROPS = {
  classNames: { dropdown: 'sync-modal-dropdown' },
}

export function OneCExportPanel() {
  const { t } = useI18n()
  const [documentType, setDocumentType] = useState(String(TypeOfXmlDocument.Sales))
  const [fromDate, setFromDate] = useState(() => new Date())
  const [isExporting, setIsExporting] = useState(false)
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
    <Stack gap={10}>
      <Box className="sync-config-panel">
        <Text className="app-section-title">{t('Вивантаження GBA в 1С')}</Text>
        <Stack gap={10} mt={10}>
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing={10}>
            <TextInput
              label={t('Дата від')}
              type="date"
              value={toDateInputValue(fromDate)}
              onChange={(event) =>
                setFromDate(parseDateInputValue(event.currentTarget.value, fromDate))
              }
            />
            <TextInput
              label={t('Дата до')}
              type="date"
              value={toDateInputValue(toDate)}
              onChange={(event) =>
                setToDate(parseDateInputValue(event.currentTarget.value, toDate, true))
              }
            />
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
          </SimpleGrid>
        </Stack>
      </Box>
      <Group justify="flex-end" className="sync-action-bar">
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
  )
}
