import { Button, Group, Paper, Stack, Text } from '@mantine/core'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { PdfIcon } from '../../../shared/ui/PdfIcon'
import { getDocumentHref } from '../../../shared/url/getDocumentHref'

export type SaleDocumentDownload = {
  excelUrl: string | null
  label: string
  pdfUrl: string | null
}

export function SaleDocumentDownloads({ documents }: { documents: SaleDocumentDownload[] }) {
  return (
    <Stack className="app-compact-form" gap={8}>
      {documents.map((document, index) => (
        <Paper key={`${document.label}-${index}`} className="app-section-card" withBorder p={10} radius="md">
          <Group gap={8} justify="space-between" wrap="wrap">
            <Text className="app-section-title" fw={600} size="sm" style={{ flex: '1 1 180px' }}>
              {document.label}
            </Text>
            <Group gap="xs">
              {document.pdfUrl && (
                <Button
                  color="gray"
                  component="a"
                  href={getDocumentHref(document.pdfUrl)}
                  leftSection={<PdfIcon size={16} />}
                  rel="noopener noreferrer"
                  size="xs"
                  target="_blank"
                  variant="default"
                >
                  PDF
                </Button>
              )}
              {document.excelUrl && (
                <Button
                  color="gray"
                  component="a"
                  href={getDocumentHref(document.excelUrl)}
                  leftSection={<ExcelIcon size={16} />}
                  rel="noopener noreferrer"
                  size="xs"
                  target="_blank"
                  variant="default"
                >
                  Excel
                </Button>
              )}
            </Group>
          </Group>
        </Paper>
      ))}
    </Stack>
  )
}
