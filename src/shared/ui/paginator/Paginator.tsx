import { ActionIcon, Group, NumberInput, Select, Text, Tooltip } from '@mantine/core'
import { IconChevronLeft, IconChevronRight, IconRefresh } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n/useI18n'
import { DEFAULT_PAGINATOR_PAGE_SIZE, PAGINATOR_PAGE_SIZE_OPTIONS } from './paginatorPageSize'
import './paginator.css'

export type PaginatorProps = {
  /** Current 1-based page. */
  page: number
  /** Current page size. */
  pageSize: number
  /**
   * Total page count, when known — disables "next" at the last page. When the
   * total is unknown, omit this and pass `hasNext` instead.
   */
  totalPages?: number
  /** Explicit next-availability when the total page count is unknown. */
  hasNext?: boolean
  /** Page-size options. Defaults to the canonical set. */
  pageSizeOptions?: string[]
  /** Disables every control and shows the refresh spinner. */
  isLoading?: boolean
  className?: string
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  /** When provided, renders the refresh button. */
  onRefresh?: () => void
}

/**
 * The shared paginator pill, lifted verbatim from the «Продажі» reference so
 * every list page reads identically: page-size select, "стор. N", prev/next
 * chevrons and an optional refresh.
 */
export function Paginator({
  page,
  pageSize,
  totalPages,
  hasNext,
  pageSizeOptions = PAGINATOR_PAGE_SIZE_OPTIONS,
  isLoading = false,
  className,
  onPageChange,
  onPageSizeChange,
  onRefresh,
}: PaginatorProps) {
  const { t } = useI18n()
  const canPrevious = page > 1
  const canNext = hasNext ?? (typeof totalPages === 'number' ? page < totalPages : true)

  // Editable page number: jump to an arbitrary page on Enter/blur, clamped to [1, totalPages]
  // when the total is known. Kept as a draft so typing doesn't fire a jump per keystroke.
  const [pageDraft, setPageDraft] = useState(String(page))

  useEffect(() => {
    setPageDraft(String(page))
  }, [page])

  function commitPageDraft() {
    const parsed = Math.floor(Number(pageDraft))

    if (!Number.isFinite(parsed) || parsed < 1) {
      setPageDraft(String(page))

      return
    }

    const clamped = typeof totalPages === 'number' ? Math.min(parsed, Math.max(1, totalPages)) : parsed

    if (clamped !== page) {
      onPageChange(clamped)
    }

    setPageDraft(String(clamped))
  }

  return (
    <Group className={className ? `app-paginator ${className}` : 'app-paginator'} gap={2} wrap="nowrap">
      <Select
        allowDeselect={false}
        aria-label={t('Кількість рядків')}
        data={pageSizeOptions}
        disabled={isLoading}
        size="xs"
        value={String(pageSize)}
        w={72}
        onChange={(value) => onPageSizeChange(Number(value) || DEFAULT_PAGINATOR_PAGE_SIZE)}
      />
      <Text className="app-paginator-label" size="xs">
        {t('стор.')}
      </Text>
      <NumberInput
        allowDecimal={false}
        allowNegative={false}
        aria-label={t('Номер сторінки')}
        disabled={isLoading}
        hideControls
        min={1}
        max={typeof totalPages === 'number' ? Math.max(1, totalPages) : undefined}
        size="xs"
        value={pageDraft}
        w={52}
        onBlur={commitPageDraft}
        onChange={(value) => setPageDraft(String(value))}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur()
          }
        }}
      />
      {typeof totalPages === 'number' && (
        <Text className="app-paginator-label" size="xs">
          / {totalPages}
        </Text>
      )}
      <ActionIcon
        aria-label={t('Попередня сторінка')}
        color="gray"
        disabled={!canPrevious || isLoading}
        size="sm"
        variant="subtle"
        onClick={() => onPageChange(Math.max(1, page - 1))}
      >
        <IconChevronLeft size={16} />
      </ActionIcon>
      <ActionIcon
        aria-label={t('Наступна сторінка')}
        color="gray"
        disabled={!canNext || isLoading}
        size="sm"
        variant="subtle"
        onClick={() => onPageChange(page + 1)}
      >
        <IconChevronRight size={16} />
      </ActionIcon>
      {onRefresh && (
        <Tooltip label={t('Оновити')}>
          <ActionIcon
            aria-label={t('Оновити')}
            color="gray"
            loading={isLoading}
            size="sm"
            variant="subtle"
            onClick={onRefresh}
          >
            <IconRefresh size={16} />
          </ActionIcon>
        </Tooltip>
      )}
    </Group>
  )
}
