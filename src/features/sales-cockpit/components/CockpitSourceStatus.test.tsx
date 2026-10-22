import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCockpitSource, type CockpitSource } from '../api/sourceApi'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { CockpitSourceStatus } from './CockpitSourceStatus'

vi.mock('../api/sourceApi', () => ({ getCockpitSource: vi.fn() }))
const source: CockpitSource = {
  sourceEnvironment: 'qa', asOf: '2026-10-22T12:00:00Z', watermark: null,
  watermarkKind: 'latest_valid_sale_activity', syncFreshnessKnown: false, historyStartDate: '2025-01-01',
  sourceAvailable: true, sourceReady: false, taskStoreAvailable: true,
  generationEnabled: false, generationReady: false, lastGenerationAt: null,
}
const renderStatus = (head = false) => render(<MantineProvider><I18nProvider><CockpitSourceStatus head={head} /></I18nProvider></MantineProvider>)

describe('Cockpit source provenance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.documentElement.dataset.gbaEnv = 'qa'
    vi.mocked(getCockpitSource).mockResolvedValue(source)
  })
  it('labels an empty QA namespace without claiming healthy generation or completed sync', async () => {
    renderStatus()
    expect(await screen.findByText('Клієнти й робоча черга: QA')).toBeTruthy()
    expect(screen.getByText('Ця перевірка не охоплює товарні рекомендації; їхнє джерело окремо не підтверджено.')).toBeTruthy()
    expect(screen.getByText('Актуальне формування AI-черги не підтверджено.')).toBeTruthy()
    expect(screen.getByText('Автоматичне формування AI-задач у цьому середовищі вимкнено.')).toBeTruthy()
    expect(screen.getByText('Дата активності продажів не підтверджує завершення синхронізації.')).toBeTruthy()
    expect(getCockpitSource).toHaveBeenCalledWith(false, expect.any(AbortSignal))
  })
  it('shows DEV provenance and warns if the console is switched to QA', async () => {
    vi.mocked(getCockpitSource).mockResolvedValue({ ...source, sourceEnvironment: 'dev', watermark: '2026-10-22T10:00:00Z' })
    renderStatus(true)
    expect(await screen.findByText('Клієнти й робоча черга: DEV')).toBeTruthy()
    expect(screen.getByText('Джерело відрізняється від вибраного середовища.')).toBeTruthy()
    expect(getCockpitSource).toHaveBeenCalledWith(true, expect.any(AbortSignal))
  })
  it('never infers provenance from the selected environment after an error', async () => {
    vi.mocked(getCockpitSource).mockRejectedValue(new Error('unavailable'))
    renderStatus()
    expect(await screen.findByText('Джерело даних не підтверджено')).toBeTruthy()
    expect(screen.queryByText('Клієнти й робоча черга: QA')).toBeNull()
  })
})
