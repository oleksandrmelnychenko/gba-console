import { Badge, Loader, Popover, ScrollArea, Stack, Text, UnstyledButton } from '@mantine/core'
import { useEffect, useState } from 'react'

const deskUrl = (import.meta.env.VITE_QA_DESK_URL ?? 'https://gba-qa-desk.85.17.167.167.nip.io').replace(/\/$/, '')

interface BuildBug {
  id: string
  title: string
  area: string
  source: 'codex' | 'manual'
  statusAtProcessing: string
}

interface BuildInfo {
  number: string
  bugs: BuildBug[]
}

const statusLabels: Record<string, string> = {
  new: 'Нова',
  in_progress: 'В роботі',
  ready_for_retest: 'На перевірці',
  review_again: 'На повторному ревʼю',
  done: 'Готово',
  blocked: 'Заблоковано',
}

export function QaBuildTicker() {
  const [opened, setOpened] = useState(false)
  const [build, setBuild] = useState<BuildInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const loadBuild = async () => {
    setLoading(true)
    try {
      const response = await fetch('/qa-desk/api/builds/current')
      if (!response.ok) throw new Error(String(response.status))
      setBuild((await response.json()) as BuildInfo)
      setFailed(false)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadBuild()
    const timer = window.setInterval(() => void loadBuild(), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const openTask = (taskId: string) => {
    window.open(`${deskUrl}/?task=${encodeURIComponent(taskId)}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <Popover opened={opened} onChange={setOpened} position="top-end" width={380} shadow="md" withArrow>
      <Popover.Target>
        <UnstyledButton
          className="console-footer-build"
          title="Баги, опрацьовані в поточному build"
          onClick={() => {
            setOpened((current) => !current)
            if (!opened) void loadBuild()
          }}
        >
          build {build?.number ?? __BUILD_NUMBER__}
          {!failed && <Badge size="xs" color="orange" variant="light" ml={6}>{build?.bugs.length ?? 0}</Badge>}
        </UnstyledButton>
      </Popover.Target>

      <Popover.Dropdown>
        <Stack gap={8}>
          <Text size="xs" c="dimmed">
            Поточний build <Text span fw={700} c="orange.7">{build?.number ?? __BUILD_NUMBER__}</Text>
            {' · '}{build?.bugs.length ?? 0} опрацьовано
          </Text>

          {loading && !build ? (
            <Loader size="xs" />
          ) : failed ? (
            <Text size="xs" c="dimmed">QA Desk недоступний.</Text>
          ) : build?.bugs.length ? (
            <ScrollArea.Autosize mah={320}>
              <Stack gap={4}>
                {build.bugs.map((bug) => (
                  <UnstyledButton key={bug.id} className="qa-build-bug" onClick={() => openTask(bug.id)}>
                    <Text size="xs" fw={700} c="orange.7">{bug.id}</Text>
                    <Text size="xs" lineClamp={1}>{bug.title}</Text>
                    <Text size="xs" c="dimmed">
                      {bug.area} · {statusLabels[bug.statusAtProcessing] ?? bug.statusAtProcessing}
                      {' · '}{bug.source === 'codex' ? 'AI' : 'QA'}
                    </Text>
                  </UnstyledButton>
                ))}
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
