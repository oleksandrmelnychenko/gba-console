import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { theme } from '../../../../shared/theme/theme'
import type { ClientSourceQualitySummary } from '../../types'
import { ClientSourceQualityBadge } from './ClientSourceQualityBadge'

const t = (value: string) => value

describe('ClientSourceQualityBadge', () => {
  it('shows a review marker with source systems and opens the structure', () => {
    const onClick = vi.fn()
    renderBadge(createQuality(), onClick)

    const badge = screen.getByRole('button', { name: /Перевірити 1С/ })
    expect(badge.getAttribute('title')).toContain('Fenix + AMG')
    expect(badge.getAttribute('title')).toContain('Пошкоджений ID джерела')
    fireEvent.click(badge)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('distinguishes a clean snapshot from a client awaiting its first sync', () => {
    const { rerender } = renderBadge({
      ...createQuality(),
      State: 'clean',
      RequiresReview: false,
      Reasons: [],
    })
    expect(screen.getByRole('button', { name: /1С: перевірено/ })).toBeTruthy()

    rerender(
      <MantineProvider theme={theme}>
        <ClientSourceQualityBadge
          quality={{
            ...createQuality(),
            State: 'not_synced',
            RequiresReview: false,
            SourceSnapshotCount: 0,
            SourceSystemCount: 0,
            HasFenixSnapshot: false,
            HasAmgSnapshot: false,
            LastSeenAtUtc: null,
            Reasons: ['source_snapshot_missing'],
          }}
          t={t}
          onClick={vi.fn()}
        />
      </MantineProvider>,
    )
    expect(screen.getByRole('button', { name: /Очікує синку/ })).toBeTruthy()
  })
})

function renderBadge(
  quality: ClientSourceQualitySummary,
  onClick = vi.fn(),
) {
  return render(
    <MantineProvider theme={theme}>
      <ClientSourceQualityBadge
        quality={quality}
        t={t}
        onClick={onClick}
      />
    </MantineProvider>,
  )
}

function createQuality(): ClientSourceQualitySummary {
  return {
    ClientNetUid: '11111111-1111-1111-1111-111111111111',
    AsOfUtc: '2026-08-11T10:00:00Z',
    State: 'review_required',
    RequiresReview: true,
    SourceSnapshotCount: 2,
    SourceSystemCount: 2,
    HasFenixSnapshot: true,
    HasAmgSnapshot: true,
    LastSeenAtUtc: '2026-08-11T09:55:00Z',
    Reasons: ['invalid_source_identity'],
  }
}
