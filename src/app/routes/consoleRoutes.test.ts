import { isValidElement } from 'react'
import { Navigate } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { PaymentArticlesPage } from '../../features/payment-articles/PaymentArticlesPage'
import { consoleRoutes } from './consoleRoutes'

describe('console report routes', () => {
  it('registers both sales-report URLs as direct routes', () => {
    const paths = new Set(consoleRoutes.map((route) => route.path))

    expect(paths.has('/reports/sale')).toBe(true)
    expect(paths.has('/reports/sales')).toBe(true)
  })
})

describe('legacy client return route', () => {
  it('redirects to the canonical order-item return workflow', () => {
    const route = consoleRoutes.find(
      (candidate) => candidate.path === '/sales/return/client',
    )

    expect(isValidElement(route?.element)).toBe(true)

    if (!isValidElement(route?.element)) {
      throw new Error('Expected the legacy client return route to render a redirect')
    }

    expect(route.element.type).toBe(Navigate)
    expect(route.element.props).toMatchObject({
      replace: true,
      to: '/sales/ukraine/all/returns/new',
    })
  })
})

describe('console payment article routes', () => {
  const listPaths = [
    '/accounting/payment-expense-articles',
    '/accounting/payment-cashflow-articles',
  ]
  const formPaths = listPaths.flatMap((path) => [`${path}/new`, `${path}/edit/:id`])

  it('keeps both legacy list and form URLs registered', () => {
    const paths = new Set(consoleRoutes.map((route) => route.path))

    for (const path of [...listPaths, ...formPaths]) {
      expect(paths.has(path)).toBe(true)
    }
  })

  it.each(listPaths)('renders %s as the combined two-table articles screen', (path) => {
    const route = consoleRoutes.find((candidate) => candidate.path === path)

    expect(isValidElement(route?.element)).toBe(true)

    if (!isValidElement(route?.element)) {
      throw new Error(`Expected ${path} to render a React element`)
    }

    expect(route.element.type).toBe(PaymentArticlesPage)
  })
})
