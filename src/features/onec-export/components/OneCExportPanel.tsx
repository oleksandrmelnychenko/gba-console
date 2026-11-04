import { Alert, Box, Button, Checkbox, Group, Loader, Select, SimpleGrid, Stack, Table, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { Download, FileUp } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useBusyState } from '../../../shared/hooks/useBusyState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDateInput } from '../../../shared/ui/AppDateInput'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import {
  downloadOneCExportBatch,
  exportToOneC,
  getOneCExportRuns,
  ONE_C_EXPORT_BASE_LABELS,
  ONE_C_EXPORT_BASES,
  ONE_C_EXPORT_TYPE_LABELS,
  ONE_C_EXPORT_TYPES,
  saveDownloadedFile,
  type OneCExportBase,
  type OneCExportDocumentType,
  type OneCExportRun,
} from '../api/oneCExportApi'
import {
  ONE_C_EXPORT_PRESET_LABELS,
  ONE_C_EXPORT_PRESETS,
  resolveOneCExportPeriod,
  validateOneCExportPeriod,
  type OneCExportPreset,
} from '../oneCExportPeriod'
import { formatKyivBusinessDate } from '../../../shared/date/dateTime'

const KYIV_DATE_TIME = new Intl.DateTimeFormat('uk-UA', {
  timeZone: 'Europe/Kyiv',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function formatRunDate(value: string): string {
  const date = new Date(value.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`)
  return Number.isNaN(date.getTime()) ? value : KYIV_DATE_TIME.format(date)
}

function formatDay(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-')
  return year && month && day ? `${day}.${month}.${year}` : value
}

export function OneCExportPanel() {
  const { t } = useI18n()
  const today = formatKyivBusinessDate()
  const [bases, setBases] = useState<OneCExportBase[]>([...ONE_C_EXPORT_BASES])
  const [types, setTypes] = useState<OneCExportDocumentType[]>([...ONE_C_EXPORT_TYPES])
  const [preset, setPreset] = useState<OneCExportPreset>('today')
  const [customFrom, setCustomFrom] = useState(today)
  const [customTo, setCustomTo] = useState(today)
  const [runs, setRuns] = useState<OneCExportRun[]>([])
  const [runsError, setRunsError] = useState<string | null>(null)
  const [runsLoading, setRunsLoading] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [isExporting, setIsExporting, tryStartIsExporting] = useBusyState()

  const loadRuns = useCallback(async (signal?: AbortSignal) => {
    setRunsLoading(true)
    try {
      setRuns(await getOneCExportRuns(50, signal))
      setRunsError(null)
    } catch (error) {
      if (signal?.aborted) return
      setRunsError(error instanceof Error ? error.message : t('Не вдалося завантажити журнал вивантажень'))
    } finally {
      if (!signal?.aborted) setRunsLoading(false)
    }
  }, [t])

  useEffect(() => {
    const controller = new AbortController()
    void loadRuns(controller.signal)
    return () => controller.abort()
  }, [loadRuns])

  const period = resolveOneCExportPeriod(preset, { from: customFrom, to: customTo })
  const showFrom = preset === 'untilToday' || preset === 'custom'
  const showTo = preset === 'custom'

  async function runExport() {
    if (bases.length === 0) {
      notifications.show({ color: 'red', message: t('Оберіть хоча б одну базу 1С') })
      return
    }
    if (types.length === 0) {
      notifications.show({ color: 'red', message: t('Оберіть хоча б один тип документів') })
      return
    }
    const periodError = validateOneCExportPeriod(period)
    if (periodError) {
      notifications.show({ color: 'red', message: t(periodError) })
      return
    }
    if (!tryStartIsExporting()) return
    try {
      const file = await exportToOneC({ bases, from: period.from, to: period.to, types })
      saveDownloadedFile(file)
      notifications.show({ color: 'green', message: t('Файл для 1С сформовано: {name}', { name: file.fileName }) })
      void loadRuns()
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : t('Не вдалося сформувати вивантаження в 1С'),
      })
    } finally {
      setIsExporting(false)
    }
  }

  async function redownload(batchNetUid: string) {
    if (downloading) return
    setDownloading(batchNetUid)
    try {
      saveDownloadedFile(await downloadOneCExportBatch(batchNetUid))
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : t('Не вдалося отримати файл вивантаження'),
      })
    } finally {
      setDownloading(null)
    }
  }

  return (
    <Stack gap={12}>
      <Box className="sync-config-panel">
        <Text className="app-section-title">{t('Вивантаження в 1С')}</Text>
        <Stack gap={10} mt={10}>
          <Group gap={16}>
            {ONE_C_EXPORT_BASES.map((base) => (
              <Checkbox
                key={base}
                label={t(ONE_C_EXPORT_BASE_LABELS[base])}
                checked={bases.includes(base)}
                onChange={(event) => {
                  const checked = event.currentTarget.checked
                  setBases((current) =>
                    checked ? ONE_C_EXPORT_BASES.filter((b) => b === base || current.includes(b)) : current.filter((b) => b !== base),
                  )
                }}
              />
            ))}
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing={10}>
            <Select
              label={t('Період')}
              data={ONE_C_EXPORT_PRESETS.map((value) => ({ value, label: t(ONE_C_EXPORT_PRESET_LABELS[value]) }))}
              value={preset}
              allowDeselect={false}
              onChange={(value) => value && setPreset(value as OneCExportPreset)}
            />
            {showFrom && (
              <AppDateInput
                label={t('Дата від')}
                type="date"
                value={customFrom}
                onChange={(event) => setCustomFrom(event.currentTarget.value)}
              />
            )}
            {showTo && (
              <AppDateInput
                label={t('Дата до')}
                type="date"
                value={customTo}
                onChange={(event) => setCustomTo(event.currentTarget.value)}
              />
            )}
          </SimpleGrid>
          <Text size="sm" c="dimmed">
            {period.to
              ? t('Документи з {from} по {to}', { from: formatDay(period.from), to: formatDay(period.to) })
              : t('Документи з {from} по сьогодні', { from: formatDay(period.from) })}
          </Text>
          <Checkbox.Group
            label={t('Типи документів')}
            value={types}
            onChange={(value) => setTypes(ONE_C_EXPORT_TYPES.filter((type) => value.includes(type)))}
          >
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={6} mt={6}>
              {ONE_C_EXPORT_TYPES.map((type) => (
                <Checkbox key={type} value={type} label={t(ONE_C_EXPORT_TYPE_LABELS[type])} />
              ))}
            </SimpleGrid>
          </Checkbox.Group>
          <Text size="xs" c="dimmed">
            {t('Вивантажуються лише документи, створені в GBA. Tax-free, SAD і повернення постачальнику не вивантажуються.')}
          </Text>
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
      <Box>
        <Text className="app-section-title">{t('Історія вивантажень')}</Text>
        {runsError && (
          <Alert color="red" mt={8}>
            {runsError}
          </Alert>
        )}
        {runsLoading && runs.length === 0 ? (
          <Group justify="center" p="md">
            <Loader size="sm" />
          </Group>
        ) : runs.length === 0 ? (
          <Text size="sm" c="dimmed" mt={8}>
            {t('Вивантажень ще не було')}
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={640} mt={8}>
            <Table striped highlightOnHover verticalSpacing={4} fz="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('Дата')}</Table.Th>
                  <Table.Th>{t('Користувач')}</Table.Th>
                  <Table.Th>{t('База')}</Table.Th>
                  <Table.Th>{t('Період')}</Table.Th>
                  <Table.Th ta="right">{t('Документів')}</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {runs.map((run) => (
                  <Table.Tr key={run.NetUid}>
                    <Table.Td>{formatRunDate(run.CreatedAtUtc)}</Table.Td>
                    <Table.Td>{run.UserName || '—'}</Table.Td>
                    <Table.Td>{t(run.BaseName)}</Table.Td>
                    <Table.Td>{`${formatDay(run.PeriodFrom)} – ${formatDay(run.PeriodTo)}`}</Table.Td>
                    <Table.Td ta="right">
                      {run.DocumentCount}
                      {run.DeletedCount > 0 ? ` (${t('видалено')}: ${run.DeletedCount})` : ''}
                    </Table.Td>
                    <Table.Td>
                      <Button
                        size="compact-xs"
                        variant="subtle"
                        leftSection={<Download size={14} />}
                        loading={downloading === run.BatchNetUid}
                        aria-label={t('Завантажити файл {name}', { name: run.FileName })}
                        onClick={() => void redownload(run.BatchNetUid)}
                      >
                        {t('Файл')}
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Box>
    </Stack>
  )
}
