import {
  Alert,
  Button,
  Card,
  Group,
  Loader,
  Stack,
  Text,
} from '@mantine/core'
import { AppDrawer } from "../../../shared/ui/AppDrawer"
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { notifications } from '@mantine/notifications'
import { CircleAlert, FolderTree, Package, RotateCcw, Save } from 'lucide-react'
import { type FormEvent, useEffect, useMemo } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { useI18n } from '../../../shared/i18n/useI18n'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { PermissionGate } from '../../auth/components/PermissionGate'
import { usePermissions } from '../../auth/usePermissions'
import {
  getProductGroupDetailsRootGroups,
  getProductGroupWithRoot,
  updateProductGroup,
} from '../api/productGroupsApi'
import { ProductGroupForm } from '../components/ProductGroupForm'
import { ProductGroupProductsPanel } from '../components/ProductGroupProductsPanel'
import { ProductGroupSubGroupsPanel } from '../components/ProductGroupSubGroupsPanel'
import type { ProductGroup } from '../types'
import {
  buildRootProductGroupChanges,
  getCurrentRootProductGroup,
  normalizeProductGroupForSave,
  validateProductGroup,
} from '../utils'
import './product-group-detail-page.css'
import '../../../shared/ui/screen-tabs.css'

type ProductGroupContentTab = 'products' | 'subGroups'

type ProductGroupDetailRouteState = {
  returnPath?: string
}

export function ProductGroupDetailPage() {
  return (
    <PermissionGate permissionKey={PermissionKeys.ProductGroups.Page.View} fallback={<ProductGroupDetailPermissionDenied />}>
      <PermissionGate permissionKey={PermissionKeys.ProductGroups.Group.OpenDetails} fallback={<ProductGroupDetailPermissionDenied />}>
        <ProductGroupDetailPageContent />
      </PermissionGate>
    </PermissionGate>
  )
}

function ProductGroupDetailPermissionDenied() {
  const { t } = useI18n()

  return (
    <Alert color="red" icon={<CircleAlert size={18} />} title={t('Доступ заборонено')} variant="light">
      {t('У вашої ролі немає права переглядати товарні групи.')}
    </Alert>
  )
}

function ProductGroupDetailPageContent() {
  const { t } = useI18n()
  const { can } = usePermissions()
  const canEdit = can(PermissionKeys.ProductGroups.Group.Edit)
  const canOpenProduct = can(PermissionKeys.ProductsAssortment.Page.View)
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const routeState = location.state as ProductGroupDetailRouteState | null
  const returnPath = routeState?.returnPath || '/product-groups'
  const [productGroup, setProductGroup] = useValueState<ProductGroup | null>(null)
  const [formProductGroup, setFormProductGroup] = useValueState<ProductGroup | null>(null)
  const [rootGroups, setRootGroups] = useValueState<ProductGroup[]>([])
  const [selectedRootNetUid, setSelectedRootNetUid] = useValueState<string | null>(null)
  const [activeTab, setActiveTab] = useValueState<ProductGroupContentTab>('subGroups')
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isSaving, setSaving] = useValueState(false)
  const [isLoadingRootGroups, setLoadingRootGroups] = useValueState(true)
  const rootGroupsForForm = useMemo(() => {
    const currentRootProductGroup = getCurrentRootProductGroup(productGroup)

    if (
      currentRootProductGroup?.NetUid &&
      !rootGroups.some((rootGroup) => rootGroup.NetUid === currentRootProductGroup.NetUid)
    ) {
      return [currentRootProductGroup, ...rootGroups]
    }

    return rootGroups
  }, [productGroup, rootGroups])
  const isEdited = useMemo(() => {
    if (!productGroup || !formProductGroup) {
      return false
    }

    const baselineRootNetUid = getCurrentRootProductGroup(productGroup)?.NetUid || null

    return (
      (formProductGroup.Name || '') !== (productGroup.Name || '') ||
      (formProductGroup.FullName || '') !== (productGroup.FullName || '') ||
      (formProductGroup.Description || '') !== (productGroup.Description || '') ||
      formProductGroup.IsActive !== productGroup.IsActive ||
      (selectedRootNetUid || null) !== baselineRootNetUid
    )
  }, [formProductGroup, productGroup, selectedRootNetUid])

  useEffect(() => {
    if (!id) {
      return
    }

    const productGroupNetId = id
    let cancelled = false

    async function loadProductGroup() {
      setLoading(true)
      setLoadingRootGroups(true)
      setError(null)

      try {
        const [nextProductGroup, nextRootGroups] = await Promise.all([
          getProductGroupWithRoot(productGroupNetId),
          getProductGroupDetailsRootGroups(productGroupNetId),
        ])

        if (!cancelled) {
          setProductGroup(nextProductGroup)
          setFormProductGroup(nextProductGroup)
          setRootGroups(nextRootGroups)
          setSelectedRootNetUid(getCurrentRootProductGroup(nextProductGroup)?.NetUid || null)
        }
      } catch (loadError) {
        if (!cancelled) {
          setProductGroup(null)
          setFormProductGroup(null)
          setRootGroups([])
          setSelectedRootNetUid(null)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити групу товарів'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
          setLoadingRootGroups(false)
        }
      }
    }

    void loadProductGroup()

    return () => {
      cancelled = true
    }
  }, [id, setError, setFormProductGroup, setLoading, setLoadingRootGroups, setProductGroup, setRootGroups, setSelectedRootNetUid, t])

  if (!id) {
    return <Navigate to="/product-groups" replace />
  }

  function setField<TKey extends keyof ProductGroup>(key: TKey, value: ProductGroup[TKey]) {
    setFormProductGroup((currentProductGroup) =>
      currentProductGroup
        ? {
            ...currentProductGroup,
            [key]: value,
          }
        : currentProductGroup,
    )
  }

  function resetEdits() {
    setFormProductGroup(productGroup)
    setSelectedRootNetUid(getCurrentRootProductGroup(productGroup)?.NetUid || null)
    setError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canEdit || !productGroup || !formProductGroup) {
      return
    }

    const selectedRootProductGroup =
      rootGroupsForForm.find((rootGroup) => rootGroup.NetUid === selectedRootNetUid) || null
    const rootProductGroups = buildRootProductGroupChanges(productGroup, selectedRootProductGroup)
    const payload = normalizeProductGroupForSave(formProductGroup, rootProductGroups)
    const validationError = validateProductGroup(payload)

    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError(null)

    try {
      const updatedProductGroup = await updateProductGroup(payload)
      const nextProductGroup = updatedProductGroup || payload

      setProductGroup(nextProductGroup)
      setFormProductGroup(nextProductGroup)
      setSelectedRootNetUid(getCurrentRootProductGroup(nextProductGroup)?.NetUid || null)
      notifications.show({
        color: 'green',
        message: t('Групу товарів збережено'),
      })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти групу товарів'))
    } finally {
      setSaving(false)
    }
  }

  function closeSheet() {
    if (isSaving) {
      return
    }

    navigate(returnPath, { replace: true })
  }

  return (
    <AppDrawer
      className="product-group-detail-sheet"
      opened
      closeOnClickOutside={!isSaving}
      footer={canEdit ? (
          <Group gap="xs">
            <Button
              color="gray"
              disabled={!isEdited || isSaving}
              leftSection={<RotateCcw size={16} />}
              type="button"
              variant="light"
              onClick={resetEdits}
            >
              {t('Скасувати')}
            </Button>
            <Button
              color={CREATE_ACTION_COLOR}
              disabled={!formProductGroup || !isEdited}
              form="product-group-edit-form"
              leftSection={<Save size={16} />}
              loading={isSaving}
              type="submit"
            >
              {t('Зберегти')}
            </Button>
          </Group>
      ) : undefined}
      keepMounted={false}
      position="right"
      size="min(900px, 100vw)"
      title={<span className="product-group-detail-title">{productGroup?.Name || t('Товарна група')}</span>}
      onClose={closeSheet}
    >
    <Stack className="product-group-detail-content" gap={10}>
      {error && (
        <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
          {error}
        </Alert>
      )}

      {isLoading ? (
        <Card withBorder radius="md" padding="lg">
          <Group justify="center" py="xl">
            <Loader color="orange" size="sm" />
            <Text c="dimmed" size="sm">
              {t('Завантаження групи товарів')}
            </Text>
          </Group>
        </Card>
      ) : formProductGroup ? (
        <form id="product-group-edit-form" onSubmit={handleSubmit}>
          <Card className="app-section-card product-group-detail-form-card" withBorder radius="md" padding={12}>
            <Text className="app-section-title" mb={10}>{t('Товарна група')}</Text>
            <ProductGroupForm
              compact
              disabled={!canEdit || isSaving}
              isLoadingRootGroups={isLoadingRootGroups}
              productGroup={formProductGroup}
              rootGroups={rootGroupsForForm}
              selectedRootNetUid={selectedRootNetUid}
              onFieldChange={setField}
              onRootGroupChange={setSelectedRootNetUid}
            />
          </Card>
        </form>
      ) : (
        <Card withBorder radius="md" padding="lg">
          <Text c="dimmed">{t('Групу товарів не знайдено')}</Text>
        </Card>
      )}

      {productGroup?.NetUid && (
        <Card
          className="app-data-card product-group-detail-registry"
          withBorder
          radius="md"
          padding={0}
        >
          <div
            aria-label={t('Розділи товарної групи')}
            className="app-screen-tabs product-group-detail-tabs"
            role="tablist"
          >
            {([
              { value: 'subGroups', label: t('Підгрупи'), icon: FolderTree },
              { value: 'products', label: t('Товари'), icon: Package },
            ] as const).map((tab) => (
              <button
                key={tab.value}
                type="button"
                className={`app-screen-tab${activeTab === tab.value ? ' is-active' : ''}`}
                aria-selected={activeTab === tab.value}
                role="tab"
                onClick={() => setActiveTab(tab.value)}
              >
                <tab.icon size={16} aria-hidden />
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'subGroups' && <ProductGroupSubGroupsPanel productGroupNetId={productGroup.NetUid} />}
          {activeTab === 'products' && (
            <ProductGroupProductsPanel
              canOpenProduct={canOpenProduct}
              productGroupNetId={productGroup.NetUid}
            />
          )}
        </Card>
      )}

    </Stack>
    </AppDrawer>
  )
}
