import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

// Route-level code splitting keeps recharts (only used on Home) out of the
// initial bundle for every other screen.
const Home = lazy(() => import('./pages/Home'))
const Tickets = lazy(() => import('./pages/Tickets'))
const Resolution = lazy(() => import('./pages/Resolution'))
const AgentRegistry = lazy(() => import('./pages/AgentRegistry'))
const Knowledge = lazy(() => import('./pages/Knowledge'))
const Settings = lazy(() => import('./pages/Settings'))
const AgentBuilderList = lazy(() => import('./agent-builder/AgentBuilderList'))
const AgentCanvas = lazy(() => import('./agent-builder/AgentCanvas'))
const AgentSettings = lazy(() => import('./agent-builder/AgentSettings'))

function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tickets" element={<Tickets />} />
        <Route path="/tickets/:id" element={<Tickets />} />
        <Route path="/tickets/:id/resolution" element={<Resolution />} />
        <Route path="/agents" element={<AgentRegistry />} />
        <Route path="/knowledge" element={<Knowledge />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/agent-builder" element={<AgentBuilderList />} />
        <Route path="/agent-builder/settings" element={<AgentSettings />} />
        <Route path="/agent-builder/new" element={<AgentCanvas />} />
        <Route path="/agent-builder/:agentId/edit" element={<AgentCanvas />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
