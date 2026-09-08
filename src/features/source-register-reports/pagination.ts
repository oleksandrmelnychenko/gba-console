type PaginationControl = 'first' | 'previous' | 'last' | 'next'
const CONTROL_LABELS = { first: 'Перша сторінка', previous: 'Попередня сторінка', last: 'Остання сторінка', next: 'Наступна сторінка' } as const

/** Localized names for Mantine's icon-only controls; the surrounding navigation identifies its scope. */
export function registerPaginationControlProps(control: PaginationControl): { 'aria-label': string } {
  return { 'aria-label': CONTROL_LABELS[control] }
}
