import { ActionIcon, Box, Group, Paper, Popover, Stack, Text, Tooltip } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAlertTriangle, IconCopy, IconFileDescription, IconHelpCircle, IconSitemap, IconX } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { getSaleClientDebtTotal } from '../../api/salesUkraineApi'
import type { SaleClientDebtTotal, SalesUkraineOrderItem, SalesUkraineSale } from '../../types'
import type { Client, ClientAgreement, ClientInDebt } from '../../../clients/types'
import {
  getWizardClientStructure,
  getWizardClientStructureDebtTotal,
  getWizardHeaderClient,
  type WizardClientStructureDebtTotal,
} from './wizardSaleHeaderApi'

const amountFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })

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
  sale,
  withVatAccounting,
}: {
  clientNetId: string | null
  sale: SalesUkraineSale | null
  withVatAccounting: boolean
}) {
  if (!clientNetId) {
    return null
  }

  return <WizardSaleHeaderContent key={clientNetId} clientNetId={clientNetId} sale={sale} withVatAccounting={withVatAccounting} />
}

function WizardSaleHeaderContent({
  clientNetId,
  sale,
  withVatAccounting,
}: {
  clientNetId: string
  sale: SalesUkraineSale | null
  withVatAccounting: boolean
}) {
  const { t } = useI18n()
  const [client, setClient] = useState<Client | null>(null)
  const [debtTotal, setDebtTotal] = useState<SaleClientDebtTotal | null>(null)
  const [isStructureOpen, setStructureOpen] = useState(false)
  const [structureClients, setStructureClients] = useState<Client[]>([])
  const [structureDebtTotal, setStructureDebtTotal] = useState<WizardClientStructureDebtTotal | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load(id: string) {
      try {
        const [nextClient, nextDebt] = await Promise.all([getWizardHeaderClient(id), getSaleClientDebtTotal(id)])

        if (!cancelled) {
          setClient(nextClient)
          setDebtTotal(nextDebt)
        }
      } catch {
        if (!cancelled) {
          setClient(null)
          setDebtTotal(null)
        }
      }
    }

    void load(clientNetId)

    return () => {
      cancelled = true
    }
  }, [clientNetId])

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
    return null
  }

  const clientAgreements = client.ClientAgreements ?? []
  const clientInDebts = client.ClientInDebts ?? []
  const subClientCount = client.SubClients?.length ?? 0
  const currentBalance = Math.round(clientAgreements.reduce((sum, item) => sum + (item.CurrentAmount ?? 0), 0) * 100) / 100
  const maxOverdueDays = clientInDebts.reduce((max, item) => Math.max(max, getDebtDays(item)), 0)
  const subClients = structureClients.filter((item) => item.IsSubClient)
  const tradePoints = structureClients.filter((item) => item.IsTradePoint)
  const showStructureWarning = Boolean(
    structureDebtTotal && ((structureDebtTotal.TotalLocal ?? 0) > 0 || (structureDebtTotal.TotalSubClientDebt ?? 0) > 0),
  )

  return (
    <Group
      align="center"
      gap="sm"
      mb="sm"
      pb="xs"
      wrap="wrap"
      style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}
    >
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

      {subClientCount > 0 && clientAgreements.length > 0 && (
        <Popover position="bottom-start" shadow="md" width={420} withinPortal>
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

      {subClientCount > 0 && (
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

      <Group gap="xs" wrap="wrap">
        {(client.Id ?? 0) > 0 && clientInDebts.length === 0 && (
          <WizardHeaderBadge
            color="teal"
            items={[{ unit: 'EUR', value: amountFormatter.format(currentBalance) }]}
            label={t('Поточний баланс')}
          />
        )}
        {clientInDebts.length > 0 && (
          <WizardHeaderBadge
            color="red"
            items={clientInDebts.map((item) => ({
              unit: item.Agreement?.Currency?.Code ?? '',
              value: String(Math.round(getDebtTotal(item) * 100) / 100),
            }))}
            label={t('Борг по договорам')}
          />
        )}
        {clientInDebts.length > 0 && maxOverdueDays > 0 && (
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

      <Group gap={6} ml="auto" wrap="nowrap">
        {sale && (
          <Tooltip label={t('Копіювати товари')} position="bottom">
            <ActionIcon aria-label={t('Копіювати товари')} color="gray" size="lg" variant="subtle" onClick={() => void copySaleData(sale)}>
              <IconCopy size={18} />
            </ActionIcon>
          </Tooltip>
        )}
        {sale && (
          <Text fw={600} size="sm" style={{ whiteSpace: 'nowrap' }}>
            {`${withVatAccounting ? `(${t('ПДВ')}) ` : ''}${getSaleLifeCycleStatusName(sale)} ${sale.SaleNumber?.Value ?? ''}`.trim()}
          </Text>
        )}
      </Group>
    </Group>
  )
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
    <Paper px="sm" py={4} radius="md" withBorder>
      <Text c="dimmed" size="xs">
        {label}
      </Text>
      <Group gap="sm">
        {items.map((item, index) => (
          <Group gap={4} key={`${item.unit}-${index}`} wrap="nowrap">
            <Text c={color} fw={600} size="sm">
              {item.value}
            </Text>
            <Text c="dimmed" size="xs">
              {item.unit}
            </Text>
          </Group>
        ))}
      </Group>
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

function WizardAgreementItem({ clientAgreement }: { clientAgreement: ClientAgreement }) {
  const agreement = clientAgreement.Agreement

  if (!agreement) {
    return null
  }

  const debts = agreement.ClientInDebts ?? []
  const overdueLimitDays = agreement.NumberDaysDebt ?? 0
  const overdueTotal =
    Math.round(
      debts
        .filter((item) => getDebtDays(item) - overdueLimitDays > 0)
        .reduce((sum, item) => sum + getDebtTotal(item), 0) * 100,
    ) / 100
  const daysOwed = debts.reduce((max, item) => Math.max(max, getDebtDays(item)), 0)
  const accountBalance = clientAgreement.AccountBalance ?? 0
  const isOverdue =
    overdueTotal > 0 ||
    (agreement.AmountDebt != null && Math.abs(accountBalance) > agreement.AmountDebt) ||
    daysOwed > overdueLimitDays

  return (
    <Paper p="xs" radius="sm" style={isOverdue ? { borderColor: 'var(--mantine-color-red-5)' } : undefined} withBorder>
      {agreement.Organization?.Name && (
        <Text c="dimmed" size="xs">
          {agreement.Organization.Name}
        </Text>
      )}
      <Group gap="sm" justify="space-between" wrap="nowrap">
        <Text fw={600} size="sm" style={{ minWidth: 0 }} truncate>
          {agreement.Name}{' '}
          <Text span c="dimmed" size="xs">
            {agreement.Currency?.Code}
          </Text>
        </Text>
        <Group gap="sm" wrap="nowrap">
          {agreement.IsControlAmountDebt && (
            <Text c={overdueTotal > 0 ? 'red' : 'dimmed'} size="xs" style={{ whiteSpace: 'nowrap' }}>
              {overdueTotal}/{accountBalance}
            </Text>
          )}
          {agreement.IsControlNumberDaysDebt && (
            <Text c={daysOwed > overdueLimitDays ? 'red' : 'dimmed'} size="xs" style={{ whiteSpace: 'nowrap' }}>
              {Math.max(0, daysOwed - overdueLimitDays)}/{overdueLimitDays}
            </Text>
          )}
        </Group>
      </Group>
      {clientAgreement.OriginalClientName && (
        <Tooltip label={clientAgreement.OriginalClientName} multiline maw={320} position="top">
          <Group gap={4} wrap="nowrap">
            <IconHelpCircle size={12} style={{ color: 'var(--mantine-color-gray-6)', flexShrink: 0 }} />
            <Text c="dimmed" size="xs" truncate>
              {clientAgreement.OriginalClientName}
            </Text>
          </Group>
        </Tooltip>
      )}
    </Paper>
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

function getDebtTotal(debt: ClientInDebt): number {
  const value = (debt.Debt as { Total?: number } | undefined)?.Total

  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function getDebtDays(debt: ClientInDebt): number {
  const value = (debt.Debt as { Days?: number } | undefined)?.Days

  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}
