import type { AskAnswer } from '../contract.js'

/**
 * Lens: a question in English becomes a canonical query, the connector
 * compiles it, and the answer comes back with the SQL attached.
 *
 * The compiled SQL is returned on every answer and shown behind a disclosure,
 * because a number with its query attached is evidence and a number on its own
 * is something a reader assumes was invented. The model never writes the SQL —
 * it builds the query object and the connector compiles it, which is both the
 * injection boundary and the answer when someone asks about safety.
 *
 * Here the answers are seeded, so the three demo questions work with the wifi
 * off. The shapes are exactly what a live connector would return.
 */
interface SeededAnswer {
  match: string[]
  answer: AskAnswer
}

const ANSWERS: SeededAnswer[] = [
  {
    match: ['category manager', 'saved', 'savings'],
    answer: {
      shape: 'table',
      title: 'Savings by category manager · Q1 2026',
      columns: [
        { key: 'manager', label: 'Category manager', type: 'string' },
        { key: 'savings', label: 'Savings', type: 'currency', primary: true },
        { key: 'events', label: 'Sourcing events', type: 'number' },
      ],
      rows: [
        { manager: 'Priya Nair', savings: 4210000, events: 38 },
        { manager: 'Rahul Menon', savings: 3180000, events: 31 },
        { manager: 'Anjali Rao', savings: 2740000, events: 26 },
        { manager: 'Vikram Shah', savings: 1890000, events: 22 },
      ],
      sql: [
        'SELECT u.name AS manager,',
        '       SUM(r.baseline_value - po.awarded_value) AS savings,',
        '       COUNT(DISTINCT r.id) AS events',
        'FROM purchase_orders po',
        'JOIN rfqs r ON r.id = po.rfq_id',
        'JOIN users u ON u.id = r.owner_id',
        "WHERE po.issued_at >= date_trunc('quarter', CURRENT_DATE)",
        'GROUP BY u.name',
        'ORDER BY savings DESC',
        'LIMIT 10;',
      ].join('\n'),
      tookMs: 1240,
    },
  },
  {
    match: ['tat', 'turnaround', 'rfq created to po', 'business unit'],
    answer: {
      shape: 'number',
      title: 'Average TAT · RFQ created to PO issued',
      value: 6.4,
      unit: 'days',
      delta: { value: -1.2, label: 'vs last quarter' },
      sql: [
        'SELECT AVG(EXTRACT(EPOCH FROM (po.issued_at - r.created_at)) / 86400) AS tat_days',
        'FROM purchase_orders po',
        'JOIN rfqs r ON r.id = po.rfq_id',
        "WHERE po.issued_at >= CURRENT_DATE - INTERVAL '90 days';",
      ].join('\n'),
      tookMs: 980,
    },
  },
  {
    match: ['sla', 'missed', 'vendors'],
    answer: {
      shape: 'table',
      title: 'Vendors missing SLA more than twice · last 60 days',
      columns: [
        { key: 'vendor', label: 'Vendor', type: 'string' },
        { key: 'breaches', label: 'SLA breaches', type: 'number', primary: true },
        { key: 'lastBreach', label: 'Last breach', type: 'date' },
      ],
      rows: [
        { vendor: 'Sharma Steels', breaches: 6, lastBreach: '2026-09-02' },
        { vendor: 'Meridian Alloys', breaches: 4, lastBreach: '2026-08-27' },
        { vendor: 'Kanti Metals', breaches: 3, lastBreach: '2026-09-08' },
      ],
      sql: [
        'SELECT v.name AS vendor,',
        '       COUNT(*) AS breaches,',
        '       MAX(po.delivered_at::date) AS last_breach',
        'FROM purchase_orders po',
        'JOIN vendors v ON v.id = po.vendor_id',
        "WHERE po.delivered_at > po.promised_at",
        "  AND po.delivered_at >= CURRENT_DATE - INTERVAL '60 days'",
        'GROUP BY v.name',
        'HAVING COUNT(*) > 2',
        'ORDER BY breaches DESC;',
      ].join('\n'),
      tookMs: 1010,
    },
  },
]

/**
 * An unrecognised question gets a clean, honest answer rather than an invented
 * one. Validating the entity and every field name against the schema before
 * compiling is what turns an unknown field into an error instead of a query.
 */
export function answerQuestion(question: string): AskAnswer {
  const haystack = question.toLowerCase()
  const hit = ANSWERS.find((candidate) => candidate.match.some((term) => haystack.includes(term)))

  if (hit) return hit.answer

  return {
    shape: 'number',
    title: 'No answer for that question yet',
    value: 0,
    sql: '-- No canonical query could be built: the question did not resolve to a known entity.',
    tookMs: 12,
  }
}
