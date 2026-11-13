import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { ForecastHorizonShapeNote, ForecastPairCaveat } from './SalesForecastNotes'

function show(node: React.ReactNode) {
  return render(<MantineProvider env="test"><I18nProvider>{node}</I18nProvider></MantineProvider>)
}

it('says the forecast is a flat run rate when the service reports that shape', () => {
  show(<ForecastHorizonShapeNote horizonShape="flat_run_rate" />)
  expect(screen.getByTestId('forecast-horizon-shape').textContent)
    .toBe('Прогноз — рівень поточного темпу продажів на кожен місяць (без сезонності й тренду)')
})

it.each([null, undefined, 'damped_trend'])('says nothing about the shape for %s', (shape) => {
  show(<ForecastHorizonShapeNote horizonShape={shape} />)
  expect(screen.queryByTestId('forecast-horizon-shape')).toBeNull()
})

it('marks the client-and-product forecast as an upper guide', () => {
  show(<ForecastPairCaveat />)
  expect(screen.getByTestId('forecast-pair-caveat').textContent).toContain('орієнтир зверху')
  expect(screen.getByTestId('forecast-pair-caveat').textContent).toContain('22–28 %')
})
