import { Alert, Badge, Text } from '@mantine/core'
import { Building2, CircleAlert, FolderTree } from 'lucide-react'
import { useMemo } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { TreeView, type TreeViewNode } from '../../../shared/ui/tree/TreeView'
import type { ClientFolderTree } from '../clientFolderTree'

type ClientFolderTreeNavProps = {
  selectedClientNetUid: string | null
  tree: ClientFolderTree
  onSelect: (clientNetUid: string) => void
}

export function ClientFolderTreeNav({
  selectedClientNetUid,
  tree,
  onSelect,
}: ClientFolderTreeNavProps) {
  const { t } = useI18n()
  const nodes = useMemo<TreeViewNode[]>(() => [{
    id: `folder:${tree.code}`,
    label: formatTreeLabel(tree.code, tree.name),
    meta: t('Спільні дані дерева'),
    icon: <FolderTree size={15} />,
    defaultExpanded: true,
    children: tree.items.map((item) => ({
      id: `client:${item.clientNetUid}`,
      active: item.clientNetUid === selectedClientNetUid,
      badges: item.isBlocked ? (
        <Badge color="red" size="xs" variant="light">{t('Блок')}</Badge>
      ) : !item.isActive ? (
        <Badge color="gray" size="xs" variant="light">{t('Неакт.')}</Badge>
      ) : item.requiresReview ? (
        <Badge color="orange" size="xs" variant="light">{t('Перевірити')}</Badge>
      ) : undefined,
      icon: <Building2 size={15} />,
      label: formatTreeLabel(item.code, item.name),
      onActivate: () => onSelect(item.clientNetUid),
    })),
  }], [onSelect, selectedClientNetUid, t, tree])

  return (
    <div className="client-edit-folder-tree">
      <Text className="client-edit-nav-group-title">{t('Дерево клієнтів')}</Text>
      <TreeView
        key={tree.code}
        className="client-edit-folder-tree-view"
        defaultExpandedDepth={0}
        emptyText={t('Дочірніх клієнтів не знайдено')}
        nodes={nodes}
      />
      {tree.isPartial ? (
        <Alert color="orange" icon={<CircleAlert size={15} />} variant="light">
          {t('Показано не все дерево. Перевірте структуру клієнта.')}
        </Alert>
      ) : tree.requiresReview ? (
        <Alert color="blue" icon={<CircleAlert size={15} />} variant="light">
          {t('Деякі зв’язки в дереві потребують перевірки.')}
        </Alert>
      ) : null}
    </div>
  )
}

function formatTreeLabel(code: string | undefined, name: string): string {
  return code ? `${code} — ${name}` : name
}
