import { AppModal, type AppModalProps } from '../../../shared/ui/AppModal'
import './report-modal.css'

/** Shared compact shell for report constructors and their result previews. */
export function ReportModal({ className, ...props }: AppModalProps) {
  return <AppModal {...props} className={['app-compact-form', 'report-modal', className].filter(Boolean).join(' ')} />
}
