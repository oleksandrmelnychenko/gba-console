import { Skeleton } from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'
import { useI18n } from '../../../../shared/i18n/useI18n'

export function WizardRelatedProductsSkeleton() {
  const { t } = useI18n()
  const reduceMotion = useReducedMotion()
  return (
    <div aria-label={t('Завантаження товарів')} aria-busy="true" className="wizard-related-skeletons">
      {[0, 1].map((row) => (
        <div className="wizard-related-skeleton" key={row}>
          <Skeleton animate={!reduceMotion} height={120} radius={10} />
          <div className="wizard-related-skeleton__copy">
            <Skeleton animate={!reduceMotion} height={20} width="45%" radius="xl" />
            <Skeleton animate={!reduceMotion} height={14} width="85%" />
            <Skeleton animate={!reduceMotion} height={18} width="65%" radius="xl" />
            <div className="wizard-related-skeleton__metrics">
              {[0, 1, 2].map((column) => <Skeleton animate={!reduceMotion} height={36} key={column} />)}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function WizardProductSummarySkeleton() {
  const { t } = useI18n()
  const reduceMotion = useReducedMotion()
  return (
    <div aria-label={t('Завантаження товару')} aria-busy="true" className="wizard-summary-skeleton">
      <Skeleton animate={!reduceMotion} className="wizard-summary-skeleton__photo" height="100%" radius={10} />
      <div className="wizard-summary-skeleton__copy">
        <Skeleton animate={!reduceMotion} height={22} width="65%" />
        <Skeleton animate={!reduceMotion} height={18} width="40%" />
        <Skeleton animate={!reduceMotion} height={20} width="28%" />
        <div className="wizard-summary-skeleton__prices">
          {[0, 1, 2, 3, 4].map((row) => <Skeleton animate={!reduceMotion} height={22} key={row} />)}
        </div>
      </div>
    </div>
  )
}
