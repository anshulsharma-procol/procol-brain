import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

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
  )
}

export default App
