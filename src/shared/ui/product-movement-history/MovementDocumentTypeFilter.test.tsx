import { fireEvent, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithMantine } from '../../../test/renderWithMantine'
import { AppDrawer } from '../AppDrawer'
import { MovementDocumentTypeFilter } from './MovementDocumentTypeFilter'

vi.mock('../../i18n/useI18n', () => ({ useI18n: () => ({ t: (value: string) => value }) }))

const options = [{ label: 'Реалізація', value: 0 }, { label: 'Повернення', value: 1 }, { label: 'Прихід товару', value: 3 }]
function Fixture() {
  const [value, setValue] = useState([0, 1, 3])
  return <><MovementDocumentTypeFilter options={options} value={value} onChange={setValue} /><output>{value.join(',')}</output></>
}

describe('MovementDocumentTypeFilter', () => {
  it('preserves hidden selections while searching and toggling a type', () => {
    renderWithMantine(<Fixture />)
    fireEvent.click(screen.getByRole('button', { name: /Типи документів/ }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Пошук типу документа' }), { target: { value: 'повер' } })
    expect(screen.queryByRole('checkbox', { name: 'Реалізація' })).toBeNull()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Повернення' }))
    expect(screen.getByRole('status').textContent).toBe('0,3')
    fireEvent.change(screen.getByRole('textbox', { name: 'Пошук типу документа' }), { target: { value: '' } })
    expect((screen.getByRole('checkbox', { name: 'Реалізація' }) as HTMLInputElement).checked).toBe(true)
  })

  it('applies all and clear to the complete list even during search', () => {
    renderWithMantine(<Fixture />)
    fireEvent.click(screen.getByRole('button', { name: /Типи документів/ }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Пошук типу документа' }), { target: { value: 'повер' } })
    fireEvent.click(screen.getByRole('button', { name: 'Очистити' }))
    expect(screen.getByRole('status').textContent).toBe('')
    fireEvent.click(screen.getByRole('button', { name: 'Усі' }))
    expect(screen.getByRole('status').textContent).toBe('0,1,3')
  })
  it('closes the list with Escape without dismissing the parent sheet', () => {
    const onClose = vi.fn()
    renderWithMantine(<AppDrawer opened onClose={onClose} title="Рух товару"><Fixture /></AppDrawer>)
    fireEvent.click(screen.getByRole('button', { name: /Типи документів/ }))
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Пошук типу документа' }), { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /Типи документів/ }).getAttribute('aria-expanded')).toBe('false')
  })

})
