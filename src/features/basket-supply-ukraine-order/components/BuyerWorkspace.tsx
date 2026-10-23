import { Factory, ShoppingCart } from 'lucide-react'
import { Stack } from '@mantine/core'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useI18n } from '../../../shared/i18n/useI18n'
import { BuyerCockpitTab } from './BuyerCockpitTab'
import { ProcurementConstructor } from './ProcurementConstructor'

export function BuyerWorkspace() {
  const { t } = useI18n()
  const [params] = useSearchParams()
  const [view, setView] = useState(params.has('producerId') ? 'producer' : 'plan')
  const [visited, setVisited] = useState(() => new Set([view]))

  return (
    <Stack className="buyer-workspace" gap={6}>
      <div className="app-screen-tabs buyer-workspace__tabs" role="tablist" aria-label={t('Розділи закупівель')}>
        {[{ value: 'plan', label: 'Конструктор закупівель', icon: ShoppingCart }, { value: 'producer', label: 'Умови виробника', icon: Factory }].map((tab) => (
          <button
            aria-selected={view === tab.value}
            className={'app-screen-tab' + (view === tab.value ? ' is-active' : '')}
            key={tab.value}
            onClick={() => {
              setView(tab.value)
              setVisited((previous) => new Set([...previous, tab.value]))
            }}
            role="tab"
            type="button"
          >
            <tab.icon size={16} aria-hidden="true" />{t(tab.label)}
          </button>
        ))}
      </div>
      <div className="buyer-workspace__panel" hidden={view !== 'plan'}>{visited.has('plan') && <ProcurementConstructor />}</div>
      <div className="buyer-workspace__panel" hidden={view !== 'producer'}>{visited.has('producer') && <BuyerCockpitTab />}</div>
    </Stack>
  )
}
