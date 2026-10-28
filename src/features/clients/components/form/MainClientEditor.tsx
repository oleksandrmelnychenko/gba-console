import { Alert, Button, Card, Group, Loader, Stack, Text, TextInput } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { CircleAlert, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { getRootClientBySubClientNetId } from '../../api/clientCabinetApi'
import { getClientsForRegistry, getSuppliers } from '../../api/clientsApi'
import type { Client } from '../../types'
import { getMainClientCandidateName, isMainClientCandidate } from './mainClientCandidate'

const MAIN_CLIENT_SEARCH_DEBOUNCE_MS = 400
const MAIN_CLIENT_SEARCH_LIMIT = 20
const MAIN_CLIENT_SEARCH_MIN_LENGTH = 2

export type MainClientEditorProps = {
  client: Client
  isProvider: boolean
  disabled?: boolean
  lockedReason?: string | null
  onSetMainClient: (mainClientNetUid: string | null) => Promise<void>
}

function hasMainClient(client: Client): boolean {
  return client.MainClientId != null || Boolean(client.IsSubClient || client.IsTradePoint)
}

export function MainClientEditor({
  client,
  isProvider,
  disabled = false,
  lockedReason,
  onSetMainClient,
}: MainClientEditorProps) {
  const { t } = useI18n()
  const [currentLookup, setCurrentLookup] = useState<{ key: string; name: string | null } | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch] = useDebouncedValue(search.trim(), MAIN_CLIENT_SEARCH_DEBOUNCE_MS)
  const [searchResult, setSearchResult] = useState<{ key: string; candidates: Client[] } | null>(null)
  const [busyNetUid, setBusyNetUid] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const clientHasMainClient = hasMainClient(client)
  const canEdit = !disabled && !lockedReason
  const clientNetUid = client.NetUid
  const currentKey = clientNetUid && clientHasMainClient
    ? `${clientNetUid}:${client.MainClientId ?? ''}`
    : null
  const searchKey = canEdit && debouncedSearch.length >= MAIN_CLIENT_SEARCH_MIN_LENGTH
    ? `${isProvider ? 'provider' : 'buyer'}:${clientNetUid ?? ''}:${debouncedSearch}`
    : null
  const isSearchSettled = search.trim() === debouncedSearch
  const isLoadingCurrent = currentKey != null && currentLookup?.key !== currentKey
  const currentName = currentKey != null && currentLookup?.key === currentKey ? currentLookup.name : null
  const isSearching = searchKey != null && isSearchSettled && searchResult?.key !== searchKey
  const candidates = searchKey != null && isSearchSettled && searchResult?.key === searchKey
    ? searchResult.candidates
    : []

  useEffect(() => {
    if (!currentKey || !clientNetUid) {
      return
    }

    let cancelled = false
    getRootClientBySubClientNetId(clientNetUid)
      .then((link) => {
        if (!cancelled) {
          const root = link?.RootClient ?? null
          setCurrentLookup({ key: currentKey, name: root ? getMainClientCandidateName(root) || null : null })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCurrentLookup({ key: currentKey, name: null })
        }
      })

    return () => {
      cancelled = true
    }
  }, [clientNetUid, currentKey])

  useEffect(() => {
    if (!searchKey) {
      return
    }

    const controller = new AbortController()
    const params = { value: debouncedSearch, limit: MAIN_CLIENT_SEARCH_LIMIT, offset: 0 }
    const request = isProvider
      ? getSuppliers(params, controller.signal)
      : getClientsForRegistry(params, controller.signal)

    request
      .then((found) => {
        if (!controller.signal.aborted) {
          setSearchResult({
            key: searchKey,
            candidates: found.filter((candidate) => isMainClientCandidate(candidate, clientNetUid)),
          })
        }
      })
      .catch((searchError) => {
        if (!controller.signal.aborted) {
          setSearchResult({ key: searchKey, candidates: [] })
          setError(searchError instanceof Error ? searchError.message : t('Не вдалося виконати пошук'))
        }
      })

    return () => controller.abort()
  }, [clientNetUid, debouncedSearch, isProvider, searchKey, t])

  async function assign(mainClientNetUid: string | null) {
    if (!canEdit || busyNetUid) {
      return
    }

    setBusyNetUid(mainClientNetUid ?? 'clear')
    setError(null)
    try {
      await onSetMainClient(mainClientNetUid)
      setSearch('')
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : t('Не вдалося змінити головного клієнта'))
    } finally {
      setBusyNetUid(null)
    }
  }

  return (
    <Card className="app-section-card" withBorder radius="md" padding="md">
      <Stack gap="sm">
        <Text className="client-section-title" fw={600}>{t('Головний клієнт')}</Text>
        <Group justify="space-between" align="center" wrap="nowrap">
          <Text size="sm" truncate>
            {isLoadingCurrent
              ? t('Завантаження…')
              : clientHasMainClient
                ? currentName || t('Головний клієнт без назви')
                : t('Не призначено')}
          </Text>
          {canEdit && clientHasMainClient ? (
            <Button
              color="red"
              disabled={Boolean(busyNetUid) && busyNetUid !== 'clear'}
              loading={busyNetUid === 'clear'}
              size="compact-sm"
              variant="light"
              onClick={() => void assign(null)}
            >
              {t('Відʼєднати від головного клієнта')}
            </Button>
          ) : null}
        </Group>

        {lockedReason ? (
          <Text c="dimmed" size="sm">{lockedReason}</Text>
        ) : null}

        {error ? (
          <Alert color="red" icon={<CircleAlert size={16} />} variant="light">
            {error}
          </Alert>
        ) : null}

        {canEdit ? (
          <Stack gap="xs">
            <TextInput
              aria-label={t('Пошук головного клієнта')}
              leftSection={<Search size={16} />}
              placeholder={isProvider ? t('Пошук постачальника') : t('Пошук покупця')}
              size="sm"
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
            />
            {isSearching ? (
              <Group justify="center" py="xs">
                <Loader size="sm" />
              </Group>
            ) : searchKey != null && isSearchSettled && candidates.length === 0 ? (
              <Text c="dimmed" size="sm">{t('Нічого не знайдено')}</Text>
            ) : (
              candidates.map((candidate) => (
                <Group key={candidate.NetUid} justify="space-between" wrap="nowrap" gap="sm">
                  <Stack gap={0} miw={0}>
                    <Text fw={600} size="sm" truncate>{getMainClientCandidateName(candidate) || t('Без назви')}</Text>
                    {candidate.RegionCode?.Value || candidate.USREOU ? (
                      <Text c="dimmed" size="xs" truncate>
                        {[candidate.RegionCode?.Value, candidate.USREOU].filter(Boolean).join(' · ')}
                      </Text>
                    ) : null}
                  </Stack>
                  <Button
                    color="gray"
                    disabled={Boolean(busyNetUid) && busyNetUid !== candidate.NetUid}
                    loading={busyNetUid === candidate.NetUid}
                    size="compact-sm"
                    variant="light"
                    onClick={() => void assign(candidate.NetUid ?? null)}
                  >
                    {t('Зробити головним')}
                  </Button>
                </Group>
              ))
            )}
          </Stack>
        ) : null}
      </Stack>
    </Card>
  )
}
