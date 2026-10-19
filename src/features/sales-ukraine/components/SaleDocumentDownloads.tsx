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
    <Stack gap="sm">
      {documents.map((document, index) => (
        <Paper key={`${document.label}-${index}`} withBorder p="md" radius="md">
          <Stack gap="sm">
            <Text className="app-section-title" fw={600} size="sm">
              {document.label}
            </Text>
            <Group gap="xs">
              {document.pdfUrl && (
                <Button
                  color="gray"
                  component="a"
                  href={getDocumentHref(document.pdfUrl)}
                  leftSection={<PdfIcon size={20} />}
                  rel="noopener noreferrer"
                  size="sm"
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
                  leftSection={<ExcelIcon size={20} />}
                  rel="noopener noreferrer"
                  size="sm"
                  target="_blank"
                  variant="default"
                >
                  Excel
                </Button>
              )}
            </Group>
          </Stack>
        </Paper>
      ))}
    </Stack>
  )
}
