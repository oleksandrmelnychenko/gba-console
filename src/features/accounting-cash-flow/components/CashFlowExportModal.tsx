import { Anchor, Loader, ThemeIcon } from '@mantine/core'
import { CircleAlert, Download, FileText } from 'lucide-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { AppModal } from '../../../shared/ui/AppModal'
import { getDocumentHref } from '../../../shared/url/getDocumentHref'
import type { AccountingCashFlowDocument } from '../types'
import './cash-flow-export-modal.css'

export type CashFlowExportFormat = 'excel' | 'pdf'

type CashFlowExportModalProps = {
  document: AccountingCashFlowDocument | null
  loadingFormat?: CashFlowExportFormat | null
  opened: boolean
  title: string
  onClose: () => void
  onSelectFormat?: (format: CashFlowExportFormat) => void
}

export function CashFlowExportModal({
  document,
  loadingFormat = null,
  opened,
  title,
  onClose,
  onSelectFormat,
}: CashFlowExportModalProps) {
  const { t } = useI18n()
  const hasExcel = Boolean(document?.DocumentURL)
  const hasPdf = Boolean(document?.PdfDocumentURL)
  const hasDocument = hasExcel || hasPdf
  const isFormatPicker = Boolean(onSelectFormat) && !hasDocument
  const isLoading = Boolean(loadingFormat)

  const heroLabel = isLoading
    ? t('Формування документа')
    : isFormatPicker || hasDocument
      ? t('Готово до завантаження')
      : t('Документ недоступний')
  const heroTitle = isLoading
    ? t('Зачекайте, файл формується')
    : isFormatPicker || hasDocument
      ? t('Виберіть формат файлу')
      : t('Файл не сформовано')
  const heroDescription = isLoading
    ? t('Після формування файл відкриється у новій вкладці.')
    : isFormatPicker
      ? t('Файл буде сформовано після вибору формату.')
      : hasDocument
        ? t('Посилання відкриються у новій вкладці.')
        : t('Сервер не повернув посилання для завантаження.')

  return (
    <AppModal
      centered
      classNames={{
        body: 'cash-flow-export-modal-body',
        content: 'cash-flow-export-modal-content',
        header: 'cash-flow-export-modal-header',
        title: 'cash-flow-export-modal-title',
      }}
      closeOnClickOutside={!isLoading}
      closeOnEscape={!isLoading}
      opened={opened}
      size="lg"
      title={
        <div>
          <span>{t('Експорт')}</span>
          <strong>{title || t('Документ')}</strong>
        </div>
      }
      withCloseButton={!isLoading}
      onClose={onClose}
    >
      <div className="cash-flow-export-modal">
        <div className="cash-flow-export-hero">
          <ThemeIcon className="cash-flow-export-hero-icon" color="orange" radius="xl" size={42} variant="light">
            {isLoading ? <Loader color="orange" size={20} /> : <Download size={20} />}
          </ThemeIcon>
          <div>
            <span>{heroLabel}</span>
            <strong>{heroTitle}</strong>
            <small>{heroDescription}</small>
          </div>
        </div>

        {isFormatPicker ? (
          <div className="cash-flow-export-options">
            <button
              aria-label={t('Завантажити Excel')}
              className="cash-flow-export-card is-excel"
              disabled={isLoading}
              type="button"
              onClick={() => onSelectFormat?.('excel')}
            >
              <span className="cash-flow-export-card-icon">
                <ExcelIcon size={24} />
              </span>
              <span className="cash-flow-export-card-text">
                <strong>{t('Excel')}</strong>
                <small>{t('Табличний файл для роботи з даними')}</small>
              </span>
              <span className="cash-flow-export-card-action">
                {loadingFormat === 'excel' ? t('Формування...') : t('Завантажити')}
              </span>
            </button>
            <button
              aria-label={t('Завантажити PDF')}
              className="cash-flow-export-card is-pdf"
              disabled={isLoading}
              type="button"
              onClick={() => onSelectFormat?.('pdf')}
            >
              <span className="cash-flow-export-card-icon">
                <FileText size={24} strokeWidth={1.8} />
              </span>
              <span className="cash-flow-export-card-text">
                <strong>{t('PDF')}</strong>
                <small>{t('Документ для друку або перегляду')}</small>
              </span>
              <span className="cash-flow-export-card-action">
                {loadingFormat === 'pdf' ? t('Формування...') : t('Завантажити')}
              </span>
            </button>
          </div>
        ) : hasDocument ? (
          <div className="cash-flow-export-options">
            {document?.DocumentURL ? (
              <Anchor
                className="cash-flow-export-card is-excel"
                href={getDocumentHref(document.DocumentURL)}
                rel="noreferrer"
                target="_blank"
              >
                <span className="cash-flow-export-card-icon">
                  <ExcelIcon size={24} />
                </span>
                <span className="cash-flow-export-card-text">
                  <strong>{t('Excel')}</strong>
                  <small>{t('Табличний файл для роботи з даними')}</small>
                </span>
                <span className="cash-flow-export-card-action">{t('Відкрити')}</span>
              </Anchor>
            ) : null}
            {document?.PdfDocumentURL ? (
              <Anchor
                className="cash-flow-export-card is-pdf"
                href={getDocumentHref(document.PdfDocumentURL)}
                rel="noreferrer"
                target="_blank"
              >
                <span className="cash-flow-export-card-icon">
                  <FileText size={24} strokeWidth={1.8} />
                </span>
                <span className="cash-flow-export-card-text">
                  <strong>{t('PDF')}</strong>
                  <small>{t('Документ для друку або перегляду')}</small>
                </span>
                <span className="cash-flow-export-card-action">{t('Відкрити')}</span>
              </Anchor>
            ) : null}
          </div>
        ) : (
          <div className="cash-flow-export-empty">
            <ThemeIcon color="gray" radius="xl" size={38} variant="light">
              <CircleAlert size={18} />
            </ThemeIcon>
            <div>
              <strong>{t('Документ недоступний для завантаження')}</strong>
              <span>{t('Спробуйте сформувати експорт ще раз.')}</span>
            </div>
          </div>
        )}
      </div>
    </AppModal>
  )
}
