import { Alert, Anchor, Loader, ThemeIcon } from '@mantine/core'
import { CircleAlert, Download, FileText } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ExportDocument } from '../../documents/exportDocument'
import { useI18n } from '../../i18n/useI18n'
import { getDocumentHref } from '../../url/getDocumentHref'
import { AppModal } from '../AppModal'
import { ExcelIcon } from '../ExcelIcon'
import { WordIcon } from '../WordIcon'
import './document-export-modal.css'

export type DocumentExportFormat = 'excel' | 'pdf'
type DocumentCardFormat = DocumentExportFormat | 'word'

export type DocumentExportItem = {
  description?: string
  format: DocumentCardFormat
  label?: string
  url: string
}

type DocumentExportModalProps = {
  document?: ExportDocument | null
  documentFormat?: 'excel' | 'word'
  emptyText?: string
  error?: string | null
  excelUrl?: string | null
  isLoading?: boolean
  items?: ReadonlyArray<DocumentExportItem>
  loadingFormat?: DocumentExportFormat | null
  notice?: ReactNode
  opened: boolean
  pdfUrl?: string | null
  title: string
  onClose: () => void
  onSelectFormat?: (format: DocumentExportFormat) => void
}

export function DocumentExportModal({
  document = null,
  documentFormat = 'excel',
  emptyText,
  error = null,
  excelUrl,
  isLoading = false,
  items,
  loadingFormat = null,
  notice,
  opened,
  pdfUrl,
  title,
  onClose,
  onSelectFormat,
}: DocumentExportModalProps) {
  const { t } = useI18n()
  const resolvedExcelUrl = excelUrl ?? document?.DocumentURL ?? null
  const resolvedPdfUrl = pdfUrl ?? document?.PdfDocumentURL ?? null
  const resolvedItems = items
    ? items.filter((item) => Boolean(item.url))
    : [
        resolvedExcelUrl
          ? {
              format: documentFormat,
              url: resolvedExcelUrl,
            }
          : null,
        resolvedPdfUrl
          ? {
              format: 'pdf' as const,
              url: resolvedPdfUrl,
            }
          : null,
      ].filter((item): item is DocumentExportItem => Boolean(item))
  const hasDocument = resolvedItems.length > 0
  const isFormatPicker = Boolean(onSelectFormat) && !hasDocument && !error
  const isBusy = isLoading || Boolean(loadingFormat)

  const heroLabel = isBusy
    ? t('Формування документа')
    : isFormatPicker || hasDocument
      ? t('Готово до завантаження')
      : error
        ? t('Помилка формування')
        : t('Документ недоступний')
  const heroTitle = isBusy
    ? t('Зачекайте, файл формується')
    : isFormatPicker || hasDocument
      ? t('Виберіть формат файлу')
      : error
        ? t('Не вдалося сформувати файл')
        : t('Файл не сформовано')
  const heroDescription = isBusy
    ? isFormatPicker
      ? t('Після формування файл відкриється у новій вкладці.')
      : t('Посилання відкриються у новій вкладці.')
    : isFormatPicker
      ? t('Файл буде сформовано після вибору формату.')
      : hasDocument
        ? t('Посилання відкриються у новій вкладці.')
        : t('Сервер не повернув посилання для завантаження.')

  return (
    <AppModal
      centered
      classNames={{
        body: 'document-export-modal-body',
        content: 'document-export-modal-content',
        header: 'document-export-modal-header',
        title: 'document-export-modal-title',
      }}
      closeOnClickOutside={!isBusy}
      closeOnEscape={!isBusy}
      opened={opened}
      size="lg"
      title={
        <div>
          <span>{t('Експорт')}</span>
          <strong>{title || t('Документ')}</strong>
        </div>
      }
      withCloseButton={!isBusy}
      onClose={onClose}
    >
      <div className="document-export-modal">
        {notice}

        <div className="document-export-hero">
          <ThemeIcon className="document-export-hero-icon" color="orange" radius="xl" size={42} variant="light">
            {isBusy ? <Loader color="orange" size={20} /> : <Download size={20} />}
          </ThemeIcon>
          <div>
            <span>{heroLabel}</span>
            <strong>{heroTitle}</strong>
            <small>{heroDescription}</small>
          </div>
        </div>

        {error ? (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        ) : isFormatPicker ? (
          <div className="document-export-options">
            <button
              aria-label={t('Завантажити Excel')}
              className="document-export-card is-excel"
              disabled={isBusy}
              type="button"
              onClick={() => onSelectFormat?.('excel')}
            >
              <DocumentCardContent
                action={loadingFormat === 'excel' ? t('Формування...') : t('Завантажити')}
                description={t('Табличний файл для роботи з даними')}
                format="excel"
              />
            </button>
            <button
              aria-label={t('Завантажити PDF')}
              className="document-export-card is-pdf"
              disabled={isBusy}
              type="button"
              onClick={() => onSelectFormat?.('pdf')}
            >
              <DocumentCardContent
                action={loadingFormat === 'pdf' ? t('Формування...') : t('Завантажити')}
                description={t('Документ для друку або перегляду')}
                format="pdf"
              />
            </button>
          </div>
        ) : hasDocument ? (
          <div className="document-export-options">
            {resolvedItems.map((item, index) => (
              <Anchor
                key={`${item.label || item.format}-${index}`}
                className={`document-export-card is-${item.format}`}
                href={getDocumentHref(item.url)}
                rel="noreferrer"
                target="_blank"
              >
                <DocumentCardContent
                  action={t('Відкрити')}
                  description={item.description || (
                    item.format === 'word'
                      ? t('Документ для редагування у Word')
                      : item.format === 'excel'
                        ? t('Табличний файл для роботи з даними')
                      : t('Документ для друку або перегляду')
                  )}
                  format={item.format}
                  label={item.label}
                />
              </Anchor>
            ))}
          </div>
        ) : isBusy ? null : (
          <div className="document-export-empty">
            <ThemeIcon color="gray" radius="xl" size={38} variant="light">
              <CircleAlert size={18} />
            </ThemeIcon>
            <div>
              <strong>{emptyText || t('Документ недоступний для завантаження')}</strong>
              <span>{t('Спробуйте сформувати експорт ще раз.')}</span>
            </div>
          </div>
        )}
      </div>
    </AppModal>
  )
}

function DocumentCardContent({
  action,
  description,
  format,
  label,
}: {
  action: string
  description: string
  format: DocumentCardFormat
  label?: string
}) {
  return (
    <>
      <span className="document-export-card-icon">
        {format === 'excel' ? (
          <ExcelIcon size={24} />
        ) : format === 'word' ? (
          <WordIcon size={24} />
        ) : (
          <FileText size={24} strokeWidth={1.8} />
        )}
      </span>
      <span className="document-export-card-text">
        <strong>{label || (format === 'excel' ? 'Excel' : format === 'word' ? 'Word' : 'PDF')}</strong>
        <small>{description}</small>
      </span>
      <span className="document-export-card-action">{action}</span>
    </>
  )
}
