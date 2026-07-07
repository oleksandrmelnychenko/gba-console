import {
  ActionIcon,
  Badge,
  Box,
  Collapse,
  Group,
  HoverCard,
  Image,
  ScrollArea,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core'
import { Check, ChevronRight, FileText, Folder, Image as ImageIcon, Minus, Pencil, Plus, Route, ShieldCheck } from 'lucide-react'
import { useMemo, useState, type CSSProperties } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { DashboardNode, DashboardNodeModule, UserPermission } from '../types'
import {
  getDashboardModuleNodes,
  getDashboardModulePermissions,
  getDashboardNodePermissions,
  getDashboardNodeTree,
  isNodeSelected,
  isPermissionSelected,
} from '../utils'
import './role-permissions-editor.css'

type RolePermissionsEditorProps = {
  modules: DashboardNodeModule[]
  selectedNodes: DashboardNode[]
  selectedPermissions: UserPermission[]
  onAddPermission: (node: DashboardNode) => void
  onEditPermission: (node: DashboardNode, permission: UserPermission) => void
  onSelectAllPages: () => void
  onToggleModule: (module: DashboardNodeModule) => void
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
  onToggleModule,
  onToggleNode,
  onTogglePermission,
}: RolePermissionsEditorProps) {
  const { t } = useI18n()
  const [collapsedModules, setCollapsedModules] = useState<ReadonlySet<string>>(() => new Set())
  const [collapsedNodes, setCollapsedNodes] = useState<ReadonlySet<string>>(() => new Set())
  const totals = useMemo(
    () => getTreeTotals(modules, selectedNodes, selectedPermissions),
    [modules, selectedNodes, selectedPermissions],
  )

  if (modules.length === 0) {
    return <Text c="dimmed">{t('Сторінок не знайдено')}</Text>
  }

  function toggleModuleCollapse(moduleKey: string) {
    setCollapsedModules((current) => toggleSetValue(current, moduleKey))
  }

  function toggleNodeCollapse(nodeKey: string) {
    setCollapsedNodes((current) => toggleSetValue(current, nodeKey))
  }

  return (
    <Box className="role-tree">
      <Group className="role-tree-toolbar" justify="space-between" wrap="nowrap">
        <button className="role-tree-text-action" type="button" onClick={onSelectAllPages}>
          {t('Вибрати все')}
        </button>
        <Group className="role-tree-toolbar-stats" gap="xs" justify="flex-end" wrap="wrap">
          <Badge className="app-role-pill is-gray" variant="light">
            {t('Сторінки')}: {totals.selectedNodes}/{totals.nodes}
          </Badge>
          <Badge className="app-role-pill is-gray" variant="light">
            {t('Права')}: {totals.selectedPermissions}/{totals.permissions}
          </Badge>
        </Group>
      </Group>

      <ScrollArea.Autosize mah="calc(100vh - 360px)" type="auto">
        <Box className="role-tree-modules">
          {modules.map((module) => {
            const moduleKey = getModuleKey(module)

            return (
              <ModuleSection
                key={moduleKey}
                collapsed={collapsedModules.has(moduleKey)}
                collapsedNodes={collapsedNodes}
                module={module}
                selectedNodes={selectedNodes}
                selectedPermissions={selectedPermissions}
                onAddPermission={onAddPermission}
                onEditPermission={onEditPermission}
                onToggleCollapse={() => toggleModuleCollapse(moduleKey)}
                onToggleModule={onToggleModule}
                onToggleNode={onToggleNode}
                onToggleNodeCollapse={toggleNodeCollapse}
                onTogglePermission={onTogglePermission}
              />
            )
          })}
        </Box>
      </ScrollArea.Autosize>
    </Box>
  )
}

type ModuleSectionProps = {
  collapsed: boolean
  collapsedNodes: ReadonlySet<string>
  module: DashboardNodeModule
  selectedNodes: DashboardNode[]
  selectedPermissions: UserPermission[]
  onAddPermission: (node: DashboardNode) => void
  onEditPermission: (node: DashboardNode, permission: UserPermission) => void
  onToggleCollapse: () => void
  onToggleModule: (module: DashboardNodeModule) => void
  onToggleNode: (node: DashboardNode) => void
  onToggleNodeCollapse: (nodeKey: string) => void
  onTogglePermission: (permission: UserPermission) => void
}

function ModuleSection({
  collapsed,
  collapsedNodes,
  module,
  selectedNodes,
  selectedPermissions,
  onAddPermission,
  onEditPermission,
  onToggleCollapse,
  onToggleModule,
  onToggleNode,
  onToggleNodeCollapse,
  onTogglePermission,
}: ModuleSectionProps) {
  const { t } = useI18n()
  const nodes = module.Children || []
  const summary = getModuleSummary(module, selectedNodes, selectedPermissions)
  const isSelected =
    summary.nodes > 0
    && summary.selectedNodes === summary.nodes
    && summary.selectedPermissions === summary.permissions
  const isIndeterminate = !isSelected && (summary.selectedNodes > 0 || summary.selectedPermissions > 0)

  return (
    <section className="role-tree-module">
      <div className="role-tree-module-header">
        <ActionIcon
          aria-expanded={!collapsed}
          aria-label={collapsed ? t('Розгорнути') : t('Згорнути')}
          className="role-tree-disclosure"
          color="gray"
          size="sm"
          variant="subtle"
          onClick={onToggleCollapse}
        >
          <ChevronRight size={16} strokeWidth={2} style={{ transform: collapsed ? undefined : 'rotate(90deg)' }} />
        </ActionIcon>
        <SelectionMark
          checked={isSelected}
          disabled={nodes.length === 0}
          indeterminate={isIndeterminate}
          label={t('Вибрати модуль')}
          onChange={() => onToggleModule(module)}
        />
        <ThemeIcon className="role-tree-module-icon" color="gray" size={28} variant="light">
          <Folder size={16} />
        </ThemeIcon>
        <button className="role-tree-module-title" type="button" onClick={onToggleCollapse}>
          <Text className="role-tree-module-name">{module.Module || t('Без назви')}</Text>
          {module.Description ? <Text className="role-tree-module-description">{module.Description}</Text> : null}
        </button>
        <div className="role-tree-module-stats">
          <Badge className="app-role-pill is-gray" variant="light">
            {summary.selectedNodes}/{summary.nodes}
          </Badge>
          <Badge className="app-role-pill is-gray" variant="light">
            {summary.selectedPermissions}/{summary.permissions}
          </Badge>
        </div>
      </div>

      <Collapse expanded={!collapsed}>
        <div className="role-tree-node-list">
          {nodes.map((node) => {
            const nodeKey = getNodeKey(node)

            return (
              <NodeRow
                key={nodeKey}
                collapsed={collapsedNodes.has(nodeKey)}
                collapsedNodes={collapsedNodes}
                depth={0}
                node={node}
                selectedNodes={selectedNodes}
                selectedPermissions={selectedPermissions}
                onAddPermission={onAddPermission}
                onEditPermission={onEditPermission}
                onToggleCollapse={() => onToggleNodeCollapse(nodeKey)}
                onToggleNode={onToggleNode}
                onToggleNodeCollapse={onToggleNodeCollapse}
                onTogglePermission={onTogglePermission}
              />
            )
          })}
        </div>
      </Collapse>
    </section>
  )
}

type NodeRowProps = {
  collapsed: boolean
  collapsedNodes: ReadonlySet<string>
  depth: number
  node: DashboardNode
  selectedNodes: DashboardNode[]
  selectedPermissions: UserPermission[]
  onAddPermission: (node: DashboardNode) => void
  onEditPermission: (node: DashboardNode, permission: UserPermission) => void
  onToggleCollapse: () => void
  onToggleNode: (node: DashboardNode) => void
  onToggleNodeCollapse: (nodeKey: string) => void
  onTogglePermission: (permission: UserPermission) => void
}

function NodeRow({
  collapsed,
  collapsedNodes,
  depth,
  node,
  selectedNodes,
  selectedPermissions,
  onAddPermission,
  onEditPermission,
  onToggleCollapse,
  onToggleNode,
  onToggleNodeCollapse,
  onTogglePermission,
}: NodeRowProps) {
  const { t } = useI18n()
  const childNodes = node.Children || []
  const permissions = node.Permissions || []
  const branchNodes = getDashboardNodeTree(node)
  const branchPermissions = getDashboardNodePermissions(node)
  const selectedNodeCount = branchNodes.filter((item) => isNodeSelected(selectedNodes, item)).length
  const selectedPermissionCount = branchPermissions.filter((permission) => isPermissionSelected(selectedPermissions, permission)).length
  const nodeFullySelected =
    branchNodes.length > 0
    && selectedNodeCount === branchNodes.length
    && selectedPermissionCount === branchPermissions.length
  const nodeIndeterminate = !nodeFullySelected && (selectedNodeCount > 0 || selectedPermissionCount > 0)
  const hasDetails = childNodes.length > 0 || permissions.length > 0
  const nodeStyle = { '--role-tree-indent': `${depth * 18}px` } as CSSProperties

  return (
    <Box
      className={`role-tree-node${nodeFullySelected ? ' is-selected' : ''}${nodeIndeterminate ? ' is-mixed' : ''}`}
      style={nodeStyle}
    >
      <div className="role-tree-node-row">
        <ActionIcon
          aria-expanded={!collapsed}
          aria-label={collapsed ? t('Розгорнути') : t('Згорнути')}
          className="role-tree-disclosure"
          color="gray"
          disabled={!hasDetails}
          size="sm"
          variant="subtle"
          onClick={onToggleCollapse}
        >
          <ChevronRight size={16} strokeWidth={2} style={{ transform: collapsed ? undefined : 'rotate(90deg)' }} />
        </ActionIcon>
        <SelectionMark
          checked={nodeFullySelected}
          indeterminate={nodeIndeterminate}
          label={t('Вибрати сторінку')}
          onChange={() => onToggleNode(node)}
        />
        <ThemeIcon className="role-tree-node-icon" color="gray" size={26} variant="light">
          <FileText size={15} />
        </ThemeIcon>
        <button className="role-tree-node-title" disabled={!hasDetails} type="button" onClick={onToggleCollapse}>
          <Text className="role-tree-node-name">{node.Module || t('Без назви')}</Text>
          <span className="role-tree-node-meta">
            {node.Route ? (
              <span className="role-tree-route">
                <Route size={12} />
                {node.Route}
              </span>
            ) : null}
            {branchPermissions.length > 0 ? (
              <span>
                {selectedPermissionCount}/{branchPermissions.length} {t('прав')}
              </span>
            ) : (
              <span>{t('без прав')}</span>
            )}
          </span>
        </button>
        <div className="role-tree-node-actions">
          <Tooltip label={t('Додати')}>
            <ActionIcon aria-label={t('Додати')} color="gray" size="sm" variant="light" onClick={() => onAddPermission(node)}>
              <Plus size={16} />
            </ActionIcon>
          </Tooltip>
        </div>
      </div>

      {hasDetails ? (
        <Collapse expanded={!collapsed}>
          {childNodes.length > 0 ? (
            <div className="role-tree-child-nodes">
              {childNodes.map((childNode) => {
                const childNodeKey = getNodeKey(childNode)

                return (
                  <NodeRow
                    key={childNodeKey}
                    collapsed={collapsedNodes.has(childNodeKey)}
                    collapsedNodes={collapsedNodes}
                    depth={depth + 1}
                    node={childNode}
                    selectedNodes={selectedNodes}
                    selectedPermissions={selectedPermissions}
                    onAddPermission={onAddPermission}
                    onEditPermission={onEditPermission}
                    onToggleCollapse={() => onToggleNodeCollapse(childNodeKey)}
                    onToggleNode={onToggleNode}
                    onToggleNodeCollapse={onToggleNodeCollapse}
                    onTogglePermission={onTogglePermission}
                  />
                )
              })}
            </div>
          ) : null}

          {permissions.length > 0 ? (
            <div className="role-tree-permissions">
              {permissions.map((permission) => (
                <PermissionRow
                  key={getPermissionKey(permission)}
                  node={node}
                  permission={permission}
                  selected={isPermissionSelected(selectedPermissions, permission)}
                  onEditPermission={onEditPermission}
                  onTogglePermission={onTogglePermission}
                />
              ))}
            </div>
          ) : null}
        </Collapse>
      ) : null}
    </Box>
  )
}

type PermissionRowProps = {
  node: DashboardNode
  permission: UserPermission
  selected: boolean
  onEditPermission: (node: DashboardNode, permission: UserPermission) => void
  onTogglePermission: (permission: UserPermission) => void
}

function PermissionRow({ node, permission, selected, onEditPermission, onTogglePermission }: PermissionRowProps) {
  const { t } = useI18n()
  const hasMeta = Boolean(permission.Description || permission.ControlId)

  return (
    <div className={`role-tree-permission${selected ? ' is-selected' : ''}${permission.Deleted ? ' is-deleted' : ''}`}>
      <span className="role-tree-connector" aria-hidden />
      <SelectionMark checked={selected} label={t('Вибрати право')} size="sm" onChange={() => onTogglePermission(permission)} />
      <ThemeIcon className="role-tree-permission-icon" color="gray" size={24} variant="light">
        <ShieldCheck size={14} />
      </ThemeIcon>
      <div className="role-tree-permission-body">
        <div className="role-tree-permission-copy">
          <div className="role-tree-permission-title-row">
            <Text className="role-tree-permission-name">{permission.Name || t('Без назви')}</Text>
            {permission.Deleted ? (
              <Badge color="red" size="xs" variant="light">
                {t('Видалено')}
              </Badge>
            ) : null}
          </div>
          {hasMeta ? (
            <div className="role-tree-permission-meta">
              {permission.Description ? <span>{permission.Description}</span> : null}
              {permission.ControlId ? <code>{permission.ControlId}</code> : null}
            </div>
          ) : null}
        </div>
        {hasMeta ? (
          <span className="role-tree-permission-body-line" aria-hidden />
        ) : null}
      </div>
      <div className="role-tree-permission-actions">
        {permission.ImageUrl ? (
          <HoverCard position="left" shadow="md" width={680} withArrow>
            <HoverCard.Target>
              <ActionIcon aria-label={t('Зображення')} color="gray" size="sm" variant="subtle">
                <ImageIcon size={16} />
              </ActionIcon>
            </HoverCard.Target>
            <HoverCard.Dropdown>
              <Image alt={permission.Name || ''} fit="contain" src={toSecureImageUrl(permission.ImageUrl)} />
            </HoverCard.Dropdown>
          </HoverCard>
        ) : null}
        <Tooltip label={t('Редагувати')}>
          <ActionIcon
            aria-label={t('Редагувати')}
            color="gray"
            size="sm"
            variant="subtle"
            onClick={() => onEditPermission(node, permission)}
          >
            <Pencil size={16} />
          </ActionIcon>
        </Tooltip>
      </div>
    </div>
  )
}

function getModuleKey(module: DashboardNodeModule): string {
  return String(module.NetUid || module.Id || module.Module || 'module')
}

type SelectionMarkProps = {
  checked: boolean
  disabled?: boolean
  indeterminate?: boolean
  label: string
  size?: 'md' | 'sm'
  onChange: () => void
}

function SelectionMark({ checked, disabled = false, indeterminate = false, label, size = 'md', onChange }: SelectionMarkProps) {
  return (
    <button
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={label}
      className={`role-tree-check${checked ? ' is-selected' : ''}${indeterminate ? ' is-indeterminate' : ''}${size === 'sm' ? ' is-sm' : ''}`}
      disabled={disabled}
      role="checkbox"
      type="button"
      onClick={onChange}
    >
      {indeterminate ? <Minus size={11} strokeWidth={2.2} /> : checked ? <Check size={11} strokeWidth={2.2} /> : null}
    </button>
  )
}

function getNodeKey(node: DashboardNode): string {
  return String(node.NetUid || node.Id || node.Module || 'node')
}

function getPermissionKey(permission: UserPermission): string {
  return String(permission.NetUid || permission.Id || permission.ControlId || permission.Name || 'permission')
}

function getTreeTotals(
  modules: DashboardNodeModule[],
  selectedNodes: DashboardNode[],
  selectedPermissions: UserPermission[],
) {
  return modules.reduce(
    (totals, module) => {
      const summary = getModuleSummary(module, selectedNodes, selectedPermissions)

      return {
        nodes: totals.nodes + summary.nodes,
        permissions: totals.permissions + summary.permissions,
        selectedNodes: totals.selectedNodes + summary.selectedNodes,
        selectedPermissions: totals.selectedPermissions + summary.selectedPermissions,
      }
    },
    { nodes: 0, permissions: 0, selectedNodes: 0, selectedPermissions: 0 },
  )
}

function getModuleSummary(
  module: DashboardNodeModule,
  selectedNodes: DashboardNode[],
  selectedPermissions: UserPermission[],
) {
  const nodes = getDashboardModuleNodes(module)
  const permissions = getDashboardModulePermissions(module)

  return {
    nodes: nodes.length,
    permissions: permissions.length,
    selectedNodes: nodes.filter((node) => isNodeSelected(selectedNodes, node)).length,
    selectedPermissions: permissions.filter((permission) => isPermissionSelected(selectedPermissions, permission)).length,
  }
}

function toggleSetValue(current: ReadonlySet<string>, value: string): ReadonlySet<string> {
  const next = new Set(current)

  if (next.has(value)) {
    next.delete(value)
  } else {
    next.add(value)
  }

  return next
}

function toSecureImageUrl(url: string): string {
  return url.startsWith('http://') ? `https://${url.slice('http://'.length)}` : url
}
