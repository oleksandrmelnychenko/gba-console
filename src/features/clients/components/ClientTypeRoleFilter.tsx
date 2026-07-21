import { Box, Button, Checkbox, Group, Popover, ScrollArea, Stack, Text } from '@mantine/core'
import { ChevronDown } from 'lucide-react'
import { useMemo } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { CHECKBOX_MULTI_SELECT_WIDTH } from '../../../shared/ui/CheckboxMultiSelect'
import type { ClientType } from '../types'

type ClientTypeRoleFilterProps = {
  clientTypes: ClientType[]
  disabled?: boolean
  value: string[]
  onChange: (value: string[]) => void
}

type FilterGroup = {
  key: string
  name: string
  roles: Array<{ id: string; name: string }>
}

export function ClientTypeRoleFilter({ clientTypes, disabled, value, onChange }: ClientTypeRoleFilterProps) {
  const { t } = useI18n()
  const groups = useMemo(() => buildGroups(clientTypes), [clientTypes])
  const selected = useMemo(() => new Set(value), [value])
  const isDisabled = disabled || groups.length === 0
  const selectedRoleLabel =
    value.length === 1
      ? groups.flatMap((group) => group.roles).find((role) => role.id === value[0])?.name
      : undefined
  const triggerLabel =
    value.length === 0
      ? t('Усі ролі')
      : value.length === 1
        ? selectedRoleLabel || t('Ролі: {count}', { count: value.length })
        : t('Ролі: {count}', { count: value.length })

  function toggleType(group: FilterGroup) {
    const roleIds = group.roles.map((role) => role.id)
    const allSelected = roleIds.every((roleId) => selected.has(roleId))
    const next = new Set(selected)

    if (allSelected) {
      roleIds.forEach((roleId) => next.delete(roleId))
    } else {
      roleIds.forEach((roleId) => next.add(roleId))
    }

    onChange([...next])
  }

  function toggleRole(roleId: string) {
    const next = new Set(selected)

    if (next.has(roleId)) {
      next.delete(roleId)
    } else {
      next.add(roleId)
    }

    onChange([...next])
  }

  return (
    <Popover withinPortal position="bottom-start" shadow="md" disabled={isDisabled}>
      <Popover.Target>
        <Button
          size="sm"
          variant="default"
          color="gray"
          disabled={isDisabled}
          justify="space-between"
          rightSection={<ChevronDown size={16} />}
          w={CHECKBOX_MULTI_SELECT_WIDTH}
          style={{ flex: `0 0 ${CHECKBOX_MULTI_SELECT_WIDTH}` }}
        >
          <Text size="sm" truncate>
            {triggerLabel}
          </Text>
        </Button>
      </Popover.Target>
      <Popover.Dropdown p="xs">
        <ScrollArea.Autosize mah={320} type="auto">
          <Stack gap="sm" w={260}>
            {groups.map((group) => {
              const roleIds = group.roles.map((role) => role.id)
              const selectedCount = roleIds.filter((roleId) => selected.has(roleId)).length
              const allSelected = selectedCount > 0 && selectedCount === roleIds.length

              return (
                <Box key={group.key}>
                  <Checkbox
                    checked={allSelected}
                    indeterminate={selectedCount > 0 && !allSelected}
                    label={<Text fw={600} size="sm">{group.name}</Text>}
                    onChange={() => toggleType(group)}
                  />
                  <Stack gap={4} mt={4} pl="md">
                    {group.roles.map((role) => (
                      <Checkbox
                        key={role.id}
                        checked={selected.has(role.id)}
                        label={role.name}
                        size="sm"
                        onChange={() => toggleRole(role.id)}
                      />
                    ))}
                  </Stack>
                </Box>
              )
            })}
          </Stack>
        </ScrollArea.Autosize>
        {value.length > 0 && (
          <Group justify="flex-end" mt="xs">
            <Button size="compact-xs" variant="subtle" color="gray" onClick={() => onChange([])}>
              {t('Скинути')}
            </Button>
          </Group>
        )}
      </Popover.Dropdown>
    </Popover>
  )
}

function buildGroups(clientTypes: ClientType[]): FilterGroup[] {
  return clientTypes.flatMap((clientType) => {
    const roles = (clientType.ClientTypeRoles || []).flatMap((role) => {
      if (typeof role.Id !== 'number') {
        return []
      }

      return [{ id: String(role.Id), name: role.Name?.trim() || translateFallback(role.Id) }]
    })

    if (roles.length === 0) {
      return []
    }

    return [
      {
        key: clientType.NetUid || String(clientType.Id ?? clientType.Name ?? ''),
        name: clientType.Name?.trim() || '',
        roles,
      },
    ]
  })
}

function translateFallback(id: number): string {
  return `#${id}`
}
