import {
  Accordion,
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from '@mantine/core'
import { IconAlertCircle, IconDeviceFloppy, IconRestore, IconSearch } from '@tabler/icons-react'
import { type FormEvent, type ReactNode } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import type {
  SeoContactInfo,
  SeoContactInfoFormValues,
  SeoLocaleEntry,
  SeoPaymentFormValues,
  SeoRetailPaymentInfo,
} from '../types'
import {
  contactInfoToFormValues,
  getLocaleLabel,
  hasPaymentRecord,
  paymentToFormValues,
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
    <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
      <TextInput
        leftSection={<IconSearch size={16} />}
        label={t('Пошук')}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        style={{ flex: '1 1 auto', minWidth: 180 }}
      />
      <Tooltip label={t('Скинути')}>
        <ActionIcon
          aria-label={t('Скинути')}
          color="gray"
          size={36}
          style={{ flex: '0 0 auto' }}
          type="button"
          variant="light"
          onClick={onReset}
        >
          <IconRestore size={18} />
        </ActionIcon>
      </Tooltip>
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
              <Badge color="violet" variant="light">
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

  function setField<K extends keyof SeoContactInfoFormValues>(key: K, value: SeoContactInfoFormValues[K]) {
    setValues((currentValues) => ({
      ...currentValues,
      [key]: value,
    }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void onSave(locale, contactInfo, values)
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md">
        <Textarea
          autosize
          label={t('Адреса')}
          minRows={3}
          value={values.Address}
          onChange={(event) => setField('Address', event.currentTarget.value)}
        />
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <TextInput
            label={t('Телефон')}
            value={values.Phone}
            onChange={(event) => setField('Phone', event.currentTarget.value)}
          />
          <TextInput label="E-mail" value={values.Email} onChange={(event) => setField('Email', event.currentTarget.value)} />
          <TextInput label="Site URL" value={values.SiteUrl} onChange={(event) => setField('SiteUrl', event.currentTarget.value)} />
          <TextInput label="Pixel ID" value={values.PixelId} onChange={(event) => setField('PixelId', event.currentTarget.value)} />
        </SimpleGrid>
        <Group justify="flex-end">
          <Button color="violet" leftSection={<IconDeviceFloppy size={16} />} loading={isSaving} type="submit">
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
          <Alert color="yellow" icon={<IconAlertCircle size={18} />} variant="light">
            {t('Запис оплати відсутній')}
          </Alert>
        )}
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <TextInput
            label={t('Передплата')}
            value={values.LowPrice}
            onChange={(event) => setField('LowPrice', event.currentTarget.value)}
          />
          <TextInput
            label={t('Повна ціна')}
            value={values.FullPrice}
            onChange={(event) => setField('FullPrice', event.currentTarget.value)}
          />
        </SimpleGrid>
        <TextInput
          label={t('Коментар для картки')}
          value={values.Comment}
          onChange={(event) => setField('Comment', event.currentTarget.value)}
        />
        <TextInput
          label={t('Повідомлення про успішне замовлення')}
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
            color="violet"
            disabled={!canSave}
            leftSection={<IconDeviceFloppy size={16} />}
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
