import { Alert, Button, Group, Stack, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { PLANNED_CASH_SCENARIO_PENDING } from '../data/plannedCash'
import type { usePlannedCashScenarioChoices } from '../hooks/usePlannedCashScenarioChoices'

export function PlannedCashScenarioPicker({ choices, disabled }: { choices: ReturnType<typeof usePlannedCashScenarioChoices>; disabled: boolean }) {
  const { t } = useI18n()
  return <Stack gap="xs">
    {choices.loading ? <Text role="status">{t('Завантажуємо сценарії плану…')}</Text> : null}
    {choices.available === false ? <Alert color="yellow">{t(PLANNED_CASH_SCENARIO_PENDING)}</Alert> : null}
    {choices.available === true && choices.choices.length === 0 ? <Alert color="blue">{t(choices.continuation
      ? 'На цій сторінці немає доступних назв сценаріїв. Перегляньте наступну сторінку.' : 'За обрані періоди немає доступних сценаріїв плану.')}</Alert> : null}
    {choices.error ? <Alert color="red">{t(choices.error)}</Alert> : null}
    {choices.choices.length > 0 ? <label>{t('Сценарій плану')}
      <select aria-label={t('Сценарій плану')} value={choices.selectedKey ?? ''} disabled={disabled || choices.loading}
        onChange={event => choices.select(event.currentTarget.value)}>
        <option value="" disabled>{t('Оберіть сценарій')}</option>
        {choices.choices.map(choice => <option key={choice.Key} value={choice.Key}>{choice.Caption}</option>)}
      </select>
    </label> : null}
    <Group>
      {choices.continuation ? <Button type="button" variant="light" disabled={disabled || choices.loading} onClick={choices.loadMore}>{t('Ще сценарії')}</Button> : null}
      <Button type="button" variant="subtle" disabled={disabled || !choices.eligible || choices.loading} onClick={choices.refresh}>{t('Оновити сценарії')}</Button>
    </Group>
  </Stack>
}
