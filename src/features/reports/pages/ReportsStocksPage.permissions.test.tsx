import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { createStockReport } from '../api/reportsApi'
import { ReportsStocksPage } from './ReportsStocksPage'
import { ApiError } from '../../../shared/api/apiClient'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: (permission: string) =>
      allowedPermissions.has(permission),
  }),
}))

vi.mock('../api/reportsApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/reportsApi')>(),
  createStockReport: vi.fn(),
}))

function Providers({ children }: { children: ReactNode }) {
  return (
    <MantineProvider>
      <I18nProvider>{children}</I18nProvider>
    </MantineProvider>
  )
}

describe('stock report permissions', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('offers native reports only, without mounting the archived source-register panel', () => {
    render(<Providers><ReportsStocksPage /></Providers>)
    expect(screen.queryByRole('combobox', { name: 'Джерело звіту' })).toBeNull()
    expect(screen.queryByText('Консолідовані дані 1С')).toBeNull()
    expect(screen.getByRole('button', { name: 'Продажі за товарами' })).toBeTruthy()
    expect(createStockReport).not.toHaveBeenCalled()
  })

  it('fails closed at submit when generate permission is absent', () => {
    const { container } = render(
      <Providers>
        <ReportsStocksPage />
      </Providers>,
    )

    const submit = screen.getByRole('button', { name: 'Сформувати' })
    expect((submit as HTMLButtonElement).disabled).toBe(true)
    expect(submit.getAttribute('title')).toBe(
      'Немає права формувати звіт залишків',
    )

    fireEvent.submit(container.querySelector('form')!)
    expect(createStockReport).not.toHaveBeenCalled()
  })

  it('keeps report validation independent after generate is granted', () => {
    allowedPermissions.add(PermissionKeys.ReportsStocks.Report.Generate)

    render(
      <Providers>
        <ReportsStocksPage />
      </Providers>,
    )

    const submit = screen.getByRole('button', { name: 'Сформувати' })
    expect((submit as HTMLButtonElement).disabled).toBe(true)
    expect(submit.getAttribute('title')).toBe(
      'Виберіть хоча б один показник',
    )
  })

  it('defaults to the Kyiv business day rather than the workstation day', () => {
    vi.stubEnv('TZ', 'UTC')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-05T21:30:00Z'))
    try {
      render(<Providers><ReportsStocksPage /></Providers>)
      expect((screen.getByLabelText('Від') as HTMLInputElement).value).toBe('2026-09-06')
      expect((screen.getByLabelText('До') as HTMLInputElement).value).toBe('2026-09-06')
    } finally {
      vi.useRealTimers()
      vi.unstubAllEnvs()
    }
  })

  it('does not grant generation rights when a ready preset is applied', () => {
    const { container } = render(<Providers><ReportsStocksPage /></Providers>)
    fireEvent.click(screen.getByRole('button', { name: 'Продажі за днями' }))
    expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.submit(container.querySelector('form')!)
    expect(createStockReport).not.toHaveBeenCalled()
  })

  it('applies a preset without generating or overwriting saved templates', async () => {
    allowedPermissions.add(PermissionKeys.ReportsStocks.Report.Generate)
    const saved = JSON.stringify([{ Name: 'Мій звіт', Data: { from: '2026-01-01' } }])
    localStorage.setItem('app_configs_reports_template:v1', saved)
    vi.mocked(createStockReport).mockRejectedValue(new Error('test request'))
    const { container } = render(<Providers><ReportsStocksPage /></Providers>)
    fireEvent.change(screen.getByLabelText('Від'), { target: { value: '2026-09-01' } })
    fireEvent.change(screen.getByLabelText('До'), { target: { value: '2026-09-03' } })

    fireEvent.click(screen.getByRole('button', { name: 'Продажі за днями' }))

    expect(createStockReport).not.toHaveBeenCalled()
    expect(localStorage.getItem('app_configs_reports_template:v1')).toBe(saved)
    expect(screen.getByText(/без віднімання повернень/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0]).toMatchObject({
      from: '2026-09-01', to: '2026-09-03',
      sorted: { Row: [{ type: 3 }, { type: 4 }], Measurements: expect.arrayContaining([{ IsChecked: true, Name: 'CostVAT', Type: 7, parentName: 'Cost' }]) },
    })
    await screen.findByText('Не вдалося сформувати звіт')
  })

  it('explains denied report access without claiming the session expired', async () => {
    allowedPermissions.add(PermissionKeys.ReportsStocks.Report.Generate)
    vi.mocked(createStockReport).mockRejectedValue(new ApiError('Forbidden', 403, null))
    const { container } = render(<Providers><ReportsStocksPage /></Providers>)
    fireEvent.click(screen.getByRole('button', { name: 'Продажі за товарами' }))
    fireEvent.submit(container.querySelector('form')!)
    await screen.findByText('Недостатньо прав для формування звіту. Зверніться до адміністратора щодо доступу до конструктора звітів.')
    expect(screen.queryByText('Сесію завершено. Увійдіть повторно.')).toBeNull()
  })
})
