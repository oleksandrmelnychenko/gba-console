import { fireEvent, render, screen } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { useCloseToFallback } from './useCloseToFallback'

function Overlay() {
  const close = useCloseToFallback('/orders/ukraine/all/edit/order-1')
  return <button type="button" onClick={close}>Закрити</button>
}

function Where() {
  return <output>{useLocation().pathname}</output>
}

function renderAt(initialEntries: string[]) {
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/products" element={<Link to="/orders/ukraine/all/edit/order-1/product-income">open</Link>} />
        <Route path="/orders/ukraine/all/edit/:id/product-income" element={<Overlay />} />
        <Route path="*" element={null} />
      </Routes>
      <Where />
    </MemoryRouter>,
  )
}

describe('useCloseToFallback', () => {
  it('a deep link closes to the order, not to the page that was open before', () => {
    renderAt(['/orders/ukraine/all/edit/order-1/product-income'])

    fireEvent.click(screen.getByRole('button', { name: 'Закрити' }))
    expect(screen.getByRole('status').textContent).toBe('/orders/ukraine/all/edit/order-1')
  })

  it('opened from inside the console, closing goes back', () => {
    renderAt(['/products'])

    fireEvent.click(screen.getByRole('link', { name: 'open' }))
    fireEvent.click(screen.getByRole('button', { name: 'Закрити' }))
    expect(screen.getByRole('status').textContent).toBe('/products')
  })
})
