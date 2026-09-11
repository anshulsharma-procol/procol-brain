import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
// Imported by file path, not by folder: `./brain-chat` would resolve through
// the SDK's own package.json to its built `dist/` bundle, which is only
// rebuilt on demand and ships its CSS as a separate entry point. Pointing at
// the source keeps the console honest about what the SDK currently does, and
// lets Vite load its CSS modules. External consumers still get `dist`.
import { ProcolBrain } from './brain-chat/index'
import { chatApiBaseUrl } from './platform/api'
import { useWorkspace, WorkspaceProvider } from './platform/react'

// Route-level code splitting keeps recharts (only used on the board) out of
// the initial bundle for every other screen.
const Home = lazy(() => import('./pages/Home'))
const TicketDetail = lazy(() => import('./pages/TicketDetail'))
const Resolution = lazy(() => import('./pages/Resolution'))
const AgentRegistry = lazy(() => import('./pages/AgentRegistry'))
const Connections = lazy(() => import('./pages/Connections'))
const Memory = lazy(() => import('./pages/Memory'))
const Knowledge = lazy(() => import('./pages/Knowledge'))
const Settings = lazy(() => import('./pages/Settings'))

function App() {
  return (
    <WorkspaceProvider>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/tickets/:id" element={<TicketDetail />} />
          <Route path="/tickets/:id/resolution" element={<Resolution />} />
          <Route path="/agents" element={<AgentRegistry />} />
          <Route path="/connections" element={<Connections />} />
          <Route path="/memory" element={<Memory />} />
          <Route path="/knowledge" element={<Knowledge />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>

      <SupportWidget />
    </WorkspaceProvider>
  )
}

/**
 * The embedded Brain Chat SDK — the customer's side of the same product.
 *
 * It lives outside <Routes> so it survives navigation, and it is handed the
 * active workspace as its `companyId`, so the chat a customer sees belongs to
 * the same control tower the console is driving.
 */
function SupportWidget() {
  const { pathname } = useLocation()
  const { id } = useParams<{ id: string }>()
  const { workspace } = useWorkspace()

  const segment = pathname.split('/').filter(Boolean)[0] ?? 'home'

  return (
    <ProcolBrain
      key={workspace.id}
      companyId={workspace.id}
      apiBaseUrl={chatApiBaseUrl}
      userId="anshul.sharma@procol.in"
      context={{
        currentPage: segment,
        currentModule: MODULE_NAMES[segment] ?? 'Control tower',
        recordId: id,
      }}
      onTicketCreated={(ticket) => console.info('[brain] ticket created', ticket.reference)}
      onTicketResolved={(ticket) => console.info('[brain] ticket resolved', ticket.reference)}
    />
  )
}

const MODULE_NAMES: Record<string, string> = {
  home: 'Control tower',
  tickets: 'Ticket investigation',
  agents: 'Agent registry',
  connections: 'Connections',
  memory: 'Institutional memory',
  knowledge: 'Knowledge',
  settings: 'Settings',
}

export default App
