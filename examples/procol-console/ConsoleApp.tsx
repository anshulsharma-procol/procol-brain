import { useState } from 'react'
import { ProcolBrain } from '../../src'
import type { BrainPosition, BrainTicket, ProcolBrainTheme } from '../../src'

/**
 * A deliberately plain stand-in for a host application. Its only job is to
 * prove that the widget floats above an existing UI, receives page context,
 * and does not inherit or leak styles.
 */

interface Module {
  id: string
  label: string
  recordPrefix: string
  columns: string[]
  rows: string[][]
}

const MODULES: Module[] = [
  {
    id: 'grn',
    label: 'GRN',
    recordPrefix: 'GRN/2627/5',
    columns: ['GRN No.', 'Vendor', 'PO', 'Qty', 'Status'],
    rows: [
      ['GRN/2627/5', 'Northwind Steel', 'PO/8821', '120 MT', 'Pending QC'],
      ['GRN/2627/4', 'Apex Fasteners', 'PO/8817', '4,000 pcs', 'Accepted'],
      ['GRN/2627/3', 'Volt Cables', 'PO/8802', '900 m', 'Accepted'],
    ],
  },
  {
    id: 'invoices',
    label: 'Invoices',
    recordPrefix: 'INV/2026/1183',
    columns: ['Invoice', 'Customer', 'Amount', 'GST', 'Status'],
    rows: [
      ['INV/2026/1183', 'ABC Corp', '₹ 4,20,000', '12%', 'Disputed'],
      ['INV/2026/1182', 'XYZ Corp', '₹ 1,15,500', '18%', 'Paid'],
      ['INV/2026/1181', 'Northwind Steel', '₹ 8,90,000', '18%', 'Paid'],
    ],
  },
  {
    id: 'purchase-orders',
    label: 'Purchase Orders',
    recordPrefix: 'PO/8821',
    columns: ['PO', 'Vendor', 'Value', 'Delivery', 'Status'],
    rows: [
      ['PO/8821', 'Northwind Steel', '₹ 62,00,000', '18 Sep', 'In transit'],
      ['PO/8817', 'Apex Fasteners', '₹ 3,40,000', '12 Sep', 'Delivered'],
    ],
  },
  {
    id: 'vendors',
    label: 'Vendors',
    recordPrefix: 'VEN/311',
    columns: ['Vendor', 'Category', 'Rating', 'Contracts', 'Status'],
    rows: [
      ['Northwind Steel', 'Raw material', '4.6', '12', 'Active'],
      ['Apex Fasteners', 'Consumables', '4.1', '5', 'Active'],
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    recordPrefix: 'RPT/Q3',
    columns: ['Report', 'Period', 'Owner', 'Updated', 'Status'],
    rows: [
      ['Spend analysis', 'Q3 FY26', 'Procurement', '2 days ago', 'Ready'],
      ['Savings tracker', 'Q3 FY26', 'Finance', '5 days ago', 'Ready'],
    ],
  },
]

/** Two presets, to show the same widget white-labelled for another company. */
const BRANDS: Record<string, { assistantName: string; theme?: ProcolBrainTheme }> = {
  procol: { assistantName: 'Procol Brain' },
  acme: {
    assistantName: 'Acme Support AI',
    theme: { primaryColor: '#0f766e', borderRadius: 10, aiColor: '#0f766e' },
  },
}

const DEMO_MESSAGE =
  'My ABC Corp invoice is showing incorrect GST. It should be 18%, but the system is calculating 12%.'

export function ConsoleApp() {
  const [activeId, setActiveId] = useState('invoices')
  const [events, setEvents] = useState<string[]>([])
  const [brandId, setBrandId] = useState<keyof typeof BRANDS>('procol')
  const [position, setPosition] = useState<BrainPosition>('bottom-right')

  const brand = BRANDS[brandId]!

  const active = MODULES.find((module) => module.id === activeId) ?? MODULES[0]!

  const log = (line: string) => setEvents((previous) => [line, ...previous].slice(0, 4))

  return (
    <div className="console">
      <aside className="console__sidebar">
        <div className="console__brand">Procol Console</div>
        <nav className="console__nav">
          {MODULES.map((module) => (
            <button
              key={module.id}
              type="button"
              className={
                module.id === activeId ? 'console__navItem console__navItem--active' : 'console__navItem'
              }
              onClick={() => setActiveId(module.id)}
            >
              {module.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="console__main">
        <header className="console__header">
          <div>
            <h1 className="console__title">{active.label}</h1>
            <p className="console__breadcrumb">
              Home / {active.label} / {active.recordPrefix}
            </p>
          </div>
          <div className="console__headerRight">
            <label className="console__control">
              Branding
              <select
                value={brandId}
                onChange={(event) => setBrandId(event.target.value as keyof typeof BRANDS)}
              >
                <option value="procol">Procol Brain</option>
                <option value="acme">Acme Support AI</option>
              </select>
            </label>
            <label className="console__control">
              Position
              <select
                value={position}
                onChange={(event) => setPosition(event.target.value as BrainPosition)}
              >
                <option value="bottom-right">bottom-right</option>
                <option value="bottom-left">bottom-left</option>
              </select>
            </label>
            <div className="console__user">AS</div>
          </div>
        </header>

        <section className="console__hint">
          <strong>Demo script</strong>
          <p>
            Open <em>Help &amp; Support</em>, choose <em>Report a problem</em>, then paste:
          </p>
          <code>{DEMO_MESSAGE}</code>
          <button
            type="button"
            className="console__copy"
            onClick={() => void navigator.clipboard?.writeText(DEMO_MESSAGE)}
          >
            Copy
          </button>
        </section>

        <div className="console__card">
          <table className="console__table">
            <thead>
              <tr>
                {active.columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {active.rows.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, index) => (
                    <td key={index}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {events.length > 0 && (
          <section className="console__events">
            <strong>Host callbacks</strong>
            <ul>
              {events.map((event, index) => (
                <li key={index}>{event}</li>
              ))}
            </ul>
          </section>
        )}
      </main>

      {/* The entire integration surface of the SDK. */}
      <ProcolBrain
        key={brandId}
        companyId="procol"
        userId="user-123"
        assistantName={brand.assistantName}
        theme={brand.theme}
        position={position}
        context={{
          currentPage: active.id,
          currentModule: active.label,
          recordId: active.recordPrefix,
        }}
        onTicketCreated={(ticket: BrainTicket) => log(`onTicketCreated -> #${ticket.reference}`)}
        onTicketResolved={(ticket: BrainTicket) => log(`onTicketResolved -> #${ticket.reference}`)}
      />
    </div>
  )
}
