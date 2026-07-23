import {
  ActionIcon,
  createPolymorphicComponent,
  Loader,
  type ActionIconProps,
  type ElementProps,
} from '@mantine/core'
import {
  Archive,
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Banknote,
  BetweenVerticalEnd,
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Copy,
  Download,
  EllipsisVertical,
  ExternalLink,
  Eye,
  FileText,
  History,
  ListTree,
  MapPin,
  Pencil,
  Percent,
  Plus,
  Printer,
  Receipt,
  RotateCcw,
  Route,
  Save,
  Settings,
  Share2,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  TriangleAlert,
  Trash2,
  Truck,
  Upload,
  UserPlus,
  X,
  type LucideProps,
} from 'lucide-react'
import {
  forwardRef,
  type ComponentType,
  type ElementType,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import './table-row-action.css'

export type TableRowActionKind =
  | 'add'
  | 'approve'
  | 'archive'
  | 'assign'
  | 'cancel'
  | 'collapse'
  | 'complete'
  | 'confirm'
  | 'copy'
  | 'delete'
  | 'delivery'
  | 'details'
  | 'discount'
  | 'document'
  | 'download'
  | 'edit'
  | 'expand'
  | 'history'
  | 'location'
  | 'more'
  | 'move-down'
  | 'move-up'
  | 'open'
  | 'payment'
  | 'placement'
  | 'print'
  | 'receipt'
  | 'recommend'
  | 'reassign'
  | 'reject'
  | 'restore'
  | 'route'
  | 'save'
  | 'select'
  | 'set-primary'
  | 'settings'
  | 'status'
  | 'transfer'
  | 'upload'
  | 'view'
  | 'will-not-ship'

export type TableRowActionTone = 'brand' | 'danger' | 'neutral' | 'success'

type TableRowActionBaseProps = Pick<
  ActionIconProps,
  'disabled' | 'loading'
> & {
  'aria-label'?: never
  'data-disabled'?: never
  children?: never
  className?: never
  classNames?: never
  color?: never
  hint?: string
  label: string
  radius?: never
  size?: never
  stopPropagation?: boolean
  style?: never
  styles?: never
  tone?: TableRowActionTone
  title?: never
  unstyled?: never
  variant?: never
  vars?: never
}

export type TableRowActionProps = TableRowActionBaseProps & {
  action: TableRowActionKind
}

type TableRowActionButtonProps = TableRowActionProps &
  ElementProps<'button', 'aria-label' | 'children' | 'color' | 'size' | 'title'> & {
    component?: ElementType
  }

const ACTION_ICONS: Record<TableRowActionKind, ComponentType<LucideProps>> = {
  add: Plus,
  approve: ThumbsUp,
  archive: Archive,
  assign: UserPlus,
  cancel: X,
  collapse: ChevronDown,
  complete: CircleCheck,
  confirm: Check,
  copy: Copy,
  delete: Trash2,
  delivery: Truck,
  details: Eye,
  discount: Percent,
  document: FileText,
  download: Download,
  edit: Pencil,
  expand: ChevronRight,
  history: History,
  location: MapPin,
  more: EllipsisVertical,
  'move-down': ArrowDown,
  'move-up': ArrowUp,
  open: ExternalLink,
  payment: Banknote,
  placement: BetweenVerticalEnd,
  print: Printer,
  receipt: Receipt,
  recommend: Sparkles,
  reassign: Share2,
  reject: ThumbsDown,
  restore: RotateCcw,
  route: Route,
  save: Save,
  select: Check,
  'set-primary': Star,
  settings: Settings,
  status: ListTree,
  transfer: ArrowLeftRight,
  upload: Upload,
  view: Eye,
  'will-not-ship': TriangleAlert,
}

const ACTION_TONES: Partial<Record<TableRowActionKind, TableRowActionTone>> = {
  add: 'brand',
  approve: 'success',
  assign: 'brand',
  cancel: 'danger',
  complete: 'success',
  confirm: 'success',
  delete: 'danger',
  recommend: 'brand',
  reject: 'danger',
  restore: 'success',
  save: 'success',
  select: 'success',
  upload: 'brand',
  'will-not-ship': 'danger',
}

export const TableRowAction = createPolymorphicComponent<'button', TableRowActionProps>(
  forwardRef<HTMLButtonElement, TableRowActionButtonProps>(function TableRowAction(
    {
      action,
      component,
      disabled,
      hint,
      label,
      loading,
      onClick,
      stopPropagation = true,
      tabIndex,
      tone,
      type,
      ...props
    },
    ref,
  ) {
    const resolvedTone = tone ?? ACTION_TONES[action] ?? 'neutral'
    const Icon = ACTION_ICONS[action]
    const isLinkLike = Boolean(component)
    const isInteractionDisabled = Boolean(disabled || loading)

    return (
      <ActionIcon
        {...props}
        ref={ref}
        aria-busy={loading || undefined}
        aria-label={label}
        aria-disabled={isLinkLike && isInteractionDisabled ? true : undefined}
        className={`app-table-row-action is-${resolvedTone}`}
        color={getToneColor(resolvedTone)}
        component={component as 'button' | undefined}
        data-disabled={isInteractionDisabled || undefined}
        data-table-row-action={action}
        disabled={isLinkLike ? undefined : disabled}
        loading={isLinkLike ? undefined : loading}
        size="md"
        tabIndex={isLinkLike && isInteractionDisabled ? -1 : tabIndex}
        title={hint ?? label}
        type={isLinkLike ? undefined : (type ?? 'button')}
        variant="subtle"
        onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
          if (stopPropagation) {
            event.stopPropagation()
          }
          if (isInteractionDisabled) {
            event.preventDefault()
            return
          }
          onClick?.(event)
        }}
      >
        {isLinkLike && loading ? (
          <Loader aria-hidden="true" color="currentColor" size={14} />
        ) : (
          <Icon aria-hidden="true" size={16} strokeWidth={1.8} />
        )}
      </ActionIcon>
    )
  }),
)

function getToneColor(tone: TableRowActionTone) {
  switch (tone) {
    case 'brand':
      return 'brand'
    case 'danger':
      return 'red'
    case 'success':
      return 'green'
    default:
      return 'gray'
  }
}
