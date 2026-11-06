import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerServiceWorker } from './lib/registerSW'
import { startAppConfig } from './store/appConfigStore'
import { startEngagement } from './lib/engagement'
import { startSeasonalIcon } from './lib/seasonalIcon'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// After the first paint, so fetching and parsing the worker never competes
// with rendering the screen somebody is waiting on.
registerServiceWorker()

// Admin switches such as bill payments; the last answer is applied at once
// from localStorage and refreshed from the network.
startAppConfig()

// What signed-in customers do, batched, for reminder nudges.
startEngagement()

// The tab icon follows the season an admin has scheduled.
void startSeasonalIcon()
