import type { FileSystemNode } from './types'

const FILES_STORAGE_KEY = 'clara_knowledge_files_v1'

const HOUR_MS = 60 * 60 * 1000

/** Text-like extensions we can actually read and preview inline. */
const TEXT_EXTENSIONS = ['txt', 'md', 'markdown', 'csv', 'json', 'log', 'yml', 'yaml']

function seedNodes(): FileSystemNode[] {
  const now = Date.now()
  const iso = (hoursAgo: number) => new Date(now - hoursAgo * HOUR_MS).toISOString()

  return [
    { id: 'folder-contracts', parentId: null, name: 'Contracts', kind: 'folder', updatedAt: iso(48) },
    { id: 'folder-vendor-docs', parentId: null, name: 'Vendor Docs', kind: 'folder', updatedAt: iso(72) },
    {
      id: 'file-gst-notes',
      parentId: null,
      name: 'gst_notes.txt',
      kind: 'file',
      previewKind: 'text',
      content:
        'GST notes\n\nDefault rate: 18%\nFormula: (Base Amount - Discount) + GST\nTenant-specific rates override the default.\n\nSee ABC Corp - Tenant Settings for the configured rate.',
      sizeBytes: 612,
      updatedAt: iso(6),
    },
    {
      id: 'file-msa',
      parentId: 'folder-contracts',
      name: 'ABC_Corp_MSA.pdf',
      kind: 'file',
      previewKind: 'unsupported',
      sizeBytes: 482_300,
      updatedAt: iso(50),
    },
    {
      id: 'file-vendor-terms',
      parentId: 'folder-contracts',
      name: 'vendor_terms.md',
      kind: 'file',
      previewKind: 'text',
      content:
        '# Standard Vendor Terms\n\n- Payment terms: NET 30\n- Discount: per contract tier\n- GST applied per tenant configuration\n- Termination: 30 days written notice',
      sizeBytes: 1_240,
      updatedAt: iso(49),
    },
    {
      id: 'file-onboarding',
      parentId: 'folder-vendor-docs',
      name: 'northwind_onboarding.txt',
      kind: 'file',
      previewKind: 'text',
      content:
        'Northwind Logistics onboarding checklist\n\n1. Compliance documents verified\n2. Bank details confirmed\n3. Tax registration confirmed\n4. Manager sign-off pending',
      sizeBytes: 890,
      updatedAt: iso(73),
    },
  ]
}

export function loadFileNodesFromStorage(): FileSystemNode[] {
  try {
    const raw = localStorage.getItem(FILES_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as FileSystemNode[]
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {
    // fall through to reseed
  }
  const seeded = seedNodes()
  saveFileNodesToStorage(seeded)
  return seeded
}

export function saveFileNodesToStorage(nodes: FileSystemNode[]): void {
  try {
    localStorage.setItem(FILES_STORAGE_KEY, JSON.stringify(nodes))
  } catch {
    // localStorage unavailable (private mode, quota) — fail silently, in-memory state still works
  }
}

export function newFileNodeId(): string {
  return `node-${Math.random().toString(36).slice(2, 10)}`
}

export function isTextExtension(fileName: string): boolean {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? ''
  return TEXT_EXTENSIONS.includes(extension)
}

export function formatFileSize(bytes: number | undefined): string {
  if (bytes === undefined) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatFileDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
