import {
  Box,
  Divider,
  Group,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { CircleCheck, ShieldCheck } from 'lucide-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import {
  MIN_SYNC_SESSION_DATE,
  type SyncDateRange,
  type SyncDateRangeErrors,
  type SyncMode,
  type SyncSource,
} from '../syncSessionForm'
import { DailySyncTypeChecklist } from './DailySyncTypeChecklist'

type SyncSessionConfiguratorProps = {
  dateErrors: SyncDateRangeErrors
  mode: SyncMode
  range: SyncDateRange
  selectedDailyDocumentTypes: string[]
  source: SyncSource
  today: string
  onDailyDocumentTypesChange: (types: string[]) => void
  onDateChange: (boundary: keyof SyncDateRange, value: string) => void
  onSourceChange: (source: SyncSource) => void
}

export function SyncSessionConfigurator({
  dateErrors,
  mode,
  onDailyDocumentTypesChange,
  onDateChange,
  onSourceChange,
  range,
  selectedDailyDocumentTypes,
  source,
  today,
}: SyncSessionConfiguratorProps) {
  const { t } = useI18n()

  return (
    <Box className="sync-config-panel">
      <Group justify="space-between" align="center" gap="md" wrap="wrap">
        <Box>
          <Text className="app-section-title" fw={600} size="sm">
            {t(mode === 'full' ? 'Повна синхронізація' : 'Щоденна синхронізація')}
          </Text>
          <Text c="dimmed" size="xs">
            {t(
              mode === 'full'
                ? 'Довідники, документи за вибраний період і поточний стан'
                : 'Довідники, вибрані документи й поточний стан за короткий період',
            )}
          </Text>
        </Box>
        <SegmentedControl
          aria-label={t('Джерело 1С')}
          className="sync-source-control"
          value={source}
          onChange={(value) => onSourceChange(value as SyncSource)}
          data={[
            { value: 'amg', label: 'AMG' },
            { value: 'fenix', label: 'FENIX' },
          ]}
        />
      </Group>

      <Divider my="md" />

      <Stack gap="md">
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <TextInput
            error={dateErrors.from}
            label={t('Дата від')}
            max={today}
            min={MIN_SYNC_SESSION_DATE}
            type="date"
            value={range.from}
            onChange={(event) => onDateChange('from', event.currentTarget.value)}
          />
          <TextInput
            error={dateErrors.to}
            label={t('Дата до')}
            max={today}
            min={MIN_SYNC_SESSION_DATE}
            type="date"
            value={range.to}
            onChange={(event) => onDateChange('to', event.currentTarget.value)}
          />
        </SimpleGrid>

        {dateErrors.range ? (
          <Text c="red.7" size="xs">
            {t(dateErrors.range)}
          </Text>
        ) : null}

        <Group gap="xs" className="sync-safe-mode">
          <ShieldCheck size={17} strokeWidth={1.8} />
          <Text fw={600} size="xs">
            {t('Послідовність: довідники й ціни → документи → залишки та баланси')}
          </Text>
        </Group>

        <Box>
          <Text fw={600} mb={6} size="xs">
            {t('Типи документів')}
          </Text>
          {mode === 'full' ? (
            <Group align="flex-start" className="sync-fixed-types" gap="xs" wrap="nowrap">
              <CircleCheck size={18} strokeWidth={1.8} />
              <Box>
                <Text fw={650} size="xs">
                  {t('Усі типи документів (12)')}
                </Text>
                <Text c="dimmed" size="xs">
                  {t('Повний режим завжди синхронізує весь набір документів')}
                </Text>
              </Box>
            </Group>
          ) : (
            <DailySyncTypeChecklist
              selectedTypes={selectedDailyDocumentTypes}
              onChange={onDailyDocumentTypesChange}
            />
          )}
        </Box>
      </Stack>
    </Box>
  )
}
