import { Stack } from '@mantine/core'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useI18n } from '../../shared/i18n/useI18n'
import { useNavigation } from '../navigation/hooks/useNavigation'
import { isNavigationPathAllowed } from '../navigation/navigationUtils'
import './payment-articles-shell.css'

const EXPENSE_ARTICLES_PATH = '/accounting/payment-expense-articles'
const CASHFLOW_ARTICLES_PATH = '/accounting/payment-cashflow-articles'

const PAYMENT_ARTICLE_TABS = [
  { label: 'Статті витрат', path: EXPENSE_ARTICLES_PATH },
  { label: 'Статті руху грошових коштів', path: CASHFLOW_ARTICLES_PATH },
] as const

export function PaymentArticlesShell({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const { modules } = useNavigation()
  const location = useLocation()
  const navigate = useNavigate()
  const activePath = resolvePaymentArticlesPath(location.pathname)
  const permittedTabs = PAYMENT_ARTICLE_TABS.filter((tab) => isNavigationPathAllowed(modules, tab.path))
  const visibleTabs = permittedTabs.length > 0
    ? permittedTabs
    : PAYMENT_ARTICLE_TABS.filter((tab) => tab.path === activePath)
  const activeTab = visibleTabs.find((tab) => tab.path === activePath) ?? visibleTabs[0]

  return (
    <Stack className="payment-articles-shell" gap={6}>
      <div className="payment-articles-shell__card console-table-shell">
        <div
          aria-label={t('Довідники статей')}
          className="payment-articles-shell__tabs pill-tabs"
          role="tablist"
        >
          {visibleTabs.map((tab) => {
            const isActive = tab.path === activeTab?.path
            const tabId = getTabId(tab.path)

            return (
              <button
                key={tab.path}
                aria-controls="payment-articles-panel"
                aria-selected={isActive}
                className={`pill-tab${isActive ? ' is-active' : ''}`}
                id={tabId}
                role="tab"
                type="button"
                onClick={() => {
                  if (tab.path !== location.pathname) {
                    navigate(tab.path)
                  }
                }}
              >
                {t(tab.label)}
              </button>
            )
          })}
        </div>

        <div
          aria-labelledby={activeTab ? getTabId(activeTab.path) : undefined}
          className="payment-articles-shell__content"
          id="payment-articles-panel"
          role="tabpanel"
        >
          {children}
        </div>
      </div>
    </Stack>
  )
}

function resolvePaymentArticlesPath(pathname: string): string {
  return pathname.startsWith(CASHFLOW_ARTICLES_PATH)
    ? CASHFLOW_ARTICLES_PATH
    : EXPENSE_ARTICLES_PATH
}

function getTabId(path: string): string {
  return path === CASHFLOW_ARTICLES_PATH
    ? 'payment-cashflow-articles-tab'
    : 'payment-expense-articles-tab'
}
