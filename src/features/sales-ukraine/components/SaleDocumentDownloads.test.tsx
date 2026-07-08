import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { theme } from '../../../shared/theme/theme'
import { SaleDocumentDownloads } from './SaleDocumentDownloads'

function renderDownloads() {
  return render(
    <MantineProvider theme={theme}>
      <SaleDocumentDownloads
        documents={[
          {
            excelUrl: 'http://example.test/invoice.xlsx',
            label: 'Видаткова накладна',
            pdfUrl: 'http://example.test/invoice.pdf',
          },
        ]}
      />
    </MantineProvider>,
  )
}

describe('SaleDocumentDownloads', () => {
  it('renders PDF before Excel when both files are available', () => {
    renderDownloads()

    const links = screen.getAllByRole('link')

    expect(links.map((link) => link.textContent)).toEqual(['PDF', 'Excel'])
    expect(links[0].getAttribute('href')).toBe('http://example.test/invoice.pdf')
    expect(links[1].getAttribute('href')).toBe('http://example.test/invoice.xlsx')
  })
})
