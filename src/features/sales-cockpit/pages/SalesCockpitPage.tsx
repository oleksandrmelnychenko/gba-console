import { CockpitSourceStatus } from '../components/CockpitSourceStatus'
import { Button, Group, Stack } from '@mantine/core'
import { ClipboardList, FileText, MessagesSquare, Users } from 'lucide-react'
import { notifications } from '@mantine/notifications'
import { useCallback, useReducer, useState } from 'react'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { useI18n } from '../../../shared/i18n/useI18n'
import { PagePermissionBoundary } from '../../auth/components/PagePermissionBoundary'
import { usePermissions } from '../../auth/usePermissions'
import {
  addTaskNote,
  regenerateCockpit,
  setTaskStatus,
} from '../api/salesCockpitApi'
import { CockpitDashboardPanel } from '../components/CockpitDashboardPanel'
import { DismissModal } from '../components/DismissModal'
import { DoneModal } from '../components/DoneModal'
import { ContactModal } from '../components/ContactModal'
import { ContactsPanel } from '../components/ContactsPanel'
import type { ContactClient } from '../contactTypes'
import { MyClientsPanel } from '../components/MyClientsPanel'
import { MyOffersPanel } from '../components/MyOffersPanel'
import { NoteModal } from '../components/NoteModal'
import { SnoozeModal } from '../components/SnoozeModal'
import type { CockpitTask } from '../types'
import { WorkdayQueue } from '../components/WorkdayQueue'
import { WorkdayPlanPanel } from '../components/WorkdayPlanPanel'
import { WorkdayTaskDetails } from '../components/WorkdayTaskDetails'
import { useCockpitRealtimeReload } from '../hooks/useCockpitRealtimeReload'
import './sales-cockpit-page.css'

export function SalesCockpitPage() {
  return (
    <PagePermissionBoundary permissionKey={PermissionKeys.SystemPages.SalesCockpit.View}>
      <SalesCockpitPageContent />
    </PagePermissionBoundary>
  )
}

function SalesCockpitPageContent() {
  const { t } = useI18n()
  const { can } = usePermissions()
  const canTakeInProgress = can(PermissionKeys.SalesCockpit.Task.TakeInProgress)
  const canComplete = can(PermissionKeys.SalesCockpit.Task.Complete)
  const canSnooze = can(PermissionKeys.SalesCockpit.Task.Snooze)
  const canDismiss = can(PermissionKeys.SalesCockpit.Task.Dismiss)
  const canAddNote = can(PermissionKeys.SalesCockpit.Task.AddNote)
  const canGenerate = can(PermissionKeys.SalesCockpit.Task.Generate)
  const [isRegenerating, setRegenerating] = useState(false)
  const [pendingTaskKey, setPendingTaskKey] = useState<string | null>(null)
  const [noteTask, setNoteTask] = useState<CockpitTask | null>(null)
  const [snoozeTask, setSnoozeTask] = useState<CockpitTask | null>(null)
  const [doneTask, setDoneTask] = useState<CockpitTask | null>(null)
  const [dismissTask, setDismissTask] = useState<CockpitTask | null>(null)
  const [view, setView] = useState<'clients' | 'offers' | 'tasks' | 'contacts'>('tasks')
  const [taskClient, setTaskClient] = useState<ContactClient | null>(null)
  const [contactClient, setContactClient] = useState<ContactClient | null>(null)
  const [contactsRevision, refreshContacts] = useReducer((key: number) => key + 1, 0)
  const openTaskContact = (task: CockpitTask) => {
    if (task.client_id) setContactClient({ client_id: task.client_id, client_name: task.client_name || `#${task.client_id}` })
  }
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)

  const triggerReload = useCallback(() => {
    reload()
  }, [])
  const scheduleReload = useCockpitRealtimeReload(triggerReload)

  const busy = Boolean(contactClient || noteTask || snoozeTask || doneTask || dismissTask || pendingTaskKey || isRegenerating)

  const handleDoneSubmit = useCallback(
    async (task: CockpitTask, outcome: { sold: boolean; amount: number | null }) => {
      if (!can(PermissionKeys.SalesCockpit.Task.Complete)) {
        return
      }

      setPendingTaskKey(task.task_key)

      try {
        await setTaskStatus(task.task_key, {
          To: 'done',
          Sold: outcome.sold,
          Amount: outcome.amount ?? undefined,
        })
        notifications.show({ color: 'green', message: t('Завдання виконано') })
        setDoneTask(null)
        scheduleReload()
      } catch (actionError) {
        notifications.show({
          color: 'red',
          message: actionError instanceof Error ? actionError.message : t('Не вдалося оновити завдання'),
        })
      } finally {
        setPendingTaskKey(null)
      }
    },
    [can, scheduleReload, t],
  )

  const handleDismissSubmit = useCallback(
    async (task: CockpitTask, reason: string | null) => {
      if (!can(PermissionKeys.SalesCockpit.Task.Dismiss)) {
        return
      }

      setPendingTaskKey(task.task_key)

      try {
        await setTaskStatus(task.task_key, { To: 'dismissed', Reason: reason ?? undefined })
        notifications.show({ color: 'green', message: t('Завдання позначено як неактуальне') })
        setDismissTask(null)
        scheduleReload()
      } catch (actionError) {
        notifications.show({
          color: 'red',
          message: actionError instanceof Error ? actionError.message : t('Не вдалося оновити завдання'),
        })
      } finally {
        setPendingTaskKey(null)
      }
    },
    [can, scheduleReload, t],
  )

  const handleTakeInProgress = useCallback(
    async (task: CockpitTask) => {
      if (!can(PermissionKeys.SalesCockpit.Task.TakeInProgress)) {
        return
      }

      setPendingTaskKey(task.task_key)

      try {
        await setTaskStatus(task.task_key, { To: 'in_progress' })
        notifications.show({ color: 'green', message: t('Завдання взято в роботу') })
        scheduleReload()
      } catch (actionError) {
        notifications.show({
          color: 'red',
          message: actionError instanceof Error ? actionError.message : t('Не вдалося оновити завдання'),
        })
      } finally {
        setPendingTaskKey(null)
      }
    },
    [can, scheduleReload, t],
  )

  const handleSnoozeSubmit = useCallback(
    async (task: CockpitTask, snoozeUntil: string) => {
      if (!can(PermissionKeys.SalesCockpit.Task.Snooze)) {
        return
      }

      setPendingTaskKey(task.task_key)

      try {
        await setTaskStatus(task.task_key, { To: 'snoozed', SnoozeUntil: snoozeUntil })
        notifications.show({ color: 'green', message: t('Завдання відкладено') })
        setSnoozeTask(null)
        scheduleReload()
      } catch (actionError) {
        notifications.show({
          color: 'red',
          message: actionError instanceof Error ? actionError.message : t('Не вдалося відкласти завдання'),
        })
      } finally {
        setPendingTaskKey(null)
      }
    },
    [can, scheduleReload, t],
  )

  const handleNoteSubmit = useCallback(
    async (task: CockpitTask, text: string) => {
      if (!can(PermissionKeys.SalesCockpit.Task.AddNote)) {
        return
      }

      setPendingTaskKey(task.task_key)

      try {
        await addTaskNote(task.task_key, { Text: text })
        notifications.show({ color: 'green', message: t('Нотатку додано') })
        setNoteTask(null)
        scheduleReload()
      } catch (actionError) {
        notifications.show({
          color: 'red',
          message: actionError instanceof Error ? actionError.message : t('Не вдалося додати нотатку'),
        })
      } finally {
        setPendingTaskKey(null)
      }
    },
    [can, scheduleReload, t],
  )

  const handleRegenerate = useCallback(async () => {
    if (!can(PermissionKeys.SalesCockpit.Task.Generate)) {
      return
    }

    setRegenerating(true)

    try {
      await regenerateCockpit()
      notifications.show({ color: 'green', message: t('Завдання оновлено') })
      scheduleReload()
    } catch (actionError) {
      notifications.show({
        color: 'red',
        message: actionError instanceof Error ? actionError.message : t('Не вдалося згенерувати завдання'),
      })
    } finally {
      setRegenerating(false)
    }
  }, [can, scheduleReload, t])

  const taskActions = {
    canAddNote, canComplete, canDismiss, canSnooze, canTakeInProgress, pendingTaskKey,
    onAddNote: setNoteTask, onContact: openTaskContact, onDismiss: setDismissTask,
    onDone: setDoneTask, onSnooze: setSnoozeTask, onTakeInProgress: handleTakeInProgress,
  }

  return (
    <Stack className="cockpit-page" gap={6}>
      <CockpitSourceStatus />
      <div className="app-screen-tabs" role="tablist" aria-label={t('Розділи кокпіта')}>
        {(
          [
            { label: 'Черга задач', value: 'tasks', icon: ClipboardList },
            { label: 'Мої клієнти', value: 'clients', icon: Users },
            { label: 'Контакти та домовленості', value: 'contacts', icon: MessagesSquare },
            { label: 'Мої пропозиції', value: 'offers', icon: FileText },
          ] as const
        ).map((tab) => (
          <button
            aria-selected={view === tab.value}
            className={`app-screen-tab${view === tab.value ? ' is-active' : ''}`}
            key={tab.value}
            role="tab"
            type="button"
            onClick={() => setView(tab.value)}
          >
            <tab.icon size={16} aria-hidden="true" />
            {t(tab.label)}
          </button>
        ))}
      </div>

      {view === 'contacts' ? (
        <div className="cockpit-page-content"><ContactsPanel onOpen={setContactClient} revision={contactsRevision} /></div>
      ) : view === 'clients' ? (
        <div className="cockpit-page-content">
          <MyClientsPanel onContact={setContactClient} onTasks={setTaskClient} />
        </div>
      ) : view === 'offers' ? (
        <div className="cockpit-page-content">
          <MyOffersPanel />
        </div>
      ) : (
        <>
          <div className="cockpit-page-content">
            <Group justify="flex-end">
              <Button variant="default" onClick={triggerReload}>{t('Оновити')}</Button>
              {canGenerate && <Button loading={isRegenerating} onClick={handleRegenerate}>{t('Згенерувати завдання')}</Button>}
            </Group>
            <WorkdayPlanPanel revision={reloadKey} paused={busy} />
            <WorkdayQueue revision={reloadKey} paused={busy} onContact={setContactClient} actions={taskActions} />

            <CockpitDashboardPanel reloadKey={reloadKey} />
          </div>
        </>
      )}

      {taskClient && <WorkdayTaskDetails key={taskClient.client_id} row={{ key: `client:${taskClient.client_id}`, client_name: taskClient.client_name, can_contact: true }} actions={taskActions} revision={reloadKey} paused={busy} onClose={() => setTaskClient(null)} />}
      {contactClient && <ContactModal key={contactClient.client_id} client={contactClient} canRecord={canAddNote} onClose={() => setContactClient(null)} onSaved={() => { refreshContacts(); scheduleReload(); notifications.show({ color: 'green', message: t('Контакт збережено') }) }} />}

      <NoteModal
        saving={Boolean(noteTask && pendingTaskKey === noteTask.task_key)}
        task={canAddNote ? noteTask : null}
        onClose={() => setNoteTask(null)}
        onSubmit={handleNoteSubmit}
      />

      <SnoozeModal
        saving={Boolean(snoozeTask && pendingTaskKey === snoozeTask.task_key)}
        task={canSnooze ? snoozeTask : null}
        onClose={() => setSnoozeTask(null)}
        onSubmit={handleSnoozeSubmit}
      />

      <DoneModal
        saving={Boolean(doneTask && pendingTaskKey === doneTask.task_key)}
        task={canComplete ? doneTask : null}
        onClose={() => setDoneTask(null)}
        onSubmit={handleDoneSubmit}
      />

      <DismissModal
        saving={Boolean(dismissTask && pendingTaskKey === dismissTask.task_key)}
        task={canDismiss ? dismissTask : null}
        onClose={() => setDismissTask(null)}
        onSubmit={handleDismissSubmit}
      />
    </Stack>
  )
}
