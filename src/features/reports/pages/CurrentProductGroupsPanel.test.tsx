import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { expect, it } from 'vitest'
import { CurrentProductFieldsPanel } from './CurrentProductFieldsPanel'
import { currentProductCapability, type WorkbookSelection } from '../data/workbookPresentation'
import { productGroupsDataset, productGroupsRequest } from '../data/currentProductGroups.test-fixtures'
import { productDataset } from '../data/currentProductFields.test-fixtures'

it('keeps an unsupported saved list visible and removable on an older server instead of clearing its identity', () => {
  function Form() {
    const [selection, setSelection] = useState<WorkbookSelection | undefined>({ version: 3, additionalFields: [67, 2], ordering: null })
    return <><CurrentProductFieldsPanel capability={currentProductCapability(productDataset)} request={productGroupsRequest()} value={selection} disabled={false} onChange={setSelection} /><output>{JSON.stringify(selection)}</output></>
  }
  render(<MantineProvider env="test"><Form /></MantineProvider>)
  expect(screen.getByText(/Поточний сервер не підтвердив список груп товару/)).toBeTruthy()
  expect(screen.getByRole('checkbox', { name: 'Групи (поточний товар)' })).toHaveProperty('checked', true)
  fireEvent.click(screen.getByRole('checkbox', { name: 'Групи (поточний товар)' }))
  expect(JSON.parse(screen.getByRole('status').textContent!)).toEqual({ version: 2, additionalFields: [2], ordering: null })
  expect(screen.queryByText(/Поточний сервер не підтвердив список груп товару/)).toBeNull()
  expect(screen.getByRole('checkbox', { name: 'Артикул (поточний товар)' })).toHaveProperty('checked', true)
})
it('upgrades only when adding groups and retains v3 when removing the field on a new server', () => {
  function Form() {
    const [selection, setSelection] = useState<WorkbookSelection | undefined>({ version: 2, additionalFields: [66, 2], ordering: null })
    return <><CurrentProductFieldsPanel capability={currentProductCapability(productGroupsDataset)} request={productGroupsRequest()} value={selection} disabled={false} onChange={setSelection} /><output>{JSON.stringify(selection)}</output></>
  }
  render(<MantineProvider env="test"><Form /></MantineProvider>)
  expect(JSON.parse(screen.getByRole('status').textContent!).version).toBe(2)
  fireEvent.click(screen.getByRole('checkbox', { name: 'Групи (поточний товар)' }))
  expect(JSON.parse(screen.getByRole('status').textContent!)).toEqual({ version: 3, additionalFields: [66, 2, 67], ordering: null })
  fireEvent.click(screen.getByRole('checkbox', { name: 'Групи (поточний товар)' }))
  expect(JSON.parse(screen.getByRole('status').textContent!)).toEqual({ version: 3, additionalFields: [66, 2], ordering: null })
})
