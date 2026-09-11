import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { ProcolBrain } from './brain-chat'

// Route-level code splitting keeps recharts (only used on Home) out of the
// initial bundle for every other screen.
const Home = lazy(() => import('./pages/Home'))
const TicketDetail = lazy(() => import('./pages/TicketDetail'))
const Resolution = lazy(() => import('./pages/Resolution'))
const AgentRegistry = lazy(() => import('./pages/AgentRegistry'))
const Knowledge = lazy(() => import('./pages/Knowledge'))
const Settings = lazy(() => import('./pages/Settings'))

function App() {
  return (
    <>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/tickets/:id" element={<TicketDetail />} />
          <Route path="/tickets/:id/resolution" element={<Resolution />} />
          <Route path="/agents" element={<AgentRegistry />} />
          <Route path="/knowledge" element={<Knowledge />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>

      <SupportWidget />
    </>
  )
}

/**
 * The embedded Brain Chat SDK. Lives outside <Routes> so it survives
 * navigation, and reads the current route to tell Brain where it was opened.
 */
function SupportWidget() {
  const { pathname } = useLocation()
  const { id } = useParams<{ id: string }>()

  const segment = pathname.split('/').filter(Boolean)[0] ?? 'home'
  const moduleName = MODULE_NAMES[segment] ?? 'Command Center'

  return (
    <ProcolBrain
      companyId="procol"
      userId="anshul.sharma@procol.in"
      context={{ currentPage: segment, currentModule: moduleName, recordId: id }}
      onTicketCreated={(ticket) => console.info('[brain] ticket created', ticket.reference)}
      onTicketResolved={(ticket) => console.info('[brain] ticket resolved', ticket.reference)}
    />
  )
}

const MODULE_NAMES: Record<string, string> = {
  home: 'Command Center',
  tickets: 'Ticket Investigation',
  agents: 'Agent Registry',
  knowledge: 'Knowledge',
  settings: 'Settings',
}

export default App
