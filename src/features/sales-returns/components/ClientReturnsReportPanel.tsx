import { Anchor, Button, Checkbox, Group, Select, Stack, Text, TextInput } from '@mantine/core'
import { IconFileTypePdf, IconFileTypeXls, IconReportAnalytics } from '@tabler/icons-react'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { exportSaleReturnsReport, searchSalesReturnClients } from '../api/salesReturnsApi'
import type { SalesReturnClient, SalesReturnDocument } from '../types'
import { getEntityName } from '../utils'

type ClientReturnsReportPanelProps = {
  opened: boolean
  onClose: () => void
}

function today(): string {
  return formatLocalDate(new Date())
}

export function ClientReturnsReportPanel({ opened, onClose }: ClientReturnsReportPanelProps) {
  const { t } = useI18n()
  const [fromDate, setFromDate] = useState(today)
  const [toDate, setToDate] = useState(today)
  const [onlyMy, setOnlyMy] = useState(false)
  const [reportType, setReportType] = useState<'0' | '1'>('0')
  const [clientSearch, setClientSearch] = useState('')
  const [clients, setClients] = useState<SalesReturnClient[]>([])
  const [selectedClient, setSelectedClient] = useState<SalesReturnClient | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reportDocument, setReportDocument] = useState<SalesReturnDocument | null>(null)

  useEffect(() => {
    const value = clientSearch.trim()

    if (value.length < 2) {
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      searchSalesReturnClients(value, controller.signal)
        .then((next) => setClients(next))
        .catch(() => {
          if (!controller.signal.aborted) {
            setClients([])
          }
        })
    }, 300)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [clientSearch])

  const clientOptions = useMemo(() => {
    const labels = new Map<string, string>()

    for (const client of clients) {
      if (client.NetUid) {
        labels.set(client.NetUid, getEntityName(client) || t('Без назви'))
      }
    }

    if (selectedClient?.NetUid) {
      labels.set(selectedClient.NetUid, getEntityName(selectedClient) || t('Без назви'))
    }

    return Array.from(labels, ([value, label]) => ({ label, value }))
  }, [clients, selectedClient, t])

  function resetSelectedClient() {
    setSelectedClient(null)
    setClientSearch('')
  }

  function handleClose() {
    setFromDate(today())
    setToDate(today())
    setOnlyMy(false)
    setReportType('0')
    setSelectedClient(null)
    setClientSearch('')
    setClients([])
    setError(null)
    setReportDocument(null)
    onClose()
  }

  async function handleGenerate() {
    setIsGenerating(true)
    setError(null)

    try {
      const result = await exportSaleReturnsReport({
        clientNetId: selectedClient?.NetUid || undefined,
        forMyClients: onlyMy,
        from: fromDate,
        reportType: reportType === '1' ? 1 : 0,
        to: toDate,
      })

      setReportDocument(result)
    } catch (generateError: unknown) {
      setReportDocument(null)
      setError(generateError instanceof Error ? generateError.message : t('Не вдалося сформувати звіт'))
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <AppDrawer opened={opened} position="right" size="min(460px, 100vw)" title={t('Сформувати звіт')} onClose={handleClose}>
      <Stack gap="md">
        <Group grow>
          <TextInput
            label={t('Від')}
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.currentTarget.value)}
          />
          <TextInput label={t('До')} type="date" value={toDate} onChange={(event) => setToDate(event.currentTarget.value)} />
        </Group>

        <Select
          clearable
          searchable
          data={clientOptions}
          label={t('Клієнт')}
          placeholder={t('Пошук клієнта')}
          value={selectedClient?.NetUid ?? null}
          onChange={(value) => {
            if (!value) {
              setSelectedClient(null)
              return
            }

            const found = clients.find((client) => client.NetUid === value)

            if (found) {
              setSelectedClient(found)
            }

            setOnlyMy(false)
          }}
          onSearchChange={setClientSearch}
        />

        <Checkbox
          checked={onlyMy}
          label={t('Тільки мої клієнти')}
          onChange={(event) => {
            const checked = event.currentTarget.checked

            setOnlyMy(checked)

            if (checked) {
              resetSelectedClient()
            }
          }}
        />

        <Select
          data={[
            { label: t('Згруповано'), value: '0' },
            { label: t('Деталізовано'), value: '1' },
          ]}
          label={t('Тип')}
          value={reportType}
          onChange={(value) => setReportType(value === '1' ? '1' : '0')}
        />

        <Button leftSection={<IconReportAnalytics size={16} />} loading={isGenerating} onClick={handleGenerate}>
          {t('Сформувати звіт')}
        </Button>

        {error ? (
          <Text c="red" size="sm">
            {error}
          </Text>
        ) : null}

        {reportDocument ? (
          <Group gap="md">
            <ReportDownloadLink
              icon={<IconFileTypeXls size={16} />}
              label={t('Excel')}
              url={reportDocument.DocumentURL || reportDocument.XlsxDocument}
            />
            <ReportDownloadLink
              icon={<IconFileTypePdf size={16} />}
              label={t('PDF')}
              url={reportDocument.PdfDocumentURL || reportDocument.PdfDocument}
            />
          </Group>
        ) : null}
      </Stack>
    </AppDrawer>
  )
}

function ReportDownloadLink({ icon, label, url }: { icon: ReactNode; label: string; url?: string }) {
  if (!url) {
    return null
  }

  return (
    <Anchor href={url} rel="noreferrer" target="_blank">
      <Group gap="xs">
        {icon}
        <span>{label}</span>
      </Group>
    </Anchor>
  )
}
