import { File, FileText, Folder, Trash2 } from 'lucide-react'
import Card from '../../components/Card'
import { formatFileDate, formatFileSize } from '../storage'
import type { FileSystemNode } from '../types'

interface FilePreviewPanelProps {
  node: FileSystemNode | null
  onDelete: (nodeId: string) => void
}

export default function FilePreviewPanel({ node, onDelete }: FilePreviewPanelProps) {
  if (!node) {
    return (
      <Card className="flex h-fit flex-col items-center gap-2 p-10 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gray-100">
          <Folder className="h-5 w-5 text-gray-400" />
        </div>
        <p className="text-sm font-medium text-gray-700">Select a file to preview</p>
        <p className="text-sm text-gray-400">Click any file on the left to see its contents here.</p>
      </Card>
    )
  }

  return (
    <Card className="h-fit p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-100">
            <FileText className="h-5 w-5 text-blue-600" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-gray-900">{node.name}</h2>
            <p className="text-sm text-gray-500">
              {formatFileSize(node.sizeBytes)} · Updated {formatFileDate(node.updatedAt)}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onDelete(node.id)}
          aria-label="Delete file"
          className="shrink-0 rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-5">
        <h3 className="mb-2 text-sm font-semibold text-gray-900">Content</h3>
        {node.previewKind === 'text' && node.content ? (
          <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-4 font-sans text-sm text-gray-700">
            {node.content}
          </pre>
        ) : (
          <div className="flex items-center gap-2.5 rounded-lg bg-gray-50 p-4 text-sm text-gray-400">
            <File className="h-4 w-4 shrink-0" />
            Preview not available for this file type.
          </div>
        )}
      </div>
    </Card>
  )
}
