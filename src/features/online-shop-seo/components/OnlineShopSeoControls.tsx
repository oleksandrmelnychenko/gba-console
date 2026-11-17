import {
  Accordion,
  Alert,
  Badge,
  Button,
  Group,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core'
import { CircleAlert, RotateCcw, Save, Search } from 'lucide-react'
import { type FormEvent, type ReactNode } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { isMoneyValue } from '../../../shared/ui/moneyTypography'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import type {
  SeoContactInfo,
  SeoContactInfoFormValues,
  SeoLocaleEntry,
  SeoPaymentFormValues,
  SeoRetailPaymentInfo,
} from '../types'
import {
  contactInfoToFormValues,
  getContactInfoFieldErrors,
  getLocaleLabel,
  hasPaymentRecord,
  paymentToFormValues,
  SEO_FIELD_MAX_LENGTH,
  type SeoContactInfoFieldErrors,
} from '../utils'

type SearchToolbarProps = {
  action?: ReactNode
  placeholder: string
  value: string
  onChange: (value: string) => void
  onReset: () => void
}

export function SearchToolbar({ action, placeholder, value, onChange, onReset }: SearchToolbarProps) {
  const { t } = useI18n()

  return (
    <Group align="end" gap="sm" wrap="nowrap" className="app-filter-fields clients-filter-row">
      <TextInput
        leftSection={<Search size={16} />}
        label={t('Пошук')}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        style={{ flex: '1 1 auto', minWidth: 180 }}
      />
      <Button variant="default" color="gray" size="sm" leftSection={<RotateCcw size={16} />}
        onClick={onReset} style={{ flexShrink: 0 }}>{t('Скинути')}</Button>
      {action}
    </Group>
  )
}

type LocaleAccordionProps = {
  children: (entry: SeoLocaleEntry) => ReactNode
  emptyText: string
  entries: SeoLocaleEntry[]
}

export function LocaleAccordion({ children, emptyText, entries }: LocaleAccordionProps) {
  const { t } = useI18n()

  if (!entries.length) {
    return (
      <Text c="dimmed" size="sm">
        {t(emptyText)}
      </Text>
    )
  }

  return (
    <Accordion defaultValue={entries[0]?.locale} variant="contained">
      {entries.map((entry) => (
        <Accordion.Item key={entry.locale} value={entry.locale}>
          <Accordion.Control>
            <Group gap="xs">
              <Badge className="app-role-pill is-orange" variant="light">
                {getLocaleLabel(entry.locale)}
              </Badge>
              <Text fw={600}>{entry.locale}</Text>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>{children(entry)}</Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion>
  )
}

type ContactInfoFormProps = {
  contactInfo: SeoContactInfo | null
  isSaving: boolean
  locale: string
  onSave: (locale: string, contactInfo: SeoContactInfo | null, values: SeoContactInfoFormValues) => Promise<void>
}

export function ContactInfoForm({ contactInfo, isSaving, locale, onSave }: ContactInfoFormProps) {
  const { t } = useI18n()
  const [values, setValues] = useValueState(() => contactInfoToFormValues(contactInfo))
  const [fieldErrors, setFieldErrors] = useValueState<SeoContactInfoFieldErrors>({})

  function setField<K extends keyof SeoContactInfoFormValues>(key: K, value: SeoContactInfoFormValues[K]) {
    setValues((currentValues) => ({
      ...currentValues,
      [key]: value,
    }))
    setFieldErrors((currentErrors) => (currentErrors[key] ? { ...currentErrors, [key]: undefined } : currentErrors))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = getContactInfoFieldErrors(values)

    setFieldErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    void onSave(locale, contactInfo, values)
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md">
        <Textarea
          autosize
          label={t('Адреса')}
          maxLength={SEO_FIELD_MAX_LENGTH.Address}
          minRows={3}
          value={values.Address}
          onChange={(event) => setField('Address', event.currentTarget.value)}
        />
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <TextInput
            error={fieldErrors.Phone}
            label={t('Телефон')}
            maxLength={SEO_FIELD_MAX_LENGTH.ContactInfoPhone}
            type="tel"
            value={values.Phone}
            onChange={(event) => setField('Phone', event.currentTarget.value)}
          />
          <TextInput
            error={fieldErrors.Email}
            label="E-mail"
            maxLength={SEO_FIELD_MAX_LENGTH.ContactInfoEmail}
            value={values.Email}
            onChange={(event) => setField('Email', event.currentTarget.value)}
          />
          <TextInput
            error={fieldErrors.SiteUrl}
            label="Site URL"
            maxLength={SEO_FIELD_MAX_LENGTH.SiteUrl}
            placeholder="https://"
            value={values.SiteUrl}
            onChange={(event) => setField('SiteUrl', event.currentTarget.value)}
          />
          <TextInput
            label="Pixel ID"
            maxLength={SEO_FIELD_MAX_LENGTH.PixelId}
            value={values.PixelId}
            onChange={(event) => setField('PixelId', event.currentTarget.value)}
          />
        </SimpleGrid>
        <Group justify="flex-end">
          <Button color={CREATE_ACTION_COLOR} leftSection={<Save size={16} />} loading={isSaving} type="submit">
            {t('Зберегти')}
          </Button>
        </Group>
      </Stack>
    </form>
  )
}

type PaymentInfoFormProps = {
  isSaving: boolean
  locale: string
  onSave: (locale: string, payment: SeoRetailPaymentInfo | null, values: SeoPaymentFormValues) => Promise<void>
  payment: SeoRetailPaymentInfo | null
}

export function PaymentInfoForm({ isSaving, locale, onSave, payment }: PaymentInfoFormProps) {
  const { t } = useI18n()
  const [values, setValues] = useValueState(() => paymentToFormValues(payment))
  const canSave = hasPaymentRecord(payment)

  function setField<K extends keyof SeoPaymentFormValues>(key: K, value: SeoPaymentFormValues[K]) {
    setValues((currentValues) => ({
      ...currentValues,
      [key]: value,
    }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void onSave(locale, payment, values)
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md">
        {!canSave && (
          <Alert color="yellow" icon={<CircleAlert size={18} />} variant="light">
            {t('Запис оплати для цієї мови відсутній. Сервер дозволяє лише оновлювати наявний запис, тому створити його з інтерфейсу неможливо.')}
          </Alert>
        )}
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <TextInput
            classNames={{ input: isMoneyValue(values.LowPrice) ? 'app-money' : undefined }}
            label={t('Передплата')}
            maxLength={SEO_FIELD_MAX_LENGTH.LowPrice}
            value={values.LowPrice}
            onChange={(event) => setField('LowPrice', event.currentTarget.value)}
          />
          <TextInput
            classNames={{ input: isMoneyValue(values.FullPrice) ? 'app-money' : undefined }}
            label={t('Повна ціна')}
            maxLength={SEO_FIELD_MAX_LENGTH.FullPrice}
            value={values.FullPrice}
            onChange={(event) => setField('FullPrice', event.currentTarget.value)}
          />
        </SimpleGrid>
        <TextInput
          label={t('Коментар для картки')}
          maxLength={SEO_FIELD_MAX_LENGTH.Comment}
          value={values.Comment}
          onChange={(event) => setField('Comment', event.currentTarget.value)}
        />
        <TextInput
          label={t('Повідомлення про успішне замовлення')}
          maxLength={SEO_FIELD_MAX_LENGTH.FastOrderSuccessMessage}
          value={values.FastOrderSuccessMessage}
          onChange={(event) => setField('FastOrderSuccessMessage', event.currentTarget.value)}
        />
        <TextInput
          label={t('Повідомлення')}
          value={values.ScreenshotMessage}
          onChange={(event) => setField('ScreenshotMessage', event.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button
            color={CREATE_ACTION_COLOR}
            disabled={!canSave}
            leftSection={<Save size={16} />}
            loading={isSaving}
            type="submit"
          >
            {t('Зберегти')}
          </Button>
        </Group>
      </Stack>
    </form>
  )
}

type StatusBadgeProps = {
  active: boolean
  activeLabel: string
  inactiveLabel: string
}

export function StatusBadge({ active, activeLabel, inactiveLabel }: StatusBadgeProps) {
  const { t } = useI18n()

  return (
    <Badge color={active ? 'green' : 'gray'} variant="light">
      {active ? t(activeLabel) : t(inactiveLabel)}
    </Badge>
  )
}
