import { ProcolBrain } from '../../src'

/**
 * Smallest possible integration. In a real application the import would be:
 *
 *   import { ProcolBrain } from '@procol/brain-chat'
 */
export default function App() {
  return (
    <>
      <main>
        <h1>Your application</h1>
      </main>

      <ProcolBrain companyId="abc-corp" userId="user-123" />
    </>
  )
}
