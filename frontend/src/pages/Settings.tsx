import { Settings as SettingsIcon } from 'lucide-react'
import Card from '../components/Card'
import PageShell from '../components/PageShell'
import TopBar from '../components/TopBar'

// Not one of the five reference screens — a minimal placeholder so the
// sidebar's Settings nav item has somewhere to go.
export default function Settings() {
  return (
    <PageShell tip="Configure Procol Brain to match your team.">
      <TopBar />
      <div className="px-8 py-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Workspace and agent configuration.</p>

        <Card className="mt-6 flex flex-col items-center gap-3 p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100">
            <SettingsIcon className="h-6 w-6 text-gray-500" />
          </div>
          <p className="text-sm font-medium text-gray-900">Nothing to configure in this demo yet</p>
          <p className="max-w-sm text-sm text-gray-500">
            Settings is out of scope for the Procol Brain demo — the other five screens carry the story.
          </p>
        </Card>
      </div>
    </PageShell>
  )
}
