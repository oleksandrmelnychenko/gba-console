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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
)
