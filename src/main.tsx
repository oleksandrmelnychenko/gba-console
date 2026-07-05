import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { AppProviders } from './app/providers/AppProviders'
import { installDomMutationResilience } from './shared/dom/domMutationResilience'
import './index.css'
import '@mantine/charts/styles.css'
import './shared/transitions/transitions.css'
import './shared/ui/filter-bar.css'

// Guard React reconciliation against browser translation / extensions that mutate
// the DOM (otherwise a stray removeChild/insertBefore white-screens the whole app).
installDomMutationResilience()

// After a redeploy the open tab still references the previous build's hashed
// chunks; the first lazy-route navigation then 404s («Failed to fetch
// dynamically imported module»). Reload once to pick up the fresh index.html.
window.addEventListener('vite:preloadError', (event) => {
  const RELOAD_FLAG = 'chunk-reload-at'
  const lastReload = Number(sessionStorage.getItem(RELOAD_FLAG) || 0)

  if (Date.now() - lastReload > 30_000) {
    event.preventDefault()
    sessionStorage.setItem(RELOAD_FLAG, String(Date.now()))
    window.location.reload()
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
)
