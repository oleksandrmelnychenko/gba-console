import {
  Accordion,
  ActionIcon,
  Alert,
  Avatar,
  Button,
  Card,
  Group,
  Loader,
  Stack,
  Text,
} from '@mantine/core'
import { IconAlertCircle, IconPlus, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { AppModal } from '../../../../shared/ui/AppModal'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { CREATE_ACTION_COLOR } from '../../../../shared/ui/page-header-actions/PageHeaderActions'
import type { Client, ClientGroup, ClientWorkplace } from '../../types'
import { WorkplaceForm } from './WorkplaceForm'

export type WorkplacesPanelProps = {
  client: Client
  workplaces: ClientWorkplace[]
  groups: ClientGroup[]
  isLoading?: boolean
  isSaving?: boolean
  isRemoving?: boolean
  error?: string | null
  onCreate: (workplace: ClientWorkplace) => void
  onUpdate: (workplace: ClientWorkplace) => void
  onRemove: (workplace: ClientWorkplace) => void
}

function getFullName(workplace: ClientWorkplace): string {
  return [workplace.LastName, workplace.FirstName, workplace.MiddleName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ')
}

export function WorkplacesPanel({
  client,
  workplaces,
  groups,
  isLoading = false,
  isSaving = false,
  isRemoving = false,
  error = null,
  onCreate,
  onUpdate,
  onRemove,
}: WorkplacesPanelProps) {
  const { t } = useI18n()
  const [formOpened, setFormOpened] = useState(false)
  const [editingWorkplace, setEditingWorkplace] = useState<ClientWorkplace | null>(null)
  const [removeTarget, setRemoveTarget] = useState<ClientWorkplace | null>(null)

  const ungroupedWorkplaces = workplaces.filter(
    (workplace) => workplace.ClientGroupId === null || workplace.ClientGroupId === undefined,
  )

  function openCreate() {
    setEditingWorkplace(null)
    setFormOpened(true)
  }

  function openEdit(workplace: ClientWorkplace) {
    if (workplace.IsBlocked) {
      return
    }

    setEditingWorkplace(workplace)
    setFormOpened(true)
  }

  function closeForm() {
    setFormOpened(false)
    setEditingWorkplace(null)
  }

  function handleSubmit(workplace: ClientWorkplace) {
    if (editingWorkplace && (editingWorkplace.Id || 0) > 0) {
      onUpdate(workplace)
    } else {
      onCreate(workplace)
    }

    closeForm()
  }

  function confirmRemove() {
    if (removeTarget && (removeTarget.Id || 0) > 0) {
      onRemove(removeTarget)
    }

    setRemoveTarget(null)
  }

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="center">
        <Text fw={600}>{t('Робочі місця')}</Text>
        <Button
          color={CREATE_ACTION_COLOR}
          disabled={isSaving}
          leftSection={<IconPlus size={16} />}
          size="xs"
          onClick={openCreate}
        >
          {t('Додати')}
        </Button>
      </Group>

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {error}
        </Alert>
      )}

      {isLoading ? (
        <Group justify="center" py="xl">
          <Loader color="violet" size="sm" />
          <Text c="dimmed" size="sm">
            {t('Завантаження')}
          </Text>
        </Group>
      ) : workplaces.length === 0 ? (
        <Card className="app-section-card" withBorder radius="md" padding="lg">
          <Text c="dimmed" size="sm">
            {t('Робочих місць не додано')}
          </Text>
        </Card>
      ) : (
        <>
          {groups.length > 0 && (
            <Accordion multiple variant="contained" defaultValue={groups.map((group) => String(group.NetUid))}>
              {groups.map((group) => {
                const groupWorkplaces = workplaces.filter(
                  (workplace) => workplace.ClientGroupId === group.Id,
                )

                return (
                  <Accordion.Item key={String(group.NetUid)} value={String(group.NetUid)}>
                    <Accordion.Control>{group.Name}</Accordion.Control>
                    <Accordion.Panel>
                      {groupWorkplaces.length === 0 ? (
                        <Text c="dimmed" size="sm">
                          {t('Робочих місць не додано')}
                        </Text>
                      ) : (
                        <Stack gap="xs">
                          {groupWorkplaces.map((workplace) => (
                            <WorkplaceItem
                              key={workplace.NetUid}
                              workplace={workplace}
                              onRemove={() => setRemoveTarget(workplace)}
                              onSelect={() => openEdit(workplace)}
                            />
                          ))}
                        </Stack>
                      )}
                    </Accordion.Panel>
                  </Accordion.Item>
                )
              })}
            </Accordion>
          )}

          <Text fw={500} size="sm">
            {t('Без групи')}
          </Text>
          {ungroupedWorkplaces.length === 0 ? (
            <Text c="dimmed" size="sm">
              {t('Робочих місць не додано')}
            </Text>
          ) : (
            <Stack gap="xs">
              {ungroupedWorkplaces.map((workplace) => (
                <WorkplaceItem
                  key={workplace.NetUid}
                  workplace={workplace}
                  onRemove={() => setRemoveTarget(workplace)}
                  onSelect={() => openEdit(workplace)}
                />
              ))}
            </Stack>
          )}
        </>
      )}

      <AppModal
        centered
        opened={formOpened}
        title={editingWorkplace && (editingWorkplace.Id || 0) > 0 ? t('Редагування') : t('Створення')}
        onClose={closeForm}
      >
        <WorkplaceForm
          client={client}
          disabled={isSaving}
          groups={groups}
          workplace={editingWorkplace}
          onCancel={closeForm}
          onSubmit={handleSubmit}
        />
      </AppModal>

      <AppModal
        centered
        opened={Boolean(removeTarget)}
        title={t('Ви впевнені, що хочете заблокувати?')}
        onClose={() => setRemoveTarget(null)}
      >
        <Stack gap="md">
          {removeTarget && <WorkplaceItem workplace={removeTarget} readonly />}
          <Group justify="flex-end">
            <Button color="gray" variant="subtle" onClick={() => setRemoveTarget(null)}>
              {t('Ні')}
            </Button>
            <Button
              color="red"
              leftSection={<IconTrash size={16} />}
              loading={isRemoving}
              onClick={confirmRemove}
            >
              {t('Так')}
            </Button>
          </Group>
        </Stack>
      </AppModal>
    </Stack>
  )
}

function WorkplaceItem({
  workplace,
  readonly = false,
  onSelect,
  onRemove,
}: {
  workplace: ClientWorkplace
  readonly?: boolean
  onSelect?: () => void
  onRemove?: () => void
}) {
  const fullName = getFullName(workplace)
  const [isHovered, setHovered] = useState(false)
  const interactive = !readonly && !workplace.IsBlocked
  const isActive = interactive && isHovered

  return (
    <Card
      withBorder
      padding="sm"
      radius="md"
      style={{
        backgroundColor: isActive ? 'var(--mantine-color-orange-0)' : undefined,
        borderColor: isActive ? 'var(--mantine-color-orange-2)' : undefined,
        boxShadow: isActive ? 'var(--mantine-shadow-xs)' : undefined,
        cursor: interactive ? 'pointer' : 'default',
        opacity: workplace.IsBlocked ? 0.55 : 1,
        transition: 'background-color 120ms ease, border-color 120ms ease, box-shadow 120ms ease',
      }}
      onClick={readonly ? undefined : onSelect}
      onMouseEnter={interactive ? () => setHovered(true) : undefined}
      onMouseLeave={interactive ? () => setHovered(false) : undefined}
    >
      <Group justify="space-between" align="center" wrap="nowrap">
        <Group gap="sm" align="center" wrap="nowrap">
          <Avatar color={workplace.IsBlocked ? 'gray' : 'violet'} radius="xl">
            {workplace.Abbreviation}
          </Avatar>
          <Stack gap={2}>
            <Text fw={500} size="sm">
              {fullName}
            </Text>
            {workplace.Email && (
              <Text c="dimmed" size="xs">
                {workplace.Email}
              </Text>
            )}
          </Stack>
        </Group>

        {!readonly && onRemove && (
          <ActionIcon
            color="red"
            variant="subtle"
            onClick={(event) => {
              event.stopPropagation()
              onRemove()
            }}
          >
            <IconTrash size={18} />
          </ActionIcon>
        )}
      </Group>
    </Card>
  )
}
