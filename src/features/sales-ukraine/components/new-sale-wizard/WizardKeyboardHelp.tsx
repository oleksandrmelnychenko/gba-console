import { ActionIcon, Group, Popover, Text, UnstyledButton } from '@mantine/core'
import { CircleHelp, Keyboard, X } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { useWizardKeyboardSnapshot, type WizardKeyboardState } from './wizardKeyboard'
import './wizard-keyboard-help.css'

type Hint = [keys: string, label: string]

function getHints(state: WizardKeyboardState): Hint[] {
  switch (state) {
    case 'ClientSearch':
    case 'ClientSelection':
    case 'ClientAgreementSelection':
      return [['↑ ↓', 'Вибрати клієнта'], ['← →', 'Вибрати договір'], ['Enter', 'Підтвердити вибір клієнта'], ['Esc', 'Повернутися до попереднього режиму']]
    case 'ProductSearch':
      return [['↑ ↓', 'Перейти до вибору товару'], ['Enter', 'Додати вибраний товар'], ['Ctrl + Enter', 'Відкрити деталі вибраного товару'], ['F3', 'Відкрити / закрити кошик'], ['F2', 'Редагувати кошик'], ['Esc', 'Вийти з форми']]
    case 'ProductSelection':
      return [['↑ ↓', 'Попередній / наступний товар'], ['Enter', 'Вказати кількість і додати в кошик'], ['Пробіл', 'Перейти до аналогів або комплектуючих'], ['Ctrl + Enter', 'Відкрити деталі'], ['Ctrl + I', 'Збільшити фото'], ['F3', 'Відкрити / закрити кошик'], ['F2', 'Редагувати кошик'], ['Esc', 'Повернутися до пошуку']]
    case 'AnalogueSelection':
    case 'ComponentSelection':
      return [['↑ ↓', 'Попередня / наступна позиція'], ['Enter', 'Вказати кількість і додати в кошик'], ['Ctrl + Enter', 'Відкрити деталі'], ['F3', 'Відкрити / закрити кошик'], ['F2', 'Редагувати кошик'], ['Esc', 'Повернутися до товару']]
    case 'FullDetail':
    case 'AnalogueFullDetail':
    case 'ComponentFullDetail':
      return [['← →', 'Перемикати тип наявності'], ['↑ ↓', 'Переміщатися між позиціями або рядками залишків'], ['Enter', 'Вказати кількість і додати в кошик'], ['Ctrl + I', 'Збільшити фото'], ['F2', 'Редагувати кошик'], ['Esc', 'Назад до попереднього режиму']]
    case 'EditShoppingCart':
      return [['↑ ↓', 'Вибрати рядок кошика'], ['Enter', 'Редагувати вибрану позицію'], ['Пробіл', 'Перемкнути режим розділення'], ['Delete', 'Запит на видалення позиції'], ['Esc', 'Вийти з редагування кошика']]
    case 'EditProductDescription':
      return [['Tab', 'Перейти до наступного поля або кнопки'], ['F2', 'Завершити редагування й відкрити кошик']]
    case 'ViewImage':
    case 'Interest':
      return [['Esc', 'Закрити вікно'], ['F2', 'Перейти до редагування кошика']]
    default:
      return [['Tab', 'Наступне поле'], ['Shift + Tab', 'Попереднє поле'], ['Enter', 'Підтвердити оформлення продажу'], ['Esc', 'Запит на вихід']]
  }
}

export function WizardKeyboardHelp() {
  const { t } = useI18n()
  const keyboard = useWizardKeyboardSnapshot()
  const [opened, setOpened] = useState(false)
  const label = keyboard.label || t('Клавіатура')
  const hasCartShortcut = ['ProductSearch', 'ProductSelection', 'AnalogueSelection', 'ComponentSelection'].includes(keyboard.state)

  return (
    <Popover opened={opened} onChange={setOpened} position="top-start" width={420} withinPortal shadow="md" trapFocus returnFocus closeOnEscape={false}>
      <Popover.Target>
        <UnstyledButton
          data-wizard-keyboard-help
          className="new-sale-wizard-keyboard-state wizard-keyboard-help-trigger"
          aria-label={`${t('Навігація клавіатурою')} · ${label}`}
          aria-expanded={opened}
          aria-haspopup="dialog"
          onClick={() => setOpened((value) => !value)}
        >
          <Keyboard size={16} aria-hidden />
          <span className="new-sale-wizard-keyboard-state__value">{label}</span>
          <CircleHelp size={14} aria-hidden />
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown
        data-wizard-keyboard-help
        className="wizard-keyboard-help"
        role="dialog"
        aria-label={t('Навігація клавіатурою')}
        onKeyDownCapture={(event) => {
          event.stopPropagation()
          if (event.key === 'Escape') {
            event.preventDefault()
            setOpened(false)
          }
        }}
      >
        <Group justify="space-between" wrap="nowrap">
          <Text className="wizard-keyboard-help__title">{t('Навігація клавіатурою')}</Text>
          <ActionIcon aria-label={t('Закрити підказку')} color="gray" variant="subtle" onClick={() => setOpened(false)}><X size={16} /></ActionIcon>
        </Group>
        <Text className="wizard-keyboard-help__mode">{label}</Text>
        <dl className="wizard-keyboard-help__keys">
          {getHints(keyboard.state).map(([keys, description]) => (
            <div key={keys}><dt><kbd>{keys}</kbd></dt><dd>{t(description)}</dd></div>
          ))}
        </dl>
        {hasCartShortcut && (
          <Text size="xs" c="dimmed" mt="sm">
            {t('У відкритому кошику')} <kbd>F3</kbd> {t('або')} <kbd>Esc</kbd> — {t('закрити кошик')}.
          </Text>
        )}
        <div className="wizard-keyboard-help__steps">
          <span><kbd>Alt + 1</kbd>{t('Клієнти')}</span>
          <span><kbd>Alt + 2</kbd>{t('Товари')}</span>
          <span><kbd>Alt + 3</kbd>{t('Перевізники')}</span>
        </div>
        <Text size="xs" c="dimmed">{t('Переходи й дії доступні після вибору потрібних даних та відповідно до ваших прав.')}</Text>
      </Popover.Dropdown>
    </Popover>
  )
}
