import { Text } from '@mantine/core'
import { Gauge, Scale } from 'lucide-react'
import type { ReactNode } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { CartOptimizeMethod } from '../procurementTypes'

type BudgetCartGuideProps = {
  method: CartOptimizeMethod
}

export function BudgetCartGuide({ method }: BudgetCartGuideProps) {
  const { t } = useI18n()

  return (
    <div className="budget-cart-guide">
      <GuideTile
        active={method === 'greedy'}
        icon={<Gauge size={18} />}
        title={t('Швидкий')}
        value={t('Швидкий відбір')}
        meta={t('Відбирає позиції з найбільшою цінністю на 1 EUR, доки не вичерпається бюджет')}
      />
      <GuideTile
        active={method === 'milp'}
        icon={<Scale size={18} />}
        title={t('Оптимальний')}
        value={t('Оптимальна комбінація')}
        meta={t('Розраховує весь набір позицій разом і максимізує цінність у межах бюджету')}
      />
    </div>
  )
}

function GuideTile({
  active = false,
  icon,
  meta,
  title,
  value,
}: {
  active?: boolean
  icon: ReactNode
  meta: string
  title: string
  value: string
}) {
  return (
    <div className={`budget-cart-guide__tile${active ? ' is-active' : ''}`}>
      <div className="budget-cart-guide__icon" aria-hidden="true">
        {icon}
      </div>
      <div>
        <Text c="gray.9" fw={600} size="xs">
          {title}
        </Text>
        <Text c="gray.8" fw={600} size="sm">
          {value}
        </Text>
        <Text c="gray.9" size="xs">
          {meta}
        </Text>
      </div>
    </div>
  )
}
