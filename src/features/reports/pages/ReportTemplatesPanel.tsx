import { ActionIcon, Alert, Badge, Button, Group, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { CircleAlert, Copy, LayoutTemplate, Pencil, RefreshCw, RotateCcw, Save, Search, Trash2 } from 'lucide-react'
import { useId, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { isCurrentReportSource } from '../data/nativeReportProfiles'
import type { TemplateMutationResult, useServerReportTemplates } from '../hooks/useServerReportTemplates'
import type { ReportTemplate } from '../types'
import { formatDate } from '../utils'

type Action = { kind: 'rename' | 'copy' | 'delete'; template: ReportTemplate; name: string }
type Props = {
  storage: ReturnType<typeof useServerReportTemplates>
  configurationReady: boolean
  disabled?: boolean
  notice: string | null
  templateName: string
  activeTemplate: ReportTemplate | null
  onNameChange: (value: string) => void
  onApply: (template: ReportTemplate) => void
  onSave: () => Promise<TemplateMutationResult>
  onUpdate: () => Promise<TemplateMutationResult>
  onRenamed: (template: ReportTemplate, source: ReportTemplate) => void
  onDeleted: (id: string) => void
  onClearNotice: () => void
  onRefresh: () => void
}

export function ReportTemplatesPanel({ storage, configurationReady, disabled = false, notice, templateName,
  activeTemplate, onNameChange, onApply, onSave, onUpdate, onRenamed, onDeleted, onClearNotice, onRefresh }: Props) {
  const { t } = useI18n()
  const [action, setAction] = useState<Action | null>(null)
  const actionTitleId = useId()
  const blocked = disabled || storage.busy || !storage.ready
  const current = activeTemplate ? storage.templates.find(item => item.Id === activeTemplate.Id) : undefined
  const stale = Boolean(activeTemplate && (!current || current.Revision !== activeTemplate.Revision))


  return <Stack className="reports-stocks-template-card" gap="md">
    {notice ? <Alert color="yellow" icon={<CircleAlert size={18} />}>{notice}</Alert> : null}
    <Text size="xs" c="dimmed">{t('Особисті шаблони зберігаються на сервері та доступні з інших браузерів.')}</Text>
    {activeTemplate ? <ActiveTemplateCard template={activeTemplate} stale={stale}
      blocked={blocked || !configurationReady} onUpdate={() => void onUpdate()} /> : null}
    <section className="reports-stocks-template-create">
      <Text fw={600} size="sm" mb="xs">{t('Новий шаблон із поточних налаштувань')}</Text>
      <Group align="end" gap={10}>
        <TextInput className="reports-stocks-template-name" label={t('Назва шаблону')} value={templateName}
          placeholder={t('Наприклад, продажі за регіонами')} disabled={blocked}
          onChange={event => onNameChange(event.currentTarget.value)} />
        <Button color={CREATE_ACTION_COLOR} disabled={blocked || !configurationReady || !templateName.trim()}
          leftSection={<Save size={16} />} type="button" onClick={() => void onSave()}>{t('Зберегти')}</Button>
      </Group>
    </section>
    {action ? <TemplateActionController action={action} titleId={actionTitleId} blocked={blocked} storage={storage}
      onNameChange={name => setAction({ ...action, name })} onRenamed={onRenamed} onDeleted={onDeleted}
      onComplete={() => setAction(null)} /> : null}
    <SavedTemplatesSection storage={storage} blocked={blocked} disabled={disabled} onRefresh={onRefresh} onApply={onApply}
      onAction={(template, kind) => {
        onClearNotice()
        setAction({ kind, template, name: kind === 'copy' ? `${template.Name} — ${t('копія')}` : template.Name })
      }} />
    {storage.browserTemplates.length ? <Stack gap="xs">
      <Text fw={600} size="sm">{t('Шаблони цього браузера')}</Text>
      <Text size="xs" c="dimmed">{t('Імпортуйте потрібні шаблони у свій обліковий запис. Оригінали залишаться в браузері.')}</Text>
      {storage.browserTemplates.map(template => <Group key={JSON.stringify({ Name: template.Name, Data: template.Data })} justify="space-between">
        <Text size="sm">{template.Name}</Text><Button type="button" size="xs" variant="light" disabled={blocked}
          onClick={() => { onClearNotice(); void storage.importBrowserTemplate(template) }}>{t('Імпортувати на сервер')}</Button>
      </Group>)}
    </Stack> : null}
  </Stack>
}

function TemplateActionConfirmation({ action, titleId, blocked, busy, onNameChange, onConfirm, onCancel }: {
  action: Action; titleId: string; blocked: boolean; busy: boolean
  onNameChange: (name: string) => void; onConfirm: () => void; onCancel: () => void
}) {
  const { t } = useI18n()
  const actionTitle = action.kind === 'rename' ? t('Перейменувати шаблон')
    : action.kind === 'copy' ? t('Створити копію шаблону') : t('Видалити шаблон')
  return <Stack role="region" aria-labelledby={titleId} gap="xs" p="sm"
      style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 8 }}>
      <Text id={titleId} fw={600}>{actionTitle}</Text>
      <Text size="sm">{t('Шаблон')}: {action.template.Name}</Text>
      <Text size="xs" c="dimmed">{action.kind === 'delete'
        ? t('Збережений шаблон буде видалено. Поточні налаштування конструктора залишаться.')
        : t('Використовуються збережені налаштування цього шаблону. Поточний звіт у конструкторі не зміниться.')}</Text>
      {action.kind !== 'delete' ? <TextInput label={action.kind === 'copy' ? t('Назва копії') : t('Нова назва')}
        value={action.name} disabled={blocked} onChange={event => onNameChange(event.currentTarget.value)} /> : null}
      <Group>
        <Button type="button" color={action.kind === 'delete' ? 'red' : CREATE_ACTION_COLOR} disabled={blocked || (action.kind !== 'delete' && !action.name.trim())}
          onClick={onConfirm}>{action.kind === 'delete' ? t('Підтвердити видалення') : t('Підтвердити')}</Button>
        <Button type="button" variant="default" disabled={busy} onClick={onCancel}>{t('Скасувати')}</Button>
      </Group>
    </Stack>
}

function SavedTemplateRow({ template, blocked, onApply, onAction }: {
  template: ReportTemplate; blocked: boolean; onApply: () => void; onAction: (kind: Action['kind']) => void
}) {
  const { t } = useI18n()
  return <div className="reports-stocks-template-item" role="group" aria-label={template.Name}>
          <Button className="reports-stocks-template-open" leftSection={<RotateCcw size={15} />} justify="flex-start"
            type="button" variant="subtle" disabled={blocked} onClick={onApply}>
            <span className="reports-stocks-template-open__content">
              <span className="reports-stocks-template-open__name">{template.Name}</span>
              <span className="reports-stocks-template-open__period">{isCurrentReportSource(template.Data.dataSource) && !template.Data.from && !template.Data.to
                ? t('Поточний стан') : `${formatDate(template.Data.from)}–${formatDate(template.Data.to)}`}</span>
            </span>
          </Button>
          <Group gap={2} wrap="nowrap">
            <Tooltip label={t('Перейменувати')}><ActionIcon aria-label={t('Перейменувати')}
              type="button" variant="subtle" disabled={blocked || !template.Id} onClick={() => onAction('rename')}><Pencil size={16} /></ActionIcon></Tooltip>
            <Tooltip label={t('Створити копію')}><ActionIcon aria-label={t('Створити копію')}
              type="button" variant="subtle" disabled={blocked || !template.Id} onClick={() => onAction('copy')}><Copy size={16} /></ActionIcon></Tooltip>
            <Tooltip label={t('Видалити')}><ActionIcon aria-label={t('Видалити')} color="red"
              type="button" variant="subtle" disabled={blocked || !template.Id} onClick={() => onAction('delete')}><Trash2 size={16} /></ActionIcon></Tooltip>
          </Group>
        </div>
}

function ActiveTemplateCard({ template, stale, blocked, onUpdate }: {
  template: ReportTemplate; stale: boolean; blocked: boolean; onUpdate: () => void
}) {
  const { t } = useI18n()
  return <Stack gap="xs" p="sm" style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 8 }}>
      <Text fw={600}>{t('Відкритий шаблон')}: {template.Name}</Text>
      <Text size="sm">{t('Поточні налаштування буде збережено в шаблоні «{name}».', { name: template.Name })}</Text>
      {stale ? <Text c="orange" size="sm">{t('Шаблон змінився або видалений. Відкрийте його знову перед збереженням змін.')}</Text> : null}
      <Button type="button" variant="light" leftSection={<Save size={16} />} disabled={blocked || stale}
        onClick={onUpdate}>{t('Оновити шаблон')}</Button>
    </Stack>
}

function TemplateActionController({ action, titleId, blocked, storage, onNameChange, onRenamed, onDeleted, onComplete }: {
  action: Action; titleId: string; blocked: boolean; storage: Props['storage']
  onNameChange: (name: string) => void; onRenamed: Props['onRenamed']; onDeleted: Props['onDeleted']; onComplete: () => void
}) {
  async function confirmAction() {
    if (blocked || !action.template.Id) return
    const result = action.kind === 'delete' ? await storage.remove(action.template.Id, action.template.Revision)
      : action.kind === 'rename' ? await storage.rename(action.template, action.name)
        : await storage.copy(action.template, action.name)
    if (!result.ok) return
    if (action.kind === 'delete') onDeleted(action.template.Id)
    if (action.kind === 'rename' && result.template) onRenamed(result.template, action.template)
    onComplete()
  }

  return <TemplateActionConfirmation action={action} titleId={titleId} blocked={blocked} busy={storage.busy}
    onNameChange={onNameChange} onConfirm={() => void confirmAction()} onCancel={onComplete} />
}

function SavedTemplatesSection({ storage, blocked, disabled, onRefresh, onApply, onAction }: {
  storage: Props['storage']; blocked: boolean; disabled: boolean; onRefresh: Props['onRefresh']; onApply: Props['onApply']
  onAction: (template: ReportTemplate, kind: Action['kind']) => void
}) {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const visible = storage.templates.filter(template => template.Name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
  return <section className="reports-stocks-template-saved">
      <Group justify="space-between" mb="xs">
        <Group gap="xs"><Text fw={600}>{t('Збережені шаблони')}</Text><Badge variant="light">{storage.templates.length}</Badge></Group>
        <Tooltip label={t('Оновити список')}><ActionIcon aria-label={t('Оновити список')} size={32} type="button"
          variant="default" disabled={disabled || storage.busy} onClick={onRefresh}><RefreshCw size={16} /></ActionIcon></Tooltip>
      </Group>
      {storage.templates.length ? <TextInput mb="xs" label={t('Пошук шаблонів')} value={search} leftSection={<Search size={16} />}
        onChange={event => setSearch(event.currentTarget.value)} /> : null}
      {visible.length ? <div className="reports-stocks-template-list">
        {visible.map(template => <SavedTemplateRow key={template.Id ?? template.Name} template={template} blocked={blocked}
          onApply={() => onApply(template)} onAction={kind => onAction(template, kind)} />)}
      </div> : <Group p="sm"><LayoutTemplate size={20} /><Text c="dimmed" size="sm">{storage.templates.length ? t('Шаблонів за цим пошуком немає') : t('Збережених шаблонів ще немає')}</Text></Group>}
    </section>
}
