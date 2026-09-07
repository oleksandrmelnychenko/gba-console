import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getReportCatalogue } from '../api/reportWorkspaceApi'
import { ReportCataloguePanel } from './ReportCataloguePanel'

vi.mock('../api/reportWorkspaceApi', () => ({getReportCatalogue:vi.fn()}))
it('labels source presentation inventory without claiming native report or complex-view readiness', async () => {
  vi.mocked(getReportCatalogue).mockResolvedValue({CapturedOn:'2026-09-07',Reports:[],Presentations:[{Id:'complex',Title:'Складне представлення'}]})
  render(<MantineProvider><I18nProvider><ReportCataloguePanel /></I18nProvider></MantineProvider>)
  expect(await screen.findByText('Типи подання у вихідних конфігураціях 1С; це не перелік готових подань GBA.')).toBeTruthy()
  expect(screen.getByText(/Готові налаштування доступних звітів/)).toBeTruthy()
  expect(screen.getByText('Складне представлення')).toBeTruthy()
  expect(screen.queryByText(/Готові налаштування продажів/)).toBeNull()
})
