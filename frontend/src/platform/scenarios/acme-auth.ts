import type { Scenario } from './types'

/**
 * TEST CASE 2 — AcmeCloud · a generic SaaS company.
 *
 * Read this file next to `procol-gst.ts`. The two are the same shape, the
 * same stages, the same approval gate and the same timeline — and the only
 * substantive difference is that `clara` has become `acme-knowledge`.
 *
 * That is the sentence the demo exists to earn: the workflow did not change.
 * We replaced Procol's Clara with the customer's own knowledge agent, because
 * Brain routes on declared capability rather than on the name of an agent.
 */
export const acmeAuthScenario: Scenario = {
  id: 'acme-auth',
  workspaceId: 'acmecloud',
  path: 'CODE_FIX',
  status: 'AWAITING_APPROVAL',
  approvalPolicyId: 'production-auth',
  replayScale: 420,

  ticket: {
    reference: 'ACME-7821',
    title: 'All users receiving 401 Unauthorized after deployment',
    description:
      'Every user of XYZ Corp is being rejected at login with 401 Unauthorized since yesterday’s deployment.',
    customer: 'XYZ Corp',
    reportedBy: 'Priya Raman · IT Operations',
    channel: 'chat',
    priority: 'CRITICAL',
    category: 'Authentication',
    impact: 'All users on the tenant — complete login outage',
    createdMinutesAgo: 6,
    issueQuote: [
      'Since yesterday’s deployment, all our users are getting 401 Unauthorized when trying to log into AcmeCloud.',
      'Nothing changed on our side. We have tried new sessions, cleared tokens, and it fails for every account including admins.',
    ],
  },

  events: [
    {
      atSeconds: 0,
      from: 'brain',
      kind: 'thought',
      title: 'Ticket received from the customer chat',
      body: [
        'Classified as an authentication failure, critical, tenant-wide. A total login outage that began after a deployment is almost never a customer configuration problem, but I am not going to assume that — I need the deployment history first.',
      ],
      level: 'warn',
      durationMs: 580,
    },
    {
      atSeconds: 2,
      from: 'brain',
      kind: 'thought',
      title: 'Asking the registry who can answer product questions here',
      body: [
        'This workspace has no Clara. It declares an agent with product_knowledge and incident_history — AcmeCloud’s own Company Knowledge Agent. I route to the capability, so nothing about this run is different.',
      ],
      level: 'info',
      durationMs: 170,
    },
    {
      atSeconds: 3,
      from: 'brain',
      to: 'acme-knowledge',
      taskType: 'GET_PRODUCT_CONTEXT',
      kind: 'request',
      title: 'What changed in yesterday’s deployment, and have we seen this before?',
      payload: {
        taskId: 'TASK-11c2',
        from: 'brain',
        to: 'acme-knowledge',
        type: 'GET_PRODUCT_CONTEXT',
        context: {
          ticketId: 'ACME-7821',
          customer: 'XYZ Corp',
          issue: '401 Unauthorized for all users after deployment',
        },
      },
      level: 'info',
    },
    {
      atSeconds: 5,
      from: 'acme-knowledge',
      to: 'brain',
      taskType: 'GET_PRODUCT_CONTEXT',
      kind: 'response',
      title: 'Authentication uses JWT; yesterday’s release changed the issuer configuration',
      body: [
        'The authentication service validates JWTs against a configured issuer. Release 2026.09.10 altered the JWT_ISSUER environment variable. Incident INC-382 had the same signature in January and was also an issuer mismatch.',
      ],
      logs: [
        'searched internal documentation — 3 matches',
        'read auth-service runbook §4 (token validation)',
        'read release notes 2026.09.10',
        'matched previous incident INC-382',
      ],
      durationMs: 940,
      level: 'success',
      completesStage: 'context',
      payload: {
        taskId: 'TASK-11c2',
        status: 'completed',
        agent: 'acme-knowledge',
        result: {
          authMechanism: 'JWT',
          expectedIssuer: 'auth.acmecloud.com',
          changedIn: 'release 2026.09.10',
          isProductDefect: true,
          priorIncidents: ['INC-382'],
          citations: ['auth-service-runbook.md#token-validation', 'release-notes-2026-09-10.md'],
        },
      },
    },
    {
      atSeconds: 7,
      from: 'brain',
      kind: 'thought',
      title: 'Decision: this is a code fix in the deployment configuration',
      body: [
        'The tenant is configured correctly and the regression came from our own release, so this goes to engineering. Same decision rule as every other workspace.',
      ],
      level: 'info',
      durationMs: 860,
    },
    {
      atSeconds: 9,
      from: 'brain',
      to: 'dev-agent',
      taskType: 'INVESTIGATE_BUG',
      kind: 'request',
      title: 'Trace the 401 regression to the issuer configuration and open a pull request',
      payload: {
        taskId: 'TASK-4b90',
        from: 'brain',
        to: 'dev-agent',
        type: 'INVESTIGATE_BUG',
        context: {
          ticketId: 'ACME-7821',
          issue: '401 Unauthorized for all users',
          knowledge: { expectedIssuer: 'auth.acmecloud.com', priorIncidents: ['INC-382'] },
        },
      },
      level: 'info',
    },
    {
      atSeconds: 12,
      from: 'dev-agent',
      to: 'brain',
      taskType: 'INVESTIGATE_BUG',
      kind: 'response',
      title: 'Root cause: JWT_ISSUER was set to the API host instead of the auth host',
      body: [
        'The deployment manifest sets JWT_ISSUER to api.acmecloud.com. Tokens are minted with issuer auth.acmecloud.com, so every token fails the issuer check and the service returns 401 — correctly, against the wrong expectation.',
      ],
      logs: [
        'indexed 4 files in services/auth',
        'diffed deploy/production.yaml against the previous release',
        'located verifyToken() in services/auth/jwt.js:34',
        'opened PR #892 against main',
      ],
      durationMs: 3960,
      level: 'success',
      completesStage: 'investigate',
      payload: {
        taskId: 'TASK-4b90',
        status: 'completed',
        agent: 'dev-agent',
        result: { confidence: 0.97, filesChanged: ['deploy/production.yaml', 'services/auth/jwt.js'] },
        artifacts: [{ kind: 'ROOT_CAUSE' }, { kind: 'PR', title: 'PR #892' }],
      },
    },
    {
      atSeconds: 13,
      from: 'dev-agent',
      kind: 'artifact',
      artifactId: 'root-cause',
      title: 'Root cause recorded',
      level: 'success',
    },
    {
      atSeconds: 14,
      from: 'dev-agent',
      kind: 'artifact',
      artifactId: 'pr-892',
      title: 'Pull request #892 opened',
      level: 'success',
    },
    {
      atSeconds: 16,
      from: 'brain',
      to: 'qa-agent',
      taskType: 'VALIDATE_FIX',
      kind: 'request',
      title: 'Validate PR #892 against the authentication regression suite',
      payload: {
        taskId: 'TASK-7e15',
        from: 'brain',
        to: 'qa-agent',
        type: 'VALIDATE_FIX',
        context: { ticketId: 'ACME-7821', branch: 'fix/jwt-issuer', pr: 892 },
      },
      level: 'info',
    },
    {
      atSeconds: 19,
      from: 'qa-agent',
      to: 'brain',
      taskType: 'VALIDATE_FIX',
      kind: 'response',
      title: '32 of 32 tests passed',
      body: [
        'Login, logout, token refresh, invalid token, expired token and multi-tenant authentication all pass against the patched branch.',
      ],
      logs: [
        'checked out fix/jwt-issuer',
        'ran 32 assertions across 6 suites',
        'verified tokens minted before the fix still validate',
      ],
      durationMs: 2240,
      level: 'success',
      completesStage: 'verify',
      payload: {
        taskId: 'TASK-7e15',
        status: 'completed',
        agent: 'qa-agent',
        result: { status: 'passed', total: 32, passed: 32, failed: 0, durationMs: 2240 },
      },
    },
    {
      atSeconds: 20,
      from: 'qa-agent',
      kind: 'artifact',
      artifactId: 'tests-auth',
      title: 'Test report recorded',
      level: 'success',
    },
    {
      atSeconds: 22,
      from: 'brain',
      kind: 'gate',
      title: 'Stopping for human approval',
      body: [
        'Changes to authentication in production always require human approval. Root cause, pull request and a passing suite are attached — the decision is yours.',
      ],
      level: 'warn',
    },
  ],

  artifacts: [
    {
      id: 'root-cause',
      kind: 'ROOT_CAUSE',
      title: 'Root cause',
      createdBy: 'dev-agent',
      data: {
        headline: 'JWT_ISSUER was changed to the API host during deployment.',
        detail:
          'Tokens are minted with issuer auth.acmecloud.com, but the deployed auth service validates against api.acmecloud.com. Every token fails the issuer check, so the service returns 401 for every user on every tenant.',
        evidence: [
          'deploy/production.yaml — JWT_ISSUER: api.acmecloud.com',
          'services/auth/jwt.js:34 — issuer compared strictly against process.env.JWT_ISSUER',
          'Incident INC-382 (January) — identical signature, identical cause',
        ],
      },
    },
    {
      id: 'pr-892',
      kind: 'PR',
      title: 'PR #892',
      createdBy: 'dev-agent',
      data: {
        number: '#892',
        title: 'Fix JWT issuer configuration',
        url: 'https://github.com/acmecloud/platform/pull/892',
        repository: 'acmecloud/platform',
        filesChanged: ['deploy/production.yaml', 'services/auth/jwt.js'],
        additions: 6,
        deletions: 2,
        state: 'open',
        diff: [
          { type: 'context', text: '  env:' },
          { type: 'remove', text: '    JWT_ISSUER: api.acmecloud.com' },
          { type: 'add', text: '    JWT_ISSUER: auth.acmecloud.com' },
          { type: 'context', text: '' },
          { type: 'context', text: '  // services/auth/jwt.js' },
          { type: 'add', text: '  assertIssuerConfigured(process.env.JWT_ISSUER);' },
        ],
      },
    },
    {
      id: 'tests-auth',
      kind: 'TEST_RESULT',
      title: 'Authentication regression suite',
      createdBy: 'qa-agent',
      data: {
        suite: 'Authentication',
        total: 32,
        passed: 32,
        failed: 0,
        durationMs: 2240,
        cases: [
          'Login',
          'Logout',
          'Token refresh',
          'Invalid token rejected',
          'Expired token rejected',
          'Multi-tenant authentication',
        ],
      },
    },
    {
      id: 'reply-auth',
      kind: 'CUSTOMER_REPLY',
      title: 'Customer reply',
      createdBy: 'brain',
      data: {
        subject: 'Authentication issue resolved — ACME-7821',
        body: [
          'Hi XYZ Corp,',
          'We have identified and fixed the authentication issue that was causing 401 errors after our recent deployment. A configuration value for token validation was pointing at the wrong host, so valid tokens were being rejected.',
          'The fix has passed our full authentication regression suite and has been approved for deployment.',
          'Please try logging in again. If you continue to experience any issues, reply to this ticket.',
        ],
        signature: 'AcmeCloud Support',
        sent: false,
      },
    },
  ],

  memory: {
    title: 'JWT issuer mismatch after deployment causes tenant-wide 401s',
    symptom: 'All users receive 401 Unauthorized immediately after a release',
    rootCause:
      'The deployment set JWT_ISSUER to the API host while tokens are minted with the auth host, so every issuer check failed.',
    resolution:
      'Restore JWT_ISSUER to auth.acmecloud.com and assert the value at boot so the mismatch fails loudly on start. PR #892.',
    path: 'CODE_FIX',
    tags: ['401', 'unauthorized', 'auth', 'authentication', 'jwt', 'login', 'deployment', 'token'],
    reuseCount: 1,
    minutesSavedPerReuse: 240,
    relatedKnowledgeIds: ['auth-runbook', 'incident-inc-382'],
  },
}
