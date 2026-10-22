import { Drawer, MantineProvider } from '@mantine/core'
import { DatesProvider } from '@mantine/dates'
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import 'dayjs/locale/uk'
import { AppDateInput } from './AppDateInput'

function Harness({
  initial = '',
  onValue,
  ...props
}: { initial?: string; onValue: (value: string) => void } & Partial<Parameters<typeof AppDateInput>[0]>) {
  const [value, setValue] = useState(initial)

  return (
    <AppDateInput
      label="Дата"
      value={value}
      onChange={(event) => {
        setValue(event.currentTarget.value)
        onValue(event.currentTarget.value)
      }}
      {...props}
    />
  )
}

function setup(props: Partial<Parameters<typeof Harness>[0]> = {}) {
  const onValue = vi.fn()
  render(
    <MantineProvider env="test">
      <DatesProvider settings={{ locale: 'uk', firstDayOfWeek: 1 }}>
        <Harness onValue={onValue} {...props} />
      </DatesProvider>
    </MantineProvider>,
  )
  return { input: screen.getByLabelText('Дата') as HTMLInputElement, onValue }
}

describe('AppDateInput', () => {
  it('shows a native date value in the Ukrainian format', () => {
    const { input } = setup({ initial: '2026-10-01' })
    expect(input.value).toBe('01.10.2026')
  })

  it.each(['05.10.2026', '5.10.2026', '2026-10-05'])('emits the native value for typed %s', (typed) => {
    const { input, onValue } = setup()
    fireEvent.change(input, { target: { value: typed } })
    expect(onValue).toHaveBeenLastCalledWith('2026-10-05')
  })

  it('ignores partial and impossible dates', () => {
    const { input, onValue } = setup()
    fireEvent.change(input, { target: { value: '31.02.2026' } })
    fireEvent.change(input, { target: { value: '01.10.20' } })
    expect(onValue).not.toHaveBeenCalled()
  })

  it('keeps native min/max semantics: bounds on the field, typed values left to the form', () => {
    const { input, onValue } = setup({ min: '2026-10-01', max: '2026-10-31' })
    expect(input.min).toBe('2026-10-01')
    expect(input.max).toBe('2026-10-31')
    fireEvent.change(input, { target: { value: '30.09.2026' } })
    expect(onValue).toHaveBeenLastCalledWith('2026-09-30')
  })

  it('follows a form reset while the field is being edited', () => {
    const onValue = vi.fn()
    function Resettable() {
      const [value, setValue] = useState('2026-10-01')
      return (
        <>
          <AppDateInput label="Дата" value={value} onChange={(event) => { setValue(event.currentTarget.value); onValue(event.currentTarget.value) }} />
          <button type="button" onClick={() => setValue('')}>Скинути</button>
        </>
      )
    }
    render(<MantineProvider env="test"><Resettable /></MantineProvider>)
    fireEvent.change(screen.getByLabelText('Дата'), { target: { value: '05.10.2026' } })
    expect(onValue).toHaveBeenLastCalledWith('2026-10-05')
    fireEvent.click(screen.getByRole('button', { name: 'Скинути' }))
    expect((screen.getByLabelText('Дата') as HTMLInputElement).value).toBe('')
  })

  it('clears an optional value to an empty string', () => {
    const { input, onValue } = setup({ initial: '2026-10-01' })
    fireEvent.change(input, { target: { value: '' } })
    expect(onValue).toHaveBeenLastCalledWith('')
  })

  it('round-trips datetime-local values', () => {
    const { input, onValue } = setup({ initial: '2026-10-01T09:30', type: 'datetime-local' })
    expect(input.value).toBe('01.10.2026 09:30')
    fireEvent.change(input, { target: { value: '02.10.2026 18:05' } })
    expect(onValue).toHaveBeenLastCalledWith('2026-10-02T18:05')
  })
})


describe('native form and drawer compatibility', () => {
  it('blocks malformed typing until corrected without emitting an impossible date', () => {
    const { input, onValue } = setup({ initial: '2026-10-01' })
    fireEvent.change(input, { target: { value: '31.02.2026' } })
    expect(input.checkValidity()).toBe(false)
    expect(onValue).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: '02.10.2026' } })
    expect(input.checkValidity()).toBe(true)
  })

  it('enforces initial and typed bounds through native form validity', () => {
    const { input, onValue } = setup({ initial: '2026-09-30', min: '2026-10-01', max: '2026-10-31' })
    expect(input.checkValidity()).toBe(false)
    fireEvent.change(input, { target: { value: '01.11.2026' } })
    expect(onValue).toHaveBeenLastCalledWith('2026-11-01')
    expect(input.checkValidity()).toBe(false)
    fireEvent.change(input, { target: { value: '31.10.2026' } })
    expect(input.checkValidity()).toBe(true)
  })

  it('enforces time bounds on the same day', () => {
    const { input } = setup({ type: 'datetime-local', initial: '2026-10-01T09:00', min: '2026-10-01T09:30', max: '2026-10-01T18:00' })
    expect(input.checkValidity()).toBe(false)
    fireEvent.change(input, { target: { value: '01.10.2026 09:30' } })
    expect(input.checkValidity()).toBe(true)
  })

  it('preserves the current time when selecting another calendar day', () => {
    const { input, onValue } = setup({ type: 'datetime-local', initial: '2026-10-01T09:30', getDayProps: day => ({ 'aria-label': day }) })
    fireEvent.focus(input)
    fireEvent.click(screen.getByRole('button', { name: '2026-10-02' }))
    expect(onValue).toHaveBeenLastCalledWith('2026-10-02T09:30')
  })

  it('Escape first closes the focused calendar and then the host drawer', () => {
    const onClose = vi.fn()
    render(<MantineProvider env="test"><Drawer opened onClose={onClose} title="Документ">
      <AppDateInput label="Дата" value="2026-10-01" onChange={vi.fn()} />
    </Drawer></MantineProvider>)
    const input = screen.getByLabelText('Дата')
    fireEvent.focus(input)
    expect(screen.getByRole('grid')).toBeTruthy()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('grid')).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })
})

it('clears an old bounds error when the calendar selects an allowed day', () => {
  const { input } = setup({ initial: '2026-09-30', min: '2026-10-01', getDayProps: day => ({ 'aria-label': day }) })
  expect(input.checkValidity()).toBe(false)
  fireEvent.focus(input)
  fireEvent.click(screen.getByRole('button', { name: '2026-10-02' }))
  expect(input.checkValidity()).toBe(true)
})

it('Escape on a portaled calendar cell closes only the picker inside a Drawer', () => {
  const onClose = vi.fn()
  render(<MantineProvider env="test"><Drawer opened onClose={onClose} title="Документ">
    <AppDateInput label="Дата" value="2026-10-01" onChange={vi.fn()} getDayProps={day => ({ 'aria-label': day })} />
  </Drawer></MantineProvider>)
  fireEvent.focus(screen.getByLabelText('Дата'))
  fireEvent.keyDown(screen.getByRole('button', { name: '2026-10-02' }), { key: 'Escape' })
  expect(onClose).not.toHaveBeenCalled()
  expect(screen.queryByRole('grid')).toBeNull()
  expect(screen.getByRole('dialog', { name: 'Документ' })).toBeTruthy()
})

it('clears from the calendar clear button and closes the popup', () => {
  const { input, onValue } = setup({ initial: '2026-10-01', clearButtonProps: { 'aria-label': 'Очистити дату' } })
  fireEvent.focus(input)
  fireEvent.click(screen.getByRole('button', { name: 'Очистити дату' }))
  expect(onValue).toHaveBeenLastCalledWith('')
  expect(input.value).toBe('')
  expect(screen.queryByRole('grid')).toBeNull()
})
