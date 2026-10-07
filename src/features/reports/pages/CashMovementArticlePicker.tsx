import { Alert, Button, Group, NativeSelect, Stack, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { useCashMovementArticleChoices } from '../hooks/useCashMovementArticleChoices'

export function CashMovementArticlePicker({ choices, disabled }: { choices: ReturnType<typeof useCashMovementArticleChoices>; disabled: boolean }) {
  const { t } = useI18n()
  return <Stack gap="xs">
    {choices.loading ? <Text role="status">{t('Завантажуємо статті руху коштів…')}</Text> : null}
    {choices.available === false ? <Alert color="yellow">{t('Список статей за вибрані періоди ще не готовий. Звіт без відбору за статтею доступний.')}</Alert> : null}
    {choices.available === true && choices.choices.length === 0 ? <Alert color="blue">{t(choices.continuation
      ? 'На цій сторінці немає доступних назв статей. Перегляньте наступну сторінку.' : 'За вибрані періоди немає доступних статей руху коштів.')}</Alert> : null}
    {choices.error ? <Alert color="red">{t(choices.error)}</Alert> : null}
    {choices.choices.length > 0 ? <NativeSelect label={t('Стаття руху коштів')} value={choices.selectedKey ?? ''}
      disabled={disabled || choices.loading} onChange={event => choices.select(event.currentTarget.value)}
      data={[{ value: '', label: t('Без відбору за статтею') }, ...choices.choices.map(choice => ({ value: choice.Key, label: choice.Caption }))]} /> : null}
    <Group>
      {choices.continuation ? <Button type="button" variant="light" disabled={disabled || choices.loading} onClick={choices.loadMore}>{t('Ще статті')}</Button> : null}
      <Button type="button" variant="subtle" disabled={disabled || !choices.eligible || choices.loading} onClick={choices.refresh}>{t('Оновити статті')}</Button>
    </Group>
  </Stack>
}
