import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * Sheet-форми повертаються на список через navigate(returnPath, { replace: true,
 * state: { mutated: true } }). Список лишається змонтованим (backgroundLocation),
 * тому єдиний сигнал про мутацію — цей state. Хук знімає прапорець з історії та
 * викликає reload рівно один раз на кожне повернення з мутацією.
 */
export function useMutatedListRefresh(reload: () => void) {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const state = location.state as { mutated?: boolean } | null

    if (state?.mutated) {
      navigate(`${location.pathname}${location.search}`, { replace: true, state: null })
      reload()
    }
  }, [location.pathname, location.search, location.state, navigate, reload])
}
