import { Alert, Button, Divider, Select, Stack, Text, Textarea, TextInput } from '@mantine/core'
import { useRef, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDateInput } from '../../../shared/ui/AppDateInput'
import { AppModal, AppModalFooter } from '../../../shared/ui/AppModal'
import { recordContact } from '../api/contactsApi'
import { CONTACT_RESULTS, type ContactBody, type ContactClient, type ContactResult } from '../contactTypes'
import { kyivContactDateToUtc } from '../utils/contactDate'
import { ContactHistoryPanel } from './ContactHistoryPanel'

export function ContactModal({ client, canRecord, onClose, onSaved }: {
  client: ContactClient; canRecord: boolean; onClose: () => void; onSaved: () => void
}) {
  const { t } = useI18n()
  const [result, setResult] = useState<ContactResult>('reached')
  const [note, setNote] = useState('')
  const [scheduleMode, setScheduleMode] = useState<string | null>(null)
  const schedule = scheduleMode === 'next'
  const [nextDate, setNextDate] = useState('')
  const [nextTime, setNextTime] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const inFlight = useRef(false)
  const attempt = useRef<{ fingerprint: string; body: ContactBody } | null>(null)

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canRecord || inFlight.current) return
    setError(null)
    try {
      if (!scheduleMode) throw new Error(t('Оберіть наступну домовленість'))
      const nextContactAt = schedule ? kyivContactDateToUtc(`${nextDate}T${nextTime}`) : null
      const action = schedule ? nextAction.trim() : null
      if (schedule && !action) throw new Error(t('Вкажіть наступну дію'))
      const payload = { ClientId: client.client_id, Result: result, Note: note.trim() || null, NextContactAt: nextContactAt, NextAction: action }
      const fingerprint = JSON.stringify(payload)
      const isRetry = attempt.current?.fingerprint === fingerprint
      // An identical retry must remain possible even after the agreed time passes.
      if (!isRetry && nextContactAt && Date.parse(nextContactAt) <= Date.now()) throw new Error(t('Наступний контакт має бути в майбутньому'))
      if (!isRetry) attempt.current = { fingerprint, body: { ...payload, EventId: crypto.randomUUID() } }
      inFlight.current = true
      setSaving(true)
      await recordContact(attempt.current!.body)
      attempt.current = null
      onSaved()
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? t(cause.message) : t('Не вдалося зберегти контакт'))
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  return <AppModal opened title={`${t('Контакти')}: ${client.client_name}`} onClose={() => { if (!inFlight.current) onClose() }}>
    <Stack gap="md">
      {canRecord && <form onSubmit={(event) => void save(event)}>
        <Stack gap="sm">
          <Select label={t('Результат контакту')} value={result} allowDeselect={false} disabled={saving}
            data={Object.entries(CONTACT_RESULTS).map(([value, label]) => ({ value, label: t(label) }))}
            onChange={(value) => setResult(value as ContactResult)} />
          <Textarea label={t('Нотатка')} value={note} maxLength={4000} disabled={saving} autosize minRows={2} onChange={(event) => setNote(event.currentTarget.value)} />
          <Select required label={t('Наступна домовленість')} placeholder={t('Оберіть наступну домовленість')} value={scheduleMode} disabled={saving} allowDeselect={false} data={[{ value: 'next', label: t('Запланувати наступний контакт') }, { value: 'none', label: t('Без наступної домовленості') }]} onChange={setScheduleMode} />
          {schedule ? <>
            <AppDateInput type="date" required label={t('Наступний контакт — дата (Київ)')} value={nextDate} disabled={saving} onChange={(event) => setNextDate(event.currentTarget.value)} />
            <TextInput type="time" required step={60} label={t('Час (Київ)')} value={nextTime} disabled={saving} onChange={(event) => setNextTime(event.currentTarget.value)} />
            <TextInput required label={t('Наступна дія')} value={nextAction} maxLength={500} disabled={saving} onChange={(event) => setNextAction(event.currentTarget.value)} />
          </> : scheduleMode === 'none' ? <Text size="xs" c="dimmed">{t('Попередня наступна домовленість буде замінена на «Без наступної дати». Історія збережеться.')}</Text> : null}
          <Text size="xs" c="dimmed">{t('Запис контакту не завершує завдання, не надсилає повідомлення та не створює пропозицію, продаж чи оплату.')}</Text>
          {error && <Alert color="red">{error}</Alert>}
          <AppModalFooter><Button variant="default" disabled={saving} onClick={onClose}>{t('Скасувати')}</Button><Button type="submit" loading={saving}>{t('Зберегти контакт')}</Button></AppModalFooter>
        </Stack>
      </form>}
      <Divider />
      <ContactHistoryPanel clientId={client.client_id} />
    </Stack>
  </AppModal>
}
