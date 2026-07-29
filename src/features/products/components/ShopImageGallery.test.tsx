import { MantineProvider } from '@mantine/core'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { theme } from '../../../shared/theme/theme'
import { ShopImageGallery } from './ShopImageGallery'

const originalImage = window.Image
const requestedUrls: string[] = []

class ProbeImageStub {
  onerror: (() => void) | null = null
  onload: (() => void) | null = null

  set src(value: string) {
    requestedUrls.push(value)
    const suffix = Number(value.match(/_(\d+)_water\.jpg$/)?.[1] ?? 0)

    queueMicrotask(() => {
      if (suffix > 0 && suffix <= 2) {
        this.onload?.()
      } else {
        this.onerror?.()
      }
    })
  }
}

describe('ShopImageGallery', () => {
  beforeEach(() => {
    requestedUrls.length = 0
    Object.defineProperty(window, 'Image', {
      configurable: true,
      value: ProbeImageStub as unknown as typeof Image,
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'Image', {
      configurable: true,
      value: originalImage,
    })
  })

  it('stops probing after the first missing batched suffix and reuses the result', async () => {
    const first = renderGallery('SEM94')

    await waitFor(() => {
      expect(screen.getAllByRole('button')).toHaveLength(2)
    })
    expect(requestedUrls).toHaveLength(4)

    first.unmount()
    renderGallery(' sem94 ')

    await waitFor(() => {
      expect(screen.getAllByRole('button')).toHaveLength(2)
    })
    expect(requestedUrls).toHaveLength(4)
  })
})

function renderGallery(vendorCode: string) {
  return render(
    <MantineProvider theme={theme}>
      <ShopImageGallery vendorCode={vendorCode} onImageClick={vi.fn()} />
    </MantineProvider>,
  )
}
