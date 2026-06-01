import { ActionIcon, Anchor, Box, Checkbox, Group, HoverCard, Image, ScrollArea, Stack, Text } from '@mantine/core'
import { IconPencil, IconPhoto, IconPlus } from '@tabler/icons-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { DashboardNode, DashboardNodeModule, UserPermission } from '../types'
import { isNodeSelected, isPermissionSelected } from '../utils'

type RolePermissionsEditorProps = {
  modules: DashboardNodeModule[]
  selectedNodes: DashboardNode[]
  selectedPermissions: UserPermission[]
  onAddPermission: (node: DashboardNode) => void
  onEditPermission: (node: DashboardNode, permission: UserPermission) => void
  onSelectAllPages: () => void
  onSelectModule: (module: DashboardNodeModule) => void
  onSelectSubPermissions: (permissions: UserPermission[]) => void
  onToggleNode: (node: DashboardNode) => void
  onTogglePermission: (permission: UserPermission) => void
}

export function RolePermissionsEditor({
  modules,
  selectedNodes,
  selectedPermissions,
  onAddPermission,
  onEditPermission,
  onSelectAllPages,
  onSelectModule,
  onSelectSubPermissions,
  onToggleNode,
  onTogglePermission,
}: RolePermissionsEditorProps) {
  const { t } = useI18n()

  if (modules.length === 0) {
    return <Text c="dimmed">{t('Сторінок не знайдено')}</Text>
  }

  return (
    <Stack gap="sm">
      <Group justify="flex-end">
        <Anchor component="button" type="button" size="sm" onClick={onSelectAllPages}>
          {t('Вибрати всі сторінки')}
        </Anchor>
      </Group>

      <ScrollArea.Autosize mah="calc(100vh - 360px)" type="auto">
        <Stack gap="lg">
          {modules.map((module) => (
            <Box key={String(module.Id || module.NetUid || module.Module)}>
              <Group justify="space-between" align="center" mb={6}>
                <Text fw={700}>{module.Module}</Text>
                <Anchor component="button" type="button" size="xs" onClick={() => onSelectModule(module)}>
                  {t('Вибрати все')}
                </Anchor>
              </Group>

              <Stack gap="xs">
                {(module.Children || []).map((node) => (
                  <NodeRow
                    key={String(node.Id || node.NetUid)}
                    node={node}
                    selectedNodes={selectedNodes}
                    selectedPermissions={selectedPermissions}
                    onAddPermission={onAddPermission}
                    onEditPermission={onEditPermission}
                    onSelectSubPermissions={onSelectSubPermissions}
                    onToggleNode={onToggleNode}
                    onTogglePermission={onTogglePermission}
                  />
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      </ScrollArea.Autosize>
    </Stack>
  )
}

type NodeRowProps = {
  node: DashboardNode
  selectedNodes: DashboardNode[]
  selectedPermissions: UserPermission[]
  onAddPermission: (node: DashboardNode) => void
  onEditPermission: (node: DashboardNode, permission: UserPermission) => void
  onSelectSubPermissions: (permissions: UserPermission[]) => void
  onToggleNode: (node: DashboardNode) => void
  onTogglePermission: (permission: UserPermission) => void
}

function NodeRow({
  node,
  selectedNodes,
  selectedPermissions,
  onAddPermission,
  onEditPermission,
  onSelectSubPermissions,
  onToggleNode,
  onTogglePermission,
}: NodeRowProps) {
  const { t } = useI18n()
  const permissions = node.Permissions || []

  return (
    <Box>
      <Group gap="xs" wrap="nowrap" align="center">
        <Checkbox checked={isNodeSelected(selectedNodes, node)} onChange={() => onToggleNode(node)} />
        <Text fw={600} style={{ flex: 1 }}>
          {node.Module}
        </Text>
        <ActionIcon aria-label={t('Додати право')} color="gray" variant="light" onClick={() => onAddPermission(node)}>
          <IconPlus size={16} />
        </ActionIcon>
      </Group>

      {permissions.length > 0 ? (
        <Stack gap={4} pl={34} mt={4}>
          <Group justify="flex-start">
            <Anchor component="button" type="button" size="xs" onClick={() => onSelectSubPermissions(permissions)}>
              {t('Вибрати всі підсторінки')}
            </Anchor>
          </Group>

          {permissions.map((permission) => (
            <Group key={permission.NetUid || permission.ControlId} gap="xs" wrap="nowrap" align="center">
              <Checkbox
                checked={isPermissionSelected(selectedPermissions, permission)}
                onChange={() => onTogglePermission(permission)}
              />
              {permission.ImageUrl ? (
                <HoverCard position="right" shadow="md" width={680} withArrow>
                  <HoverCard.Target>
                    <ActionIcon aria-label={t('Зображення')} color="gray" size="sm" variant="subtle">
                      <IconPhoto size={16} />
                    </ActionIcon>
                  </HoverCard.Target>
                  <HoverCard.Dropdown>
                    <Image alt={permission.Name || ''} fit="contain" src={permission.ImageUrl} />
                  </HoverCard.Dropdown>
                </HoverCard>
              ) : null}
              <Box style={{ flex: 1 }}>
                <Text size="sm">{permission.Name}</Text>
                {permission.Description ? (
                  <Text c="dimmed" size="xs">
                    {permission.Description}
                  </Text>
                ) : null}
                {permission.ControlId ? (
                  <Text c="dimmed" size="xs">
                    {permission.ControlId}
                  </Text>
                ) : null}
              </Box>
              <ActionIcon
                aria-label={t('Редагувати право')}
                color="gray"
                variant="subtle"
                onClick={() => onEditPermission(node, permission)}
              >
                <IconPencil size={16} />
              </ActionIcon>
            </Group>
          ))}
        </Stack>
      ) : null}
    </Box>
  )
}
