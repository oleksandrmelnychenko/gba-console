import { Badge, Group, Stack, Tabs, Text } from '@mantine/core'
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

export function EditingTab() {
  const { t } = useI18n()
  const [actQty, setActQty] = useValueState(0)
  const [carrierQty, setCarrierQty] = useValueState(0)
  const [countsReloadKey, reloadCounts] = useReducer((key: number) => key + 1, 0)

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
    <Stack gap="md">
      <Text fw={700} size="lg">
        {t('Протокол актів редагування накладних')}
      </Text>

      <Tabs defaultValue={ACT_TAB} keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value={ACT_TAB}>
            <Group gap={6}>
              {t('Акт редагування накладної')}
              <Badge color="violet" size="sm" variant="light">
                {actQty}
              </Badge>
            </Group>
          </Tabs.Tab>
          <Tabs.Tab value={CARRIER_TAB}>
            <Group gap={6}>
              {t('Редаговані перевізники')}
              <Badge color="violet" size="sm" variant="light">
                {carrierQty}
              </Badge>
            </Group>
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value={ACT_TAB} pt="md">
          <EditingList
            kind="act"
            layoutVersion="warehouse-ukraine-editing-act-1"
            loader={getEditingActList}
            processor={approveEditingAct}
            tableId="warehouse-ukraine-editing-act"
            onProcessed={reloadCounts}
          />
        </Tabs.Panel>
        <Tabs.Panel value={CARRIER_TAB} pt="md">
          <EditingList
            kind="carrier"
            layoutVersion="warehouse-ukraine-editing-carrier-1"
            loader={getEditingCarrierList}
            processor={approveEditingCarrier}
            tableId="warehouse-ukraine-editing-carrier"
            onProcessed={reloadCounts}
          />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}
