import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TransporterIcon } from './TransporterIcon'

describe('TransporterIcon', () => {
  it('uses the bus icon instead of a stale legacy image URL', () => {
    const { container } = render(
      <TransporterIcon imageUrl="http://retired.example.test/bus.png" name="Автобус" />,
    )

    expect(container.querySelector('svg.lucide-bus')).not.toBeNull()
    expect(container.querySelector('img')).toBeNull()
  })

  it('recognizes the legacy bus class even when the display name differs', () => {
    const { container } = render(
      <TransporterIcon cssClass="bus_item_class" imageUrl="http://retired.example.test/bus.png" name="Bus carrier" />,
    )

    expect(container.querySelector('svg.lucide-bus')).not.toBeNull()
    expect(container.querySelector('img')).toBeNull()
  })

  it('keeps custom images for transporters without a semantic or bundled icon', () => {
    render(<TransporterIcon imageUrl="https://cdn.example.test/custom.png" name="Custom" />)

    expect(screen.getByRole('img', { name: 'Custom' }).getAttribute('src'))
      .toBe('https://cdn.example.test/custom.png')
  })
})
