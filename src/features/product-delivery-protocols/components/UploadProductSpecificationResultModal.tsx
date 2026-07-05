import { Badge, CopyButton, Group, ScrollArea, Stack, Tabs, Text, Tooltip, ActionIcon } from '@mantine/core'
import { IconCheck, IconCopy } from '@tabler/icons-react'
import { useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import type { UploadProductSpecificationResult } from '../specificationTypes'

type UploadProductSpecificationResultModalProps = {
  result: UploadProductSpecificationResult | null
  onClose: () => void
}

type ResultTab = 'missing' | 'notRequired' | 'updated'

const resultKeys = new WeakMap<UploadProductSpecificationResult, string>()
let resultKeySequence = 0

function getResultKey(result: UploadProductSpecificationResult): string {
  const existingKey = resultKeys.get(result)

  if (existingKey) {
    return existingKey
  }

  resultKeySequence += 1

  const key = `specification-upload-result-${resultKeySequence}`
  resultKeys.set(result, key)

  return key
}

export function UploadProductSpecificationResultModal({
  result,
  onClose,
}: UploadProductSpecificationResultModalProps) {
  const { t } = useI18n()

  return (
    <AppModal
      centered
      className="app-form-sheet"
      opened={Boolean(result)}
      size="md"
      title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Результат')}</span>}
      onClose={onClose}
    >
      {result ? <UploadProductSpecificationResultContent key={getResultKey(result)} result={result} /> : null}
    </AppModal>
  )
}

function UploadProductSpecificationResultContent({ result }: { result: UploadProductSpecificationResult }) {
  const { t } = useI18n()
  const updated = result?.SuccessfullyUpdatedProducts || []
  const missing = result?.MissingProducts || []
  const notRequired = result?.UpdateNotRequiredProducts || []
  const initialTab: ResultTab = updated.length ? 'updated' : missing.length ? 'missing' : 'notRequired'
  const [activeTab, setActiveTab] = useState<ResultTab>(initialTab)
  const items = activeTab === 'updated' ? updated : activeTab === 'missing' ? missing : notRequired

  return (
    <Stack gap="sm">
      <Tabs value={activeTab} onChange={(value) => setActiveTab((value as ResultTab) || initialTab)}>
        <Tabs.List>
          <Tabs.Tab value="updated">
            <Group gap={6}>
              <Text size="sm">{t('Оновлені')}</Text>
              <Badge color="green" variant="light">
                {updated.length}
              </Badge>
            </Group>
          </Tabs.Tab>
          <Tabs.Tab value="missing">
            <Group gap={6}>
              <Text size="sm">{t('Неіснуючі')}</Text>
              <Badge color="red" variant="light">
                {missing.length}
              </Badge>
            </Group>
          </Tabs.Tab>
          <Tabs.Tab value="notRequired">
            <Group gap={6}>
              <Text size="sm">{t('Не оновлені')}</Text>
              <Badge color="gray" variant="light">
                {notRequired.length}
              </Badge>
            </Group>
          </Tabs.Tab>
        </Tabs.List>
      </Tabs>

      <Group justify="flex-end">
        <CopyButton value={items.join('\n')}>
          {({ copied, copy }) => (
            <Tooltip label={copied ? t('Скопійовано') : t('Копіювати')}>
              <ActionIcon color={copied ? 'green' : 'gray'} variant="light" onClick={copy}>
                {copied ? <IconCheck size={18} /> : <IconCopy size={18} />}
              </ActionIcon>
            </Tooltip>
          )}
        </CopyButton>
      </Group>

      <ScrollArea.Autosize mah={320}>
        <Stack gap={4}>
          {items.length > 0 ? (
            items.map((code, index) => (
              <Text key={`${code}-${index}`} size="sm">
                {code}
              </Text>
            ))
          ) : (
            <Text c="dimmed" size="sm">
              {t('Немає даних')}
            </Text>
          )}
        </Stack>
      </ScrollArea.Autosize>
    </Stack>
  )
}
