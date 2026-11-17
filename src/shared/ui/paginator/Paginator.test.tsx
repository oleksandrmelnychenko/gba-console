import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n/I18nProvider'
import { Paginator, type PaginatorProps } from './Paginator'

function renderPaginator(props: Partial<PaginatorProps>) {
  const onPageChange = vi.fn()
  render(
    <MantineProvider>
      <I18nProvider>
        <Paginator page={1} pageSize={20} onPageChange={onPageChange} onPageSizeChange={vi.fn()} {...props} />
      </I18nProvider>
    </MantineProvider>,
  )
  const input = screen.getByRole('textbox', { name: 'Номер сторінки' }) as HTMLInputElement
  return { input, onPageChange }
}

function typePage(input: HTMLInputElement, value: string) {
  fireEvent.change(input, { target: { value } })
  fireEvent.blur(input)
}

describe('Paginator page number', () => {
  it('clamps to the current page when the server says there is no next page', () => {
    const { input, onPageChange } = renderPaginator({ hasNext: false })
    typePage(input, '9999')
    expect(onPageChange).not.toHaveBeenCalled()
    expect(input.value).toBe('1')
  })

  it('clamps to the known last page', () => {
    const { input, onPageChange } = renderPaginator({ totalPages: 5 })
    typePage(input, '9999')
    expect(onPageChange).toHaveBeenCalledWith(5)
  })

  it('still jumps forward when more pages exist and the total is unknown', () => {
    const { input, onPageChange } = renderPaginator({ hasNext: true })
    typePage(input, '3')
    expect(onPageChange).toHaveBeenCalledWith(3)
  })
})
