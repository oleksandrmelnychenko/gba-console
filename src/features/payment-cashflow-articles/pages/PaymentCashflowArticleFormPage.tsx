import {
  Alert,
  Button,
  Card,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconArrowLeft, IconDeviceFloppy, IconTrash } from '@tabler/icons-react'
import { type FormEvent, useEffect } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import {
  createPaymentCashflowArticle,
  deletePaymentCashflowArticle,
  getPaymentCashflowArticle,
  updatePaymentCashflowArticle,
} from '../api/paymentCashflowArticlesApi'
import type { PaymentCashflowArticle, PaymentCashflowArticlePayload } from '../types'

type LocationState = {
  returnPath?: string
}

const ARTICLES_PATH = '/accounting/payment-cashflow-articles'

export function PaymentCashflowArticleFormPage() {
  const { t } = useI18n()
  const { id } = useParams<{ id?: string }>()
  const routeLocation = useLocation()
  const navigate = useNavigate()
  const locationState = routeLocation.state as LocationState | null
  const returnPath = locationState?.returnPath || ARTICLES_PATH
  const isEditMode = Boolean(id)
  const [article, setArticle] = useValueState<PaymentCashflowArticle>(() => createEmptyArticle())
  const [operationName, setOperationName] = useValueState('')
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(isEditMode)
  const [isSaving, setSaving] = useValueState(false)
  const [isDeleting, setDeleting] = useValueState(false)
  const [deleteModalOpened, setDeleteModalOpened] = useValueState(false)

  useEffect(() => {
    if (!id) {
      setArticle(createEmptyArticle())
      setOperationName('')
      setLoading(false)
      return
    }

    const controller = new AbortController()

    async function loadArticle() {
      setLoading(true)
      setError(null)

      try {
        const nextArticle = await getPaymentCashflowArticle(id as string)

        if (!controller.signal.aborted) {
          setArticle(nextArticle || createEmptyArticle())
          setOperationName(nextArticle?.OperationName || '')
        }
      } catch (loadError) {
        if (!isAbortError(loadError)) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити статтю руху коштів'))
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadArticle()

    return () => controller.abort()
  }, [id, setArticle, setError, setLoading, setOperationName, t])

  if (isEditMode && !id) {
    return <Navigate replace to={ARTICLES_PATH} />
  }

  function handleCancel() {
    if (isSaving || isDeleting) {
      return
    }

    navigate(returnPath, { replace: true })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedOperationName = operationName.trim()

    if (!trimmedOperationName) {
      setError(t('Вкажіть назву статті руху коштів'))
      return
    }

    const payload: PaymentCashflowArticlePayload = {
      ...article,
      OperationName: trimmedOperationName,
    }

    setSaving(true)
    setError(null)

    try {
      const savedArticle = isEditMode
        ? await updatePaymentCashflowArticle(payload)
        : await createPaymentCashflowArticle(payload)

      setArticle(savedArticle || payload)
      notifications.show({
        color: 'green',
        message: isEditMode ? t('Статтю руху коштів оновлено') : t('Статтю руху коштів створено'),
      })
      navigate(returnPath, { replace: true })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти статтю руху коштів'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    const netId = article.NetUid || id

    if (!netId) {
      return
    }

    setDeleting(true)
    setError(null)

    try {
      await deletePaymentCashflowArticle(netId)
      notifications.show({
        color: 'green',
        message: t('Статтю руху коштів видалено'),
      })
      navigate(returnPath, { replace: true })
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t('Не вдалося видалити статтю руху коштів'))
    } finally {
      setDeleting(false)
      setDeleteModalOpened(false)
    }
  }

  return (
    <Stack gap="md">
      <Card withBorder radius="md" shadow="sm">
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <Group justify="space-between" wrap="wrap">
              <div>
                <Text fw={700} size="xl">
                  {isEditMode ? t('Редагування статті руху коштів') : t('Нова стаття руху коштів')}
                </Text>
              </div>

              <Group gap="xs">
                <Button
                  color="gray"
                  leftSection={<IconArrowLeft size={16} />}
                  type="button"
                  variant="light"
                  onClick={handleCancel}
                >
                  {t('Назад')}
                </Button>
                {isEditMode && (
                  <Button
                    color="red"
                    disabled={isLoading}
                    leftSection={<IconTrash size={16} />}
                    loading={isDeleting}
                    type="button"
                    variant="light"
                    onClick={() => setDeleteModalOpened(true)}
                  >
                    {t('Видалити')}
                  </Button>
                )}
                <Button
                  color="violet"
                  disabled={isLoading}
                  leftSection={<IconDeviceFloppy size={16} />}
                  loading={isSaving}
                  type="submit"
                >
                  {t('Зберегти')}
                </Button>
              </Group>
            </Group>

            {error && (
              <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
                {error}
              </Alert>
            )}

            <TextInput
              autoFocus
              disabled={isLoading || isSaving || isDeleting}
              label={t('Назва')}
              placeholder={t('Вкажіть назву')}
              required
              value={operationName}
              onChange={(event) => setOperationName(event.currentTarget.value)}
            />
          </Stack>
        </form>
      </Card>

      <Modal
        centered
        opened={deleteModalOpened}
        title={t('Видалити статтю руху коштів')}
        onClose={() => setDeleteModalOpened(false)}
      >
        <Stack gap="md">
          <Text>
            {t('Видалити статтю')} <Text span fw={600}>{operationName || t('Без назви')}</Text>?
          </Text>
          <Group justify="flex-end">
            <Button color="gray" disabled={isDeleting} variant="light" onClick={() => setDeleteModalOpened(false)}>
              {t('Скасувати')}
            </Button>
            <Button color="red" leftSection={<IconTrash size={16} />} loading={isDeleting} onClick={handleDelete}>
              {t('Видалити')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}

function createEmptyArticle(): PaymentCashflowArticle {
  return {
    OperationName: '',
    PaymentMovementOperations: [],
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
