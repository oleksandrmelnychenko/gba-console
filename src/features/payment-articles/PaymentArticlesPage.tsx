import { Stack, Text } from '@mantine/core'
import { useI18n } from '../../shared/i18n/useI18n'
import { PaymentCashflowArticlesPage } from '../payment-cashflow-articles/pages/PaymentCashflowArticlesPage'
import { PaymentExpenseArticlesPage } from '../payment-expense-articles/pages/PaymentExpenseArticlesPage'
import './payment-articles-page.css'

export const EXPENSE_ARTICLES_PATH = '/accounting/payment-expense-articles'
export const CASHFLOW_ARTICLES_PATH = '/accounting/payment-cashflow-articles'

/**
 * Both article directories live on one screen: they are short reference lists that are
 * always used together, so tabs only hid half of the data behind an extra click.
 */
export function PaymentArticlesPage() {
  const { t } = useI18n()

  return (
    <Stack className="payment-articles-page" gap={6}>
      <div className="payment-articles-page__grid">
        <section aria-label={t('Статті витрат')} className="payment-articles-page__panel console-table-shell">
          <div className="payment-articles-page__heading">
            <span aria-hidden="true" className="payment-articles-page__heading-accent" />
            <Text className="payment-articles-page__title" component="h2" fw={600} size="sm">
              {t('Статті витрат')}
            </Text>
          </div>
          <PaymentExpenseArticlesPage inSharedShell />
        </section>

        <section aria-label={t('Статті руху грошових коштів')} className="payment-articles-page__panel console-table-shell">
          <div className="payment-articles-page__heading">
            <span aria-hidden="true" className="payment-articles-page__heading-accent" />
            <Text className="payment-articles-page__title" component="h2" fw={600} size="sm">
              {t('Статті руху грошових коштів')}
            </Text>
          </div>
          <PaymentCashflowArticlesPage inSharedShell />
        </section>
      </div>
    </Stack>
  )
}
