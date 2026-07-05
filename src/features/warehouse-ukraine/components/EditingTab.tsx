import { Badge, Box, Group, Stack } from '@mantine/core'
import { useEffect, useReducer } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import {
  approveEditingAct,
  approveEditingCarrier,
  getEditingActList,
  getEditingActQty,
  getEditingCarrierList,
  getEditingCarrierQty,
} from '../api/editingApi'
import { EditingList } from './EditingList'

const ACT_TAB = 'act'
const CARRIER_TAB = 'carrier'

export function EditingTab({ onCountChanged }: { onCountChanged?: () => void }) {
  const { t } = useI18n()
  const [actQty, setActQty] = useValueState(0)
  const [carrierQty, setCarrierQty] = useValueState(0)
  const [countsReloadKey, reloadCounts] = useReducer((key: number) => key + 1, 0)

  const handleProcessed = () => {
    reloadCounts()
    onCountChanged?.()
  }
  const [activeTab, setActiveTab] = useValueState(ACT_TAB)

  useEffect(() => {
    let cancelled = false

    async function loadCounts() {
      try {
        const [act, carrier] = await Promise.all([getEditingActQty(), getEditingCarrierQty()])

        if (!cancelled) {
          setActQty(act)
          setCarrierQty(carrier)
        }
      } catch {
        if (!cancelled) {
          setActQty(0)
          setCarrierQty(0)
        }
      }
    }

    void loadCounts()

    return () => {
      cancelled = true
    }
  }, [countsReloadKey, setActQty, setCarrierQty])

  return (
    <Stack className="warehouse-ukraine-tab" gap={6}>
      <div className="pill-tabs">
        <button
          type="button"
          className={`pill-tab${activeTab === ACT_TAB ? ' is-active' : ''}`}
          aria-pressed={activeTab === ACT_TAB}
          onClick={() => setActiveTab(ACT_TAB)}
        >
          <Group gap={6} wrap="nowrap" align="center">
            {t('Акт редагування накладної')}
            <Badge className="app-role-pill is-orange" size="sm" variant="light">
              {actQty}
            </Badge>
          </Group>
        </button>
        <button
          type="button"
          className={`pill-tab${activeTab === CARRIER_TAB ? ' is-active' : ''}`}
          aria-pressed={activeTab === CARRIER_TAB}
          onClick={() => setActiveTab(CARRIER_TAB)}
        >
          <Group gap={6} wrap="nowrap" align="center">
            {t('Редаговані перевізники')}
            <Badge className="app-role-pill is-orange" size="sm" variant="light">
              {carrierQty}
            </Badge>
          </Group>
        </button>
      </div>

      <Box className="warehouse-ukraine-editing-panel">
        {activeTab === ACT_TAB ? (
          <EditingList
            kind="act"
            layoutVersion="warehouse-ukraine-editing-act-1"
            loader={getEditingActList}
            processor={approveEditingAct}
            tableId="warehouse-ukraine-editing-act"
            onProcessed={handleProcessed}
          />
        ) : (
          <EditingList
            kind="carrier"
            layoutVersion="warehouse-ukraine-editing-carrier-1"
            loader={getEditingCarrierList}
            processor={approveEditingCarrier}
            tableId="warehouse-ukraine-editing-carrier"
            onProcessed={handleProcessed}
          />
        )}
      </Box>
    </Stack>
  )
}
