import { useState } from 'react'
import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { ReportMeasureTree } from './ReportMeasureTree'
import { flattenCheckedMeasurements } from '../data/reportOptions'
import type { ReportMeasurementGroup } from '../types'

const initial: ReportMeasurementGroup[] = [
  { Name: 'Cost', Label: 'Собівартість', IsChecked: false, SubList: [
    { Name: 'CostVAT', Label: 'ПДВ собівартості', Type: 5, IsChecked: false },
    { Name: 'CostWithVAT', Label: 'Собівартість з ПДВ', Type: 4, IsChecked: true },
    { Name: 'CostWithoutVAT', Label: 'Собівартість без ПДВ', Type: 6, IsChecked: true }] },
  { Name: 'SalesQuantity', Label: 'Кількість', IsChecked: true, SubList: [
    { Name: 'SalesQuantity', Label: 'Кількість', Type: 0, IsChecked: true }] },
]
it('sorts the whole tree during search without toggling choices, then allows manual order and keeps collapse state', () => {
  let state = initial
  function Editor() {
    const [groups, setGroups] = useState(initial); state = groups
    return <ReportMeasureTree groups={groups} onChange={setGroups} groupLabel={g => g.Label!}
      itemLabel={item => item.Label!} itemUnit={() => 'EUR'} />
  }
  render(<MantineProvider env="test"><I18nProvider><Editor /></I18nProvider></MantineProvider>)
  expect(screen.getByRole('group', { name: 'Порядок усіх показників' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Згорнути Собівартість' }))
  fireEvent.change(screen.getByLabelText('Пошук показника'), { target: { value: 'Кількість' } })
  fireEvent.click(screen.getByRole('button', { name: 'Упорядкувати всі показники від А до Я' }))
  expect(screen.getByLabelText('Пошук показника')).toHaveProperty('value', 'Кількість')
  expect(state.map(group => group.Name)).toEqual(['SalesQuantity', 'Cost'])
  expect(state[1].SubList.map(item => item.Type)).toEqual([6, 4, 5]) // Visible Без ПДВ / З ПДВ / ПДВ.
  expect(flattenCheckedMeasurements(state).map(item => item.Type)).toEqual([0, 6, 4])
  fireEvent.change(screen.getByLabelText('Пошук показника'), { target: { value: '' } })
  expect(screen.getByRole('button', { name: 'Розгорнути Собівартість' }).getAttribute('aria-expanded')).toBe('false')
  fireEvent.click(screen.getByRole('button', { name: 'Упорядкувати всі показники від Я до А' }))
  expect(state.map(group => group.Name)).toEqual(['Cost', 'SalesQuantity'])
  expect(state[0].SubList.map(item => item.Type)).toEqual([5, 4, 6])
  fireEvent.click(screen.getByRole('button', { name: 'Розгорнути Собівартість' }))
  fireEvent.click(screen.getByRole('button', { name: 'Перемістити Собівартість без ПДВ вище' }))
  fireEvent.click(screen.getByRole('button', { name: 'Перемістити Собівартість нижче' }))
  expect(flattenCheckedMeasurements(state).map(item => item.Type)).toEqual([0, 6, 4])
  expect(state[1].SubList.find(item => item.Type === 5)?.IsChecked).toBe(false)
  fireEvent.click(screen.getByRole('checkbox', { name: 'ПДВ собівартості' }))
  expect(flattenCheckedMeasurements(state).map(item => item.Type)).toEqual([0, 5, 6, 4]) // No sticky sorting after manual moves.
})
it.each([{ groups: [] }, { groups: [initial[1]] }])('disables alphabetic controls when there is nothing to reorder', ({ groups }) => {
  const onChange = vi.fn()
  render(<MantineProvider env="test"><ReportMeasureTree groups={groups} onChange={onChange}
    groupLabel={g => g.Label!} itemLabel={item => item.Label!} itemUnit={() => ''} /></MantineProvider>)
  for (const name of ['Упорядкувати всі показники від А до Я', 'Упорядкувати всі показники від Я до А']) {
    const button = screen.getByRole('button', { name }); expect(button).toHaveProperty('disabled', true)
    expect(button.getAttribute('type')).toBe('button'); fireEvent.click(button)
  }
  expect(onChange).not.toHaveBeenCalled()
})
