import { ActionIcon, Box, Group, Indicator, Loader, Popover, ScrollArea, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconPackage, IconX } from '@tabler/icons-react'
import { useEffect, useReducer } from 'react'
import { useAuth } from '../../auth/useAuth'
import { useI18n } from '../../../shared/i18n/useI18n'
import { deleteProductWriteOffRule, getProductWriteOffBaseRules } from '../api/productWriteOffRulesApi'
import type { ProductWriteOffRule } from '../types'

type RulesState = {
  error: Error | null
  isLoading: boolean
  items: ProductWriteOffRule[]
  opened: boolean
  removingNetUid: string | null
}

type RulesAction =
  | { type: 'openedChanged'; opened: boolean }
  | { type: 'loadStarted' }
  | { type: 'loadSucceeded'; items: ProductWriteOffRule[] }
  | { type: 'loadFailed'; error: Error }
  | { type: 'removeStarted'; netUid: string }
  | { type: 'removeSucceeded'; netUid: string }
  | { type: 'removeFailed'; error: Error }

const initialRulesState: RulesState = {
  error: null,
  isLoading: false,
  items: [],
  opened: false,
  removingNetUid: null,
}

function rulesReducer(state: RulesState, action: RulesAction): RulesState {
  switch (action.type) {
    case 'openedChanged':
      return {
        ...state,
        opened: action.opened,
      }
    case 'loadStarted':
      return {
        ...state,
        error: null,
        isLoading: true,
      }
    case 'loadSucceeded':
      return {
        ...state,
        error: null,
        isLoading: false,
        items: action.items,
      }
    case 'loadFailed':
      return {
        ...state,
        error: action.error,
        isLoading: false,
        items: [],
      }
    case 'removeStarted':
      return {
        ...state,
        removingNetUid: action.netUid,
      }
    case 'removeSucceeded':
      return {
        ...state,
        items: state.items.filter((item) => item.NetUid !== action.netUid),
        removingNetUid: null,
      }
    case 'removeFailed':
      return {
        ...state,
        error: action.error,
        removingNetUid: null,
      }
    default:
      return state
  }
}

export function ProductWriteOffRulesControl() {
  const { isAuthenticated, session } = useAuth()
  const { t } = useI18n()
  const [state, dispatch] = useReducer(rulesReducer, initialRulesState)

  useEffect(() => {
    if (!isAuthenticated || !session?.csrfToken) {
      return undefined
    }

    let cancelled = false
    dispatch({ type: 'loadStarted' })

    getProductWriteOffBaseRules()
      .then((items) => {
        if (!cancelled) {
          dispatch({ type: 'loadSucceeded', items })
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          dispatch({ type: 'loadFailed', error })
        }
      })

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, session?.csrfToken])

  async function removeRule(rule: ProductWriteOffRule) {
    if (!rule.NetUid) {
      return
    }

    dispatch({ type: 'removeStarted', netUid: rule.NetUid })

    try {
      await deleteProductWriteOffRule(rule.NetUid)
      dispatch({ type: 'removeSucceeded', netUid: rule.NetUid })
      notifications.show({ color: 'green', message: t('Правило списання видалено') })
    } catch (error) {
      const message = error instanceof Error ? error.message : t('Не вдалося видалити правило списання')
      dispatch({ type: 'removeFailed', error: error as Error })
      notifications.show({ color: 'red', message })
    }
  }

  return (
    <Popover
      opened={state.opened}
      onChange={(opened) => dispatch({ type: 'openedChanged', opened })}
      width={310}
      position="bottom-end"
      shadow="md"
    >
      <Popover.Target>
        <ActionIcon
          aria-label={t('Глобальні правила списання')}
          className="console-header-action"
          variant="subtle"
          color="gray"
          size="lg"
          title={t('Глобальні правила списання')}
          onClick={() => dispatch({ type: 'openedChanged', opened: !state.opened })}
        >
          <Indicator label={state.items.length} size={16} color="orange" disabled={state.items.length === 0}>
            <IconPackage size={24} stroke={1.7} />
          </Indicator>
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown className="write-off-rules-popover">
        <Text size="sm" fw={700} mb={8}>
          {t('Глобальні правила списання')}
        </Text>

        {state.isLoading && (
          <Group gap="xs">
            <Loader size="xs" color="violet" />
            <Text size="sm" c="dimmed">
              {t('Завантаження')}
            </Text>
          </Group>
        )}

        {!state.isLoading && state.error && (
          <Text size="sm" c="red">
            {state.error.message}
          </Text>
        )}

        {!state.isLoading && !state.error && state.items.length === 0 && (
          <Text size="sm" c="dimmed">
            {t('Немає правил списання')}
          </Text>
        )}

        {!state.isLoading && !state.error && state.items.length > 0 && (
          <ScrollArea h={220} type="auto">
            <Stack gap={6}>
              {state.items.map((rule) => (
                <Group key={rule.NetUid || rule.Id} gap="xs" justify="space-between" wrap="nowrap" className="write-off-rule-row">
                  <Box>
                    <Text size="sm" fw={600}>
                      {parseRuleLocale(rule.RuleLocale, t)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {parseRuleType(rule.RuleType, t)}
                    </Text>
                  </Box>
                  <ActionIcon
                    aria-label={t('Видалити')}
                    color="red"
                    variant="subtle"
                    loading={state.removingNetUid === rule.NetUid}
                    onClick={() => removeRule(rule)}
                  >
                    <IconX size={15} stroke={2} />
                  </ActionIcon>
                </Group>
              ))}
            </Stack>
          </ScrollArea>
        )}
      </Popover.Dropdown>
    </Popover>
  )
}

function parseRuleLocale(locale: string | undefined, t: (key: 'Україна' | 'Польща' | 'Невідома зона') => string): string {
  switch (locale) {
    case 'pl':
      return t('Україна')
    case 'uk':
      return t('Польща')
    default:
      return t('Невідома зона')
  }
}

function parseRuleType(
  type: number | undefined,
  t: (key: 'Списати по вазі' | 'Списати по ціні' | 'Списати по календарю' | 'Невідомий тип') => string,
): string {
  switch (type) {
    case 0:
      return t('Списати по вазі')
    case 1:
      return t('Списати по ціні')
    case 2:
      return t('Списати по календарю')
    default:
      return t('Невідомий тип')
  }
}
