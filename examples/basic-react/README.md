# basic-react

The minimum integration:

```tsx
import { ProcolBrain } from '@procol/brain-chat'

export default function App() {
  return (
    <>
      <ExistingApplication />
      <ProcolBrain companyId="abc-corp" userId="user-123" />
    </>
  )
}
```

With a real backend, branding and host context:

```tsx
<ProcolBrain
  companyId="acme"
  userId={session.user.id}
  apiBaseUrl="https://brain-api.acme.com"
  assistantName="Acme Support AI"
  logo="/acme-logo.svg"
  position="bottom-right"
  theme={{ primaryColor: '#0f766e', borderRadius: 12 }}
  context={{ currentPage: 'grn', currentModule: 'GRN', recordId: 'GRN/2627/5' }}
  onTicketCreated={(ticket) => analytics.track('support_ticket_created', ticket)}
/>
```
