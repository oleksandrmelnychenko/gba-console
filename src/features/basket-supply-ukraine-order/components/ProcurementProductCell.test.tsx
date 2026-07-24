import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProcurementProductCell } from './ProcurementProductCell'

const t = (key: string) => key

describe('ProcurementProductCell', () => {
  it('shows the product identity and routes API image URLs through the local proxy', () => {
    const { container } = render(
      <ProcurementProductCell
        row={{
          image_url: 'https://85.17.167.167:20001/Images/products/item.png',
          oe_number: 'OE-441',
          product_id: 42,
          product_name: 'Гальмівний диск передній',
          vendor_code: 'BR-2048',
        }}
        t={t}
      />,
    )

    expect(screen.getByText('Гальмівний диск передній')).not.toBeNull()
    expect(screen.getByText('BR-2048')).not.toBeNull()
    expect(screen.getByText('OE-441')).not.toBeNull()
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      '/Images/products/item.png',
    )
  })

  it('replaces a broken image with a visible fallback', () => {
    const { container } = render(
      <ProcurementProductCell
        row={{
          image_url: 'https://cdn.example.test/missing.png',
          oe_number: null,
          product_id: 42,
          product_name: null,
          vendor_code: null,
        }}
        t={t}
      />,
    )

    const image = container.querySelector('img')
    expect(image).not.toBeNull()
    fireEvent.error(image as HTMLImageElement)

    expect(screen.getByText('42')).not.toBeNull()
    expect(
      screen.getByRole('img', { name: 'Зображення товару відсутнє' }),
    ).not.toBeNull()
  })

  it('uses the shop image when procurement data has no explicit image', () => {
    const { container } = render(
      <ProcurementProductCell
        row={{
          image_url: null,
          oe_number: null,
          product_id: 42,
          product_name: 'Гальмівний диск',
          vendor_code: 'BR.20/48',
        }}
        t={t}
      />,
    )

    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'https://concord-shop.com/userdata/shop/product/br~20%2348_water.jpg',
    )
  })

  it('uses the vendor code as the primary identity when the product name is missing', () => {
    render(
      <ProcurementProductCell
        row={{
          image_url: null,
          oe_number: 'OE-441',
          product_id: 42,
          product_name: null,
          vendor_code: 'BR-2048',
        }}
        t={t}
      />,
    )

    expect(screen.getByText('BR-2048')).not.toBeNull()
    expect(screen.getAllByText('BR-2048')).toHaveLength(1)
    expect(screen.queryByText('#42')).toBeNull()
  })

  it('falls back to the shop image when the API image cannot load', () => {
    const { container } = render(
      <ProcurementProductCell
        row={{
          image_url: 'https://cdn.example.test/missing.png',
          oe_number: null,
          product_id: 42,
          product_name: 'Гальмівний диск',
          vendor_code: 'BR-2048',
        }}
        t={t}
      />,
    )

    fireEvent.error(container.querySelector('img') as HTMLImageElement)

    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'https://concord-shop.com/userdata/shop/product/br-2048_water.jpg',
    )
  })
})
