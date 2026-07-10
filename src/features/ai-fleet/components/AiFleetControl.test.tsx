import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { theme } from '../../../shared/theme/theme'
import type { AiFleetServicesSnapshot } from '../types'

const getAiFleetServicesSnapshot = vi.fn<() => Promise<AiFleetServicesSnapshot>>()
const triggerAiFleetWarmup = vi.fn<() => Promise<void>>()

vi.mock('@mantine/charts', () => ({
  DonutChart: ({ chartLabel }: { chartLabel?: string }) => <div data-testid="fleet-chart">{chartLabel}</div>,
}))

vi.mock('../api/aiFleetApi', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/aiFleetApi')>()

  return {
    ...original,
    getAiFleetServicesSnapshot: () => getAiFleetServicesSnapshot(),
    triggerAiFleetWarmup: () => triggerAiFleetWarmup(),
  }
})

import { AI_FLEET_SERVICES } from '../api/aiFleetApi'
import { AiFleetControl } from './AiFleetControl'

function buildSnapshot(telemetryError?: string): AiFleetServicesSnapshot {
  const finishedAt = new Date().toISOString()

  return {
    statuses: AI_FLEET_SERVICES.map((service) => ({
      health: { state: 'healthy' },
      serviceId: service.id,
      warmup: {
        lastFinishedAtUtc: finishedAt,
        state: telemetryError ? 'unknown' : 'healthy',
      },
    })),
    telemetryError,
  }
}

function renderControl(canRunWarmup: boolean) {
  return render(
    <MemoryRouter>
      <MantineProvider theme={theme}>
        <I18nProvider>
          <AiFleetControl canRunWarmup={canRunWarmup} />
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  getAiFleetServicesSnapshot.mockReset()
  triggerAiFleetWarmup.mockReset()
  getAiFleetServicesSnapshot.mockResolvedValue(buildSnapshot())
  triggerAiFleetWarmup.mockResolvedValue()
})

describe('AiFleetControl', () => {
  it('loads fleet status while hiding the warmup action from regular users', async () => {
    renderControl(false)

    fireEvent.click(screen.getByRole('button', { name: 'AI флот' }))

    await waitFor(() => expect(getAiFleetServicesSnapshot).toHaveBeenCalledTimes(1))
    expect(await screen.findAllByText('gba-products')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Запустити' })).toBeNull()
  })

  it('shows the warmup action to privileged users', async () => {
    renderControl(true)

    fireEvent.click(screen.getByRole('button', { name: 'AI флот' }))

    expect(await screen.findByRole('button', { name: 'Запустити' })).toBeTruthy()
  })

  it('surfaces a partial fleet telemetry failure', async () => {
    getAiFleetServicesSnapshot.mockResolvedValue(buildSnapshot('Статус 05:00 недоступний: 503'))
    renderControl(false)

    fireEvent.click(screen.getByRole('button', { name: 'AI флот' }))

    expect(await screen.findByText('Статус 05:00 не оновлено')).toBeTruthy()
    expect(screen.getByText(/503/)).toBeTruthy()
  })

  it('keeps the last successful warmup data after a malformed refresh', async () => {
    renderControl(false)
    fireEvent.click(screen.getByRole('button', { name: 'AI флот' }))

    expect(await screen.findAllByText('05:00: OK')).toHaveLength(7)

    getAiFleetServicesSnapshot.mockResolvedValue(buildSnapshot('Статус 05:00 повернув неповні дані.'))
    fireEvent.click(screen.getByRole('button', { name: 'Оновити' }))

    await waitFor(() => expect(getAiFleetServicesSnapshot).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('Статус 05:00 не оновлено')).toBeTruthy()
    expect(screen.getAllByText('05:00: OK')).toHaveLength(7)
  })
})
