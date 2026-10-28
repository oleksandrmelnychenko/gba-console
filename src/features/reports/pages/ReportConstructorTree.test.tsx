import { useState } from 'react'
import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { ReportFieldPicker } from './ReportFieldPicker'
import { ReportMeasureTree } from './ReportMeasureTree'
import { createDefaultMeasurementGroups, flattenCheckedMeasurements } from '../data/reportOptions'
import { datasetMeasurements } from '../data/reportDatasets'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import type { ReportMeasurementGroup } from '../types'

const wrap = (children: React.ReactNode) => render(<MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider>)
afterEach(cleanup)

it('selects multiple fields across searches in click order and applies once', () => {
  const onSelectMany = vi.fn()
  wrap(<ReportFieldPicker opened title="Додати поле" options={[
    { value: '4', label: 'Організація', path: [] },
    { value: '7', label: 'Назва', path: ['Товар'] },
    { value: '13', label: 'Регіон', path: ['Покупець'] },
  ]} onSelect={vi.fn()} onSelectMany={onSelectMany} onClose={vi.fn()} />)
  fireEvent.click(screen.getByRole('checkbox', { name: 'Вибрати Організація' }))
  fireEvent.change(screen.getByLabelText('Пошук поля'), { target: { value: 'товар' } })
  fireEvent.click(screen.getByRole('checkbox', { name: 'Вибрати Назва' }))
  expect(screen.queryByRole('checkbox', { name: 'Вибрати Регіон' })).toBeNull()
  expect(onSelectMany).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Додати вибрані (2)' }))
  expect(onSelectMany).toHaveBeenCalledExactlyOnceWith(['4', '7'])
})

it('cancel does not apply staged fields and reopening starts clean', () => {
  const onSelectMany = vi.fn(), close = vi.fn()
  wrap(<ReportFieldPicker opened title="Додати поле" options={[{ value: '4', label: 'Організація', path: [] }]}
    onSelect={vi.fn()} onSelectMany={onSelectMany} onClose={close} />)
  fireEvent.click(screen.getByRole('checkbox', { name: 'Вибрати Організація' }))
  fireEvent.click(screen.getByRole('button', { name: 'Скасувати' }))
  expect(onSelectMany).not.toHaveBeenCalled()
  expect(close).toHaveBeenCalledOnce()
  expect(screen.getByRole('button', { name: 'Додати вибрані (0)' })).toHaveProperty('disabled', true)
})

it('search and collapse retain choices; order survives dataset and template rehydration', () => {
  const dataset = reportDatasets.find(item => item.DataSource === 2)!
  const initial = datasetMeasurements(dataset, flattenCheckedMeasurements(createDefaultMeasurementGroups()))
  let result: ReportMeasurementGroup[] = []
  function Editor() {
    const [groups, setGroups] = useState(initial)
    result = groups
    return <ReportMeasureTree groups={groups} onChange={setGroups} groupLabel={g => g.Name}
      itemLabel={item => item.Name} itemUnit={() => 'EUR'} />
  }
  wrap(<Editor />)
  fireEvent.change(screen.getByLabelText('Пошук показника'), { target: { value: 'Cost' } })
  fireEvent.click(screen.getByRole('checkbox', { name: 'Cost' }))
  fireEvent.change(screen.getByLabelText('Пошук показника'), { target: { value: '' } })
  const checkedBefore = flattenCheckedMeasurements(result).map(item => item.Type)
  fireEvent.click(screen.getByRole('button', { name: 'Згорнути Cost' }))
  expect(flattenCheckedMeasurements(result).map(item => item.Type)).toEqual(checkedBefore)
  fireEvent.click(screen.getByRole('button', { name: 'Перемістити Cost вище' }))
  const saved = flattenCheckedMeasurements(result)
  expect(flattenCheckedMeasurements(datasetMeasurements(dataset, saved)).map(item => item.Type)).toEqual(saved.map(item => item.Type))
})
