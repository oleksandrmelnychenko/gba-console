import { Box, Button, Group, Paper, Stack, Text } from '@mantine/core'
import { FileSpreadsheet, FileText } from 'lucide-react'
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
            <Group gap="xs" wrap="nowrap">
              <Box
                style={{
                  width: 8,
                  height: 8,
                  flex: '0 0 auto',
                  borderRadius: 999,
                  background: '#e8782e',
                  boxShadow: '0 0 0 3px rgba(232, 120, 46, 0.14)',
                }}
              />
              <Text fw={600} size="sm">
                {document.label}
              </Text>
            </Group>
            <Group gap="xs">
              {document.pdfUrl && (
                <Button
                  color="red"
                  component="a"
                  href={getDocumentHref(document.pdfUrl)}
                  leftSection={<FileText size={16} />}
                  rel="noopener noreferrer"
                  size="xs"
                  target="_blank"
                  variant="light"
                >
                  PDF
                </Button>
              )}
              {document.excelUrl && (
                <Button
                  color="teal"
                  component="a"
                  href={getDocumentHref(document.excelUrl)}
                  leftSection={<FileSpreadsheet size={16} />}
                  rel="noopener noreferrer"
                  size="xs"
                  target="_blank"
                  variant="outline"
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
