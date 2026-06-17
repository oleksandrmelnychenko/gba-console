import { describe, expect, it } from 'vitest'
import { renderWithMantine } from '../../../test/renderWithMantine'
import { AgingBars } from './AgingBars'
import { ForecastLine } from './ForecastLine'
import { MarginWaterfall } from './MarginWaterfall'
import { RangeBandChart } from './RangeBandChart'
import { TaskTypeDonut } from './TaskTypeDonut'
import { UrgencyDonut } from './UrgencyDonut'

describe('chart-kit render', () => {
  it('RangeBandChart shows the empty label when there is nothing to plot', () => {
    const { getByText } = renderWithMantine(
      <RangeBandChart emptyLabel="немає даних" high={null} low={null} markers={[]} median={null} />,
    )
    expect(getByText('немає даних')).toBeTruthy()
  })

  it('RangeBandChart mounts an svg when a band is provided', () => {
    const { container } = renderWithMantine(
      <RangeBandChart
        emptyLabel="немає даних"
        high={20}
        low={10}
        markers={[{ value: 8, label: 'мін.' }]}
        median={15}
      />,
    )
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('RangeBandChart shows the loading label', () => {
    const { getByText } = renderWithMantine(
      <RangeBandChart emptyLabel="немає" high={null} isLoading loadingLabel="завантаження" low={null} />,
    )
    expect(getByText('завантаження')).toBeTruthy()
  })

  it('MarginWaterfall renders empty state and a populated chart', () => {
    const empty = renderWithMantine(<MarginWaterfall emptyLabel="порожньо" steps={[]} />)
    expect(empty.getByText('порожньо')).toBeTruthy()

    const filled = renderWithMantine(
      <MarginWaterfall
        emptyLabel="порожньо"
        steps={[
          { key: 'cost', label: 'собівартість', value: 10 },
          { key: 'reco', label: 'рекомендована', value: 16 },
        ]}
      />,
    )
    expect(filled.container.querySelector('svg')).toBeTruthy()
  })

  it('UrgencyDonut renders empty state and a populated donut', () => {
    const empty = renderWithMantine(<UrgencyDonut data={[]} emptyLabel="порожньо" />)
    expect(empty.getByText('порожньо')).toBeTruthy()

    const filled = renderWithMantine(
      <UrgencyDonut
        data={[
          { level: 'critical', label: 'критичні', value: 4 },
          { level: 'low', label: 'низькі', value: 2 },
        ]}
        emptyLabel="порожньо"
      />,
    )
    expect(filled.container.querySelector('svg')).toBeTruthy()
  })

  it('TaskTypeDonut renders empty state and a populated donut', () => {
    const empty = renderWithMantine(<TaskTypeDonut data={[]} emptyLabel="порожньо" />)
    expect(empty.getByText('порожньо')).toBeTruthy()

    const filled = renderWithMantine(
      <TaskTypeDonut data={[{ type: 'call', label: 'дзвінок', value: 3 }]} emptyLabel="порожньо" />,
    )
    expect(filled.container.querySelector('svg')).toBeTruthy()
  })

  it('AgingBars renders empty state and a populated chart', () => {
    const empty = renderWithMantine(
      <AgingBars bucketKey="bucket" data={[]} emptyLabel="порожньо" series={[]} />,
    )
    expect(empty.getByText('порожньо')).toBeTruthy()

    const filled = renderWithMantine(
      <AgingBars
        bucketKey="bucket"
        data={[
          { bucket: '0-30', overdue: 5 },
          { bucket: '31-60', overdue: 3 },
        ]}
        emptyLabel="порожньо"
        series={[{ name: 'overdue', label: 'прострочено' }]}
      />,
    )
    expect(filled.container.querySelector('svg')).toBeTruthy()
  })

  it('ForecastLine renders empty state and a populated chart', () => {
    const empty = renderWithMantine(
      <ForecastLine actualLabel="факт" data={[]} emptyLabel="порожньо" forecastLabel="прогноз" />,
    )
    expect(empty.getByText('порожньо')).toBeTruthy()

    const filled = renderWithMantine(
      <ForecastLine
        actualLabel="факт"
        data={[
          { period: 'Січ', value: 10 },
          { period: 'Лют', value: 12 },
          { period: 'Бер', value: 14, forecast: true },
        ]}
        emptyLabel="порожньо"
        forecastLabel="прогноз"
      />,
    )
    expect(filled.container.querySelector('svg')).toBeTruthy()
  })
})
