import { fireEvent, render, screen } from '@testing-library/react'
import { Truck } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { TransporterLogo } from '../ui/TransporterLogo'
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

  it('shows the fallback instead of a broken image when a custom carrier image fails to load', () => {
    const { container } = render(
      <TransporterIcon
        fallback={<Truck aria-hidden="true" size={16} />}
        imageUrl="http://85.17.167.167:20001/Images/Products/missing.PNG"
        name="НАШЕ АВТО"
      />,
    )

    const image = screen.getByRole('img', { name: 'НАШЕ АВТО' })
    expect(image.getAttribute('src')).toBe('/Images/Products/missing.PNG')

    fireEvent.error(image)

    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('svg.lucide-truck')).not.toBeNull()
  })

  it('renders nothing instead of a broken image when a failed carrier image has no fallback', () => {
    const { container } = render(
      <TransporterIcon imageUrl="https://cdn.example.test/missing.png" name="Custom" />,
    )

    fireEvent.error(screen.getByRole('img', { name: 'Custom' }))

    expect(container.querySelector('img')).toBeNull()
    expect(container.innerHTML).toBe('')
  })

  it('tries a new carrier image after the previous one failed', () => {
    const { container, rerender } = render(
      <TransporterIcon imageUrl="https://cdn.example.test/missing.png" name="Custom" />,
    )

    fireEvent.error(screen.getByRole('img', { name: 'Custom' }))
    expect(container.querySelector('img')).toBeNull()

    rerender(<TransporterIcon imageUrl="https://cdn.example.test/other.png" name="Custom" />)

    expect(screen.getByRole('img', { name: 'Custom' }).getAttribute('src')).toBe('https://cdn.example.test/other.png')
  })

  it('renders the semantic bus icon in the main sales-grid logo component', () => {
    const { container } = render(
      <TransporterLogo
        cssClass="bus_item_class"
        imageUrl="http://retired.example.test/bus.png"
        name="Автобус"
      />,
    )

    expect(container.querySelector('svg.lucide-bus')).not.toBeNull()
    expect(container.querySelector('svg.lucide-truck')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
  })
})
