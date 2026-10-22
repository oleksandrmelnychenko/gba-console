import { Alert, Button, Card, Group, Loader, Modal, Pagination, Select, Stack, Text } from '@mantine/core'
import { useCallback, useReducer, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getAttributionCandidates, getAttributionLinks, linkAttribution, type AttributionLink } from '../api/attributionApi'
import { getContactHistory } from '../api/contactsApi'
import { useWorkdayResource } from '../hooks/useWorkdayResource'
import type { CockpitTask } from '../types'
import { CONTACT_RESULTS, type ContactEvent } from '../contactTypes'
import { formatContactDate } from '../utils/contactDate'

const euroFormatter = new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'EUR' })
const money = (value: number | null) => value === null ? 'Немає підтверджених даних' : euroFormatter.format(value)
const STATES = { confirmed: 'Документ підтверджено', canceled: 'Продаж скасовано', draft: 'Документ ще не є накладною', merged_requires_review: 'Об’єднані або неоднозначні документи: потрібна перевірка', source_unavailable: 'Джерело документа недоступне' }

export function DocumentaryResultsPanel({ taskKey = '', head = false, revision = 0, paused = false }: { taskKey?: string; head?: boolean; revision?: number; paused?: boolean }) {
  const { t } = useI18n()
  const context = `${head}:${taskKey}`
  const [pagination, setPagination] = useState({ context, page: 1 })
  const currentPage = pagination.context === context ? pagination.page : 1
  const setPage = (page: number) => setPagination({ context, page })
  const [retry, refresh] = useReducer((x: number) => x + 1, 0)
  const load = useCallback((signal: AbortSignal) => getAttributionLinks(taskKey, head, (currentPage - 1) * 20, signal), [taskKey, head, currentPage])
  const state = useWorkdayResource(load, `${taskKey}:${head}:${currentPage}:${retry}:${revision}`, paused)
  return <Card withBorder><Stack gap="sm">
    <Group justify="space-between"><Text component="h2" size="sm" fw={600}>{t('Документальні результати')}</Text><Button size="xs" variant="default" onClick={refresh} disabled={paused}>{t('Оновити документи')}</Button></Group>
    <Text size="xs" c="dimmed">{t('Явні зв’язки із задачами. Відповідальний зафіксований під час зв’язування. Старі продажі без зв’язку сюди не зараховуються.')}</Text>
    <Text size="xs" c="dimmed">{t('Оплата — поточні активні розподіли платежів на цей продаж, у збережених EUR. Зарахування за поверненнями показано окремо; воно може зменшувати борг або поповнювати баланс клієнта й не означає виплату готівки; це не чиста виручка і не показник за вибраний місяць.')}</Text>
    {state.loading ? <Loader size="sm" /> : state.error ? <Alert color="red">{state.error}</Alert> : state.data ? <>
      <Text size="sm">{t('Пов’язаних продажів')}: {state.data.total}</Text>
      {state.data.rows.map((row) => <DocumentResult key={row.sale_net_uid} row={row} />)}
      <PageControls label={t('Сторінки пов’язаних продажів')} page={currentPage} total={state.data.total} onChange={setPage} disabled={paused} />
    </> : null}
  </Stack></Card>
}

function PageControls({ label, page, total, onChange, disabled = false }: { label: string; page: number; total: number; onChange: (page: number) => void; disabled?: boolean }) {
  if (page === 1 && total <= 20) return null
  return <nav aria-label={label}><Pagination value={page} total={Math.max(page, Math.ceil(total / 20))} onChange={onChange} disabled={disabled} /></nav>
}

function DocumentResult({ row }: { row: AttributionLink }) {
  const { t } = useI18n()
  const evidence = row.evidence
  const document = evidence.document
  return <Card withBorder padding="sm"><Stack gap={4}>
    <Text size="sm" fw={600}>{document?.number ?? row.sale_net_uid} · {document?.document_date ?? '—'} · {document?.document_currency ?? t('Валюту не визначено')}</Text>
    {document?.date_basis === 'stored_sale_date_unverified' && <Text size="xs" c="orange">{t('Збережена дата; часовий пояс джерела не підтверджено')}</Text>}
    <Text size="xs">{row.manager_name} · {formatContactDate(row.linked_at)}</Text>
    <Text size="xs">{t('Задача')}: {row.task_key}</Text>
    {row.contact_event_id && <Text size="xs">{t('Контакт')}: {row.contact_event_id}</Text>}
    <Text size="sm" c={evidence.state === 'confirmed' ? undefined : 'orange'}>{t(STATES[evidence.state])}</Text>
    {document && <Text size="xs">{t('Замовлення')}: {document.order_id} · {t('Дата відвантаження')}: {document.shipment_date ?? t('Не підтверджено')}{document.offer_net_uid ? ` · ${t('Пропозиція за документом')}: ${document.offer_net_uid}` : ''}</Text>}
    <Text size="sm">{t('Розподілена оплата')}: {money(evidence.allocated_payment_eur)}</Text>
    <Text size="sm">{t('Зараховано за поверненнями')}: {money(evidence.recorded_return_credit_eur)}</Text>
    {!evidence.return_credit_coverage_complete && <Text size="xs" c="orange">{t('Повнота сум повернення не підтверджена. Чистий фінансовий результат не обчислюємо.')}</Text>}
    {document && <details><summary>{t('Документи оплат і повернень')}</summary><Stack gap={4}>
      {document.payments.map((payment) => <Text size="xs" key={payment.allocation_id}>{t('Оплата')} #{payment.payment_id} · {payment.document_date} · {money(payment.amount)} · {t('Валюта платежу')}: {payment.source_currency ?? '—'}{payment.canceled ? ` · ${t('Скасовано')}` : ''}</Text>)}
      {document.returns.map((item) => <Text size="xs" key={item.return_item_id}>{t('Повернення')} #{item.return_id} · {item.document_date} · {t('Кількість')}: {item.quantity}{item.canceled ? ` · ${t('Скасовано')}` : ''}{item.credit_processed ? ` · ${t('Повернення опрацьовано в обліку')}` : ''}</Text>)}
    </Stack></details>}
  </Stack></Card>
}

export function TaskDocumentaryResults({ task, canLink }: { task: CockpitTask; canLink: boolean }) {
  const { t } = useI18n()
  const [opened, setOpened] = useState(false)
  if (!task.client_id) return null
  return <><Button size="xs" variant="subtle" onClick={() => setOpened(true)}>{t('Документи результату')}</Button>
    {opened && <AttributionModal key={task.task_key} task={task} canLink={canLink} onClose={() => setOpened(false)} />}
  </>
}

function AttributionModal({ task, canLink, onClose }: { task: CockpitTask; canLink: boolean; onClose: () => void }) {
  const { t } = useI18n()
  const [salePage, setSalePage] = useState(1)
  const [contactPage, setContactPage] = useState(1)
  const [selectedContact, setSelectedContact] = useState<ContactEvent | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [revision, refresh] = useReducer((x: number) => x + 1, 0)
  const load = useCallback(async (signal: AbortSignal) => {
    if (!canLink) return null
    const [sales, contacts] = await Promise.all([getAttributionCandidates(task.task_key, (salePage - 1) * 20, signal), getContactHistory(task.client_id!, (contactPage - 1) * 20, signal)])
    return { sales, contacts }
  }, [canLink, task.task_key, task.client_id, salePage, contactPage])
  const state = useWorkdayResource(load, `${task.task_key}:${salePage}:${contactPage}:${revision}`, !!pending)
  const contacts = state.data?.contacts.events ?? []
  const contactOptions = selectedContact && !contacts.some((event) => event.event_id === selectedContact.event_id)
    ? [selectedContact, ...contacts] : contacts
  async function link(saleId: string) {
    if (pending) return
    setPending(saleId); setError('')
    try { await linkAttribution(task.task_key, saleId, selectedContact?.event_id ?? null); refresh() }
    catch (cause) { setError(cause instanceof Error ? cause.message : t('Не вдалося пов’язати продаж')) }
    finally { setPending(null) }
  }
  return <Modal opened onClose={onClose} title={t('Документи результату')} size="xl" closeOnEscape={!pending} closeOnClickOutside={!pending} withCloseButton={!pending}>
    <Stack gap="sm">
      <DocumentaryResultsPanel taskKey={task.task_key} revision={revision} paused={!!pending} />
      {canLink && <>
        <Group justify="space-between"><Text size="sm" fw={600}>{t('Продажі та контакти')}</Text><Button size="xs" variant="default" onClick={refresh} disabled={!!pending}>{t('Оновити продажі та контакти')}</Button></Group>
        <Text size="sm">{t('Оберіть продаж цього клієнта. Він матиме одну основну задачу. Зв’язок охоплює весь обраний продаж; це ваш явний вибір, а не автоматичний результат пропозиції.')}</Text>
        {error && <Alert color="red">{error}</Alert>}
        {state.loading ? <Loader size="sm" /> : state.error ? <Alert color="red">{state.error}</Alert> : state.data ? <>
          <Select label={t('Пов’язаний контакт (необов’язково)')} clearable value={selectedContact?.event_id ?? null}
            onChange={(id) => setSelectedContact(contactOptions.find((event) => event.event_id === id) ?? null)} disabled={!!pending} data={contactOptions.map((event) => ({ value: event.event_id, label: `${formatContactDate(event.at)} · ${event.manager_name} · ${event.note?.trim() || t(CONTACT_RESULTS[event.result])}` }))} />
          <PageControls label={t('Сторінки контактів')} page={contactPage} total={state.data.contacts.total} onChange={(page) => { setContactPage(page); setSelectedContact(null) }} disabled={!!pending} />
          <Text size="sm">{t('Документів клієнта')}: {state.data.sales.total}</Text>
          {state.data.sales.rows.map((sale) => <Group key={sale.sale_net_uid} justify="space-between">
            <Stack gap={2}><Text size="sm">{sale.number} · {sale.document_date} · {sale.document_currency ?? '—'}{sale.merged ? ` · ${t('Об’єднано')}` : !sale.is_invoice ? ` · ${t('Ще не накладна')}` : sale.retained_lines === 0 ? ` · ${t('Немає неповернених позицій')}` : ''}</Text>
              {sale.date_basis === 'stored_sale_date_unverified' && <Text size="xs" c="orange">{t('Збережена дата; часовий пояс джерела не підтверджено')}</Text>}
            </Stack>
            <Button size="xs" loading={pending === sale.sale_net_uid} disabled={!!pending || sale.canceled || sale.merged || !sale.is_invoice || sale.retained_lines === 0}
              onClick={() => void link(sale.sale_net_uid)}>{t('Пов’язати з цією задачею')}</Button>
          </Group>)}
          <PageControls label={t('Сторінки документів клієнта')} page={salePage} total={state.data.sales.total} onChange={setSalePage} disabled={!!pending} />
        </> : null}
      </>}
    </Stack>
  </Modal>
}
