import { FilePenLine, History } from 'lucide-react'
import { TableChip } from '../../../shared/ui/TableChip'
import { Box, Group, Stack } from '@mantine/core'
import { useCallback, useEffect, useReducer } from 'react'
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

export function EditingTab({ canProcess, onCountChanged }: { canProcess: boolean; onCountChanged?: () => void }) {
  const { t } = useI18n()
  const [actQty, setActQty] = useValueState(0)
  const [carrierQty, setCarrierQty] = useValueState(0)
  const [countsReloadKey, reloadCounts] = useReducer((key: number) => key + 1, 0)

  const handleProcessed = () => {
    reloadCounts()
    onCountChanged?.()
  }
  const handleListLoaded = useCallback(() => {
    reloadCounts()
  }, [])
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
    <Stack className="warehouse-ukraine-tab" gap={0}>
      <div className="pill-tabs app-screen-tabs">
        <button
          type="button"
          className={`pill-tab app-screen-tab${activeTab === ACT_TAB ? ' is-active' : ''}`}
          aria-pressed={activeTab === ACT_TAB}
          onClick={() => setActiveTab(ACT_TAB)}
        >
          <Group gap={6} wrap="nowrap" align="center">
            <FilePenLine size={16} strokeWidth={1.8} aria-hidden="true" />
            {t('Акт редагування накладної')}
            <TableChip value={actQty} />
          </Group>
        </button>
        <button
          type="button"
          className={`pill-tab app-screen-tab${activeTab === CARRIER_TAB ? ' is-active' : ''}`}
          aria-pressed={activeTab === CARRIER_TAB}
          onClick={() => setActiveTab(CARRIER_TAB)}
        >
          <Group gap={6} wrap="nowrap" align="center">
            <History size={16} strokeWidth={1.8} aria-hidden="true" />
            {t('Історія змін перевізника')}
            <TableChip value={carrierQty} />
          </Group>
        </button>
      </div>

      <Box className="warehouse-ukraine-editing-panel">
        {activeTab === ACT_TAB ? (
          <EditingList
            canProcess={canProcess}
            kind="act"
            layoutVersion="warehouse-ukraine-editing-act-1"
            loader={getEditingActList}
            onLoaded={handleListLoaded}
            processor={approveEditingAct}
            tableId="warehouse-ukraine-editing-act"
            onProcessed={handleProcessed}
          />
        ) : (
          <EditingList
            canProcess={canProcess}
            kind="carrier"
            layoutVersion="warehouse-ukraine-editing-carrier-1"
            loader={getEditingCarrierList}
            onLoaded={handleListLoaded}
            processor={approveEditingCarrier}
            tableId="warehouse-ukraine-editing-carrier"
            onProcessed={handleProcessed}
          />
        )}
      </Box>
    </Stack>
  )
}
