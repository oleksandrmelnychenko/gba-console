import { Button, Loader, Popover, ScrollArea, Stack, Text, UnstyledButton } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { Bug, ChevronUp, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

const deskUrl = (import.meta.env.VITE_QA_DESK_URL ?? 'https://gba-qa-desk.85.17.167.167.nip.io').replace(/\/$/, '')

interface BuildBug {
  id: string
  title: string
  area: string
  status: string
  source: 'codex' | 'manual'
  statusAtProcessing: string
}

interface BuildInfo {
  number: string
  bugs: BuildBug[]
  pending: BuildBug[]
}

const statusMeta: Record<string, { label: string; short: string }> = {
  new: { label: 'Новий', short: 'Новий' },
  in_progress: { label: 'У роботі', short: 'В роботі' },
  ready_for_retest: { label: 'Готовий до ретесту', short: 'Ретест' },
  review_again: { label: 'Передивись ще раз', short: 'Ще раз' },
  done: { label: 'Закрито', short: 'Готово' },
  blocked: { label: 'Заблоковано', short: 'Блок' },
}

function BugRow({
  bug,
  pending = false,
  onOpen,
}: {
  bug: BuildBug
  pending?: boolean
  onOpen: (taskId: string) => void
}) {
  const meta = statusMeta[bug.status] ?? { label: bug.status, short: bug.status }
  const processed = statusMeta[bug.statusAtProcessing]?.label ?? bug.statusAtProcessing

  return (
    <UnstyledButton
      className={`qa-build-bug${pending ? ' is-pending' : ''}`}
      onClick={() => onOpen(bug.id)}
    >
      <Text size="xs" fw={700} c="teal.7">{bug.id}</Text>
      <Text size="xs" lineClamp={1}>{bug.title}</Text>
      <Text size="xs" c="dimmed">
        {bug.area}
        <span className={`qa-build-status status-${bug.status}`} title={`У момент випуску: ${processed}`}>
          {meta.short}
        </span>
        <span className="qa-build-origin">{bug.source === 'codex' ? 'AI' : 'QA'}</span>
      </Text>
    </UnstyledButton>
  )
}

function openTask(taskId: string) {
  window.open(`${deskUrl}/?task=${encodeURIComponent(taskId)}`, '_blank', 'noopener,noreferrer')
}

export function QaBuildTicker() {
  const [opened, setOpened] = useState(false)
  const [build, setBuild] = useState<BuildInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const announcedRef = useRef('')

  const loadBuild = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/qa-desk/api/builds/current')
      if (!response.ok) throw new Error(String(response.status))
      const next = (await response.json()) as BuildInfo
      setBuild(next)
      setFailed(false)

      if (next.number !== __BUILD_NUMBER__ && announcedRef.current !== next.number) {
        announcedRef.current = next.number
        notifications.show({
          id: 'qa-build-changed',
          title: 'Задеплоєно нову версію',
          message: `build ${next.number} — оновіть сторінку, щоб працювати на ній.`,
          color: 'teal',
          icon: <RefreshCw size={16} />,
          autoClose: false,
        })
      }
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void loadBuild(), 0)
    const refreshTimer = window.setInterval(() => void loadBuild(), 60_000)

    return () => {
      window.clearTimeout(initialTimer)
      window.clearInterval(refreshTimer)
    }
  }, [loadBuild])

  const number = build?.number ?? __BUILD_NUMBER__
  const stale = Boolean(build && build.number !== __BUILD_NUMBER__)

  return (
    <Popover opened={opened} onChange={setOpened} position="top-end" width={380} shadow="md" withArrow>
      <Popover.Target>
        <UnstyledButton
          className="qa-build-ticker"
          title={stale ? 'Задеплоєно нову версію — оновіть сторінку' : 'Баги, опрацьовані в поточному build'}
          onClick={() => {
            setOpened((current) => !current)
            if (!opened) void loadBuild()
          }}
        >
          <span className={`qa-build-dot${stale ? ' is-stale' : ''}`} aria-hidden="true" />
          <span className="qa-build-label">BUILD</span>
          <strong>{number}</strong>
          <span className="qa-build-count"><Bug size={10} /> {build?.bugs.length ?? 0}</span>
          <ChevronUp className={opened ? 'is-open' : ''} size={12} />
        </UnstyledButton>
      </Popover.Target>

      <Popover.Dropdown>
        <Stack gap={8}>
          <Text size="xs" c="dimmed">
            Поточний build <Text span fw={700}>{number}</Text>
            {' · '}{build?.bugs.length ?? 0} опрацьовано
          </Text>

          {stale && (
            <Button
              size="xs"
              variant="light"
              color="teal"
              leftSection={<RefreshCw size={14} />}
              onClick={() => window.location.reload()}
            >
              Оновити до {build?.number}
            </Button>
          )}

          {loading && !build ? (
            <Loader size="xs" />
          ) : failed ? (
            <Text size="xs" c="dimmed">QA Desk недоступний.</Text>
          ) : build?.bugs.length ? (
            <ScrollArea.Autosize mah={320}>
              <Stack gap={4}>
                {build.bugs.map((bug) => <BugRow key={bug.id} bug={bug} onOpen={openTask} />)}

                {(build.pending?.length ?? 0) > 0 && (
                  <>
                    <Text size="10px" c="dimmed" fw={700} tt="uppercase" mt={4}>
                      Чекають на наступний деплой · {build.pending.length}
                    </Text>
                    {build.pending.map((bug) => (
                      <BugRow key={`pending-${bug.id}`} bug={bug} pending onOpen={openTask} />
                    ))}
                  </>
                )}
              </Stack>
            </ScrollArea.Autosize>
          ) : (
            <Text size="xs" c="dimmed">У цьому build ще немає опрацьованих багів.</Text>
          )}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  )
}
