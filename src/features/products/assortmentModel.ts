import type { Product, ProductReservation, ProductSearchMode, ProductSortMode } from './types'

export const PAGE_SIZE = 20
export const VIRTUAL_PAGE_SIZE = 10
export const SEARCH_DEBOUNCE_MS = 250
export const DEFAULT_SEARCH_MODE: ProductSearchMode = '5'
export const DEFAULT_SORT_MODE: ProductSortMode = '2'

export type CarouselMode = 'search' | 'selection'

export type InlineDetailState = {
  error: string | null
  isLoading: boolean
  product: Product | null
  reservation: ProductReservation
  reservationError: string | null
}

export type InlineDetailAction =
  | { type: 'clear' }
  | { type: 'error'; error: string; product: Product | null }
  | { type: 'loading' }
  | { type: 'saved'; product: Product }
  | { type: 'success'; product: Product | null; reservation: ProductReservation; reservationError: string | null }

export function inlineDetailReducer(state: InlineDetailState, action: InlineDetailAction): InlineDetailState {
  switch (action.type) {
    case 'clear':
      return {
        error: null,
        isLoading: false,
        product: null,
        reservation: {},
        reservationError: null,
      }
    case 'error':
      return {
        error: action.error,
        isLoading: false,
        product: action.product,
        reservation: {},
        reservationError: null,
      }
    case 'loading':
      return {
        ...state,
        error: null,
        isLoading: true,
        reservationError: null,
      }
    case 'saved':
      return {
        ...state,
        error: null,
        isLoading: false,
        product: action.product,
      }
    case 'success':
      return {
        error: null,
        isLoading: false,
        product: action.product,
        reservation: action.reservation,
        reservationError: action.reservationError,
      }
  }
}

export function getProductIdentity(product: Product): string {
  return String(product.NetUid || product.Id || product.VendorCode || product.Name || 'product')
}

// Keeps only products whose identity hasn't been seen yet; mutates `seen` so the
// same identity can never appear twice across the top rail / selection / bottom rail.
export function dedupeProductsBySet(products: Product[], seen: Set<string>): Product[] {
  const result: Product[] = []

  for (const product of products) {
    const id = getProductIdentity(product)

    if (seen.has(id)) {
      continue
    }

    seen.add(id)
    result.push(product)
  }

  return result
}

export function getNextSearchedProducts(product: Product): Product[] {
  const nextProducts = (product as Product & { NextSearchedProducts?: Product[] }).NextSearchedProducts

  return Array.isArray(nextProducts) ? nextProducts : []
}

export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  const tagName = target.tagName.toLowerCase()

  return target.isContentEditable || tagName === 'button' || tagName === 'input' || tagName === 'select' || tagName === 'textarea'
}
