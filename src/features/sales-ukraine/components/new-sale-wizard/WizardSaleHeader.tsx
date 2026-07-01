import { ActionIcon, Box, Group, Paper, Popover, Stack, Text, Tooltip } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAlertTriangle, IconArrowsExchange, IconCopy, IconFileDescription, IconSitemap, IconX } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { getSaleClientDebtTotal } from '../../api/salesUkraineApi'
import type { SaleClientDebtTotal, SalesUkraineOrderItem, SalesUkraineSale } from '../../types'
import type { Client, ClientInDebt } from '../../../clients/types'
import { useWizardDebtRefreshVersion } from './newSaleWizardState'
import { getWizardClientGroupedDebts } from './wizardClientStepApi'
import { getWizardClientDebtDays, getWizardClientDebtTotal } from './wizardClientStepModel'
import { WizardAgreementItem } from './WizardAgreementItem'
import { WizardReassignSaleModal } from './WizardReassignSaleModal'
import { canReassignWizardSale } from './wizardReassignSaleModel'
import {
  getWizardClientStructure,
  getWizardClientStructureDebtTotal,
  getWizardHeaderClient,
  type WizardClientStructureDebtTotal,
} from './wizardSaleHeaderApi'

const amountFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })

// Reserved on every render (even with no client / while loading) so the panel keeps a constant
// height and the content below never jumps when a client appears or changes. Sized to hug a row
// of debt badges so the overdue blocks sit flush by height.
const WIZARD_HEADER_MIN_HEIGHT = 46

const SALE_LIFE_CYCLE_STATUS_NAMES: Record<number, string> = {
  0: 'Рахунок',
  1: 'Накладна',
  2: 'Накладна',
  3: 'Відправлено',
  4: 'Отримано',
  5: 'Очікування',
}

export function WizardSaleHeader({
  clientNetId,
  hideAgreementsAction = false,
  mode = 'strip',
  reassignDisabled,
  sale,
  withVatAccounting,
  onReassignOpenChange,
  onSaleReassigned,
}: {
  clientNetId: string | null
  hideAgreementsAction?: boolean
  mode?: 'inline' | 'strip'
  reassignDisabled?: boolean
  sale: SalesUkraineSale | null
  withVatAccounting: boolean
  onReassignOpenChange?: (opened: boolean) => void
  onSaleReassigned?: (movedSale: SalesUkraineSale | null) => void
}) {
  if (!clientNetId) {
    return mode === 'inline' ? null : <WizardHeaderPlaceholder />
  }

  return (
    <WizardSaleHeaderContent
      key={clientNetId}
      clientNetId={clientNetId}
      hideAgreementsAction={hideAgreementsAction}
      mode={mode}
      reassignDisabled={reassignDisabled}
      sale={sale}
      withVatAccounting={withVatAccounting}
      onReassignOpenChange={onReassignOpenChange}
      onSaleReassigned={onSaleReassigned}
    />
  )
}

function WizardSaleHeaderContent({
  clientNetId,
  hideAgreementsAction,
  mode,
  reassignDisabled,
  sale,
  withVatAccounting,
  onReassignOpenChange,
  onSaleReassigned,
}: {
  clientNetId: string
  hideAgreementsAction: boolean
  mode: 'inline' | 'strip'
  reassignDisabled?: boolean
  sale: SalesUkraineSale | null
  withVatAccounting: boolean
  onReassignOpenChange?: (opened: boolean) => void
  onSaleReassigned?: (movedSale: SalesUkraineSale | null) => void
}) {
  const { t } = useI18n()
  const debtRefreshVersion = useWizardDebtRefreshVersion()
  const [client, setClient] = useState<Client | null>(null)
  const [debtTotal, setDebtTotal] = useState<SaleClientDebtTotal | null>(null)
  const [groupedDebts, setGroupedDebts] = useState<ClientInDebt[]>([])
  const [isStructureOpen, setStructureOpen] = useState(false)
  const [isReassignOpen, setReassignOpen] = useState(false)
  const [structureClients, setStructureClients] = useState<Client[]>([])
  const [structureDebtTotal, setStructureDebtTotal] = useState<WizardClientStructureDebtTotal | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load(id: string) {
      try {
        const nextClient = await getWizardHeaderClient(id)

        if (!cancelled) {
          setClient(nextClient)
        }
      } catch {
        if (!cancelled) {
          setClient(null)
        }
      }
    }

    void load(clientNetId)

    return () => {
      cancelled = true
    }
  }, [clientNetId])

  useEffect(() => {
    let cancelled = false

    async function loadDebts(id: string) {
      try {
        const [nextDebt, nextGrouped] = await Promise.all([getSaleClientDebtTotal(id), getWizardClientGroupedDebts(id)])

        if (!cancelled) {
          setDebtTotal(nextDebt)
          setGroupedDebts(nextGrouped)
        }
      } catch {
        if (!cancelled) {
          setDebtTotal(null)
          setGroupedDebts([])
        }
      }
    }

    void loadDebts(clientNetId)

    return () => {
      cancelled = true
    }
  }, [clientNetId, debtRefreshVersion])

  useEffect(() => {
    return () => {
      onReassignOpenChange?.(false)
    }
  }, [onReassignOpenChange])

  function setReassignOpened(next: boolean) {
    setReassignOpen(next)
    onReassignOpenChange?.(next)
  }

  async function toggleStructure() {
    const next = !isStructureOpen

    setStructureOpen(next)

    if (next && clientNetId) {
      try {
        const [clients, debt] = await Promise.all([
          getWizardClientStructure(clientNetId),
          getWizardClientStructureDebtTotal(clientNetId),
        ])

        setStructureClients(clients)
        setStructureDebtTotal(debt)
      } catch {
        setStructureClients([])
        setStructureDebtTotal(null)
      }
    }
  }

  async function copySaleData(currentSale: SalesUkraineSale) {
    const orderItems = Array.isArray(currentSale.Order?.OrderItems) ? currentSale.Order.OrderItems : []
    const header = ['#', t('Код товару'), t('Назва'), t('Кількість'), 'EUR', t('Сума')].join(' \t')
    const rows = orderItems.map((item, index) =>
      [
        index + 1,
        item.Product?.VendorCode ?? '',
        item.Product?.Name ?? '',
        item.Qty ?? '',
        getOrderItemPrice(item),
        item.TotalAmount ?? '',
      ].join(' \t'),
    )

    try {
      await navigator.clipboard.writeText([header, ...rows].join('\n'))
      notifications.show({ color: 'green', message: t('Всі товари було скопійовано до буферу') })
    } catch {
      notifications.show({ color: 'red', message: t('Не вдалося скопіювати товари') })
    }
  }

  if (!client) {
    return mode === 'inline' ? null : <WizardHeaderPlaceholder />
  }

  const clientAgreements = client.ClientAgreements ?? []
  const subClientCount = client.SubClients?.length ?? 0
  const currentBalance = Math.round(clientAgreements.reduce((sum, item) => sum + (item.CurrentAmount ?? 0), 0) * 100) / 100
  const maxOverdueDays = groupedDebts.reduce((max, item) => Math.max(max, getWizardClientDebtDays(item)), 0)
  const subClients = structureClients.filter((item) => item.IsSubClient)
  const tradePoints = structureClients.filter((item) => item.IsTradePoint)
  const showStructureWarning = Boolean(
    structureDebtTotal && ((structureDebtTotal.TotalLocal ?? 0) > 0 || (structureDebtTotal.TotalSubClientDebt ?? 0) > 0),
  )
  const isInline = mode === 'inline'

  return (
    <Group
      align="center"
      gap="sm"
      className={isInline ? 'new-sale-wizard-inline-tools' : undefined}
      mb={isInline ? 0 : 8}
      mih={isInline ? undefined : WIZARD_HEADER_MIN_HEIGHT}
      pb={isInline ? 0 : 4}
      wrap="wrap"
      style={isInline ? undefined : { borderBottom: '1px solid var(--mantine-color-gray-3)' }}
    >
      {!isInline && (
        <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
          {!client.IsSubClient && !client.IsTradePoint && client.RegionCode?.Value && (
            <Text c="dimmed" size="sm">
              {client.RegionCode.Value}
            </Text>
          )}
          <Text fw={700} truncate>
            {client.FullName}
          </Text>
        </Group>
      )}

      {!isInline && !hideAgreementsAction && subClientCount > 0 && clientAgreements.length > 0 && (
        <Popover position="bottom-start" shadow="md" width={500} withinPortal>
          <Popover.Target>
            <Tooltip label={t('Договори')} position="bottom">
              <ActionIcon aria-label={t('Договори')} color="gray" size="lg" variant="subtle">
                <IconFileDescription size={20} />
              </ActionIcon>
            </Tooltip>
          </Popover.Target>
          <Popover.Dropdown>
            <Text fw={600} mb="xs" size="sm">
              {t('Договори')}
            </Text>
            <Stack gap={6} mah={320} style={{ overflowY: 'auto' }}>
              {clientAgreements.map((item, index) => (
                <WizardAgreementItem key={String(item.NetUid || item.Id || index)} clientAgreement={item} />
              ))}
            </Stack>
          </Popover.Dropdown>
        </Popover>
      )}

      {!isInline && subClientCount > 0 && (
        <Popover opened={isStructureOpen} position="bottom-start" shadow="md" width={440} withinPortal onChange={setStructureOpen}>
          <Popover.Target>
            <Tooltip label={t('Структура клієнта')} position="bottom">
              <ActionIcon
                aria-label={t('Структура клієнта')}
                color={isStructureOpen ? 'teal' : 'gray'}
                size="lg"
                variant={isStructureOpen ? 'light' : 'subtle'}
                onClick={() => void toggleStructure()}
              >
                <IconSitemap size={20} />
              </ActionIcon>
            </Tooltip>
          </Popover.Target>
          <Popover.Dropdown>
            <Group justify="space-between" mb="xs">
              <Text fw={600} size="sm">
                {t('Структура клієнта')}
              </Text>
              <ActionIcon aria-label={t('Закрити')} color="gray" size="sm" variant="subtle" onClick={() => setStructureOpen(false)}>
                <IconX size={16} />
              </ActionIcon>
            </Group>
            <Stack gap="sm" mah={360} style={{ overflowY: 'auto' }}>
              {subClients.length > 0 && (
                <Box>
                  <Text c="dimmed" fw={600} mb={4} size="xs">
                    {t('Суб-клієнти')}
                  </Text>
                  <Stack gap="xs">
                    {subClients.map((item, index) => (
                      <WizardStructureClientItem key={String(item.NetUid || item.Id || index)} client={item} />
                    ))}
                  </Stack>
                </Box>
              )}
              {tradePoints.length > 0 && (
                <Box>
                  <Text c="dimmed" fw={600} mb={4} size="xs">
                    {t('Торгові точки')}
                  </Text>
                  <Stack gap="xs">
                    {tradePoints.map((item, index) => (
                      <WizardStructureClientItem key={String(item.NetUid || item.Id || index)} client={item} />
                    ))}
                  </Stack>
                </Box>
              )}
            </Stack>
            {structureDebtTotal && ((structureDebtTotal.TotalEuro ?? 0) > 0 || (structureDebtTotal.TotalLocal ?? 0) > 0 || showStructureWarning) && (
              <Group gap="md" mt="sm" pt="xs" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
                {(structureDebtTotal.TotalEuro ?? 0) > 0 && (
                  <Text c="red" fw={600} size="sm">
                    {amountFormatter.format(structureDebtTotal.TotalEuro ?? 0)}{' '}
                    <Text span c="dimmed" size="xs">
                      EUR
                    </Text>
                  </Text>
                )}
                {(structureDebtTotal.TotalLocal ?? 0) > 0 && (
                  <Text c="red" fw={600} size="sm">
                    {amountFormatter.format(structureDebtTotal.TotalLocal ?? 0)}{' '}
                    <Text span c="dimmed" size="xs">
                      UAH
                    </Text>
                  </Text>
                )}
                {showStructureWarning && <IconAlertTriangle color="var(--mantine-color-orange-6)" size={18} />}
              </Group>
            )}
          </Popover.Dropdown>
        </Popover>
      )}

      {onSaleReassigned && canReassignWizardSale(client, sale) && (
        <Tooltip label={t('Переміщення продажі')} position="bottom">
          <ActionIcon
            aria-label={t('Переміщення продажі')}
            color="gray"
            disabled={reassignDisabled}
            size="lg"
            variant="subtle"
            onClick={() => setReassignOpened(true)}
          >
            <IconArrowsExchange size={20} />
          </ActionIcon>
        </Tooltip>
      )}

      <Group gap="xs" wrap="wrap">
        {(client.Id ?? 0) > 0 && groupedDebts.length === 0 && (
          <WizardHeaderBadge
            color="teal"
            items={[{ unit: 'EUR', value: amountFormatter.format(currentBalance) }]}
            label={t('Поточний баланс')}
          />
        )}
        {groupedDebts.length > 0 && (
          <WizardHeaderBadge
            color="red"
            items={groupedDebts.map((item) => ({
              unit: item.Agreement?.Currency?.Code ?? '',
              value: String(Math.round(getWizardClientDebtTotal(item) * 100) / 100),
            }))}
            label={t('Борг по договорам')}
          />
        )}
        {groupedDebts.length > 0 && maxOverdueDays > 0 && (
          <WizardHeaderBadge color="red" items={[{ unit: t('Днів'), value: String(maxOverdueDays) }]} label={t('прострочено')} />
        )}
        {debtTotal && ((debtTotal.TotalEuro ?? 0) > 0 || (debtTotal.TotalLocal ?? 0) > 0) && (
          <WizardHeaderBadge
            color="red"
            items={[
              ...((debtTotal.TotalEuro ?? 0) > 0 ? [{ unit: 'EUR', value: String(debtTotal.TotalEuro) }] : []),
              ...((debtTotal.TotalLocal ?? 0) > 0 ? [{ unit: 'UAH', value: String(debtTotal.TotalLocal) }] : []),
            ]}
            label={t('Загальний борг')}
          />
        )}
      </Group>

      {sale && (
        <Group gap={6} ml="auto" wrap="nowrap">
          <Tooltip label={t('Копіювати товари')} position="bottom">
            <ActionIcon aria-label={t('Копіювати товари')} color="gray" size="lg" variant="subtle" onClick={() => void copySaleData(sale)}>
              <IconCopy size={18} />
            </ActionIcon>
          </Tooltip>
          <Text fw={600} size="sm" style={{ whiteSpace: 'nowrap' }}>
            {`${withVatAccounting ? `(${t('ПДВ')}) ` : ''}${getSaleLifeCycleStatusName(sale)} ${sale.SaleNumber?.Value ?? ''}`.trim()}
          </Text>
        </Group>
      )}

      {onSaleReassigned && sale && (
        <WizardReassignSaleModal
          client={client}
          opened={isReassignOpen}
          sale={sale}
          onClose={() => setReassignOpened(false)}
          onReassigned={(movedSale) => {
            setReassignOpened(false)
            onSaleReassigned(movedSale)
          }}
        />
      )}
    </Group>
  )
}

// Empty header strip that reserves the exact filled-header height (with the same bottom border)
// so the layout below stays put whether or not a client is selected/loaded.
function WizardHeaderPlaceholder() {
  return <Box mb={8} mih={WIZARD_HEADER_MIN_HEIGHT} pb={4} style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }} />
}

function WizardHeaderBadge({
  color,
  items,
  label,
}: {
  color: 'red' | 'teal'
  items: { unit: string; value: string }[]
  label: string
}) {
  return (
    <Paper className="new-sale-wizard-header-badge" radius="md" withBorder>
      <Group className="new-sale-wizard-header-badge__values" gap="sm">
        {items.map((item, index) => (
          <Group className="new-sale-wizard-header-badge__value" gap={4} key={`${item.unit}-${index}`} wrap="nowrap">
            <Text c={color} fw={600} size="sm">
              {item.value}
            </Text>
            <Text className="new-sale-wizard-header-badge__unit">
              {item.unit}
            </Text>
          </Group>
        ))}
      </Group>
      <Text className="new-sale-wizard-header-badge__label">{label}</Text>
    </Paper>
  )
}

function WizardStructureClientItem({ client }: { client: Client }) {
  const agreements = client.ClientAgreements ?? []

  return (
    <Box>
      <Text fw={600} size="sm">
        {client.FullName}
      </Text>
      {agreements.length > 0 && (
        <Stack gap={4} mt={4}>
          {agreements.map((item, index) => (
            <WizardAgreementItem key={String(item.NetUid || item.Id || index)} clientAgreement={item} />
          ))}
        </Stack>
      )}
    </Box>
  )
}

function getSaleLifeCycleStatusName(sale: SalesUkraineSale): string {
  const type = Number(sale.BaseLifeCycleStatus?.SaleLifeCycleType)

  return Number.isFinite(type) ? (SALE_LIFE_CYCLE_STATUS_NAMES[type] ?? '') : ''
}

function getOrderItemPrice(item: SalesUkraineOrderItem): number | string {
  const currentPrice = (item.Product as { CurrentPrice?: number } | undefined)?.CurrentPrice

  if (typeof currentPrice === 'number' && Number.isFinite(currentPrice)) {
    return currentPrice
  }

  return item.PricePerItem ?? ''
}
