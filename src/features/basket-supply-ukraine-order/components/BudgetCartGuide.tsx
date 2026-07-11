import { Badge, Group, Text, Tooltip } from '@mantine/core'
import { BrainCircuit, Gauge, Info, Scale, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { CartOptimizeMethod } from '../procurementTypes'

type BudgetCartGuideProps = {
  asOfDate?: string
  hasPlan: boolean
  method: CartOptimizeMethod
  methodUsed?: CartOptimizeMethod | null
  modelVersion?: string
}

const methodTitle: Record<CartOptimizeMethod, string> = {
  greedy: 'Швидкий',
  milp: 'Оптимальний',
}

export function BudgetCartGuide({
  asOfDate,
  hasPlan,
  method,
  methodUsed,
  modelVersion,
}: BudgetCartGuideProps) {
  const { t } = useI18n()
  const executedMethod = methodUsed ?? method

  return (
    <div className="budget-cart-guide">
      <GuideTile
        icon={<Sparkles size={18} />}
        title={t('Закупівля під бюджет')}
        value={t('AI підбирає товари в закупівлю під заданий EUR-ліміт')}
        meta={t('Кандидати беруться з дефіциту, прогнозу попиту, залишків і правил закупівлі')}
      />
      <GuideTile
        active={method === 'greedy'}
        icon={<Gauge size={18} />}
        title={t('Швидкий')}
        value={t('Швидкий відбір')}
        meta={t('Бере рядки з найбільшою цінністю на 1 EUR, поки бюджет не закінчиться')}
      />
      <GuideTile
        active={method === 'milp'}
        icon={<Scale size={18} />}
        title={t('Оптимальний')}
        value={t('Оптимальна комбінація')}
        meta={t('Рахує весь набір позицій разом і максимізує цінність у межах бюджету')}
      />
      <div className="budget-cart-guide__status">
        <Group gap={6} wrap="wrap">
          <Badge color="violet" leftSection={<BrainCircuit size={13} />} variant="light">
            {t('Запит')}: {t(methodTitle[method])}
          </Badge>
          <Badge color={methodUsed && methodUsed !== method ? 'orange' : 'green'} variant="light">
            {t('Виконано')}: {t(methodTitle[executedMethod])}
          </Badge>
          {asOfDate && (
            <Badge color="gray" variant="light">
              {t('Дата')}: {asOfDate}
            </Badge>
          )}
          {hasPlan && modelVersion && (
            <Tooltip label={t('Версія AI-моделі, яка рахувала план')}>
              <Badge color="gray" leftSection={<Info size={13} />} variant="light">
                {modelVersion}
              </Badge>
            </Tooltip>
          )}
        </Group>
      </div>
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
        <Text c="dimmed" size="xs">
          {title}
        </Text>
        <Text fw={700} size="sm">
          {value}
        </Text>
        <Text c="dimmed" size="xs">
          {meta}
        </Text>
      </div>
    </div>
  )
}
