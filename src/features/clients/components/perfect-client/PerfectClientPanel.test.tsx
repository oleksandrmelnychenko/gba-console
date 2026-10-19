import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { theme } from '../../../../shared/theme/theme'
import { getClientResourcePerfectClients } from '../../api/clientLookupsApi'
import { PerfectClientType } from '../../types'
import { PerfectClientPanel } from './PerfectClientPanel'

vi.mock('../../api/clientLookupsApi', () => ({
  getClientResourcePerfectClients: vi.fn(),
  createClientResourcePerfectClient: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(getClientResourcePerfectClients).mockResolvedValue([
    { Id: 1, Lable: 'Приміщення', Type: PerfectClientType.Toggle, Values: [{ Value: 'Орендоване' }, { Value: 'Власне' }] },
    { Id: 2, Lable: 'Товарна марка', Type: PerfectClientType.Checkbox },
  ])
})

function setup(disabled = false) {
  const onChange = vi.fn()
  render(<MantineProvider env="test" theme={theme}><I18nProvider>
    <PerfectClientPanel disabled={disabled} client={{ ClientInRole: { ClientTypeRole: { Id: 1 } }, PerfectClients: [
      { Id: 1, Type: PerfectClientType.Toggle, IsSelected: true, Value: 'Збережена примітка', Values: [{ IsSelected: false }, { IsSelected: false }] },
    ] }} onChange={onChange} />
  </I18nProvider></MantineProvider>)
  return onChange
}

describe('PerfectClientPanel', () => {
  it('selects exactly one side and preserves the comment and other parameters', async () => {
    const onChange = setup()
    const option = await screen.findByRole('radio', { name: 'Орендоване' })
    fireEvent.click(option)
    await waitFor(() => expect(onChange).toHaveBeenCalled())
    const saved = onChange.mock.lastCall?.[0].PerfectClients
    expect(saved).toHaveLength(2)
    expect(saved[0].Value).toBe('Збережена примітка')
    expect(saved[0].Values.map((item: { IsSelected: boolean }) => item.IsSelected)).toEqual([true, false])
  })

  it('filters without changing values and keeps controls locked without edit permission', async () => {
    const onChange = setup(true)
    const option = await screen.findByRole('radio', { name: 'Орендоване' })
    expect((option as HTMLInputElement).disabled).toBe(true)
    fireEvent.change(screen.getByRole('textbox', { name: 'Пошук параметра' }), { target: { value: 'Товарна' } })
    expect(screen.queryByRole('checkbox', { name: 'Приміщення' })).toBeNull()
    expect(screen.getByRole('checkbox', { name: 'Товарна марка' })).toBeTruthy()
    expect(onChange).not.toHaveBeenCalled()
  })
})
